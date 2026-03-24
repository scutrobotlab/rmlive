import type { LiveGameInfo, LiveZone, ReplayVideoEntry, Schedule } from '../types/api';
import { formatFriendlyDateTime } from './timeFormat';

export interface ReplayVideoInfo {
  title: string;
  url: string;
  coverUrl: string;
}

export interface ScheduleRowItem {
  id: string;
  slug: string;
  orderNumber: string;
  date: string;
  time: string;
  dateTimeLabel: string;
  startedAtTs: number;
  stage: string;
  redTeam: {
    teamName: string;
    collegeName: string;
    logo: string;
  };
  blueTeam: {
    teamName: string;
    collegeName: string;
    logo: string;
  };
  score: string;
  gameScore: string;
  statusRaw: string;
  status: string;
  replayVideo: ReplayVideoInfo | null;
}

export function toStatusLabel(status: string): string {
  const value = status.toUpperCase();
  if (value === 'DONE' || value === 'FINISHED' || value === 'ENDED') {
    return '已结束';
  }
  if (value === 'STARTED' || value === 'PLAYING') {
    return '进行中';
  }
  return '未开始';
}

export function toStatusSeverity(status: string): 'contrast' | 'warn' | 'success' {
  const value = status.toUpperCase();
  if (value === 'STARTED' || value === 'PLAYING') {
    return 'warn';
  }
  if (value === 'DONE' || value === 'FINISHED' || value === 'ENDED') {
    return 'success';
  }
  return 'contrast';
}

export function isResultStatus(status: string): boolean {
  const value = status.toUpperCase();
  return value === 'DONE' || value === 'FINISHED' || value === 'ENDED';
}

function getZones(data: Schedule | null): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') {
    return [];
  }

  const root = data as Record<string, unknown>;
  const fromGraph = (
    ((root.data as Record<string, unknown> | undefined)?.event as Record<string, unknown> | undefined)?.zones as
      | Record<string, unknown>
      | undefined
  )?.nodes;

  if (Array.isArray(fromGraph)) {
    return fromGraph as Record<string, unknown>[];
  }

  const currentEvent = (root.current_event ?? root.currentEvent) as Record<string, unknown> | undefined;
  const zones = (currentEvent?.zones as Record<string, unknown> | undefined)?.nodes;

  if (Array.isArray(zones)) {
    return zones as Record<string, unknown>[];
  }

  return [];
}

export function getScheduleEventTitle(data: Schedule | null): string {
  if (!data || typeof data !== 'object') {
    return '';
  }

  const root = data as Record<string, unknown>;
  const graphTitle = String(
    ((root.data as Record<string, unknown> | undefined)?.event as Record<string, unknown> | undefined)?.title ?? '',
  ).trim();
  if (graphTitle) {
    return graphTitle;
  }

  const currentEventTitle = String((root.current_event as Record<string, unknown> | undefined)?.title ?? '').trim();
  if (currentEventTitle) {
    return currentEventTitle;
  }

  return '';
}

function getLiveZones(data: LiveGameInfo | null): LiveZone[] {
  if (!data || !Array.isArray(data.eventData)) {
    return [];
  }

  return data.eventData;
}

function toVideoInfo(entry: ReplayVideoEntry): { matchId: string; replay: ReplayVideoInfo } | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const content = (entry.content ?? {}) as Record<string, unknown>;
  const matchId = String(content.match_id ?? '').trim();
  const url = String(content.main_source_url ?? content.main_remote_url ?? '').trim();
  const title = String(content.title1 ?? '').trim();
  const coverUrl = String(content.main_img_url ?? '').trim();

  if (!matchId || !url) {
    return null;
  }

  return {
    matchId,
    replay: {
      title: title || '比赛回放',
      url,
      coverUrl,
    },
  };
}

