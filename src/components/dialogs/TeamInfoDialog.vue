<script setup lang="ts">
import type { TeamSelectPayload } from '@/types/teamSelect';
import { useRmDataStore } from '@/stores/rmData';
import { useUiStore } from '@/stores/ui';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import TeamGroupTag from '../common/TeamGroupTag.vue';
import RobotDataPanel from '../panels/RobotDataPanel.vue';

interface Props {
  visible: boolean;
  selectedTeam: string | null;
  collegeName?: string | null;
  selectedZoneId: string | null;
  selectedZoneName: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:visible': [visible: boolean];
  pickTeam: [payload: TeamSelectPayload];
}>();

const dataStore = useRmDataStore();
const uiStore = useUiStore();
const { robotData, teamGroupMap } = storeToRefs(dataStore);

const headerTitle = computed(() => {
  const school = props.collegeName?.trim() || '—';
  const team = props.selectedTeam?.trim() || '';
  return team ? `${school} - ${team}` : school;
});

const groupLabel = computed(() => {
  const name = props.selectedTeam;
  if (!name) {
    return '';
  }
  const meta = teamGroupMap.value[name];
  return meta ? `${meta.group}组 #${meta.rank}` : '';
});

function onVisibleChange(value: boolean) {
  emit('update:visible', value);
}

function onPickTeam(payload: TeamSelectPayload) {
  emit('pickTeam', payload);
}

function goSchedule(tab: 'schedule' | 'result') {
  const team = props.selectedTeam;
  if (!team) {
    return;
  }
  uiStore.requestSchedulePanelFocus({
    tab,
    teamNames: [team],
    zoneIds: [],
  });
  emit('update:visible', false);
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :style="{ width: 'min(1100px, 96vw)' }"
    @update:visible="onVisibleChange"
  >
    <template #header>
      <div class="ti-header">
        <span class="ti-title">{{ headerTitle }}</span>
        <TeamGroupTag
          v-if="selectedTeam && groupLabel"
          :label="groupLabel"
          :team-name="selectedTeam"
          :zone-id="selectedZoneId"
          :zone-name="selectedZoneName"
          @pick-team="onPickTeam"
        />
      </div>
    </template>

    <RobotDataPanel
      v-if="visible"
      :payload="robotData"
      :selected-zone-id="selectedZoneId"
      :team-name="selectedTeam"
    />

    <template #footer>
      <div class="ti-footer">
        <Button label="队伍赛程" severity="secondary" @click="goSchedule('schedule')" />
        <Button label="队伍赛果" @click="goSchedule('result')" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
:deep(.p-dialog) {
  max-width: calc(100vw - 1rem);
}

.ti-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding-right: 0.5rem;
}

.ti-title {
  min-width: 0;
  flex: 1;
}

.ti-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
