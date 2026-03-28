<script setup lang="ts">
import { useRmDataStore } from '@/stores/rmData';
import { useUiStore } from '@/stores/ui';
import { Fieldset } from 'primevue';
import Splitter from 'primevue/splitter';
import SplitterPanel from 'primevue/splitterpanel';
import { storeToRefs } from 'pinia';
import { defineAsyncComponent } from 'vue';
import type { DanmuMessage } from '../../types/api';

const dataStore = useRmDataStore();
const uiStore = useUiStore();

const {
  effectiveStreamUrl,
  streamLoading,
  effectiveStreamErrorMessage,
  playerQualityOptions,
  selectedQualityRes,
  selectedZoneChatRoomId,
} = storeToRefs(dataStore);

const { isMobile } = storeToRefs(uiStore);

const emit = defineEmits<{
  danmu: [msg: DanmuMessage];
}>();

const LivePlayer = defineAsyncComponent(() => import('../live/LivePlayer.vue'));
const DanmuPanel = defineAsyncComponent(() => import('../danmu/DanmuPanel.vue'));

function onRetry() {
  void dataStore.retryLiveStream();
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
            :stream-url="effectiveStreamUrl"
            :loading="streamLoading"
            :error-message="effectiveStreamErrorMessage"
            :quality-options="playerQualityOptions"
            :selected-quality-res="selectedQualityRes"
            :chat-room-id="selectedZoneChatRoomId"
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
        :stream-url="effectiveStreamUrl"
        :loading="streamLoading"
        :error-message="effectiveStreamErrorMessage"
        :quality-options="playerQualityOptions"
        :selected-quality-res="selectedQualityRes"
        :chat-room-id="selectedZoneChatRoomId"
        @retry="onRetry"
        @danmu="onDanmu"
      />

      <Fieldset legend="弹幕列表" toggleable class="mobile-danmu-panel">
        <div class="mobile-danmu-wrap">
          <DanmuPanel />
        </div>
      </Fieldset>
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

.mobile-danmu-panel {
  margin-top: 0.75rem;
}

.mobile-danmu-wrap {
  height: 24rem;
  min-height: 16rem;
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

  .mobile-danmu-wrap {
    height: 13rem;
  }
}
</style>
