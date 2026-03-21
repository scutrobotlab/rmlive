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
</script>

<template>
  <Card>
    <template #title> 当前对局 </template>
    <template #content>
      <section class="block">
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

          <div class="score-line">
            <span class="score-pill">比分 {{ current.score }}</span>
            <span class="score-pill score-pill-sub">小局 {{ current.gameScore }}</span>
          </div>
        </div>

        <p>阶段: {{ current?.stage ?? '-' }}</p>
        <p>场次: {{ current?.orderNumber ?? '-' }}</p>
        <p>开始时间: {{ current?.startAt ?? '-' }}</p>
      </section>

      <Divider />

      <section class="block">
        <header class="block-head">
          <h3>{{ next ? '下一场对局' : '暂无下一场信息' }}</h3>
          <Tag v-if="next" :value="next.status" severity="contrast" />
        </header>
        <div v-if="next" class="match-body">
          <div class="team-row">
            <TeamInfoCard
              :team-name="next.redTeam.teamName"
              :college-name="next.redTeam.collegeName"
              :logo="next.redTeam.logo"
              :group-label="toGroupLabel(next.redTeam.teamName)"
              @select="onSelectTeam"
            />

            <TeamInfoCard
              :team-name="next.blueTeam.teamName"
              :college-name="next.blueTeam.collegeName"
              :logo="next.blueTeam.logo"
              :group-label="toGroupLabel(next.blueTeam.teamName)"
              @select="onSelectTeam"
            />
          </div>

          <div class="score-line">
            <span class="score-pill">比分 {{ next.score }}</span>
            <span class="score-pill score-pill-sub">小局 {{ next.gameScore }}</span>
          </div>
        </div>

        <p>阶段: {{ next?.stage ?? '-' }}</p>
        <p>场次: {{ next?.orderNumber ?? '-' }}</p>
        <p>预计开始: {{ next?.startAt ?? '-' }}</p>
      </section>
    </template>
  </Card>
</template>

<style scoped>
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

.score-line {
  margin-top: 0.7rem;
  display: flex;
  gap: 0.55rem;
  justify-content: center;
  flex-wrap: wrap;
}

.score-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.25rem 0.7rem;
  font-size: 0.82rem;
  font-weight: 700;
  background: rgb(51 65 85 / 0.35);
}

.score-pill-sub {
  background: rgb(71 85 105 / 0.25);
}

@media (max-width: 760px) {
  .team-row {
    grid-template-columns: 1fr;
  }
}
</style>