function buildReplayMap(data: LiveGameInfo | null, selectedZoneId: string | null): Map<string, ReplayVideoInfo> {
  const zones = getLiveZones(data);
  if (!zones.length) {
    return new Map();
  }

  const zone = zones.find((item) => String(item.zoneId ?? '') === String(selectedZoneId ?? '')) ?? zones[0];
  const videos = Array.isArray(zone?.videos) ? zone.videos : [];

  return videos.reduce((map, video) => {
    const info = toVideoInfo(video);
    if (!info) {
      return map;
    }

    if (!map.has(info.matchId)) {
      map.set(info.matchId, info.replay);
    }
    return map;
  }, new Map<string, ReplayVideoInfo>());
}

export function getScheduleRows(
  data: Schedule | null,
  selectedZoneId: string | null,
  liveGameInfo?: LiveGameInfo | null,
): ScheduleRowItem[] {
  const zones = getZones(data);
  if (!zones.length) {
    return [];
  }

  const replayMap = buildReplayMap(liveGameInfo ?? null, selectedZoneId);

  const zone = zones.find((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    return String((item as Record<string, unknown>).id ?? '') === String(selectedZoneId ?? '');
  }) as Record<string, unknown> | undefined;

  const targetZone = zone ?? (zones[0] as Record<string, unknown>);

  const groupMatches = ((targetZone.groupMatches as Record<string, unknown> | undefined)?.nodes ?? []) as unknown[];
  const knockoutMatches = ((targetZone.knockoutMatches as Record<string, unknown> | undefined)?.nodes ??
    []) as unknown[];
  const allMatches = [...groupMatches, ...knockoutMatches];

  return allMatches
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const match = item as Record<string, unknown>;
      const planStartedAt = String(match.planStartedAt ?? '');
      const dateObj = planStartedAt ? new Date(planStartedAt) : null;

      const bluePlayer = (match.blueSide as Record<string, unknown> | undefined)?.player as
        | Record<string, unknown>
        | undefined;
      const redPlayer = (match.redSide as Record<string, unknown> | undefined)?.player as
        | Record<string, unknown>
        | undefined;
      const blueTeam = bluePlayer?.team as Record<string, unknown> | undefined;
      const redTeam = redPlayer?.team as Record<string, unknown> | undefined;

      const blueTeamName = String(blueTeam?.name ?? match.winnerPlaceholdName ?? '-');
      const redTeamName = String(redTeam?.name ?? match.loserPlaceholdName ?? '-');

      const blueSideScore = Number(match.blueSideScore ?? 0);
      const redSideScore = Number(match.redSideScore ?? 0);
      const blueSideWinGameCount = Number(match.blueSideWinGameCount ?? 0);
      const redSideWinGameCount = Number(match.redSideWinGameCount ?? 0);
      const status = String(match.status ?? '-');
      const matchId = String(match.id ?? '-');

      return {
        id: matchId,
        slug: String(match.slug ?? '-'),
        orderNumber: String(match.orderNumber ?? '-'),
        date: dateObj ? dateObj.toLocaleDateString('zh-CN') : '-',
        time: dateObj ? dateObj.toLocaleTimeString('zh-CN', { hour12: false }) : '-',
        dateTimeLabel: formatFriendlyDateTime(planStartedAt),
        startedAtTs: dateObj ? dateObj.getTime() : 0,
        stage: String(match.matchType ?? '-'),
        redTeam: {
          teamName: redTeamName,
          collegeName: String(redTeam?.collegeName ?? '-'),
          logo: String(redTeam?.collegeLogo ?? ''),
        },
        blueTeam: {
          teamName: blueTeamName,
          collegeName: String(blueTeam?.collegeName ?? '-'),
          logo: String(blueTeam?.collegeLogo ?? ''),
        },
        score: `${redSideScore} : ${blueSideScore}`,
        gameScore: `${redSideWinGameCount} : ${blueSideWinGameCount}`,
        statusRaw: status,
        status: toStatusLabel(status),
        replayVideo: replayMap.get(matchId) ?? null,
      };
    })
    .filter((item): item is ScheduleRowItem => item !== null);
}
