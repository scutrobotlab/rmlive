import type { IMatchEngagementGateway } from '@/danmu/DanmuService';
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

function normSchool(s: string): string {
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
  const supportFxEvents = ref<SupportFxEvent[]>([]);

  const danmuServiceRef = shallowRef<IMatchEngagementGateway | null>(null);
  const supportFxTimers = new Map<string, ReturnType<typeof setTimeout>>();

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
    redSupport.value = 0;
    blueSupport.value = 0;
    reactions.value = {};
    seenEngagementIds.value = new Set();
    clearSupportFx();
  }

  function registerDanmuService(service: IMatchEngagementGateway | null) {
    danmuServiceRef.value = service;
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
    redSupport.value = 0;
    blueSupport.value = 0;
    reactions.value = {};
    const nextSeen = new Set<string>();
    for (const p of items) {
      if (p.matchKey !== currentMatchKey.value) {
        continue;
      }
      if (nextSeen.has(p.messageId)) {
        continue;
      }
      nextSeen.add(p.messageId);
      applyHydratedDelta(p);
    }
    seenEngagementIds.value = nextSeen;
  }

  async function refreshHydrate(options?: { trackLoading?: boolean }) {
    const svc = danmuServiceRef.value;
    if (!svc || !currentMatchKey.value) {
      return;
    }
    const track = options?.trackLoading === true;
    if (track) {
      hydrateLoading.value = true;
    }
    try {
      const list = await svc.fetchEngagementHistory();
      hydrateFromHistory(list);
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
    try {
      await svc.sendSupportTeam(mk, college);
      await refreshHydrate();
    } catch (e) {
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
      await refreshHydrate();
    } catch (e) {
      console.warn('[matchEngagement] sendReaction failed', e);
    }
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
    supportFxEvents,
    hydrateLoading,
    registerDanmuService,
    applyRunningMatch,
    ingestLive,
    hydrateFromHistory,
    refreshHydrate,
    enqueueSupportFx,
    sendSupport,
    sendReaction,
  };
});
