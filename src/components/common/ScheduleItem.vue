<script setup lang="ts">
import type { TeamSelectPayload } from '@/types/teamSelect';
import type { MatchView } from '@/utils/matchView';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import { computed, ref } from 'vue';
import TeamInfoCard from '../common/TeamInfoCard.vue';
import ReplayVideoDialog from '../dialogs/ReplayVideoDialog.vue';
import LivingTag from './LivingTag.vue';
import ScheduleSubscription from './ScheduleSubscription.vue';

interface Props {
  item: MatchView;
  teamGroupMap?: Record<string, { group: string; rank: string }>;
  compact?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  teamSelect: [payload: TeamSelectPayload];
}>();

function onSelectTeam(payload: TeamSelectPayload) {
  emit('teamSelect', {
    teamName: payload.teamName,
    collegeName: payload.collegeName,
    zoneId: payload.zoneId ?? props.item.zoneId,
    zoneName: payload.zoneName ?? props.item.zoneName,
  });
}

function toGroupLabel(teamName: string): string {
  const meta = props.teamGroupMap?.[teamName];
  return meta ? `${meta.group}组 #${meta.rank}` : '';
}

function getBOLabel(planGameCount: number): string {
  if (planGameCount === 2) {
    return 'BO2';
  }
  if (planGameCount === 3) {
    return 'BO3';
  }
  return planGameCount > 0 ? `BO${planGameCount}` : 'BO?';
}

function getScoreParts(score: string): { red: number; blue: number } {
  const [red = '0', blue = '0'] = score.split(':').map((item) => item.trim());
  return {
    red: Number(red) || 0,
    blue: Number(blue) || 0,
  };
}

const scoreParts = computed(() => getScoreParts(props.item.score));
const upperStatus = computed(() => String(props.item.statusRaw ?? '').toUpperCase());

/** BO 赛制：与 MatchView.planGameCount 一致（赛程 API / current-next 归一后均为数字）。 */
const boLabel = computed(() => getBOLabel(Number(props.item.planGameCount ?? 0)));
const matchTime = computed(() => {
  const value = String(props.item.time || '').trim();
  return value.length >= 5 ? value.slice(0, 5) : '--:--';
});
const liveRoundText = computed(() => {
  const round = scoreParts.value.red + scoreParts.value.blue + 1;
  return round > 0 ? `第${round}局` : '';
});

const matchOrderText = computed(() => {
  const raw = String(props.item.orderNumber ?? '').trim();
  if (!raw || raw === '-') {
    return '场次待定';
  }

  return `#${raw}`;
});

const canShowReplay = computed(() => Boolean(props.item.replayVideo));

const replayVisible = ref(false);

function openReplay() {
  if (!props.item.replayVideo) {
    return;
  }
  replayVisible.value = true;
}

const showScore = computed(() => {
  return ['DONE', 'FINISHED', 'ENDED', 'STARTED'].includes(upperStatus.value);
});

const isLiving = computed(() => ['STARTED', 'PLAYING'].includes(upperStatus.value));

const isMatchNotYetStarted = computed(() => {
  const u = upperStatus.value;
  return !['STARTED', 'PLAYING', 'DONE', 'FINISHED', 'ENDED'].includes(u);
});

const slug = computed(() => {
  const raw = String(props.item.slug ?? '').trim();
  if (!raw || raw === '-') {
    return undefined;
  }
  return raw;
});
</script>

