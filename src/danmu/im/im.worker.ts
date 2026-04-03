/// <reference lib="webworker" />

import {
  encodeTeamTarget,
  MSG_TYPE_MATCH_REACTION,
  MSG_TYPE_SUPPORT_TEAM,
  parseEngagementFromAttributes,
} from '@/leancloud/rmliveIm';
import type { DanmuAttributes, DanmuFilterRules, DanmuMessage, DanmuMode } from '@/types/api';
import { isDanmuMessageBlocked, normalizeDanmuFilterRules } from '@/utils/danmuFilterRules';
import type { Conversation, IMClient, Message } from 'leancloud-realtime';
import type { WorkerEvent, WorkerMessage, WorkerRequest, WorkerResponse } from './protocol';
import { loadLeancloudRuntime } from './workerEnv';

type RuntimeConfig = {
  appId: string;
  appKey: string;
  clientId: string;
  engagementChatRoomId: string;
};

type RoomBinding = {
  conversation: Conversation;
  messageHandler: (message: Message) => void;
};

type EngagementState = {
  matchKey: string;
  redCollege: string;
  blueCollege: string;
  reactionIds: string[];
  reactionSet: Set<string>;
  redSupport: number;
  blueSupport: number;
  reactions: Record<string, number>;
  seenMessageIds: Set<string>;
  hydrationRunning: boolean;
  hydrationDone: boolean;
  dirty: boolean;
  updatedAt: number;
};

const HISTORY_WINDOW_MS = 60 * 60 * 1000;
const HISTORY_PAGE_LIMIT = 100;
const SNAPSHOT_FLUSH_INTERVAL_MS = 50;

let runtime: ImRuntime | null = null;
const workerScope = self as unknown as DedicatedWorkerGlobalScope;

class ImRuntime {
  private config: RuntimeConfig;
  private emitEvent: (event: WorkerEvent) => void;
  private realtime: any = null;
  private client: IMClient | null = null;
  private roomBindings = new Map<string, RoomBinding>();
  private engagementBinding: RoomBinding | null = null;
  private engagementStates = new Map<string, EngagementState>();
  private activeMatchKey: string | null = null;
  private danmuFilterRules: DanmuFilterRules = normalizeDanmuFilterRules(undefined);
  private snapshotFlushTimer: ReturnType<typeof setInterval>;

  constructor(config: RuntimeConfig, emitEvent: (event: WorkerEvent) => void) {
    this.config = config;
    this.emitEvent = emitEvent;
    this.snapshotFlushTimer = setInterval(() => {
      this.flushDirtySnapshots();
    }, SNAPSHOT_FLUSH_INTERVAL_MS);
  }

  async connectRoom(roomId: string, includeHistory: boolean): Promise<void> {
    const { Event } = await loadLeancloudRuntime();
    const conversation = await this.joinConversation(roomId);

    if (!this.roomBindings.has(roomId)) {
      const messageHandler = (message: Message) => {
        this.emitDanmuFromMessage(message, 'realtime');
      };
      conversation.on(Event.MESSAGE, messageHandler);
      this.roomBindings.set(roomId, { conversation, messageHandler });
    }

    await this.ensureEngagementSubscription();

    if (includeHistory && typeof conversation.queryMessages === 'function') {
      const history = await conversation.queryMessages({ limit: 80 });
      if (Array.isArray(history)) {
        for (const message of history.slice().reverse()) {
          this.emitDanmuFromMessage(message, 'history');
        }
      }
    }
  }

  async disconnectRoom(roomId: string): Promise<void> {
    const { Event } = await loadLeancloudRuntime();
    const binding = this.roomBindings.get(roomId);
    if (!binding) {
      return;
    }

    binding.conversation.off(Event.MESSAGE, binding.messageHandler);
    try {
      if (typeof binding.conversation.leave === 'function') {
        await binding.conversation.leave();
      }
    } catch {
      // ignore leave failures
    }
    this.roomBindings.delete(roomId);
  }

  async fetchViewerCount(roomId: string): Promise<number> {
    const binding = this.roomBindings.get(roomId);
    if (!binding || typeof binding.conversation.count !== 'function') {
      return 0;
    }
    const count = await binding.conversation.count();
    return Number.isFinite(count) ? Number(count) : 0;
  }

