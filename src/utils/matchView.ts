import type { CurrentAndNextMatches, LiveGameInfo, LiveZone, ReplayVideoEntry, Schedule } from '../types/api';
import { formatFriendlyDateTime } from './timeFormat';

export interface ReplayVideoInfo {
  title: string;
  url: string;
  coverUrl: string;
}

export interface TeamView {
  teamName: string;
  collegeName: string;
  logo: string;
}

/** Unified match row: current/next API and schedule API share core fields; list-only fields optional. */
export interface MatchView {
  blueTeam: TeamView;
  redTeam: TeamView;
  score: string;
  /** Schedule rows: Chinese label from `toStatusLabel`. Current/next snapshot: raw API status. */
  status: string;
  stage: string;
  slug: string;
  orderNumber: string;
  startAt: string;

  id?: string;
  date?: string;
  time?: string;
  dateTimeLabel?: string;
  startedAtTs?: number;
  statusRaw?: string;
  replayVideo?: ReplayVideoInfo | null;
  planGameCount?: number;
  zoneId?: string;
  zoneName?: string;
  eventTitle?: string;
}

export interface ScheduleSchoolOption {
  label: string;
  value: string;
}

function toStringValue(value: unknown, fallback = '-') {
  const str = String(value ?? '').trim();
  return str.length ? str : fallback;
}

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

export function toBuckets(payload: CurrentAndNextMatches | null): Record<string, unknown>[] {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload as Record<string, unknown>[];
  }

  const record = payload as Record<string, unknown>;
  const candidates = [record.data, record.list, record.records];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as Record<string, unknown>[];
    }
  }

  return [record];
}

export function resolvePayloadByZone(
  payload: CurrentAndNextMatches | null,
  selectedZoneId: string | null,
  selectedZoneName: string | null,
): Record<string, unknown> | null {
  const buckets = toBuckets(payload);
  if (!buckets.length) {
    return null;
  }

  const normalizedId = normalizeZoneId(selectedZoneId);
  const normalizedName = String(selectedZoneName ?? '').trim();

  function extractZone(item: Record<string, unknown>): Record<string, unknown> | undefined {
    const topLevel = item.zone as Record<string, unknown> | undefined;
    if (topLevel) {
      return topLevel;
    }

    const currentMatch = item.currentMatch as Record<string, unknown> | undefined;
    const nextMatch = item.nextMatch as Record<string, unknown> | undefined;

    return (
      (currentMatch?.zone as Record<string, unknown> | undefined) ??
      (nextMatch?.zone as Record<string, unknown> | undefined)
    );
  }

  const matchedById = buckets.find((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const record = item as Record<string, unknown>;
    const zone = extractZone(record);
    const zoneIdCandidates = [zone?.id, zone?.zoneId, (item as Record<string, unknown>).zoneId];
    return zoneIdCandidates.some((candidate) => normalizeZoneId(candidate) === normalizedId);
  });

  if (matchedById) {
    return matchedById;
  }

  const matchedByName = buckets.find((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const record = item as Record<string, unknown>;
    const zone = extractZone(record);
    const zoneNameCandidates = [zone?.name, zone?.zoneName, (item as Record<string, unknown>).zoneName];
    return zoneNameCandidates.some((candidate) => {
      const value = String(candidate ?? '').trim();
      return value.length > 0 && (value === normalizedName || normalizedName.includes(value));
    });
  });

  if (matchedByName) {
    return matchedByName;
  }

  if (normalizedId || normalizedName) {
    const firstWithMatch = buckets.find((item) => {
      const current = item.currentMatch as Record<string, unknown> | undefined;
      const next = item.nextMatch as Record<string, unknown> | undefined;
      return Boolean(current || next);
    });
    return firstWithMatch ?? buckets[0];
  }

  return buckets[0];
}

