import type { Danmu } from 'artplayer-plugin-danmuku';
import { storeToRefs } from 'pinia';
import { ref, type Ref } from 'vue';

import { useRmDataStore } from '@/stores/rmData';
import { useUserInfoStore } from '@/stores/userInfo';
import { useMatchEngagementStore } from '@/stores/matchEngagement';
import { useDanmuFilterStore } from '@/stores/danmuFilter';
import { useDanmuStore } from '@/stores/danmu';
import { DanmuService } from '@/danmu/DanmuService';
import { formatStructuredName, resolveDisplaySchool } from '@/utils/danmuView';
import { generateMockDanmuMessages } from '@/utils/mockDanmu';
import { trackEvent } from '@/utils/tracking';
import type { DanmuAttributes, DanmuMessage } from '@/types/api';

interface UseDanmuEmitterOptions {
  danmuEnabled: boolean;
  isIFrame: boolean;
  danmukuPlugin: Ref<any>;
  onPushDanmu: (msg: DanmuMessage) => void;
  onDanmu: (msg: DanmuMessage) => void;
  onDanmuReset: () => void;
  onDanmuList: (messages: DanmuMessage[]) => void;
  toast: ReturnType<typeof import('primevue/usetoast').useToast>;
}

type TrackDanmuStyle = Record<string, string>;

const RED_SIDE_DANMU_STYLE: TrackDanmuStyle = {
  fontWeight: '700',
  padding: '0 8px',
  backgroundColor: 'rgba(190, 24, 93, 0.24)',
  textShadow: '0 0 6px rgba(251, 113, 133, 0.45)',
};

const BLUE_SIDE_DANMU_STYLE: TrackDanmuStyle = {
  fontWeight: '700',
  padding: '0 8px',
  backgroundColor: 'rgba(3, 105, 161, 0.24)',
  textShadow: '0 0 6px rgba(56, 189, 248, 0.45)',
};

