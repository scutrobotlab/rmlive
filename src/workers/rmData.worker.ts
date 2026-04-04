/// <reference lib="webworker" />

import {
  extractLiveZones,
  fetchCurrentAndNextMatches,
  fetchGroupRankInfo,
  fetchGroupsOrder,
  fetchLiveGameInfo,
  fetchRobotData,
  fetchSchedule,
  resolveLiveStreamUrl,
  type LiveZoneOption,
} from '../api/rmApi';
import { BOOTSTRAP_PER_REQUEST_TIMEOUT_MS, BOOTSTRAP_TOTAL_TIMEOUT_MS } from '../constants/runtime';
import type {
  CurrentAndNextMatches,
  GroupRankInfo,
  GroupsOrder,
  LiveGameInfo,
  RobotData,
  Schedule,
} from '../types/api';
import { resolveZoneChatRoomId } from '../utils/chatRoomView';
import { buildTeamGroupMap, extractGroupSections } from '../utils/groupView';
import { getRunningMatch, getScheduleEventTitle, getScheduleRows } from '../utils/matchView';
import { toErrorSummary } from '../utils/observability';
import {
  resolveDefaultQualityRes,
  resolveEffectiveStreamErrorMessage,
  toPlayerQualityOptions,
} from '../utils/rmStreamView';
import { getNowEpochSeconds } from '../utils/timeNow';
import { normalizeZoneId, resolveZoneUiState, toZoneOptionItem, type ZoneOptionItem } from '../utils/zoneView';
import type { RmDataInitPayload, RmDataSnapshot, RmDataWorkerIncomingMessage } from './rmDataProtocol';

declare const self: DedicatedWorkerGlobalScope;

interface WorkerState {
  liveGameInfo: LiveGameInfo | null;
  currentAndNextMatches: CurrentAndNextMatches | null;
  groupsOrder: GroupsOrder | null;
  groupRankInfo: GroupRankInfo | null;
  robotData: RobotData | null;
  schedule: Schedule | null;
  selectedZoneId: string | null;
  selectedQualityRes: string | null;
  historySelectedZoneId: string | null;
  hasManualZoneSelection: boolean;
  streamLoading: boolean;
  streamErrorMessage: string;
  visible: boolean;
}

const DEFAULT_INTERVALS = {
  liveGameInfoMs: 12_000,
  currentAndNextMatchesMs: 12_000,
  groupsOrderMs: 30_000,
  scheduleMs: 45_000,
};

const state: WorkerState = {
  liveGameInfo: null,
  currentAndNextMatches: null,
  groupsOrder: null,
  groupRankInfo: null,
  robotData: null,
  schedule: null,
  selectedZoneId: null,
  selectedQualityRes: null,
  historySelectedZoneId: null,
  hasManualZoneSelection: false,
  streamLoading: true,
  streamErrorMessage: '',
  visible: true,
};

let stopped = false;
let bootstrapToken = 0;
let streamProbeToken = 0;
let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSnapshotKind: 'BOOTSTRAP_STATE' | 'PATCH_STATE' | null = null;

