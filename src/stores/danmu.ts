import { Danmu } from 'artplayer-plugin-danmuku';
import { defineStore } from 'pinia';
import { useToast } from 'primevue';
import { ref } from 'vue';
import type { DanmuMessage } from '../types/api';
import { useUserInfoStore } from './userInfo';

interface ParsedNameMeta {
  year: string;
  role: string;
  school: string;
  nickname: string;
}

export interface DanmuTooltipMeta {
  school: string;
  nickname: string;
  year: string;
  role: string;
  username: string;
  sourceLabel: string;
  timeLabel: string;
}

function parseStructuredName(name: string): ParsedNameMeta | null {
  const raw = String(name || '').trim();
  if (!raw) {
    return null;
  }

  const parts = raw
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 4) {
    return null;
  }

  const [year, role, school, ...rest] = parts;
  const nickname = rest.join('-').trim();

  return {
    year,
    role,
    school,
    nickname,
  };
}

export const useDanmuStore = defineStore('danmu', () => {
  const messages = ref<DanmuMessage[]>([]);
  const maxMessages = 180;

  function clearMessages() {
    messages.value = [];
  }

  function addMessage(msg: DanmuMessage) {
    messages.value.unshift(msg);
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

  function resolveDisplaySchool(msg: DanmuMessage): string {
    if (msg.schoolName?.trim()) {
      return msg.schoolName.trim();
    }

    const parsed = parseStructuredName(msg.username);
    if (parsed?.school) {
      return parsed.school;
    }

    return '未知学校';
  }

  function resolveDisplayNickname(msg: DanmuMessage): string {
    if (msg.nickname?.trim()) {
      return msg.nickname.trim();
    }

    const parsed = parseStructuredName(msg.username);
    if (parsed?.nickname) {
      return parsed.nickname;
    }

    return msg.username || '匿名';
  }

  function resolveTooltipText(msg: DanmuMessage): string {
    const meta = resolveTooltipMeta(msg);
    const lines: string[] = [];
    lines.push(`学校: ${meta.school}`);
    lines.push(`昵称: ${meta.nickname}`);

    if (meta.year) {
      lines.push(`参赛年份: ${meta.year}`);
    }

    if (meta.role) {
      lines.push(`身份: ${meta.role}`);
    }

    if (meta.username) {
      lines.push(`name: ${meta.username}`);
    }

    lines.push(`时间: ${meta.timeLabel}`);

    return lines.join('\n');
  }

  function resolveTooltipMeta(msg: DanmuMessage): DanmuTooltipMeta {
    const parsed = parseStructuredName(msg.username);
    const school = resolveDisplaySchool(msg);
    const nickname = resolveDisplayNickname(msg);
    const username = String(msg.username || '').trim();
    const parsedJoined = parsed
      ? [parsed.year, parsed.role, parsed.school, parsed.nickname].filter(Boolean).join('-')
      : '';
    const shouldShowUsername = Boolean(username && (!parsed || username !== parsedJoined));

    return {
      school,
      nickname,
      year: parsed?.year || '',
      role: parsed?.role || '',
      username: shouldShowUsername ? username : '',
      sourceLabel: msg.source === 'history' ? '历史弹幕' : '实时弹幕',
      timeLabel: new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour12: false }),
    };
  }

  const userInfo = useUserInfoStore();

  const sendDanmu = async (d: Danmu): Promise<boolean> => {
    if (!userInfo.userInfo) {
      const toast = useToast();
      toast.add({ severity: 'warn', summary: '请先登录', detail: '登录后才能发送弹幕' });
      return false;
    }

    // TODO: send danmu via API

    return true;
  };

  return {
    messages,
    clearMessages,
    addMessage,
    resetMessages,
    pushMessage,
    resolveDisplaySchool,
    resolveDisplayNickname,
    resolveTooltipText,
    resolveTooltipMeta,
    sendDanmu,
  };
});
