<script setup lang="ts">
import { DanmuService } from '@/danmu/DanmuService';
import { useDanmuFilterStore } from '@/stores/danmuFilter';
import { useUiStore } from '@/stores/ui';
import { isIFrame, useUserInfoStore } from '@/stores/userInfo';
import Artplayer, { Option } from 'artplayer';
import artplayerPluginChromecast from 'artplayer-plugin-chromecast';
import artplayerPluginDanmuku, { type Danmu } from 'artplayer-plugin-danmuku';
import Hls from 'hls.js/dist/hls.js';
import Button from 'primevue/button';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import { useToast } from 'primevue/usetoast';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { DanmuAttributes, DanmuMessage } from '../../types/api';
import DanmuFilterDialog from '../dialogs/DanmuFilterDialog.vue';

interface QualityOption {
  label: string;
  value: string;
  src: string;
}

interface Props {
  streamUrl: string | null;
  loading: boolean;
  errorMessage: string;
  qualityOptions?: QualityOption[];
  selectedQualityRes?: string | null;
  chatRoomId?: string | null;
}

const props = defineProps<Props>();
const toast = useToast();
const hasShownAutoplayNotice = ref(false);
const filterDialogVisible = ref(false);

const emit = defineEmits<{
  retry: [];
  danmu: [msg: DanmuMessage];
}>();

const container = ref<HTMLDivElement | null>(null);
let player: Artplayer | null = null;
let playerReady = false;
let danmukuPlugin: any = null;
const pendingDanmuQueue: DanmuMessage[] = [];
const danmuService = ref<DanmuService | null>(null);
let currentRoomId: string | null = null;
let roomSwitchToken = 0;
let connectingService: DanmuService | null = null;

const danmuFilterStore = useDanmuFilterStore();
const userInfoStore = useUserInfoStore();
const activeFilterCount = computed(() => danmuFilterStore.activeRuleCount);
const filterActive = computed(() => danmuFilterStore.rules.enabled && activeFilterCount.value > 0);
const filterSummary = computed(() => {
  if (!danmuFilterStore.rules.enabled) {
    return '过滤已关闭';
  }

  if (!activeFilterCount.value) {
    return '未配置过滤规则';
  }

  return `关键词 ${danmuFilterStore.rules.keywords.length} / 学校 ${danmuFilterStore.rules.schools.length} / 用户 ${danmuFilterStore.rules.users.length}`;
});

async function sendDanmuByRealtime(d: Danmu): Promise<boolean> {
  const content = String(d?.text ?? '').trim();
  if (!content) {
    return false;
  }

  if (!userInfoStore.userInfo) {
    toast.add({ severity: 'warn', summary: '请先登录', detail: '登录后才能发送弹幕' });
    return false;
  }

  if (!danmuService.value) {
    toast.add({ severity: 'warn', summary: '弹幕未连接', detail: '请稍后重试' });
    return false;
  }

  // const myAttributes: DanmuAttributes = {
  //   nickname: userInfoStore.userInfo.nickname || '',
  //   schoolName: userInfoStore.userInfo.school || '',
  //   badge: userInfoStore.userInfo.badge?.[0] || '',
  //   racingAge: String(userInfoStore.userInfo.racingAge ?? ''),
  //   position: userInfoStore.userInfo.role || '',
  //   isAdmin: false,
  //   username: formatStructuredName({
  //     year: userInfoStore.userInfo.racingAge ? `${userInfoStore.userInfo.racingAge}` : '',
  //     role: userInfoStore.userInfo.role || '',
  //     school: userInfoStore.userInfo.school || '',
  //     nickname: userInfoStore.userInfo.nickname || '',
  //   }),
  // };
  const myAttributes: DanmuAttributes = {
    nickname: 'RM粉丝大管家',
    schoolName: '',
    badge: 'admin',
    racingAge: '',
    position: 'admin',
    isAdmin: true,
    username: 'RM粉丝大管家',
  };

  try {
    await danmuService.value.sendMessage(content, myAttributes);
  } catch (error) {
    console.error('[LivePlayer] Failed to send danmu:', error);
    toast.add({ severity: 'error', summary: '发送失败', detail: '弹幕发送失败，请稍后重试' });
  }

  return false; // 阻止 artplayer 插件的默认发送行为
}

async function destroyDanmu() {
  if (connectingService) {
    try {
      await connectingService.disconnect();
    } catch (error) {
      console.warn('[LivePlayer] Ignore connectingService disconnect error:', error);
    }
    connectingService = null;
  }

  if (danmuService.value) {
    try {
      await danmuService.value.disconnect();
    } catch (error) {
      console.warn('[LivePlayer] Ignore danmuService disconnect error:', error);
    }
    danmuService.value = null;
  }
}

function destroyPlayer() {
  if (player) {
    player.destroy(false);
    player = null;
  }
  danmukuPlugin = null;
  playerReady = false;
  pendingDanmuQueue.length = 0;
}

