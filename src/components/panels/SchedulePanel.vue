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
import type { Schedule } from '../../types/api';
import TeamInfoCard from '../common/TeamInfoCard.vue';

interface Props {
  payload: Schedule | null;
  selectedZoneId: string | null;
  teamGroupMap?: Record<string, { group: string; rank: string }>;
}

const props = defineProps<Props>();

interface RowItem {
  id: string;
  date: string;
  time: string;
  stage: string;
  redTeam: {
    teamName: string;
    collegeName: string;
    logo: string;
  };
  blueTeam: {
    teamName: string;
    collegeName: string;
    logo: string;
  };
  score: string;
  gameScore: string;
  statusRaw: string;
  status: string;
}

const emit = defineEmits<{
  teamSelect: [teamName: string];
}>();

function toStatusLabel(status: string): string {
  const value = status.toUpperCase();
  if (value === 'DONE' || value === 'FINISHED' || value === 'ENDED') {
    return '已结束';
  }
  if (value === 'STARTED' || value === 'PLAYING') {
    return '进行中';
  }
  return '未开始';
}

function toStatusSeverity(status: string): 'contrast' | 'warn' | 'success' {
  const value = status.toUpperCase();
  if (value === 'STARTED' || value === 'PLAYING') {
    return 'warn';
  }
  if (value === 'DONE' || value === 'FINISHED' || value === 'ENDED') {
    return 'success';
  }
  return 'contrast';
}

function isResultStatus(status: string): boolean {
  const value = status.toUpperCase();
  return value === 'DONE' || value === 'FINISHED' || value === 'ENDED';
}

function getZones(data: Schedule | null): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') {
    return [];
  }

  const root = data as Record<string, unknown>;
  const fromGraph = (
    ((root.data as Record<string, unknown> | undefined)?.event as Record<string, unknown> | undefined)?.zones as
      | Record<string, unknown>
      | undefined
  )?.nodes;

  if (Array.isArray(fromGraph)) {
    return fromGraph as Record<string, unknown>[];
  }

  const currentEvent = (root.current_event ?? root.currentEvent) as Record<string, unknown> | undefined;
  const zones = (currentEvent?.zones as Record<string, unknown> | undefined)?.nodes;

  if (Array.isArray(zones)) {
    return zones as Record<string, unknown>[];
  }

  return [];
}

function getRows(data: Schedule | null, selectedZoneId: string | null): RowItem[] {
  const zones = getZones(data);

  if (!zones.length) {
    return [];
  }

  const zone = zones.find((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    return String((item as Record<string, unknown>).id ?? '') === String(selectedZoneId ?? '');
  }) as Record<string, unknown> | undefined;

  const targetZone = zone ?? (zones[0] as Record<string, unknown>);

  const groupMatches = ((targetZone.groupMatches as Record<string, unknown> | undefined)?.nodes ?? []) as unknown[];
  const knockoutMatches = ((targetZone.knockoutMatches as Record<string, unknown> | undefined)?.nodes ??
    []) as unknown[];
  const allMatches = [...groupMatches, ...knockoutMatches];

  return allMatches
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const match = item as Record<string, unknown>;
      const planStartedAt = String(match.planStartedAt ?? '');
      const dateObj = planStartedAt ? new Date(planStartedAt) : null;

      const bluePlayer = (match.blueSide as Record<string, unknown> | undefined)?.player as
        | Record<string, unknown>
        | undefined;
      const redPlayer = (match.redSide as Record<string, unknown> | undefined)?.player as
        | Record<string, unknown>
        | undefined;
      const blueTeam = bluePlayer?.team as Record<string, unknown> | undefined;
      const redTeam = redPlayer?.team as Record<string, unknown> | undefined;

      const blueTeamName = String(blueTeam?.name ?? match.winnerPlaceholdName ?? '-');
      const redTeamName = String(redTeam?.name ?? match.loserPlaceholdName ?? '-');

      const blueSideScore = Number(match.blueSideScore ?? 0);
      const redSideScore = Number(match.redSideScore ?? 0);
      const blueSideWinGameCount = Number(match.blueSideWinGameCount ?? 0);
      const redSideWinGameCount = Number(match.redSideWinGameCount ?? 0);
      const status = String(match.status ?? '-');

      return {
        id: String(match.id ?? '-'),
        date: dateObj ? dateObj.toLocaleDateString('zh-CN') : '-',
        time: dateObj ? dateObj.toLocaleTimeString('zh-CN', { hour12: false }) : '-',
        stage: String(match.matchType ?? '-'),
        redTeam: {
          teamName: redTeamName,
          collegeName: String(redTeam?.collegeName ?? '-'),
          logo: String(redTeam?.collegeLogo ?? ''),
        },
        blueTeam: {
          teamName: blueTeamName,
          collegeName: String(blueTeam?.collegeName ?? '-'),
          logo: String(blueTeam?.collegeLogo ?? ''),
        },
        score: `${redSideScore} : ${blueSideScore}`,
        gameScore: `${redSideWinGameCount} : ${blueSideWinGameCount}`,
        statusRaw: status,
        status: toStatusLabel(status),
      };
    })
    .filter((item): item is RowItem => item !== null);
}

const rows = computed(() => getRows(props.payload, props.selectedZoneId));
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
            <DataTable :value="scheduleRows" paginator :rows="8" size="small" stripedRows tableStyle="min-width: 52rem">
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
          </TabPanel>

          <TabPanel value="result">
            <DataTable :value="resultRows" paginator :rows="8" size="small" stripedRows tableStyle="min-width: 52rem">
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
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>
  </Card>
</template>

<style scoped>
.team-cell {
  min-width: 0;
}

:deep(.p-datatable .p-datatable-tbody > tr > td) {
  vertical-align: middle;
}
</style>
