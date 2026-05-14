<script setup lang="ts">
import { storeToRefs } from 'pinia';
import Toast from 'primevue/toast';
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import TopToolbar from './components/header/TopToolbar.vue';
import LiveStage from './components/layout/LiveStage.vue';
import ScheduleArea from './components/layout/ScheduleArea.vue';
import CurrentMatchPanel from './components/panels/CurrentMatchPanel.vue';
import { bindDanmuRoomReset } from './composables/danmuLifecycle';
import { requestNotificationPermissionOnLaunch } from './composables/notificationPermissionOnLaunch';
import { useScheduleNotifyPolling } from './composables/scheduleNotifyClient';
import { useDanmuStore } from './stores/danmu';
import { useRmDataStore } from './stores/rmData';
import { useScheduleNotifyStore } from './stores/scheduleNotify';
import { useUiStore } from './stores/ui';
import { markPerformance } from './utils/observability';
import type { DanmuMessage } from './types/api';
import type { TeamSelectPayload } from './types/teamSelect';

const TeamInfoDialog = defineAsyncComponent(() => import('./components/dialogs/TeamInfoDialog.vue'));

const dataStore = useRmDataStore();
const danmuStore = useDanmuStore();
const uiStore = useUiStore();
const scheduleNotifyStore = useScheduleNotifyStore();

useScheduleNotifyPolling();

const { selectedZoneChatRoomId } = storeToRefs(dataStore);
const { runningMatchForSelectedZone, streamLoading, liveGameInfo } = storeToRefs(dataStore);

const dataDialogVisible = ref(false);
const dataDialogTeam = ref<string | null>(null);
const dataDialogCollege = ref<string | null>(null);
const dataDialogZoneId = ref<string | null>(null);
const dataDialogZoneName = ref<string | null>(null);

function onDanmuReceived(msg: DanmuMessage) {
  danmuStore.addMessage(msg);
}

function onDanmuReset() {
  // Keep cached danmu visible during reconnect; fresh history/realtime messages will update it.
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
  uiStore.initializeUi();
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

    <section v-if="showMatchHero" class="match-hero" :class="{ reserving: !runningMatchForSelectedZone }">
      <CurrentMatchPanel :key="dataStore.selectedZoneId ?? 'zone-empty'" @team-select="onOpenTeamData" />
    </section>

    <LiveStage @danmu="onDanmuReceived" @danmu-reset="onDanmuReset" />

    <ScheduleArea :enabled="enableSecondaryPanels" @team-select="onOpenTeamData" />

    <TeamInfoDialog
      v-model:visible="dataDialogVisible"
      :selected-team="dataDialogTeam"
      :college-name="dataDialogCollege"
      :selected-zone-id="dataDialogZoneId"
      :selected-zone-name="dataDialogZoneName"
      @pick-team="onOpenTeamData"
    />
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

.match-hero.reserving {
  min-height: 7.5rem;
}

@media (max-width: 768px) {
  .app-shell {
    padding: 0.65rem;
  }

  .match-hero.reserving {
    min-height: 6rem;
  }
}
</style>

<style>
html {
  scrollbar-gutter: stable both-edges;
}
</style>
