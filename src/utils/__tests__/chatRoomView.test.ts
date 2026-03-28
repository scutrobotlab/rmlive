import { describe, expect, it } from 'vitest';
import type { LiveGameInfo } from '../../types/api';
import { resolveZoneChatRoomId } from '../chatRoomView';

describe('resolveZoneChatRoomId', () => {
  it('matches chat room by normalized zone id first', () => {
    const payload: LiveGameInfo = {
      eventData: [
        { zoneId: '01', zoneName: '华南赛区', chatRoomId: 'room-a' },
        { zoneId: '2', zoneName: '华东赛区', chatRoomId: 'room-b' },
      ],
    };

    const roomId = resolveZoneChatRoomId(payload, '1', '华南赛区');
    expect(roomId).toBe('room-a');
  });

  it('falls back to matching by zone name when zone id has no room', () => {
    const payload: LiveGameInfo = {
      eventData: [
        { zoneId: '1', zoneName: '华南赛区', chatRoomId: '' },
        { zoneId: '2', zoneName: '华东赛区', chatRoomId: 'room-b' },
      ],
    };

    const roomId = resolveZoneChatRoomId(payload, '1', '华东');
    expect(roomId).toBe('room-b');
  });

  it('uses first available room id as fallback', () => {
    const payload: LiveGameInfo = {
      eventData: [
        { zoneId: '1', zoneName: '华南赛区', chatRoomId: '' },
        { zoneId: '2', zoneName: '华东赛区', chatRoomId: 'room-b' },
      ],
    };

    const roomId = resolveZoneChatRoomId(payload, '1', null);
    expect(roomId).toBe('room-b');
  });
});
