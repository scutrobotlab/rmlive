import { describe, expect, it } from 'vitest';
import { pickBestZoneCandidate, shouldAutoPromoteZone } from '../zoneSelection';

describe('pickBestZoneCandidate', () => {
  it('prioritizes inferred live zone over others', () => {
    const result = pickBestZoneCandidate({
      options: [
        { value: '1', disabled: false },
        { value: '2', disabled: false },
      ],
      enabledOptions: [
        { value: '1', disabled: false },
        { value: '2', disabled: false },
      ],
      inferredLiveZoneIdSet: new Set(['2']),
      scheduleZoneIdSet: new Set(['1']),
      liveZones: [
        { zoneId: '1', qualities: [{ src: null }] },
        { zoneId: '2', qualities: [{ src: null }] },
      ],
      preferredZoneId: '1',
    });

    expect(result).toBe('2');
  });

  it('falls back to first option when none enabled', () => {
    const result = pickBestZoneCandidate({
      options: [{ value: '1', disabled: true }],
      enabledOptions: [],
      inferredLiveZoneIdSet: new Set(),
      scheduleZoneIdSet: new Set(),
      liveZones: [],
      preferredZoneId: null,
    });

    expect(result).toBe('1');
  });
});

describe('shouldAutoPromoteZone', () => {
  it('returns false once manual selection is made', () => {
    const shouldPromote = shouldAutoPromoteZone({
      hasManualZoneSelection: true,
      currentOptionValue: '1',
      liveFromMatchesValue: '2',
      inferredLiveZoneIdSet: new Set(),
      liveZones: [{ zoneId: '1', qualities: [{ src: null }] }],
    });

    expect(shouldPromote).toBe(false);
  });

  it('promotes when current option is not live and a live option exists', () => {
    const shouldPromote = shouldAutoPromoteZone({
      hasManualZoneSelection: false,
      currentOptionValue: '1',
      liveFromMatchesValue: '2',
      inferredLiveZoneIdSet: new Set(['2']),
      liveZones: [
        { zoneId: '1', qualities: [{ src: null }] },
        { zoneId: '2', qualities: [{ src: 'https://x.m3u8' }] },
      ],
    });

    expect(shouldPromote).toBe(true);
  });
});
