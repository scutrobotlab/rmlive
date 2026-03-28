<script setup lang="ts">
import type { TeamSelectPayload } from '@/types/teamSelect';
import { useRmDataStore } from '@/stores/rmData';
import { buildGroupRankPanelModel } from '@/utils/matchDataFormat';
import Message from 'primevue/message';
import Popover from 'primevue/popover';
import Tag from 'primevue/tag';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import TeamLogo from './TeamLogo.vue';

interface Props {
  label: string;
  teamName: string;
  zoneId?: string | null;
  zoneName?: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  pickTeam: [payload: TeamSelectPayload];
}>();

const pop = ref<InstanceType<typeof Popover> | null>(null);

const dataStore = useRmDataStore();
const { groupSections, groupRankInfo } = storeToRefs(dataStore);

const panel = computed(() =>
  buildGroupRankPanelModel(
    props.teamName || null,
    props.zoneId ?? null,
    props.zoneName ?? null,
    groupSections.value,
    groupRankInfo.value,
  ),
);

function toggle(event: Event) {
  pop.value?.toggle(event);
}

function emitPickTeam(row: { teamName: string; collegeName: string }) {
  emit('pickTeam', {
    teamName: row.teamName,
    collegeName: row.collegeName || undefined,
    zoneId: props.zoneId,
    zoneName: props.zoneName,
  });
  (pop.value as { hide?: () => void } | null)?.hide?.();
}

function onPickRowClick(row: { teamName: string; collegeName: string }, event: MouseEvent) {
  event.stopPropagation();
  emitPickTeam(row);
}

function onPickRowKey(row: { teamName: string; collegeName: string }) {
  emitPickTeam(row);
}
</script>

<template>
  <span class="team-group-tag-root" @click.stop>
    <Tag :value="label" severity="info" class="group-tag-trigger" role="button" tabindex="0" @click="toggle" />
    <Popover ref="pop" class="group-rank-popover" :show-close-icon="false">
      <div class="popover-inner">
        <h4 class="popover-title">{{ panel.title }} · 组内排名</h4>
        <div v-if="panel.hasSection && panel.rows.length" class="rank-list">
          <div
            v-for="row in panel.rows"
            :key="row.teamName"
            class="rank-row"
            role="button"
            tabindex="0"
            @click="onPickRowClick(row, $event)"
            @keydown.enter.prevent="onPickRowKey(row)"
            @keydown.space.prevent="onPickRowKey(row)"
          >
            <div class="rank-main">
              <Tag
                :value="`#${row.rankDisplay}`"
                :severity="row.isCurrent ? 'info' : 'contrast'"
                size="small"
              />
              <TeamLogo
                v-if="row.collegeLogo"
                :logo="row.collegeLogo"
                :team-name="row.teamName"
                custom-size="1.35rem"
                class="rank-logo"
              />
              <div class="rank-meta">
                <strong>{{ row.teamName }}</strong>
                <small>{{ row.collegeName }}</small>
              </div>
              <Tag v-if="row.isCurrent" value="当前" severity="info" size="small" />
            </div>
            <div class="rank-metrics">
              <Tag :value="`胜负 ${row.winDrawLose}`" severity="secondary" size="small" />
              <Tag :value="`积分 ${row.points}`" severity="secondary" size="small" />
              <Tag :value="`净胜 ${row.netVictoryPoint}`" severity="secondary" size="small" />
            </div>
          </div>
        </div>
        <Message v-else-if="panel.hasSection" severity="warn" :closable="false" class="rank-empty">
          暂无可展示的详细排名数据
        </Message>
        <Message v-else severity="warn" :closable="false">未匹配到小组排名数据</Message>
      </div>
    </Popover>
  </span>
</template>

<style scoped>
.team-group-tag-root {
  display: inline-flex;
  flex-shrink: 0;
  vertical-align: middle;
}

.group-tag-trigger {
  cursor: pointer;
}

.group-tag-trigger :deep(.p-tag-label) {
  font-size: 0.68rem;
}

.popover-inner {
  max-width: min(420px, 92vw);
  max-height: min(70vh, 28rem);
  overflow: auto;
  padding: 0.15rem;
}

.popover-title {
  margin: 0 0 0.5rem;
  font-size: 0.88rem;
  font-weight: 600;
}

.rank-list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.rank-row {
  display: grid;
  gap: 0.35rem;
  padding-bottom: 0.45rem;
  border-bottom: 1px solid var(--surface-border);
  cursor: pointer;
  border-radius: var(--border-radius, 6px);
  margin: 0 -0.1rem;
  padding-left: 0.1rem;
  padding-right: 0.1rem;
}

.rank-row:hover {
  background: var(--highlight-bg, color-mix(in srgb, var(--primary-color) 8%, transparent));
}

.rank-row:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 1px;
}

.rank-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.rank-main {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.rank-logo {
  flex-shrink: 0;
}

.rank-meta {
  min-width: 0;
  flex: 1;
}

.rank-meta strong {
  display: block;
  font-size: 0.82rem;
  line-height: 1.15;
}

.rank-meta small {
  display: block;
  font-size: 0.72rem;
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rank-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.rank-empty {
  margin-top: 0.25rem;
}
</style>

<style>
.group-rank-popover.p-popover {
  max-width: min(440px, 94vw);
}
</style>
