<script setup lang="ts">
import Button from 'primevue/button';
import Card from 'primevue/card';
import Dialog from 'primevue/dialog';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import LivePlayer from './components/live/LivePlayer.vue';
import CurrentMatchPanel from './components/panels/CurrentMatchPanel.vue';
import MobileSchedulePanel from './components/panels/MobileSchedulePanel.vue';
import RobotDataPanel from './components/panels/RobotDataPanel.vue';
import SchedulePanel from './components/panels/SchedulePanel.vue';
import { buildTeamGroupMap, extractGroupSections, type GroupSection } from './services/groupView';
import {
  extractLiveZones,
  fetchLiveGameInfo,
  pickDefaultZoneId,
  resolveLiveStreamUrl,
  startRmPolling,
  type RmPollingController,
} from './services/rmApi';
import type { CurrentAndNextMatches, GroupsOrder, LiveGameInfo, RobotData, Schedule } from './types/api';

const THEME_KEY = 'rm-live-theme';
const MOBILE_BREAKPOINT = 768;

const isDark = ref(true);

const liveGameInfo = ref<LiveGameInfo | null>(null);
const currentAndNextMatches = ref<CurrentAndNextMatches | null>(null);
const groupsOrder = ref<GroupsOrder | null>(null);
const robotData = ref<RobotData | null>(null);
const schedule = ref<Schedule | null>(null);

const selectedZoneId = ref<string | null>(null);
const selectedQualityRes = ref<string | null>(null);
const dataDialogVisible = ref(false);
const dataDialogTeam = ref<string | null>(null);

const streamLoading = ref(true);
const streamErrorMessage = ref('');
const lastError = ref('');
const lastUpdated = ref('-');

let pollingController: RmPollingController | null = null;

const liveZones = computed(() => extractLiveZones(liveGameInfo.value));

const selectedZone = computed(() => {
  if (!liveZones.value.length) {
    return null;
  }

  return liveZones.value.find((zone) => zone.zoneId === selectedZoneId.value) ?? liveZones.value[0];
});

const selectedZoneName = computed(() => selectedZone.value?.zoneName ?? null);

const zoneOptions = computed(() => {
  return liveZones.value.map((item) => ({
    label: item.liveState === 1 ? item.zoneName : `${item.zoneName}（未直播）`,
    value: item.zoneId,
  }));
});

const qualityOptions = computed(() => {
  if (!selectedZone.value) {
    return [];
  }

  return selectedZone.value.qualities.map((item) => ({
    label: item.label,
    value: item.res,
  }));
});

const streamUrl = computed(() =>
  resolveLiveStreamUrl(liveGameInfo.value, selectedZoneId.value, selectedQualityRes.value),
);
const canPlaySelectedZone = computed(() => (selectedZone.value?.liveState ?? 0) === 1);
const effectiveStreamUrl = computed(() => (canPlaySelectedZone.value ? streamUrl.value : null));
const effectiveStreamErrorMessage = computed(() => {
  if (!canPlaySelectedZone.value && selectedZone.value) {
    return `${selectedZone.value.zoneName} 当前未直播，请切换到直播中的站点`;
  }
  return streamErrorMessage.value;
});
const hasError = computed(() => lastError.value.length > 0);
const isMobile = ref(false);

function updateViewport() {
  isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT;
}

function updateTimestamp() {
  lastUpdated.value = new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

function applyTheme() {
  document.documentElement.classList.toggle('app-dark', isDark.value);
  localStorage.setItem(THEME_KEY, isDark.value ? 'dark' : 'light');
}

function toggleTheme() {
  isDark.value = !isDark.value;
  applyTheme();
}

watch(
  liveZones,
  (zones) => {
    if (!zones.length) {
      selectedZoneId.value = null;
      selectedQualityRes.value = null;
      return;
    }

    const hasZone = zones.some((item) => item.zoneId === selectedZoneId.value);
    if (!hasZone) {
      selectedZoneId.value = pickDefaultZoneId(zones);
    }
  },
  { immediate: true },
);

watch(
  selectedZone,
  (zone) => {
    if (!zone) {
      selectedQualityRes.value = null;
      return;
    }

    const hasQuality = zone.qualities.some((item) => item.res === selectedQualityRes.value);
    if (!hasQuality) {
      selectedQualityRes.value = zone.qualities[0]?.res ?? null;
    }
  },
  { immediate: true },
);

function onZoneChange(value: string | null) {
  selectedZoneId.value = value;
}

function onQualityChange(value: string | null) {
  selectedQualityRes.value = value;
}

function onOpenTeamData(teamName: string) {
  if (!teamName || teamName === '-') {
    return;
  }

  dataDialogTeam.value = teamName;
  dataDialogVisible.value = true;
}

async function retryLiveStream() {
  streamErrorMessage.value = '';
  streamLoading.value = true;

  try {
    liveGameInfo.value = await fetchLiveGameInfo();
    updateTimestamp();
  } catch {
    streamErrorMessage.value = '直播流请求失败，请检查网络后重试';
  } finally {
    streamLoading.value = false;
  }
}

function startPolling() {
  pollingController = startRmPolling({
    onLiveGameInfo(data) {
      liveGameInfo.value = data;
      streamLoading.value = false;
      streamErrorMessage.value = '';
      lastError.value = '';
      updateTimestamp();
    },
    onCurrentAndNextMatches(data) {
      currentAndNextMatches.value = data;
      lastError.value = '';
      updateTimestamp();
    },
    onGroupsOrder(data) {
      groupsOrder.value = data;
      lastError.value = '';
      updateTimestamp();
    },
    onRobotData(data) {
      robotData.value = data;
      lastError.value = '';
      updateTimestamp();
    },
    onSchedule(data) {
      schedule.value = data;
      lastError.value = '';
      updateTimestamp();
    },
    onError() {
      lastError.value = '部分接口请求失败，正在自动重试';
      streamLoading.value = false;
      if (!streamUrl.value) {
        streamErrorMessage.value = '直播流暂时不可用，请稍后重试';
      }
    },
  });
}

onMounted(() => {
  const stored = localStorage.getItem(THEME_KEY);
  isDark.value = stored ? stored === 'dark' : true;
  applyTheme();
  updateViewport();
  window.addEventListener('resize', updateViewport);
  startPolling();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport);
  pollingController?.stopAll();
});

