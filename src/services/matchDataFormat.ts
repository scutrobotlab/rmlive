import type { GroupRankRow, GroupRankSection } from './groupRankView';
import type { GroupSection } from './groupView';

export interface DialogTeamRow {
  rank: number;
  teamName: string;
  collegeName: string;
  isCurrent: boolean;
}

export interface DialogRankRow extends GroupRankRow {
  isCurrent: boolean;
  isFallback: boolean;
}

export interface DialogRankRowDisplay extends DialogRankRow {
  rankDisplay: number;
}

export function findDialogTeamGroupSection(
  groupSections: GroupSection[],
  teamName: string | null,
): GroupSection | null {
  if (!teamName) {
    return null;
  }

  for (const section of groupSections) {
    if (section.teams.some((team) => team.teamName === teamName)) {
      return section;
    }
  }

  return null;
}

export function buildDialogTeamRows(section: GroupSection | null, currentTeamName: string | null): DialogTeamRow[] {
  if (!section) {
    return [];
  }

  return section.teams.map((team, index) => ({
    rank: Number(team.rank) || index + 1,
    teamName: team.teamName,
    collegeName: team.collegeName,
    isCurrent: team.teamName === currentTeamName,
  }));
}

export function buildDialogRankRows(
  rankSection: GroupRankSection | null,
  teamRows: DialogTeamRow[],
  currentTeamName: string | null,
): DialogRankRow[] {
  if (!rankSection) {
    return teamRows.map((item) => ({
      rank: Number(item.rank) || 0,
      teamName: item.teamName,
      collegeName: item.collegeName,
      collegeLogo: '',
      winDrawLose: '-',
      points: 0,
      netVictoryPoint: 0,
      totalDamage: 0,
      totalRemainHp: 0,
      isCurrent: item.isCurrent,
      isFallback: true,
    }));
  }

  return rankSection.rows.map((item) => ({
    ...item,
    isCurrent: item.teamName === currentTeamName,
    isFallback: false,
  }));
}

export function sortDialogRankRows(rows: DialogRankRow[]): DialogRankRowDisplay[] {
  const sorted = [...rows].sort((a, b) => {
    if (a.isFallback && b.isFallback) {
      return a.rank - b.rank;
    }

    if (b.points !== a.points) {
      return b.points - a.points;
    }

    if (b.netVictoryPoint !== a.netVictoryPoint) {
      return b.netVictoryPoint - a.netVictoryPoint;
    }

    return a.rank - b.rank;
  });

  return sorted.map((row, index) => ({
    ...row,
    rankDisplay: row.rank > 0 ? row.rank : index + 1,
  }));
}
