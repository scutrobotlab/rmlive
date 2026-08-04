<script setup lang="ts">
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Popover from 'primevue/popover';
import Toast from 'primevue/toast';
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, provide, ref } from 'vue';
import TopToolbar from './components/header/TopToolbar.vue';
import LiveStage from './components/layout/LiveStage.vue';
import ScheduleArea from './components/layout/ScheduleArea.vue';
import CurrentMatchPanel from './components/panels/CurrentMatchPanel.vue';
import ErrorBoundary from './components/common/ErrorBoundary.vue';
import { bindDanmuRoomReset } from './composables/danmuLifecycle';
import { requestNotificationPermissionOnLaunch } from './composables/notificationPermissionOnLaunch';
import { useScheduleNotifyPolling } from './composables/scheduleNotifyClient';
import { trackEvent } from './utils/tracking';
import { useDanmuStore } from './stores/danmu';
import { useRmDataStore } from './stores/rmData';
import { useScheduleNotifyStore } from './stores/scheduleNotify';
import { useUiStore } from './stores/ui';
import { markPerformance } from './utils/observability';
import type { DanmuMessage } from './types/api';
import type { TeamSelectPayload } from './types/teamSelect';

const TeamInfoDialog = defineAsyncComponent(() => import('./components/dialogs/TeamInfoDialog.vue'));

const roboMasterLogoUrl = `${import.meta.env.BASE_URL}robomaster-official-logo.png`;
const liveLicenseFiles = [
  `${import.meta.env.BASE_URL}robomaster-live-license-1.png`,
  `${import.meta.env.BASE_URL}robomaster-live-license-2.png`,
];

const dataStore = useRmDataStore();
const danmuStore = useDanmuStore();
const uiStore = useUiStore();
const scheduleNotifyStore = useScheduleNotifyStore();

useScheduleNotifyPolling();

uiStore.initializeUi();

const { selectedZoneChatRoomId } = storeToRefs(dataStore);
const { runningMatchForSelectedZone, streamLoading, liveGameInfo } = storeToRefs(dataStore);

const dataDialogVisible = ref(false);
const dataDialogTeam = ref<string | null>(null);
const dataDialogCollege = ref<string | null>(null);
const dataDialogZoneId = ref<string | null>(null);
const dataDialogZoneName = ref<string | null>(null);
const licensePopover = ref<InstanceType<typeof Popover> | null>(null);
const licenseFilesVisible = ref(false);

function onDanmuReceived(msg: DanmuMessage) {
  danmuStore.addMessage(msg);
}

function onDanmuListReceived(messages: DanmuMessage[]) {
  danmuStore.setMessages(messages);
}

function onDanmuReset() {
  // Keep cached danmu visible during reconnect; fresh history/realtime messages will update it.
}

function toggleLicensePopover(event: Event) {
  licensePopover.value?.toggle(event);
}

provide('toggleLicensePopover', toggleLicensePopover);

function showLicenseFiles() {
  licensePopover.value?.hide();
  licenseFilesVisible.value = true;
}

bindDanmuRoomReset(selectedZoneChatRoomId, danmuStore.clearMessages);

const enableSecondaryPanels = ref(true);

const showMatchHero = computed(() => {
  if (runningMatchForSelectedZone.value) {
    return true;
  }

  return streamLoading.value || !liveGameInfo.value;
});

function onOpenTeamData(payload: string | TeamSelectPayload) {
  const teamName = typeof payload === 'string' ? payload : payload.teamName;
  if (!teamName || teamName === '-') {
    return;
  }
  trackEvent('content.team_data', { teamName });

  dataDialogTeam.value = teamName;
  dataDialogCollege.value = typeof payload === 'string' ? null : (payload.collegeName ?? null);
  const { selectedZoneId, selectedZoneName } = dataStore;
  dataDialogZoneId.value = typeof payload === 'string' ? selectedZoneId : (payload.zoneId ?? selectedZoneId);
  dataDialogZoneName.value = typeof payload === 'string' ? selectedZoneName : (payload.zoneName ?? selectedZoneName);
  dataDialogVisible.value = true;
}

onMounted(() => {
  markPerformance('rm-app-on-mounted');
  requestNotificationPermissionOnLaunch();
  void scheduleNotifyStore.syncPrefsToIdb();
  dataStore.startPolling();
  markPerformance('rm-data-start-dispatched');
});

onBeforeUnmount(() => {
  uiStore.teardownUi();
  dataStore.stopPolling();
});
</script>

