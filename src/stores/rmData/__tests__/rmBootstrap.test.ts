import { describe, expect, it } from 'vitest';
import {
  getRejectedBootstrapSources,
  resolveBootstrapStreamErrorMessage,
  shouldKeepBootstrapFallback,
  type BootstrapFetchResults,
} from '../rmBootstrap';

function makeFulfilled<T>(value: T): PromiseFulfilledResult<T> {
  return {
    status: 'fulfilled',
    value,
  };
}

function makeRejected(reason: unknown): PromiseRejectedResult {
  return {
    status: 'rejected',
    reason,
  };
}

function createResults(overrides?: Partial<BootstrapFetchResults>): BootstrapFetchResults {
  return {
    liveGameInfoResult: makeFulfilled({} as any),
    currentAndNextResult: makeFulfilled({} as any),
    groupsOrderResult: makeFulfilled({} as any),
    scheduleResult: makeFulfilled({} as any),
    robotResult: makeFulfilled({} as any),
    groupRankResult: makeFulfilled({} as any),
    ...overrides,
  };
}

describe('getRejectedBootstrapSources', () => {
  it('returns rejected source names in stable order', () => {
    const results = createResults({
      liveGameInfoResult: makeRejected(new Error('network')),
      scheduleResult: makeRejected(new Error('timeout')),
    });

    expect(getRejectedBootstrapSources(results)).toEqual(['liveGameInfo', 'schedule']);
  });
});

describe('resolveBootstrapStreamErrorMessage', () => {
  it('returns default stream error when liveGameInfo bootstrap fails', () => {
    const results = createResults({
      liveGameInfoResult: makeRejected(new Error('network')),
      scheduleResult: makeRejected(new Error('timeout')),
    });

    expect(resolveBootstrapStreamErrorMessage(results)).toBe('直播流请求失败，请检查网络后重试');
  });

  it('returns null when liveGameInfo succeeds even if others fail', () => {
    const results = createResults({
      scheduleResult: makeRejected(new Error('timeout')),
      robotResult: makeRejected(new Error('503')),
    });

    expect(resolveBootstrapStreamErrorMessage(results)).toBeNull();
  });
});

describe('shouldKeepBootstrapFallback', () => {
  it('returns true when any bootstrap request is rejected', () => {
    const results = createResults({
      robotResult: makeRejected(new Error('timeout')),
    });

    expect(shouldKeepBootstrapFallback(results)).toBe(true);
  });

  it('returns false when all bootstrap requests succeed', () => {
    expect(shouldKeepBootstrapFallback(createResults())).toBe(false);
  });
});
