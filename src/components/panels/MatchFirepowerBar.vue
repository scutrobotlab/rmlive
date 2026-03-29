<script setup lang="ts">
import { useMatchEngagementStore } from '@/stores/matchEngagement';
import Button from 'primevue/button';
import { useThrottleFn } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import MatchFirepowerDuel from './MatchFirepowerDuel.vue';

const engagement = useMatchEngagementStore();
const { hydrateLoading } = storeToRefs(engagement);

const onRed = useThrottleFn(() => {
  void engagement.sendSupport('red');
}, 80);

const onBlue = useThrottleFn(() => {
  void engagement.sendSupport('blue');
}, 80);
</script>

<template>
  <div class="firepower-root" :class="{ 'firepower-root--hydrating': hydrateLoading }">
    <div class="firepower-section-hd">本场火力 PK</div>
    <MatchFirepowerDuel />
    <div class="firepower-actions">
      <Button label="红队助威" icon="pi pi-bolt" size="small" severity="danger" @click="onRed" />
      <Button
        label="蓝队助威"
        icon="pi pi-bolt"
        size="small"
        severity="info"
        outlined
        @click="onBlue"
      />
    </div>
  </div>
</template>

<style scoped>
.firepower-root {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-top: 0.5rem;
  min-width: 0;
  transition: opacity 0.2s ease;
}

.firepower-section-hd {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--p-text-muted-color, #94a3b8);
  text-transform: uppercase;
}

.firepower-root--hydrating {
  opacity: 0.82;
}

.firepower-actions {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>