interface PollingLoop {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

const pollingLoops = new Map<string, PollingLoop>();

function postLog(level: 'info' | 'warn', scope: string, message: string, meta?: Record<string, unknown>) {
  self.postMessage({ type: 'LOG', payload: { level, scope, message, meta } });
}

function pickAutoZoneIdByPriority(options: ZoneOptionItem[], historyZoneId: string | null): string | null {
  if (!options.length) {
    return null;
  }

  const historyNorm = normalizeZoneId(historyZoneId);
  const historyAndLive =
    historyNorm !== ''
      ? options.find((item) => normalizeZoneId(item.value) === historyNorm && item.state === 'live')
      : null;
  if (historyAndLive) {
    return historyAndLive.value;
  }

  const living = options.find((item) => item.state === 'live');
  if (living) {
    return living.value;
  }

  const offline = options.find((item) => item.state === 'offline');
  if (offline) {
    return offline.value;
  }

  return options[0]?.value ?? null;
}

function getLiveZoneOptions(): LiveZoneOption[] {
  return extractLiveZones(state.liveGameInfo);
}

function getSelectedLiveZone(liveZones: LiveZoneOption[]): LiveZoneOption | null {
  if (!liveZones.length) {
    return null;
  }

  const targetId = normalizeZoneId(state.selectedZoneId);
  return liveZones.find((zone) => normalizeZoneId(zone.zoneId) === targetId) ?? liveZones[0] ?? null;
}

function syncSelectionAfterDataChange() {
  const liveZones = getLiveZoneOptions();
  if (!liveZones.length) {
    state.selectedZoneId = null;
    state.selectedQualityRes = null;
    return;
  }

  const nowEpoch = getNowEpochSeconds();
  const zoneOptions = liveZones.map((zone) => toZoneOptionItem(zone, nowEpoch));
  const preferred = pickAutoZoneIdByPriority(zoneOptions, state.historySelectedZoneId);
  const preferredNorm = normalizeZoneId(preferred);
  const currentNorm = normalizeZoneId(state.selectedZoneId);
  const currentExists = currentNorm !== '' && zoneOptions.some((item) => normalizeZoneId(item.value) === currentNorm);

  if (!state.hasManualZoneSelection) {
    if (preferredNorm && preferredNorm !== currentNorm) {
      state.selectedZoneId = preferredNorm;
    } else if (!currentExists && preferredNorm) {
      state.selectedZoneId = preferredNorm;
    }
  } else if (!currentExists && preferredNorm) {
    state.selectedZoneId = preferredNorm;
  }

  const selectedZone = getSelectedLiveZone(liveZones);
  state.selectedZoneId = selectedZone ? normalizeZoneId(selectedZone.zoneId) || null : null;
  state.selectedQualityRes = resolveDefaultQualityRes(selectedZone, state.selectedQualityRes);
}

function buildSnapshot(): RmDataSnapshot {
  const liveZones = getLiveZoneOptions();
  const nowEpoch = getNowEpochSeconds();
  const zoneOptions = liveZones.map((zone) => toZoneOptionItem(zone, nowEpoch));
  const selectedZone = getSelectedLiveZone(liveZones);
  const selectedZoneUiState = selectedZone ? resolveZoneUiState(selectedZone, nowEpoch) : null;
  const selectedZoneId = selectedZone ? normalizeZoneId(selectedZone.zoneId) || null : null;
  const selectedZoneName = selectedZone?.zoneName ?? null;
  const effectiveSelectedZoneId = normalizeZoneId(state.selectedZoneId) || selectedZoneId || null;
  const resolvedStreamUrl = resolveLiveStreamUrl(state.liveGameInfo, effectiveSelectedZoneId, state.selectedQualityRes);
  const canPlaySelectedZone = Boolean(selectedZone && resolvedStreamUrl && !state.streamErrorMessage.trim());
  const effectiveStreamUrl = canPlaySelectedZone ? resolvedStreamUrl : null;
  const effectiveStreamErrorMessage = resolveEffectiveStreamErrorMessage(
    canPlaySelectedZone,
    selectedZone,
    selectedZoneUiState,
    state.streamErrorMessage,
  );
  const groupSections = extractGroupSections(state.groupsOrder, effectiveSelectedZoneId, selectedZoneName);
  const teamGroupMap = buildTeamGroupMap(groupSections);
  const scheduleEventTitle = getScheduleEventTitle(state.schedule);
  const playerQualityOptions = toPlayerQualityOptions(selectedZone);
  const selectedZoneChatRoomId = resolveZoneChatRoomId(state.liveGameInfo, effectiveSelectedZoneId, selectedZoneName);
  const scheduleMatchRows = getScheduleRows(state.schedule, state.liveGameInfo);
  const runningMatchForSelectedZone = getRunningMatch(scheduleMatchRows, effectiveSelectedZoneId);

  return {
    liveGameInfo: state.liveGameInfo,
    currentAndNextMatches: state.currentAndNextMatches,
    groupsOrder: state.groupsOrder,
    groupRankInfo: state.groupRankInfo,
    robotData: state.robotData,
    schedule: state.schedule,
    selectedZoneId: effectiveSelectedZoneId,
    effectiveSelectedZoneId,
    selectedQualityRes: state.selectedQualityRes,
    selectedZoneName,
    selectedZoneUiState,
    streamLoading: state.streamLoading,
    streamErrorMessage: state.streamErrorMessage,
    zoneOptions,
    effectiveStreamUrl,
    effectiveStreamErrorMessage,
    groupSections,
    teamGroupMap,
    scheduleEventTitle,
    playerQualityOptions,
    selectedZoneChatRoomId,
    scheduleMatchRows,
    runningMatchForSelectedZone,
  };
}

function scheduleSnapshot(kind: 'BOOTSTRAP_STATE' | 'PATCH_STATE') {
  if (stopped) {
    return;
  }

  pendingSnapshotKind = pendingSnapshotKind === 'BOOTSTRAP_STATE' ? 'BOOTSTRAP_STATE' : kind;

  if (snapshotTimer) {
    clearTimeout(snapshotTimer);
  }

  snapshotTimer = setTimeout(() => {
    snapshotTimer = null;
    const snapshotKind = pendingSnapshotKind ?? 'PATCH_STATE';
    pendingSnapshotKind = null;
    self.postMessage({ type: snapshotKind, payload: buildSnapshot() });
  }, 32);
}

function createPollingLoop(
  label: string,
  runner: () => Promise<void>,
  intervalMs: number,
  initialDelayMs = intervalMs,
): PollingLoop {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let enabled = true;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function tick() {
    if (stopped || !enabled || running) {
      return;
    }

    if (!state.visible) {
      timer = setTimeout(tick, Math.min(intervalMs, 5_000));
      return;
    }

    running = true;
    try {
      await runner();
    } catch (error) {
      postLog('warn', label, 'polling runner failed', { error: toErrorSummary(error) });
    } finally {
      running = false;
      if (!stopped && enabled) {
        timer = setTimeout(tick, intervalMs);
      }
    }
  }

  return {
    start() {
      enabled = true;
      clearTimer();
      timer = setTimeout(tick, Math.max(0, initialDelayMs));
    },
    stop() {
      enabled = false;
      clearTimer();
    },
    pause() {
      clearTimer();
    },
    resume() {
      if (stopped || !enabled) {
        return;
      }
      clearTimer();
      timer = setTimeout(tick, 0);
    },
  };
}

async function withBootstrapTimeout<T>(promise: Promise<T>, startedAt: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(1_000, BOOTSTRAP_TOTAL_TIMEOUT_MS - elapsed);
    const timeout = Math.min(BOOTSTRAP_PER_REQUEST_TIMEOUT_MS, remaining);
    const timer = setTimeout(() => reject(new Error('bootstrap timeout')), timeout);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function setStreamError(message: string) {
  state.streamErrorMessage = message;
  self.postMessage({ type: 'STREAM_ERROR', payload: { message } });
}

async function isStreamUrlReachable(url: string): Promise<boolean> {
  const timeoutMs = 6000;

  async function run(method: 'HEAD' | 'GET'): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method,
        cache: 'no-store',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    const head = await run('HEAD');
    if (head.ok) {
      return true;
    }
    if (head.status !== 405 && head.status !== 501) {
      return false;
    }
  } catch {
    // fallback to GET
  }

  try {
    const get = await run('GET');
    return get.ok;
  } catch {
    return false;
  }
}

async function probeSelectedStreamAvailability(options: { showLoading: boolean }) {
  const token = ++streamProbeToken;
  const liveZones = getLiveZoneOptions();
  const selectedZone = getSelectedLiveZone(liveZones);
  const effectiveSelectedZoneId =
    normalizeZoneId(state.selectedZoneId) || normalizeZoneId(selectedZone?.zoneId) || null;
  const streamUrl = resolveLiveStreamUrl(state.liveGameInfo, effectiveSelectedZoneId, state.selectedQualityRes);

  if (options.showLoading) {
    state.streamLoading = true;
    scheduleSnapshot('PATCH_STATE');
  }

  if (!streamUrl) {
    if (token !== streamProbeToken) {
      return;
    }

    state.streamErrorMessage = '';
    if (options.showLoading) {
      state.streamLoading = false;
    }
    scheduleSnapshot('PATCH_STATE');
    return;
  }

  const reachable = await isStreamUrlReachable(streamUrl);
  if (token !== streamProbeToken) {
    return;
  }

  state.streamErrorMessage = reachable ? '' : '直播流暂时不可用，请稍后重试';
  if (options.showLoading) {
    state.streamLoading = false;
  }
  scheduleSnapshot('PATCH_STATE');
}

function stopAll() {
  stopped = true;
  streamProbeToken += 1;
  if (snapshotTimer) {
    clearTimeout(snapshotTimer);
    snapshotTimer = null;
  }
  pendingSnapshotKind = null;
  pollingLoops.forEach((loop) => loop.stop());
  pollingLoops.clear();
}

async function runBootstrap(payload: RmDataInitPayload) {
  const token = ++bootstrapToken;
  const startedAt = Date.now();

  const results = await Promise.allSettled([
    withBootstrapTimeout(fetchLiveGameInfo(), startedAt),
    withBootstrapTimeout(fetchCurrentAndNextMatches(), startedAt),
    withBootstrapTimeout(fetchGroupsOrder(), startedAt),
    withBootstrapTimeout(fetchSchedule(), startedAt),
    withBootstrapTimeout(fetchRobotData(), startedAt),
    withBootstrapTimeout(fetchGroupRankInfo(), startedAt),
  ]);

  if (stopped || token !== bootstrapToken) {
    return;
  }

  const [liveGameInfoResult, currentAndNextResult, groupsOrderResult, scheduleResult, robotResult, groupRankResult] =
    results;

  if (liveGameInfoResult.status === 'fulfilled') {
    state.liveGameInfo = liveGameInfoResult.value;
  }
  if (currentAndNextResult.status === 'fulfilled') {
    state.currentAndNextMatches = currentAndNextResult.value;
  }
  if (groupsOrderResult.status === 'fulfilled') {
    state.groupsOrder = groupsOrderResult.value;
  }
  if (scheduleResult.status === 'fulfilled') {
    state.schedule = scheduleResult.value;
  }
  if (robotResult.status === 'fulfilled') {
    state.robotData = robotResult.value;
  }
  if (groupRankResult.status === 'fulfilled') {
    state.groupRankInfo = groupRankResult.value;
  }

  const settledResults: Array<[string, PromiseSettledResult<unknown>]> = [
    ['liveGameInfo', liveGameInfoResult],
    ['currentAndNextMatches', currentAndNextResult],
    ['groupsOrder', groupsOrderResult],
    ['schedule', scheduleResult],
    ['robotData', robotResult],
    ['groupRankInfo', groupRankResult],
  ];

  const rejectedSources = settledResults.filter(([, result]) => result.status === 'rejected').map(([name]) => name);

  if (rejectedSources.length > 0) {
    postLog('warn', 'bootstrap', 'bootstrap completed with rejected requests', { rejectedSources });
  }

  if (liveGameInfoResult.status === 'rejected') {
    const message = '直播流请求失败，请检查网络后重试';
    setStreamError(message);
    postLog('warn', 'stream', 'live_game_info bootstrap request failed', {
      error: toErrorSummary(liveGameInfoResult.reason),
    });
  }

  syncSelectionAfterDataChange();
  scheduleSnapshot('BOOTSTRAP_STATE');
  void probeSelectedStreamAvailability({ showLoading: true });
  void payload;
}

function startPollingLoops() {
  pollingLoops.clear();

  pollingLoops.set(
    'liveGameInfo',
    createPollingLoop(
      'liveGameInfo',
      async () => {
        try {
          state.liveGameInfo = await fetchLiveGameInfo();
          syncSelectionAfterDataChange();
          void probeSelectedStreamAvailability({ showLoading: false });
        } catch (error) {
          const liveZones = getLiveZoneOptions();
          const selectedZone = getSelectedLiveZone(liveZones);
          if (selectedZone && resolveZoneUiState(selectedZone, getNowEpochSeconds()) === 'live') {
            const message = '直播流暂时不可用，请稍后重试';
            setStreamError(message);
            scheduleSnapshot('PATCH_STATE');
          }
          postLog('warn', 'stream', 'live_game_info polling failed', { error: toErrorSummary(error) });
        }
      },
      DEFAULT_INTERVALS.liveGameInfoMs,
    ),
  );

  pollingLoops.set(
    'currentAndNextMatches',
    createPollingLoop(
      'currentAndNextMatches',
      async () => {
        try {
          state.currentAndNextMatches = await fetchCurrentAndNextMatches();
          scheduleSnapshot('PATCH_STATE');
        } catch (error) {
          postLog('warn', 'currentAndNextMatches', 'polling failed', { error: toErrorSummary(error) });
        }
      },
      DEFAULT_INTERVALS.currentAndNextMatchesMs,
    ),
  );

  pollingLoops.set(
    'groupsOrder',
    createPollingLoop(
      'groupsOrder',
      async () => {
        try {
          state.groupsOrder = await fetchGroupsOrder();
          scheduleSnapshot('PATCH_STATE');
        } catch (error) {
          postLog('warn', 'groupsOrder', 'polling failed', { error: toErrorSummary(error) });
        }
      },
      DEFAULT_INTERVALS.groupsOrderMs,
    ),
  );

  pollingLoops.set(
    'schedule',
    createPollingLoop(
      'schedule',
      async () => {
        try {
          state.schedule = await fetchSchedule();
          syncSelectionAfterDataChange();
          scheduleSnapshot('PATCH_STATE');
        } catch (error) {
          postLog('warn', 'schedule', 'polling failed', { error: toErrorSummary(error) });
        }
      },
      DEFAULT_INTERVALS.scheduleMs,
    ),
  );

  pollingLoops.forEach((loop) => loop.start());
}

function handleInit(payload: RmDataInitPayload) {
  stopped = false;
  state.liveGameInfo = null;
  state.currentAndNextMatches = null;
  state.groupsOrder = null;
  state.groupRankInfo = null;
  state.robotData = null;
  state.schedule = null;
  state.historySelectedZoneId = payload.historySelectedZoneId;
  state.selectedZoneId = payload.selectedZoneId;
  state.selectedQualityRes = payload.selectedQualityRes;
  state.hasManualZoneSelection = payload.hasManualZoneSelection;
  state.streamLoading = true;
  state.streamErrorMessage = '';
  state.visible = true;
  pollingLoops.forEach((loop) => loop.stop());
  pollingLoops.clear();
  void runBootstrap(payload).then(() => {
    if (!stopped) {
      startPollingLoops();
    }
  });
}

self.addEventListener('message', (event: MessageEvent<RmDataWorkerIncomingMessage>) => {
  const data = event.data;
  if (!data || typeof data !== 'object') {
    return;
  }

  if (data.type === 'INIT') {
    handleInit(data.payload);
    return;
  }

  if (data.type === 'STOP') {
    stopAll();
    return;
  }

  if (data.type === 'VISIBILITY_CHANGED') {
    state.visible = !data.payload.hidden;
    pollingLoops.forEach((loop) => {
      if (state.visible) {
        loop.resume();
      } else {
        loop.pause();
      }
    });
    return;
  }

  if (data.type === 'USER_SELECT_ZONE') {
    state.hasManualZoneSelection = true;
    state.selectedZoneId =
      data.payload.zoneId != null && data.payload.zoneId !== '' ? normalizeZoneId(data.payload.zoneId) : null;
    syncSelectionAfterDataChange();
    void probeSelectedStreamAvailability({ showLoading: true });
    return;
  }

  if (data.type === 'USER_SELECT_QUALITY') {
    state.selectedQualityRes =
      data.payload.qualityRes && data.payload.qualityRes.trim() ? data.payload.qualityRes : null;
    void probeSelectedStreamAvailability({ showLoading: true });
    return;
  }

  if (data.type === 'RETRY_STREAM') {
    state.streamLoading = true;
    state.streamErrorMessage = '';
    void fetchLiveGameInfo()
      .then((info) => {
        state.liveGameInfo = info;
        syncSelectionAfterDataChange();
        return probeSelectedStreamAvailability({ showLoading: false });
      })
      .catch((error) => {
        const message = '直播流请求失败，请检查网络后重试';
        setStreamError(message);
        postLog('warn', 'stream', 'retry live stream failed', { error: toErrorSummary(error) });
      })
      .finally(() => {
        if (state.streamLoading) {
          state.streamLoading = false;
          scheduleSnapshot('PATCH_STATE');
        }
      });
  }
});