<template>
  <main class="app-shell">
    <Toast position="top-right" />
    <TopToolbar />

    <aside v-if="!uiStore.isMobile" class="source-notice" aria-label="内容来源声明">
      <div class="source-summary">
        <img
          :src="roboMasterLogoUrl"
          alt="机甲大师 RoboMaster 官方标识"
          class="source-logo"
          :class="{ 'source-logo-dark': uiStore.isDark }"
        />
        <p>
          <span class="source-attribution">
            <strong>内容来源</strong>
            <a href="https://www.robomaster.com/zh-CN" target="_blank" rel="noopener noreferrer">
              RoboMaster 官方网站
              <span class="source-link-icon" aria-hidden="true">↗</span>
            </a>
          </span>
          <span class="rights-notice">赛事直播相关信息及其一切知识产权归 RoboMaster 所有</span>
        </p>
      </div>
    </aside>

    <Popover ref="licensePopover">
      <section class="license-details" aria-labelledby="license-title">
        <div class="license-heading">
          <span class="license-status-icon" aria-hidden="true"><i class="pi pi-verified" /></span>
          <div>
            <h2 id="license-title">已获赛事直播许可</h2>
            <p>RoboMaster 赛事直播授权</p>
          </div>
        </div>
        <dl>
          <div>
            <dt>授权内容</dt>
            <dd>获取 RoboMaster 官方赛事直播流及公开赛事信息，并用于本网站的交互展示。</dd>
          </div>
          <div>
            <dt>授权用途</dt>
            <dd>仅限非商业性质的观赛、学习与技术交流。</dd>
          </div>
          <div>
            <dt>授权性质</dt>
            <dd>非独占、不可转让、可撤销。</dd>
          </div>
          <div>
            <dt>有效期限</dt>
            <dd>
              <time datetime="2026-07-31">2026 年 7 月 31 日</time>
              至
              <time datetime="2026-08-11">2026 年 8 月 11 日</time>
            </dd>
          </div>
        </dl>
        <div class="license-files">
          <span class="license-supervision">已按照授权许可整改，请广大网友监督</span>
          <Button
            label="查看授权书"
            icon="pi pi-file"
            size="small"
            severity="secondary"
            text
            @click="showLicenseFiles"
          />
        </div>
      </section>
    </Popover>

    <Dialog
      v-model:visible="licenseFilesVisible"
      modal
      dismissable-mask
      header="RoboMaster 赛事直播授权许可书"
      class="license-file-dialog"
    >
      <div class="license-file-pages">
        <figure v-for="(fileUrl, index) in liveLicenseFiles" :key="fileUrl" class="license-file-page">
          <div class="license-image-wrap" @contextmenu.prevent @dragstart.prevent>
            <img
              :src="fileUrl"
              :alt="`RoboMaster 赛事直播授权许可书第 ${index + 1} 页`"
              loading="lazy"
              decoding="async"
              draggable="false"
            />
          </div>
          <figcaption>第 {{ index + 1 }} 页</figcaption>
        </figure>
      </div>
    </Dialog>

    <ErrorBoundary>
      <section v-if="showMatchHero" class="match-hero" :class="{ reserving: !runningMatchForSelectedZone }">
        <CurrentMatchPanel :key="dataStore.selectedZoneId ?? 'zone-empty'" @team-select="onOpenTeamData" />
      </section>
    </ErrorBoundary>

    <ErrorBoundary>
      <LiveStage @danmu="onDanmuReceived" @danmu-list="onDanmuListReceived" @danmu-reset="onDanmuReset" />
    </ErrorBoundary>

    <ScheduleArea :enabled="enableSecondaryPanels" @team-select="onOpenTeamData" />

    <TeamInfoDialog
      v-model:visible="dataDialogVisible"
      :selected-team="dataDialogTeam"
      :college-name="dataDialogCollege"
      :selected-zone-id="dataDialogZoneId"
      :selected-zone-name="dataDialogZoneName"
      @pick-team="onOpenTeamData"
    />

    <footer class="site-footer">
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer"> 蜀ICP备2023005768号-1 </a>
    </footer>
  </main>
</template>

<style scoped>
.app-shell {
  max-width: 1440px;
  margin: 0 auto;
  padding: 1rem;
  box-sizing: border-box;
  overflow-x: clip;
}

.match-hero {
  margin-bottom: 1rem;
}

.source-notice {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin: -0.25rem 0 1rem;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--p-surface-300);
  border-left: 0.3rem solid var(--p-primary-color);
  border-radius: var(--p-border-radius-md);
  background: var(--p-content-background);
}

.source-logo {
  width: 5.5rem;
  height: 2.75rem;
  flex: 0 0 auto;
  object-fit: contain;
}

