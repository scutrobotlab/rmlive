import { useLocalStorage } from '@vueuse/core';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  CurrentAndNextMatches,
  GroupRankInfo,
  GroupsOrder,
  LiveGameInfo,
  RobotData,
  Schedule,
} from '../types/api';
import type { GroupSection, TeamGroupMeta } from '../utils/groupView';
import type { MatchView } from '../utils/matchView';
import { logInfo, logWarn } from '../utils/observability';
import type { PlayerQualityOption } from '../utils/rmStreamView';
import { normalizeZoneId, type ZoneOptionItem, type ZoneUiState } from '../utils/zoneView';
import type {
  RmDataInitPayload,
  RmDataSnapshot,
  RmDataWorkerIncomingMessage,
  RmDataWorkerOutgoingMessage,
} from '../workers/rmDataProtocol';

export type { ZoneOptionItem, ZoneUiState };

export const useRmDataStore = defineStore('rm-data', () => {
  const liveGameInfo = ref<LiveGameInfo | null>(null);
  const currentAndNextMatches = ref<CurrentAndNextMatches | null>(null);
  const groupsOrder = ref<GroupsOrder | null>(null);
  const groupRankInfo = ref<GroupRankInfo | null>(null);
  const robotData = ref<RobotData | null>(null);
  const schedule = ref<Schedule | null>(null);

  const selectedZoneId = ref<string | null>(null);
  const effectiveSelectedZoneId = ref<string | null>(null);
  const selectedQualityRes = ref<string | null>(null);
  const selectedZoneName = ref<string | null>(null);
  const selectedZoneUiState = ref<ZoneUiState | null>(null);
  const streamLoading = ref(true);
  const streamErrorMessage = ref('');

  const zoneOptions = ref<ZoneOptionItem[]>([]);
  const effectiveStreamUrl = ref<string | null>(null);
  const effectiveStreamErrorMessage = ref('');
  const groupSections = ref<GroupSection[]>([]);
  const teamGroupMap = ref<Record<string, TeamGroupMeta>>({});
  const scheduleEventTitle = ref('');
  const playerQualityOptions = ref<PlayerQualityOption[]>([]);
  const selectedZoneChatRoomId = ref<string | null>(null);
  const scheduleMatchRows = ref<MatchView[]>([]);
  const runningMatchForSelectedZone = ref<MatchView | null>(null);

  const historySelectedZoneId = useLocalStorage<string | null>('rmlive:zone-selection', null);

  let worker: Worker | null = null;
  let isStopping = false;
  let hasManualZoneSelection = false;
  let visibilityListenerAttached = false;
  let workerRestarting = false;

  function applySnapshot(snapshot: RmDataSnapshot) {
    liveGameInfo.value = snapshot.liveGameInfo;
    currentAndNextMatches.value = snapshot.currentAndNextMatches;
    groupsOrder.value = snapshot.groupsOrder;
    groupRankInfo.value = snapshot.groupRankInfo;
    robotData.value = snapshot.robotData;
    schedule.value = snapshot.schedule;

    selectedZoneId.value = snapshot.selectedZoneId;
    effectiveSelectedZoneId.value = snapshot.effectiveSelectedZoneId;
    selectedQualityRes.value = snapshot.selectedQualityRes;
    selectedZoneName.value = snapshot.selectedZoneName;
    selectedZoneUiState.value = snapshot.selectedZoneUiState;
    streamLoading.value = snapshot.streamLoading;
    streamErrorMessage.value = snapshot.streamErrorMessage;

    zoneOptions.value = snapshot.zoneOptions;
    effectiveStreamUrl.value = snapshot.effectiveStreamUrl;
    effectiveStreamErrorMessage.value = snapshot.effectiveStreamErrorMessage;
    groupSections.value = snapshot.groupSections;
    teamGroupMap.value = snapshot.teamGroupMap;
    scheduleEventTitle.value = snapshot.scheduleEventTitle;
    playerQualityOptions.value = snapshot.playerQualityOptions;
    selectedZoneChatRoomId.value = snapshot.selectedZoneChatRoomId;
    scheduleMatchRows.value = snapshot.scheduleMatchRows;
    runningMatchForSelectedZone.value = snapshot.runningMatchForSelectedZone;
  }

  function buildInitPayload(): RmDataInitPayload {
    return {
      historySelectedZoneId: historySelectedZoneId.value,
      selectedZoneId: selectedZoneId.value,
      selectedQualityRes: selectedQualityRes.value,
      hasManualZoneSelection,
    };
  }

  function postToWorker(message: RmDataWorkerIncomingMessage) {
    if (!worker || isStopping) {
      return;
    }

    worker.postMessage(message);
  }

  function setVisibilityInWorker() {
    if (typeof document === 'undefined') {
      return;
    }

    postToWorker({ type: 'VISIBILITY_CHANGED', payload: { hidden: document.hidden } });
  }

  function attachVisibilityListener() {
    if (visibilityListenerAttached || typeof document === 'undefined') {
      return;
    }

    document.addEventListener('visibilitychange', setVisibilityInWorker);
    visibilityListenerAttached = true;
  }

  function detachVisibilityListener() {
    if (!visibilityListenerAttached || typeof document === 'undefined') {
      return;
    }

    document.removeEventListener('visibilitychange', setVisibilityInWorker);
    visibilityListenerAttached = false;
  }

  function spawnWorker(): Worker {
    if (worker) {
      worker.terminate();
    }

    const nextWorker = new Worker(new URL('../workers/rmData.worker.ts', import.meta.url), { type: 'module' });
    nextWorker.onmessage = (event: MessageEvent<RmDataWorkerOutgoingMessage>) => {
      const data = event.data;
      if (!data || typeof data !== 'object') {
        return;
      }

      if (data.type === 'BOOTSTRAP_STATE' || data.type === 'PATCH_STATE') {
        applySnapshot(data.payload);
        return;
      }

      if (data.type === 'STREAM_ERROR') {
        streamErrorMessage.value = data.payload.message;
        return;
      }

      if (data.type === 'LOG') {
        if (data.payload.level === 'info') {
          logInfo(data.payload.scope, data.payload.message, data.payload.meta);
        } else {
          logWarn(data.payload.scope, data.payload.message, data.payload.meta);
        }
      }
    };

    nextWorker.onerror = (event) => {
      if (isStopping) {
        return;
      }

      const error = event.error ?? event.message;
      logWarn('rm-data-worker', 'worker error', { error: String(error ?? 'unknown') });

      if (workerRestarting) {
        return;
      }

      workerRestarting = true;
      streamLoading.value = true;
      streamErrorMessage.value = '';

      try {
        nextWorker.terminate();
      } catch {
        // ignore terminate races
      }

      worker = null;
      const restartedWorker = spawnWorker();
      restartedWorker.postMessage({ type: 'INIT', payload: buildInitPayload() });
      setVisibilityInWorker();
      workerRestarting = false;
    };

    nextWorker.onmessageerror = (event) => {
      logWarn('rm-data-worker', 'message error', { error: String(event.data ?? 'unknown') });
    };

    worker = nextWorker;
    return nextWorker;
  }

  function startWorker() {
    isStopping = false;
    const currentWorker = spawnWorker();
    currentWorker.postMessage({ type: 'INIT', payload: buildInitPayload() });
    attachVisibilityListener();
    setVisibilityInWorker();
  }

  function stopWorker() {
    isStopping = true;
    detachVisibilityListener();

    if (!worker) {
      return;
    }

    try {
      worker.postMessage({ type: 'STOP' });
    } catch {
      // ignore stop races
    }

    worker.terminate();
    worker = null;
  }

  function selectZone(value: string | null) {
    if (value != null) {
      const target = zoneOptions.value.find((item) => item.value === value);
      if (target?.disabled) {
        return;
      }
    }

    hasManualZoneSelection = true;
    const normalized = value != null && value !== '' ? normalizeZoneId(value) : null;
    selectedZoneId.value = normalized;
    historySelectedZoneId.value = normalized;
    postToWorker({ type: 'USER_SELECT_ZONE', payload: { zoneId: normalized } });
  }

  function selectQuality(qualityRes: string | null) {
    selectedQualityRes.value = qualityRes;
    postToWorker({ type: 'USER_SELECT_QUALITY', payload: { qualityRes } });
  }

  function startPolling() {
    stopWorker();
    hasManualZoneSelection = false;
    streamLoading.value = true;
    streamErrorMessage.value = '';
    startWorker();
  }

  function stopPolling() {
    stopWorker();
  }

  function retryLiveStream() {
    streamLoading.value = true;
    streamErrorMessage.value = '';
    postToWorker({ type: 'RETRY_STREAM' });
  }

  return {
    liveGameInfo,
    currentAndNextMatches,
    groupRankInfo,
    robotData,
    schedule,
    selectedZoneId,
    effectiveSelectedZoneId,
    selectedQualityRes,
    selectedZoneName,
    selectedZoneUiState,
    streamLoading,
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
    selectZone,
    selectQuality,
    startPolling,
    stopPolling,
    retryLiveStream,
  };
});
