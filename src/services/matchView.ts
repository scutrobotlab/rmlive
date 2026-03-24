import type { CurrentAndNextMatches } from '../types/api';
import { formatFriendlyDateTime } from './timeFormat';

export interface TeamView {
  teamName: string;
  collegeName: string;
  logo: string;
}

export interface MatchView {
  blueTeam: TeamView;
  redTeam: TeamView;
  score: string;
  status: string;
  stage: string;
  slug: string;
  orderNumber: string;
  startAt: string;
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

  // 某些接口返回的分区标识与 live_game_info 不一致；匹配失败时回退到首个有对局数据的分区，避免整块空白。
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
