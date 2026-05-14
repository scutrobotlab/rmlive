<script setup lang="ts">
import { useMatchEngagementStore } from '@/stores/matchEngagement';
import { useRmDataStore } from '@/stores/rmData';
import { useUiStore } from '@/stores/ui';
import type { TeamSelectPayload } from '@/types/teamSelect';
import { storeToRefs } from 'pinia';
import Card from 'primevue/card';
import Skeleton from 'primevue/skeleton';
import { computed, watch } from 'vue';
import ScheduleItem from '../common/ScheduleItem.vue';
import MatchSupportButton from './MatchSupportButton.vue';

const emit = defineEmits<{
  teamSelect: [payload: TeamSelectPayload];
}>();

const uiStore = useUiStore();
const dataStore = useRmDataStore();
const matchEngagement = useMatchEngagementStore();

const { runningMatchForSelectedZone, streamLoading, liveGameInfo } = storeToRefs(dataStore);
const { pkEnabled } = storeToRefs(uiStore);

const runningLiving = computed(() => {
  const m = runningMatchForSelectedZone.value;
  if (!m) {
    return false;
  }
  const u = String(m.statusRaw ?? '').toUpperCase();
  return ['STARTED', 'PLAYING'].includes(u);
});

const showMatchSkeleton = computed(() => {
  if (runningMatchForSelectedZone.value) {
    return false;
  }

  return streamLoading.value || !liveGameInfo.value;
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
          <template v-if="runningLiving && pkEnabled" #redTeamAction>
            <MatchSupportButton side="red" />
          </template>
          <template v-if="runningLiving && pkEnabled" #blueTeamAction>
            <MatchSupportButton side="blue" />
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
      <template v-if="runningLiving && pkEnabled" #redTeamAction>
        <MatchSupportButton side="red" />
      </template>
      <template v-if="runningLiving && pkEnabled" #blueTeamAction>
        <MatchSupportButton side="blue" />
      </template>
    </ScheduleItem>
  </div>

  <Card v-else-if="showMatchSkeleton" class="match-placeholder-card">
    <template #content>
      <div class="match-placeholder">
        <Skeleton width="100%" height="1.35rem" borderRadius="8px" />
        <div class="placeholder-row">
          <Skeleton width="32%" height="3.2rem" borderRadius="10px" />
          <Skeleton width="10%" height="2.4rem" borderRadius="8px" />
          <Skeleton width="32%" height="3.2rem" borderRadius="10px" />
        </div>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.match-placeholder-card {
  min-height: 7.2rem;
}

.match-placeholder {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.placeholder-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.55rem;
}

@media (max-width: 768px) {
  .match-placeholder-card {
    min-height: 6rem;
  }
}
</style>
