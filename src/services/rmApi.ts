import type {
  CurrentAndNextMatches,
  GroupsOrder,
  LiveGameInfo,
  LiveStreamCandidate,
  LiveZone,
  RobotData,
  Schedule,
} from '../types/api';
import { fetchJson } from './http';
import { startPolling, type PollingTask } from './polling';
import { buildLiveJsonUrl } from './urlProxy';

const API_BASE = 'https://rm-static.djicdn.com/live_json';

export const endpoints = {
  liveGameInfo: `${API_BASE}/live_game_info.json`,
  currentAndNextMatches: `${API_BASE}/current_and_next_matches.json`,
  groupsOrder: `${API_BASE}/groups_order.json`,
  robotData: `${API_BASE}/robot_data.json`,
  schedule: `${API_BASE}/schedule.json`,
};

export async function fetchLiveGameInfo() {
  return fetchJson<LiveGameInfo>(buildLiveJsonUrl(endpoints.liveGameInfo));
}

export async function fetchCurrentAndNextMatches() {
  return fetchJson<CurrentAndNextMatches>(buildLiveJsonUrl(endpoints.currentAndNextMatches));
}

export async function fetchGroupsOrder() {
  return fetchJson<GroupsOrder>(buildLiveJsonUrl(endpoints.groupsOrder));
}

export async function fetchRobotData() {
  return fetchJson<RobotData>(buildLiveJsonUrl(endpoints.robotData));
}

export async function fetchSchedule() {
  return fetchJson<Schedule>(buildLiveJsonUrl(endpoints.schedule));
}

export interface RmPollingHandlers {
  onLiveGameInfo: (data: LiveGameInfo) => void;
  onCurrentAndNextMatches: (data: CurrentAndNextMatches) => void;
  onGroupsOrder: (data: GroupsOrder) => void;
  onRobotData: (data: RobotData) => void;
  onSchedule: (data: Schedule) => void;
  onError?: (error: unknown) => void;
}

export interface RmPollingIntervals {
  liveGameInfoMs?: number;
  currentAndNextMatchesMs?: number;
  groupsOrderMs?: number;
  robotDataMs?: number;
  scheduleMs?: number;
}

export interface RmPollingController {
  stopAll: () => void;
}

export function startRmPolling(handlers: RmPollingHandlers, intervals: RmPollingIntervals = {}): RmPollingController {
  const tasks: PollingTask[] = [];

  const safeRun = async <T>(request: () => Promise<T>, onData: (data: T) => void) => {
    try {
      onData(await request());
    } catch (error) {
      handlers.onError?.(error);
    }
  };

  tasks.push(
    startPolling(() => safeRun(fetchLiveGameInfo, handlers.onLiveGameInfo), intervals.liveGameInfoMs ?? 12000),
  );

  tasks.push(
    startPolling(
      () => safeRun(fetchCurrentAndNextMatches, handlers.onCurrentAndNextMatches),
      intervals.currentAndNextMatchesMs ?? 12000,
    ),
  );

  tasks.push(startPolling(() => safeRun(fetchGroupsOrder, handlers.onGroupsOrder), intervals.groupsOrderMs ?? 30000));

  tasks.push(startPolling(() => safeRun(fetchRobotData, handlers.onRobotData), intervals.robotDataMs ?? 7000));

  tasks.push(startPolling(() => safeRun(fetchSchedule, handlers.onSchedule), intervals.scheduleMs ?? 45000));

  return {
    stopAll() {
      tasks.forEach((task) => task.stop());
    },
  };
}

export interface LiveQualityOption {
  key: string;
  label: string;
  res: string;
  src: string;
}

export interface LiveZoneOption {
  zoneId: string;
  zoneName: string;
  liveState: number;
  qualities: LiveQualityOption[];
}

function toQualityOption(item: LiveStreamCandidate, index: number): LiveQualityOption | null {
  const src = typeof item.src === 'string' ? item.src : '';

  // 仅选择可直接用于网页播放器的 http(s) m3u8 链接
  if (!src || !src.startsWith('http')) {
    return null;
  }

  const label = typeof item.label === 'string' ? item.label : `清晰度 ${index + 1}`;
  const res = typeof item.res === 'string' ? item.res : `q-${index + 1}`;

  return {
    key: `${res}-${index}`,
    label,
    res,
    src,
  };
}

export function extractLiveZones(data: LiveGameInfo | null): LiveZoneOption[] {
  if (!data || !Array.isArray(data.eventData)) {
    return [];
  }

  return data.eventData
    .map((zone: LiveZone, zoneIndex) => {
      const zoneId = String(zone.zoneId ?? zoneIndex);
      const zoneName = typeof zone.zoneName === 'string' ? zone.zoneName : `分区 ${zoneId}`;
      const liveState = typeof zone.liveState === 'number' ? zone.liveState : 0;
      const source = Array.isArray(zone.zoneLiveString) ? zone.zoneLiveString : [];
      const qualities = source
        .map((item, qualityIndex) => toQualityOption(item, qualityIndex))
        .filter((item): item is LiveQualityOption => item !== null);

      return {
        zoneId,
        zoneName,
        liveState,
        qualities,
      };
    })
    .filter((zone) => zone.qualities.length > 0);
}

export function pickDefaultZoneId(zones: LiveZoneOption[]): string | null {
  if (!zones.length) {
    return null;
  }

  const active = zones.find((zone) => zone.liveState === 1);
  return active?.zoneId ?? zones[0].zoneId;
}

export function resolveLiveStreamUrl(
  data: LiveGameInfo | null,
  zoneId: string | null,
  qualityRes: string | null,
): string | null {
  const zones = extractLiveZones(data);
  if (!zones.length) {
    const candidates = [data?.live_url, data?.hls_url, data?.stream_url];
    const firstValid = candidates.find((item) => typeof item === 'string' && item.startsWith('http'));
    return firstValid ?? null;
  }

  const selectedZone = zones.find((item) => item.zoneId === zoneId) ?? zones[0];
  const selectedQuality = selectedZone.qualities.find((item) => item.res === qualityRes);

  return selectedQuality?.src ?? selectedZone.qualities[0]?.src ?? null;
}