.source-logo-dark {
  filter: brightness(0) invert(1);
}

.source-summary {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 0.8rem;
  min-width: 0;
}

.source-summary p {
  display: grid;
  flex: 1 1 auto;
  min-width: 0;
  gap: 0.25rem;
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.35;
}

.source-attribution {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.55rem;
}

.rights-notice {
  color: var(--p-text-muted-color);
  font-size: 0.78rem;
}

.source-notice strong {
  color: var(--p-text-color);
}

.source-notice a {
  color: var(--p-primary-color);
  font-weight: 600;
  text-decoration: underline;
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.18em;
}

.source-link-icon {
  font-size: 0.8em;
}

.license-details {
  width: min(21rem, calc(100vw - 3rem));
}

.license-heading {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid var(--p-content-border-color);
}

.license-status-icon {
  display: grid;
  width: 2.4rem;
  height: 2.4rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--p-primary-color) 16%, transparent);
  color: var(--p-primary-color);
  font-size: 1.15rem;
}

.license-heading h2 {
  margin: 0;
  font-size: 1rem;
  line-height: 1.3;
}

.license-heading p {
  margin: 0.15rem 0 0;
  color: var(--p-text-muted-color);
  font-size: 0.78rem;
}

.license-details dl {
  display: grid;
  gap: 0.75rem;
  margin: 0.9rem 0;
}

.license-details dl > div {
  display: grid;
  grid-template-columns: 4rem 1fr;
  gap: 0.6rem;
}

.license-details dt {
  color: var(--p-text-muted-color);
  font-size: 0.78rem;
  font-weight: 600;
}

.license-details dd {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
}

.license-files {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--p-content-border-color);
}

.license-supervision {
  color: var(--p-text-muted-color);
  font-size: 0.75rem;
}

.license-file-dialog {
  width: min(62rem, 94vw);
}

.license-file-dialog :deep(.p-dialog-content) {
  max-height: 78vh;
  padding-top: 0.25rem;
}

.license-file-pages {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.license-file-page {
  min-width: 0;
  margin: 0;
  text-align: center;
}

.license-image-wrap {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--p-surface-300);
  border-radius: var(--p-border-radius-md);
  background: #fff;
  user-select: none;
  -webkit-user-drag: none;
}

.license-image-wrap img {
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  -webkit-user-drag: none;
}

.license-file-page figcaption {
  margin-top: 0.4rem;
  color: var(--p-text-muted-color);
  font-size: 0.75rem;
}

.match-hero.reserving {
  min-height: 7.5rem;
}

.site-footer {
  padding: 1.25rem 0 0.35rem;
  color: var(--p-text-muted-color);
  font-size: 0.78rem;
  text-align: center;
}

.site-footer a {
  color: inherit;
  text-decoration: none;
}

.site-footer a:hover {
  color: var(--p-primary-color);
  text-decoration: underline;
  text-underline-offset: 0.18em;
}

@media (max-width: 768px) {
  .app-shell {
    padding: 0.65rem;
  }

  .source-notice {
    display: grid;
    gap: 0.6rem;
    margin-top: -0.1rem;
    padding: 0.55rem 0.65rem;
  }

  .source-logo {
    width: 4.4rem;
    height: 2.2rem;
  }

  .source-summary {
    width: 100%;
    gap: 0.6rem;
  }

  .source-summary p {
    font-size: 0.8rem;
  }

  .source-attribution {
    display: block;
  }

  .rights-notice {
    font-size: 0.72rem;
  }

  .license-file-pages {
    grid-template-columns: 1fr;
  }

  .match-hero.reserving {
    min-height: 6rem;
  }

  .site-footer {
    padding-top: 1rem;
    font-size: 0.72rem;
  }
}

@media (orientation: landscape) and (min-width: 769px) {
  .license-file-dialog {
    width: min(108vh, calc(100vw - 2rem));
  }

  .license-file-dialog :deep(.p-dialog-content) {
    max-height: calc(100vh - 7rem);
    overflow-y: hidden;
  }

  .license-file-pages {
    grid-template-columns: repeat(2, auto);
    justify-content: center;
  }

  .license-file-page {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .license-image-wrap {
    display: flex;
    max-width: 100%;
    max-height: calc(100dvh - 13.5rem);
  }

  .license-image-wrap img {
    width: auto;
    max-width: 100%;
    height: auto;
    max-height: calc(100dvh - 13.5rem);
    object-fit: contain;
  }
}
</style>

<style>
html {
  scrollbar-gutter: stable both-edges;
}
</style>
