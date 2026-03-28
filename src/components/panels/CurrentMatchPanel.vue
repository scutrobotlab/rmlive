<script setup lang="ts">
import { useRmDataStore } from '@/stores/rmData';
import { useUiStore } from '@/stores/ui';
import type { TeamSelectPayload } from '@/types/teamSelect';
import { resolvePayloadByZone, toMatchView } from '@/utils/matchView';
import Card from 'primevue/card';
import Panel from 'primevue/panel';
import Tag from 'primevue/tag';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import MatchBlock from './MatchBlock.vue';
import ScheduleItem from './ScheduleItem.vue';

const emit = defineEmits<{
  teamSelect: [payload: TeamSelectPayload];
}>();

const uiStore = useUiStore();
const dataStore = useRmDataStore();

const { currentAndNextMatches, selectedZoneId, selectedZoneName, teamGroupMap, runningMatchForSelectedZone } =
  storeToRefs(dataStore);

const zonePayload = computed(() =>
  resolvePayloadByZone(currentAndNextMatches.value, selectedZoneId.value, selectedZoneName.value),
);
const next = computed(() => toMatchView(zonePayload.value?.nextMatch));
const nextTeamsLabel = computed(() => {
  if (!next.value) {
    return '';
  }

  const red = next.value.redTeam.teamName || '-';
  const blue = next.value.blueTeam.teamName || '-';
  return `${red} VS ${blue}`;
});

function onSelectTeam(payload: TeamSelectPayload) {
  emit('teamSelect', payload);
}

function onNextPanelCollapsedChange(collapsed: boolean) {
  uiStore.setNextMatchExpanded(!collapsed);
}

const { nextMatchExpanded } = storeToRefs(uiStore);
</script>

<template>
  <div>
    <Card v-if="!uiStore.isMobile">
      <template #content>
        <ScheduleItem
          v-if="runningMatchForSelectedZone"
          :item="runningMatchForSelectedZone"
          @team-select="onSelectTeam"
        />

        <Panel
          toggleable
          class="next-panel"
          :collapsed="!nextMatchExpanded"
          @update:collapsed="onNextPanelCollapsedChange"
        >
          <template #header>
            <div class="next-header">
              <div class="next-title-wrap">
                <h3>{{ next ? '下一场对局' : '暂无下一场信息' }}</h3>
                <small v-if="!nextMatchExpanded && nextTeamsLabel" class="next-teams">{{ nextTeamsLabel }}</small>
              </div>
              <Tag v-if="next" :value="next.status" severity="contrast" />
            </div>
          </template>

          <MatchBlock
            title="下一场对局"
            :match="next"
            :compact="true"
            :show-header="false"
            :team-group-map="teamGroupMap"
            :context-zone-id="selectedZoneId"
            :context-zone-name="selectedZoneName"
            start-prefix="预计"
            @team-select="onSelectTeam"
          />
        </Panel>
      </template>
    </Card>
    <ScheduleItem
      v-else-if="runningMatchForSelectedZone"
      :item="runningMatchForSelectedZone"
      @team-select="onSelectTeam"
    />
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
