import type { GroupsOrder } from '../types/api';

export interface TeamGroupRow {
  group: string;
  rank: string;
  teamName: string;
  collegeName: string;
}

export interface GroupSection {
  group: string;
  teams: TeamGroupRow[];
}

export interface TeamGroupMeta {
  group: string;
  rank: string;
}

function getZones(payload: GroupsOrder | null): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const root = payload as Record<string, unknown>;
  const graphZones = ((root.data as Record<string, unknown> | undefined)?.event as Record<string, unknown> | undefined)
    ?.zones as Record<string, unknown> | undefined;

  if (Array.isArray(graphZones?.nodes)) {
    return graphZones.nodes as Record<string, unknown>[];
  }

  if (Array.isArray(root.zones)) {
    return root.zones as Record<string, unknown>[];
  }

  return [];
}

function pickZone(
  zones: Record<string, unknown>[],
  selectedZoneId: string | null,
  selectedZoneName: string | null,
): Record<string, unknown> | null {
  if (!zones.length) {
    return null;
  }

  const id = String(selectedZoneId ?? '').trim();
  const name = String(selectedZoneName ?? '').trim();

  const byId = zones.find((zone) => String(zone.id ?? zone.zoneId ?? '').trim() === id);
  if (byId) {
    return byId;
  }

  const byName = zones.find((zone) => {
    const zoneName = String(zone.name ?? zone.zoneName ?? '').trim();
    if (!zoneName || !name) {
      return false;
    }
    return zoneName === name || zoneName.includes(name) || name.includes(zoneName);
  });

  return byName ?? null;
}

export function extractGroupSections(
  payload: GroupsOrder | null,
  selectedZoneId: string | null,
  selectedZoneName: string | null,
): GroupSection[] {
  const zones = getZones(payload);
  const targetZone = pickZone(zones, selectedZoneId, selectedZoneName);

  if (!targetZone) {
    return [];
  }

  const groups = ((targetZone.groups as Record<string, unknown> | undefined)?.nodes ?? []) as Record<string, unknown>[];

  const sections: GroupSection[] = groups.map((group) => {
    const groupName = String(group.name ?? '-');
    const players = ((group.players as Record<string, unknown> | undefined)?.nodes ?? []) as Record<string, unknown>[];

    const teams = players
      .map((player) => {
        const team = player.team as Record<string, unknown> | undefined;
        return {
          group: groupName,
          rank: String(player.rank ?? '-'),
          teamName: String(team?.name ?? '-'),
          collegeName: String(team?.collegeName ?? '-'),
        };
      })
      .sort((a, b) => Number(a.rank) - Number(b.rank));

    return {
      group: groupName,
      teams,
    };
  });

  return sections.sort((a, b) => a.group.localeCompare(b.group));
}

export function buildTeamGroupMap(sections: GroupSection[]): Record<string, TeamGroupMeta> {
  const result: Record<string, TeamGroupMeta> = {};
  for (const section of sections) {
    for (const team of section.teams) {
      if (!team.teamName || team.teamName === '-') {
        continue;
      }
      result[team.teamName] = {
        group: section.group,
        rank: team.rank,
      };
    }
  }
  return result;
}
