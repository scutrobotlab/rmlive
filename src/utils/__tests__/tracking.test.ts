import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildTrackEvent, initTracking, trackEvent, trackPageView } from '../tracking';

describe('buildTrackEvent payload mapping', () => {
  it('maps danmu.send with zoneId as label', () => {
    expect(buildTrackEvent('danmu.send', { zoneId: 'zone-1' })).toEqual(['_trackEvent', '弹幕', '发送', 'zone-1']);
  });

  it('omits label when zoneId is missing', () => {
    expect(buildTrackEvent('danmu.send', { zoneId: null })).toEqual(['_trackEvent', '弹幕', '发送']);
    expect(buildTrackEvent('danmu.send', {})).toEqual(['_trackEvent', '弹幕', '发送']);
  });

  it('maps danmu.receive_batch with batch size as value', () => {
    expect(buildTrackEvent('danmu.receive_batch', { batchSize: 50, zoneId: 'zone-1' })).toEqual([
      '_trackEvent',
      '弹幕',
      '接收批量',
      'zone-1',
      50,
    ]);
  });

  it('drops non-finite values', () => {
    expect(buildTrackEvent('danmu.receive_batch', { batchSize: Number.NaN, zoneId: 'zone-1' })).toEqual([
      '_trackEvent',
      '弹幕',
      '接收批量',
      'zone-1',
    ]);
  });

  it('trims label whitespace', () => {
    expect(buildTrackEvent('danmu.send', { zoneId: '  zone-1  ' })).toEqual(['_trackEvent', '弹幕', '发送', 'zone-1']);
  });

  it('drops empty label', () => {
    expect(buildTrackEvent('danmu.send', { zoneId: '' })).toEqual(['_trackEvent', '弹幕', '发送']);
  });

  it('maps engagement.reaction combining matchKey and reactionId', () => {
    expect(buildTrackEvent('engagement.reaction', { matchKey: 'm1', reactionId: 'fire' })).toEqual([
      '_trackEvent',
      '互动',
      '表情',
      'm1:fire',
      1,
    ]);
  });

  it('maps engagement.reaction with reactionId only when matchKey missing', () => {
    expect(buildTrackEvent('engagement.reaction', { matchKey: null, reactionId: 'fire' })).toEqual([
      '_trackEvent',
      '互动',
      '表情',
      'fire',
      1,
    ]);
  });
});

describe('tracking no-ops when disabled', () => {
  beforeAll(() => {
    vi.stubEnv('VITE_TRACKING_ENABLED', '0');
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('trackEvent does not throw', () => {
    expect(() => trackEvent('danmu.send', { zoneId: 'zone-1' })).not.toThrow();
  });

  it('trackPageView does not throw', () => {
    expect(() => trackPageView()).not.toThrow();
  });

  it('initTracking does not throw', () => {
    expect(() => initTracking()).not.toThrow();
  });
});
