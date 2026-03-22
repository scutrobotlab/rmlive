import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { createBootstrapTimeoutRunner } from '../services/bootstrapTimeout';
import { buildTeamGroupMap, extractGroupSections } from '../services/groupView';
import {
  extractLiveZones,
  fetchLiveGameInfo,
  pickDefaultZoneId,
  resolveLiveStreamUrl,
  startRmPolling,
  type RmPollingController,
} from '../services/rmApi';
import { fetchBootstrapData, getFulfilledValue } from '../services/rmBootstrap';
import { extractInferredLiveZoneIdSet, extractScheduleZoneIdSet } from '../services/rmPayloadView';
import { resolveDefaultQualityRes, resolveEffectiveStreamErrorMessage } from '../services/rmStreamView';
import { pickBestZoneCandidate, shouldAutoPromoteZone } from '../services/zoneSelection';
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
    const nowEpoch = Math.floor(Date.now() / 1000);

    return liveZones.value.map((item) => toZoneOptionItem(item, nowEpoch));
  });

  const qualityOptions = computed(() => {
    if (!selectedZone.value) {
      return [];
    }

    return selectedZone.value.qualities.map((item) => ({
      label: item.label,
      value: item.res,
    }));
  });

  const streamUrl = computed(() =>
    resolveLiveStreamUrl(liveGameInfo.value, selectedZoneId.value, selectedQualityRes.value),
  );
  const selectedZoneUiState = computed<ZoneUiState | null>(() => {
    const zone = selectedZone.value;
    if (!zone) {
      return null;
    }
    return resolveZoneUiState(zone, Math.floor(Date.now() / 1000));
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
    const preferred = pickDefaultZoneId(zones);
    const liveFromMatches = enabledOptions.find((item) => inferredLiveZoneIdSet.value.has(normalizeZoneId(item.value)));
    const withPlayableStream = enabledOptions.find((item) => {
      const zone = zones.find((z) => normalizeZoneId(z.zoneId) === normalizeZoneId(item.value));
      return Boolean(zone?.qualities?.[0]?.src);
    });

    const bestCandidate = pickBestZoneCandidate({
      options,
      enabledOptions,
      inferredLiveZoneIdSet: inferredLiveZoneIdSet.value,
      scheduleZoneIdSet: scheduleZoneIdSet.value,
      liveZones: zones,
      preferredZoneId: preferred,
    });

    if (!currentOption && bestCandidate) {
      selectedZoneId.value = bestCandidate;
      return;
    }

    if (!currentOption || !bestCandidate) {
      return;
    }

    if (
      shouldAutoPromoteZone({
        hasManualZoneSelection: hasManualZoneSelection.value,
        currentOptionValue: currentOption.value,
        liveFromMatchesValue: liveFromMatches?.value ?? null,
        withPlayableStreamValue: withPlayableStream?.value ?? null,
        inferredLiveZoneIdSet: inferredLiveZoneIdSet.value,
        liveZones: zones,
      })
    ) {
      selectedZoneId.value = bestCandidate;
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
    selectedZoneId.value = value;
    ensureQualitySelection();
  }

  function setQuality(value: string | null) {
    selectedQualityRes.value = value;
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
      const TOTAL_BOOTSTRAP_TIMEOUT_MS = 15000; // 整个bootstrap最多15秒
      const PER_REQUEST_TIMEOUT_MS = 8000; // 每个单独请求最多8秒
      const withBootstrapTimeout = createBootstrapTimeoutRunner(startTime, {
        totalTimeoutMs: TOTAL_BOOTSTRAP_TIMEOUT_MS,
        perRequestTimeoutMs: PER_REQUEST_TIMEOUT_MS,
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

      if (liveGameInfoResult.status === 'rejected') {
        streamErrorMessage.value = '直播流请求失败，请检查网络后重试';
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
    } catch {
      streamErrorMessage.value = '直播流请求失败，请检查网络后重试';
    } finally {
      streamLoading.value = false;
    }
  }

  return {
    liveGameInfo,
    currentAndNextMatches,
    groupsOrder,
    groupRankInfo,
    robotData,
    schedule,
    selectedZoneId,
    selectedQualityRes,
    streamLoading,
    streamErrorMessage,
    liveZones,
    selectedZone,
    selectedZoneName,
    zoneOptions,
    qualityOptions,
    streamUrl,
    effectiveStreamUrl,
    effectiveStreamErrorMessage,
    groupSections,
    teamGroupMap,
    setZone,
    setQuality,
    startPolling,
    stopPolling,
    retryLiveStream,
  };
});
