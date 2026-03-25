<script setup lang="ts">
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import { ref } from 'vue';
import { toStatusSeverity, type ScheduleRowItem } from '../../services/scheduleView';
import TeamInfoCard from '../common/TeamInfoCard.vue';
import ReplayVideoDialog from '../dialogs/ReplayVideoDialog.vue';

interface Props {
  rows: ScheduleRowItem[];
  teamGroupMap?: Record<string, { group: string; rank: string }>;
  showResultScore?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showResultScore: false,
});

const emit = defineEmits<{
  teamSelect: [teamName: string];
}>();

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

function showSlug(slug: string): boolean {
  const value = String(slug || '').trim();
  return value.length > 0 && value !== '-';
}

function resolveStageLabel(stage: string, slug: string): string {
  return showSlug(slug) ? String(slug).trim() : stage;
}

const replayVisible = ref(false);
const replayTitle = ref('');
const replayUrl = ref('');
const replayCoverUrl = ref('');

function openReplay(data: ScheduleRowItem) {
  if (!data.replayVideo) {
    return;
  }

  replayTitle.value = data.replayVideo.title;
  replayUrl.value = data.replayVideo.url;
  replayCoverUrl.value = data.replayVideo.coverUrl;
  replayVisible.value = true;
}

function onReplayVisibleChange(visible: boolean) {
  replayVisible.value = visible;
}
</script>

<template>
  <div v-if="!rows.length" class="empty">暂无数据</div>
  <div v-else class="match-list">
    <article v-for="item in rows" :key="item.id" class="match-card">
      <header class="match-head">
        <div class="head-left">
          <Tag severity="contrast" :value="`#${item.orderNumber}`" />
          <Tag severity="secondary" :value="resolveStageLabel(item.stage, item.slug)" />
          <span class="start-at"><i class="pi pi-clock" />{{ item.dateTimeLabel }}</span>
        </div>
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

      <div v-if="showResultScore" class="result-score">
        <Tag
          class="score-tag"
          :severity="toStatusSeverity(item.statusRaw)"
          icon="pi pi-chart-bar"
          :value="`比分 ${item.score}`"
        />
        <Button
          v-if="item.replayVideo"
          icon="pi pi-play-circle"
          label="查看回放"
          size="small"
          severity="secondary"
          aria-label="播放回放"
          @click="openReplay(item)"
        />
      </div>
    </article>

    <ReplayVideoDialog
      v-model:visible="replayVisible"
      :title="replayTitle"
      :video-url="replayUrl"
      :cover-url="replayCoverUrl"
      @update:visible="onReplayVisibleChange"
    />
  </div>
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
  padding: 0.6rem;
}

.match-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
  margin-bottom: 0.4rem;
}

.head-left {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.start-at {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.start-at .pi {
  font-size: 0.72rem;
}

.teams {
  display: grid;
  gap: 0.45rem;
}

.result-score {
  margin-top: 0.55rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.score-tag :deep(.p-tag) {
  font-size: 0.74rem;
}

.result-score :deep(.p-button) {
  flex-shrink: 0;
}
</style>
