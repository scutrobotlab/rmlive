<script setup lang="ts">
import Card from 'primevue/card';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Tab from 'primevue/tab';
import TabList from 'primevue/tablist';
import TabPanel from 'primevue/tabpanel';
import TabPanels from 'primevue/tabpanels';
import Tabs from 'primevue/tabs';
import Tag from 'primevue/tag';
import { computed, ref } from 'vue';
import { getScheduleRows, isResultStatus, toStatusSeverity } from '../../services/scheduleView';
import type { Schedule } from '../../types/api';
import TeamInfoCard from '../common/TeamInfoCard.vue';

interface Props {
  payload: Schedule | null;
  selectedZoneId: string | null;
  teamGroupMap?: Record<string, { group: string; rank: string }>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  teamSelect: [teamName: string];
}>();
const rows = computed(() => getScheduleRows(props.payload, props.selectedZoneId));
const tab = ref<'schedule' | 'result'>('schedule');
const scheduleRows = computed(() => rows.value.filter((item) => !isResultStatus(item.statusRaw)));
const resultRows = computed(() => rows.value.filter((item) => isResultStatus(item.statusRaw)));

function onSelectTeam(teamName: string) {
  emit('teamSelect', teamName);
}

function toGroupLabel(teamName: string): string {
  const meta = props.teamGroupMap?.[teamName];
  if (!meta) {
    return '';
  }
  return `${meta.group}组 #${meta.rank}`;
}
</script>

<template>
  <Card>
    <template #title> 赛程安排 </template>
    <template #content>
      <Tabs v-model:value="tab">
        <TabList>
          <Tab value="schedule">赛程</Tab>
          <Tab value="result">赛果</Tab>
        </TabList>

        <TabPanels>
          <TabPanel value="schedule">
            <div class="table-wrap">
              <DataTable
                :value="scheduleRows"
                paginator
                :rows="8"
                size="small"
                stripedRows
                tableStyle="min-width: 48rem"
              >
                <Column field="date" header="日期" />
                <Column field="time" header="时间" />
                <Column header="阶段">
                  <template #body="{ data }">
                    <Tag severity="secondary" :value="data.stage" />
                  </template>
                </Column>
                <Column header="红方" style="min-width: 16rem">
                  <template #body="{ data }">
                    <div class="team-cell">
                      <TeamInfoCard
                        compact
                        :team-name="data.redTeam.teamName"
                        :college-name="data.redTeam.collegeName"
                        :logo="data.redTeam.logo"
                        :group-label="toGroupLabel(data.redTeam.teamName)"
                        @select="onSelectTeam"
                      />
                    </div>
                  </template>
                </Column>
                <Column header="蓝方" style="min-width: 16rem">
                  <template #body="{ data }">
                    <div class="team-cell">
                      <TeamInfoCard
                        compact
                        :team-name="data.blueTeam.teamName"
                        :college-name="data.blueTeam.collegeName"
                        :logo="data.blueTeam.logo"
                        :group-label="toGroupLabel(data.blueTeam.teamName)"
                        @select="onSelectTeam"
                      />
                    </div>
                  </template>
                </Column>
                <Column field="score" header="比分" />
                <Column field="gameScore" header="小局" />
                <Column header="状态">
                  <template #body="{ data }">
                    <Tag :severity="toStatusSeverity(data.statusRaw)" :value="data.status" />
                  </template>
                </Column>
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel value="result">
            <div class="table-wrap">
              <DataTable :value="resultRows" paginator :rows="8" size="small" stripedRows tableStyle="min-width: 48rem">
                <Column field="date" header="日期" />
                <Column field="time" header="时间" />
                <Column header="阶段">
                  <template #body="{ data }">
                    <Tag severity="secondary" :value="data.stage" />
                  </template>
                </Column>
                <Column header="红方" style="min-width: 16rem">
                  <template #body="{ data }">
                    <div class="team-cell">
                      <TeamInfoCard
                        compact
                        :team-name="data.redTeam.teamName"
                        :college-name="data.redTeam.collegeName"
                        :logo="data.redTeam.logo"
                        :group-label="toGroupLabel(data.redTeam.teamName)"
                        @select="onSelectTeam"
                      />
                    </div>
                  </template>
                </Column>
                <Column header="蓝方" style="min-width: 16rem">
                  <template #body="{ data }">
                    <div class="team-cell">
                      <TeamInfoCard
                        compact
                        :team-name="data.blueTeam.teamName"
                        :college-name="data.blueTeam.collegeName"
                        :logo="data.blueTeam.logo"
                        :group-label="toGroupLabel(data.blueTeam.teamName)"
                        @select="onSelectTeam"
                      />
                    </div>
                  </template>
                </Column>
                <Column field="score" header="比分" />
                <Column field="gameScore" header="小局" />
                <Column header="状态">
                  <template #body="{ data }">
                    <Tag :severity="toStatusSeverity(data.statusRaw)" :value="data.status" />
                  </template>
                </Column>
              </DataTable>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>
  </Card>
</template>

<style scoped>
.table-wrap {
  overflow-x: auto;
}

.team-cell {
  min-width: 0;
}

:deep(.p-datatable .p-datatable-tbody > tr > td) {
  vertical-align: middle;
}
</style>
