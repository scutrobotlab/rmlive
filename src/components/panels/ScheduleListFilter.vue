<template>
  <div class="filters-row" :class="{ mobile: isMobile }">
    <MultiSelect
      v-model="selectedTeam"
      placeholder="筛选队伍"
      :options="teamOptions"
      option-label="label"
      option-value="value"
      filter
      display="chip"
      size="small"
      :max-selected-labels="isMobile ? 2 : 4"
    />
    <MultiSelect
      v-model="selectedZone"
      placeholder="筛选站点"
      :options="zoneOptions"
      option-label="label"
      option-value="value"
      display="chip"
      size="small"
      :max-selected-labels="isMobile ? 2 : 4"
    />
  </div>
</template>

<script setup lang="ts">
import { MultiSelect } from 'primevue';

// const models = defineModel<{
//   selectedTeam: string[];
//   selectedZone: string[];
// }>();
const selectedTeam = defineModel<string[]>('selectedTeam', { default: () => [] });
const selectedZone = defineModel<string[]>('selectedZone', { default: () => [] });
defineProps<{
  isMobile: boolean;
  teamOptions: { label: string; value: string }[];
  zoneOptions: { label: string; value: string }[];
}>();
</script>

<style scoped>
.filters-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--surface-ground);
  border-bottom: 1px solid var(--surface-border);
  border-radius: 4px 4px 0 0;
  margin-bottom: 1rem;
}

@media (max-width: 768px) {
  .filters-row {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    flex-direction: column;
    align-items: stretch;
    gap: 0.55rem;
    padding: 0.5rem;
    margin-bottom: 0.8rem;
  }
}
</style>
