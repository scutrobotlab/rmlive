<script setup lang="ts">
import Skeleton from 'primevue/skeleton';
import { defineAsyncComponent } from 'vue';
import type { Schedule } from '../../types/api';

interface Props {
  isMobile: boolean;
  enabled: boolean;
  payload: Schedule | null;
  selectedZoneId: string | null;
  teamGroupMap?: Record<string, { group: string; rank: string }>;
}

defineProps<Props>();

const emit = defineEmits<{
  teamSelect: [teamName: string];
}>();

const SchedulePanel = defineAsyncComponent(() => import('../panels/SchedulePanel.vue'));
const MobileSchedulePanel = defineAsyncComponent(() => import('../panels/MobileSchedulePanel.vue'));

function onTeamSelect(teamName: string) {
  emit('teamSelect', teamName);
}
</script>

<template>
  <section class="lower-grid">
    <div v-if="enabled" class="schedule-cell">
      <SchedulePanel
        v-if="!isMobile"
        :payload="payload"
        :selected-zone-id="selectedZoneId"
        :team-group-map="teamGroupMap"
        @team-select="onTeamSelect"
      />
      <MobileSchedulePanel
        v-else
        :payload="payload"
        :selected-zone-id="selectedZoneId"
        :team-group-map="teamGroupMap"
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

.schedule-placeholder {
  opacity: 0.6;
}
</style>
