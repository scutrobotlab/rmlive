<script setup lang="ts">
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';
import Tag from 'primevue/tag';
import { computed, nextTick, ref, watch } from 'vue';
import { resolveGroupRankSectionByGroup, resolveGroupRankSectionByTeam } from '../../services/groupRankView';
import type { GroupSection } from '../../services/groupView';
import {
  buildDialogRankRows,
  buildDialogTeamRows,
  findDialogTeamGroupSection,
  sortDialogRankRows,
} from '../../services/matchDataFormat';
import { buildImageUrl } from '../../services/urlProxy';
import type { GroupRankInfo, RobotData } from '../../types/api';
import RobotDataPanel from '../panels/RobotDataPanel.vue';

interface Props {
  visible: boolean;
  selectedTeam: string | null;
  selectedZoneId: string | null;
  selectedZoneName: string | null;
  groupSections: GroupSection[];
  groupRankInfo: GroupRankInfo | null;
  robotData: RobotData | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:visible': [visible: boolean];
  'team-select': [teamName: string];
}>();

const rankTableWrapRef = ref<HTMLElement | null>(null);

const dialogTeamGroupSection = computed(() => findDialogTeamGroupSection(props.groupSections, props.selectedTeam));

const dialogTeamRows = computed(() => buildDialogTeamRows(dialogTeamGroupSection.value, props.selectedTeam));

const dialogRankSection = computed(() => {
  const byGroup = resolveGroupRankSectionByGroup(
    props.groupRankInfo,
    props.selectedZoneId,
    props.selectedZoneName,
    dialogTeamGroupSection.value?.group ?? null,
  );

  if (byGroup) {
    return byGroup;
  }

  return resolveGroupRankSectionByTeam(
    props.groupRankInfo,
    props.selectedZoneId,
    props.selectedZoneName,
    props.selectedTeam,
  );
});

const dialogRankRows = computed(() =>
  buildDialogRankRows(dialogRankSection.value, dialogTeamRows.value, props.selectedTeam),
);
const sortedDialogRankRows = computed(() => sortDialogRankRows(dialogRankRows.value));

const hasGroupRankSection = computed(() => Boolean(dialogRankSection.value || dialogTeamGroupSection.value));
const rankSectionTitle = computed(
  () => dialogRankSection.value?.groupName ?? dialogTeamGroupSection.value?.group ?? '当前组',
);
const compactRankRows = computed(() => sortedDialogRankRows.value.slice(0, 8));

function scrollToCurrentRankRow() {
  if (!props.visible) {
    return;
  }

  const wrap = rankTableWrapRef.value;
  if (!wrap) {
    return;
  }

  const row = wrap.querySelector('.rank-row.is-current-row') as HTMLElement | null;
  row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

watch(
  () => [props.visible, props.selectedTeam, sortedDialogRankRows.value.length],
  () => {
    void nextTick(() => scrollToCurrentRankRow());
  },
);

function onDialogVisibleChange(value: boolean) {
  emit('update:visible', value);
}

function onOpenTeamData(teamName: string) {
  if (!teamName || teamName === '-') {
    return;
  }

  emit('team-select', teamName);
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="比赛数据"
    :style="{ width: 'min(1100px, 96vw)' }"
    @update:visible="onDialogVisibleChange"
  >
    <section v-if="hasGroupRankSection" class="group-block">
      <h3>{{ rankSectionTitle }} 组排名</h3>
      <div v-if="compactRankRows.length" ref="rankTableWrapRef" class="group-rank-table-wrap">
        <article
          v-for="row in compactRankRows"
          :key="`${rankSectionTitle}-${row.teamName}-${row.rankDisplay}`"
          class="rank-row"
          :class="{ 'is-current-row': row.isCurrent }"
          role="button"
          tabindex="0"
          @click="onOpenTeamData(row.teamName)"
          @keydown.enter.prevent="onOpenTeamData(row.teamName)"
          @keydown.space.prevent="onOpenTeamData(row.teamName)"
        >
          <div class="rank-main">
            <Tag :value="`#${row.rankDisplay}`" :severity="row.isCurrent ? 'info' : 'contrast'" />
            <img
              v-if="row.collegeLogo"
              class="rank-team-logo"
              :src="buildImageUrl(row.collegeLogo)"
              :alt="`${row.teamName} logo`"
            />
            <div class="rank-meta">
              <strong>{{ row.teamName }}</strong>
              <small>{{ row.collegeName }}</small>
            </div>
            <Tag v-if="row.isCurrent" value="当前查看" severity="info" />
          </div>

          <div class="rank-metrics">
            <Tag :value="`胜平负 ${row.winDrawLose}`" severity="secondary" />
            <Tag :value="`积分 ${row.points}`" severity="secondary" />
            <Tag :value="`净胜 ${row.netVictoryPoint}`" severity="secondary" />
          </div>
        </article>
      </div>
      <Message v-else severity="warn" :closable="false" class="rank-empty-tip">
        当前组暂无可展示的详细排名数据
      </Message>
    </section>
    <Message v-else severity="warn" :closable="false">未匹配到当前队伍对应的小组排名数据</Message>

    <RobotDataPanel v-if="visible" :payload="robotData" :selected-zone-id="selectedZoneId" :team-name="selectedTeam" />
  </Dialog>
</template>

<style scoped>
:deep(.p-dialog) {
  max-width: calc(100vw - 1rem);
}

.group-block {
  margin-bottom: 0.8rem;
}

.group-block h3 {
  margin: 0 0 0.5rem;
  font-size: 0.96rem;
}

.rank-empty-tip {
  margin-top: 0.55rem;
}

.group-rank-table-wrap {
  overflow: auto;
  max-height: 20rem;
  display: grid;
  gap: 0.45rem;
}

.rank-row {
  padding: 0.4rem 0;
  cursor: pointer;
  border-radius: 0.55rem;
}

.rank-row.is-current-row {
  background: color-mix(in srgb, var(--p-primary-500) 14%, transparent);
  outline: 1px solid color-mix(in srgb, var(--p-primary-500) 38%, transparent);
  padding: 0.4rem 0.45rem;
}

.rank-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.rank-team-logo {
  width: 1.8rem;
  height: 1.8rem;
  border-radius: 999px;
  object-fit: cover;
  flex-shrink: 0;
}

.rank-meta {
  min-width: 0;
  flex: 1;
}

.rank-meta strong {
  display: block;
  line-height: 1.15;
}

.rank-meta small {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