/** Normalize a single match object from current/next (or embedded) API shape. */
export function toMatchView(data: unknown): MatchView | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const asRecord = data as Record<string, unknown>;
  const blueSide = asRecord.blueSide as Record<string, unknown> | undefined;
  const redSide = asRecord.redSide as Record<string, unknown> | undefined;
  const bluePlayer = blueSide?.player as Record<string, unknown> | undefined;
  const redPlayer = redSide?.player as Record<string, unknown> | undefined;
  const blueTeam = bluePlayer?.team as Record<string, unknown> | undefined;
  const redTeam = redPlayer?.team as Record<string, unknown> | undefined;

  const blueSideWinGameCount = Number(asRecord.blueSideWinGameCount ?? 0);
  const redSideWinGameCount = Number(asRecord.redSideWinGameCount ?? 0);

  return {
    blueTeam: {
      teamName: toStringValue(blueTeam?.name),
      collegeName: toStringValue(blueTeam?.collegeName),
      logo: toStringValue(blueTeam?.collegeLogo, ''),
    },
    redTeam: {
      teamName: toStringValue(redTeam?.name),
      collegeName: toStringValue(redTeam?.collegeName),
      logo: toStringValue(redTeam?.collegeLogo, ''),
    },
    score: `${redSideWinGameCount} : ${blueSideWinGameCount}`,
    status: toStringValue(asRecord.status),
    stage: toStringValue(asRecord.matchType),
    slug: toStringValue(asRecord.slug),
    orderNumber: toStringValue(asRecord.orderNumber),
    startAt: formatFriendlyDateTime(asRecord.planStartedAt),
  };
}

