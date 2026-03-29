<script setup lang="ts">
import { useMatchEngagementStore } from '@/stores/matchEngagement';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';

const engagement = useMatchEngagementStore();
const { redSupport, blueSupport, redCollege, blueCollege } = storeToRefs(engagement);

const total = computed(() => redSupport.value + blueSupport.value);
const hasVotes = computed(() => total.value > 0);

const redPct = computed(() => {
  const t = total.value;
  if (t < 1) {
    return 0;
  }
  return Math.round((redSupport.value / t) * 100);
});

const bluePct = computed(() => (hasVotes.value ? 100 - redPct.value : 0));

const redLabel = computed(() => redCollege.value?.trim() || '红方');
const blueLabel = computed(() => blueCollege.value?.trim() || '蓝方');

const redLeading = computed(() => hasVotes.value && redSupport.value > blueSupport.value);
const blueLeading = computed(() => hasVotes.value && blueSupport.value > redSupport.value);
</script>

<template>
  <div class="pk" role="img" :aria-label="`火力对决，红方 ${redSupport}，蓝方 ${blueSupport}`">
    <div v-if="!hasVotes" class="pk-empty">
      <div class="pk-header pk-header--idle">
        <div class="pk-team pk-team--left">
          <span class="pk-name pk-name--red" :title="redLabel">{{ redLabel }}</span>
          <span class="pk-meta"><span class="pk-num">0</span></span>
        </div>
        <div class="pk-team pk-team--right">
          <span class="pk-name pk-name--blue" :title="blueLabel">{{ blueLabel }}</span>
          <span class="pk-meta"><span class="pk-num">0</span></span>
        </div>
      </div>
      <div class="pk-track-wrap">
        <div class="pk-vs pk-vs--ghost" aria-hidden="true">VS</div>
        <div class="pk-track pk-track--idle" />
      </div>
      <p class="pk-hint">火力对决 · 点击下方为战队助威</p>
    </div>

    <div v-else class="pk-live">
      <div class="pk-header">
        <div class="pk-team pk-team--left">
          <span class="pk-name pk-name--red" :title="redLabel">{{ redLabel }}</span>
          <div class="pk-metrics">
            <span class="pk-num">{{ redSupport }}</span>
            <span class="pk-pct">{{ redPct }}%</span>
          </div>
        </div>
        <div class="pk-team pk-team--right">
          <span class="pk-name pk-name--blue" :title="blueLabel">{{ blueLabel }}</span>
          <div class="pk-metrics">
            <span class="pk-pct">{{ bluePct }}%</span>
            <span class="pk-num">{{ blueSupport }}</span>
          </div>
        </div>
      </div>

      <div class="pk-track-wrap">
        <span class="pk-vs" aria-hidden="true">VS</span>
        <div class="pk-track" role="presentation">
          <div
            class="pk-fill pk-fill--red"
            :class="{ 'pk-fill--leading': redLeading }"
            :style="{ width: `${redPct}%` }"
          />
          <div
            class="pk-fill pk-fill--blue"
            :class="{ 'pk-fill--leading': blueLeading }"
            :style="{ width: `${bluePct}%` }"
          />
          <div class="pk-shine" aria-hidden="true" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pk {
  min-width: 0;
}

.pk-header {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-bottom: 0.45rem;
  align-items: start;
}

.pk-header--idle {
  margin-bottom: 0.35rem;
}

.pk-team {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.pk-team--right {
  align-items: flex-end;
  text-align: right;
}

.pk-name {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.pk-name--red {
  color: #fda4af;
  text-shadow: 0 0 12px rgb(251 113 133 / 0.45);
}

.pk-name--blue {
  color: #7dd3fc;
  text-shadow: 0 0 12px rgb(56 189 248 / 0.45);
}

.pk-metrics {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
}

.pk-team--right .pk-metrics {
  flex-direction: row;
}

.pk-num {
  font-variant-numeric: tabular-nums;
  font-size: 1.25rem;
  font-weight: 800;
  line-height: 1;
}

.pk-team--left .pk-num {
  color: #fff1f2;
}

.pk-team--right .pk-num {
  color: #f0f9ff;
}

.pk-pct {
  font-size: 0.72rem;
  font-weight: 600;
  opacity: 0.88;
}

.pk-team--left .pk-pct {
  color: #fecdd3;
}

.pk-team--right .pk-pct {
  color: #bae6fd;
}

.pk-meta .pk-num {
  font-size: 0.95rem;
  opacity: 0.75;
}

.pk-track-wrap {
  position: relative;
  margin-top: 0.15rem;
}

.pk-vs {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 3;
  min-width: 1.75rem;
  height: 1.35rem;
  padding: 0 0.35rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  color: #0f172a;
  background: linear-gradient(165deg, #f8fafc 0%, #e2e8f0 40%, #cbd5e1 100%);
  border-radius: 0.28rem;
  box-shadow:
    0 0 0 1px rgb(15 23 42 / 0.35),
    0 2px 8px rgb(0 0 0 / 0.45),
    inset 0 1px 0 rgb(255 255 255 / 0.7);
  pointer-events: none;
}

.pk-vs--ghost {
  opacity: 0.55;
  z-index: 1;
}

.pk-track {
  position: relative;
  display: flex;
  flex-direction: row;
  height: 0.95rem;
  border-radius: 999px;
  overflow: hidden;
  background: linear-gradient(180deg, rgb(15 23 42 / 0.92) 0%, rgb(30 41 59 / 0.88) 100%);
  box-shadow:
    inset 0 2px 6px rgb(0 0 0 / 0.55),
    0 0 0 1px rgb(255 255 255 / 0.07);
}

.pk-track--idle {
  height: 0.55rem;
  opacity: 0.7;
}

.pk-fill {
  height: 100%;
  flex-shrink: 0;
  min-width: 0;
  transition: width 0.4s cubic-bezier(0.33, 1, 0.68, 1);
  position: relative;
}

.pk-fill--red {
  background: linear-gradient(
    90deg,
    #9f1239 0%,
    #e11d48 18%,
    #fb7185 52%,
    #fda4af 100%
  );
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.22);
}

.pk-fill--blue {
  background: linear-gradient(
    90deg,
    #38bdf8 0%,
    #0ea5e9 45%,
    #0369a1 100%
  );
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.2);
}

.pk-fill--leading.pk-fill--red {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.22),
    0 0 14px rgb(251 113 133 / 0.65);
}

.pk-fill--leading.pk-fill--blue {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.2),
    0 0 14px rgb(56 189 248 / 0.6);
}

.pk-shine {
  pointer-events: none;
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgb(255 255 255 / 0.14) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: pk-shine 2.4s ease-in-out infinite;
  mix-blend-mode: overlay;
}

@keyframes pk-shine {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pk-shine {
    animation: none;
  }

  .pk-fill {
    transition-duration: 0.15s;
  }
}

.pk-hint {
  margin: 0.4rem 0 0;
  font-size: 0.78rem;
  text-align: center;
  color: var(--p-text-muted-color, #94a3b8);
  line-height: 1.35;
}
</style>
