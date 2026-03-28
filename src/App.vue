<script setup lang="ts">
import { bindDanmuRoomReset } from './composables/danmuLifecycle';
import { scheduleDeferredMount } from './composables/deferredMount';
import type { TeamSelectPayload } from './types/teamSelect';
import { useDanmuStore } from './stores/danmu';
import { useRmDataStore } from './stores/rmData';
import { useUiStore } from './stores/ui';
import type { DanmuMessage } from './types/api';
import { storeToRefs } from 'pinia';
import Toast from 'primevue/toast';
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import TopToolbar from './components/header/TopToolbar.vue';
import LiveStage from './components/layout/LiveStage.vue';
import ScheduleArea from './components/layout/ScheduleArea.vue';
import CurrentMatchPanel from './components/panels/CurrentMatchPanel.vue';

const TeamInfoDialog = defineAsyncComponent(() => import('./components/dialogs/TeamInfoDialog.vue'));

const dataStore = useRmDataStore();
const danmuStore = useDanmuStore();
const uiStore = useUiStore();

const { selectedZoneChatRoomId } = storeToRefs(dataStore);

const dataDialogVisible = ref(false);
const dataDialogTeam = ref<string | null>(null);
const dataDialogCollege = ref<string | null>(null);
const dataDialogZoneId = ref<string | null>(null);
const dataDialogZoneName = ref<string | null>(null);

function onDanmuReceived(msg: DanmuMessage) {
  danmuStore.addMessage(msg);
}

bindDanmuRoomReset(selectedZoneChatRoomId, danmuStore.clearMessages);

const enableSecondaryPanels = ref(false);

function onOpenTeamData(payload: string | TeamSelectPayload) {
  const teamName = typeof payload === 'string' ? payload : payload.teamName;
  if (!teamName || teamName === '-') {
    return;
  }

  dataDialogTeam.value = teamName;
  dataDialogCollege.value = typeof payload === 'string' ? null : (payload.collegeName ?? null);
  const { selectedZoneId, selectedZoneName } = dataStore;
  dataDialogZoneId.value =
    typeof payload === 'string' ? selectedZoneId : (payload.zoneId ?? selectedZoneId);
  dataDialogZoneName.value =
    typeof payload === 'string' ? selectedZoneName : (payload.zoneName ?? selectedZoneName);
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
    <TopToolbar />

    <section class="match-hero">
      <CurrentMatchPanel :key="dataStore.selectedZoneId ?? 'zone-empty'" @team-select="onOpenTeamData" />
    </section>

    <LiveStage @danmu="onDanmuReceived" />

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
