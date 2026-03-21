<script setup lang="ts">
import Card from 'primevue/card';
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
            <div v-if="!scheduleRows.length" class="empty">暂无赛程数据</div>
            <div v-else class="match-list">
              <article v-for="item in scheduleRows" :key="`schedule-${item.id}`" class="match-card">
                <header class="match-head">
                  <div class="head-left">
                    <Tag severity="secondary" :value="item.stage" />
                    <span class="start-at">{{ item.date }} {{ item.time }}</span>
                  </div>
                  <Tag :severity="toStatusSeverity(item.statusRaw)" :value="item.status" />
                </header>

                <div class="teams">
                  <TeamInfoCard
                    compact
                    :team-name="item.redTeam.teamName"
                    :college-name="item.redTeam.collegeName"
                    :logo="item.redTeam.logo"
                    :group-label="toGroupLabel(item.redTeam.teamName)"
                    @select="onSelectTeam"
                  />
                  <TeamInfoCard
                    compact
                    :team-name="item.blueTeam.teamName"
                    :college-name="item.blueTeam.collegeName"
                    :logo="item.blueTeam.logo"
                    :group-label="toGroupLabel(item.blueTeam.teamName)"
                    @select="onSelectTeam"
                  />
                </div>
              </article>
            </div>
          </TabPanel>

          <TabPanel value="result">
            <div v-if="!resultRows.length" class="empty">暂无赛果数据</div>
            <div v-else class="match-list">
              <article v-for="item in resultRows" :key="`result-${item.id}`" class="match-card">
                <header class="match-head">
                  <div class="head-left">
                    <Tag severity="secondary" :value="item.stage" />
                    <span class="start-at">{{ item.date }} {{ item.time }}</span>
                  </div>
                  <Tag :severity="toStatusSeverity(item.statusRaw)" :value="item.status" />
                </header>

                <div class="teams">
                  <TeamInfoCard
                    compact
                    :team-name="item.redTeam.teamName"
                    :college-name="item.redTeam.collegeName"
                    :logo="item.redTeam.logo"
                    :group-label="toGroupLabel(item.redTeam.teamName)"
                    @select="onSelectTeam"
                  />
                  <TeamInfoCard
                    compact
                    :team-name="item.blueTeam.teamName"
                    :college-name="item.blueTeam.collegeName"
                    :logo="item.blueTeam.logo"
                    :group-label="toGroupLabel(item.blueTeam.teamName)"
                    @select="onSelectTeam"
                  />
                </div>

                <div class="result-score">
                  <span>比分 {{ item.score }}</span>
                  <span>小局 {{ item.gameScore }}</span>
                </div>
              </article>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>
  </Card>
</template>

<style scoped>
.empty {
  text-align: center;
  opacity: 0.72;
  padding: 1rem 0.35rem;
}

.match-list {
  display: grid;
  gap: 0.65rem;
}

.match-card {
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 0.7rem;
  padding: 0.6rem;
  background: rgba(15, 23, 42, 0.2);
}

.match-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
  margin-bottom: 0.5rem;
}

.head-left {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.start-at {
  font-size: 0.78rem;
  opacity: 0.78;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.teams {
  display: grid;
  gap: 0.45rem;
}

.result-score {
  margin-top: 0.55rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.result-score span {
  border-radius: 999px;
  padding: 0.2rem 0.6rem;
  font-size: 0.76rem;
  background: rgba(51, 65, 85, 0.35);
}
</style>
