<script setup lang="ts">
import { computed } from 'vue';
import { buildImageUrl } from '../../services/urlProxy';

interface Props {
  teamName: string;
  collegeName?: string;
  logo?: string;
  groupLabel?: string;
  clickable?: boolean;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  collegeName: '-',
  logo: '',
  groupLabel: '',
  clickable: true,
  compact: false,
});

const emit = defineEmits<{
  select: [teamName: string];
}>();

function onClick() {
  if (!props.clickable || !props.teamName || props.teamName === '-') {
    return;
  }
  emit('select', props.teamName);
}

const logoUrl = computed(() => buildImageUrl(props.logo));
</script>

<template>
  <article class="team-info" :class="{ compact, clickable }" @click="onClick">
    <div class="team-info-inner">
      <img v-if="logoUrl" :src="logoUrl" :alt="teamName" />
      <div class="meta">
        <div class="head-row">
          <h4>{{ teamName }}</h4>
          <span v-if="groupLabel" class="group-badge">{{ groupLabel }}</span>
        </div>
        <p>{{ collegeName || '-' }}</p>
      </div>
    </div>
  </article>
</template>

<style scoped>
.team-info {
  display: block;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 0.8rem;
  padding: 0.55rem 0.6rem;
  min-height: 72px;
  box-sizing: border-box;
}

.team-info.clickable {
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.team-info.clickable:hover {
  transform: translateY(-2px);
  border-color: rgba(59, 130, 246, 0.6);
  background: rgba(59, 130, 246, 0.08);
}

.team-info-inner {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}

.team-info img {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(148, 163, 184, 0.4);
  flex-shrink: 0;
}

.meta {
  min-width: 0;
  flex: 1;
}

.head-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.team-info h4 {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.team-info p {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  opacity: 0.78;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-badge {
  flex-shrink: 0;
  font-size: 0.7rem;
  line-height: 1;
  padding: 0.16rem 0.35rem;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.2);
  color: #bfdbfe;
}

.team-info.compact img {
  width: 28px;
  height: 28px;
}

.team-info.compact {
  min-height: 54px;
  padding: 0.35rem 0.45rem;
  border-radius: 0.6rem;
}

.team-info.compact h4 {
  font-size: 0.86rem;
}

.team-info.compact p {
  font-size: 0.74rem;
}
</style>
