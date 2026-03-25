import { describe, expect, it } from 'vitest';
import type { DanmuMessage } from '../../types/api';
import {
  countActiveDanmuFilterRules,
  isDanmuMessageBlocked,
  isDanmuTextBlocked,
  normalizeDanmuFilterRules,
} from '../danmuFilterRules';

function createMessage(partial: Partial<DanmuMessage>): DanmuMessage {
  return {
    id: 'm1',
    timestamp: Date.now(),
    text: 'hello world',
    username: 'user-a',
    nickname: 'nick-a',
    schoolName: 'scut',
    badge: '',
    source: 'realtime',
    ...partial,
  };
}

describe('danmuFilterRules', () => {
  it('normalizes rules and deduplicates values', () => {
    const rules = normalizeDanmuFilterRules({
      enabled: true,
      keywords: [' Test ', 'test', '', 'AB'],
      schools: [' SCUT ', 'scut'],
      users: [' Alice ', 'alice'],
    });

    expect(rules.keywords).toEqual(['Test', 'AB']);
    expect(rules.schools).toEqual(['SCUT']);
    expect(rules.users).toEqual(['Alice']);
  });

  it('counts active rules by all lists', () => {
    const rules = normalizeDanmuFilterRules({
      keywords: ['a', 'b'],
      schools: ['s1'],
      users: ['u1', 'u2'],
    });

    expect(countActiveDanmuFilterRules(rules)).toBe(5);
  });

  it('blocks text by keyword with case-insensitive includes', () => {
    const rules = normalizeDanmuFilterRules({ keywords: ['abc'] });
    expect(isDanmuTextBlocked('xxAbCy', rules)).toBe(true);
    expect(isDanmuTextBlocked('hello', rules)).toBe(false);
  });

  it('blocks message by school and user', () => {
    const rules = normalizeDanmuFilterRules({ schools: ['scut'], users: ['user-a', 'nick-b'] });

    expect(isDanmuMessageBlocked(createMessage({ schoolName: 'SCUT' }), rules)).toBe(true);
    expect(isDanmuMessageBlocked(createMessage({ schoolName: 'other', username: 'USER-A' }), rules)).toBe(true);
    expect(
      isDanmuMessageBlocked(createMessage({ schoolName: 'other', username: 'x', nickname: 'Nick-B' }), rules),
    ).toBe(true);
    expect(isDanmuMessageBlocked(createMessage({ schoolName: 'other', username: 'x', nickname: 'y' }), rules)).toBe(
      false,
    );
  });

  it('does not block when disabled', () => {
    const rules = normalizeDanmuFilterRules({ enabled: false, keywords: ['hello'], schools: ['scut'], users: ['u1'] });
    expect(isDanmuTextBlocked('hello', rules)).toBe(false);
    expect(isDanmuMessageBlocked(createMessage({}), rules)).toBe(false);
  });
});