  async fetchEngagementCounts(input: {
    matchKey: string;
    redCollege: string;
    blueCollege: string;
    reactionIds: string[];
  }): Promise<{ redSupport: number; blueSupport: number; reactions: Record<string, number> }> {
    return this.setEngagementMatch(input);
  }

  async setEngagementMatch(input: {
    matchKey: string;
    redCollege: string;
    blueCollege: string;
    reactionIds: string[];
  }): Promise<{ redSupport: number; blueSupport: number; reactions: Record<string, number> }> {
    const state = this.getOrCreateEngagementState(input.matchKey);
    this.activeMatchKey = input.matchKey;

    this.applyEngagementConfig(state, input);
    this.markStateDirty(state);

    await this.ensureEngagementSubscription();
    if (!state.hydrationRunning && !state.hydrationDone) {
      void this.hydrateEngagementState(state);
    }

    return {
      redSupport: state.redSupport,
      blueSupport: state.blueSupport,
      reactions: { ...state.reactions },
    };
  }

  async updateDanmuFilter(rules: DanmuFilterRules): Promise<void> {
    this.danmuFilterRules = normalizeDanmuFilterRules(rules);
  }

  async sendDanmu(roomId: string, text: string, attrs: DanmuAttributes): Promise<void> {
    const { TextMessage } = await loadLeancloudRuntime();
    const binding = this.roomBindings.get(roomId);
    if (!binding) {
      throw new Error(`Room not connected: ${roomId}`);
    }
    const message = new TextMessage(text);
    message.setAttributes(attrs);
    await binding.conversation.send(message);
  }

  async sendSupport(matchKey: string, collegeName: string): Promise<void> {
    const { TextMessage } = await loadLeancloudRuntime();
    const engagement = await this.getEngagementConversation();
    const message = new TextMessage(MSG_TYPE_SUPPORT_TEAM);
    const attrs: Record<string, unknown> = {
      'rmlive:msg_type': MSG_TYPE_SUPPORT_TEAM,
      'rmlive:msg_for_match': matchKey,
      'rmlive:msg_for_team': encodeTeamTarget(matchKey, collegeName),
    };
    message.setAttributes(attrs);
    const sent = await engagement.send(message);
    this.syncLocalEngagementAfterSend(attrs, sent, 'engagement-send-support');
  }

  async sendReaction(matchKey: string, reactionId: string): Promise<void> {
    const { TextMessage } = await loadLeancloudRuntime();
    const engagement = await this.getEngagementConversation();
    const message = new TextMessage(MSG_TYPE_MATCH_REACTION);
    const attrs: Record<string, unknown> = {
      'rmlive:msg_type': MSG_TYPE_MATCH_REACTION,
      'rmlive:msg_for_match': matchKey,
      'rmlive:reaction_id': reactionId,
    };
    message.setAttributes(attrs);
    const sent = await engagement.send(message);
    this.syncLocalEngagementAfterSend(attrs, sent, 'engagement-send-reaction');
  }

