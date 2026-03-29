import { useLocalStorage } from '@vueuse/core';
import { v4 as uuid } from 'uuid';
import type {
  EngagementInbound,
} from '../leancloud/rmliveIm';
import {
  encodeTeamTarget,
  MSG_TYPE_MATCH_REACTION,
  MSG_TYPE_SUPPORT_TEAM,
  parseEngagementFromAttributes,
  RMLIVE_MSG_FOR_MATCH,
  RMLIVE_MSG_FOR_TEAM,
  RMLIVE_MSG_TYPE,
  RMLIVE_REACTION_ID,
} from '../leancloud/rmliveIm';
import type { DanmuAttributes, DanmuMessage, DanmuMode } from '../types/api';

/**
 * Danmu + match engagement (ImageMessage attributes). Red/blue and reaction counts are aggregated only
 * from LeanCloud messages (history + live); no fabricated totals. `ConversationQuery#compact(true)` applies
 * when opening the chat room (see resolveChatRoomInstance); `queryMessages` uses startTime/endTime only.
 */

const APP_ID = import.meta.env.VITE_CHATROOM_APP_ID as string;
const APP_KEY = import.meta.env.VITE_CHATROOM_APP_KEY as string;
/** Bumped so cached Realtime is recreated with typed-messages plugin. */
const GLOBAL_REALTIME_KEY = '__rmLiveLeancloudRealtime_v2';
const GLOBAL_IMCLIENT_KEY = '__rmLiveLeancloudImClient_v2';

const ENGAGEMENT_PLACEHOLDER_URL =
  (import.meta.env.VITE_ENGAGEMENT_IMAGE_URL as string | undefined) ||
  'https://cdn.jsdelivr.net/gh/mathiasbynens/small/pixel.gif';

const DEFAULT_ENGAGEMENT_QUERY_LIMIT = 200;
const DEFAULT_ENGAGEMENT_WINDOW_MINUTES = 30;

function parseEngagementQueryLimit(override?: number): number {
  if (override !== undefined) {
    if (!Number.isFinite(override)) {
      return DEFAULT_ENGAGEMENT_QUERY_LIMIT;
    }
    return Math.min(1000, Math.max(1, Math.floor(override)));
  }
  const raw = import.meta.env.VITE_ENGAGEMENT_QUERY_LIMIT;
  const n = raw !== undefined && String(raw).trim() !== '' ? Number(raw) : DEFAULT_ENGAGEMENT_QUERY_LIMIT;
  if (!Number.isFinite(n)) {
    return DEFAULT_ENGAGEMENT_QUERY_LIMIT;
  }
  return Math.min(1000, Math.max(1, Math.floor(n)));
}

function parseEngagementWindowMinutes(): number {
  const raw = import.meta.env.VITE_ENGAGEMENT_QUERY_WINDOW_MINUTES;
  const n =
    raw !== undefined && String(raw).trim() !== '' ? Number(raw) : DEFAULT_ENGAGEMENT_WINDOW_MINUTES;
  if (!Number.isFinite(n)) {
    return DEFAULT_ENGAGEMENT_WINDOW_MINUTES;
  }
  return Math.min(10080, Math.max(1, Math.floor(n)));
}

let sharedRealtime: any = null;
let sharedRealtimeInitPromise: Promise<any> | null = null;
let sharedImClient: any = null;
let sharedImClientInitPromise: Promise<any> | null = null;

/** Set after typed-messages plugin is applied; used for instanceof and ImageMessage.TYPE. */
let lcImageMessageCtor: any = null;

let lcTypedBundlePromise: Promise<{ TypedMessagesPlugin: any; ImageMessage: any }> | null = null;

const runtimeGlobal = globalThis as typeof globalThis & Record<string, unknown>;

if (runtimeGlobal[GLOBAL_REALTIME_KEY]) {
  sharedRealtime = runtimeGlobal[GLOBAL_REALTIME_KEY];
}