<template>
  <Card class="schedule-item" :class="{ compact: props.compact }">
    <template #content>
        <header class="item-header">
          <span class="event-title">{{ item.eventTitle || '赛事' }}</span>
          <div class="header-center">
            <div v-if="isLiving" class="live-wrap">
              <LivingTag :zone-id="item.zoneId" :zone-name="item.zoneName" :compact="props.compact" />
              <span class="round-text">{{ liveRoundText }}</span>
            </div>
            <span v-else class="time-text">{{ matchTime }}</span>
            <Button
              v-if="canShowReplay"
              icon="pi pi-play-circle"
              rounded
              text
              severity="secondary"
              size="small"
              aria-label="查看回放"
              @click="openReplay"
            />
            <ScheduleSubscription v-if="isMatchNotYetStarted" :match-id="item.id" />
          </div>
          <div class="header-meta">
            <Tag v-if="slug" :value="slug" severity="info" />
            <Tag :value="item.zoneName || `站点 ${item.zoneId || '-'}`" severity="secondary" />
            <Tag :value="matchOrderText" severity="contrast" />
          </div>
        </header>

        <div class="item-content">
          <div class="team-column red-column">
            <TeamInfoCard
              :compact="props.compact"
              :team-name="item.redTeam.teamName"
              :college-name="item.redTeam.collegeName"
              :logo="item.redTeam.logo"
              :logo-size="props.compact ? '1.125rem' : ''"
              :group-label="toGroupLabel(item.redTeam.teamName)"
              :show-group-label="!props.compact"
              :show-college-name="!props.compact"
              :zone-id="item.zoneId"
              :zone-name="item.zoneName"
              logo-position="right"
              @select="onSelectTeam"
            >
              <template v-if="$slots.redTeamAction" #headPrefix>
                <slot name="redTeamAction" />
              </template>
            </TeamInfoCard>
          </div>

          <div class="center-column">
            <Tag :value="boLabel" severity="info" />
            <div class="status-row">
              <div v-if="upperStatus === 'WAITING'" class="waiting-space" />
              <div v-if="showScore" class="score-row">
                <span class="score-value" :class="{ winner: scoreParts.red > scoreParts.blue }">{{
                  scoreParts.red
                }}</span>
                <span class="score-sep">-</span>
                <span class="score-value" :class="{ winner: scoreParts.blue > scoreParts.red }">{{
                  scoreParts.blue
                }}</span>
              </div>
            </div>
          </div>

          <div class="team-column blue-column">
            <TeamInfoCard
              :compact="props.compact"
              :team-name="item.blueTeam.teamName"
              :college-name="item.blueTeam.collegeName"
              :logo="item.blueTeam.logo"
              :logo-size="props.compact ? '1.125rem' : ''"
              :group-label="toGroupLabel(item.blueTeam.teamName)"
              :show-group-label="!props.compact"
              :show-college-name="!props.compact"
              :zone-id="item.zoneId"
              :zone-name="item.zoneName"
              @select="onSelectTeam"
            >
              <template v-if="$slots.blueTeamAction" #headExtra>
                <slot name="blueTeamAction" />
              </template>
            </TeamInfoCard>
          </div>
        </div>

        <slot name="belowTeams" />

        <ReplayVideoDialog
          v-if="item.replayVideo"
          v-model:visible="replayVisible"
          :title="item.replayVideo.title"
          :video-url="item.replayVideo.url"
          :cover-url="item.replayVideo.coverUrl"
        />
    </template>
  </Card>
</template>

<style scoped>
.schedule-item {
  margin-bottom: 0.4rem;
  border: 1px solid rgba(100, 116, 139, 0.45);
  box-shadow: 0 8px 14px rgba(15, 23, 42, 0.08);
  border-radius: 10px;
  background: var(--surface-card);
  overflow: hidden;
  box-sizing: border-box;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.event-title {
  flex: 1 1 0;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-center {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  flex: 0 0 auto;
}

.header-meta {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
  flex: 1 1 0;
  min-width: 0;
  white-space: nowrap;
}

.time-text {
  font-size: 1.05rem;
  font-weight: 700;
  font-family: 'Courier New', monospace;
}

.item-content {
  display: flex;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 0.3rem;
  margin-top: 0.3rem;
  overflow: visible;
}

.team-column {
  flex: 1 1 0;
  min-width: 0;
}

.red-column :deep(.team-info) {
  text-align: right;
}

.center-column {
  flex: 0 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  min-width: 2.8rem;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: center;
}

.waiting-space {
  width: 1px;
  height: 2.2rem;
  opacity: 0;
}

.live-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.round-text {
  font-size: 0.78rem;
  color: var(--text-color-secondary);
}

.score-row {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
}

.score-value {
  font-size: 1.65rem;
  font-weight: 800;
  color: var(--text-color-secondary);
}

.score-value.winner {
  color: #22c55e;
}

.score-sep {
  font-size: 1.1rem;
  color: var(--text-color-secondary);
}

@media (max-width: 768px) {
  .item-header {
    gap: 0.18rem;
    flex-wrap: wrap;
  }

  .event-title {
    font-size: 0.74rem;
  }

  .header-meta {
    gap: 0.12rem;
    margin-left: auto;
  }

  .item-content {
    gap: 0.18rem;
    min-width: 0;
  }

  .team-column :deep(.team-info) {
    padding: 0.1rem 0.15rem;
  }

  .team-column :deep(h4) {
    font-size: 0.7rem;
  }

  .team-column :deep(p) {
    font-size: 0.6rem;
  }

  .center-column {
    flex: 0 1 auto;
    min-width: 2.2rem;
    gap: 0.15rem;
  }

  .center-column :deep(.p-tag-label) {
    font-size: 0.58rem;
  }

  .time-text {
    font-size: 0.72rem;
  }

  .score-value {
    font-size: 0.8rem;
  }

  .score-row {
    gap: 0.12rem;
  }

  .score-sep {
    font-size: 0.72rem;
  }

  .round-text {
    font-size: 0.54rem;
  }
}
</style>
