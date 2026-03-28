import { describe, expect, it } from 'vitest';
import {
  getRecentMatches,
  getScheduleSchoolOptions,
  getSchoolTeamOptions,
  getTeamNameOptions,
  getZoneNameOptions,
  groupScheduleRowsByDate,
  type MatchView,
} from '../matchView';

function createRow(partial: Partial<MatchView>): MatchView {
  return {
    blueTeam: { teamName: 'Blue', collegeName: 'B', logo: '' },
    redTeam: { teamName: 'Red', collegeName: 'R', logo: '' },
    score: '0 : 0',
    status: '未开始',
    stage: '-',
    slug: '-',
    orderNumber: '1',
    startAt: '-',
    id: '1',
    date: '2026/03/26',
    time: '10:00:00',
    dateTimeLabel: '03/26 10:00',
    startedAtTs: 0,
    statusRaw: 'WAITING',
    replayVideo: null,
    planGameCount: 3,
    zoneId: 'z1',
    zoneName: '站点1',
    eventTitle: 'RM',
    ...partial,
  };
}

describe('schedule match list helpers', () => {
  it('builds unique sorted school and team options', () => {
    const rows: MatchView[] = [
      createRow({
        redTeam: { teamName: 'Alpha', collegeName: 'SCUT', logo: '' },
        blueTeam: { teamName: 'Beta', collegeName: ' HIT ', logo: '' },
      }),
      createRow({
        redTeam: { teamName: 'alpha', collegeName: 'SCUT', logo: '' },
        blueTeam: { teamName: '-', collegeName: '-', logo: '' },
      }),
    ];

    expect(getScheduleSchoolOptions(rows)).toEqual([
      { label: 'HIT', value: 'HIT' },
      { label: 'SCUT', value: 'SCUT' },
    ]);

    expect(getTeamNameOptions(rows)).toEqual([
      { label: 'alpha', value: 'alpha' },
      { label: 'Alpha', value: 'Alpha' },
      { label: 'Beta', value: 'Beta' },
    ]);

    expect(getSchoolTeamOptions(rows)).toEqual([
      { label: 'HIT - Beta', value: 'Beta' },
      { label: 'SCUT - alpha', value: 'alpha' },
      { label: 'SCUT - Alpha', value: 'Alpha' },
    ]);
  });

  it('builds unique sorted zone options with zoneId priority', () => {
    const rows: MatchView[] = [
      createRow({ zoneId: 'z2', zoneName: '二号站' }),
      createRow({ zoneId: 'z1', zoneName: '一号站' }),
      createRow({ zoneId: 'z2', zoneName: '二号站' }),
      createRow({ zoneId: '', zoneName: '未命名站' }),
    ];

    expect(getZoneNameOptions(rows)).toEqual([
      { label: '二号站', value: 'z2' },
      { label: '未命名站', value: '未命名站' },
      { label: '一号站', value: 'z1' },
    ]);
  });

  it('returns recent matches with up to two completed then upcoming by time', () => {
    const rows: MatchView[] = [
      createRow({ id: 'c1', statusRaw: 'DONE', startedAtTs: 3000 }),
      createRow({ id: 'c2', statusRaw: 'ENDED', startedAtTs: 5000 }),
      createRow({ id: 'c3', statusRaw: 'DONE', startedAtTs: 1000 }),
      createRow({ id: 'u1', statusRaw: 'WAITING', startedAtTs: 7000 }),
      createRow({ id: 'u2', statusRaw: 'STARTED', startedAtTs: 6000 }),
      createRow({ id: 'u3', statusRaw: 'WAITING', startedAtTs: 8000 }),
    ];

    const result = getRecentMatches(rows, 'z1', 5);

    expect(result.map((item) => item.id)).toEqual(['c2', 'c1', 'u2', 'u1', 'u3']);
  });

  it('groups rows by date and keeps unknown date group last in asc order', () => {
    const rows: MatchView[] = [
      createRow({ id: '1', startedAtTs: new Date('2026-03-24T10:00:00Z').getTime() }),
      createRow({ id: '2', startedAtTs: new Date('2026-03-25T10:00:00Z').getTime() }),
      createRow({ id: '3', startedAtTs: 0, date: 'unknown' }),
    ];

    const result = groupScheduleRowsByDate(rows, 'asc');

    expect(result.map((group) => group.date)).toEqual(['2026-03-24', '2026-03-25', 'unknown']);
  });
});
