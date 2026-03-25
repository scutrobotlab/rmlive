import type { DanmuFilterRules, DanmuMessage } from '../types/api';

export const DEFAULT_DANMU_FILTER_RULES: DanmuFilterRules = {
  enabled: true,
  keywords: [],
  schools: [],
  users: [],
};

export function normalizeDanmuFilterToken(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function sanitizeList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const dedup = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const text = String(value || '').trim();
    const normalized = normalizeDanmuFilterToken(text);
    if (normalized) {
      if (!dedup.has(normalized)) {
        dedup.add(normalized);
        result.push(text);
      }
    }
  });
  return result;
}

function hasToken(list: string[], value: string): boolean {
  const normalizedValue = normalizeDanmuFilterToken(value);
  if (!normalizedValue) {
    return false;
  }

  return list.some((item) => normalizeDanmuFilterToken(item) === normalizedValue);
}

export function normalizeDanmuFilterRules(input: unknown): DanmuFilterRules {
  const raw = input && typeof input === 'object' ? (input as Partial<DanmuFilterRules>) : {};
  return {
    enabled: raw.enabled !== false,
    keywords: sanitizeList(raw.keywords),
    schools: sanitizeList(raw.schools),
    users: sanitizeList(raw.users),
  };
}

export function countActiveDanmuFilterRules(rules: DanmuFilterRules): number {
  return rules.keywords.length + rules.schools.length + rules.users.length;
}

export function isDanmuTextBlocked(text: string, rules: DanmuFilterRules): boolean {
  if (!rules.enabled || rules.keywords.length === 0) {
    return false;
  }

  const normalizedText = normalizeDanmuFilterToken(text);
  if (!normalizedText) {
    return false;
  }

  return rules.keywords.some((keyword) => normalizedText.includes(normalizeDanmuFilterToken(keyword)));
}

export function isDanmuMessageBlocked(message: DanmuMessage, rules: DanmuFilterRules): boolean {
  if (!rules.enabled) {
    return false;
  }

  if (isDanmuTextBlocked(message.text, rules)) {
    return true;
  }

  if (hasToken(rules.schools, message.schoolName)) {
    return true;
  }

  return hasToken(rules.users, message.username) || hasToken(rules.users, message.nickname);
}
