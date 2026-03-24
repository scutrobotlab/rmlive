<script setup lang="ts">
import Tag from 'primevue/tag';
import type { MatchView } from '../../services/matchView';
import TeamInfoCard from '../common/TeamInfoCard.vue';

interface Props {
  title: string;
  match: MatchView | null;
  teamGroupMap?: Record<string, { group: string; rank: string }>;
  compact?: boolean;
  hero?: boolean;
  startPrefix?: string;
  showHeader?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
  hero: false,
  startPrefix: '开始',
  showHeader: true,
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

function getScoreParts(score: string | undefined) {
  const raw = score ?? '0 : 0';
  const [red = '0', blue = '0'] = raw.split(':').map((item) => item.trim());
  return { red, blue };
}

function showSlug(slug: string): boolean {
  return Boolean(String(slug || '').trim());
}
</script>

<template>
  <section class="block" :class="{ 'hero-block': hero, 'compact-block': compact }">
    <header v-if="showHeader" class="block-head">
      <h3>{{ match ? title : `暂无${title}` }}</h3>
      <Tag v-if="match" :value="match.status" :severity="hero ? 'info' : 'contrast'" />
    </header>

    <div v-if="match" class="match-body">
      <div class="team-row">
        <div class="team-cell team-cell-red">
          <TeamInfoCard
            :compact="compact"
            :team-name="match.redTeam.teamName"
            :college-name="match.redTeam.collegeName"
            :logo="match.redTeam.logo"
            :group-label="toGroupLabel(match.redTeam.teamName)"
            @select="onSelectTeam"
          />
        </div>

        <div class="team-cell team-cell-blue">
          <TeamInfoCard
            :compact="compact"
            :team-name="match.blueTeam.teamName"
            :college-name="match.blueTeam.collegeName"
            :logo="match.blueTeam.logo"
            :group-label="toGroupLabel(match.blueTeam.teamName)"
            @select="onSelectTeam"
          />
        </div>
      </div>

      <div v-if="hero" class="score-board" aria-label="当前对局比分">
        <div class="score-grid">
          <div class="score-side score-side-red">
            <small>红方</small>
            <strong>{{ getScoreParts(match.score).red }}</strong>
          </div>
          <div class="score-vs">:</div>
          <div class="score-side score-side-blue">
            <small>蓝方</small>
            <strong>{{ getScoreParts(match.score).blue }}</strong>
          </div>
        </div>
        <Tag class="score-sub-tag" severity="contrast" icon="pi pi-chart-bar" :value="`比分 ${match.score}`" />
      </div>
    </div>

    <template v-if="match">
      <div class="meta-strip">
        <Tag v-if="showSlug(match.slug)" severity="secondary" icon="pi pi-link" :value="String(match.slug).trim()" />
        <Tag severity="secondary" icon="pi pi-sitemap" :value="`阶段 ${match.stage}`" />
        <Tag severity="secondary" icon="pi pi-hashtag" :value="`场次 ${match.orderNumber}`" />
        <Tag severity="contrast" icon="pi pi-clock" :value="`${startPrefix} ${match.startAt}`" />
      </div>
    </template>
    <template v-else>
      <div class="meta-strip meta-strip-empty">
        <Tag severity="secondary" icon="pi pi-sitemap" value="阶段 -" />
        <Tag severity="secondary" icon="pi pi-hashtag" value="场次 -" />
        <Tag severity="contrast" icon="pi pi-clock" :value="`${startPrefix} -`" />
      </div>
    </template>
  </section>
</template>

<style scoped>
.block h3 {
  margin: 0;
  font-size: 1.05rem;
}

.block p {
  margin: 0.45rem 0 0;
}

.block-head {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  justify-content: space-between;
}

.team-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.8rem;
  align-items: center;
}

.team-cell {
  min-width: 0;
}

.team-cell-red :deep(.team-info-inner) {
  flex-direction: row-reverse;
}

.team-cell-red :deep(.meta),
.team-cell-red :deep(.head-row) {
  text-align: right;
  justify-content: flex-end;
}

.team-cell-blue :deep(.meta),
.team-cell-blue :deep(.head-row) {
  text-align: left;
  justify-content: flex-start;
}

.match-body {
  margin-top: 0.62rem;
}

.compact-block {
  opacity: 0.9;
}

.compact-block .match-body {
  margin-top: 0.5rem;
}

.score-board {
  margin-top: 0.65rem;
  padding: 0.8rem 0.9rem;
  border-radius: 0.8rem;
  text-align: center;
  background: var(--scoreboard-bg-light);
  border: 1px solid var(--scoreboard-border);
  box-shadow: var(--scoreboard-box-shadow);
}

.score-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.55rem;
}

.score-vs {
  font-size: clamp(1.2rem, 3.2vw, 1.8rem);
  opacity: 0.9;
  font-weight: 700;
}

.score-side {
  border-radius: 0.65rem;
  padding: 0.5rem 0.45rem;
  background: var(--score-side-bg-light);
}

.score-side small {
  display: block;
  font-size: 0.74rem;
  opacity: 0.78;
}

.score-side strong {
  display: block;
  margin-top: 0.08rem;
  font-size: clamp(1.7rem, 4vw, 2.3rem);
}

.score-side-red {
  border: 1px solid var(--score-side-red-border);
}

.score-side-blue {
  border: 1px solid var(--score-side-blue-border);
}

.score-sub-tag {
  margin-top: 0.24rem;
}

.meta-strip {
  margin-top: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.meta-strip :deep(.p-tag) {
  font-size: 0.72rem;
}

.meta-strip-empty {
  margin-top: 0.4rem;
}

@media (max-width: 760px) {
  .block-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .block h3 {
    font-size: 1rem;
  }

  .team-row {
    grid-template-columns: 1fr;
  }

  .score-board {
    padding: 0.65rem 0.75rem;
  }

  .score-grid {
    grid-template-columns: 1fr;
    gap: 0.35rem;
  }

  .score-vs {
    display: none;
  }

  .meta-strip :deep(.p-tag) {
    font-size: 0.7rem;
  }
}
</style>
