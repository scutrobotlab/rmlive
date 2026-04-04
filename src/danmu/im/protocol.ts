import type { EngagementInbound } from '@/leancloud/rmliveIm';
import type { DanmuAttributes, DanmuFilterRules, DanmuMessage } from '@/types/api';

export type EngagementSnapshot = {
  redSupport: number;
  blueSupport: number;
  reactions: Record<string, number>;
};

export type EngagementSnapshotEventPayload = {
  matchKey: string;
  status: 'hydrating' | 'live';
  snapshot: EngagementSnapshot;
  updatedAt: number;
};

export type WorkerRequest =
  | {
      id: string;
      type: 'init';
      payload: { appId: string; appKey: string; clientId: string; engagementChatRoomId: string };
    }
  | {
      id: string;
      type: 'connect-room';
      payload: { roomId: string; includeHistory: boolean };
    }
  | {
      id: string;
      type: 'disconnect-room';
      payload: { roomId: string };
    }
  | {
      id: string;
      type: 'fetch-viewer-count';
      payload: { roomId: string };
    }
  | {
      id: string;
      type: 'fetch-engagement-counts';
      payload: {
        matchKey: string;
        redCollege: string;
        blueCollege: string;
        reactionIds: string[];
      };
    }
  | {
      id: string;
      type: 'set-engagement-match';
      payload: {
        matchKey: string;
        redCollege: string;
        blueCollege: string;
        reactionIds: string[];
      };
    }
  | {
      id: string;
      type: 'update-danmu-filter';
      payload: {
        rules: DanmuFilterRules;
      };
    }
  | {
      id: string;
      type: 'send-danmu';
      payload: { roomId: string; text: string; attrs: DanmuAttributes };
    }
  | {
      id: string;
      type: 'send-support';
      payload: { matchKey: string; collegeName: string };
    }
  | {
      id: string;
      type: 'send-reaction';
      payload: { matchKey: string; reactionId: string };
    }
  | {
      id: string;
      type: 'dispose';
      payload: Record<string, never>;
    };

export type WorkerResponse =
  | { id: string; ok: true; payload: unknown }
  | { id: string; ok: false; error: { message: string; code?: string } };

export type WorkerEvent =
  | { type: 'danmu'; payload: DanmuMessage }
  | { type: 'engagement'; payload: EngagementInbound }
  | { type: 'engagement-snapshot'; payload: EngagementSnapshotEventPayload }
  | { type: 'runtime-error'; payload: { message: string; code?: string; detail?: unknown } };

export type WorkerMessage = { channel: 'response'; data: WorkerResponse } | { channel: 'event'; data: WorkerEvent };
