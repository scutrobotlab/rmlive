import type { EngagementInbound } from '@/leancloud/rmliveIm';
import type { DanmuFilterRules } from '@/types/api';
import type { EngagementSnapshotEventPayload } from './protocol';

export interface IMatchEngagementGateway {
  fetchEngagementCounts(input: {
    matchKey: string;
    redCollege: string;
    blueCollege: string;
    reactionIds: string[];
  }): Promise<{
    redSupport: number;
    blueSupport: number;
    reactions: Record<string, number>;
  }>;
  sendSupportTeam(matchKey: string, collegeName: string): Promise<void>;
  sendMatchReaction(matchKey: string, reactionId: string): Promise<void>;
  setEngagementMatch(input: {
    matchKey: string;
    redCollege: string;
    blueCollege: string;
    reactionIds: string[];
  }): Promise<{
    redSupport: number;
    blueSupport: number;
    reactions: Record<string, number>;
  }>;
}

export interface DanmuServiceHandlers {
  onMessage?: (msg: import('@/types/api').DanmuMessage) => void;
  onError?: (error: unknown) => void;
  includeHistory?: boolean;
  onEngagementMessage?: (msg: EngagementInbound) => void;
  onEngagementSnapshot?: (payload: EngagementSnapshotEventPayload) => void;
}

export interface IDanmuFilterGateway {
  updateDanmuFilterRules(rules: DanmuFilterRules): Promise<void>;
}
