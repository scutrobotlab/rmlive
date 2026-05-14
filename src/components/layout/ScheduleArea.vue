<script setup lang="ts">
import { useRmDataStore } from '@/stores/rmData';
import { useUiStore } from '@/stores/ui';
import { storeToRefs } from 'pinia';
import SchedulePanel from '../panels/SchedulePanel.vue';

import type { TeamSelectPayload } from '@/types/teamSelect';

defineProps<{ enabled: boolean }>();

const emit = defineEmits<{
  teamSelect: [payload: TeamSelectPayload];
}>();

const uiStore = useUiStore();
const { isMobile } = storeToRefs(uiStore);

const dataStore = useRmDataStore();
const { selectedZoneId, teamGroupMap } = storeToRefs(dataStore);

function onTeamSelect(payload: TeamSelectPayload) {
  emit('teamSelect', payload);
}
</script>

<template>
  <section id="rm-schedule-panel" class="lower-grid">
    <div class="schedule-cell">
      <SchedulePanel
        :selected-zone-id="selectedZoneId"
        :team-group-map="teamGroupMap"
        :is-mobile="isMobile"
        @team-select="onTeamSelect"
      />
    </div>
  </section>
</template>

<style scoped>
.lower-grid {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
  grid-template-columns: 1fr;
}

.schedule-cell {
  min-width: 0;
}
</style>
