import type Artplayer from 'artplayer';
import type { Option } from 'artplayer';
import type { QualityOption, PerspectiveOption, DanmuMessage } from '@/types/api';
import { useUiStore } from '@/stores/ui';
import { trackEvent } from '@/utils/tracking';
import { markPerformance } from '@/utils/observability';
import { onMounted, onScopeDispose, ref, watch, type Ref } from 'vue';

interface UseStreamPlayerOptions {
  container: Ref<HTMLDivElement | null>;
  isIFrame: boolean;
  danmuEnabled: boolean;
  streamUrl: Ref<string | null>;
  qualityOptions: Ref<QualityOption[] | undefined>;
  selectedQualityRes: Ref<string | null | undefined>;
  perspectiveOptions: Ref<PerspectiveOption[] | undefined>;
  selectedPerspectiveKey: Ref<string | null | undefined>;
  danmuTrackFilter: (danmu: any) => boolean;
  danmuSender: (danmu: any) => boolean;
  filterActive: Ref<boolean>;
  activeFilterCount: Ref<number>;
  filterSummary: Ref<string>;
  onShowFilterDialog: () => void;
  onRetry: () => void;
  onQualityChange: (res: string) => void;
  onPerspectiveChange: (key: string) => void;
  onPlayerReady: () => void;
  externalDanmukuPlugin?: Ref<any>;
}

const SOFT_RECOVERY_MIN_INTERVAL_MS = 5000;

