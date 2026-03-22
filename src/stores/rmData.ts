import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { buildTeamGroupMap, extractGroupSections } from '../services/groupView';
import {
  extractLiveZones,
  fetchGroupRankInfo,
  fetchLiveGameInfo,
  fetchRobotData,
  pickDefaultZoneId,
  resolveLiveStreamUrl,
  startRmPolling,
  type RmPollingController,
} from '../services/rmApi';
import type {
  CurrentAndNextMatches,
  GroupRankInfo,
  GroupsOrder,
  LiveGameInfo,
  RobotData,
  Schedule,
} from '../types/api';

type ZoneUiState = 'live' | 'offline' | 'upcoming' | 'ended';

interface ZoneOptionItem {
  label: string;
  value: string;
  state: ZoneUiState;
  icon: string;
  liveLogo: boolean;
  title: string;
  dateText: string;
  disabled: boolean;
}

export const useRmDataStore = defineStore('rm-data', () => {
  const liveGameInfo = ref<LiveGameInfo | null>(null);
  const currentAndNextMatches = ref<CurrentAndNextMatches | null>(null);
  const groupsOrder = ref<GroupsOrder | null>(null);
  const groupRankInfo = ref<GroupRankInfo | null>(null);
  const robotData = ref<RobotData | null>(null);
  const schedule = ref<Schedule | null>(null);

  const selectedZoneId = ref<string | null>(null);
  const selectedQualityRes = ref<string | null>(null);

  const streamLoading = ref(true);
  const streamErrorMessage = ref('');

  let pollingController: RmPollingController | null = null;

  const liveZones = computed(() => extractLiveZones(liveGameInfo.value));
  const selectedZone = computed(() => {
    if (!liveZones.value.length) {
      return null;
    }

    return liveZones.value.find((zone) => zone.zoneId === selectedZoneId.value) ?? liveZones.value[0];
  });
  const selectedZoneName = computed(() => selectedZone.value?.zoneName ?? null);

  function normalizeZoneId(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return '';
    }

    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      return String(numeric);
    }

    return raw;
  }

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

  function formatDate(value: number | null): string {
    if (!value) {
      return '-';
    }

    const ms = value > 10_000_000_000 ? value : value * 1000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) {
      return '-';
    }

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function resolveZoneUiState(zone: (typeof liveZones.value)[number], nowEpoch: number): ZoneUiState {
    if (zone.liveState === 1 || inferredLiveZoneIdSet.value.has(normalizeZoneId(zone.zoneId))) {
      return 'live';
    }

    if (zone.startAt && nowEpoch < zone.startAt) {
      return 'upcoming';
    }

    if (zone.endAt && nowEpoch > zone.endAt) {
      return 'ended';
    }

    return 'offline';
  }

  const zoneOptions = computed<ZoneOptionItem[]>(() => {
    const nowEpoch = Math.floor(Date.now() / 1000);

    return liveZones.value.map((item) => {
      const state = resolveZoneUiState(item, nowEpoch);

      if (state === 'live') {
        return {
          label: item.zoneName,
          value: item.zoneId,
          state,
          icon: 'pi pi-video',
          liveLogo: true,
          title: item.zoneName,
          dateText: '',
          disabled: false,
        };
      }

      if (state === 'offline') {
        return {
          label: item.zoneName,
          value: item.zoneId,
          state,
          icon: 'pi pi-video-off',
          liveLogo: false,
          title: item.zoneName,
          dateText: '',
          disabled: false,
        };
      }

      if (state === 'upcoming') {
        return {
          label: item.zoneName,
          value: item.zoneId,
          state,
          icon: 'pi pi-clock',
          liveLogo: false,
          title: item.zoneName,
          dateText: formatDate(item.startAt),
          disabled: true,
        };
      }

      return {
        label: item.zoneName,
        value: item.zoneId,
        state,
        icon: 'pi pi-check-circle',
        liveLogo: false,
        title: item.zoneName,
        dateText: formatDate(item.endAt),
        disabled: true,
      };
    });
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
  const canPlaySelectedZone = computed(() => {
    const zone = selectedZone.value;
    if (!zone || zone.qualities.length === 0) {
      return false;
    }

    return zone.liveState === 1 || inferredLiveZoneIdSet.value.has(normalizeZoneId(zone.zoneId));
  });
  const effectiveStreamUrl = computed(() => (canPlaySelectedZone.value ? streamUrl.value : null));
  const effectiveStreamErrorMessage = computed(() => {
    if (!canPlaySelectedZone.value && selectedZone.value) {
      return `${selectedZone.value.zoneName} 当前未直播，请切换到直播中的站点`;
    }
    return streamErrorMessage.value;
  });

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

    const hasZone = options.some((item) => item.value === selectedZoneId.value && !item.disabled);
    if (!hasZone) {
      const zones = liveZones.value;
      const preferred = pickDefaultZoneId(zones);
      const preferredEnabled = preferred ? options.find((item) => item.value === preferred && !item.disabled) : null;
      const fallbackEnabled = options.find((item) => !item.disabled);
      selectedZoneId.value = preferredEnabled?.value ?? fallbackEnabled?.value ?? options[0].value;
    }
  }

  function ensureQualitySelection() {
    const zone = selectedZone.value;
    if (!zone) {
      selectedQualityRes.value = null;
      return;
    }

    const hasQuality = zone.qualities.some((item) => item.res === selectedQualityRes.value);
    if (!hasQuality) {
      selectedQualityRes.value = zone.qualities[0]?.res ?? null;
    }
  }

  function setZone(value: string | null) {
    const target = zoneOptions.value.find((item) => item.value === value);
    if (target?.disabled) {
      return;
    }

    selectedZoneId.value = value;
    ensureQualitySelection();
  }

  function setQuality(value: string | null) {
    selectedQualityRes.value = value;
  }

  function stopPolling() {
    pollingController?.stopAll();
    pollingController = null;
  }

  function startPolling() {
    stopPolling();

    // 小组详细排名信息不需要轮询，仅在启动时拉取一次。
    void fetchGroupRankInfo()
      .then((data) => {
        groupRankInfo.value = data;
      })
      .catch(() => {
        // 失败时保持兜底展示，不影响主流程。
      });

    // 先做一次即时拉取，避免用户刚打开弹窗时看到空数据。
    void fetchRobotData()
      .then((data) => {
        robotData.value = data;
      })
      .catch(() => {
        // 后续轮询会继续重试，这里不阻断首屏流程。
      });

    pollingController = startRmPolling(
      {
        onLiveGameInfo(data) {
          liveGameInfo.value = data;
          ensureZoneSelection();
          ensureQualitySelection();
          streamLoading.value = false;
          streamErrorMessage.value = '';
        },
        onCurrentAndNextMatches(data) {
          currentAndNextMatches.value = data;
        },
        onGroupsOrder(data) {
          groupsOrder.value = data;
        },
        onRobotData(data) {
          robotData.value = data;
        },
        onSchedule(data) {
          schedule.value = data;
        },
        onError() {
          streamLoading.value = false;
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
