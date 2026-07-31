<script setup lang="ts">
import { useStreamPlayer } from '@/composables/useStreamPlayer';
import { useDanmuFilterStore } from '@/stores/danmuFilter';
import { useUiStore } from '@/stores/ui';
import type { HighlightedDanmu } from '@/danmu/im/types';
import DanmuFilterDialog from '@/components/dialogs/DanmuFilterDialog.vue';
import ProgressSpinner from 'primevue/progressspinner';
import Message from 'primevue/message';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { useDanmuEmitter } from '../../composables/useDanmuEmitter';
import { useDanmuStore } from '../../stores/danmu';
import type { DanmuMessage, PerspectiveOption, QualityOption } from '../../types/api';

const props = defineProps<{
  streamUrl: string | null
  loading: boolean
  errorMessage: string
  perspectiveOptions?: PerspectiveOption[]
  selectedPerspectiveKey?: string | null
  qualityOptions?: QualityOption[]
  selectedQualityRes?: string | null
  chatRoomId?: string | null
}>();

const emit = defineEmits<{
  retry: []
  perspectiveChange: [value: string]
  qualityChange: [value: string]
  danmu: [msg: DanmuMessage]
  danmuList: [messages: DanmuMessage[]]
  danmuReset: []
}>();

const uiStore = useUiStore();
const danmuFilterStore = useDanmuFilterStore();
const { rules } = storeToRefs(danmuFilterStore);

const danmuEnabledAtLoad = Boolean(uiStore.danmuEnabled);

const danmuTrackFilter = (danmu: HighlightedDanmu) => {
  if (danmu.source === 'history') return true;
  return danmuFilterStore.matchMessage(danmu as DanmuMessage);
};

const danmuSender = (danmu: HighlightedDanmu) => {
  return danmu.source !== 'send';
};

const filterActive = computed(() => {
  if (!rules.value.enabled) return false;
  return rules.value.keywords.length > 0 || rules.value.schools.length > 0 || rules.value.users.length > 0;
});
const activeFilterCount = computed(() => {
  if (!rules.value.enabled) return 0;
  return rules.value.keywords.length + rules.value.schools.length + rules.value.users.length;
});
const filterSummary = computed(() => {
  const parts: string[] = [];
  if (rules.value.keywords.length) parts.push(`关键词: ${rules.value.keywords.length}`);
  if (rules.value.schools.length) parts.push(`学校: ${rules.value.schools.length}`);
  if (rules.value.users.length) parts.push(`用户: ${rules.value.users.length}`);
  return parts.length ? parts.join(' · ') : '当前无过滤规则';
});
const filterDialogVisible = ref(false);

function onShowFilterDialog() {
  filterDialogVisible.value = true;
}

const container = ref<HTMLDivElement | null>(null);
const danmukuPlugin = ref<any>(null);

useDanmuEmitter({
  danmuEnabled: danmuEnabledAtLoad,
  isIFrame: false,
  danmukuPlugin,
  onPushDanmu: (msg) => {
    danmukuPlugin.value?.emit(msg);
  },
  onDanmu: (msg: DanmuMessage) => {
    useDanmuStore().addMessage(msg);
    emit('danmu', msg);
  },
  onDanmuList: (msgs: DanmuMessage[]) => {
    useDanmuStore().setMessages(msgs);
    emit('danmuList', msgs);
  },
  onDanmuReset: () => {
    emit('danmuReset');
  },
  toast: {} as any,
});

const playerProxy = useStreamPlayer({
  container,
  streamUrl: computed(() => props.streamUrl),
  isIFrame: false,
  danmuEnabled: danmuEnabledAtLoad,
  qualityOptions: computed(() => props.qualityOptions),
  selectedQualityRes: computed(() => props.selectedQualityRes),
  perspectiveOptions: computed(() => props.perspectiveOptions),
  selectedPerspectiveKey: computed(() => props.selectedPerspectiveKey),
  danmuTrackFilter,
  danmuSender,
  filterActive,
  activeFilterCount,
  filterSummary,
  onShowFilterDialog,
  onRetry: () => emit('retry'),
  onQualityChange: (res: string) => emit('qualityChange', res),
  onPerspectiveChange: (key: string) => emit('perspectiveChange', key),
  onPlayerReady: () => {},
  externalDanmukuPlugin: danmukuPlugin,
});

function retry() {
  emit('retry');
}
</script>

<template>
  <div class="player-shell">
    <div ref="container" class="player-container"></div>

    <div v-if="errorMessage" class="player-overlay player-overlay-error">
      <Message severity="error" :closable="false">
        {{ errorMessage }}
      </Message>
      <button class="retry-btn" @click="retry">重试</button>
    </div>
    <div v-else-if="loading || !playerProxy.playerReady.value" class="player-overlay player-overlay-loading">
      <ProgressSpinner />
    </div>

    <DanmuFilterDialog v-if="danmuEnabledAtLoad" v-model:visible="filterDialogVisible" />
  </div>
</template>

<style scoped>
.player-shell {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  max-height: calc(100vh - 26rem);
}

.player-container {
  width: 100%;
  height: 100%;
}

.player-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.player-overlay-loading {
  background: rgba(0, 0, 0, 0.6);
}

.player-overlay-error {
  background: rgba(0, 0, 0, 0.75);
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
}

.retry-btn {
  padding: 0.4rem 1.2rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  font-size: 0.85rem;
}

.retry-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