export function useStreamPlayer(options: UseStreamPlayerOptions) {
  const uiStore = useUiStore();

  let player: Artplayer | null = null;
  const playerReadyInternal = ref(false);
  function setPlayerReady(val: boolean) {
    playerReadyInternal.value = val;
  }
  function isPlayerReady() {
    return playerReadyInternal.value;
  }
  let liveHls: {
    destroy: () => void;
    startLoad?: (startPosition?: number) => void;
    recoverMediaError?: () => void;
    liveSyncPosition?: number | null;
  } | null = null;
  let hlsMediaRecoveryCount = 0;
  let hlsLastMediaRecoveryAt = 0;
  let currentAppliedStreamUrl: string | null = null;
  let streamSwitchToken = 0;
  let latestRequestedStreamUrl: string | null = null;
  let playerMountToken = 0;
  let playerHealthTimer: number | null = null;
  let healthVideo: HTMLVideoElement | null = null;
  let playerHealthCleanup: (() => void) | null = null;
  let lastProgressCheckAt = 0;
  let lastObservedTime = 0;
  let stalledSince = 0;
  let lastRecoveryAt = 0;
  let lastUserGestureAt = 0;
  let userPausedPlayback = false;
  let retryRemountCount = 0;

  const isStreamSwitching = ref(false);
  const danmukuPluginRef: Ref<any> = options.externalDanmukuPlugin ?? ref(null);

  function destroyAttachedHls() {
    if (liveHls) {
      liveHls.destroy();
      liveHls = null;
    }
    hlsMediaRecoveryCount = 0;
    hlsLastMediaRecoveryAt = 0;
  }

  function isDocumentVisible() {
    return typeof document === 'undefined' || document.visibilityState !== 'hidden';
  }

  function tryPlayVideo(video: HTMLVideoElement) {
    const playResult = video.play();
    if (playResult && typeof playResult.catch === 'function') {
      playResult.catch(() => {
        // Autoplay can be denied after user interaction changes; leave controls available.
      });
    }
  }

  function triggerStreamRecovery(video: HTMLVideoElement, forceRemount = false) {
    if (!options.streamUrl.value || !playerReadyInternal.value || !player || !isDocumentVisible()) {
      return;
    }

    const now = Date.now();
    if (!forceRemount && now - lastRecoveryAt < SOFT_RECOVERY_MIN_INTERVAL_MS) {
      return;
    }
    lastRecoveryAt = now;

    if (!forceRemount) {
      try {
        liveHls?.startLoad?.();
        tryPlayVideo(video);
        return;
      } catch (error) {
        console.warn('[LivePlayer] soft stream recovery failed', error);
      }
    }

    retryRemountCount += 1;
    if (retryRemountCount === 1) {
      options.onRetry();
      return;
    }

    retryRemountCount = 0;
    void remountCurrentStream(options.streamUrl.value);
  }

  async function remountCurrentStream(url: string) {
    if (!options.container.value) {
      return;
    }

    isStreamSwitching.value = true;
    try {
      await exitPipIfNeeded();
      if (options.streamUrl.value !== url) {
        return;
      }
      destroyPlayer();
      latestRequestedStreamUrl = url;
      await mountPlayer(url);
    } finally {
      isStreamSwitching.value = false;
    }
  }

  function stopPlayerHealthMonitor() {
    playerHealthCleanup?.();
    playerHealthCleanup = null;
    if (playerHealthTimer !== null) {
      window.clearInterval(playerHealthTimer);
      playerHealthTimer = null;
    }
    healthVideo = null;
    lastProgressCheckAt = 0;
    lastObservedTime = 0;
    stalledSince = 0;
    lastRecoveryAt = 0;
    lastUserGestureAt = 0;
    userPausedPlayback = false;
    retryRemountCount = 0;
  }

  function checkPlayerHealth() {
    const video = healthVideo;
    if (!video || !options.streamUrl.value || !playerReadyInternal.value || !player || !isDocumentVisible()) {
      return;
    }

    const now = Date.now();
    const currentTime = video.currentTime;
    const progressed = Math.abs(currentTime - lastObservedTime) > 0.08;

    if (!lastProgressCheckAt || progressed) {
      lastObservedTime = currentTime;
      lastProgressCheckAt = now;
      stalledSince = 0;
      retryRemountCount = 0;
      return;
    }

    const readyToPlay = video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;
    const likelyStalled = !video.paused && !video.ended && !progressed && now - lastProgressCheckAt > 8000;
    const passivePause = video.paused && !video.ended && !userPausedPlayback && now - lastUserGestureAt > 1500;

    if (passivePause || likelyStalled || !readyToPlay) {
      if (!stalledSince) {
        stalledSince = now;
      }
      triggerStreamRecovery(video, now - stalledSince > 20000);
    }
  }

  function startPlayerHealthMonitor(video: HTMLVideoElement) {
    stopPlayerHealthMonitor();
    healthVideo = video;
    lastObservedTime = video.currentTime;
    lastProgressCheckAt = Date.now();

    const markUserGesture = () => {
      lastUserGestureAt = Date.now();
    };
    const onPlay = () => {
      userPausedPlayback = false;
      retryRemountCount = 0;
    };
    const onPause = () => {
      userPausedPlayback = Date.now() - lastUserGestureAt < 1500;
    };
    const onWaiting = () => {
      if (!stalledSince) {
        stalledSince = Date.now();
      }
      triggerStreamRecovery(video);
    };
    const onVisibilityReturn = () => {
      if (isDocumentVisible() && !userPausedPlayback && !video.ended) {
        liveHls?.startLoad?.();
        tryPlayVideo(video);
      }
    };

    options.container.value?.addEventListener('pointerdown', markUserGesture, { passive: true });
    options.container.value?.addEventListener('keydown', markUserGesture);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('stalled', onWaiting);
    video.addEventListener('suspend', onWaiting);
    document.addEventListener('visibilitychange', onVisibilityReturn);
    window.addEventListener('pageshow', onVisibilityReturn);

    playerHealthTimer = window.setInterval(checkPlayerHealth, 2500);

    playerHealthCleanup = () => {
      options.container.value?.removeEventListener('pointerdown', markUserGesture);
      options.container.value?.removeEventListener('keydown', markUserGesture);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('stalled', onWaiting);
      video.removeEventListener('suspend', onWaiting);
      document.removeEventListener('visibilitychange', onVisibilityReturn);
      window.removeEventListener('pageshow', onVisibilityReturn);
    };
  }

  async function exitPipIfNeeded() {
    const vid = options.container.value?.querySelector('video');
    if (!vid || document.pictureInPictureElement !== vid) {
      return;
    }
    try {
      await document.exitPictureInPicture();
    } catch {
      // ignore InvalidStateError, etc.
    }
  }

  function destroyPlayer() {
    playerMountToken += 1;
    streamSwitchToken += 1;
    isStreamSwitching.value = false;
    stopPlayerHealthMonitor();
    destroyAttachedHls();
    if (player) {
      player.destroy(false);
      player = null;
    }
    currentAppliedStreamUrl = null;
    danmukuPluginRef.value = null;
    playerReadyInternal.value = false;
  }

  function waitForVideoPlayable(video: HTMLVideoElement | null, timeoutMs = 2200): Promise<void> {
    if (!video) {
      return Promise.resolve();
    }

    if (video.readyState >= 3 && !video.paused) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let settled = false;
      const cleanup = () => {
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('playing', onReady);
        video.removeEventListener('loadeddata', onReady);
      };
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve();
      };
      const onReady = () => finish();

      video.addEventListener('canplay', onReady, { once: true });
      video.addEventListener('playing', onReady, { once: true });
      video.addEventListener('loadeddata', onReady, { once: true });

      setTimeout(finish, timeoutMs);
    });
  }

  function applyMobileInlineVideoAttrs() {
    if (!uiStore.isMobile) {
      return;
    }

    const video = options.container.value?.querySelector('video');
    if (!video) {
      return;
    }

    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('x5-playsinline', 'true');
    video.setAttribute('x5-video-orientation', 'landscape');
    video.removeAttribute('x5-video-player-type');
  }

  async function mountPlayer(url: string) {
    if (!options.container.value) {
      return;
    }

    destroyPlayer();
    const mountToken = ++playerMountToken;
    markPerformance('rm-player-mount-start');

    const [artplayerModule, hlsModule, danmukuModule, chromecastModule] = await Promise.all([
      import('artplayer'),
      import('hls.js/dist/hls.js'),
      options.danmuEnabled ? import('artplayer-plugin-danmuku') : Promise.resolve(null),
      uiStore.isMobile ? Promise.resolve(null) : import('artplayer-plugin-chromecast'),
    ]);

    if (mountToken !== playerMountToken || !options.container.value) {
      return;
    }

    const ArtplayerCtor = artplayerModule.default;
    const HlsCtor = hlsModule.default;
    const artplayerPluginDanmuku = danmukuModule?.default;
    const artplayerPluginChromecast = chromecastModule?.default;

    const playerSettings = buildPlayerSettings();

    const plugins: any[] = [];
    if (options.danmuEnabled && artplayerPluginDanmuku) {
      plugins.push(
        artplayerPluginDanmuku({
          danmuku: [],
          speed: 5,
          margin: [10, '25%'],
          opacity: 1,
          fontSize: 22,
          antiOverlap: true,
          synchronousPlayback: false,
          emitter: options.isIFrame && !uiStore.isMobile,
          filter: options.danmuTrackFilter,
          beforeEmit: options.danmuSender,
        }),
      );
    }

    if (!uiStore.isMobile && artplayerPluginChromecast) {
      plugins.push(artplayerPluginChromecast({}));
    }

    const playerOptions: Option = {
      container: options.container.value,
      url,
      plugins,
      volume: 0.7,
      muted: true,
      autoplay: true,
      autoSize: true,
      autoMini: true,
      setting: true,
      flip: false,
      isLive: true,
      playbackRate: false,
      aspectRatio: true,
      subtitleOffset: false,
      hotkey: true,
      pip: !uiStore.isMobile,
      fullscreen: true,
      fullscreenWeb: !uiStore.isMobile,
      airplay: true,
      gesture: true,
      screenshot: false,
      mutex: true,
      backdrop: true,
      playsInline: true,
      autoOrientation: true,
      lock: true,
      moreVideoAttr: {
        playsInline: true,
      },
      settings: playerSettings,
      customType: {
        m3u8(video: HTMLVideoElement, m3u8Url: string) {
          destroyAttachedHls();
          if (HlsCtor.isSupported()) {
            const hlsErrorEvent = (HlsCtor as any).Events?.ERROR ?? 'hlsError';
            const hlsNetworkErrorType = (HlsCtor as any).ErrorTypes?.NETWORK_ERROR ?? 'networkError';
            const hlsMediaErrorType = (HlsCtor as any).ErrorTypes?.MEDIA_ERROR ?? 'mediaError';
            const hlsBufferStalledDetail = (HlsCtor as any).ErrorDetails?.BUFFER_STALLED_ERROR ?? 'bufferStalledError';

            const hls = new HlsCtor({
              lowLatencyMode: false,
              liveDurationInfinity: true,
              liveSyncMode: 'buffered',
              backBufferLength: 30,
              maxBufferLength: 30,
              maxMaxBufferLength: 60,
              maxBufferHole: 1,
              liveSyncDurationCount: 2,
              liveMaxLatencyDurationCount: 3,
              maxLiveSyncPlaybackRate: 1,
              liveSyncOnStallIncrease: 1,
              nudgeOffset: 0.1,
              nudgeMaxRetry: 6,
              enableWorker: true,
              startFragPrefetch: true,
              testBandwidth: false,
              manifestLoadingMaxRetry: 6,
              manifestLoadingRetryDelay: 700,
              manifestLoadingMaxRetryTimeout: 6000,
              levelLoadingMaxRetry: 6,
              levelLoadingRetryDelay: 1000,
              levelLoadingMaxRetryTimeout: 8000,
              fragLoadingMaxRetry: 8,
              fragLoadingRetryDelay: 1000,
              fragLoadingMaxRetryTimeout: 12000,
              startLevel: -1,
            });

            hls.on(hlsErrorEvent, (_event: unknown, data: any) => {
              if (!data) {
                return;
              }

              if (data.fatal) {
                if (data.type === hlsNetworkErrorType) {
                  console.warn('[LivePlayer] HLS fatal network error, restart loading', data);
                  hls.startLoad();
                  return;
                }

                if (data.type === hlsMediaErrorType) {
                  const now = Date.now();
                  if (now - hlsLastMediaRecoveryAt > 15000) {
                    hlsMediaRecoveryCount = 0;
                  }
                  hlsLastMediaRecoveryAt = now;
                  hlsMediaRecoveryCount += 1;

                  if (hlsMediaRecoveryCount <= 2) {
                    console.warn('[LivePlayer] HLS fatal media error, recover media', data);
                    hls.recoverMediaError();
                    return;
                  }

                  if (hlsMediaRecoveryCount === 3 && typeof hls.swapAudioCodec === 'function') {
                    console.warn('[LivePlayer] HLS media error persists, swap audio codec + recover', data);
                    hls.swapAudioCodec();
                    hls.recoverMediaError();
                    return;
                  }

                  console.warn('[LivePlayer] HLS media error recovery exhausted, remount stream', data);
                  options.onRetry();
                  return;
                }

                console.warn('[LivePlayer] HLS unrecoverable fatal error, remount stream', data);
                options.onRetry();
                return;
              }

              if (data.details === hlsBufferStalledDetail) {
                try {
                  void video.play();
                } catch {
                  // ignore auto-play rejection; user can continue manually
                }
              }
            });

            liveHls = hls;
            hls.loadSource(m3u8Url);
            hls.attachMedia(video);
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = m3u8Url;
          }
        },
      },
    };

    player = new ArtplayerCtor(playerOptions);
    currentAppliedStreamUrl = url;
    applyMobileInlineVideoAttrs();
    danmukuPluginRef.value = options.danmuEnabled ? (player as any).plugins?.artplayerPluginDanmuku : null;

    player.on('ready', () => {
      if (mountToken !== playerMountToken) {
        return;
      }

      playerReadyInternal.value = true;
      applyMobileInlineVideoAttrs();
      const video = options.container.value?.querySelector('video') ?? null;
      if (video) {
        startPlayerHealthMonitor(video);
      }
      markPerformance('rm-player-ready');
      trackEvent('player.ready', {});
      danmukuPluginRef.value = options.danmuEnabled ? (player as any).plugins?.artplayerPluginDanmuku : null;
      updateQualityControl();
      updatePerspectiveSetting();
      options.onPlayerReady();
      try {
        player?.play();
      } catch {
        // Ignore autoplay rejection; controls remain available for manual play.
      }
    });
  }

  async function applyStreamUrl(url: string) {
    if (!options.container.value) {
      return;
    }

    latestRequestedStreamUrl = url;
    const requestToken = ++streamSwitchToken;

    markPerformance('rm-player-url-applied');

    if (url === currentAppliedStreamUrl && player && playerReadyInternal.value) {
      if (requestToken === streamSwitchToken) {
        isStreamSwitching.value = false;
      }
      return;
    }

    if (player && playerReadyInternal.value) {
      isStreamSwitching.value = true;
      try {
        await exitPipIfNeeded();
        if (requestToken !== streamSwitchToken) {
          return;
        }
        await player.switchUrl(url);
        if (requestToken !== streamSwitchToken) {
          const pending = latestRequestedStreamUrl;
          if (pending && pending !== url) {
            void applyStreamUrl(pending);
          }
          return;
        }
        currentAppliedStreamUrl = url;
        const video = options.container.value?.querySelector('video') ?? null;
        await waitForVideoPlayable(video);
        if (requestToken !== streamSwitchToken) {
          const pending = latestRequestedStreamUrl;
          if (pending && pending !== url) {
            void applyStreamUrl(pending);
          }
          return;
        }
        updateQualityControl();
        return;
      } catch (error) {
        console.warn('[LivePlayer] switchUrl failed, remounting player', error);
      } finally {
        if (requestToken === streamSwitchToken) {
          isStreamSwitching.value = false;
        }
      }
    }

    isStreamSwitching.value = true;
    await mountPlayer(url);
    if (requestToken === streamSwitchToken) {
      isStreamSwitching.value = false;
    }
  }

  function buildQualityItems() {
    return (options.qualityOptions.value ?? [])
      .filter((item) => item.src && item.src.startsWith('http'))
      .map((item) => ({
        html: item.label,
        url: item.src,
        value: item.value,
        default: item.value === options.selectedQualityRes.value,
      }));
  }

  function buildPlayerSettings(): NonNullable<Option['settings']> {
    const settings: NonNullable<Option['settings']> = [];

    const perspectiveOpts = options.perspectiveOptions.value ?? [];
    if (perspectiveOpts.length > 1) {
      const selectedPerspective =
        perspectiveOpts.find((item) => item.value === options.selectedPerspectiveKey.value) ?? perspectiveOpts[0];
      settings.push({
        name: 'perspective',
        html: '视角',
        tooltip: selectedPerspective?.label ?? '主视角',
        icon: '',
        selector: perspectiveOpts.map((item) => ({
          html: item.label,
          value: item.value,
          default: item.value === selectedPerspective?.value,
        })),
        onSelect(item) {
          const value = typeof item.value === 'string' ? item.value : '';
          if (value) {
            options.onPerspectiveChange(value);
            trackEvent('player.perspective_change', { perspective: value });
          }
          return item.html;
        },
      });
    }

    if (options.danmuEnabled) {
      settings.push({
        html: options.filterActive.value ? `过滤 ${options.activeFilterCount.value}` : '过滤',
        tooltip: options.filterSummary.value,
        name: 'danmu-filter',
        icon: '',
        style: {
          color: options.filterActive.value ? '#ffd04b' : '#fff',
        },
        onClick() {
          options.onShowFilterDialog();
        },
      });
    }

    return settings;
  }

  function updatePerspectiveSetting() {
    if (!player || !playerReadyInternal.value) {
      return;
    }

    const perspectiveSetting = buildPlayerSettings().find((item) => item.name === 'perspective');
    const p = player as Artplayer & {
      setting?: { update?: (option: NonNullable<Option['settings']>[number]) => void; remove?: (name: string) => void };
    };

    try {
      if (perspectiveSetting) {
        p.setting?.update?.(perspectiveSetting);
      } else {
        p.setting?.remove?.('perspective');
      }
    } catch {
      // Ignore menu refresh races while Artplayer is mounting.
    }
  }

  function updateQualityControl() {
    if (!player || !playerReadyInternal.value) {
      return;
    }
    const qualityItems = buildQualityItems();
    const p = player as Artplayer & {
      controls?: {
        remove?: (name: string) => void;
        update?: (option: NonNullable<Option['controls']>[number]) => void;
      };
    };
    if (qualityItems.length > 1) {
      const selectedQuality = qualityItems.find((item) => item.default) ?? qualityItems[0];
      p.controls?.update?.({
        name: 'quality',
        position: 'right',
        index: 10,
        style: {
          marginRight: '10px',
        },
        html: selectedQuality?.html ?? '',
        selector: qualityItems,
        async onSelect(item) {
          const url = typeof item.url === 'string' ? item.url : '';
          const value = typeof item.value === 'string' ? item.value : '';
          if (url && player) {
            await player.switchQuality(url);
            currentAppliedStreamUrl = url;
          }
          if (value) {
            options.onQualityChange(value);
            trackEvent('player.quality_change', { quality: value });
          }
          return item.html;
        },
      });
    } else {
      try {
        p.controls?.remove?.('quality');
      } catch {
        // no quality control to remove
      }
    }
  }

  watch(
    options.streamUrl,
    (url) => {
      if (url) {
        void applyStreamUrl(url);
      } else {
        destroyPlayer();
      }
    },
  );

  onMounted(() => {
    const url = options.streamUrl.value;
    if (url) {
      void applyStreamUrl(url);
    }
  });

  watch(
    [options.qualityOptions, options.selectedQualityRes] as const,
    () => {
      if (player && playerReadyInternal.value) {
        updateQualityControl();
      }
    },
  );

  watch(
    [options.perspectiveOptions, options.selectedPerspectiveKey] as const,
    () => {
      updatePerspectiveSetting();
    },
  );

  onScopeDispose(() => {
    destroyPlayer();
  });

  return {
    playerReady: playerReadyInternal,
    isStreamSwitching,
    danmukuPlugin: danmukuPluginRef,
    mountPlayer,
    applyStreamUrl,
    destroyPlayer,
    updateQualityControl,
    updatePerspectiveSetting,
  };
}