if (runtimeGlobal[GLOBAL_IMCLIENT_KEY]) {
  sharedImClient = runtimeGlobal[GLOBAL_IMCLIENT_KEY];
}

async function loadTypedMessagesBundle(): Promise<{ TypedMessagesPlugin: any; ImageMessage: any }> {
  if (!lcTypedBundlePromise) {
    lcTypedBundlePromise = (async () => {
      const AV = (await import('leancloud-storage')).default;
      const LC = await import('leancloud-realtime');
      const initTypedMessages = (await import('leancloud-realtime-plugin-typed-messages')).default as (
        av: typeof AV,
        im: typeof LC,
      ) => { TypedMessagesPlugin: any; ImageMessage: any };
      return initTypedMessages(AV, LC);
    })();
  }
  return lcTypedBundlePromise;
}

let engagementFileId: string | null = null;

async function getOrCreateEngagementFile(): Promise<any> {
  const AV = (await import('leancloud-storage')).default;
  await getSharedRealtime();
  if (engagementFileId) {
    return AV.File.createWithoutData(engagementFileId);
  }
  const file = AV.File.withURL('rmlive-engagement', ENGAGEMENT_PLACEHOLDER_URL);
  await file.save();
  engagementFileId = file.id ?? null;
  if (!engagementFileId) {
    throw new Error('LeanCloud File.save did not return id');
  }
  return file;
}

async function getSharedRealtime(): Promise<any> {
  if (sharedRealtime) {
    return sharedRealtime;
  }

  if (!sharedRealtimeInitPromise) {
    sharedRealtimeInitPromise = (async () => {
      const { TypedMessagesPlugin, ImageMessage } = await loadTypedMessagesBundle();
      lcImageMessageCtor = ImageMessage;

      const LC = await import('leancloud-realtime');
      const AV = (await import('leancloud-storage')).default;

      const instance = new LC.Realtime({
        appId: APP_ID,
        appKey: APP_KEY,
        server: {
          RTMRouter: 'https://router-g0-push.leancloud.cn',
          api: 'https://api.leancloud.cn',
        },
        plugins: [TypedMessagesPlugin],
      });

      AV.init({
        appId: APP_ID,
        appKey: APP_KEY,
        serverURLs: {
          api: 'https://api.leancloud.cn',
        },
        realtime: instance,
      });

      sharedRealtime = instance;
      runtimeGlobal[GLOBAL_REALTIME_KEY] = instance;
      return instance;
    })().catch((error) => {
      sharedRealtimeInitPromise = null;
      throw error;
    });
  }

  return sharedRealtimeInitPromise;
}

async function getSharedImClient(): Promise<any> {
  if (sharedImClient) {
    return sharedImClient;
  }

  if (!sharedImClientInitPromise) {
    const clientId = useLocalStorage('im-client-id', uuid(), { serializer: { read: String, write: String } });

    sharedImClientInitPromise = (async () => {
      const realtime = await getSharedRealtime();
      const imClient = await realtime.createIMClient(clientId.value);
      sharedImClient = imClient;
      runtimeGlobal[GLOBAL_IMCLIENT_KEY] = imClient;
      return imClient;
    })().catch((error) => {
      sharedImClientInitPromise = null;
      throw error;
    });
  }

  return sharedImClientInitPromise;
}

