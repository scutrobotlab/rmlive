<script setup lang="ts">
import { storeToRefs } from 'pinia';
import Card from 'primevue/card';
import Dialog from 'primevue/dialog';
import InputGroup from 'primevue/inputgroup';
import InputGroupAddon from 'primevue/inputgroupaddon';
import Message from 'primevue/message';
import Select from 'primevue/select';
import SelectButton from 'primevue/selectbutton';
import Skeleton from 'primevue/skeleton';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';
import ToggleButton from 'primevue/togglebutton';
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import CurrentMatchPanel from './components/panels/CurrentMatchPanel.vue';
import { resolveGroupRankSectionByGroup, resolveGroupRankSectionByTeam } from './services/groupRankView';
import { buildImageUrl } from './services/urlProxy';
import { useRmDataStore } from './stores/rmData';
import { useUiStore } from './stores/ui';

const LivePlayer = defineAsyncComponent(() => import('./components/live/LivePlayer.vue'));
const SchedulePanel = defineAsyncComponent(() => import('./components/panels/SchedulePanel.vue'));
const MobileSchedulePanel = defineAsyncComponent(() => import('./components/panels/MobileSchedulePanel.vue'));
const RobotDataPanel = defineAsyncComponent(() => import('./components/panels/RobotDataPanel.vue'));

const dataStore = useRmDataStore();
const uiStore = useUiStore();

const {
  currentAndNextMatches,
  robotData,
  schedule,
  groupRankInfo,
  selectedZone,
  selectedZoneId,
  selectedQualityRes,
  streamLoading,
  effectiveStreamUrl,
  effectiveStreamErrorMessage,
  selectedZoneName,
  zoneOptions,
  teamGroupMap,
  groupSections,
} = storeToRefs(dataStore);

const { isDark, dataDialogVisible, dataDialogTeam, isMobile, nextMatchExpanded } = storeToRefs(uiStore);

const dialogTeamGroupSection = computed(() => {
  if (!dataDialogTeam.value) {
    return null;
  }

  for (const section of groupSections.value) {
    if (section.teams.some((team) => team.teamName === dataDialogTeam.value)) {
      return section;
    }
  }

  return null;
});

const dialogTeamRows = computed(() => {
  const section = dialogTeamGroupSection.value;
  if (!section) {
    return [];
  }

  return section.teams.map((team, index) => ({
    rank: Number(team.rank) || index + 1,
    teamName: team.teamName,
    collegeName: team.collegeName,
    isCurrent: team.teamName === dataDialogTeam.value,
  }));
});

const dialogRankSection = computed(() => {
  const byGroup = resolveGroupRankSectionByGroup(
    groupRankInfo.value,
    selectedZoneId.value,
    selectedZoneName.value,
    dialogTeamGroupSection.value?.group ?? null,
  );

  if (byGroup) {
    return byGroup;
  }

  return resolveGroupRankSectionByTeam(
    groupRankInfo.value,
    selectedZoneId.value,
    selectedZoneName.value,
    dataDialogTeam.value,
  );
});

const dialogRankRows = computed(() => {
  const section = dialogRankSection.value;
  if (!section) {
    return dialogTeamRows.value.map((item) => ({
      rank: Number(item.rank) || 0,
      teamName: item.teamName,
      collegeName: item.collegeName,
      collegeLogo: '',
      winDrawLose: '-',
      points: 0,
      netVictoryPoint: 0,
      totalDamage: 0,
      totalRemainHp: 0,
      isCurrent: item.isCurrent,
      isFallback: true,
    }));
  }

  return section.rows.map((item) => ({
    ...item,
    isCurrent: item.teamName === dataDialogTeam.value,
    isFallback: false,
  }));
});

const sortedDialogRankRows = computed(() => {
  const rows = [...dialogRankRows.value].sort((a, b) => {
    if (a.isFallback && b.isFallback) {
      return a.rank - b.rank;
    }

    if (b.points !== a.points) {
      return b.points - a.points;
    }

    if (b.netVictoryPoint !== a.netVictoryPoint) {
      return b.netVictoryPoint - a.netVictoryPoint;
    }

    return a.rank - b.rank;
  });

  return rows.map((row, index) => ({
    ...row,
    rankDisplay: row.rank > 0 ? row.rank : index + 1,
  }));
});

const hasGroupRankSection = computed(() => {
  return Boolean(dialogRankSection.value || dialogTeamGroupSection.value);
});

const rankSectionTitle = computed(() => {
  return dialogRankSection.value?.groupName ?? dialogTeamGroupSection.value?.group ?? '当前组';
});