export function useDanmuEmitter(options: UseDanmuEmitterOptions) {
  const danmuService = ref<DanmuService | null>(null);
  const isPlayerReady = ref(false);
  let currentRoomId: string | null = null;
  let pendingRoomId: string | null = null;
  let roomSwitchToken = 0;
  let connectingService: DanmuService | null = null;
  let danmuReceiveCount = 0;
  const pendingDanmuQueue: DanmuMessage[] = [];

  const danmuFilterStore = useDanmuFilterStore();
  const matchEngagementStore = useMatchEngagementStore();
  const userInfoStore = useUserInfoStore();
  const rmDataStore = useRmDataStore();
  const danmuStore = useDanmuStore();
  const { runningMatchForSelectedZone } = storeToRefs(rmDataStore);

  function normalizeSchoolToken(value: string | null | undefined): string {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    if (!normalized || normalized === '-') {
      return '';
    }
    return normalized;
  }

  function resolveSpecialDanmuStyleBySchool(message: DanmuMessage): TrackDanmuStyle | undefined {
    const senderSchool = normalizeSchoolToken(resolveDisplaySchool(message));
    if (!senderSchool) {
      return undefined;
    }

    const currentMatch = runningMatchForSelectedZone.value;
    if (!currentMatch) {
      return undefined;
    }

    const redSchool = normalizeSchoolToken(currentMatch.redTeam.collegeName);
    const blueSchool = normalizeSchoolToken(currentMatch.blueTeam.collegeName);

    if (senderSchool === redSchool) {
      return RED_SIDE_DANMU_STYLE;
    }

    if (senderSchool === blueSchool) {
      return BLUE_SIDE_DANMU_STYLE;
    }

    return undefined;
  }

  function pushDanmuToPlayer(msg: DanmuMessage) {
    options.onPushDanmu(msg);
  }

  function flushPendingDanmu() {
    if (pendingDanmuQueue.length === 0) {
      return;
    }

    const queue = pendingDanmuQueue.splice(0, pendingDanmuQueue.length);
    queue.forEach((msg) => pushDanmuToPlayer(msg));
  }

  function buildLocalEchoDanmu(text: string, attrs: DanmuAttributes): DanmuMessage {
    const now = Date.now();
    return {
      id: `local-${now}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now,
      text,
      username: String(attrs.username ?? ''),
      nickname: attrs.nickname,
      schoolName: attrs.schoolName,
      badge: attrs.badge,
      source: 'realtime',
      ...(attrs.mode !== undefined ? { mode: attrs.mode } : {}),
      ...(attrs.color ? { color: attrs.color } : {}),
    };
  }

  function formatRacingAge(value: number | string | null | undefined): string {
    const raw = String(value ?? '').trim();
    if (!raw || /^0+$/.test(raw)) {
      return '';
    }
    return raw;
  }

  async function sendDanmuByRealtime(d: Danmu): Promise<boolean> {
    const content = String(d?.text ?? '').trim();
    if (!content) {
      return false;
    }

    if (!userInfoStore.userInfo) {
      options.toast.add({ severity: 'warn', summary: '请先登录', detail: '登录后才能发送弹幕' });
      return false;
    }

    if (!danmuService.value) {
      options.toast.add({ severity: 'warn', summary: '弹幕未连接', detail: '请稍后重试' });
      return false;
    }

    const racingAge = formatRacingAge(userInfoStore.userInfo.racingAge);
    const myAttributes: DanmuAttributes = {
      nickname: userInfoStore.userInfo.nickname || '',
      schoolName: userInfoStore.userInfo.school || '',
      badge: userInfoStore.userInfo.badge?.[0] || '',
      racingAge,
      position: userInfoStore.userInfo.role || '',
      isAdmin: false,
      username: formatStructuredName({
        year: racingAge,
        role: userInfoStore.userInfo.role || '',
        school: userInfoStore.userInfo.school || '',
        nickname: userInfoStore.userInfo.nickname || '',
      }),
    };

    const m = d?.mode;
    if (m === 0 || m === 1 || m === 2) {
      myAttributes.mode = m;
    }
    const c = typeof d?.color === 'string' ? d.color.trim() : '';
    if (c) {
      myAttributes.color = c;
    }

    try {
      await danmuService.value.sendMessage(content, myAttributes);
      trackEvent('danmu.send', { zoneId: rmDataStore.selectedZoneId });
      options.onDanmu(buildLocalEchoDanmu(content, myAttributes));
      return true;
    } catch (error) {
      console.error('[LivePlayer] Failed to send danmu:', error);
      trackEvent('danmu.send_fail', { zoneId: rmDataStore.selectedZoneId });
      options.toast.add({ severity: 'error', summary: '发送失败', detail: '弹幕发送失败，请稍后重试' });
      return false;
    }
  }

  async function destroyDanmu() {
    if (connectingService) {
      try {
        await connectingService.disconnect();
      } catch (error) {
        console.warn('[LivePlayer] Ignore connectingService disconnect error:', error);
      }
      connectingService = null;
    }

    if (danmuService.value) {
      try {
        trackEvent('danmu.disconnect', { zoneId: rmDataStore.selectedZoneId });
        await danmuService.value.disconnect();
      } catch (error) {
        console.warn('[LivePlayer] Ignore danmuService disconnect error:', error);
      }
      danmuService.value = null;
    }
    matchEngagementStore.attachDanmuService(null);
  }

  function syncDanmuConnection() {
    if (!options.danmuEnabled) {
      currentRoomId = null;
      pendingRoomId = null;
      roomSwitchToken += 1;
      void destroyDanmu();
      return;
    }

    if (!isPlayerReady.value) {
      return;
    }

    if (!pendingRoomId) {
      currentRoomId = null;
      roomSwitchToken += 1;
      void destroyDanmu();
      return;
    }

    void initDanmu(pendingRoomId);
  }

  function createDebugDanmu(text?: string): DanmuMessage {
    return {
      id: `debug-${Date.now()}`,
      timestamp: Date.now(),
      text: text || '[DEBUG] 固定测试弹幕',
      username: 'debug-user',
      nickname: 'Debug',
      schoolName: 'Local Debug Room',
      badge: 'DEBUG',
      source: 'realtime',
    };
  }

  function exposeDanmuDebugApi() {
    if (typeof window === 'undefined') {
      return;
    }

    (window as any).__rmDanmuDebugLocal = (text?: string) => {
      const debugMsg = createDebugDanmu(text);
      options.onDanmu(debugMsg);
      pushDanmuToPlayer(debugMsg);
      console.log('[LivePlayer][Debug] Local danmu injected:', debugMsg);
      return debugMsg;
    };

    (window as any).__rmDanmuDebugSend = async (text?: string) => {
      if (!danmuService.value) {
        console.warn('[LivePlayer][Debug] danmuService not connected');
        return false;
      }

      const content = text || '[DEBUG] 固定测试弹幕';
      await danmuService.value.sendMessage(content, {
        nickname: 'Debug',
        schoolName: 'Local Debug Room',
        badge: 'DEBUG',
        racingAge: '',
        position: 'debug',
        isAdmin: false,
        username: 'debug-user',
      });
      console.log('[LivePlayer][Debug] Realtime send invoked:', content);
      return true;
    };

    (window as any).__rmDanmuMockBulk = async (count?: number) => {
      const n = Math.max(1, Math.min(count ?? 300, 300));
      console.log(`[LivePlayer][Debug] Generating ${n} mock danmu...`);
      const start = performance.now();

      if (danmuService.value) {
        await danmuService.value.generateMockDanmu(n);
      } else {
        const messages = generateMockDanmuMessages(n);
        danmuStore.setMessages(messages);
        options.onDanmuList(messages);
      }

      const elapsed = (performance.now() - start).toFixed(1);
      console.log(`[LivePlayer][Debug] ${n} mock danmu done in ${elapsed}ms`);
      return true;
    };
  }

  async function initDanmu(roomId: string) {
    if (!roomId) {
      return;
    }

    if (currentRoomId === roomId && danmuService.value) {
      matchEngagementStore.attachDanmuService(danmuService.value);
      void matchEngagementStore.refreshHydrate({ trackLoading: true });
      return;
    }

    const token = ++roomSwitchToken;
    currentRoomId = roomId;

    try {
      options.onDanmuReset();
      await destroyDanmu();

      const nextService = new DanmuService({
        includeHistory: true,
        onMessage: (msg) => {
          if (token !== roomSwitchToken) {
            return;
          }
          options.onDanmu(msg);
          if (msg.source !== 'history') {
            pushDanmuToPlayer(msg);
            danmuReceiveCount += 1;
            if (danmuReceiveCount % 50 === 0) {
              trackEvent('danmu.receive_batch', { batchSize: 50, zoneId: rmDataStore.selectedZoneId });
            }
          }
        },
        onDanmuList: (messages) => {
          if (token !== roomSwitchToken) {
            return;
          }
          options.onDanmuList(messages);
        },
        onEngagementMessage: (p) => {
          if (token !== roomSwitchToken) {
            return;
          }
          matchEngagementStore.ingestLive(p);
        },
        onEngagementSnapshot: (payload) => {
          if (token !== roomSwitchToken) {
            return;
          }
          matchEngagementStore.applyWorkerSnapshot(payload);
        },
        onError: (error) => {
          console.error('[LivePlayer] Danmu service error:', error);
          trackEvent('danmu.connect_error', { zoneId: rmDataStore.selectedZoneId });
        },
      });
      connectingService = nextService;

      await nextService.connect(roomId);
      connectingService = null;
      trackEvent('danmu.connect', { zoneId: rmDataStore.selectedZoneId });

      if (token !== roomSwitchToken) {
        try {
          await nextService.disconnect();
        } catch (error) {
          console.warn('[LivePlayer] Ignore stale service disconnect error:', error);
        }
        return;
      }

      danmuService.value = nextService;
      await nextService.updateDanmuFilterRules(danmuFilterStore.rules);
      matchEngagementStore.attachDanmuService(nextService);
      void matchEngagementStore.refreshHydrate({ trackLoading: true });
    } catch (error) {
      trackEvent('danmu.connect_fail', { zoneId: rmDataStore.selectedZoneId });
      if (connectingService) {
        try {
          await connectingService.disconnect();
        } catch (disconnectError) {
          console.warn('[LivePlayer] Ignore connect-failure cleanup error:', disconnectError);
        }
        connectingService = null;
      }
      console.error('[LivePlayer] ✗ Failed to init danmu:', error);
    }
  }

  function tidyDebugApi() {
    if (typeof window !== 'undefined') {
      delete (window as any).__rmDanmuDebugLocal;
      delete (window as any).__rmDanmuDebugSend;
      delete (window as any).__rmDanmuMockBulk;
    }
  }

  function detachDanmuService() {
    roomSwitchToken += 1;
    currentRoomId = null;
  }

  function setPendingRoomId(roomId: string | null) {
    pendingRoomId = roomId;
  }

  function clearPendingDanmuQueue() {
    pendingDanmuQueue.length = 0;
  }

  function getPlayerDanmuPusher() {
    return pushDanmuToPlayer;
  }

  function getDanmuFilterStore() {
    return danmuFilterStore;
  }

  return {
    isPlayerReady,
    danmuService,
    sendDanmuByRealtime,
    pushDanmuToPlayer,
    flushPendingDanmu,
    syncDanmuConnection,
    initDanmu,
    destroyDanmu,
    tidyDebugApi,
    detachDanmuService,
    setPendingRoomId,
    clearPendingDanmuQueue,
    exposeDanmuDebugApi,
    getPlayerDanmuPusher,
    getDanmuFilterStore,
    resolveSpecialDanmuStyleBySchool,
  };
}
