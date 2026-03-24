<script setup lang="ts">
import Card from 'primevue/card';
import Tab from 'primevue/tab';
import TabList from 'primevue/tablist';
import TabPanel from 'primevue/tabpanel';
import TabPanels from 'primevue/tabpanels';
import Tabs from 'primevue/tabs';
import { computed, ref, watch } from 'vue';
import { getScheduleRows, isResultStatus } from '../../services/scheduleView';
import type { LiveGameInfo, Schedule } from '../../types/api';
import ScheduleTableBlock from './ScheduleTableBlock.vue';

interface Props {
  payload: Schedule | null;
  liveGameInfo: LiveGameInfo | null;
  selectedZoneId: string | null;
  teamGroupMap?: Record<string, { group: string; rank: string }>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  teamSelect: [teamName: string];
}>();
const rows = computed(() => getScheduleRows(props.payload, props.selectedZoneId, props.liveGameInfo));
const tab = ref<'schedule' | 'result'>('schedule');
const scheduleRows = computed(() =>
  rows.value
    .filter((item) => !isResultStatus(item.statusRaw))
    .slice()
    .sort((a, b) => a.startedAtTs - b.startedAtTs),
);
const resultRows = computed(() =>
  rows.value
    .filter((item) => isResultStatus(item.statusRaw))
    .slice()
    .sort((a, b) => b.startedAtTs - a.startedAtTs),
);

watch(
  () => [scheduleRows.value.length, resultRows.value.length] as const,
  ([scheduleCount, resultCount]) => {
    if (tab.value === 'schedule' && scheduleCount === 0 && resultCount > 0) {
      tab.value = 'result';
      return;
    }

    if (tab.value === 'result' && resultCount === 0 && scheduleCount > 0) {
      tab.value = 'schedule';
    }
  },
  { immediate: true },
);

function onSelectTeam(teamName: string) {
  emit('teamSelect', teamName);
}
</script>

<template>
  <Card>
    <template #title> 赛程安排 </template>
    <template #content>
      <Tabs v-model:value="tab">
        <TabList>
          <Tab value="schedule">
            <span class="tab-title"><i class="pi pi-calendar" />赛程</span>
          </Tab>
          <Tab value="result">
            <span class="tab-title"><i class="pi pi-trophy" />赛果</span>
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel value="schedule">
            <ScheduleTableBlock :rows="scheduleRows" :team-group-map="props.teamGroupMap" @team-select="onSelectTeam" />
          </TabPanel>

          <TabPanel value="result">
            <ScheduleTableBlock :rows="resultRows" :team-group-map="props.teamGroupMap" @team-select="onSelectTeam" />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>
  </Card>
</template>

<style scoped>
.tab-title {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.tab-title .pi {
  font-size: 0.76rem;
}
</style>
