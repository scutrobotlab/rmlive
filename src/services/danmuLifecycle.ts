import { watch, type Ref, type WatchStopHandle } from 'vue';

export function bindDanmuRoomReset(chatRoomId: Ref<string | null>, clearMessages: () => void): WatchStopHandle {
  return watch(
    () => chatRoomId.value,
    () => {
      clearMessages();
    },
  );
}