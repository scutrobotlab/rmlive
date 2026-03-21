<script setup lang="ts">
import Card from 'primevue/card';
import Divider from 'primevue/divider';
import Tag from 'primevue/tag';
import { computed } from 'vue';
import { resolvePayloadByZone, toMatchView } from '../../services/matchView';
import type { CurrentAndNextMatches } from '../../types/api';
import TeamInfoCard from '../common/TeamInfoCard.vue';

interface Props {
  payload: CurrentAndNextMatches | null;
  selectedZoneId: string | null;
  selectedZoneName: string | null;
  selectedZoneLiveState?: number | null;
  teamGroupMap?: Record<string, { group: string; rank: string }>;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  teamSelect: [teamName: string];
}>();

const zonePayload = computed(() => resolvePayloadByZone(props.payload, props.selectedZoneId, props.selectedZoneName));
const current = computed(() => toMatchView(zonePayload.value?.currentMatch));
const next = computed(() => toMatchView(zonePayload.value?.nextMatch));

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

const currentScoreParts = computed(() => {
  const score = current.value?.score ?? '0 : 0';
  const [red = '0', blue = '0'] = score.split(':').map((item) => item.trim());
  return { red, blue };
});

const liveStateTag = computed(() => {
  if (props.selectedZoneLiveState === 1) {
    return { label: '直播中', severity: 'success' as const };
  }
  return { label: '未直播', severity: 'warn' as const };
});
</script>

<template>
  <Card>
    <template #title> 当前对局 </template>
    <template #content>
      <div class="hero-meta">
        <Tag severity="contrast" :value="props.selectedZoneName ?? '未选择站点'" />
        <Tag :severity="liveStateTag.severity" :value="liveStateTag.label" />
      </div>

      <section class="block current-block">
        <header class="block-head">
          <h3>{{ current ? '当前对局' : '暂无当前对局' }}</h3>
          <Tag v-if="current" :value="current.status" severity="info" />
        </header>
        <div v-if="current" class="match-body">
          <div class="team-row">
            <TeamInfoCard
              :team-name="current.redTeam.teamName"
              :college-name="current.redTeam.collegeName"
              :logo="current.redTeam.logo"
              :group-label="toGroupLabel(current.redTeam.teamName)"
              @select="onSelectTeam"
            />

            <TeamInfoCard
              :team-name="current.blueTeam.teamName"
              :college-name="current.blueTeam.collegeName"
              :logo="current.blueTeam.logo"
              :group-label="toGroupLabel(current.blueTeam.teamName)"
              @select="onSelectTeam"
            />
          </div>

          <div class="score-board" aria-label="当前对局比分">
            <div class="score-grid">
              <div class="score-side score-side-red">
                <small>红方</small>
                <strong>{{ currentScoreParts.red }}</strong>
              </div>
              <div class="score-vs">:</div>
              <div class="score-side score-side-blue">
                <small>蓝方</small>
                <strong>{{ currentScoreParts.blue }}</strong>
              </div>
            </div>
            <div class="score-sub">小局 {{ current.gameScore }}</div>
          </div>
        </div>

        <template v-if="current">
          <div class="meta-tags">
            <Tag severity="secondary" :value="`阶段 ${current.stage}`" />
            <Tag severity="secondary" :value="`场次 ${current.orderNumber}`" />
            <Tag severity="contrast" :value="`开始 ${current.startAt}`" />
          </div>
        </template>
        <template v-else>
          <p>阶段: -</p>
          <p>场次: -</p>
          <p>开始时间: -</p>
        </template>
      </section>

      <Divider />

      <section class="block next-block">
        <header class="block-head">
          <h3>{{ next ? '下一场对局' : '暂无下一场信息' }}</h3>
          <Tag v-if="next" :value="next.status" severity="contrast" />
        </header>
        <div v-if="next" class="match-body">
          <div class="team-row">
            <TeamInfoCard
              compact
              :team-name="next.redTeam.teamName"
              :college-name="next.redTeam.collegeName"
              :logo="next.redTeam.logo"
              :group-label="toGroupLabel(next.redTeam.teamName)"
              @select="onSelectTeam"
            />

            <TeamInfoCard
              compact
              :team-name="next.blueTeam.teamName"
              :college-name="next.blueTeam.collegeName"
              :logo="next.blueTeam.logo"
              :group-label="toGroupLabel(next.blueTeam.teamName)"
              @select="onSelectTeam"
            />
          </div>
        </div>

        <template v-if="next">
          <div class="meta-tags">
            <Tag severity="secondary" :value="`阶段 ${next.stage}`" />
            <Tag severity="secondary" :value="`场次 ${next.orderNumber}`" />
            <Tag severity="contrast" :value="`预计 ${next.startAt}`" />
          </div>
        </template>
        <template v-else>
          <p>阶段: -</p>
          <p>场次: -</p>
          <p>预计开始: -</p>
        </template>
      </section>
    </template>
  </Card>
</template>

<style scoped>
.hero-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.65rem;
}

.block h3 {
  margin: 0;
  font-size: 1.05rem;
}

.block p {
  margin: 0.45rem 0 0;
  opacity: 0.92;
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

.match-body {
  margin-top: 0.75rem;
}

.current-block {
  border: 1px solid rgb(59 130 246 / 0.2);
  border-radius: 0.9rem;
  padding: 0.75rem;
  background: linear-gradient(180deg, rgb(30 41 59 / 0.16), rgb(15 23 42 / 0.08));
}

.score-board {
  margin-top: 0.8rem;
  padding: 1rem 1.1rem;
  border-radius: 0.8rem;
  text-align: center;
  background: linear-gradient(135deg, rgb(2 6 23 / 0.72), rgb(30 58 138 / 0.34));
  border: 1px solid rgb(96 165 250 / 0.35);
  box-shadow: inset 0 1px 0 rgb(191 219 254 / 0.22);
}

.score-main {
  font-size: clamp(2rem, 5vw, 2.8rem);
  font-weight: 700;
  letter-spacing: 0.06em;
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
  background: rgb(15 23 42 / 0.42);
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
  border: 1px solid rgb(248 113 113 / 0.4);
}

.score-side-blue {
  border: 1px solid rgb(96 165 250 / 0.4);
}

.score-sub {
  margin-top: 0.15rem;
  font-size: 0.9rem;
  opacity: 0.88;
}

.meta-tags {
  margin-top: 0.65rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.next-block {
  opacity: 0.9;
}

.next-block .block-head h3 {
  font-size: 0.95rem;
}

.next-block .match-body {
  margin-top: 0.5rem;
}

.next-block .meta-tags :deep(.p-tag) {
  font-size: 0.72rem;
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

  .score-main {
    font-size: clamp(1.6rem, 7vw, 2.1rem);
  }

  .score-grid {
    grid-template-columns: 1fr;
    gap: 0.35rem;
  }

  .score-vs {
    display: none;
  }

  .meta-tags :deep(.p-tag) {
    font-size: 0.72rem;
  }
}
</style>
