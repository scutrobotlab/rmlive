import { useLocalStorage } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed, ref, watch, type Ref } from 'vue';
import {
  extractLiveZones,
  fetchCurrentAndNextMatches,
  fetchGroupRankInfo,
  fetchGroupsOrder,
  fetchLiveGameInfo,
  fetchRobotData,
  fetchSchedule,
  resolveLiveStreamUrl,
  startRmPolling,
  type RmPollingController,
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
import { getRunningMatch, getScheduleEventTitle, getScheduleRows, type MatchView } from '../utils/matchView';
import { logWarn, toErrorSummary } from '../utils/observability';
import {
  resolveDefaultQualityRes,
  resolveEffectiveStreamErrorMessage,
  toPlayerQualityOptions,
} from '../utils/rmStreamView';
import { getNowEpochSeconds } from '../utils/timeNow';
import {
  normalizeZoneId,
  resolveZoneUiState,
  toZoneOptionItem,
  type ZoneOptionItem,
  type ZoneUiState,
} from '../utils/zoneView';

export type { ZoneOptionItem, ZoneUiState };

/**
 * Live data + zone/stream selection.
 *
 * - `selectedZoneId`: canonical UI / props id (normalized when written); kept in sync with enabled zones when not manual, or coerced when orphan.
 * - `effectiveSelectedZoneId`: same as selected when set; else falls back to resolved `selectedZone` (defensive reads).
 */
export const useRmDataStore = defineStore('rm-data', () => {
  // --- state ---
  const liveGameInfo = ref<LiveGameInfo | null>(null);
  const currentAndNextMatches = ref<CurrentAndNextMatches | null>(null);
  const groupsOrder = ref<GroupsOrder | null>(null);
  const groupRankInfo = ref<GroupRankInfo | null>(null);
  const robotData = ref<RobotData | null>(null);
  const schedule = ref<Schedule | null>(null);

  const selectedZoneId = ref<string | null>(null);
  const historySelectedZoneId = useLocalStorage('rmlive:zone-selection', null);
  const selectedQualityRes = ref<string | null>(null);
  const hasManualZoneSelection = ref(false);

  const streamLoading = ref(true);
  const streamErrorMessage = ref('');

  let pollingController: RmPollingController | null = null;
  let bootstrapSeq = 0;

  // --- computed ---
  const liveZones = computed(() => extractLiveZones(liveGameInfo.value));
  const selectedZone = computed(() => {
    if (!liveZones.value.length) {
      return null;
    }

    const targetId = normalizeZoneId(selectedZoneId.value);
    return liveZones.value.find((zone) => normalizeZoneId(zone.zoneId) === targetId) ?? liveZones.value[0];
  });
  const selectedZoneName = computed(() => selectedZone.value?.zoneName ?? null);

  /** Prefer `selectedZoneId`; if empty, mirrors `selectedZone` fallback for rare edge reads. */
  const effectiveSelectedZoneId = computed(() => {
    const fromRef = normalizeZoneId(selectedZoneId.value);
    if (fromRef) {
      return fromRef;
    }
    return normalizeZoneId(selectedZone.value?.zoneId) || null;
  });

  const inferredLiveZoneIdSet = computed(() => {
    const payload = currentAndNextMatches.value;
    if (!payload) {
      return new Set<string>();
    }

    const buckets = Array.isArray(payload)
      ? payload
      : (((payload as Record<string, unknown>).data ??
          (payload as Record<string, unknown>).list ??
          (payload as Record<string, unknown>).records ??
          []) as unknown[]);

    const liveStatuses = new Set(['STARTED', 'RUNNING', 'IN_PROGRESS', 'ONGOING', 'PLAYING']);
    const ids = new Set<string>();

    for (const rawItem of buckets) {
      if (!rawItem || typeof rawItem !== 'object') {
        continue;
      }

      const item = rawItem as Record<string, unknown>;
      const currentMatch = item.currentMatch as Record<string, unknown> | undefined;
      const status = String(currentMatch?.status ?? '')
        .trim()
        .toUpperCase();

      if (!liveStatuses.has(status)) {
        continue;
      }

      const zone =
        (currentMatch?.zone as Record<string, unknown> | undefined) ??
        (item.zone as Record<string, unknown> | undefined) ??
        undefined;
      const id = normalizeZoneId(zone?.id ?? zone?.zoneId ?? item.zoneId);
      if (id) {
        ids.add(id);
      }
    }

    return ids;
  });

  function pickAutoZoneIdByPriority(options: ZoneOptionItem[], historyZoneId: string | null): string | null {
    if (!options.length) {
      return null;
    }

    const historyNorm = normalizeZoneId(historyZoneId);
    const norm = (value: string) => normalizeZoneId(value);

    const historyAndLive =
      historyNorm !== ''
        ? options.find((item) => norm(item.value) === historyNorm && item.state === 'live')
        : null;
    if (historyAndLive) {
      return historyAndLive.value;
    }

    const living = options.find((item) => item.state === 'live');
    if (living) {
      return living.value;
    }

    const inPeriodButOffline = options.find((item) => item.state === 'offline');
    if (inPeriodButOffline) {
      return inPeriodButOffline.value;
    }

    return options[0]?.value ?? null;
  }

  const zoneOptions = computed<ZoneOptionItem[]>(() => {
    const nowEpoch = getNowEpochSeconds();

    return liveZones.value.map((item) => toZoneOptionItem(item, nowEpoch));
  });

  const streamUrl = computed(() =>
    resolveLiveStreamUrl(liveGameInfo.value, selectedZoneId.value, selectedQualityRes.value),
  );
  const selectedZoneUiState = computed<ZoneUiState | null>(() => {
    const zone = selectedZone.value;
    if (!zone) {
      return null;
    }
    return resolveZoneUiState(zone, getNowEpochSeconds());
  });
  const hasStreamRequestError = computed(() => streamErrorMessage.value.trim().length > 0);
  const canPlaySelectedZone = computed(() => {
    const zone = selectedZone.value;
    if (!zone || zone.qualities.length === 0) {
      return false;
    }
    return selectedZoneUiState.value === 'live' && !hasStreamRequestError.value;
  });
  const effectiveStreamUrl = computed(() => (canPlaySelectedZone.value ? streamUrl.value : null));
  const effectiveStreamErrorMessage = computed(() =>
    resolveEffectiveStreamErrorMessage(
      canPlaySelectedZone.value,
      selectedZone.value,
      selectedZoneUiState.value,
      streamErrorMessage.value,
    ),
  );

  const groupSections = computed(() =>
    extractGroupSections(groupsOrder.value, selectedZoneId.value, selectedZoneName.value),
  );
  const teamGroupMap = computed(() => buildTeamGroupMap(groupSections.value));

  const scheduleEventTitle = computed(() => getScheduleEventTitle(schedule.value));
  const playerQualityOptions = computed(() => toPlayerQualityOptions(selectedZone.value));
  const selectedZoneChatRoomId = computed(() =>
    resolveZoneChatRoomId(liveGameInfo.value, selectedZoneId.value, selectedZoneName.value),
  );
  const scheduleMatchRows = computed(() => getScheduleRows(schedule.value, liveGameInfo.value));
  const runningMatchForSelectedZone = computed((): MatchView | null =>
    getRunningMatch(scheduleMatchRows.value, selectedZoneId.value),
  );

  // --- zone / quality selection ---
  function ensureQualitySelection() {
    selectedQualityRes.value = resolveDefaultQualityRes(selectedZone.value, selectedQualityRes.value);
  }

  function commitSelectedZoneId(nextId: string | null, mode: 'manual' | 'auto') {
    const normalized = nextId != null && nextId !== '' ? normalizeZoneId(nextId) : null;
    const stored = normalized || null;

    if (mode === 'manual') {
      hasManualZoneSelection.value = true;
      historySelectedZoneId.value = stored;
    }

    selectedZoneId.value = stored;
    ensureQualitySelection();
  }

  function ensureZoneSelection() {
    const options = zoneOptions.value;
    if (!options.length) {
      selectedZoneId.value = null;
      selectedQualityRes.value = null;
      return;
    }

    const preferred = pickAutoZoneIdByPriority(options, historySelectedZoneId.value);
    const preferredNorm = normalizeZoneId(preferred);

    const currentNorm = normalizeZoneId(selectedZoneId.value);
    const currentExists = currentNorm !== '' && options.some((item) => normalizeZoneId(item.value) === currentNorm);

    if (!hasManualZoneSelection.value) {
      if (preferredNorm && preferredNorm !== currentNorm) {
        commitSelectedZoneId(preferred, 'auto');
      } else if (!currentExists && preferredNorm) {
        commitSelectedZoneId(preferred, 'auto');
      }
      return;
    }

    if (!currentExists && preferredNorm) {
      selectedZoneId.value = preferredNorm;
      ensureQualitySelection();
    }
  }

  function syncZoneAndQuality() {
    ensureZoneSelection();
    ensureQualitySelection();
  }

  function selectZone(value: string | null) {
    if (value != null) {
      const target = zoneOptions.value.find((item) => item.value === value);
      if (target?.disabled) {
        return;
      }
    }

    commitSelectedZoneId(value, 'manual');
  }

  watch(liveZones, syncZoneAndQuality, { immediate: true });

  function stopPolling() {
    bootstrapSeq += 1;
    pollingController?.stopAll();
    pollingController = null;
  }

  function startPolling() {
    stopPolling();
    hasManualZoneSelection.value = false;
    streamLoading.value = true;
    streamErrorMessage.value = '';

    const seq = ++bootstrapSeq;

    void (async () => {
      const startTime = Date.now();
      const minRemainingTimeoutMs = 1000;

      function withBootstrapTimeout<T>(promise: Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
          const elapsedTime = Date.now() - startTime;
          const remainingTime = Math.max(minRemainingTimeoutMs, BOOTSTRAP_TOTAL_TIMEOUT_MS - elapsedTime);
          const timeout = Math.min(BOOTSTRAP_PER_REQUEST_TIMEOUT_MS, remainingTime);

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

      const [
        liveGameInfoResult,
        currentAndNextResult,
        groupsOrderResult,
        scheduleResult,
        robotResult,
        groupRankResult,
      ] = await Promise.allSettled([
        withBootstrapTimeout(fetchLiveGameInfo()),
        withBootstrapTimeout(fetchCurrentAndNextMatches()),
        withBootstrapTimeout(fetchGroupsOrder()),
        withBootstrapTimeout(fetchSchedule()),
        withBootstrapTimeout(fetchRobotData()),
        withBootstrapTimeout(fetchGroupRankInfo()),
      ]);

      if (seq !== bootstrapSeq) {
        return;
      }

      const take = <T>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null);

      function applyFulfilled<T>(target: Ref<T | null>, r: PromiseSettledResult<T>) {
        const v = take(r);
        if (v != null) {
          target.value = v;
        }
      }

      applyFulfilled(liveGameInfo, liveGameInfoResult);
      applyFulfilled(currentAndNextMatches, currentAndNextResult);
      applyFulfilled(groupsOrder, groupsOrderResult);
      applyFulfilled(schedule, scheduleResult);
      applyFulfilled(robotData, robotResult);
      applyFulfilled(groupRankInfo, groupRankResult);

      const settledMatrix: Array<[string, PromiseSettledResult<unknown>]> = [
        ['liveGameInfo', liveGameInfoResult],
        ['currentAndNextMatches', currentAndNextResult],
        ['groupsOrder', groupsOrderResult],
        ['schedule', scheduleResult],
        ['robotData', robotResult],
        ['groupRankInfo', groupRankResult],
      ];
      const rejectedSources = settledMatrix.filter(([, r]) => r.status === 'rejected').map(([name]) => name);

      if (rejectedSources.length > 0) {
        logWarn('bootstrap', 'bootstrap completed with rejected requests', {
          rejectedSources,
        });
      }

      const bootstrapStreamErrorMessage =
        liveGameInfoResult.status === 'rejected' ? '直播流请求失败，请检查网络后重试' : null;
      if (bootstrapStreamErrorMessage) {
        logWarn('stream', 'live_game_info bootstrap request failed', {
          error: toErrorSummary(liveGameInfoResult.status === 'rejected' ? liveGameInfoResult.reason : 'unknown'),
        });
        streamErrorMessage.value = bootstrapStreamErrorMessage;
      }

      streamLoading.value = false;

      pollingController = startRmPolling(
        {
          onLiveGameInfo(data) {
            liveGameInfo.value = data;
            streamErrorMessage.value = '';
          },
          onCurrentAndNextMatches(data) {
            currentAndNextMatches.value = data;
            ensureZoneSelection();
          },
          onGroupsOrder(data) {
            groupsOrder.value = data;
          },
          onRobotData(data) {
            robotData.value = data;
          },
          onSchedule(data) {
            schedule.value = data;
            ensureZoneSelection();
          },
          onError() {
            if (selectedZoneUiState.value === 'live') {
              logWarn('stream', 'polling reported error with no active stream url', {
                selectedZoneId: selectedZoneId.value,
              });
              streamErrorMessage.value = '直播流暂时不可用，请稍后重试';
            }
          },
        },
        {},
        {
          robotDataDelayMs: 5000,
        },
      );
    })();
  }

  async function retryLiveStream() {
    streamErrorMessage.value = '';
    streamLoading.value = true;

    try {
      liveGameInfo.value = await fetchLiveGameInfo();
    } catch (error) {
      logWarn('stream', 'retry live stream failed', {
        error: toErrorSummary(error),
      });
      streamErrorMessage.value = '直播流请求失败，请检查网络后重试';
    } finally {
      streamLoading.value = false;
    }
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
    streamLoading,
    selectedZone,
    selectedZoneName,
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
    startPolling,
    stopPolling,
    retryLiveStream,
  };
});
