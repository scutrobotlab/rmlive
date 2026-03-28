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
      <div class="date-sticky">
        <Divider align="left" type="solid" class="date-divider">
          <span class="divider-date-row">
            <i class="pi pi-calendar divider-date-icon" aria-hidden="true" />
            <b class="divider-date">{{ group.dateLabel }}</b>
          </span>
        </Divider>
      </div>

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
  overflow-x: clip;
}

.date-group {
  margin-bottom: 0.55rem;
  min-width: 0;
}

.date-sticky {
  position: sticky;
  top: var(--schedule-date-sticky-top, 0);
  z-index: 2;
  margin: 0 -0.15rem;
  padding: 0 0.15rem;
  background: var(--p-content-background, var(--surface-ground, #fff));
}

.app-dark .date-sticky {
  background: var(--p-content-background, var(--surface-ground));
}

.date-divider {
  margin: 0.2rem 0 0.35rem;
}

.divider-date-row {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.divider-date-icon {
  font-size: 1.05rem;
  color: var(--p-primary-color, #3b82f6);
  opacity: 0.92;
}

.divider-date {
  font-weight: 700;
  font-size: 1.08rem;
  letter-spacing: 0.02em;
  color: var(--text-color, var(--p-text-color));
}

.app-dark .divider-date {
  color: var(--p-text-color, #e2e8f0);
}

@media (max-width: 768px) {
  .date-divider {
    margin: 0.15rem 0 0.28rem;
  }

  .divider-date-icon {
    font-size: 0.95rem;
  }

  .divider-date {
    font-size: 0.98rem;
  }
}
</style>