const compactRankRows = computed(() => {
  return sortedDialogRankRows.value.slice(0, 8);
});

const playerQualityOptions = computed(() => {
  const zone = selectedZone.value;
  if (!zone) {
    return [];
  }

  return zone.qualities.map((item) => ({
    label: item.label,
    value: item.res,
    src: item.src,
  }));
});

const onZoneChange = dataStore.setZone;
const retryLiveStream = dataStore.retryLiveStream;

const onOpenTeamData = uiStore.openTeamData;
const onNextExpandedChange = uiStore.setNextMatchExpanded;
const brandLogoUrl = `${import.meta.env.BASE_URL}rmlive-logo.svg`;
const enableSecondaryPanels = ref(false);

const themeChecked = computed({
  get: () => isDark.value,
  set: (value: boolean) => uiStore.setDarkMode(value),
});

const rankTableWrapRef = ref<HTMLElement | null>(null);

let deferTimer: number | null = null;

function mountSecondaryPanels() {
  enableSecondaryPanels.value = true;
}

function scheduleSecondaryPanelsMount() {
  const idleCallback = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
  if (idleCallback) {
    idleCallback(() => mountSecondaryPanels());
    return;
  }

  deferTimer = window.setTimeout(() => mountSecondaryPanels(), 180);
}

function rankRowClass(data: { isCurrent?: boolean }) {
  return data.isCurrent ? 'is-current-row' : '';
}

