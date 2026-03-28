import { watch, type Ref, type WatchStopHandle } from 'vue';
import { logInfo } from '../utils/observability';

export function bindDanmuRoomReset(chatRoomId: Ref<string | null>, clearMessages: () => void): WatchStopHandle {
  return watch(
    () => chatRoomId.value,
    (nextRoomId, prevRoomId) => {
      if (nextRoomId !== prevRoomId) {
        logInfo('danmu', 'chat room switched, resetting danmu messages', {
          from: prevRoomId,
          to: nextRoomId,
        });
      }
      clearMessages();
    },
  );
}
