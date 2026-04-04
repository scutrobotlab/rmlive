import type {
  CurrentAndNextMatches,
  GroupRankInfo,
  GroupsOrder,
  LiveGameInfo,
  RobotData,
  Schedule,
} from '../types/api';
import type { GroupSection, TeamGroupMeta } from '../utils/groupView';
import type { MatchView } from '../utils/matchView';
import type { PlayerQualityOption } from '../utils/rmStreamView';
import type { ZoneOptionItem, ZoneUiState } from '../utils/zoneView';

export interface RmDataInitPayload {
  historySelectedZoneId: string | null;
  selectedZoneId: string | null;
  selectedQualityRes: string | null;
  hasManualZoneSelection: boolean;
}

export interface RmDataSnapshot {
  liveGameInfo: LiveGameInfo | null;
  currentAndNextMatches: CurrentAndNextMatches | null;
  groupsOrder: GroupsOrder | null;
  groupRankInfo: GroupRankInfo | null;
  robotData: RobotData | null;
  schedule: Schedule | null;
  selectedZoneId: string | null;
  effectiveSelectedZoneId: string | null;
  selectedQualityRes: string | null;
  selectedZoneName: string | null;
  selectedZoneUiState: ZoneUiState | null;
  streamLoading: boolean;
  streamErrorMessage: string;
  zoneOptions: ZoneOptionItem[];
  effectiveStreamUrl: string | null;
  effectiveStreamErrorMessage: string;
  groupSections: GroupSection[];
  teamGroupMap: Record<string, TeamGroupMeta>;
  scheduleEventTitle: string;
  playerQualityOptions: PlayerQualityOption[];
  selectedZoneChatRoomId: string | null;
  scheduleMatchRows: MatchView[];
  runningMatchForSelectedZone: MatchView | null;
}

export type RmDataSnapshotPatch = Partial<RmDataSnapshot>;

export interface RmDataBootstrapPayload {
  version: number;
  snapshot: RmDataSnapshot;
}

export interface RmDataPatchPayload {
  version: number;
  patch: RmDataSnapshotPatch;
}

export type RmDataWorkerIncomingMessage =
  | { type: 'INIT'; payload: RmDataInitPayload }
  | { type: 'USER_SELECT_ZONE'; payload: { zoneId: string | null } }
  | { type: 'USER_SELECT_QUALITY'; payload: { qualityRes: string | null } }
  | { type: 'RETRY_STREAM' }
  | { type: 'VISIBILITY_CHANGED'; payload: { hidden: boolean } }
  | { type: 'STOP' };

export type RmDataWorkerOutgoingMessage =
  | { type: 'BOOTSTRAP_STATE'; payload: RmDataBootstrapPayload }
  | { type: 'PATCH_STATE'; payload: RmDataPatchPayload }
  | { type: 'STREAM_ERROR'; payload: { message: string } }
  | {
      type: 'LOG';
      payload: { level: 'info' | 'warn'; scope: string; message: string; meta?: Record<string, unknown> };
    };
