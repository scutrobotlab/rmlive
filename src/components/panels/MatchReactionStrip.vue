<script setup lang="ts">
import { loadReactionCatalog, type ReactionCatalogItem } from '@/config/loadReactionCatalog';
import { useMatchEngagementStore } from '@/stores/matchEngagement';
import { useRmDataStore } from '@/stores/rmData';
import Fieldset from 'primevue/fieldset';
import MeterGroup from 'primevue/metergroup';
import type { MeterItem } from 'primevue/metergroup';
import { useThrottleFn } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { computed, onMounted, ref } from 'vue';

type ReactionMeterItem = MeterItem & { reactionId: string; count: number };

const rm = useRmDataStore();
const engagement = useMatchEngagementStore();
const { runningMatchForSelectedZone } = storeToRefs(rm);
const { reactions, hydrateLoading } = storeToRefs(engagement);

const catalog = ref<ReactionCatalogItem[]>([]);

const visible = computed(() => {
  const m = runningMatchForSelectedZone.value;
  if (!m) {
    return false;
  }
  const u = String(m.statusRaw ?? '').toUpperCase();
  return ['STARTED', 'PLAYING'].includes(u);
});

onMounted(() => {
  void loadReactionCatalog().then((list) => {
    catalog.value = list;
  });
});

function labelForReactionId(id: string): string {
  const c = catalog.value.find((x) => x.id === id);
  return c?.name ?? id;
}

function asReactionMeter(item: MeterItem): ReactionMeterItem {
  return item as ReactionMeterItem;
}

const reactionPalette = ['#f43f5e', '#0ea5e9', '#a78bfa', '#f59e0b', '#34d399', '#f472b6'];

const reactionMeters = computed((): ReactionMeterItem[] => {
  const entries = Object.entries(reactions.value)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    return [];
  }
  const total = entries.reduce((s, [, c]) => s + c, 0);
  let acc = 0;
  return entries.map(([id, count], i) => {
    let pct = Math.round((count / total) * 100);
    if (i === entries.length - 1) {
      pct = Math.max(0, 100 - acc);
    } else {
      acc += pct;
    }
    return {
      label: labelForReactionId(id),
      value: pct,
      color: reactionPalette[i % reactionPalette.length],
      reactionId: id,
      count,
    };
  });
});

const bumpReaction = useThrottleFn((id: string) => {
  void engagement.sendReaction(id);
}, 120);
</script>

<template>
  <Fieldset
    v-if="visible"
    legend="对局评价"
    :toggleable="true"
    class="reaction-fieldset"
    :class="{ 'reaction-fieldset--hydrating': hydrateLoading }"
  >
    <div v-if="catalog.length" class="preset-row">
      <button
        v-for="p in catalog"
        :key="p.id"
        type="button"
        class="preset-hit"
        @click="bumpReaction(p.id)"
      >
        <img class="preset-img" :src="p.url" :alt="p.name" width="28" height="28" />
        <span class="preset-name">{{ p.name }}</span>
      </button>
    </div>
    <p v-else class="catalog-hint">未加载表情配置（/reactions/reactions.json）</p>

    <div v-if="reactionMeters.length" class="meter-block">
      <MeterGroup :value="reactionMeters" label-position="end">
        <template #label="{ value: items }">
          <ol class="reaction-label-list">
            <li
              v-for="(raw, idx) in items"
              :key="asReactionMeter(raw).reactionId + String(idx)"
              class="reaction-label-li"
              role="button"
              tabindex="0"
              @click="bumpReaction(asReactionMeter(raw).reactionId)"
              @keydown.enter.prevent="bumpReaction(asReactionMeter(raw).reactionId)"
            >
              <span
                class="reaction-label-marker"
                :style="{ backgroundColor: raw.color }"
                aria-hidden="true"
              />
              <span class="reaction-label-text">
                {{ asReactionMeter(raw).label }} ({{ asReactionMeter(raw).count }}) ({{
                  raw.value
                }}%)
              </span>
            </li>
          </ol>
        </template>
      </MeterGroup>
    </div>
  </Fieldset>
</template>

<style scoped>
.reaction-fieldset {
  margin-top: 0.75rem;
  transition: opacity 0.2s ease;
}

.reaction-fieldset--hydrating {
  opacity: 0.82;
}

.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.preset-hit {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--p-content-border-color, #334155);
  border-radius: var(--p-border-radius-md, 8px);
  background: var(--p-content-background, transparent);
  cursor: pointer;
  color: inherit;
  font: inherit;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.preset-hit:hover {
  border-color: var(--p-primary-color, #38bdf8);
  background: color-mix(in srgb, var(--p-primary-color, #38bdf8) 12%, transparent);
}

.preset-img {
  display: block;
  max-height: 2rem;
  width: auto;
  object-fit: contain;
}

.preset-name {
  font-size: 0.7rem;
  opacity: 0.9;
}

.catalog-hint {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  color: var(--p-text-muted-color, #94a3b8);
}

.meter-block {
  margin-top: 0.65rem;
}

.reaction-label-list {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.reaction-label-li {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
  border-radius: var(--p-border-radius-sm, 6px);
  padding: 0.15rem 0.25rem;
  margin: 0 -0.25rem;
  transition: background 0.12s ease;
}

.reaction-label-li:hover,
.reaction-label-li:focus-visible {
  outline: none;
  background: color-mix(in srgb, var(--p-content-border-color, #334155) 35%, transparent);
}

.reaction-label-marker {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 2px;
  flex-shrink: 0;
}

.reaction-label-text {
  font-size: 0.8rem;
}
</style>
