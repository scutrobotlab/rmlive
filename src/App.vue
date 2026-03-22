<script setup lang="ts">
import { storeToRefs } from 'pinia';
import Toast from 'primevue/toast';
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import TopToolbar from './components/header/TopToolbar.vue';
import LiveStage from './components/layout/LiveStage.vue';
import ScheduleArea from './components/layout/ScheduleArea.vue';
import CurrentMatchPanel from './components/panels/CurrentMatchPanel.vue';
import { resolveZoneChatRoomId } from './services/chatRoomView';
import { bindDanmuRoomReset } from './services/danmuLifecycle';
import { scheduleDeferredMount } from './services/deferredMount';
import { toPlayerQualityOptions } from './services/rmStreamView';
import { useDanmuStore } from './stores/danmu';
import { useRmDataStore } from './stores/rmData';
import { useUiStore } from './stores/ui';
import type { DanmuMessage } from './types/api';

const MatchDataDialog = defineAsyncComponent(() => import('./components/dialogs/MatchDataDialog.vue'));

const dataStore = useRmDataStore();
const danmuStore = useDanmuStore();
const uiStore = useUiStore();

const {
  currentAndNextMatches,
  robotData,
  schedule,
  groupRankInfo,
  selectedZone,
  selectedZoneId,
  selectedQualityRes,
  streamLoading,
  effectiveStreamUrl,
  effectiveStreamErrorMessage,
  selectedZoneName,
  zoneOptions,
  teamGroupMap,
  groupSections,
  liveGameInfo,
} = storeToRefs(dataStore);

const { isDark, isMobile, nextMatchExpanded } = storeToRefs(uiStore);
const dataDialogVisible = ref(false);
const dataDialogTeam = ref<string | null>(null);

const playerQualityOptions = computed(() => toPlayerQualityOptions(selectedZone.value));

const selectedZoneChatRoomId = computed(() =>
  resolveZoneChatRoomId(liveGameInfo.value, selectedZoneId.value, selectedZoneName.value),
);

function onDanmuReceived(msg: DanmuMessage) {
  danmuStore.addMessage(msg);
}

bindDanmuRoomReset(selectedZoneChatRoomId, danmuStore.clearMessages);

const onZoneChange = dataStore.setZone;
const retryLiveStream = dataStore.retryLiveStream;
const onThemeChange = uiStore.setDarkMode;

const onNextExpandedChange = uiStore.setNextMatchExpanded;
const enableSecondaryPanels = ref(false);

function onOpenTeamData(teamName: string) {
  if (!teamName || teamName === '-') {
    return;
  }

  dataDialogTeam.value = teamName;
  dataDialogVisible.value = true;
}

let stopDeferredMount: (() => void) | null = null;

onMounted(() => {
  uiStore.initializeUi();
  dataStore.startPolling();
  stopDeferredMount = scheduleDeferredMount(() => {
    enableSecondaryPanels.value = true;
  });
});

onBeforeUnmount(() => {
  if (stopDeferredMount) {
    stopDeferredMount();
  }
  uiStore.teardownUi();
  dataStore.stopPolling();
});
</script>

<template>
  <main class="app-shell">
    <Toast position="top-right" />
    <TopToolbar
      :is-mobile="isMobile"
      :is-dark="isDark"
      :selected-zone-id="selectedZoneId"
      :zone-options="zoneOptions"
      @zone-change="onZoneChange"
      @theme-change="onThemeChange"
    />

    <section class="match-hero">
      <CurrentMatchPanel
        :key="selectedZoneId ?? 'zone-empty'"
        :payload="currentAndNextMatches"
        :selected-zone-id="selectedZoneId"
        :selected-zone-name="selectedZoneName"
        :selected-zone-live-state="selectedZone?.liveState ?? null"
        :next-expanded="nextMatchExpanded"
        :team-group-map="teamGroupMap"
        @team-select="onOpenTeamData"
        @update-next-expanded="onNextExpandedChange"
      />
    </section>

    <LiveStage
      :is-mobile="isMobile"
      :stream-url="effectiveStreamUrl"
      :loading="streamLoading"
      :error-message="effectiveStreamErrorMessage"
      :quality-options="playerQualityOptions"
      :selected-quality-res="selectedQualityRes"
      :chat-room-id="selectedZoneChatRoomId"
      @retry="retryLiveStream"
      @danmu="onDanmuReceived"
    />

    <ScheduleArea
      :is-mobile="isMobile"
      :enabled="enableSecondaryPanels"
      :payload="schedule"
      :selected-zone-id="selectedZoneId"
      :team-group-map="teamGroupMap"
      @team-select="onOpenTeamData"
    />

    <MatchDataDialog
      v-model:visible="dataDialogVisible"
      :selected-team="dataDialogTeam"
      :selected-zone-id="selectedZoneId"
      :selected-zone-name="selectedZoneName"
      :group-sections="groupSections"
      :group-rank-info="groupRankInfo"
      :robot-data="robotData"
      @team-select="onOpenTeamData"
    />
  </main>
</template>

<style scoped>
.app-shell {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1rem;
  box-sizing: border-box;
  overflow-x: clip;
}

.match-hero {
  margin-bottom: 1rem;
}

@media (max-width: 768px) {
  .app-shell {
    padding: 0.65rem;
  }
}
</style>
