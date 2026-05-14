<script setup lang="ts">
import reactionCatalog from '@/assets/reactions.json';
import { useMatchEngagementStore } from '@/stores/matchEngagement';
import { useThrottleFn } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import Chip from 'primevue/chip';
import { computed, onBeforeUnmount, ref } from 'vue';

const engagement = useMatchEngagementStore();
const { reactions } = storeToRefs(engagement);

interface ReactionItem {
  id: string;
  url: string;
  count: number;
}

interface ReactionBurst {
  id: string;
  url: string;
  nonce: number;
}

const bumpReaction = useThrottleFn((id: string) => {
  void engagement.sendReaction(id);
}, 120);

const burst = ref<ReactionBurst | null>(null);
const burstVisible = ref(false);
const isBurstAnimating = ref(false);
let burstHideTimer: ReturnType<typeof setTimeout> | null = null;
let burstClearTimer: ReturnType<typeof setTimeout> | null = null;
let burstUnlockTimer: ReturnType<typeof setTimeout> | null = null;

function triggerVibration() {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  navigator.vibrate([14, 20, 22]);
}

function showReactionBurst(id: string, url: string) {
  if (burstHideTimer) {
    clearTimeout(burstHideTimer);
  }
  if (burstClearTimer) {
    clearTimeout(burstClearTimer);
  }
  if (burstUnlockTimer) {
    clearTimeout(burstUnlockTimer);
  }
  isBurstAnimating.value = true;
  burst.value = { id, url, nonce: Date.now() };
  burstVisible.value = true;
  burstHideTimer = setTimeout(() => {
    burstVisible.value = false;
    burstHideTimer = null;
  }, 840);
  burstClearTimer = setTimeout(() => {
    burst.value = null;
    burstClearTimer = null;
  }, 1200);
  burstUnlockTimer = setTimeout(() => {
    isBurstAnimating.value = false;
    burstUnlockTimer = null;
  }, 1200);
}

function onReactionClick(item: ReactionItem) {
  if (isBurstAnimating.value) {
    return;
  }
  bumpReaction(item.id);
  showReactionBurst(item.id, item.url);
  triggerVibration();
}

onBeforeUnmount(() => {
  if (burstHideTimer) {
    clearTimeout(burstHideTimer);
  }
  if (burstClearTimer) {
    clearTimeout(burstClearTimer);
  }
  if (burstUnlockTimer) {
    clearTimeout(burstUnlockTimer);
  }
});

const reactionItems = computed<ReactionItem[]>(() => {
  return reactionCatalog.map((c) => ({
    id: c.id,
    url: c.url,
    count: reactions.value[c.id] ?? 0,
  }));
});

function chipRootClass(count: number) {
  return [
    'cursor-pointer shrink-0 select-none !rounded-full !px-2 !py-1.5 sm:!px-2.5 sm:!py-1.5 md:!px-3 md:!py-2 lg:!px-3.5 lg:!py-2',
    count > 0 ? '!gap-1' : '!justify-center',
  ].join(' ');
}

function chipContentClass(count: number) {
  return ['inline-flex items-center justify-center whitespace-nowrap', count > 0 ? 'gap-1.5' : ''].join(' ');
}
</script>

<template>
  <div class="flex flex-wrap justify-center gap-1.5 sm:gap-2 select-none">
    <Chip
      v-for="p in reactionItems"
      :key="p.id"
      @click="onReactionClick(p)"
      @keydown.enter.prevent="onReactionClick(p)"
      @keydown.space.prevent="onReactionClick(p)"
      :class="['shrink-0', isBurstAnimating ? 'pointer-events-none opacity-70' : '']"
      :pt="{
        root: { class: chipRootClass(p.count) },
      }"
      role="button"
      tabindex="0"
    >
      <span :class="chipContentClass(p.count)">
        <img
          :src="p.url"
          :alt="p.id"
          class="h-5 w-5 max-w-none shrink-0 object-contain sm:h-5 sm:w-5 md:h-6 md:w-6 lg:h-7 lg:w-7"
        />
        <span v-if="p.count > 0" class="text-xs leading-none sm:text-xs md:text-sm lg:text-base">{{ p.count }}</span>
      </span>
    </Chip>
  </div>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="translate-y-6 scale-50 rotate-[-12deg] opacity-0"
    enter-to-class="-translate-y-1 scale-110 rotate-3 opacity-100"
    leave-active-class="transition duration-500 ease-in"
    leave-from-class="-translate-y-3 scale-100 opacity-100"
    leave-to-class="-translate-y-8 scale-90 opacity-0"
  >
    <div
      v-if="burst && burstVisible"
      :key="burst.nonce"
      class="pointer-events-none fixed left-1/2 bottom-[24vh] z-[1400] -translate-x-1/2"
      aria-hidden="true"
    >
      <img :src="burst.url" :alt="burst.id" class="h-20 w-20 object-contain drop-shadow-xl sm:h-24 sm:w-24" />
    </div>
  </Transition>
</template>
