<script setup lang="ts">
import Artplayer, { type Option } from 'artplayer';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

interface Props {
  visible: boolean;
  title: string;
  videoUrl: string;
  coverUrl?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:visible': [visible: boolean];
}>();

const playerRef = ref<HTMLDivElement | null>(null);
const playerError = ref('');
let player: Artplayer | null = null;

function ensurePreconnect(url: string) {
  try {
    const target = new URL(url);
    const href = `${target.protocol}//${target.host}`;
    const exist = document.head.querySelector(`link[data-preconnect='${href}']`);
    if (exist) {
      return;
    }

    const preconnect = document.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = href;
    preconnect.crossOrigin = 'anonymous';
    preconnect.setAttribute('data-preconnect', href);
    document.head.appendChild(preconnect);

    const dnsPrefetch = document.createElement('link');
    dnsPrefetch.rel = 'dns-prefetch';
    dnsPrefetch.href = href;
    dnsPrefetch.setAttribute('data-preconnect', href);
    document.head.appendChild(dnsPrefetch);
  } catch {
    // Ignore invalid url.
  }
}

function destroyPlayer() {
  if (!player) {
    return;
  }

  player.destroy(false);
  player = null;
}

function mountPlayer() {
  if (!props.visible || !props.videoUrl || !playerRef.value) {
    return;
  }

  ensurePreconnect(props.videoUrl);
  destroyPlayer();
  playerError.value = '';

  const options: Option = {
    container: playerRef.value,
    url: props.videoUrl,
    poster: props.coverUrl || '',
    autoplay: true,
    muted: false,
    volume: 0.7,
    setting: true,
    playbackRate: true,
    fullscreen: true,
    fullscreenWeb: true,
    screenshot: true,
    pip: true,
    moreVideoAttr: {
      preload: 'metadata',
      playsInline: true,
    },
  };

  player = new Artplayer(options);
  player.on('error', () => {
    playerError.value = '视频加载失败，请稍后重试';
  });
}

async function scheduleMountPlayer() {
  if (!props.visible || !props.videoUrl) {
    return;
  }

  await nextTick();
  mountPlayer();
}

watch(
  () => [props.visible, props.videoUrl] as const,
  ([visible]) => {
    if (visible) {
      void scheduleMountPlayer();
      return;
    }

    playerError.value = '';
    destroyPlayer();
  },
  { immediate: true },
);

function onVisibleChange(nextVisible: boolean) {
  emit('update:visible', nextVisible);
}

function onDialogShow() {
  void scheduleMountPlayer();
}

onBeforeUnmount(() => {
  destroyPlayer();
});
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :header="title"
    :style="{ width: 'min(1080px, calc(100vw - 1rem))' }"
    @show="onDialogShow"
    @update:visible="onVisibleChange"
  >
    <section class="replay-content">
      <div v-if="videoUrl" class="replay-player-wrap">
        <div ref="playerRef" class="replay-player" />
      </div>
      <Message v-if="playerError" severity="error" :closable="false">{{ playerError }}</Message>
      <Message v-else-if="!videoUrl" severity="warn" :closable="false">未获取到可播放的回放地址</Message>
    </section>
  </Dialog>
</template>

<style scoped>
.replay-content {
  display: grid;
  gap: 0.6rem;
}

.replay-title {
  margin: 0;
  font-size: 1rem;
  line-height: 1.35;
}

.replay-player {
  width: 100%;
  aspect-ratio: 16 / 9;
  min-height: 260px;
}

.replay-player-wrap {
  position: relative;
}

:deep(.art-video-player),
:deep(.art-video-player video),
:deep(.art-video-player .art-mask),
:deep(.art-video-player .art-player-app) {
  width: 100% !important;
  height: 100% !important;
}

:deep(.p-dialog) {
  max-width: calc(100vw - 1rem);
}

:deep(.p-dialog-content) {
  overflow-x: hidden;
}

@media (max-width: 768px) {
  .replay-player {
    min-height: 180px;
  }
}
</style>
