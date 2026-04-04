<script setup lang="ts">
import type { TeamSelectPayload } from '@/types/teamSelect';
import { groupScheduleRowsByDate, type MatchView } from '@/utils/matchView';
import Divider from 'primevue/divider';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ScheduleItem from '../common/ScheduleItem.vue';

interface Props {
  rows: MatchView[];
  teamGroupMap?: Record<string, { group: string; rank: string }>;
  compact?: boolean;
  dateOrder?: 'asc' | 'desc';
  incremental?: boolean;
  chunkSize?: number;
  active?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  dateOrder: 'asc',
  incremental: true,
  chunkSize: 24,
  active: true,
});

const emit = defineEmits<{
  teamSelect: [payload: TeamSelectPayload];
}>();

const visibleCount = ref(0);
const loadSentinel = ref<HTMLDivElement | null>(null);
let observer: IntersectionObserver | null = null;
let fallbackScheduled = false;

const renderedRows = computed(() => {
  if (!props.incremental) {
    return props.rows;
  }

  return props.rows.slice(0, visibleCount.value);
});

const hasMoreRows = computed(() => props.incremental && visibleCount.value < props.rows.length);

const dateGroups = computed(() => groupScheduleRowsByDate(renderedRows.value, props.dateOrder));

function normalizeChunkSize(): number {
  const parsed = Number(props.chunkSize ?? 24);
  if (!Number.isFinite(parsed)) {
    return 24;
  }
  return Math.max(8, Math.floor(parsed));
}

function resetVisibleCount() {
  if (!props.incremental) {
    visibleCount.value = props.rows.length;
    return;
  }

  visibleCount.value = Math.min(props.rows.length, normalizeChunkSize());
}

function loadMoreRows() {
  if (!hasMoreRows.value) {
    return;
  }

  visibleCount.value = Math.min(props.rows.length, visibleCount.value + normalizeChunkSize());
  void nextTick(() => {
    checkViewportAndLoadMore();
  });
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function setupObserver() {
  stopObserver();
  if (!props.active || !hasMoreRows.value || !loadSentinel.value || typeof IntersectionObserver === 'undefined') {
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }
      loadMoreRows();
    },
    {
      root: null,
      rootMargin: '640px 0px',
      threshold: 0,
    },
  );

  observer.observe(loadSentinel.value);
}

function checkViewportAndLoadMore() {
  if (!props.active || !hasMoreRows.value || !loadSentinel.value || typeof window === 'undefined') {
    return;
  }

  const rect = loadSentinel.value.getBoundingClientRect();
  if (rect.top <= window.innerHeight + 640) {
    loadMoreRows();
  }
}

function scheduleViewportCheck() {
  if (fallbackScheduled || typeof window === 'undefined') {
    return;
  }

  fallbackScheduled = true;
  window.requestAnimationFrame(() => {
    fallbackScheduled = false;
    checkViewportAndLoadMore();
  });
}

function onWindowViewportChanged() {
  scheduleViewportCheck();
}

watch(
  () => props.rows,
  () => {
    resetVisibleCount();
    setupObserver();
    scheduleViewportCheck();
  },
  { immediate: true },
);

watch(
  () => [props.incremental, props.chunkSize, props.active] as const,
  () => {
    resetVisibleCount();
    setupObserver();
    scheduleViewportCheck();
  },
);

watch(hasMoreRows, () => {
  setupObserver();
  scheduleViewportCheck();
});

onMounted(() => {
  setupObserver();
  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', onWindowViewportChanged, { passive: true });
    window.addEventListener('resize', onWindowViewportChanged, { passive: true });
  }
  scheduleViewportCheck();
});

onBeforeUnmount(() => {
  stopObserver();
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', onWindowViewportChanged);
    window.removeEventListener('resize', onWindowViewportChanged);
  }
});

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

    <div v-if="hasMoreRows" ref="loadSentinel" class="list-tail" aria-hidden="true">
      <small>正在加载更多赛程...</small>
    </div>
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

.list-tail {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 1.8rem;
  padding: 0.35rem 0 0.55rem;
  color: var(--text-color-secondary);
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
