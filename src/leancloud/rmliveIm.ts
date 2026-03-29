import type { MatchView } from '@/utils/matchView';

/** Attribute keys on LeanCloud IM messages (ImageMessage). */
export const RMLIVE_MSG_TYPE = 'rmlive:msg_type';
export const RMLIVE_MSG_FOR_TEAM = 'rmlive:msg_for_team';
export const RMLIVE_MSG_FOR_MATCH = 'rmlive:msg_for_match';
export const RMLIVE_REACTION_ID = 'rmlive:reaction_id';

export const MSG_TYPE_SUPPORT_TEAM = 'support_team';
export const MSG_TYPE_MATCH_REACTION = 'match_reaction';

/**
 * Separates match key and college in `rmlive:msg_for_team`.
 * Not a literal `matchId:学校` colon — school names may contain ":"; wire format is matchKey + sep + college.
 */
export const TEAM_PAYLOAD_SEP = '\u001f';

export interface EngagementInbound {
  kind: typeof MSG_TYPE_SUPPORT_TEAM | typeof MSG_TYPE_MATCH_REACTION;
  matchKey: string;
  collegeName?: string;
  reactionId?: string;
  messageId: string;
  timestamp: number;
}

export function buildMatchKeyFromView(match: Pick<MatchView, 'id' | 'zoneId' | 'orderNumber'>): string {
  const id = String(match.id ?? '').trim();
  if (id) {
    return id;
  }
  const z = String(match.zoneId ?? '').trim();
  const o = String(match.orderNumber ?? '').trim();
  return `${z}|${o}`;
}

export function encodeTeamTarget(matchKey: string, collegeName: string): string {
  return `${matchKey}${TEAM_PAYLOAD_SEP}${collegeName}`;
}

export function decodeTeamTarget(raw: string): { matchKey: string; collegeName: string } | null {
  const idx = raw.indexOf(TEAM_PAYLOAD_SEP);
  if (idx <= 0 || idx >= raw.length - 1) {
    return null;
  }
  return {
    matchKey: raw.slice(0, idx),
    collegeName: raw.slice(idx + TEAM_PAYLOAD_SEP.length),
  };
}

export function parseEngagementFromAttributes(
  attrs: Record<string, unknown>,
  messageId: string,
  timestamp: number,
): EngagementInbound | null {
  const msgType = attrs[RMLIVE_MSG_TYPE];
  if (msgType !== MSG_TYPE_SUPPORT_TEAM && msgType !== MSG_TYPE_MATCH_REACTION) {
    return null;
  }

  if (msgType === MSG_TYPE_SUPPORT_TEAM) {
    const rawTeam = attrs[RMLIVE_MSG_FOR_TEAM];
    if (typeof rawTeam !== 'string' || !rawTeam) {
      return null;
    }
    const decoded = decodeTeamTarget(rawTeam);
    if (!decoded) {
      return null;
    }
    return {
      kind: MSG_TYPE_SUPPORT_TEAM,
      matchKey: decoded.matchKey,
      collegeName: decoded.collegeName,
      messageId,
      timestamp,
    };
  }

  const rawMatch = attrs[RMLIVE_MSG_FOR_MATCH];
  const reactionId = attrs[RMLIVE_REACTION_ID];
  if (typeof rawMatch !== 'string' || !rawMatch || typeof reactionId !== 'string' || !reactionId) {
    return null;
  }
  return {
    kind: MSG_TYPE_MATCH_REACTION,
    matchKey: rawMatch,
    reactionId,
    messageId,
    timestamp,
  };
}
