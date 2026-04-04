export type AnyRecord = Record<string, unknown>;

export interface MatchBrief extends AnyRecord {
  id?: string | number;
  name?: string;
  status?: string;
  round?: string;
  stage?: string;
  team_a?: string;
  team_b?: string;
  start_time?: string;
  end_time?: string;
}

export interface LiveStreamCandidate extends AnyRecord {
  label?: string;
  res?: string;
  type?: string;
  src?: string;
}

export interface ReplayVideoContent extends AnyRecord {
  title1?: string;
  main_source_url?: string;
  main_remote_url?: string;
  main_img_url?: string;
  match_id?: string | number;
}

export interface ReplayVideoEntry extends AnyRecord {
  content?: ReplayVideoContent;
}

export interface LiveZone extends AnyRecord {
  zoneId?: string | number;
  zoneName?: string;
  liveState?: number;
  matchState?: number;
  zoneLiveString?: LiveStreamCandidate[];
  videos?: ReplayVideoEntry[];
}

export interface LiveGameInfo extends AnyRecord {
  eventData?: LiveZone[];
  live_url?: string;
  hls_url?: string;
  stream_url?: string;
  room_name?: string;
  title?: string;
  status?: string;
}

export type CurrentAndNextMatches = AnyRecord[] | AnyRecord;

export interface GroupInfo extends AnyRecord {
  name?: string;
  teams?: string[];
}

export type GroupsOrder = GroupInfo[] | AnyRecord;
export type GroupRankInfo = AnyRecord;

export interface RobotDataEntry extends AnyRecord {
  team?: string;
  robot?: string;
  score?: number;
  hp?: number;
  timestamp?: string;
}

export type RobotData = RobotDataEntry[] | AnyRecord;

export interface ScheduleEntry extends AnyRecord {
  id?: string | number;
  date?: string;
  time?: string;
  stage?: string;
  team_a?: string;
  team_b?: string;
  status?: string;
}

export type Schedule = ScheduleEntry[] | AnyRecord;

// Danmu (Comments via Leancloud Realtime)
/** artplayer-plugin-danmuku: 0 scroll, 1 top, 2 bottom */
export type DanmuMode = 0 | 1 | 2;

export interface DanmuData {
  text: string;
  username: string;
  nickname: string;
  schoolName: string;
  badge: string;
  mode?: DanmuMode;
  color?: string;
}

export interface DanmuAttributes {
  nickname: string;
  schoolName: string;
  badge: string;
  racingAge: string;
  position: string;
  isAdmin: boolean;
  username?: string;
  mode?: DanmuMode;
  color?: string;
}

export interface DanmuMessage extends DanmuData {
  id: string;
  timestamp: number;
  source?: 'history' | 'realtime';
}

export interface DanmuFilterRules {
  enabled: boolean;
  keywords: string[];
  schools: string[];
  users: string[];
}
