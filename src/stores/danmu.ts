import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { DanmuMessage } from '../types/api';
import { normalizeDanmuFilterToken } from '../utils/danmuFilterRules';
import {
  resolveDisplayNickname,
  resolveDisplaySchool,
  resolveTooltipMeta,
  resolveTooltipText,
} from '../utils/danmuView';

export const useDanmuStore = defineStore('danmu', () => {
  const messages = ref<DanmuMessage[]>([]);
  const maxMessages = 180;
  const maxCandidateCount = 100;

  function collectCandidates(
    list: DanmuMessage[],
    resolveValue: (message: DanmuMessage) => string,
    maxCount = maxCandidateCount,
  ): string[] {
    const dedup = new Set<string>();
    const candidates: string[] = [];

    for (const message of list) {
      const raw = resolveValue(message).trim();
      const token = normalizeDanmuFilterToken(raw);
      if (!token || dedup.has(token)) {
        continue;
      }
      dedup.add(token);
      candidates.push(raw);
      if (candidates.length >= maxCount) {
        break;
      }
    }

    return candidates;
  }

  function clearMessages() {
    messages.value = [];
  }

  function addMessage(msg: DanmuMessage) {
    const existingIndex = messages.value.findIndex((item) => item.id === msg.id);
    if (existingIndex >= 0) {
      messages.value.splice(existingIndex, 1, msg);
    } else {
      messages.value.unshift(msg);
    }
    messages.value.sort((a, b) => {
      if (b.timestamp !== a.timestamp) {
        return b.timestamp - a.timestamp;
      }
      return String(b.id).localeCompare(String(a.id));
    });
    if (messages.value.length > maxMessages) {
      messages.value.length = maxMessages;
    }
  }

  // Backward compatibility while migrating call sites.
  const resetMessages = clearMessages;
  const pushMessage = addMessage;

  const schoolCandidates = computed(() => {
    return collectCandidates(messages.value, (message) => resolveDisplaySchool(message));
  });

  const userCandidates = computed(() => {
    return collectCandidates(messages.value, (message) => resolveDisplayNickname(message));
  });

  return {
    messages,
    schoolCandidates,
    userCandidates,
    clearMessages,
    addMessage,
    resetMessages,
    pushMessage,
    resolveDisplaySchool,
    resolveDisplayNickname,
    resolveTooltipText,
    resolveTooltipMeta,
  };
});
