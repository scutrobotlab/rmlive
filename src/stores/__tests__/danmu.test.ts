import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DanmuMessage } from '../../types/api';
import { useDanmuStore } from '../danmu';

vi.mock('../userInfo', () => {
  return {
    useUserInfoStore: (): { userInfo: null } => ({ userInfo: null }),
  };
});

function createMessage(partial: Partial<DanmuMessage>): DanmuMessage {
  return {
    id: 'm1',
    timestamp: Date.now(),
    text: 'hello',
    username: 'user-a',
    nickname: 'nick-a',
    schoolName: 'SCUT',
    badge: '',
    source: 'realtime',
    ...partial,
  };
}

describe('danmu store candidates', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('collects school and user candidates by recency with token dedupe', () => {
    const store = useDanmuStore();

    store.addMessage(createMessage({ id: '3', timestamp: 300, schoolName: 'SCUT', nickname: 'Alice' }));
    store.addMessage(createMessage({ id: '2', timestamp: 200, schoolName: 'scut', nickname: 'alice' }));
    store.addMessage(createMessage({ id: '1', timestamp: 100, schoolName: 'HIT', nickname: 'Bob', source: 'history' }));

    expect(store.schoolCandidates).toEqual(['SCUT', 'HIT']);
    expect(store.userCandidates).toEqual(['Alice', 'Bob']);
  });

  it('limits candidates to latest 100 unique values', () => {
    const store = useDanmuStore();

    for (let index = 1; index <= 130; index += 1) {
      store.addMessage(
        createMessage({
          id: String(index),
          timestamp: index,
          schoolName: `School-${index}`,
          nickname: `User-${index}`,
        }),
      );
    }

    expect(store.schoolCandidates.length).toBe(100);
    expect(store.userCandidates.length).toBe(100);
    expect(store.schoolCandidates[0]).toBe('School-130');
    expect(store.userCandidates[0]).toBe('User-130');
    expect(store.schoolCandidates.includes('School-31')).toBe(true);
    expect(store.schoolCandidates.includes('School-30')).toBe(false);
  });
});