  async dispose(): Promise<void> {
    const { Event } = await loadLeancloudRuntime();
    clearInterval(this.snapshotFlushTimer);

    for (const [roomId] of this.roomBindings) {
      await this.disconnectRoom(roomId);
    }

    if (this.engagementBinding) {
      const { conversation, messageHandler } = this.engagementBinding;
      conversation.off(Event.MESSAGE, messageHandler);
      this.engagementBinding = null;
    }

    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  private async ensureClient(): Promise<IMClient> {
    const existingClient = this.client;
    if (existingClient) {
      return existingClient;
    }

    if (!this.realtime) {
      const { Realtime } = await loadLeancloudRuntime();
      this.realtime = new Realtime({
        appId: this.config.appId,
        appKey: this.config.appKey,
        server: {
          RTMRouter: 'https://router-g0-push.leancloud.cn',
          api: 'https://api.leancloud.cn',
        },
      });
    }

    this.client = await this.realtime.createIMClient(this.config.clientId);
    return this.client as IMClient;
  }

  private async joinConversation(conversationId: string): Promise<Conversation> {
    const client = await this.ensureClient();
    const conversation = await (client as any).getConversation(conversationId, true);
    if (conversation?.join) {
      await conversation.join();
    }
    return conversation as Conversation;
  }

  private async getEngagementConversation(): Promise<Conversation> {
    if (this.engagementBinding) {
      return this.engagementBinding.conversation;
    }

    return this.joinConversation(this.config.engagementChatRoomId);
  }

  private async ensureEngagementSubscription(): Promise<void> {
    if (this.engagementBinding) {
      return;
    }

    const { Event } = await loadLeancloudRuntime();
    const conversation = await this.getEngagementConversation();
    const messageHandler = (message: Message) => {
      const attrs = this.extractAttributes(message);
      const parsed = parseEngagementFromAttributes(
        attrs,
        this.toStableMessageId(message, 'engagement-live'),
        this.toTimestamp((message as any).timestamp),
      );
      if (!parsed) {
        return;
      }

      this.emitEvent({ type: 'engagement', payload: parsed });
      this.applyRealtimeEngagementInbound(parsed);
    };
    conversation.on(Event.MESSAGE, messageHandler);
    this.engagementBinding = { conversation, messageHandler };
  }

  private async hydrateEngagementState(state: EngagementState): Promise<void> {
    if (state.hydrationRunning || state.hydrationDone) {
      return;
    }

    state.hydrationRunning = true;
    this.markStateDirty(state);

    try {
      const engagement = await this.getEngagementConversation();
      const runtimeModule = await loadLeancloudRuntime();
      const { MessageQueryDirection, TextMessage } = runtimeModule as any;

      const cutoffTs = Date.now() - HISTORY_WINDOW_MS;
      let cursorMessageId: string | undefined;
      let cursorTime = Date.now();

      while (true) {
        const page = await engagement.queryMessages({
          startTime: new Date(cursorTime),
          startMessageId: cursorMessageId,
          limit: HISTORY_PAGE_LIMIT,
          direction: MessageQueryDirection.NEW_TO_OLD,
          type: TextMessage.TYPE,
        });

        if (!Array.isArray(page) || page.length === 0) {
          break;
        }

        let reachedWindowBoundary = false;
        for (const message of page) {
          const ts = this.toTimestamp((message as any).timestamp);
          if (ts < cutoffTs) {
            reachedWindowBoundary = true;
            continue;
          }

          const attrs = this.extractAttributes(message);
          const parsed = parseEngagementFromAttributes(
            attrs,
            this.toStableMessageId(message, 'engagement-history'),
            ts,
          );
          if (!parsed || parsed.matchKey !== state.matchKey) {
            continue;
          }

          this.applyEngagementInboundToState(state, parsed);
        }

        this.markStateDirty(state);

        const oldest = page[page.length - 1] as any;
        const nextCursorId = oldest?.id ? String(oldest.id) : '';
        const oldestTs = this.toTimestamp(oldest?.timestamp);
        if (!nextCursorId || oldestTs <= cutoffTs || reachedWindowBoundary || nextCursorId === cursorMessageId) {
          break;
        }

        cursorMessageId = nextCursorId;
        cursorTime = Math.max(0, oldestTs - 1);
      }
    } catch (error) {
      this.emitEvent({
        type: 'runtime-error',
        payload: {
          message: error instanceof Error ? error.message : String(error),
          detail: error,
        },
      });
    } finally {
      state.hydrationRunning = false;
      state.hydrationDone = true;
      this.markStateDirty(state);
    }
  }

  private applyRealtimeEngagementInbound(
    parsed: ReturnType<typeof parseEngagementFromAttributes> extends infer T ? T : never,
  ) {
    if (!parsed) {
      return;
    }

    const state = this.engagementStates.get(parsed.matchKey);
    if (!state) {
      return;
    }

    this.applyEngagementInboundToState(state, parsed);
    this.markStateDirty(state);
  }

  private syncLocalEngagementAfterSend(attrs: Record<string, unknown>, sentMessage: unknown, fallbackPrefix: string) {
    const parsed = parseEngagementFromAttributes(
      attrs,
      this.toStableMessageId(sentMessage, fallbackPrefix),
      this.toTimestamp((sentMessage as any)?.timestamp),
    );
    if (!parsed) {
      return;
    }

    this.applyRealtimeEngagementInbound(parsed);
  }

  private applyEngagementInboundToState(
    state: EngagementState,
    parsed: Exclude<ReturnType<typeof parseEngagementFromAttributes>, null>,
  ) {
    if (state.seenMessageIds.has(parsed.messageId)) {
      return;
    }
    state.seenMessageIds.add(parsed.messageId);

    if (parsed.kind === MSG_TYPE_SUPPORT_TEAM && parsed.collegeName) {
      const redTarget = encodeTeamTarget(state.matchKey, state.redCollege);
      const blueTarget = encodeTeamTarget(state.matchKey, state.blueCollege);
      const currentTarget = encodeTeamTarget(parsed.matchKey, parsed.collegeName);
      if (currentTarget === redTarget) {
        state.redSupport += 1;
      } else if (currentTarget === blueTarget) {
        state.blueSupport += 1;
      }
      return;
    }

    if (parsed.kind === MSG_TYPE_MATCH_REACTION && parsed.reactionId && state.reactionSet.has(parsed.reactionId)) {
      state.reactions[parsed.reactionId] = (state.reactions[parsed.reactionId] ?? 0) + 1;
    }
  }

  private getOrCreateEngagementState(matchKey: string): EngagementState {
    const existing = this.engagementStates.get(matchKey);
    if (existing) {
      return existing;
    }

    const created: EngagementState = {
      matchKey,
      redCollege: '',
      blueCollege: '',
      reactionIds: [],
      reactionSet: new Set<string>(),
      redSupport: 0,
      blueSupport: 0,
      reactions: {},
      seenMessageIds: new Set<string>(),
      hydrationRunning: false,
      hydrationDone: false,
      dirty: true,
      updatedAt: Date.now(),
    };
    this.engagementStates.set(matchKey, created);
    return created;
  }

  private applyEngagementConfig(
    state: EngagementState,
    input: { matchKey: string; redCollege: string; blueCollege: string; reactionIds: string[] },
  ) {
    state.redCollege = String(input.redCollege ?? '').trim();
    state.blueCollege = String(input.blueCollege ?? '').trim();

    const nextReactionIds = Array.from(new Set(input.reactionIds.map((id) => String(id).trim()).filter(Boolean)));
    state.reactionIds = nextReactionIds;
    state.reactionSet = new Set(nextReactionIds);

    const nextReactions: Record<string, number> = {};
    nextReactionIds.forEach((id) => {
      nextReactions[id] = state.reactions[id] ?? 0;
    });
    state.reactions = nextReactions;
  }

  private markStateDirty(state: EngagementState) {
    state.dirty = true;
    state.updatedAt = Date.now();
  }

  private flushDirtySnapshots() {
    for (const state of this.engagementStates.values()) {
      if (!state.dirty) {
        continue;
      }
      if (this.activeMatchKey && state.matchKey !== this.activeMatchKey) {
        continue;
      }

      state.dirty = false;
      this.emitEvent({
        type: 'engagement-snapshot',
        payload: {
          matchKey: state.matchKey,
          status: state.hydrationDone ? 'live' : 'hydrating',
          snapshot: {
            redSupport: state.redSupport,
            blueSupport: state.blueSupport,
            reactions: { ...state.reactions },
          },
          updatedAt: state.updatedAt,
        },
      });
    }
  }

  private emitDanmuFromMessage(message: Message, source: 'realtime' | 'history') {
    const attrs = this.extractAttributes(message);
    const parsed = parseEngagementFromAttributes(
      attrs,
      this.toStableMessageId(message, source),
      this.toTimestamp((message as any).timestamp),
    );
    if (parsed && source === 'realtime') {
      return;
    }

    const text = typeof (message as any).getText === 'function' ? (message as any).getText() : '';
    const rawText = text || String((message as any)?.content?._lctext ?? (message as any)?.content?.text ?? '').trim();
    if (!rawText) {
      return;
    }

    const style = this.normalizeStyle(attrs);
    const danmu: DanmuMessage = {
      id: this.toStableMessageId(message, source),
      timestamp: this.toTimestamp((message as any).timestamp),
      text: rawText,
      username: String(attrs.username ?? '匿名用户'),
      nickname: String(attrs.nickname ?? ''),
      schoolName: String(attrs.schoolName ?? ''),
      badge: String(attrs.badge ?? ''),
      source,
      ...style,
    };

    if (isDanmuMessageBlocked(danmu, this.danmuFilterRules)) {
      return;
    }

    this.emitEvent({ type: 'danmu', payload: danmu });
  }

  private normalizeStyle(attrs: Record<string, unknown>): Pick<DanmuMessage, 'mode' | 'color'> {
    const out: Pick<DanmuMessage, 'mode' | 'color'> = {};
    const rawMode = attrs.mode;
    let n: number | undefined;
    if (typeof rawMode === 'number' && Number.isFinite(rawMode)) {
      n = Math.round(rawMode);
    } else if (typeof rawMode === 'string' && rawMode.trim() !== '') {
      const parsed = Number(rawMode);
      if (Number.isFinite(parsed)) {
        n = Math.round(parsed);
      }
    }
    if (n !== undefined && n >= 0 && n <= 2) {
      out.mode = n as DanmuMode;
    }

    const rawColor = attrs.color;
    if (typeof rawColor === 'string' && rawColor.trim()) {
      out.color = rawColor.trim();
    }

    return out;
  }

  private extractAttributes(message: unknown): Record<string, unknown> {
    const m = message as any;
    return (m?.getAttributes?.() || m?.attributes || m?.content?._lcattrs || m?.content?.attributes || {}) as Record<
      string,
      unknown
    >;
  }

  private toStableMessageId(message: unknown, prefix: string): string {
    const m = message as any;
    const id = m?.id || m?.messageId || m?.timestamp;
    if (id) {
      return String(id);
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private toTimestamp(value: unknown): number {
    const normalizeEpoch = (epoch: number): number => (Math.abs(epoch) < 1_000_000_000_000 ? epoch * 1000 : epoch);

    if (typeof value === 'number' && Number.isFinite(value)) {
      return normalizeEpoch(value);
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    if (typeof value === 'string' && value.trim()) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        return normalizeEpoch(numeric);
      }
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return Date.now();
  }
}

function emitResponse(response: WorkerResponse) {
  const message: WorkerMessage = { channel: 'response', data: response };
  self.postMessage(message);
}

function emitEvent(event: WorkerEvent) {
  const message: WorkerMessage = { channel: 'event', data: event };
  self.postMessage(message);
}

function toErrorPayload(error: unknown): { message: string; code?: string } {
  if (error && typeof error === 'object') {
    const e = error as { message?: string; code?: string };
    return {
      message: String(e.message ?? 'Unknown worker error'),
      code: typeof e.code === 'string' ? e.code : undefined,
    };
  }
  return { message: String(error ?? 'Unknown worker error') };
}

function assertRuntime(): ImRuntime {
  if (!runtime) {
    throw new Error('IM runtime is not initialized');
  }
  return runtime;
}

workerScope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    let payload: unknown = null;

    switch (request.type) {
      case 'init': {
        runtime = new ImRuntime(request.payload, emitEvent);
        payload = true;
        break;
      }
      case 'connect-room': {
        await assertRuntime().connectRoom(request.payload.roomId, request.payload.includeHistory);
        payload = true;
        break;
      }
      case 'disconnect-room': {
        await assertRuntime().disconnectRoom(request.payload.roomId);
        payload = true;
        break;
      }
      case 'fetch-viewer-count': {
        payload = await assertRuntime().fetchViewerCount(request.payload.roomId);
        break;
      }
      case 'fetch-engagement-counts': {
        payload = await assertRuntime().fetchEngagementCounts(request.payload);
        break;
      }
      case 'set-engagement-match': {
        payload = await assertRuntime().setEngagementMatch(request.payload);
        break;
      }
      case 'update-danmu-filter': {
        await assertRuntime().updateDanmuFilter(request.payload.rules);
        payload = true;
        break;
      }
      case 'send-danmu': {
        await assertRuntime().sendDanmu(request.payload.roomId, request.payload.text, request.payload.attrs);
        payload = true;
        break;
      }
      case 'send-support': {
        await assertRuntime().sendSupport(request.payload.matchKey, request.payload.collegeName);
        payload = true;
        break;
      }
      case 'send-reaction': {
        await assertRuntime().sendReaction(request.payload.matchKey, request.payload.reactionId);
        payload = true;
        break;
      }
      case 'dispose': {
        await assertRuntime().dispose();
        runtime = null;
        payload = true;
        break;
      }
      default:
        throw new Error('Unknown worker request');
    }

    emitResponse({ id: request.id, ok: true, payload });
  } catch (error) {
    const payload = toErrorPayload(error);
    emitResponse({ id: request.id, ok: false, error: payload });
    emitEvent({ type: 'runtime-error', payload });
  }
};
