<script setup lang="ts">
import { useMatchEngagementStore } from '@/stores/matchEngagement';
import { useRmDataStore } from '@/stores/rmData';
import { useUiStore } from '@/stores/ui';
import type { TeamSelectPayload } from '@/types/teamSelect';
import { storeToRefs } from 'pinia';
import Card from 'primevue/card';
import { computed, watch } from 'vue';
import ScheduleItem from '../common/ScheduleItem.vue';
import MatchFirepowerBar from './MatchFirepowerBar.vue';

const emit = defineEmits<{
  teamSelect: [payload: TeamSelectPayload];
}>();

const uiStore = useUiStore();
const dataStore = useRmDataStore();
const matchEngagement = useMatchEngagementStore();

const { runningMatchForSelectedZone } = storeToRefs(dataStore);

const runningLiving = computed(() => {
  const m = runningMatchForSelectedZone.value;
  if (!m) {
    return false;
  }
  const u = String(m.statusRaw ?? '').toUpperCase();
  return ['STARTED', 'PLAYING'].includes(u);
});

watch(
  runningMatchForSelectedZone,
  (m) => {
    matchEngagement.applyRunningMatch(m);
    void matchEngagement.refreshHydrate({ trackLoading: true });
  },
  { immediate: true },
);

function onSelectTeam(payload: TeamSelectPayload) {
  emit('teamSelect', payload);
}
</script>

<template>
  <div v-if="runningMatchForSelectedZone">
    <Card v-if="!uiStore.isMobile">
      <template #content>
        <ScheduleItem
          :item="runningMatchForSelectedZone"
          :team-group-map="dataStore.teamGroupMap"
          @team-select="onSelectTeam"
        >
          <template v-if="runningLiving" #belowTeams>
            <MatchFirepowerBar />
          </template>
        </ScheduleItem>
      </template>
    </Card>
    <ScheduleItem
      v-else
      :item="runningMatchForSelectedZone"
      :team-group-map="dataStore.teamGroupMap"
      @team-select="onSelectTeam"
    >
      <template v-if="runningLiving" #belowTeams>
        <MatchFirepowerBar />
      </template>
    </ScheduleItem>
  </div>
</template>
