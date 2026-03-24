<script setup lang="ts">
import Select from 'primevue/select';
import SelectButton from 'primevue/selectbutton';
import ToggleButton from 'primevue/togglebutton';
import Toolbar from 'primevue/toolbar';
import { computed } from 'vue';
import type { ZoneOptionItem } from '../../services/zoneView';

interface Props {
  isMobile: boolean;
  isDark: boolean;
  scheduleEventTitle?: string | null;
  selectedZoneId: string | null;
  zoneOptions: ZoneOptionItem[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  zoneChange: [value: string];
  themeChange: [value: boolean];
}>();

const brandLogoUrl = `${import.meta.env.BASE_URL}rmlive-logo.svg`;

function showZoneDate(option: ZoneOptionItem): boolean {
  return (option.state === 'upcoming' || option.state === 'ended') && option.dateText !== '-';
}

const currentZoneOption = computed(() => {
  return props.zoneOptions.find((item) => String(item.value) === String(props.selectedZoneId ?? '')) ?? null;
});

const themeChecked = computed({
  get: () => props.isDark,
  set: (value: boolean) => emit('themeChange', value),
});

function onZoneChange(value: string) {
  emit('zoneChange', value);
}
</script>

<template>
  <Toolbar class="top-toolbar">
    <template #start>
      <div class="toolbar-brand">
        <img :src="brandLogoUrl" alt="RMLive logo" class="brand-logo" />
        <div class="toolbar-brand-meta">
          <h1>
            <span>RMLive - Better 直播间</span>
            <small v-if="scheduleEventTitle" class="event-title">{{ scheduleEventTitle }}</small>
          </h1>
          <p>更清晰的赛事视图，更顺滑的直播体验</p>
        </div>
      </div>
    </template>

    <template #end>
      <div class="toolbar-actions">
        <SelectButton
          v-if="!isMobile"
          class="zone-select-button-wrap"
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
          optionLabel="label"
          optionValue="value"
          optionDisabled="disabled"
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

        <ToggleButton
          v-model="themeChecked"
          on-icon="pi pi-moon"
          off-icon="pi pi-sun"
          on-label=""
          off-label=""
          size="small"
          aria-label="主题切换"
        />
      </div>
    </template>
  </Toolbar>
</template>

<style scoped>
.top-toolbar {
  margin-bottom: 1rem;
}

.toolbar-brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.brand-logo {
  width: 40px;
  height: 40px;
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

.zone-name {
  white-space: nowrap;
}

.zone-date {
  font-size: 0.65rem;
  opacity: 0.74;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .brand-logo {
    width: 34px;
    height: 34px;
  }

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

  .zone-select-button-wrap {
    min-width: 0;
  }
}
</style>