function pushDanmuToPlayer(msg: DanmuMessage) {
  if (!player || !msg.text) {
    return;
  }

  const payload = {
    text: msg.text,
    color: '#FFFFFF',
    time: 0,
    border: msg.nickname === userInfoStore.userInfo?.nickname,
  };

  if (playerReady && danmukuPlugin?.emit) {
    danmukuPlugin.emit(payload);
    return;
  }

  pendingDanmuQueue.push(msg);
  if (pendingDanmuQueue.length > 120) {
    pendingDanmuQueue.shift();
  }
}

function flushPendingDanmu() {
  if (!player || !playerReady || pendingDanmuQueue.length === 0) {
    return;
  }

  const queue = pendingDanmuQueue.splice(0, pendingDanmuQueue.length);
  queue.forEach((msg) => pushDanmuToPlayer(msg));
}

function createDebugDanmu(text?: string): DanmuMessage {
  return {
    id: `debug-${Date.now()}`,
    timestamp: Date.now(),
    text: text || '[DEBUG] 固定测试弹幕',
    username: 'debug-user',
    nickname: 'Debug',
    schoolName: 'Local Debug Room',
    badge: 'DEBUG',
    source: 'realtime',
  };
}

function exposeDanmuDebugApi() {
  if (typeof window === 'undefined') {
    return;
  }

  (window as any).__rmDanmuDebugLocal = (text?: string) => {
    const debugMsg = createDebugDanmu(text);
    emit('danmu', debugMsg);
    pushDanmuToPlayer(debugMsg);
    console.log('[LivePlayer][Debug] Local danmu injected:', debugMsg);
    return debugMsg;
  };

  (window as any).__rmDanmuDebugSend = async (text?: string) => {
    if (!danmuService.value) {
      console.warn('[LivePlayer][Debug] danmuService not connected');
      return false;
    }

    const content = text || '[DEBUG] 固定测试弹幕';
    await danmuService.value.sendMessage(content, {
      nickname: 'Debug',
      schoolName: 'Local Debug Room',
      badge: 'DEBUG',
      racingAge: '',
      position: 'debug',
      isAdmin: false,
      username: 'debug-user',
    });
    console.log('[LivePlayer][Debug] Realtime send invoked:', content);
    return true;
  };
}

async function initDanmu(roomId: string) {
  if (!roomId) {
    return;
  }

  if (currentRoomId === roomId && danmuService.value) {
    return;
  }

  const token = ++roomSwitchToken;
  currentRoomId = roomId;

  try {
    await destroyDanmu();

    const nextService = new DanmuService({
      includeHistory: true,
      onMessage: (msg) => {
        if (token !== roomSwitchToken) {
          return;
        }
        emit('danmu', msg);
        if (msg.source !== 'history' && danmuFilterStore.matchMessage(msg)) {
          pushDanmuToPlayer(msg);
        }
      },
      onError: (error) => {
        console.error('[LivePlayer] Danmu service error:', error);
      },
    });
    connectingService = nextService;

    await nextService.connect(roomId);
    connectingService = null;

    if (token !== roomSwitchToken) {
      try {
        await nextService.disconnect();
      } catch (error) {
        console.warn('[LivePlayer] Ignore stale service disconnect error:', error);
      }
      return;
    }

    danmuService.value = nextService;
  } catch (error) {
    if (connectingService) {
      try {
        await connectingService.disconnect();
      } catch (disconnectError) {
        console.warn('[LivePlayer] Ignore connect-failure cleanup error:', disconnectError);
      }
      connectingService = null;
    }
    console.error('[LivePlayer] ✗ Failed to init danmu:', error);
  }
}

const uiStore = useUiStore();

