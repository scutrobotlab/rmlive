<script setup lang="ts">
import { useRmDataStore } from '@/stores/rmData';
import { useUiStore } from '@/stores/ui';
import type { ZoneOptionItem } from '@/utils/zoneView';
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import Popover from 'primevue/popover';
import Select from 'primevue/select';
import SelectButton from 'primevue/selectbutton';
import Toolbar from 'primevue/toolbar';
import { computed, ref } from 'vue';
import SettingsDialog from '../dialogs/SettingsDialog.vue';
import ThemeLogoButton from './ThemeLogoButton.vue';
import UserProfilePop from './UserProfilePop.vue';

const dataStore = useRmDataStore();
const uiStore = useUiStore();

const { isMobile, isDark } = storeToRefs(uiStore);
const { scheduleEventTitle, selectedZoneId, zoneOptions } = storeToRefs(dataStore);

const brandLogoUrl = `${import.meta.env.BASE_URL}rmlive-logo.svg`;
const mobileAccessPopover = ref<InstanceType<typeof Popover> | null>(null);

function showZoneDate(option: ZoneOptionItem): boolean {
  return (option.state === 'upcoming' || option.state === 'ended') && option.dateText !== '-';
}

const currentZoneOption = computed(() => {
  return (
    zoneOptions.value.find((item: ZoneOptionItem) => String(item.value) === String(selectedZoneId.value ?? '')) ?? null
  );
});

function onZoneChange(value: string) {
  dataStore.selectZone(value);
}

function onThemeChange(value: boolean) {
  uiStore.setDarkMode(value);
}

function goToGithub() {
  window.open('https://github.com/scutrobotlab/rmlive', '_blank');
}

const mobileAccessUrl = computed(() => {
  if (typeof window === 'undefined') {
    return '';
  }
  return `${window.location.origin}${window.location.pathname}${window.location.search}`;
});

