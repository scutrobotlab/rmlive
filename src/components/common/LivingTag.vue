<script setup lang="ts">
import { useRmDataStore } from '@/stores/rmData';
import { normalizeZoneId } from '@/utils/zoneView';
import Tag from 'primevue/tag';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    zoneId: string | number | null | undefined;
    zoneName?: string | null;
    compact?: boolean;
  }>(),
  { zoneName: null, compact: false },
);

const dataStore = useRmDataStore();
const { zoneOptions } = storeToRefs(dataStore);

const normalizedTarget = computed(() => normalizeZoneId(props.zoneId));

const switchTarget = computed(() => {
  const id = normalizedTarget.value;
  if (!id) {
    return null;
  }
  const opt = zoneOptions.value.find((item) => normalizeZoneId(item.value) === id);
  if (!opt || opt.disabled) {
    return null;
  }
  return opt.value;
});

const canSwitch = computed(() => switchTarget.value != null);

const ariaLabel = computed(() => {
  const name = String(props.zoneName ?? '').trim();
  const suffix = name ? `${name} ` : '';
  return canSwitch.value ? `切换到${suffix}直播站点` : '正在直播（当前不可切换站点）';
});

function onClick() {
  if (!canSwitch.value || switchTarget.value == null) {
    return;
  }
  dataStore.selectZone(switchTarget.value);
}
</script>

<template>
  <button
    type="button"
    class="living-tag-hit"
    :class="{ compact, 'is-interactive': canSwitch }"
    :disabled="!canSwitch"
    :aria-label="ariaLabel"
    @click="onClick"
  >
    <Tag icon="pi pi-circle-fill" value="正在直播" rounded class="living-tag-pv" />
  </button>
</template>

<style scoped>
.living-tag-hit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  line-height: 1;
  cursor: default;
}

.living-tag-hit.is-interactive:not(:disabled) {
  cursor: pointer;
}

.living-tag-hit.is-interactive:focus-visible {
  outline: 2px solid var(--p-primary-color, #3b82f6);
  outline-offset: 2px;
  border-radius: 6px;
}

.living-tag-hit:disabled {
  opacity: 0.85;
}

.living-tag-pv {
  display: inline-flex;
}

.living-tag-hit :deep(.p-tag) {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  min-height: 0;
  padding: 0.2rem 0.5rem;
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.1;
  border: none;
  background: rgba(249, 115, 22, 0.14);
  color: #ea580c;
  animation: live-breathe 1.4s ease-in-out infinite;
}

.app-dark .living-tag-hit :deep(.p-tag) {
  background: rgba(249, 115, 22, 0.18);
  color: #fb923c;
}

.living-tag-hit :deep(.p-tag-icon) {
  font-size: 0.45rem;
  line-height: 1;
}

.living-tag-hit :deep(.p-tag-label) {
  line-height: 1.1;
}

.living-tag-hit.compact :deep(.p-tag) {
  padding: 0.12rem 0.38rem;
  font-size: 0.62rem;
  gap: 0.2rem;
}

.living-tag-hit.compact :deep(.p-tag-icon) {
  font-size: 0.4rem;
}

@keyframes live-breathe {
  0%,
  100% {
    opacity: 0.72;
  }
  50% {
    opacity: 1;
  }
}
</style>
