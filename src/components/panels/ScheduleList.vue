<script setup lang="ts">
import Divider from 'primevue/divider';
import { computed } from 'vue';
import type { TeamSelectPayload } from '@/types/teamSelect';
import { groupScheduleRowsByDate, type MatchView } from '@/utils/matchView';
import ScheduleItem from './ScheduleItem.vue';

interface Props {
  rows: MatchView[];
  teamGroupMap?: Record<string, { group: string; rank: string }>;
  compact?: boolean;
  dateOrder?: 'asc' | 'desc';
}

const props = withDefaults(defineProps<Props>(), {
  dateOrder: 'asc',
});

const emit = defineEmits<{
  teamSelect: [payload: TeamSelectPayload];
}>();

const dateGroups = computed(() => groupScheduleRowsByDate(props.rows, props.dateOrder));

function onTeamSelect(payload: TeamSelectPayload) {
  emit('teamSelect', payload);
}
</script>

<template>
  <div v-if="!rows.length" class="empty-state">暂无数据</div>

  <div v-else class="schedule-list">
    <section v-for="group in dateGroups" :key="group.date" class="date-group">
      <Divider align="left" type="solid" class="date-divider">
        <b class="divider-date">{{ group.dateLabel }}</b>
      </Divider>

      <ScheduleItem
        v-for="match in group.items"
        :key="`${match.zoneId}-${match.id}`"
        :item="match"
        :team-group-map="props.teamGroupMap"
        :compact="props.compact"
        @team-select="onTeamSelect"
      />
    </section>
  </div>
</template>

<style scoped>
.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--text-color-secondary);
  font-size: 0.95rem;
}

.schedule-list {
  width: 100%;
  min-width: 0;
  overflow-x: hidden;
}

.date-group {
  margin-bottom: 0.55rem;
  min-width: 0;
}

.date-divider {
  margin: 0.2rem 0 0.35rem;
}

.divider-date {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-color-secondary);
}

@media (max-width: 768px) {
  .date-divider {
    margin: 0.15rem 0 0.28rem;
  }

  .divider-date {
    font-size: 0.85rem;
  }
}
</style>
