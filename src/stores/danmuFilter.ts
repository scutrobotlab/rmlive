import { useLocalStorage } from '@vueuse/core';
import type { Danmu } from 'artplayer-plugin-danmuku';
import { defineStore } from 'pinia';
import { computed } from 'vue';
import {
  countActiveDanmuFilterRules,
  DEFAULT_DANMU_FILTER_RULES,
  isDanmuMessageBlocked,
  isDanmuTextBlocked,
  normalizeDanmuFilterRules,
  normalizeDanmuFilterToken,
} from '../services/danmuFilterRules';
import type { DanmuFilterRules, DanmuMessage } from '../types/api';

const DANMU_FILTER_RULES_KEY = 'rm-live-danmu-filter-rules';

export const useDanmuFilterStore = defineStore('danmuFilter', () => {
  const rules = useLocalStorage<DanmuFilterRules>(DANMU_FILTER_RULES_KEY, DEFAULT_DANMU_FILTER_RULES);

  const normalizedRules = computed(() => normalizeDanmuFilterRules(rules.value));
  const activeRuleCount = computed(() => countActiveDanmuFilterRules(normalizedRules.value));

  function syncRules(nextRules: DanmuFilterRules) {
    rules.value = normalizeDanmuFilterRules(nextRules);
  }

  function setEnabled(enabled: boolean) {
    syncRules({ ...normalizedRules.value, enabled });
  }

  function addKeyword(keyword: string) {
    syncRules({ ...normalizedRules.value, keywords: [...normalizedRules.value.keywords, keyword] });
  }

  function removeKeyword(keyword: string) {
    const target = normalizeDanmuFilterToken(keyword);
    syncRules({
      ...normalizedRules.value,
      keywords: normalizedRules.value.keywords.filter((item) => normalizeDanmuFilterToken(item) !== target),
    });
  }

  function addSchool(school: string) {
    syncRules({ ...normalizedRules.value, schools: [...normalizedRules.value.schools, school] });
  }

  function setSchools(schools: string[]) {
    syncRules({ ...normalizedRules.value, schools });
  }

  function removeSchool(school: string) {
    const target = normalizeDanmuFilterToken(school);
    syncRules({
      ...normalizedRules.value,
      schools: normalizedRules.value.schools.filter((item) => normalizeDanmuFilterToken(item) !== target),
    });
  }

  function addUser(user: string) {
    syncRules({ ...normalizedRules.value, users: [...normalizedRules.value.users, user] });
  }

  function setUsers(users: string[]) {
    syncRules({ ...normalizedRules.value, users });
  }

  function removeUser(user: string) {
    const target = normalizeDanmuFilterToken(user);
    syncRules({
      ...normalizedRules.value,
      users: normalizedRules.value.users.filter((item) => normalizeDanmuFilterToken(item) !== target),
    });
  }

  function resetRules() {
    syncRules(DEFAULT_DANMU_FILTER_RULES);
  }

  function clearKeywords() {
    syncRules({ ...normalizedRules.value, keywords: [] });
  }

  function clearSchools() {
    syncRules({ ...normalizedRules.value, schools: [] });
  }

  function clearUsers() {
    syncRules({ ...normalizedRules.value, users: [] });
  }

  function matchTrackDanmu(d: Danmu): boolean {
    return !isDanmuTextBlocked(String(d?.text ?? ''), normalizedRules.value);
  }

  function matchMessage(message: DanmuMessage): boolean {
    return !isDanmuMessageBlocked(message, normalizedRules.value);
  }

  const filter = (d: Danmu): boolean => {
    return matchTrackDanmu(d);
  };

  return {
    rules: normalizedRules,
    activeRuleCount,
    setEnabled,
    addKeyword,
    removeKeyword,
    clearKeywords,
    addSchool,
    setSchools,
    removeSchool,
    clearSchools,
    addUser,
    setUsers,
    removeUser,
    clearUsers,
    resetRules,
    matchTrackDanmu,
    matchMessage,
    filter,
  };
});
