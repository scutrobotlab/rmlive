import { describe, expect, it } from 'vitest';
import type { DanmuMessage } from '../../types/api';
import {
  parseStructuredName,
  resolveDisplayNickname,
  resolveDisplaySchool,
  resolveTooltipMeta,
  resolveTooltipText,
} from '../danmuView';

function createMessage(partial: Partial<DanmuMessage>): DanmuMessage {
  return {
    id: 'm1',
    timestamp: 1_700_000_000_000,
    text: 'hello world',
    username: '2024-队员-SCUT-橘子',
    nickname: '',
    schoolName: '',
    badge: '',
    source: 'realtime',
    ...partial,
  };
}

describe('danmuView', () => {
  it('parses structured username', () => {
    expect(parseStructuredName('2024-队员-SCUT-橘子')).toEqual({
      year: '2024',
      role: '队员',
      school: 'SCUT',
      nickname: '橘子',
    });
    expect(parseStructuredName('x-y-z')).toBeNull();
  });

  it('resolves display school and nickname with fallbacks', () => {
    const fromFields = createMessage({ schoolName: ' 华工 ', nickname: ' 小明 ' });
    expect(resolveDisplaySchool(fromFields)).toBe('华工');
    expect(resolveDisplayNickname(fromFields)).toBe('小明');

    const fromStructured = createMessage({ schoolName: '', nickname: '' });
    expect(resolveDisplaySchool(fromStructured)).toBe('SCUT');
    expect(resolveDisplayNickname(fromStructured)).toBe('橘子');

    const fromUsername = createMessage({ username: 'plain-user', schoolName: '', nickname: '' });
    expect(resolveDisplaySchool(fromUsername)).toBe('未知学校');
    expect(resolveDisplayNickname(fromUsername)).toBe('plain-user');
  });

  it('builds tooltip meta and suppresses duplicated username', () => {
    const msg = createMessage({ username: '2024-队员-SCUT-橘子' });
    const meta = resolveTooltipMeta(msg);

    expect(meta.school).toBe('SCUT');
    expect(meta.nickname).toBe('橘子');
    expect(meta.year).toBe('2024');
    expect(meta.role).toBe('队员');
    expect(meta.username).toBe('');
    expect(meta.sourceLabel).toBe('实时弹幕');
    expect(meta.timeLabel).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('keeps raw username when different from structured form', () => {
    const msg = createMessage({ username: 'raw-user', source: 'history' });
    const meta = resolveTooltipMeta(msg);

    expect(meta.username).toBe('raw-user');
    expect(meta.sourceLabel).toBe('历史弹幕');
  });

  it('builds tooltip text with expected lines', () => {
    const msg = createMessage({ username: 'raw-user', source: 'history' });
    const text = resolveTooltipText(msg);

    expect(text).toContain('学校: 未知学校');
    expect(text).toContain('昵称: raw-user');
    expect(text).toContain('name: raw-user');
    expect(text).toContain('时间: ');
  });
});
