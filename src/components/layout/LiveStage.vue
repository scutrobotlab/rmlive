<script setup lang="ts">
import Splitter from 'primevue/splitter';
import SplitterPanel from 'primevue/splitterpanel';
import { defineAsyncComponent } from 'vue';
import type { DanmuMessage } from '../../types/api';

interface PlayerQualityOption {
  label: string;
  value: string;
  src: string;
}

interface Props {
  isMobile: boolean;
  streamUrl: string | null;
  loading: boolean;
  errorMessage: string;
  qualityOptions: PlayerQualityOption[];
  selectedQualityRes: string | null;
  chatRoomId: string | null;
}

defineProps<Props>();

const emit = defineEmits<{
  retry: [];
  danmu: [msg: DanmuMessage];
}>();

const LivePlayer = defineAsyncComponent(() => import('../live/LivePlayer.vue'));
const DanmuPanel = defineAsyncComponent(() => import('../danmu/DanmuPanel.vue'));

function onRetry() {
  emit('retry');
}

function onDanmu(msg: DanmuMessage) {
  emit('danmu', msg);
}
</script>

<template>
  <section class="main-grid">
    <Splitter v-if="!isMobile" layout="horizontal" :style="{ height: '100%' }">
      <SplitterPanel :size="75" :minSize="50">
        <div class="live-column">
          <LivePlayer
            :stream-url="streamUrl"
            :loading="loading"
            :error-message="errorMessage"
            :quality-options="qualityOptions"
            :selected-quality-res="selectedQualityRes"
            :chat-room-id="chatRoomId"
            @retry="onRetry"
            @danmu="onDanmu"
          />
        </div>
      </SplitterPanel>

      <SplitterPanel :size="25" :minSize="20" class="danmu-panel-wrap">
        <DanmuPanel />
      </SplitterPanel>
    </Splitter>

    <div v-else class="live-column">
      <LivePlayer
        :stream-url="streamUrl"
        :loading="loading"
        :error-message="errorMessage"
        :quality-options="qualityOptions"
        :selected-quality-res="selectedQualityRes"
        :chat-room-id="chatRoomId"
        @retry="onRetry"
        @danmu="onDanmu"
      />
    </div>
  </section>
</template>

<style scoped>
.main-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
  min-width: 0;
}

.live-column {
  min-width: 0;
}

.danmu-panel-wrap {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@media (max-width: 1024px) {
  .danmu-panel-wrap {
    display: none;
  }
}
</style>
