import { describe, expect, it } from 'vitest';
import type { GroupSection } from '../groupView';
import {
  buildDialogRankRows,
  buildDialogTeamRows,
  findDialogTeamGroupSection,
  sortDialogRankRows,
} from '../matchDataFormat';

describe('matchDataFormat', () => {
  it('finds group section by selected team', () => {
    const sections: GroupSection[] = [
      {
        group: 'A',
        teams: [
          { group: 'A', rank: '1', teamName: 'Alpha', collegeName: 'A' },
          { group: 'A', rank: '2', teamName: 'Beta', collegeName: 'B' },
        ],
      },
    ];

    expect(findDialogTeamGroupSection(sections, 'Beta')?.group).toBe('A');
    expect(findDialogTeamGroupSection(sections, 'Gamma')).toBeNull();
  });

  it('builds fallback rank rows when rank section missing', () => {
    const teamRows = buildDialogTeamRows(
      {
        group: 'A',
        teams: [
          { group: 'A', rank: '1', teamName: 'Alpha', collegeName: 'A' },
          { group: 'A', rank: '2', teamName: 'Beta', collegeName: 'B' },
        ],
      },
      'Beta',
    );

    const rows = buildDialogRankRows(null, teamRows, 'Beta');

    expect(rows).toHaveLength(2);
    expect(rows[0].isFallback).toBe(true);
    expect(rows[1].isCurrent).toBe(true);
    expect(rows[1].winDrawLose).toBe('-');
  });

  it('sorts non-fallback rows by points then netVictoryPoint then rank', () => {
    const sorted = sortDialogRankRows([
      {
        rank: 3,
        teamName: 'C',
        collegeName: 'C',
        collegeLogo: '',
        winDrawLose: '2-0-1',
        points: 7,
        netVictoryPoint: 5,
        totalDamage: 0,
        totalRemainHp: 0,
        isCurrent: false,
        isFallback: false,
      },
      {
        rank: 2,
        teamName: 'B',
        collegeName: 'B',
        collegeLogo: '',
        winDrawLose: '2-0-1',
        points: 9,
        netVictoryPoint: 1,
        totalDamage: 0,
        totalRemainHp: 0,
        isCurrent: true,
        isFallback: false,
      },
      {
        rank: 1,
        teamName: 'A',
        collegeName: 'A',
        collegeLogo: '',
        winDrawLose: '2-0-1',
        points: 9,
        netVictoryPoint: 2,
        totalDamage: 0,
        totalRemainHp: 0,
        isCurrent: false,
        isFallback: false,
      },
    ]);

    expect(sorted.map((item) => item.teamName)).toEqual(['A', 'B', 'C']);
    expect(sorted[0].rankDisplay).toBe(1);
  });

  it('sorts fallback rows by rank and auto-fills rankDisplay for invalid rank', () => {
    const sorted = sortDialogRankRows([
      {
        rank: 0,
        teamName: 'Beta',
        collegeName: 'B',
        collegeLogo: '',
        winDrawLose: '-',
        points: 0,
        netVictoryPoint: 0,
        totalDamage: 0,
        totalRemainHp: 0,
        isCurrent: false,
        isFallback: true,
      },
      {
        rank: 2,
        teamName: 'Gamma',
        collegeName: 'G',
        collegeLogo: '',
        winDrawLose: '-',
        points: 0,
        netVictoryPoint: 0,
        totalDamage: 0,
        totalRemainHp: 0,
        isCurrent: false,
        isFallback: true,
      },
    ]);

    expect(sorted.map((item) => item.teamName)).toEqual(['Beta', 'Gamma']);
    expect(sorted[0].rankDisplay).toBe(1);
    expect(sorted[1].rankDisplay).toBe(2);
  });
});
