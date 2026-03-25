<script setup lang="ts">
import Card from 'primevue/card';
import Select from 'primevue/select';
import Tab from 'primevue/tab';
import TabList from 'primevue/tablist';
import TabPanel from 'primevue/tabpanel';
import TabPanels from 'primevue/tabpanels';
import Tabs from 'primevue/tabs';
import { computed, ref, watch } from 'vue';
import {
  filterScheduleRowsBySchool,
  getScheduleRows,
  getScheduleSchoolOptions,
  isResultStatus,
} from '../../services/scheduleView';
import type { LiveGameInfo, Schedule } from '../../types/api';
import ScheduleCardList from './ScheduleCardList.vue';

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
const selectedSchool = ref<string | null>(null);
const schoolOptions = computed(() => getScheduleSchoolOptions(rows.value));
const filteredRows = computed(() => filterScheduleRowsBySchool(rows.value, selectedSchool.value));
const scheduleRows = computed(() =>
  filteredRows.value
    .filter((item) => !isResultStatus(item.statusRaw))
    .slice()
    .sort((a, b) => a.startedAtTs - b.startedAtTs),
);
const resultRows = computed(() =>
  filteredRows.value
    .filter((item) => isResultStatus(item.statusRaw))
    .slice()
    .sort((a, b) => b.startedAtTs - a.startedAtTs),
);

watch(
  schoolOptions,
  (options) => {
    if (!selectedSchool.value) {
      return;
    }

    const exists = options.some((option) => option.value === selectedSchool.value);
    if (!exists) {
      selectedSchool.value = null;
    }
  },
  { immediate: true },
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
    <template #content>
      <Tabs v-model:value="tab">
        <div class="tabs-toolbar">
          <TabList>
            <Tab value="schedule">
              <span class="tab-title"><i class="pi pi-calendar" />赛程</span>
            </Tab>
            <Tab value="result">
              <span class="tab-title"><i class="pi pi-trophy" />赛果</span>
            </Tab>
          </TabList>

          <div class="toolbar-right">
            <Select
              v-model="selectedSchool"
              class="school-filter"
              size="small"
              :options="schoolOptions"
              optionLabel="label"
              optionValue="value"
              filter
              showClear
              placeholder="筛选学校"
            />
          </div>
        </div>

        <TabPanels>
          <TabPanel value="schedule">
            <ScheduleCardList :rows="scheduleRows" :team-group-map="props.teamGroupMap" @team-select="onSelectTeam" />
          </TabPanel>

          <TabPanel value="result">
            <ScheduleCardList
              :rows="resultRows"
              :team-group-map="props.teamGroupMap"
              :show-result-score="true"
              @team-select="onSelectTeam"
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>
  </Card>
</template>

<style scoped>
.tabs-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.toolbar-right {
  flex-shrink: 0;
}

.tab-title {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.tab-title .pi {
  font-size: 0.76rem;
}

.school-filter {
  width: min(10rem, 46vw);
}

@media (max-width: 768px) {
  .tabs-toolbar {
    gap: 0.5rem;
  }

  .school-filter {
    width: min(9.5rem, 48vw);
  }
}
</style>
