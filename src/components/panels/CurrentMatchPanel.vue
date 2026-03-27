<script setup lang="ts">
import { getRunningMatch, getScheduleRows } from '@/services/scheduleView';
import { useRmDataStore } from '@/stores/rmData';
import { useUiStore } from '@/stores/ui';
import Card from 'primevue/card';
import Panel from 'primevue/panel';
import Tag from 'primevue/tag';
import { computed } from 'vue';
import { resolvePayloadByZone, toMatchView } from '../../services/matchView';
import type { CurrentAndNextMatches } from '../../types/api';
import MatchBlock from './MatchBlock.vue';
import ScheduleItem from './ScheduleItem.vue';

interface Props {
  payload: CurrentAndNextMatches | null;
  selectedZoneId: string | null;
  selectedZoneName: string | null;
  selectedZoneLiveState?: number | null;
  nextExpanded?: boolean;
  teamGroupMap?: Record<string, { group: string; rank: string }>;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  teamSelect: [teamName: string];
  updateNextExpanded: [expanded: boolean];
}>();

const zonePayload = computed(() => resolvePayloadByZone(props.payload, props.selectedZoneId, props.selectedZoneName));
const current = computed(() => toMatchView(zonePayload.value?.currentMatch));
const next = computed(() => toMatchView(zonePayload.value?.nextMatch));
const nextTeamsLabel = computed(() => {
  if (!next.value) {
    return '';
  }

  const red = next.value.redTeam.teamName || '-';
  const blue = next.value.blueTeam.teamName || '-';
  return `${red} VS ${blue}`;
});

function onSelectTeam(teamName: string) {
  emit('teamSelect', teamName);
}

function onNextPanelCollapsedChange(collapsed: boolean) {
  emit('updateNextExpanded', !collapsed);
}

const uiStore = useUiStore();
const dataStore = useRmDataStore();
const runningMatch = computed(() => {
  const rows = getScheduleRows(dataStore.schedule, dataStore.liveGameInfo);
  return getRunningMatch(rows, props.selectedZoneId);
});
</script>

<template>
  <div>
    <Card v-if="!uiStore.isMobile">
      <template #content>
        <MatchBlock
          title="当前对局"
          :match="current"
          :hero="true"
          :team-group-map="props.teamGroupMap"
          start-prefix="开始"
          @team-select="onSelectTeam"
        />

        <Panel
          toggleable
          class="next-panel"
          :collapsed="!props.nextExpanded"
          @update:collapsed="onNextPanelCollapsedChange"
        >
          <template #header>
            <div class="next-header">
              <div class="next-title-wrap">
                <h3>{{ next ? '下一场对局' : '暂无下一场信息' }}</h3>
                <small v-if="!props.nextExpanded && nextTeamsLabel" class="next-teams">{{ nextTeamsLabel }}</small>
              </div>
              <Tag v-if="next" :value="next.status" severity="contrast" />
            </div>
          </template>

          <MatchBlock
            title="下一场对局"
            :match="next"
            :compact="true"
            :show-header="false"
            :team-group-map="props.teamGroupMap"
            start-prefix="预计"
            @team-select="onSelectTeam"
          />
        </Panel>
      </template>
    </Card>
    <ScheduleItem v-else-if="runningMatch" :item="runningMatch"> </ScheduleItem>
  </div>
</template>

<style scoped>
.next-panel {
  margin-top: 0.6rem;
}

.next-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.next-title-wrap {
  min-width: 0;
}

.next-header h3 {
  margin: 0;
  font-size: 0.92rem;
}

.next-teams {
  display: block;
  margin-top: 0.12rem;
  font-size: 0.76rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.next-panel :deep(.p-panel-header) {
  padding: 0.5rem 0.7rem;
}

.next-panel :deep(.p-panel-content) {
  padding: 0.55rem 0.7rem 0.6rem;
}

@media (max-width: 760px) {
  .next-header {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (width <= 768px) {
  .next-panel {
    display: none;
  }
}
</style>
