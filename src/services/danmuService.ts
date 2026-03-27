import { useLocalStorage } from '@vueuse/core';
import { v4 as uuid } from 'uuid';
import type { DanmuAttributes, DanmuMessage } from '../types/api';
import { fetchJson } from './http';
import { buildLiveJsonUrl } from './urlProxy';

const APP_ID = import.meta.env.VITE_CHATROOM_APP_ID as string;
const APP_KEY = import.meta.env.VITE_CHATROOM_APP_KEY as string;
const CHATROOM_HISTORY_URL = '/live_json/chatroom.json';
const GLOBAL_REALTIME_KEY = '__rmLiveLeancloudRealtime';
const GLOBAL_IMCLIENT_KEY = '__rmLiveLeancloudImClient';

let sharedRealtime: any = null;
let sharedRealtimeInitPromise: Promise<any> | null = null;
let sharedImClient: any = null;
let sharedImClientInitPromise: Promise<any> | null = null;

const runtimeGlobal = globalThis as typeof globalThis & Record<string, unknown>;

if (runtimeGlobal[GLOBAL_REALTIME_KEY]) {
  sharedRealtime = runtimeGlobal[GLOBAL_REALTIME_KEY];
}

if (runtimeGlobal[GLOBAL_IMCLIENT_KEY]) {
  sharedImClient = runtimeGlobal[GLOBAL_IMCLIENT_KEY];
}

async function getSharedRealtime(): Promise<any> {
  if (sharedRealtime) {
    return sharedRealtime;
  }

  if (!sharedRealtimeInitPromise) {
    sharedRealtimeInitPromise = (async () => {
      const { Realtime } = await import('leancloud-realtime');
      const instance = new Realtime({
        appId: APP_ID,
        appKey: APP_KEY,
        server: {
          RTMRouter: 'https://router-g0-push.leancloud.cn',
          api: 'https://api.leancloud.cn',
        },
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

interface DanmuServiceHandlers {
  onMessage?: (msg: DanmuMessage) => void;
  onError?: (error: unknown) => void;
  includeHistory?: boolean;
}

export class DanmuService {
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

  async connect(chatRoomId: string): Promise<void> {
    if (!APP_ID || !APP_KEY || !chatRoomId) {
      throw new Error('Missing Leancloud credentials or chatRoomId');
    }

    try {
      await this.disconnect();

      const { Realtime, TextMessage } = await import('leancloud-realtime');
      void Realtime;

      const imClient = await getSharedImClient();

      this.conversationInstance = await (imClient as any).getConversation(chatRoomId, true);

      // 关键：加入会话，不加入可能收不到下行消息。
      if (this.conversationInstance?.join) {
        await this.conversationInstance.join();
      } else {
        console.warn('[Danmu] Conversation has no join method');
      }

      if (this.handlers.includeHistory) {
        await this.loadHistoryFromConversation(this.conversationInstance);
        await this.loadHistoryFromChatroomApi(chatRoomId);
      }

      this.messageHandler = (message: any) => {
        this.handleRawMessage(message, TextMessage, 'realtime');
      };

      // LeanCloud 推荐事件常量监听
      const EventConst = (await import('leancloud-realtime')).Event;
      if (EventConst?.MESSAGE) {
        this.eventConstMessageName = String(EventConst.MESSAGE);
        this.conversationInstance.on(this.eventConstMessageName, this.messageHandler);
      }

      // 兼容兜底
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

  private handleRawMessage(message: any, TextMessage: any, source: 'realtime' | 'history'): void {
    if (message instanceof TextMessage) {
      const attrs = message.getAttributes?.() || {};
      const text = message.getText?.() || '';

      const danmu: DanmuMessage = {
        id: this.toDanmuId(message, source),
        timestamp: this.toTimestamp((message as any).timestamp),
        text: text,
        username: attrs.username || '匿名用户',
        nickname: attrs.nickname || '',
        schoolName: attrs.schoolName || '',
        badge: attrs.badge || '',
        source,
      };
      this.emitDanmu(danmu);
      return;
    }

    // 兼容参考页面里的消息结构：content._lctext / content._lcattrs
    const content = message?.content;
    const rawText = content?._lctext ?? content?.text ?? '';
    const rawAttrs = content?._lcattrs ?? message?.attributes ?? {};

    if (rawText) {
      const danmu: DanmuMessage = {
        id: this.toDanmuId(message, source),
        timestamp: this.toTimestamp(message?.timestamp ?? rawAttrs.sendTime),
        text: String(rawText),
        username: String(rawAttrs.username || '匿名用户'),
        nickname: String(rawAttrs.nickname || ''),
        schoolName: String(rawAttrs.schoolName || ''),
        badge: String(rawAttrs.badge || ''),
        source,
      };
      this.emitDanmu(danmu);
    }
  }

  private toTimestamp(value: unknown): number {
    const normalizeEpoch = (epoch: number): number => {
      // Some upstream fields are in seconds; normalize to milliseconds for consistent ordering/display.
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

        return {
          id,
          timestamp,
          text: String(text),
          username: String(attrs.username ?? nestedAttrs.username ?? rec.username ?? '匿名用户'),
          nickname: String(attrs.nickname ?? nestedAttrs.nickname ?? rec.nickname ?? ''),
          schoolName: String(attrs.schoolName ?? nestedAttrs.schoolName ?? rec.schoolName ?? ''),
          badge: String(attrs.badge ?? nestedAttrs.badge ?? rec.badge ?? ''),
          source: 'history',
        } as DanmuMessage;
      })
      .filter((v): v is DanmuMessage => !!v);
  }

  private async loadHistoryFromChatroomApi(chatRoomId: string): Promise<void> {
    try {
      const url = buildLiveJsonUrl(CHATROOM_HISTORY_URL);
      const raw = await fetchJson<unknown>(url, {
        timeoutMs: 9000,
        retries: 1,
        retryDelayMs: 400,
      });

      const normalized = this.normalizeChatroomHistory(raw, chatRoomId);

      normalized.slice(-100).forEach((msg) => this.emitDanmu(msg));
    } catch (error) {
      console.warn('[Danmu] Failed to load chatroom.json history:', error);
    }
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

      this.emitDanmu({
        id: uuid(),
        timestamp: Date.now(),
        text,
        username: attrs.username,
        nickname: attrs.nickname,
        schoolName: attrs.schoolName,
        badge: attrs.badge,
        source: 'realtime',
      });
    } catch (error) {
      this.handlers.onError?.(error);
      throw error;
    }
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