const mobileAccessQrUrl = computed(() => {
  if (!mobileAccessUrl.value) {
    return '';
  }
  const query = encodeURIComponent(mobileAccessUrl.value);
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${query}`;
});

function toggleMobileAccess(event: Event) {
  mobileAccessPopover.value?.toggle(event);
}

const settingsVisible = ref(false);
</script>

<template>
  <Toolbar class="top-toolbbar">
    <template #start>
      <div class="toolbar-brand">
        <img :src="brandLogoUrl" alt="RMLive logo" class="brand-logo" />
        <div class="toolbar-brand-meta" v-if="!uiStore.isMobile">
          <h1>
            <span>RMLive</span>
            <small class="event-title">更清晰的赛事视图，更顺滑的直播体验</small>
          </h1>
          <p v-if="scheduleEventTitle">{{ scheduleEventTitle }}</p>
        </div>
      </div>
    </template>

    <template #center>
      <SelectButton
        v-if="!isMobile"
        class="zone-select-button-wrap"
        :model-value="selectedZoneId"
        :options="zoneOptions"
        option-label="label"
        option-value="value"
        option-disabled="disabled"
        size="small"
        @update:model-value="onZoneChange"
      >
        <template #option="slotProps">
          <div class="zone-option-content">
            <span v-if="slotProps.option.liveLogo" class="zone-live-prefix" aria-hidden="true">
              <i class="pi pi-video" />
            </span>
            <span class="zone-option-text">
              <span class="zone-name">{{ slotProps.option.title }}</span>
              <span v-if="showZoneDate(slotProps.option)" class="zone-date">{{ slotProps.option.dateText }}</span>
            </span>
          </div>
        </template>
      </SelectButton>
      <Select
        v-else
        class="zone-select"
        :model-value="selectedZoneId"
        :options="zoneOptions"
        option-label="label"
        option-value="value"
        option-disabled="disabled"
        size="small"
        placeholder="站点"
        @update:model-value="onZoneChange"
      >
        <template #value="slotProps">
          <div v-if="currentZoneOption" class="zone-option-content">
            <span v-if="currentZoneOption.liveLogo" class="zone-live-prefix" aria-hidden="true">
              <i class="pi pi-video" />
            </span>
            <span class="zone-option-text">
              <span class="zone-name">{{ currentZoneOption.title }}</span>
              <span v-if="showZoneDate(currentZoneOption)" class="zone-date">{{ currentZoneOption.dateText }}</span>
            </span>
          </div>
          <span v-else>{{ slotProps.placeholder || '站点' }}</span>
        </template>
        <template #option="slotProps">
          <div class="zone-option-content">
            <span v-if="slotProps.option.liveLogo" class="zone-live-prefix" aria-hidden="true">
              <i class="pi pi-video" />
            </span>
            <span class="zone-option-text">
              <span class="zone-name">{{ slotProps.option.title }}</span>
              <span v-if="showZoneDate(slotProps.option)" class="zone-date">{{ slotProps.option.dateText }}</span>
            </span>
          </div>
        </template>
      </Select>
    </template>

    <template #end>
      <UserProfilePop v-if="!uiStore.isMobile" />
      <Button
        v-if="!uiStore.isMobile"
        icon="pi pi-mobile"
        rounded
        text
        size="small"
        severity="contrast"
        aria-label="扫码在手机访问 RMLive"
        @click="toggleMobileAccess"
      />
      <Popover ref="mobileAccessPopover" :show-close-icon="false">
        <div class="flex w-[220px] flex-col items-center gap-3">
          <p class="m-0 text-center text-sm">扫码在手机访问RMLive</p>
          <img
            v-if="mobileAccessQrUrl"
            :src="mobileAccessQrUrl"
            alt="RMLive 手机访问二维码"
            class="h-[220px] w-[220px]"
          />
          <a
            v-if="mobileAccessUrl"
            :href="mobileAccessUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="max-w-full truncate text-xs"
          >
            {{ mobileAccessUrl }}
          </a>
        </div>
      </Popover>
      <Button
        rounded
        text
        size="small"
        icon="pi pi-cog"
        severity="contrast"
        class="settings-entry"
        aria-label="打开设置"
        @click="settingsVisible = true"
      >
      </Button>
      <SettingsDialog v-model:visible="settingsVisible" />
      <Button
        v-if="!uiStore.isMobile"
        icon="pi pi-github"
        rounded
        text
        size="small"
        severity="contrast"
        aria-label="访问 GitHub 仓库"
        @click="goToGithub"
      />
      <ThemeLogoButton :is-dark="isDark" @change="onThemeChange" />
    </template>
  </Toolbar>
</template>

<style scoped>
.toolbar-brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.brand-logo {
  width: clamp(2.125rem, 3.8vw, 2.5rem);
  height: clamp(2.125rem, 3.8vw, 2.5rem);
  flex-shrink: 0;
}

.toolbar-brand-meta h1 {
  margin: 0;
  font-size: 1.02rem;
  line-height: 1.15;
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
}

.event-title {
  font-size: 0.72rem;
  font-weight: 500;
  opacity: 0.78;
}

.toolbar-brand-meta p {
  margin: 0.18rem 0 0;
  font-size: 0.78rem;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.toolbar-actions > * {
  flex-shrink: 0;
}

.zone-select {
  min-width: 9rem;
}

.zone-select-button-wrap {
  flex: 1;
  min-width: 0;
}

.zone-option-content {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.zone-live-prefix {
  width: 1.05rem;
  height: 1.05rem;
  border-radius: 999px;
  background: color-mix(in srgb, #ef4444 22%, transparent);
  color: #ef4444;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.zone-live-prefix .pi {
  font-size: 0.6rem;
}

.zone-option-text {
  min-width: 0;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.1;
}

.zone-name,
.zone-date {
  white-space: nowrap;
}

.zone-date {
  font-size: 0.65rem;
  opacity: 0.74;
}

.settings-entry {
  padding: 0.25rem;
}

.settings-entry-logo {
  display: block;
  width: 1.35rem;
  height: 1.35rem;
  object-fit: contain;
  opacity: 0.92;
}

@media (width <= 768px) {
  .toolbar-brand-meta h1 {
    font-size: 0.92rem;
  }

  .toolbar-brand-meta p {
    display: none;
  }

  .toolbar-actions {
    gap: 0.35rem;
  }

  .zone-select {
    min-width: 0;
    flex: 1;
  }
}
</style>