async function mountPlayer(url: string) {
  if (!container.value) {
    return;
  }

  destroyPlayer();

  const qualityItems = (props.qualityOptions ?? [])
    .filter((item) => item.src && item.src.startsWith('http'))
    .map((item) => ({
      html: item.label,
      url: item.src,
      default: item.value === props.selectedQualityRes,
    }));

  const plugins: any[] = [
    artplayerPluginDanmuku({
      danmuku: [],
      speed: 5,
      margin: [10, '25%'],
      opacity: 1,
      fontSize: 22,
      antiOverlap: true,
      synchronousPlayback: false,
      emitter: isIFrame,
      filter: danmuFilterStore.matchTrackDanmu,
      beforeEmit: sendDanmuByRealtime,
    }),
  ];

  // PC端启用 Chromecast
  if (!uiStore.isMobile) {
    plugins.push(artplayerPluginChromecast({}));
  }

  const playerOptions: Option = {
    container: container.value,
    url,
    plugins,
    volume: 0.7,
    muted: true,
    autoplay: true,
    autoSize: true,
    autoMini: true,
    setting: true,
    flip: true,
    isLive: true,
    playbackRate: true,
    aspectRatio: true,
    subtitleOffset: true,
    hotkey: true,
    pip: !uiStore.isMobile,
    fullscreen: true,
    fullscreenWeb: !uiStore.isMobile,
    quality: qualityItems.length > 1 ? qualityItems : undefined,
    airplay: true,
    gesture: true,
    screenshot: true,
    mutex: true,
    backdrop: true,
    playsInline: true,
    autoOrientation: true,
    lock: true,
    settings: [
      {
        html: filterActive.value ? `过滤 ${activeFilterCount.value}` : '过滤',
        tooltip: filterSummary.value,
        name: 'danmu-filter',
        icon: '',
        style: {
          color: filterActive.value ? '#ffd04b' : '#fff',
        },
        onClick() {
          filterDialogVisible.value = true;
        },
      },
    ],
    customType: {
      m3u8(video: HTMLVideoElement, m3u8Url: string) {
        if (Hls.isSupported()) {
          const hls = new Hls({
            lowLatencyMode: true,
            liveDurationInfinity: true,
            liveSyncMode: 'edge',
            backBufferLength: 8, // 只保留最近8秒已播放内容
            maxBufferLength: 10, // 向前最多缓冲10秒
            maxMaxBufferLength: 30, // 突破上限30秒
            liveSyncDurationCount: 3, // 距直播边缘3个segment
            maxLiveSyncPlaybackRate: 1.0, // 禁用倍速追赶（避免画面加速）
            liveSyncOnStallIncrease: 0.25, // 卡顿恢复后增加0.25秒缓冲
          });
          hls.loadSource(m3u8Url);
          hls.attachMedia(video);
          player?.on('destroy', () => hls.destroy());
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = m3u8Url;
        }
      },
    },
  };

  player = new Artplayer(playerOptions);
  danmukuPlugin = (player as any).plugins?.artplayerPluginDanmuku;

  // Some browsers still require an explicit play attempt after source mount.
  player.on('ready', () => {
    playerReady = true;
    danmukuPlugin = (player as any).plugins?.artplayerPluginDanmuku;
    flushPendingDanmu();
    try {
      player?.play();
      if (!hasShownAutoplayNotice.value && !uiStore.isMobile) {
        hasShownAutoplayNotice.value = true;
        toast.add({
          severity: 'info',
          summary: '已静音开播',
          life: 2000,
          closable: true,
        });
      }
    } catch {
      // Ignore autoplay rejection; controls remain available for manual play.
    }
  });
}

watch(
  () => props.chatRoomId,
  (roomId) => {
    pendingDanmuQueue.length = 0;
    if (roomId) {
      void initDanmu(roomId);
    } else {
      currentRoomId = null;
      roomSwitchToken += 1;
      void destroyDanmu();
    }
  },
);

exposeDanmuDebugApi();

watch(
  () => props.streamUrl,
  (url) => {
    if (url) {
      mountPlayer(url);
    } else {
      destroyPlayer();
    }
  },
  { immediate: true },
);

onBeforeUnmount(async () => {
  if (typeof window !== 'undefined') {
    delete (window as any).__rmDanmuDebugLocal;
    delete (window as any).__rmDanmuDebugSend;
  }
  roomSwitchToken += 1;
  currentRoomId = null;
  await destroyDanmu();
  destroyPlayer();
});
</script>

<template>
  <div class="player-shell">
    <div v-if="loading" class="overlay center">
      <ProgressSpinner />
    </div>

    <div v-else-if="errorMessage" class="overlay center">
      <Message severity="error" :closable="false">
        {{ errorMessage }}
      </Message>
      <Button class="retry-btn" label="重试加载" size="small" @click="emit('retry')" />
    </div>

    <div v-else-if="!streamUrl" class="overlay center">
      <Message severity="warn" :closable="false"> 暂未获取到直播流地址 </Message>
    </div>

    <div ref="container" class="player-container" />

    <DanmuFilterDialog v-model:visible="filterDialogVisible" />
  </div>
</template>

<style scoped>
.player-shell {
  position: relative;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 260px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

.player-container {
  width: 100%;
  height: 100%;
  min-width: 0;
}

.overlay {
  position: absolute;
  z-index: 4;
  inset: 0;
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.center {
  text-align: center;
}

.retry-btn {
  margin-top: 0.35rem;
}

.player-container :deep(.art-video-player),
.player-container :deep(.art-video-player video),
.player-container :deep(.art-video-player .art-mask),
.player-container :deep(.art-video-player .art-player-app) {
  width: 100%;
  max-width: 100%;
}

:deep(.p-message) {
  max-width: calc(100% - 0.5rem);
  word-break: break-word;
}

@media (width <= 768px) {
  .player-shell {
    min-height: 190px;
  }
}
</style>
