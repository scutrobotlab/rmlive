import type { Schedule } from '../types/api';

export interface ScheduleRowItem {
  id: string;
  date: string;
  time: string;
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

export function getScheduleRows(data: Schedule | null, selectedZoneId: string | null): ScheduleRowItem[] {
  const zones = getZones(data);
  if (!zones.length) {
    return [];
  }

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

      return {
        id: String(match.id ?? '-'),
        date: dateObj ? dateObj.toLocaleDateString('zh-CN') : '-',
        time: dateObj ? dateObj.toLocaleTimeString('zh-CN', { hour12: false }) : '-',
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
      };
    })
    .filter((item): item is ScheduleRowItem => item !== null);
}
