<script setup lang="ts">
import oak from '@/assets/oak.gif';
import { useMatchEngagementStore } from '@/stores/matchEngagement';
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import { computed, onBeforeUnmount, ref, watch } from 'vue';

interface Props {
  side: 'red' | 'blue';
}

interface LikeParticle {
  id: string;
  left: number;
  top: number;
  dx: number;
  dy: number;
  scale: number;
  rotate: number;
  duration: number;
  size: number;
}

const props = defineProps<Props>();

const engagement = useMatchEngagementStore();
const { hydrateLoading, supportFxEvents } = storeToRefs(engagement);

const anchorRef = ref<HTMLElement | null>(null);
const particles = ref<LikeParticle[]>([]);
const particleTimers = new Map<string, ReturnType<typeof setTimeout>>();
const seenRemoteMessageIds = new Set<string>();
const repeatTimer = ref<ReturnType<typeof setInterval> | null>(null);
const lastSupportAt = ref(0);

const supportLabel = computed(() => (props.side === 'red' ? '支持红方' : '支持蓝方'));

const sideFxEvents = computed(() => supportFxEvents.value.filter((event) => event.side === props.side));

function triggerVibration() {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  navigator.vibrate([12, 18, 18]);
}

function getAnchorPoint() {
  const el = anchorRef.value;
  if (!el) {
    return null;
  }
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + Math.min(rect.height * 0.35, 10),
  };
}

function removeParticle(id: string) {
  particles.value = particles.value.filter((item) => item.id !== id);
  const timer = particleTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    particleTimers.delete(id);
  }
}

function emitFloatingLikes(count: number) {
  const origin = getAnchorPoint();
  if (!origin) {
    return;
  }

  const nextParticles: LikeParticle[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = `${props.side}:${Date.now()}:${Math.random()}:${i}`;
    const duration = 860 + Math.round(Math.random() * 480);
    const particle: LikeParticle = {
      id,
      left: origin.x + (Math.random() * 18 - 9),
      top: origin.y + (Math.random() * 10 - 5),
      dx: Math.random() * 52 - 26,
      dy: -92 - Math.random() * 66,
      scale: 0.82 + Math.random() * 0.5,
      rotate: Math.random() * 30 - 15,
      duration,
      size: 20 + Math.random() * 10,
    };
    nextParticles.push(particle);
    const timer = setTimeout(() => {
      removeParticle(id);
    }, duration + 120);
    particleTimers.set(id, timer);
  }

  particles.value = [...particles.value, ...nextParticles];
}

function sendSupportOnce() {
  const now = Date.now();
  if (now - lastSupportAt.value < 120) {
    return;
  }
  lastSupportAt.value = now;
  triggerVibration();
  emitFloatingLikes(1);
  void engagement.sendSupport(props.side);
}

function stopRepeat() {
  if (!repeatTimer.value) {
    return;
  }
  clearInterval(repeatTimer.value);
  repeatTimer.value = null;
}

function startRepeat() {
  sendSupportOnce();
  if (repeatTimer.value) {
    return;
  }
  repeatTimer.value = setInterval(() => {
    sendSupportOnce();
  }, 150);
}

watch(
  sideFxEvents,
  (events) => {
    for (const event of events) {
      if (seenRemoteMessageIds.has(event.messageId)) {
        continue;
      }
      seenRemoteMessageIds.add(event.messageId);
      emitFloatingLikes(1);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  stopRepeat();
  for (const timer of particleTimers.values()) {
    clearTimeout(timer);
  }
  particleTimers.clear();
  particles.value = [];
});
</script>

<template>
  <div ref="anchorRef" class="relative flex shrink-0 items-center" @click.stop>
    <Button
      rounded
      text
      size="small"
      severity="secondary"
      :disabled="hydrateLoading"
      :pt="{
        root: { class: '!min-w-0 !p-1 sm:!p-1.5' },
        icon: { class: 'hidden' },
        label: { class: 'hidden' },
      }"
      :aria-label="supportLabel"
      @pointerdown.stop.prevent="startRepeat"
      @pointerup.stop="stopRepeat"
      @pointerleave.stop="stopRepeat"
      @pointercancel.stop="stopRepeat"
      @keydown.enter.stop.prevent="sendSupportOnce"
      @keydown.space.stop.prevent="sendSupportOnce"
    >
      <img :src="oak" :alt="supportLabel" class="h-5 w-5 object-contain sm:h-6 sm:w-6" />
    </Button>
  </div>

  <Teleport to="body">
    <div class="pointer-events-none fixed inset-0 z-[2100]" aria-hidden="true">
      <img
        v-for="particle in particles"
        :key="particle.id"
        :src="oak"
        alt=""
        class="floating-like object-contain"
        :style="{
          left: `${particle.left}px`,
          top: `${particle.top}px`,
          width: `${particle.size}px`,
          height: `${particle.size}px`,
          '--dx': `${particle.dx}px`,
          '--dy': `${particle.dy}px`,
          '--rot': `${particle.rotate}deg`,
          '--scale': String(particle.scale),
          '--dur': `${particle.duration}ms`,
        }"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.floating-like {
  position: fixed;
  transform: translate(-50%, -50%);
  animation: floating-like-rise var(--dur) ease-out forwards;
  filter: drop-shadow(0 4px 8px rgb(15 23 42 / 0.28));
}

@keyframes floating-like-rise {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) translate3d(0, 0, 0) scale(0.45) rotate(0deg);
  }
  18% {
    opacity: 1;
    transform: translate(-50%, -50%) translate3d(calc(var(--dx) * 0.18), calc(var(--dy) * 0.2), 0) scale(var(--scale))
      rotate(calc(var(--rot) * 0.35));
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) translate3d(var(--dx), var(--dy), 0) scale(calc(var(--scale) * 0.9))
      rotate(var(--rot));
  }
}
</style>
