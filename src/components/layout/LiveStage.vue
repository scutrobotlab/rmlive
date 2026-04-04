<script setup lang="ts">
import { useRmDataStore } from '@/stores/rmData';
import { useUiStore } from '@/stores/ui';
import { storeToRefs } from 'pinia';
import { Fieldset } from 'primevue';
import Splitter from 'primevue/splitter';
import SplitterPanel from 'primevue/splitterpanel';
import { computed, defineAsyncComponent } from 'vue';
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
  runningMatchForSelectedZone,
} = storeToRefs(dataStore);

const { isMobile, pkEnabled, reactionEnabled } = storeToRefs(uiStore);
const danmuEnabledAtLoad = Boolean(uiStore.danmuEnabled);

const emit = defineEmits<{
  danmu: [msg: DanmuMessage];
  danmuReset: [];
}>();

const LivePlayer = defineAsyncComponent(() => import('../live/LivePlayer.vue'));
const DanmuPanel = defineAsyncComponent(() => import('../danmu/DanmuPanel.vue'));
const MatchFirepowerBar = defineAsyncComponent(() => import('../panels/MatchFirepowerBar.vue'));
const MatchReactionStrip = defineAsyncComponent(() => import('../panels/MatchReactionStrip.vue'));

const hasCurrentMatch = computed(() => Boolean(runningMatchForSelectedZone.value));

function onRetry() {
  void dataStore.retryLiveStream();
}

function onDanmu(msg: DanmuMessage) {
  emit('danmu', msg);
}

function onDanmuReset() {
  emit('danmuReset');
}
</script>

<template>
  <section class="main-grid">
    <Splitter v-if="!isMobile && danmuEnabledAtLoad" layout="horizontal" :style="{ height: '100%' }">
      <SplitterPanel :size="75" :minSize="50">
        <div class="live-column">
          <MatchFirepowerBar v-if="hasCurrentMatch && pkEnabled" />
          <LivePlayer
            :stream-url="effectiveStreamUrl"
            :loading="streamLoading"
            :error-message="effectiveStreamErrorMessage"
            :quality-options="playerQualityOptions"
            :selected-quality-res="selectedQualityRes"
            :chat-room-id="selectedZoneChatRoomId"
            @retry="onRetry"
            @danmu="onDanmu"
            @danmu-reset="onDanmuReset"
          />
          <div v-if="hasCurrentMatch && reactionEnabled">
            <MatchReactionStrip />
          </div>
        </div>
      </SplitterPanel>

      <SplitterPanel :size="25" :minSize="20" class="danmu-panel-wrap">
        <DanmuPanel />
      </SplitterPanel>
    </Splitter>

    <div v-else class="live-column">
      <MatchFirepowerBar v-if="hasCurrentMatch && pkEnabled" />
      <LivePlayer
        :stream-url="effectiveStreamUrl"
        :loading="streamLoading"
        :error-message="effectiveStreamErrorMessage"
        :quality-options="playerQualityOptions"
        :selected-quality-res="selectedQualityRes"
        :chat-room-id="selectedZoneChatRoomId"
        @retry="onRetry"
        @danmu="onDanmu"
        @danmu-reset="onDanmuReset"
      />
      <div v-if="hasCurrentMatch && reactionEnabled" class="mt-2">
        <MatchReactionStrip />
      </div>

      <Fieldset v-if="danmuEnabledAtLoad && isMobile" legend="弹幕列表" toggleable class="mobile-danmu-panel">
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
