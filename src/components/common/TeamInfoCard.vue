<script setup lang="ts">
import Tag from 'primevue/tag';
import TeamLogo from './TeamLogo.vue';

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
</script>

<template>
  <article class="team-info" :class="{ compact, clickable }" @click="onClick">
    <div class="team-info-inner">
      <TeamLogo :logo="logo" :team-name="teamName" />
      <div class="meta">
        <div class="head-row">
          <h4>{{ teamName }}</h4>
          <Tag v-if="groupLabel" :value="groupLabel" severity="info" class="group-tag" />
        </div>
        <p>{{ collegeName || '-' }}</p>
      </div>
    </div>
  </article>
</template>

<style scoped>
.team-info {
  display: block;
  padding: 0.55rem 0.6rem;
  min-height: 72px;
  box-sizing: border-box;
}

.team-info.clickable {
  cursor: pointer;
}

.team-info-inner {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}

:deep(.team-logo) {
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-tag {
  flex-shrink: 0;
}

.group-tag :deep(.p-tag-label) {
  font-size: 0.68rem;
}

.team-info.compact :deep(.team-logo-wrapper) {
  width: 28px !important;
  height: 28px !important;
}

.team-info.compact {
  min-height: 54px;
  padding: 0.35rem 0.45rem;
}

.team-info.compact h4 {
  font-size: 0.86rem;
}

.team-info.compact p {
  font-size: 0.74rem;
}
</style>
