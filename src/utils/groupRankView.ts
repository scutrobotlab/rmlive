import type { GroupRankInfo } from '../types/api';

export interface GroupRankRow {
  rank: number;
  teamName: string;
  collegeName: string;
  collegeLogo: string;
  winDrawLose: string;
  points: number;
  netVictoryPoint: number;
  totalDamage: number;
  totalRemainHp: number;
}

export interface GroupRankSection {
  groupName: string;
  rows: GroupRankRow[];
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function toStringValue(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text.length ? text : fallback;
}

function normalizeTeamName(value: unknown): string {
  return toStringValue(value).replace(/\s+/g, '').toLowerCase();
}

function normalizeGroupName(value: unknown): string {
  return toStringValue(value).replace(/\s+/g, '').toLowerCase();
}

function toNumberValue(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  const record = toRecord(value);
  if (!record) {
    return [];
  }

  if (Array.isArray(record.nodes)) {
    return record.nodes;
  }

  if (Array.isArray(record.items)) {
    return record.items;
  }

  return [];
}

function findMetric(items: Record<string, unknown>[], matcher: (name: string) => boolean): unknown {
  const found = items.find((item) => matcher(toStringValue(item.itemName)));
  return found?.itemValue;
}

function toRankRow(itemList: unknown, fallbackRank: number): GroupRankRow | null {
  const sourceList = Array.isArray(itemList)
    ? itemList
    : toArray(itemList && typeof itemList === 'object' ? (itemList as Record<string, unknown>).items : null);

  if (!sourceList.length) {
    return null;
  }

  const items = sourceList
    .map((item) => toRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null);

  if (!items.length) {
    return null;
  }

  const rank = toNumberValue(
    findMetric(items, (name) => name.includes('排名')),
    fallbackRank,
  );
  const teamRaw = toRecord(findMetric(items, (name) => name.includes('战队')));

  const teamName = toStringValue(teamRaw?.teamName, '-');
  const collegeName = toStringValue(teamRaw?.collegeName, '-');
  const collegeLogo = toStringValue(teamRaw?.collegeLogo, '');

  const winDrawLose = toStringValue(
    findMetric(items, (name) => (name.includes('胜') && name.includes('负')) || name.includes('/平/')),
    '-',
  );

  return {
    rank,
    teamName,
    collegeName,
    collegeLogo,
    winDrawLose,
    points: toNumberValue(findMetric(items, (name) => name.includes('积分'))),
    netVictoryPoint: toNumberValue(findMetric(items, (name) => name.includes('净胜'))),
    totalDamage: toNumberValue(findMetric(items, (name) => name.includes('总伤害'))),
    totalRemainHp: toNumberValue(findMetric(items, (name) => name.includes('剩余血量'))),
  };
}

function resolveZone(payload: GroupRankInfo | null, selectedZoneId: string | null, selectedZoneName: string | null) {
  const root = toRecord(payload);
  const zones = Array.isArray(root?.zones) ? root?.zones : [];
  if (!zones.length) {
    return null;
  }

  const normalizedZoneId = toStringValue(selectedZoneId);
  const normalizedZoneName = toStringValue(selectedZoneName);

  const zone = zones.find((zoneItem) => {
    const zoneRecord = toRecord(zoneItem);
    if (!zoneRecord) {
      return false;
    }

    const zoneId = toStringValue(zoneRecord.zoneId);
    const zoneName = toStringValue(zoneRecord.zoneName);

    if (normalizedZoneId && zoneId === normalizedZoneId) {
      return true;
    }

    if (normalizedZoneName && zoneName && (zoneName === normalizedZoneName || normalizedZoneName.includes(zoneName))) {
      return true;
    }

    return false;
  }) as Record<string, unknown> | undefined;

  return zone ?? (toRecord(zones[0]) as Record<string, unknown> | null);
}

function toSection(groupRecord: Record<string, unknown>): GroupRankSection {
  const groupName = toStringValue(groupRecord.groupName, '-');
  const rawRows = toArray(groupRecord.groupPlayers ?? groupRecord.players ?? groupRecord.groupRankPlayers);

  const rows = rawRows
    .map((raw, index) => toRankRow(raw, index + 1))
    .filter((item): item is GroupRankRow => item !== null)
    .sort((a, b) => a.rank - b.rank);

  return {
    groupName,
    rows,
  };
}

export function resolveGroupRankSectionByGroup(
  payload: GroupRankInfo | null,
  selectedZoneId: string | null,
  selectedZoneName: string | null,
  groupName: string | null,
): GroupRankSection | null {
  const root = toRecord(payload);
  const zones = toArray(root?.zones);
  if (!zones.length || !groupName) {
    return null;
  }

  const normalizedGroupName = normalizeGroupName(groupName);
  const preferredZone = resolveZone(payload, selectedZoneId, selectedZoneName);

  const searchZones: Record<string, unknown>[] = [];
  if (preferredZone) {
    searchZones.push(preferredZone);
  }

  for (const zoneItem of zones) {
    const zoneRecord = toRecord(zoneItem);
    if (!zoneRecord) {
      continue;
    }

    if (preferredZone && zoneRecord === preferredZone) {
      continue;
    }

    searchZones.push(zoneRecord);
  }

  let fallbackSection: GroupRankSection | null = null;

  for (const zone of searchZones) {
    const groups = toArray(zone.groups);
    for (const groupItem of groups) {
      const groupRecord = toRecord(groupItem);
      if (!groupRecord) {
        continue;
      }

      if (normalizeGroupName(groupRecord.groupName) !== normalizedGroupName) {
        continue;
      }

      const section = toSection(groupRecord);
      if (section.rows.length) {
        return section;
      }

      fallbackSection = fallbackSection ?? section;
    }
  }

  return fallbackSection;
}

export function resolveGroupRankSectionByTeam(
  payload: GroupRankInfo | null,
  selectedZoneId: string | null,
  selectedZoneName: string | null,
  teamName: string | null,
): GroupRankSection | null {
  const root = toRecord(payload);
  const zones = toArray(root?.zones);

  if (!teamName) {
    return null;
  }
  const normalizedTeamName = normalizeTeamName(teamName);

  if (!zones.length) {
    return null;
  }

  const preferredZone = resolveZone(payload, selectedZoneId, selectedZoneName);
  const searchZones: Record<string, unknown>[] = [];

  if (preferredZone) {
    searchZones.push(preferredZone);
  }

  for (const zone of zones) {
    const zoneRecord = toRecord(zone);
    if (!zoneRecord) {
      continue;
    }

    if (preferredZone && zoneRecord === preferredZone) {
      continue;
    }

    searchZones.push(zoneRecord);
  }

  for (const zone of searchZones) {
    const groups = Array.isArray(zone.groups) ? zone.groups : [];

    for (const groupItem of groups) {
      const groupRecord = toRecord(groupItem);
      if (!groupRecord) {
        continue;
      }

      const section = toSection(groupRecord);
      if (section.rows.some((row) => normalizeTeamName(row.teamName) === normalizedTeamName)) {
        return section;
      }
    }
  }

  return null;
}
