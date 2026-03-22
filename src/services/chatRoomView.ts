import type { LiveGameInfo } from '../types/api';
import { normalizeZoneId } from './zoneView';

function pickChatRoomId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const chatRoomId = value.trim();
  return chatRoomId ? chatRoomId : null;
}

export function resolveZoneChatRoomId(
  liveGameInfo: LiveGameInfo | null,
  selectedZoneId: string | null,
  selectedZoneName: string | null,
): string | null {
  const rawZoneId = String(selectedZoneId ?? '').trim();
  const eventData = liveGameInfo?.eventData;
  if (!rawZoneId || !Array.isArray(eventData)) {
    return null;
  }

  const targetZoneId = normalizeZoneId(rawZoneId);

  const byZoneId = eventData.find((item) => {
    const zone = item as Record<string, unknown>;
    return normalizeZoneId(zone.zoneId) === targetZoneId;
  }) as Record<string, unknown> | undefined;

  const matchedByZoneId = pickChatRoomId(byZoneId?.chatRoomId);
  if (matchedByZoneId) {
    return matchedByZoneId;
  }

  const zoneName = String(selectedZoneName ?? '').trim();
  if (zoneName) {
    const byName = eventData.find((item) => {
      const zone = item as Record<string, unknown>;
      const itemZoneName = String(zone.zoneName ?? '').trim();
      return itemZoneName === zoneName || itemZoneName.includes(zoneName);
    }) as Record<string, unknown> | undefined;

    const matchedByName = pickChatRoomId(byName?.chatRoomId);
    if (matchedByName) {
      return matchedByName;
    }
  }

  const fallback = eventData.find((item) => {
    const zone = item as Record<string, unknown>;
    return pickChatRoomId(zone.chatRoomId);
  }) as Record<string, unknown> | undefined;

  return pickChatRoomId(fallback?.chatRoomId);
}