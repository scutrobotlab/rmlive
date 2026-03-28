<script setup lang="ts">
import { useRmDataStore } from '@/stores/rmData';
import { useUiStore } from '@/stores/ui';
import Skeleton from 'primevue/skeleton';
import { storeToRefs } from 'pinia';
import { defineAsyncComponent } from 'vue';

import type { TeamSelectPayload } from '@/types/teamSelect';

interface Props {
  enabled: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  teamSelect: [payload: TeamSelectPayload];
}>();

const uiStore = useUiStore();
const { isMobile } = storeToRefs(uiStore);

const dataStore = useRmDataStore();
const { selectedZoneId, teamGroupMap } = storeToRefs(dataStore);

const SchedulePanel = defineAsyncComponent(() => import('../panels/SchedulePanel.vue'));

function onTeamSelect(payload: TeamSelectPayload) {
  emit('teamSelect', payload);
}
</script>

<template>
  <section id="rm-schedule-panel" class="lower-grid">
    <div v-if="enabled" class="schedule-cell">
      <SchedulePanel
        :selected-zone-id="selectedZoneId"
        :team-group-map="teamGroupMap"
        :is-mobile="isMobile"
        @team-select="onTeamSelect"
      />
    </div>

    <div v-else class="schedule-placeholder">
      <Skeleton width="100%" height="18rem" borderRadius="12px" />
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

.schedule-placeholder {
  min-width: 0;
}
</style>
