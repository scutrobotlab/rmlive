<script setup lang="ts">
import { useRmDataStore } from '@/stores/rmData';
import { useUiStore } from '@/stores/ui';
import type { TeamSelectPayload } from '@/types/teamSelect';
import {
  getRecentMatches,
  getScheduleRows,
  getSchoolTeamOptions,
  getZoneNameOptions,
  isResultStatus,
} from '@/utils/matchView';
import { storeToRefs } from 'pinia';
import Card from 'primevue/card';
import Tab from 'primevue/tab';
import TabList from 'primevue/tablist';
import TabPanel from 'primevue/tabpanel';
import TabPanels from 'primevue/tabpanels';
import Tabs from 'primevue/tabs';
import { computed, nextTick, ref, watch } from 'vue';
import ScheduleList from './ScheduleList.vue';
import ScheduleListFilter from './ScheduleListFilter.vue';

interface Props {
  selectedZoneId: string | null;
  teamGroupMap?: Record<string, { group: string; rank: string }>;
  isMobile?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isMobile: false,
});

const emit = defineEmits<{
  teamSelect: [payload: TeamSelectPayload];
}>();

const dataStore = useRmDataStore();
const uiStore = useUiStore();
const { schedule, liveGameInfo } = storeToRefs(dataStore);

const rows = computed(() => getScheduleRows(schedule.value, liveGameInfo.value));

// Tab selection
const activeTab = ref<'recent' | 'schedule' | 'result'>('recent');

// Filter states for schedule and result tabs
const selectedTeam = ref<string[]>([]);
const selectedZone = ref<string[]>([]);

// Generate filter options
const teamOptions = computed(() => getSchoolTeamOptions(rows.value));
const zoneOptions = computed(() => getZoneNameOptions(rows.value));

// Compute recent matches
const recentMatches = computed(() => getRecentMatches(rows.value, props.selectedZoneId));

function applyFilters(source: typeof rows.value): typeof rows.value {
  let filtered = source;

  if (selectedTeam.value.length > 0) {
    const teamSet = new Set(selectedTeam.value);
    filtered = filtered.filter((item) => teamSet.has(item.redTeam.teamName) || teamSet.has(item.blueTeam.teamName));
  }

  if (selectedZone.value.length > 0) {
    const zoneSet = new Set(selectedZone.value);
    filtered = filtered.filter((item) => zoneSet.has(item.zoneId ?? ''));
  }

  return filtered;
}

const filteredRows = computed(() => applyFilters(rows.value));

// Compute schedule rows (upcoming)
const scheduleRows = computed(() => {
  const filtered = filteredRows.value.filter((item) => !isResultStatus(item.statusRaw ?? ''));

  return filtered.slice().sort((a, b) => (a.startedAtTs ?? 0) - (b.startedAtTs ?? 0));
});

const resultRows = computed(() => {
  const filtered = filteredRows.value.filter((item) => isResultStatus(item.statusRaw ?? ''));

  return filtered.slice().sort((a, b) => (b.startedAtTs ?? 0) - (a.startedAtTs ?? 0));
});

const listChunkSize = computed(() => 10);

// Watch team options and reset selection if it becomes invalid
watch(teamOptions, (options) => {
  const validValues = new Set(options.map((option) => option.value));
  selectedTeam.value = selectedTeam.value.filter((value) => validValues.has(value));
});

// Watch zone options and reset selection if it becomes invalid
watch(zoneOptions, (options) => {
  const validValues = new Set(options.map((option) => option.value));
  selectedZone.value = selectedZone.value.filter((value) => validValues.has(value));
});

watch(
  () => uiStore.schedulePanelIntent,
  (intent) => {
    if (!intent) {
      return;
    }
    selectedTeam.value = [...intent.teamNames];
    selectedZone.value = [...intent.zoneIds];
    activeTab.value = intent.tab;
    nextTick(() => {
      document.getElementById('rm-schedule-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      uiStore.clearSchedulePanelIntent();
    });
  },
);

// Auto-switch tab if current tab becomes empty
watch(
  () => [scheduleRows.value.length, resultRows.value.length, recentMatches.value.length] as const,
  ([scheduleCount, resultCount, recentCount]) => {
    if (uiStore.consumeSuppressScheduleAutoTabOnce()) {
      return;
    }

    if (activeTab.value === 'recent' && recentCount === 0 && (scheduleCount > 0 || resultCount > 0)) {
      activeTab.value = 'schedule';
      return;
    }

    if (activeTab.value === 'schedule' && scheduleCount === 0 && resultCount > 0) {
      activeTab.value = 'result';
      return;
    }

    if (activeTab.value === 'result' && resultCount === 0 && scheduleCount > 0) {
      activeTab.value = 'schedule';
    }
  },
  { immediate: true },
);

function onTeamSelect(payload: TeamSelectPayload) {
  emit('teamSelect', payload);
}
</script>

<template>
  <Card class="schedule-panel-card">
    <template #content>
      <Tabs v-model:value="activeTab" class="schedule-tabs">
        <TabList>
          <Tab value="recent">
            <span class="tab-label"><i class="pi pi-bolt" />近期比赛</span>
          </Tab>
          <Tab value="schedule">
            <span class="tab-label"><i class="pi pi-calendar" />赛程</span>
          </Tab>
          <Tab value="result">
            <span class="tab-label"><i class="pi pi-trophy" />赛果</span>
          </Tab>
        </TabList>

        <ScheduleListFilter
          v-if="activeTab === 'schedule' || activeTab === 'result'"
          :isMobile="isMobile"
          :teamOptions="teamOptions"
          :zoneOptions="zoneOptions"
          v-model:selectedTeam="selectedTeam"
          v-model:selectedZone="selectedZone"
        />

        <TabPanels>
          <!-- Recent matches tab -->
          <TabPanel value="recent">
            <ScheduleList
              :rows="recentMatches"
              :team-group-map="props.teamGroupMap"
              :compact="isMobile"
              :incremental="false"
              :active="activeTab === 'recent'"
              @team-select="onTeamSelect"
            />
          </TabPanel>

          <!-- Schedule (upcoming) tab with filters -->
          <TabPanel value="schedule">
            <ScheduleList
              :rows="scheduleRows"
              :team-group-map="props.teamGroupMap"
              :compact="isMobile"
              date-order="asc"
              :chunk-size="listChunkSize"
              :active="activeTab === 'schedule'"
              @team-select="onTeamSelect"
            />
          </TabPanel>

          <!-- Result (completed) tab with filters -->
          <TabPanel value="result">
            <ScheduleList
              :rows="resultRows"
              :team-group-map="props.teamGroupMap"
              :compact="isMobile"
              date-order="desc"
              :chunk-size="listChunkSize"
              :active="activeTab === 'result'"
              @team-select="onTeamSelect"
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>
  </Card>
</template>

<style scoped>
.card-title {
  font-weight: 500;
}

.schedule-tabs {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.schedule-panel-card {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

/* Let schedule date rows use sticky relative to the page scroll (avoid clipping in tab panels). */
.schedule-panel-card :deep(.p-tabpanels) {
  overflow: visible;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.95rem;
}

.tab-label .pi {
  font-size: 0.75rem;
}

@media (max-width: 768px) {
  .tab-label {
    font-size: 0.85rem;
  }
}
</style>