function normalizeDanmuStyleFromAttrs(attrs: Record<string, unknown>): Pick<DanmuMessage, 'mode' | 'color'> {
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

/** Narrow surface used by match engagement (avoids class private-field assignability issues). */
export interface IMatchEngagementGateway {
  /** Uses VITE_ENGAGEMENT_QUERY_LIMIT and time window unless `limitOverride` is set (e.g. tests). */
  fetchEngagementHistory(limitOverride?: number): Promise<EngagementInbound[]>;
  sendSupportTeam(matchKey: string, collegeName: string): Promise<void>;
  sendMatchReaction(matchKey: string, reactionId: string): Promise<void>;
}

export interface DanmuServiceHandlers {
  onMessage?: (msg: DanmuMessage) => void;
  onError?: (error: unknown) => void;
  includeHistory?: boolean;
  onEngagementMessage?: (msg: EngagementInbound) => void;
  onEngagementHydrate?: (msgs: EngagementInbound[]) => void;
}

export class DanmuService implements IMatchEngagementGateway {
  private handlers: DanmuServiceHandlers = {};
  private seenIds = new Set<string>();
  private conversationInstance: any = null;
  private messageHandler: ((message: any) => void) | null = null;
  private errorHandler: ((error: unknown) => void) | null = null;
  private eventConstMessageName: string | null = null;
  private disconnecting = false;

  constructor(handlers?: DanmuServiceHandlers) {
    this.handlers = handlers || {};
  }

  private async resolveChatRoomInstance(imClient: any, chatRoomId: string): Promise<any> {
    try {
      const room = await imClient
        .getChatRoomQuery()
        .equalTo('objectId', chatRoomId)
        .compact(true)
        .limit(1)
        .first();
      if (room) {
        return room;
      }
    } catch (e) {
      console.warn('[Danmu] getChatRoomQuery().compact(true) failed, fallback getConversation:', e);
    }
    return (imClient as any).getConversation(chatRoomId, true);
  }

  async connect(chatRoomId: string): Promise<void> {
    if (!APP_ID || !APP_KEY || !chatRoomId) {
      throw new Error('Missing Leancloud credentials or chatRoomId');
    }

    try {
      await this.disconnect();

      const { TextMessage } = await import('leancloud-realtime');

      const imClient = await getSharedImClient();

      this.conversationInstance = await this.resolveChatRoomInstance(imClient, chatRoomId);

      if (this.conversationInstance?.join) {
        await this.conversationInstance.join();
      } else {
        console.warn('[Danmu] Conversation has no join method');
      }

      if (this.handlers.includeHistory) {
        await this.loadHistoryFromConversation(this.conversationInstance);
      }

      this.messageHandler = (message: any) => {
        this.handleRawMessage(message, TextMessage, 'realtime');
      };

      const EventConst = (await import('leancloud-realtime')).Event;
      if (EventConst?.MESSAGE) {
        this.eventConstMessageName = String(EventConst.MESSAGE);
        this.conversationInstance.on(this.eventConstMessageName, this.messageHandler);
      }

      this.conversationInstance.on('message', this.messageHandler);

      this.errorHandler = (error: unknown) => {
        console.error('[Danmu] Conversation error:', error);
        this.handlers.onError?.(error);
      };
      this.conversationInstance.on('error', this.errorHandler);
    } catch (error) {
      console.error('[Danmu] Connect failed:', error);
      await this.disconnect();
      this.handlers.onError?.(error);
      throw error;
    }
  }

  private toDanmuId(message: any, fallbackPrefix: string): string {
    const mid = message?.id || message?.messageId || message?.timestamp;
    if (mid) {
      return String(mid);
    }
    return `${fallbackPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private emitDanmu(danmu: DanmuMessage): void {
    if (this.seenIds.has(danmu.id)) {
      return;
    }
    this.seenIds.add(danmu.id);
    this.handlers.onMessage?.(danmu);
  }

  private tryConsumeEngagementImage(message: any, source: 'realtime' | 'history'): boolean {
    if (!lcImageMessageCtor || !(message instanceof lcImageMessageCtor)) {
      return false;
    }
    const attrs = (message.getAttributes?.() || {}) as Record<string, unknown>;
    const mid = String(message.id ?? message.messageId ?? this.toDanmuId(message, source));
    const ts = this.toTimestamp((message as any).timestamp);
    const parsed = parseEngagementFromAttributes(attrs, mid, ts);
    if (!parsed) {
      return false;
    }
    if (source === 'realtime') {
      this.handlers.onEngagementMessage?.(parsed);
    }
    return true;
  }

  private handleRawMessage(message: any, TextMessage: any, source: 'realtime' | 'history'): void {
    if (this.tryConsumeEngagementImage(message, source)) {
      return;
    }

    if (message instanceof TextMessage) {
      const attrs = message.getAttributes?.() || {};
      const attrsRec = attrs as Record<string, unknown>;
      const text = message.getText?.() || '';
      const style = normalizeDanmuStyleFromAttrs(attrsRec);

      const danmu: DanmuMessage = {
        id: this.toDanmuId(message, source),
        timestamp: this.toTimestamp((message as any).timestamp),
        text: text,
        username: String(attrsRec.username ?? '匿名用户'),
        nickname: String(attrsRec.nickname ?? ''),
        schoolName: String(attrsRec.schoolName ?? ''),
        badge: String(attrsRec.badge ?? ''),
        source,
        ...style,
      };
      this.emitDanmu(danmu);
      return;
    }

    const content = message?.content;
    const rawText = content?._lctext ?? content?.text ?? '';
    const rawAttrs = (content?._lcattrs ?? message?.attributes ?? {}) as Record<string, unknown>;

    if (rawText) {
      const style = normalizeDanmuStyleFromAttrs(rawAttrs);
      const danmu: DanmuMessage = {
        id: this.toDanmuId(message, source),
        timestamp: this.toTimestamp(message?.timestamp ?? rawAttrs.sendTime),
        text: String(rawText),
        username: String(rawAttrs.username || '匿名用户'),
        nickname: String(rawAttrs.nickname || ''),
        schoolName: String(rawAttrs.schoolName || ''),
        badge: String(rawAttrs.badge || ''),
        source,
        ...style,
      };
      this.emitDanmu(danmu);
    }
  }

  private toTimestamp(value: unknown): number {
    const normalizeEpoch = (epoch: number): number => {
      return Math.abs(epoch) < 1_000_000_000_000 ? epoch * 1000 : epoch;
    };

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

  /**
   * Pull ImageMessage logs in a recent time window and map to engagement payloads.
   * Limits come from env (unless `limitOverride`); no server-side totals — client sums messages.
   */
  async fetchEngagementHistory(limitOverride?: number): Promise<EngagementInbound[]> {
    if (!this.conversationInstance?.queryMessages || !lcImageMessageCtor) {
      return [];
    }
    try {
      const { MessageQueryDirection } = await import('leancloud-realtime');
      const limit = parseEngagementQueryLimit(limitOverride);
      const windowMs = parseEngagementWindowMinutes() * 60 * 1000;
      const startTime = new Date(Date.now() - windowMs);
      const endTime = new Date();
      const list = await this.conversationInstance.queryMessages({
        startTime,
        endTime,
        limit,
        type: lcImageMessageCtor.TYPE,
        direction: MessageQueryDirection.OLD_TO_NEW,
      });
      if (!Array.isArray(list)) {
        return [];
      }
      const out: EngagementInbound[] = [];
      for (const m of list) {
        if (!(m instanceof lcImageMessageCtor)) {
          continue;
        }
        const attrs = (m.getAttributes?.() || {}) as Record<string, unknown>;
        const mid = String(m.id ?? '');
        const parsed = parseEngagementFromAttributes(attrs, mid, this.toTimestamp((m as any).timestamp));
        if (parsed) {
          out.push(parsed);
        }
      }
      return out;
    } catch (error) {
      console.warn('[Danmu] fetchEngagementHistory failed:', error);
      return [];
    }
  }

  private async loadHistoryFromConversation(conversation: any): Promise<void> {
    if (!conversation?.queryMessages) {
      return;
    }

    try {
      const { TextMessage } = await import('leancloud-realtime');
      const history = await conversation.queryMessages({ limit: 80 });

      if (Array.isArray(history) && history.length > 0) {
        history
          .slice()
          .reverse()
          .forEach((message: any) => this.handleRawMessage(message, TextMessage, 'history'));
      }

      const engagement = await this.fetchEngagementHistory();
      this.handlers.onEngagementHydrate?.(engagement);
    } catch (error) {
      console.warn('[Danmu] Failed to fetch LeanCloud history:', error);
    }
  }

  private normalizeChatroomHistory(raw: unknown, chatRoomId: string): DanmuMessage[] {
    const toRecord = (v: unknown): Record<string, unknown> | null => {
      return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
    };

    const possibleLists: unknown[] = [];
    if (Array.isArray(raw)) {
      possibleLists.push(raw);
    }

    const root = toRecord(raw);
    if (root) {
      const candidates = [
        root.data,
        root.list,
        root.items,
        root.messages,
        root.chatData,
        root.result,
        root.records,
        root.entries,
        root.chats,
        root.content,
        toRecord(root.data)?.messages,
        toRecord(root.data)?.list,
        toRecord(root.data)?.items,
        toRecord(root.data)?.chatData,
        toRecord(root.data)?.records,
        toRecord(root.data)?.entries,
        toRecord(root.data)?.chats,
      ];
      candidates.forEach((c) => {
        if (Array.isArray(c)) {
          possibleLists.push(c);
        }
      });

      if (Array.isArray(root.rooms)) {
        const room = root.rooms.find((r) => {
          const rr = toRecord(r);
          return rr && String(rr.chatRoomId ?? rr.roomId ?? rr.id ?? '') === chatRoomId;
        });
        const roomRecord = toRecord(room);
        if (roomRecord) {
          const roomCandidates = [
            roomRecord.messages,
            roomRecord.list,
            roomRecord.items,
            roomRecord.chatData,
            roomRecord.records,
            roomRecord.entries,
            roomRecord.chats,
            toRecord(roomRecord.data)?.messages,
            toRecord(roomRecord.data)?.list,
            toRecord(roomRecord.data)?.items,
            toRecord(roomRecord.data)?.chatData,
          ];
          roomCandidates.forEach((c) => {
            if (Array.isArray(c)) {
              possibleLists.push(c);
            }
          });
        }
      }
    }

    const picked = possibleLists.find((list) => {
      return (
        Array.isArray(list) &&
        list.some((it) => {
          const rec = toRecord(it);
          if (!rec) {
            return false;
          }

          if (rec.text || rec._lctext || rec.content || rec.msg) {
            return true;
          }

          const nested = toRecord(rec.content);
          return !!(nested && (nested._lctext || nested.text));
        })
      );
    });

    if (!picked || !Array.isArray(picked)) {
      return [];
    }

    return picked
      .map((item, idx) => {
        const rec = toRecord(item);
        if (!rec) {
          return null;
        }
        const attrs = toRecord(rec._lcattrs) ?? toRecord(rec.attributes) ?? {};
        const nestedContent = toRecord(rec.content);
        const nestedAttrs = toRecord(nestedContent?._lcattrs) ?? {};
        const text = rec.text ?? rec._lctext ?? rec.msg ?? nestedContent?._lctext ?? nestedContent?.text ?? rec.content;
        if (!text) {
          return null;
        }

        const id = String(rec.id ?? rec.messageId ?? rec.msgId ?? `api-${chatRoomId}-${idx}`);
        const timestampValue = rec.timestamp ?? rec.sendTime ?? attrs.sendTime ?? nestedAttrs.sendTime;
        const timestamp = this.toTimestamp(timestampValue);
        const style = normalizeDanmuStyleFromAttrs({ ...nestedAttrs, ...attrs });

        return {
          id,
          timestamp,
          text: String(text),
          username: String(attrs.username ?? nestedAttrs.username ?? rec.username ?? '匿名用户'),
          nickname: String(attrs.nickname ?? nestedAttrs.nickname ?? rec.nickname ?? ''),
          schoolName: String(attrs.schoolName ?? nestedAttrs.schoolName ?? rec.schoolName ?? ''),
          badge: String(attrs.badge ?? nestedAttrs.badge ?? rec.badge ?? ''),
          source: 'history',
          ...style,
        } as DanmuMessage;
      })
      .filter((v): v is DanmuMessage => !!v);
  }

  async sendMessage(text: string, attrs: DanmuAttributes): Promise<void> {
    if (!this.conversationInstance) {
      throw new Error('Danmu service not connected');
    }

    try {
      const { TextMessage } = await import('leancloud-realtime');
      const message = new TextMessage(text);
      message.setAttributes(attrs);
      await this.conversationInstance.send(message);

      const style = normalizeDanmuStyleFromAttrs({
        mode: attrs.mode as unknown,
        color: attrs.color as unknown,
      });
      this.emitDanmu({
        id: uuid(),
        timestamp: Date.now(),
        text,
        username: attrs.username,
        nickname: attrs.nickname,
        schoolName: attrs.schoolName,
        badge: attrs.badge,
        source: 'realtime',
        ...style,
      });
    } catch (error) {
      this.handlers.onError?.(error);
      throw error;
    }
  }

  /** ImageMessage attrs: support_team + rmlive:msg_for_team (matchKey + TEAM_PAYLOAD_SEP + college). */
  async sendSupportTeam(matchKey: string, collegeName: string): Promise<void> {
    if (!this.conversationInstance) {
      throw new Error('Danmu service not connected');
    }
    if (!lcImageMessageCtor) {
      throw new Error('ImageMessage not ready');
    }
    const file = await getOrCreateEngagementFile();
    const message = new lcImageMessageCtor(file);
    message.setAttributes({
      [RMLIVE_MSG_TYPE]: MSG_TYPE_SUPPORT_TEAM,
      [RMLIVE_MSG_FOR_TEAM]: encodeTeamTarget(matchKey, collegeName),
    });
    await this.conversationInstance.send(message);
  }

  /** ImageMessage attrs: match_reaction + rmlive:msg_for_match (matchKey) + rmlive:reaction_id. */
  async sendMatchReaction(matchKey: string, reactionId: string): Promise<void> {
    if (!this.conversationInstance) {
      throw new Error('Danmu service not connected');
    }
    if (!lcImageMessageCtor) {
      throw new Error('ImageMessage not ready');
    }
    const file = await getOrCreateEngagementFile();
    const message = new lcImageMessageCtor(file);
    message.setAttributes({
      [RMLIVE_MSG_TYPE]: MSG_TYPE_MATCH_REACTION,
      [RMLIVE_MSG_FOR_MATCH]: matchKey,
      [RMLIVE_REACTION_ID]: reactionId,
    });
    await this.conversationInstance.send(message);
  }

  async disconnect(): Promise<void> {
    if (this.disconnecting) {
      return;
    }

    this.disconnecting = true;
    this.seenIds.clear();

    try {
      if (this.conversationInstance) {
        if (typeof this.conversationInstance.off === 'function') {
          if (this.messageHandler) {
            this.conversationInstance.off('message', this.messageHandler);
            if (this.eventConstMessageName) {
              this.conversationInstance.off(this.eventConstMessageName, this.messageHandler);
            }
          }
          if (this.errorHandler) {
            this.conversationInstance.off('error', this.errorHandler);
          }
        }

        try {
          if (typeof this.conversationInstance.leave === 'function') {
            await this.conversationInstance.leave();
          }
        } catch (error) {
          console.warn('[Danmu] conversation.leave failed, ignore:', error);
        }
        this.conversationInstance = null;
      }
      this.messageHandler = null;
      this.errorHandler = null;
      this.eventConstMessageName = null;
    } finally {
      this.disconnecting = false;
    }
  }
}
