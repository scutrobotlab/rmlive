import { useLocalStorage } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { BOOTSTRAP_PER_REQUEST_TIMEOUT_MS, BOOTSTRAP_TOTAL_TIMEOUT_MS } from '../constants/runtime';
import { createBootstrapTimeoutRunner } from '../services/bootstrapTimeout';
import { buildTeamGroupMap, extractGroupSections } from '../services/groupView';
import { logWarn, toErrorSummary } from '../services/observability';
import {
  extractLiveZones,
  fetchLiveGameInfo,
  pickDefaultZoneId,
  resolveLiveStreamUrl,
  startRmPolling,
  type RmPollingController,
} from '../services/rmApi';
import {
  fetchBootstrapData,
  getFulfilledValue,
  getRejectedBootstrapSources,
  resolveBootstrapStreamErrorMessage,
  shouldKeepBootstrapFallback,
} from '../services/rmBootstrap';
import { extractInferredLiveZoneIdSet, extractScheduleZoneIdSet } from '../services/rmPayloadView';
import { resolveDefaultQualityRes, resolveEffectiveStreamErrorMessage } from '../services/rmStreamView';
import { getNowEpochSeconds } from '../services/timeNow';
import { shouldAutoPromoteZone } from '../services/zoneSelection';
import {
  normalizeZoneId,
  resolveZoneUiState,
  toZoneOptionItem,
  type ZoneOptionItem,
  type ZoneUiState,
} from '../services/zoneView';
import type {
  CurrentAndNextMatches,
  GroupRankInfo,
  GroupsOrder,
  LiveGameInfo,
  RobotData,
  Schedule,
} from '../types/api';

export const useRmDataStore = defineStore('rm-data', () => {
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

  const liveZones = computed(() => extractLiveZones(liveGameInfo.value));
  const selectedZone = computed(() => {
    if (!liveZones.value.length) {
      return null;
    }

    const targetId = normalizeZoneId(selectedZoneId.value);
    return liveZones.value.find((zone) => normalizeZoneId(zone.zoneId) === targetId) ?? liveZones.value[0];
  });
  const selectedZoneName = computed(() => selectedZone.value?.zoneName ?? null);

  const inferredLiveZoneIdSet = computed(() => extractInferredLiveZoneIdSet(currentAndNextMatches.value));

  const scheduleZoneIdSet = computed(() => extractScheduleZoneIdSet(schedule.value));

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
  const canPlaySelectedZone = computed(() => {
    const zone = selectedZone.value;
    if (!zone || zone.qualities.length === 0) {
      return false;
    }

    // 只有当 liveState === 1 或在实时推断集合中时才能播放
    return zone.liveState === 1 || inferredLiveZoneIdSet.value.has(normalizeZoneId(zone.zoneId));
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

  function ensureZoneSelection() {
    const options = zoneOptions.value;
    if (!options.length) {
      selectedZoneId.value = null;
      selectedQualityRes.value = null;
      return;
    }

    const enabledOptions = options.filter((item) => !item.disabled);
    const currentSelected = normalizeZoneId(selectedZoneId.value);
    const currentOption = enabledOptions.find((item) => normalizeZoneId(item.value) === currentSelected) ?? null;

    const zones = liveZones.value;
    const preferred = pickDefaultZoneId(zones, historySelectedZoneId.value);
    const liveFromMatches = enabledOptions.find((item) => inferredLiveZoneIdSet.value.has(normalizeZoneId(item.value)));

    if (
      shouldAutoPromoteZone({
        hasManualZoneSelection: hasManualZoneSelection.value,
        currentOptionValue: currentOption?.value,
        liveFromMatchesValue: liveFromMatches?.value ?? null,
        inferredLiveZoneIdSet: inferredLiveZoneIdSet.value,
        liveZones: zones,
      })
    ) {
      selectedZoneId.value = preferred;
      console.log('Auto-promoting zone selection to', preferred);
    }
  }

  function ensureQualitySelection() {
    selectedQualityRes.value = resolveDefaultQualityRes(selectedZone.value, selectedQualityRes.value);
  }

  function setZone(value: string | null) {
    const target = zoneOptions.value.find((item) => item.value === value);
    if (target?.disabled) {
      return;
    }

    hasManualZoneSelection.value = true;
    historySelectedZoneId.value = value;
    selectedZoneId.value = value;
    ensureQualitySelection();
  }

  watch(
    liveZones,
    () => {
      ensureZoneSelection();
      ensureQualitySelection();
    },
    { immediate: true },
  );

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
      const withBootstrapTimeout = createBootstrapTimeoutRunner(startTime, {
        totalTimeoutMs: BOOTSTRAP_TOTAL_TIMEOUT_MS,
        perRequestTimeoutMs: BOOTSTRAP_PER_REQUEST_TIMEOUT_MS,
      });

      const {
        liveGameInfoResult,
        currentAndNextResult,
        groupsOrderResult,
        scheduleResult,
        robotResult,
        groupRankResult,
      } = await fetchBootstrapData(withBootstrapTimeout);

      if (seq !== bootstrapSeq) {
        return;
      }

      const nextLiveGameInfo = getFulfilledValue(liveGameInfoResult);
      const nextCurrentAndNext = getFulfilledValue(currentAndNextResult);
      const nextGroupsOrder = getFulfilledValue(groupsOrderResult);
      const nextSchedule = getFulfilledValue(scheduleResult);
      const nextRobotData = getFulfilledValue(robotResult);
      const nextGroupRankInfo = getFulfilledValue(groupRankResult);
      const rejectedSources = getRejectedBootstrapSources({
        liveGameInfoResult,
        currentAndNextResult,
        groupsOrderResult,
        scheduleResult,
        robotResult,
        groupRankResult,
      });

      if (
        shouldKeepBootstrapFallback({
          liveGameInfoResult,
          currentAndNextResult,
          groupsOrderResult,
          scheduleResult,
          robotResult,
          groupRankResult,
        })
      ) {
        logWarn('bootstrap', 'bootstrap completed with rejected requests', {
          rejectedSources,
        });
      }

      if (nextLiveGameInfo) {
        liveGameInfo.value = nextLiveGameInfo;
      }

      if (nextCurrentAndNext) {
        currentAndNextMatches.value = nextCurrentAndNext;
      }

      if (nextGroupsOrder) {
        groupsOrder.value = nextGroupsOrder;
      }

      if (nextSchedule) {
        schedule.value = nextSchedule;
      }

      if (nextRobotData) {
        robotData.value = nextRobotData;
      }

      if (nextGroupRankInfo) {
        groupRankInfo.value = nextGroupRankInfo;
      }

      ensureZoneSelection();
      ensureQualitySelection();

      const bootstrapStreamErrorMessage = resolveBootstrapStreamErrorMessage({
        liveGameInfoResult,
        currentAndNextResult,
        groupsOrderResult,
        scheduleResult,
        robotResult,
        groupRankResult,
      });
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
            ensureZoneSelection();
            ensureQualitySelection();
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
            if (!streamUrl.value) {
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
      ensureZoneSelection();
      ensureQualitySelection();
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
    selectedQualityRes,
    streamLoading,
    selectedZone,
    selectedZoneName,
    zoneOptions,
    effectiveStreamUrl,
    effectiveStreamErrorMessage,
    groupSections,
    teamGroupMap,
    setZone,
    startPolling,
    stopPolling,
    retryLiveStream,
  };
});
