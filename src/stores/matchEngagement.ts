import reactionCatalog from '@/assets/reactions.json';
import type { IMatchEngagementGateway } from '@/danmu/im/types';
import {
  buildMatchKeyFromView,
  MSG_TYPE_MATCH_REACTION,
  MSG_TYPE_SUPPORT_TEAM,
  type EngagementInbound,
} from '@/leancloud/rmliveIm';
import type { MatchView } from '@/utils/matchView';
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';

type SupportSide = 'red' | 'blue';

interface SupportFxEvent {
  id: string;
  side: SupportSide;
  messageId: string;
  createdAt: number;
}

function normSchool(s: string | null | undefined): string {
  return String(s ?? '').trim();
}

export const useMatchEngagementStore = defineStore('matchEngagement', () => {
  const currentMatchKey = ref('');
  const redCollege = ref('');
  const blueCollege = ref('');
  const redSupport = ref(0);
  const blueSupport = ref(0);
  const reactions = ref<Record<string, number>>({});
  const seenEngagementIds = ref<Set<string>>(new Set());
  const hydrateLoading = ref(false);
  const viewerCount = ref<number | null>(null);
  const supportFxEvents = ref<SupportFxEvent[]>([]);

  const danmuServiceRef = shallowRef<IMatchEngagementGateway | null>(null);
  const viewerCountServiceRef = shallowRef<{ fetchChatRoomCount(): Promise<number> } | null>(null);
  const supportFxTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let hydrateRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  let viewerCountPollTimer: ReturnType<typeof setInterval> | null = null;

  const redPercent = computed(() => {
    const t = redSupport.value + blueSupport.value;
    if (t <= 0) {
      return 0;
    }
    return Math.round((redSupport.value / t) * 100);
  });

  const bluePercent = computed(() => {
    const t = redSupport.value + blueSupport.value;
    if (t <= 0) {
      return 0;
    }
    return 100 - redPercent.value;
  });

  function clearSupportFx() {
    for (const timer of supportFxTimers.values()) {
      clearTimeout(timer);
    }
    supportFxTimers.clear();
    supportFxEvents.value = [];
  }

  function resetCounts() {
    clearHydrateRefreshTimer();
    clearViewerCountPollTimer();
    redSupport.value = 0;
    blueSupport.value = 0;
    reactions.value = {};
    seenEngagementIds.value = new Set();
    clearSupportFx();
    viewerCount.value = null;
  }

  function registerDanmuService(service: IMatchEngagementGateway | null) {
    danmuServiceRef.value = service;
    if (!service) {
      clearHydrateRefreshTimer();
      return;
    }
  }

  function registerViewerCountService(service: { fetchChatRoomCount(): Promise<number> } | null) {
    viewerCountServiceRef.value = service;
    if (!service) {
      clearViewerCountPollTimer();
      viewerCount.value = null;
      return;
    }

    if (currentMatchKey.value) {
      startViewerCountPolling();
    }
  }

  function clearHydrateRefreshTimer() {
    if (hydrateRefreshTimer) {
      clearTimeout(hydrateRefreshTimer);
      hydrateRefreshTimer = null;
    }
  }

  function clearViewerCountPollTimer() {
    if (viewerCountPollTimer) {
      clearInterval(viewerCountPollTimer);
      viewerCountPollTimer = null;
    }
  }

  function startViewerCountPolling() {
    clearViewerCountPollTimer();
    if (!viewerCountServiceRef.value || !currentMatchKey.value) {
      return;
    }

    void refreshViewerCount();
    viewerCountPollTimer = setInterval(() => {
      void refreshViewerCount();
    }, 5000);
  }

  function scheduleHydrateRefresh(delayMs = 1800) {
    clearHydrateRefreshTimer();
    hydrateRefreshTimer = setTimeout(() => {
      hydrateRefreshTimer = null;
      void refreshHydrate();
    }, delayMs);
  }

  function applyRunningMatch(match: MatchView | null) {
    if (!match) {
      currentMatchKey.value = '';
      redCollege.value = '';
      blueCollege.value = '';
      resetCounts();
      return;
    }
    const mk = buildMatchKeyFromView(match);
    const nextRedCollege = normSchool(match.redTeam.collegeName);
    const nextBlueCollege = normSchool(match.blueTeam.collegeName);
    if (mk !== currentMatchKey.value) {
      currentMatchKey.value = mk;
      redCollege.value = nextRedCollege;
      blueCollege.value = nextBlueCollege;
      resetCounts();
      if (danmuServiceRef.value) {
        startViewerCountPolling();
      }
      return;
    }
    redCollege.value = nextRedCollege;
    blueCollege.value = nextBlueCollege;
  }

  function getSupportSideByCollege(collegeName: string | null | undefined): SupportSide | null {
    const c = normSchool(collegeName);
    if (c && c === normSchool(redCollege.value)) {
      return 'red';
    }
    if (c && c === normSchool(blueCollege.value)) {
      return 'blue';
    }
    return null;
  }

  function removeSupportFx(id: string) {
    const timer = supportFxTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      supportFxTimers.delete(id);
    }
    supportFxEvents.value = supportFxEvents.value.filter((event) => event.id !== id);
  }

  function enqueueSupportFx(side: SupportSide, messageId: string) {
    const id = `${messageId}:${Date.now()}`;
    supportFxEvents.value = [...supportFxEvents.value, { id, side, messageId, createdAt: Date.now() }];
    const timer = setTimeout(() => {
      removeSupportFx(id);
    }, 700);
    supportFxTimers.set(id, timer);
  }

  function applyHydratedDelta(p: EngagementInbound) {
    if (p.kind === MSG_TYPE_SUPPORT_TEAM) {
      const side = getSupportSideByCollege(p.collegeName);
      if (side === 'red') {
        redSupport.value += 1;
      } else if (side === 'blue') {
        blueSupport.value += 1;
      }
      return;
    }
    if (p.kind === MSG_TYPE_MATCH_REACTION && p.reactionId) {
      const id = p.reactionId;
      reactions.value = { ...reactions.value, [id]: (reactions.value[id] ?? 0) + 1 };
    }
  }

  function applyCountSnapshot(snapshot: {
    redSupport: number;
    blueSupport: number;
    reactions: Record<string, number>;
  }) {
    redSupport.value = snapshot.redSupport;
    blueSupport.value = snapshot.blueSupport;
    reactions.value = reactionCatalog.reduce<Record<string, number>>((acc, item) => {
      acc[item.id] = snapshot.reactions[item.id] ?? 0;
      return acc;
    }, {});
  }

  function applyWorkerSnapshot(payload: {
    matchKey: string;
    status: 'hydrating' | 'live';
    snapshot: {
      redSupport: number;
      blueSupport: number;
      reactions: Record<string, number>;
    };
  }) {
    if (!currentMatchKey.value || payload.matchKey !== currentMatchKey.value) {
      return;
    }

    applyCountSnapshot(payload.snapshot);
    if (payload.status === 'live') {
      hydrateLoading.value = false;
    }
  }

  function ingestLive(p: EngagementInbound) {
    if (!currentMatchKey.value || p.matchKey !== currentMatchKey.value) {
      return;
    }
    if (seenEngagementIds.value.has(p.messageId)) {
      return;
    }
    seenEngagementIds.value = new Set(seenEngagementIds.value).add(p.messageId);
    if (p.kind === MSG_TYPE_SUPPORT_TEAM) {
      const side = getSupportSideByCollege(p.collegeName);
      if (side) {
        enqueueSupportFx(side, p.messageId);
      }
    }
  }

  function hydrateFromHistory(items: EngagementInbound[]) {
    if (!currentMatchKey.value) {
      return;
    }
    const targetMatchKey = currentMatchKey.value;
    redSupport.value = 0;
    blueSupport.value = 0;
    reactions.value = {};
    const nextSeen = new Set<string>();
    let filteredByMatchKey = 0;
    let dedupedCount = 0;
    let supportApplied = 0;
    let reactionApplied = 0;
    for (const p of items) {
      if (p.matchKey !== targetMatchKey) {
        filteredByMatchKey += 1;
        continue;
      }
      if (nextSeen.has(p.messageId)) {
        dedupedCount += 1;
        continue;
      }
      nextSeen.add(p.messageId);
      if (p.kind === MSG_TYPE_SUPPORT_TEAM) {
        supportApplied += 1;
      } else if (p.kind === MSG_TYPE_MATCH_REACTION) {
        reactionApplied += 1;
      }
      applyHydratedDelta(p);
    }
    seenEngagementIds.value = nextSeen;
  }

  async function refreshHydrate(options?: { trackLoading?: boolean }) {
    clearHydrateRefreshTimer();
    const svc = danmuServiceRef.value;
    if (!svc || !currentMatchKey.value) {
      return;
    }
    const track = options?.trackLoading === true;
    if (track) {
      hydrateLoading.value = true;
    }
    try {
      const snapshot = await svc.setEngagementMatch({
        matchKey: currentMatchKey.value,
        redCollege: redCollege.value,
        blueCollege: blueCollege.value,
        reactionIds: reactionCatalog.map((item) => item.id),
      });
      applyCountSnapshot(snapshot);
    } catch (e) {
      console.warn('[matchEngagement] refreshHydrate failed', e);
    } finally {
      if (track) {
        hydrateLoading.value = false;
      }
    }
  }

  async function sendSupport(side: 'red' | 'blue') {
    const svc = danmuServiceRef.value;
    const mk = currentMatchKey.value;
    if (!svc || !mk) {
      return;
    }
    const college = side === 'red' ? redCollege.value : blueCollege.value;
    if (!college) {
      return;
    }

    if (side === 'red') {
      redSupport.value += 1;
    } else {
      blueSupport.value += 1;
    }

    try {
      await svc.sendSupportTeam(mk, college);
      scheduleHydrateRefresh();
    } catch (e) {
      if (side === 'red') {
        redSupport.value = Math.max(0, redSupport.value - 1);
      } else {
        blueSupport.value = Math.max(0, blueSupport.value - 1);
      }
      console.warn('[matchEngagement] sendSupport failed', e);
    }
  }

  async function sendReaction(reactionId: string) {
    const svc = danmuServiceRef.value;
    const mk = currentMatchKey.value;
    if (!svc || !mk || !reactionId) {
      return;
    }
    // first add locally for better UX, the server will return the accurate count and fix any discrepancy
    reactions.value = { ...reactions.value, [reactionId]: (reactions.value[reactionId] ?? 0) + 1 };
    try {
      await svc.sendMatchReaction(mk, reactionId);
      scheduleHydrateRefresh();
    } catch (e) {
      const nextCount = Math.max(0, (reactions.value[reactionId] ?? 1) - 1);
      const nextReactions = { ...reactions.value };
      if (nextCount > 0) {
        nextReactions[reactionId] = nextCount;
      } else {
        delete nextReactions[reactionId];
      }
      reactions.value = nextReactions;
      console.warn('[matchEngagement] sendReaction failed', e);
    }
  }

  async function refreshViewerCount() {
    const svc = viewerCountServiceRef.value;
    if (!svc || !currentMatchKey.value) {
      viewerCount.value = null;
      return;
    }

    try {
      viewerCount.value = await svc.fetchChatRoomCount();
    } catch (e) {
      console.warn('[matchEngagement] refreshViewerCount failed', e);
      viewerCount.value = null;
    }
  }

  function stopViewerCountPolling() {
    clearViewerCountPollTimer();
  }

  return {
    currentMatchKey,
    redCollege,
    blueCollege,
    redSupport,
    blueSupport,
    reactions,
    redPercent,
    bluePercent,
    viewerCount,
    supportFxEvents,
    hydrateLoading,
    registerDanmuService,
    registerViewerCountService,
    applyRunningMatch,
    ingestLive,
    applyWorkerSnapshot,
    hydrateFromHistory,
    refreshHydrate,
    enqueueSupportFx,
    sendSupport,
    sendReaction,
    refreshViewerCount,
    startViewerCountPolling,
    stopViewerCountPolling,
  };
});