export function getCurrentFocusTeams(
  payload: CurrentAndNextMatches | null,
  selectedZoneId: string | null,
  selectedZoneName: string | null,
): string[] {
  const zonePayload = resolvePayloadByZone(payload, selectedZoneId, selectedZoneName);
  const current = toMatchView(zonePayload?.currentMatch);
  if (!current) {
    return [];
  }

  return [current.redTeam.teamName, current.blueTeam.teamName].filter((team) => team && team !== '-');
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

function normalizeSchoolName(value: string): string {
  const name = String(value ?? '').trim();
  if (!name || name === '-') {
    return '';
  }
  return name;
}

function toSortedUniqueValues(values: Set<string>): string[] {
  return Array.from(values).sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function collectUniqueNames(rows: MatchView[], resolvers: Array<(item: MatchView) => string>): Set<string> {
  const values = new Set<string>();

  for (const item of rows) {
    for (const resolveName of resolvers) {
      const value = resolveName(item);
      if (value) {
        values.add(value);
      }
    }
  }

  return values;
}

export function getScheduleSchoolOptions(rows: MatchView[]): ScheduleSchoolOption[] {
  return toSortedUniqueValues(
    collectUniqueNames(rows, [
      (item) => normalizeSchoolName(item.redTeam.collegeName),
      (item) => normalizeSchoolName(item.blueTeam.collegeName),
    ]),
  ).map((name) => ({ label: name, value: name }));
}

export function filterScheduleRowsBySchool(rows: MatchView[], schoolName: string | null): MatchView[] {
  const target = normalizeSchoolName(schoolName ?? '');
  if (!target) {
    return rows;
  }

  return rows.filter((item) => {
    const redSchool = normalizeSchoolName(item.redTeam.collegeName);
    const blueSchool = normalizeSchoolName(item.blueTeam.collegeName);

    return redSchool === target || blueSchool === target;
  });
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

function buildReplayMap(data: LiveGameInfo | null): Map<string, ReplayVideoInfo> {
  const zones = getLiveZones(data);
  if (!zones.length) {
    return new Map();
  }

  return zones.reduce((map, zone) => {
    const videos = Array.isArray(zone?.videos) ? zone.videos : [];
    videos.forEach((video) => {
      const info = toVideoInfo(video);
      if (!info) {
        return;
      }

      if (!map.has(info.matchId)) {
        map.set(info.matchId, info.replay);
      }
    });
    return map;
  }, new Map<string, ReplayVideoInfo>());
}

export function getScheduleRows(data: Schedule | null, liveGameInfo?: LiveGameInfo | null): MatchView[] {
  const zones = getZones(data);
  if (!zones.length) {
    return [];
  }

  const replayMap = buildReplayMap(liveGameInfo ?? null);
  const eventTitle = getScheduleEventTitle(data);

  const allItems: MatchView[] = [];

  zones.forEach((zone) => {
    if (!zone || typeof zone !== 'object') {
      return;
    }

    const zoneObj = zone as Record<string, unknown>;
    const zoneId = String(zoneObj.id ?? zoneObj.zoneId ?? '').trim();
    const zoneName = String(zoneObj.zoneName ?? zoneObj.name ?? zoneObj.title ?? '').trim();

    const groupMatches = ((zoneObj.groupMatches as Record<string, unknown> | undefined)?.nodes ?? []) as unknown[];
    const knockoutMatches = ((zoneObj.knockoutMatches as Record<string, unknown> | undefined)?.nodes ??
      []) as unknown[];
    const allMatches = [...groupMatches, ...knockoutMatches];

    allMatches.forEach((item) => {
      if (!item || typeof item !== 'object') {
        return;
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

      const blueTeamRawName = String(blueTeam?.name ?? '').trim();
      const redTeamRawName = String(redTeam?.name ?? '').trim();

      if (!redTeamRawName && !blueTeamRawName) {
        return;
      }

      const blueTeamName = String(blueTeamRawName || match.winnerPlaceholdName || '-');
      const redTeamName = String(redTeamRawName || match.loserPlaceholdName || '-');

      const blueSideWinGameCount = Number(match.blueSideWinGameCount ?? 0);
      const redSideWinGameCount = Number(match.redSideWinGameCount ?? 0);
      const status = String(match.status ?? '-');
      const matchId = String(match.id ?? '-');
      const planGameCount = Number(match.planGameCount ?? 0);

      const rowItem: MatchView = {
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
        score: `${redSideWinGameCount} : ${blueSideWinGameCount}`,
        statusRaw: status,
        status: toStatusLabel(status),
        replayVideo: replayMap.get(matchId) ?? null,
        planGameCount,
        zoneId: zoneId || '-',
        zoneName: zoneName || '未分配站点',
        eventTitle,
        startAt: formatFriendlyDateTime(planStartedAt),
      };

      allItems.push(rowItem);
    });
  });

  return allItems;
}

function normalizeTeamName(value: string): string {
  const name = String(value ?? '').trim();
  if (!name || name === '-') {
    return '';
  }
  return name;
}

export interface ScheduleZoneOption {
  label: string;
  value: string;
}

export interface ScheduleTeamOption {
  label: string;
  value: string;
}

export interface ScheduleDateGroup {
  date: string;
  dateLabel: string;
  items: MatchView[];
}

function toDateGroupKey(item: MatchView): string {
  if (item.startedAtTs && item.startedAtTs > 0) {
    const d = new Date(item.startedAtTs);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }

  const normalized = String(item.date ?? '')
    .replace(/\//g, '-')
    .trim();
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const [, y, m, d] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return 'unknown';
}

export function filterScheduleRowsByTeam(rows: MatchView[], teamName: string | null): MatchView[] {
  const target = normalizeTeamName(teamName ?? '');
  if (!target) {
    return rows;
  }

  return rows.filter((item) => {
    const redTeam = normalizeTeamName(item.redTeam.teamName);
    const blueTeam = normalizeTeamName(item.blueTeam.teamName);

    return redTeam === target || blueTeam === target;
  });
}

export function filterScheduleRowsByZone(rows: MatchView[], zoneId: string | null): MatchView[] {
  const target = String(zoneId ?? '').trim();
  if (!target) {
    return rows;
  }

  return rows.filter((item) => String(item.zoneId ?? '') === target);
}

export function getZoneNameOptions(rows: MatchView[]): ScheduleZoneOption[] {
  const zoneMap = new Map<string, ScheduleZoneOption>();
  rows.forEach((item) => {
    const zoneName = String(item.zoneName ?? '').trim();
    const zid = String(item.zoneId ?? '').trim();
    if (zoneName && zoneName !== '-') {
      const key = zid || zoneName;
      if (!zoneMap.has(key)) {
        zoneMap.set(key, {
          label: zoneName,
          value: key,
        });
      }
    }
  });

  return Array.from(zoneMap.values()).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}

export function getTeamNameOptions(rows: MatchView[]): ScheduleTeamOption[] {
  return toSortedUniqueValues(
    collectUniqueNames(rows, [
      (item) => normalizeTeamName(item.redTeam.teamName),
      (item) => normalizeTeamName(item.blueTeam.teamName),
    ]),
  ).map((name) => ({ label: name, value: name }));
}

export function getSchoolTeamOptions(rows: MatchView[]): ScheduleTeamOption[] {
  const teamSchoolMap = new Map<string, string>();

  for (const item of rows) {
    const pairs = [
      {
        teamName: normalizeTeamName(item.redTeam.teamName),
        schoolName: normalizeSchoolName(item.redTeam.collegeName),
      },
      {
        teamName: normalizeTeamName(item.blueTeam.teamName),
        schoolName: normalizeSchoolName(item.blueTeam.collegeName),
      },
    ];

    for (const pair of pairs) {
      if (!pair.teamName) {
        continue;
      }

      const existingSchool = teamSchoolMap.get(pair.teamName) ?? '';
      if (!existingSchool || pair.schoolName) {
        teamSchoolMap.set(pair.teamName, pair.schoolName);
      }
    }
  }

  return Array.from(teamSchoolMap.entries())
    .map(([teamName, schoolName]) => ({
      label: schoolName ? `${schoolName} - ${teamName}` : teamName,
      value: teamName,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}

export function getRecentMatches(rows: MatchView[], zoneId: string | null, limit = 5): MatchView[] {
  const zoneRows = filterScheduleRowsByZone(rows, zoneId);

  const completed: MatchView[] = [];
  const upcoming: MatchView[] = [];

  for (const item of zoneRows) {
    const raw = item.statusRaw ?? '';
    if (isResultStatus(raw)) {
      completed.push(item);
    } else {
      upcoming.push(item);
    }
  }

  completed.sort((a, b) => (b.startedAtTs ?? 0) - (a.startedAtTs ?? 0));
  upcoming.sort((a, b) => (a.startedAtTs ?? 0) - (b.startedAtTs ?? 0));

  const completedCount = Math.min(2, completed.length);
  const upcomingCount = Math.min(limit - completedCount, upcoming.length);

  return [...completed.slice(0, completedCount), ...upcoming.slice(0, upcomingCount)];
}

export function getRunningMatch(rows: MatchView[], zoneId: string | null): MatchView | null {
  const zoneRows = filterScheduleRowsByZone(rows, zoneId);

  for (const item of zoneRows) {
    const raw = String(item.statusRaw ?? '').toUpperCase();
    if (raw === 'STARTED') {
      return item;
    }
  }

  return null;
}

function toDateKeyTimestamp(dateKey: string): number {
  if (dateKey === 'unknown') {
    return Number.POSITIVE_INFINITY;
  }

  const ts = new Date(dateKey).getTime();
  return Number.isNaN(ts) ? Number.POSITIVE_INFINITY : ts;
}

export function groupScheduleRowsByDate(rows: MatchView[], order: 'asc' | 'desc' = 'asc'): ScheduleDateGroup[] {
  const groups = new Map<string, MatchView[]>();

  rows.forEach((item) => {
    const dateKey = toDateGroupKey(item);
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(item);
  });

  return Array.from(groups.entries())
    .sort((a, b) => {
      const diff = toDateKeyTimestamp(a[0]) - toDateKeyTimestamp(b[0]);
      return order === 'desc' ? -diff : diff;
    })
    .map(([date, items]) => {
      let displayDate = '未定日期';
      if (date !== 'unknown') {
        const [, month, day] = date.split('-');
        displayDate = `${Number(month)}-${day}`;
      }
      return {
        date,
        dateLabel: displayDate,
        items,
      };
    });
}