const groupSections = computed(() =>
  extractGroupSections(groupsOrder.value, selectedZoneId.value, selectedZoneName.value),
);

const teamGroupMap = computed(() => buildTeamGroupMap(groupSections.value));

const dialogTeamGroupSection = computed<GroupSection | null>(() => {
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
</script>

<template>
  <main class="app-shell">
    <Card class="controls-card">
      <template #content>
        <div class="controls">
          <Tag :severity="hasError ? 'danger' : 'success'" :value="hasError ? '部分数据异常' : '数据更新中'" />
          <Tag severity="info" :value="`最近刷新: ${lastUpdated}`" />

          <Select
            :model-value="selectedZoneId"
            :options="zoneOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="选择直播间"
            class="zone-select"
            @update:model-value="onZoneChange"
          />

          <Select
            :model-value="selectedQualityRes"
            :options="qualityOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="选择清晰度"
            class="quality-select"
            @update:model-value="onQualityChange"
          />

          <Button size="small" :label="isDark ? '切换浅色' : '切换深色'" outlined @click="toggleTheme" />
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
        :team-group-map="teamGroupMap"
        @team-select="onOpenTeamData"
      />
    </section>

    <section class="main-grid">
      <div class="live-column">
        <LivePlayer
          :stream-url="effectiveStreamUrl"
          :loading="streamLoading"
          :error-message="effectiveStreamErrorMessage"
          @retry="retryLiveStream"
        />
      </div>
    </section>

    <section class="lower-grid">
      <div class="schedule-cell">
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
    </section>

    <Dialog v-model:visible="dataDialogVisible" modal header="比赛数据" :style="{ width: 'min(1100px, 96vw)' }">
      <section v-if="dialogTeamGroupSection" class="group-block">
        <h3>{{ dialogTeamGroupSection.group }} 组排名</h3>
        <div class="group-list">
          <article
            v-for="item in dialogTeamGroupSection.teams"
            :key="`${dialogTeamGroupSection.group}-${item.teamName}`"
            class="group-row"
            :class="{ active: item.teamName === dataDialogTeam }"
          >
            <span class="rank">#{{ item.rank }}</span>
            <div class="meta">
              <strong>{{ item.teamName }}</strong>
              <small>{{ item.collegeName }}</small>
            </div>
            <span v-if="item.teamName === dataDialogTeam" class="current">当前查看</span>
          </article>
        </div>
      </section>

      <RobotDataPanel :payload="robotData" :selected-zone-id="selectedZoneId" :team-name="dataDialogTeam" />
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
  background:
    radial-gradient(1200px 500px at 80% -10%, rgba(0, 112, 243, 0.22), transparent 60%),
    linear-gradient(180deg, #020617 0%, #0f172a 100%);
}

.app-shell {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1rem;
  box-sizing: border-box;
  overflow-x: clip;
}

.controls-card {
  margin-bottom: 1rem;
}

.controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.zone-select,
.quality-select {
  min-width: 10rem;
}

:deep(.p-dialog) {
  max-width: calc(100vw - 1rem);
}

.main-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
}

.match-hero {
  margin-bottom: 1rem;
}

.lower-grid {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
  grid-template-columns: 1fr;
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

.group-list {
  display: grid;
  gap: 0.35rem;
}

.group-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.6rem;
  align-items: center;
  padding: 0.38rem 0.5rem;
  border-radius: 0.55rem;
  background: rgba(15, 23, 42, 0.35);
}

.group-row.active {
  outline: 1px solid rgba(59, 130, 246, 0.7);
  background: rgba(59, 130, 246, 0.12);
}

.group-row .rank {
  font-weight: 700;
  font-size: 0.82rem;
}

.group-row .meta {
  min-width: 0;
}

.group-row .meta strong {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-row .meta small {
  display: block;
  opacity: 0.75;
  font-size: 0.78rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-row .current {
  font-size: 0.72rem;
  color: #93c5fd;
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

  .controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .controls > * {
    min-width: 0;
  }

  .zone-select,
  .quality-select {
    min-width: 0;
    width: 100%;
  }

  .controls :deep(.p-button) {
    width: 100%;
  }
}

@media (max-width: 520px) {
  .controls {
    grid-template-columns: 1fr;
  }
}
</style>
