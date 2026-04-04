import type { DanmuAttributes, DanmuFilterRules } from '@/types/api';
import { useLocalStorage } from '@vueuse/core';
import { v4 as uuid } from 'uuid';
import { ImWorkerClient } from './im/ImWorkerClient';
import type { DanmuServiceHandlers, IDanmuFilterGateway, IMatchEngagementGateway } from './im/types';

const APP_ID = import.meta.env.VITE_CHATROOM_APP_ID as string;
const APP_KEY = import.meta.env.VITE_CHATROOM_APP_KEY as string;
const ENGAGEMENT_CHATROOM_ID = import.meta.env.VITE_ENGAGEMENT_CHATROOM_ID as string;

export class DanmuService implements IMatchEngagementGateway, IDanmuFilterGateway {
  private handlers: DanmuServiceHandlers;
  private workerClient: ImWorkerClient;
  private currentRoomId: string | null = null;
  private unsubscribeDanmu: (() => void) | null = null;
  private unsubscribeEngagement: (() => void) | null = null;
  private unsubscribeEngagementSnapshot: (() => void) | null = null;
  private unsubscribeError: (() => void) | null = null;
  private disconnecting = false;

  constructor(handlers?: DanmuServiceHandlers) {
    this.handlers = handlers || {};

    const clientId = useLocalStorage('im-client-id', uuid(), { serializer: { read: String, write: String } });
    this.workerClient = new ImWorkerClient({
      appId: APP_ID,
      appKey: APP_KEY,
      clientId: clientId.value,
      engagementChatRoomId: ENGAGEMENT_CHATROOM_ID,
    });

    this.unsubscribeDanmu = this.workerClient.onDanmu((msg) => {
      this.handlers.onMessage?.(msg);
    });
    this.unsubscribeEngagement = this.workerClient.onEngagement((msg) => {
      this.handlers.onEngagementMessage?.(msg);
    });
    this.unsubscribeEngagementSnapshot = this.workerClient.onEngagementSnapshot((payload) => {
      this.handlers.onEngagementSnapshot?.(payload);
    });
    this.unsubscribeError = this.workerClient.onError((error) => {
      this.handlers.onError?.(error);
    });
  }

  async connect(chatRoomId: string): Promise<void> {
    if (!APP_ID || !APP_KEY || !chatRoomId) {
      throw new Error('Missing Leancloud credentials or chatRoomId');
    }

    if (this.currentRoomId && this.currentRoomId !== chatRoomId) {
      await this.workerClient.disconnectRoom(this.currentRoomId);
    }

    await this.workerClient.connectRoom(chatRoomId, this.handlers.includeHistory === true);
    this.currentRoomId = chatRoomId;
  }

  async fetchChatRoomCount(): Promise<number> {
    if (!this.currentRoomId) {
      return 0;
    }
    return this.workerClient.fetchViewerCount(this.currentRoomId);
  }

  async fetchEngagementCounts(input: {
    matchKey: string;
    redCollege: string;
    blueCollege: string;
    reactionIds: string[];
  }): Promise<{
    redSupport: number;
    blueSupport: number;
    reactions: Record<string, number>;
  }> {
    return this.workerClient.fetchEngagementCounts(input);
  }

  async sendMessage(text: string, attrs: DanmuAttributes): Promise<void> {
    if (!this.currentRoomId) {
      throw new Error('Danmu service not connected');
    }
    const roomId = this.currentRoomId;
    try {
      await this.workerClient.sendDanmu(roomId, text, attrs);
    } catch (error) {
      if (!this.isInvalidMessagingTarget(error)) {
        throw error;
      }

      // LeanCloud may occasionally reject stale room targets after reconnects.
      // Rejoin once and retry to avoid user-visible transient failures.
      try {
        await this.workerClient.disconnectRoom(roomId);
      } catch {
        // Best-effort cleanup before reconnect.
      }

      await this.workerClient.connectRoom(roomId, false);
      await this.workerClient.sendDanmu(roomId, text, attrs);
    }
  }

  async sendSupportTeam(matchKey: string, collegeName: string): Promise<void> {
    await this.workerClient.sendSupport(matchKey, collegeName);
  }

  async sendMatchReaction(matchKey: string, reactionId: string): Promise<void> {
    await this.workerClient.sendReaction(matchKey, reactionId);
  }

  async setEngagementMatch(input: {
    matchKey: string;
    redCollege: string;
    blueCollege: string;
    reactionIds: string[];
  }): Promise<{
    redSupport: number;
    blueSupport: number;
    reactions: Record<string, number>;
  }> {
    return this.workerClient.setEngagementMatch(input);
  }

  async updateDanmuFilterRules(rules: DanmuFilterRules): Promise<void> {
    await this.workerClient.updateDanmuFilterRules(rules);
  }

  async disconnect(): Promise<void> {
    if (this.disconnecting) {
      return;
    }

    this.disconnecting = true;
    try {
      if (this.currentRoomId) {
        await this.workerClient.disconnectRoom(this.currentRoomId);
        this.currentRoomId = null;
      }
      await this.workerClient.dispose();

      this.unsubscribeDanmu?.();
      this.unsubscribeDanmu = null;
      this.unsubscribeEngagement?.();
      this.unsubscribeEngagement = null;
      this.unsubscribeEngagementSnapshot?.();
      this.unsubscribeEngagementSnapshot = null;
      this.unsubscribeError?.();
      this.unsubscribeError = null;
    } finally {
      this.disconnecting = false;
    }
  }

  private isInvalidMessagingTarget(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const message = String((error as { message?: unknown }).message ?? '');
    const code = String((error as { code?: unknown }).code ?? '');
    return code === 'INVALID_MESSAGING_TARGET' || message.includes('INVALID_MESSAGING_TARGET');
  }
}