function scrollToCurrentRankRow() {
  if (!dataDialogVisible.value) {
    return;
  }

  const wrap = rankTableWrapRef.value;
  if (!wrap) {
    return;
  }

  const row = wrap.querySelector('.rank-row.is-current-row') as HTMLElement | null;
  row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

watch([dataDialogVisible, dataDialogTeam, sortedDialogRankRows], () => {
  void nextTick(() => scrollToCurrentRankRow());
});

onMounted(() => {
  uiStore.initializeUi();
  dataStore.startPolling();
  scheduleSecondaryPanelsMount();
});

onBeforeUnmount(() => {
  if (deferTimer !== null) {
    window.clearTimeout(deferTimer);
  }
  uiStore.teardownUi();
  dataStore.stopPolling();
});
</script>

<template>
  <main class="app-shell">
    <Toast position="top-center" />
    <header class="brand-head">
      <img :src="brandLogoUrl" alt="RMLive logo" class="brand-logo" />
      <div>
        <h1>RMLive - Better 直播间</h1>
        <p>更清晰的赛事视图，更顺滑的直播体验</p>
      </div>
    </header>

    <Card class="controls-card">
      <template #content>
        <div class="controls">
          <div v-if="!isMobile" class="zone-select-button-wrap">
            <SelectButton
              :model-value="selectedZoneId"
              :options="zoneOptions"
              optionLabel="label"
              optionValue="value"
              optionDisabled="disabled"
              fluid
              size="small"
              @update:model-value="onZoneChange"
            >
              <template #option="slotProps">
                <span class="zone-option-item" :class="`state-${slotProps.option.state}`">
                  <span v-if="slotProps.option.liveLogo" class="zone-start-badge" aria-hidden="true">
                    <span class="zone-live-dot" />
                    <span class="zone-live-text">LIVE</span>
                  </span>
                  <i v-else :class="slotProps.option.icon" aria-hidden="true" />
                  <span class="zone-option-texts">
                    <span class="zone-option-title">{{
                      slotProps.option.title || slotProps.option.label || slotProps.option.value
                    }}</span>
                    <small v-if="slotProps.option.dateText">{{ slotProps.option.dateText }}</small>
                  </span>
                </span>
              </template>
            </SelectButton>
          </div>

          <InputGroup v-else class="zone-select">
            <InputGroupAddon>
              <i class="pi pi-map-marker" />
            </InputGroupAddon>
            <Select
              :model-value="selectedZoneId"
              :options="zoneOptions"
              optionLabel="label"
              optionValue="value"
              optionDisabled="disabled"
              size="small"
              placeholder="站点"
              @update:model-value="onZoneChange"
            >
              <template #option="slotProps">
                <span class="zone-option-item" :class="`state-${slotProps.option.state}`">
                  <span v-if="slotProps.option.liveLogo" class="zone-start-badge" aria-hidden="true">
                    <span class="zone-live-dot" />
                    <span class="zone-live-text">LIVE</span>
                  </span>
                  <i v-else :class="slotProps.option.icon" aria-hidden="true" />
                  <span class="zone-option-texts">
                    <span class="zone-option-title">{{
                      slotProps.option.title || slotProps.option.label || slotProps.option.value
                    }}</span>
                    <small v-if="slotProps.option.dateText">{{ slotProps.option.dateText }}</small>
                  </span>
                </span>
              </template>
            </Select>
          </InputGroup>

          <ToggleButton
            v-model="themeChecked"
            on-icon="pi pi-moon"
            off-icon="pi pi-sun"
            on-label=""
            off-label=""
            size="small"
            class="theme-toggle-btn"
            aria-label="主题切换"
          />
        </div>
      </template>
    </Card>

    <section class="match-hero">
      <CurrentMatchPanel
        :key="selectedZoneId ?? 'zone-empty'"
        :payload="currentAndNextMatches"
        :selected-zone-id="selectedZoneId"
        :selected-zone-name="selectedZoneName"
        :selected-zone-live-state="selectedZone?.liveState ?? null"
        :next-expanded="nextMatchExpanded"
        :team-group-map="teamGroupMap"
        @team-select="onOpenTeamData"
        @update-next-expanded="onNextExpandedChange"
      />
    </section>

    <section class="main-grid">
      <div class="live-column">
        <LivePlayer
          :stream-url="effectiveStreamUrl"
          :loading="streamLoading"
          :error-message="effectiveStreamErrorMessage"
          :quality-options="playerQualityOptions"
          :selected-quality-res="selectedQualityRes"
          @retry="retryLiveStream"
        />
      </div>
    </section>

    <section class="lower-grid">
      <div v-if="enableSecondaryPanels" class="schedule-cell">
        <SchedulePanel
          v-if="!isMobile"
          :payload="schedule"
          :selected-zone-id="selectedZoneId"
          :team-group-map="teamGroupMap"
          @team-select="onOpenTeamData"
        />
        <MobileSchedulePanel
          v-else
          :payload="schedule"
          :selected-zone-id="selectedZoneId"
          :team-group-map="teamGroupMap"
          @team-select="onOpenTeamData"
        />
      </div>
      <div v-else class="schedule-placeholder">
        <Skeleton width="100%" height="18rem" borderRadius="12px" />
      </div>
    </section>

    <Dialog v-model:visible="dataDialogVisible" modal header="比赛数据" :style="{ width: 'min(1100px, 96vw)' }">
      <section v-if="hasGroupRankSection" class="group-block">
        <h3>{{ rankSectionTitle }} 组排名</h3>
        <div ref="rankTableWrapRef" class="group-rank-table-wrap" v-if="compactRankRows.length">
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
              <Tag :value="`#${row.rankDisplay}`" severity="contrast" />
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

      <RobotDataPanel
        v-if="dataDialogVisible"
        :payload="robotData"
        :selected-zone-id="selectedZoneId"
        :team-name="dataDialogTeam"
      />
    </Dialog>
  </main>
</template>

<style scoped>
:global(html),
:global(body),
:global(#app) {
  margin: 0;
  min-height: 100%;
}

:global(body) {
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: var(--app-fg);
  background:
    radial-gradient(1200px 500px at 80% -10%, var(--bg-radial), transparent 60%),
    linear-gradient(180deg, var(--bg-start) 0%, var(--bg-end) 100%);
  transition:
    background 220ms ease,
    color 220ms ease;
}

:global(:root) {
  --app-fg: #0f172a;
  --bg-start: #f8fafc;
  --bg-end: #e2e8f0;
  --bg-radial: rgba(14, 165, 233, 0.2);
  /* 记分板主题颜色 */
  --scoreboard-bg-light: linear-gradient(135deg, rgba(219, 234, 254, 0.45), rgba(191, 219, 254, 0.35));
  --scoreboard-bg-dark: linear-gradient(135deg, rgb(2 6 23 / 0.72), rgb(30 58 138 / 0.34));
  --scoreboard-border: rgb(148, 163, 184, 0.25);
  --scoreboard-box-shadow: inset 0 1px 0 rgba(191, 219, 254, 0.15);
  --score-side-bg-light: rgba(226, 232, 240, 0.48);
  --score-side-bg-dark: rgb(15 23 42 / 0.42);
  --score-side-red-border: rgb(248 113 113 / 0.35);
  --score-side-blue-border: rgb(96 165 250 / 0.35);
}

:global(html.app-dark) {
  --app-fg: #e2e8f0;
  --bg-start: #020617;
  --bg-end: #0f172a;
  --bg-radial: rgba(0, 112, 243, 0.22);
  /* 记分板主题颜色 */
  --scoreboard-bg-light: linear-gradient(135deg, rgb(2 6 23 / 0.72), rgb(30 58 138 / 0.34));
  --scoreboard-bg-dark: linear-gradient(135deg, rgb(2 6 23 / 0.72), rgb(30 58 138 / 0.34));
  --scoreboard-border: rgb(96 165 250 / 0.35);
  --scoreboard-box-shadow: inset 0 1px 0 rgb(191 219 254 / 0.22);
  --score-side-bg-light: rgb(15 23 42 / 0.42);
  --score-side-bg-dark: rgb(15 23 42 / 0.42);
  --score-side-red-border: rgb(248 113 113 / 0.4);
  --score-side-blue-border: rgb(96 165 250 / 0.4);
}

.app-shell {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1rem;
  box-sizing: border-box;
  overflow-x: clip;
}

.brand-head {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 0.95rem;
}

.brand-logo {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.brand-head h1 {
  margin: 0;
  font-size: 1.2rem;
  line-height: 1.15;
}

.brand-head p {
  margin: 0.18rem 0 0;
  opacity: 0.75;
  font-size: 0.84rem;
}

.controls-card {
  margin-bottom: 1rem;
}

.controls-card :deep(.p-card-body) {
  padding-top: 0.55rem;
  padding-bottom: 0.55rem;
}

.controls {
  display: flex;
  gap: 0.45rem;
  align-items: center;
  flex-wrap: nowrap;
}

.zone-select {
  min-width: 9rem;
}

.zone-select-button-wrap {
  flex: 1;
  min-width: 0;
}

.zone-option-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.zone-start-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.24rem;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  background: linear-gradient(90deg, #dc2626, #f43f5e);
  color: #fff;
  box-shadow: 0 2px 8px rgb(244 63 94 / 0.34);
}

.zone-live-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 0 0 0 rgb(255 255 255 / 0.8);
  animation: live-dot-pulse 1.6s ease-out infinite;
}

.zone-live-text {
  line-height: 1;
}

.zone-option-texts {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.05;
  min-width: 0;
}

.zone-option-title {
  font-weight: 600;
  color: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 11rem;
}

.zone-option-texts small {
  opacity: 0.72;
}

.zone-option-item.state-live > i {
  color: #22c55e;
}

.zone-option-item.state-live .zone-option-title {
  color: #16a34a;
}

.zone-option-item.state-offline i {
  color: #f59e0b;
}

.zone-option-item.state-upcoming i {
  color: #3b82f6;
}

.zone-option-item.state-ended i {
  color: #94a3b8;
}

@keyframes live-dot-pulse {
  70% {
    box-shadow: 0 0 0 0.34rem rgb(255 255 255 / 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgb(255 255 255 / 0);
  }
}

.theme-toggle-btn {
  margin-left: auto;
}

:deep(.p-dialog) {
  max-width: calc(100vw - 1rem);
}

.main-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
  min-width: 0;
}

.match-hero {
  margin-bottom: 1rem;
}

.live-column {
  min-width: 0;
}

.lower-grid {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
  grid-template-columns: 1fr;
}

.schedule-placeholder {
  opacity: 0.6;
}

.group-block {
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 0.75rem;
  padding: 0.7rem;
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
  border: 1px solid rgba(148, 163, 184, 0.26);
  border-radius: 0.65rem;
  padding: 0.5rem 0.6rem;
  cursor: pointer;
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
  border: 1px solid rgba(148, 163, 184, 0.38);
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
  opacity: 0.72;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rank-metrics {
  margin-top: 0.4rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.rank-row.is-current-row {
  border-color: rgba(59, 130, 246, 0.65);
  background: rgba(59, 130, 246, 0.12);
}

@media (max-width: 1024px) {
  .lower-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .app-shell {
    padding: 0.65rem;
  }

  .brand-head {
    margin-bottom: 0.75rem;
  }

  .brand-logo {
    width: 34px;
    height: 34px;
  }

  .brand-head h1 {
    font-size: 1rem;
  }

  .brand-head p {
    font-size: 0.76rem;
  }

  .controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .controls > * {
    min-width: 0;
  }

  .zone-select {
    min-width: 0;
    flex: 1;
  }

  .zone-select-button-wrap {
    min-width: 0;
  }

  .theme-toggle-btn {
    margin-left: 0;
    justify-self: end;
    width: fit-content;
  }
}

@media (max-width: 520px) {
  .theme-toggle-btn {
    margin-left: 0;
  }
}
</style>
