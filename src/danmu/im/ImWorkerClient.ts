import type { EngagementInbound } from '@/leancloud/rmliveIm';
import type { DanmuAttributes, DanmuFilterRules, DanmuMessage } from '@/types/api';
import { v4 as uuid } from 'uuid';
import type {
  EngagementSnapshot,
  EngagementSnapshotEventPayload,
  WorkerEvent,
  WorkerMessage,
  WorkerRequest,
  WorkerResponse,
} from './protocol';

type PendingResolver = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

export class ImWorkerClient {
  private worker: Worker;
  private pending = new Map<string, PendingResolver>();
  private danmuListeners = new Set<(msg: DanmuMessage) => void>();
  private engagementListeners = new Set<(msg: EngagementInbound) => void>();
  private engagementSnapshotListeners = new Set<(payload: EngagementSnapshotEventPayload) => void>();
  private errorListeners = new Set<(error: unknown) => void>();

  constructor(config: { appId: string; appKey: string; clientId: string; engagementChatRoomId: string }) {
    this.worker = new Worker(new URL('./im.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      this.onWorkerMessage(event.data);
    };
    this.worker.onerror = (event) => {
      this.emitError(event.error ?? new Error(event.message));
    };

    void this.request('init', config);
  }

  onDanmu(listener: (msg: DanmuMessage) => void): () => void {
    this.danmuListeners.add(listener);
    return () => {
      this.danmuListeners.delete(listener);
    };
  }

  onEngagement(listener: (msg: EngagementInbound) => void): () => void {
    this.engagementListeners.add(listener);
    return () => {
      this.engagementListeners.delete(listener);
    };
  }

  onError(listener: (error: unknown) => void): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  onEngagementSnapshot(listener: (payload: EngagementSnapshotEventPayload) => void): () => void {
    this.engagementSnapshotListeners.add(listener);
    return () => {
      this.engagementSnapshotListeners.delete(listener);
    };
  }

  connectRoom(roomId: string, includeHistory: boolean): Promise<void> {
    return this.request('connect-room', { roomId, includeHistory }) as Promise<void>;
  }

  disconnectRoom(roomId: string): Promise<void> {
    return this.request('disconnect-room', { roomId }) as Promise<void>;
  }

  fetchViewerCount(roomId: string): Promise<number> {
    return this.request('fetch-viewer-count', { roomId }).then((v) => Number(v ?? 0));
  }

  fetchEngagementCounts(input: {
    matchKey: string;
    redCollege: string;
    blueCollege: string;
    reactionIds: string[];
  }): Promise<EngagementSnapshot> {
    return this.request('fetch-engagement-counts', input).then((v) => v as EngagementSnapshot);
  }

  setEngagementMatch(input: {
    matchKey: string;
    redCollege: string;
    blueCollege: string;
    reactionIds: string[];
  }): Promise<EngagementSnapshot> {
    return this.request('set-engagement-match', input).then((v) => v as EngagementSnapshot);
  }

  updateDanmuFilterRules(rules: DanmuFilterRules): Promise<void> {
    return this.request('update-danmu-filter', { rules }) as Promise<void>;
  }

  sendDanmu(roomId: string, text: string, attrs: DanmuAttributes): Promise<void> {
    return this.request('send-danmu', { roomId, text, attrs }) as Promise<void>;
  }

  sendSupport(matchKey: string, collegeName: string): Promise<void> {
    return this.request('send-support', { matchKey, collegeName }) as Promise<void>;
  }

  sendReaction(matchKey: string, reactionId: string): Promise<void> {
    return this.request('send-reaction', { matchKey, reactionId }) as Promise<void>;
  }

  async dispose(): Promise<void> {
    await this.request('dispose', {});
    for (const [id, pending] of this.pending) {
      pending.reject(new Error(`Worker disposed before response: ${id}`));
    }
    this.pending.clear();
    this.worker.terminate();
  }

  private request<TType extends WorkerRequest['type']>(
    type: TType,
    payload: Extract<WorkerRequest, { type: TType }>['payload'],
  ): Promise<unknown> {
    const id = uuid();
    const req = { id, type, payload } as WorkerRequest;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage(req);
    });
  }

  private onWorkerMessage(message: WorkerMessage) {
    if (message.channel === 'response') {
      this.resolvePending(message.data);
      return;
    }

    this.dispatchEvent(message.data);
  }

  private resolvePending(response: WorkerResponse) {
    const pending = this.pending.get(response.id);
    if (!pending) {
      return;
    }
    this.pending.delete(response.id);
    if ('error' in response) {
      const error = new Error(response.error.message) as Error & { code?: string };
      if (response.error.code) {
        error.code = response.error.code;
      }
      pending.reject(error);
      return;
    }

    pending.resolve(response.payload);
  }

  private dispatchEvent(event: WorkerEvent) {
    if (event.type === 'danmu') {
      for (const listener of this.danmuListeners) {
        listener(event.payload);
      }
      return;
    }

    if (event.type === 'engagement') {
      for (const listener of this.engagementListeners) {
        listener(event.payload);
      }
      return;
    }

    if (event.type === 'engagement-snapshot') {
      for (const listener of this.engagementSnapshotListeners) {
        listener(event.payload);
      }
      return;
    }

    this.emitError(event.payload);
  }

  private emitError(error: unknown) {
    for (const listener of this.errorListeners) {
      listener(error);
    }
  }
}
