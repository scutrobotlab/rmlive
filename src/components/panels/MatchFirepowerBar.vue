<script setup lang="ts">
import { useMatchEngagementStore } from '@/stores/matchEngagement';
import { storeToRefs } from 'pinia';
import MatchFirepowerDuel from './MatchFirepowerDuel.vue';

const engagement = useMatchEngagementStore();
const { hydrateLoading } = storeToRefs(engagement);
</script>

<template>
  <div :class="['-mb-px min-w-0', hydrateLoading ? 'opacity-80 transition-opacity' : '']">
    <MatchFirepowerDuel />
  </div>
</template>
