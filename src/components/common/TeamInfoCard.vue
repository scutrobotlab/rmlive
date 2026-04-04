<script setup lang="ts">
import type { TeamSelectPayload } from '@/types/teamSelect';
import TeamGroupTag from './TeamGroupTag.vue';
import TeamLogo from './TeamLogo.vue';

interface Props {
  teamName: string;
  collegeName?: string;
  logo?: string;
  logoSize?: string;
  groupLabel?: string;
  showGroupLabel?: boolean;
  showCollegeName?: boolean;
  clickable?: boolean;
  compact?: boolean;
  logoPosition?: 'left' | 'right';
  zoneId?: string | null;
  zoneName?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  collegeName: '-',
  logo: '',
  logoSize: '',
  groupLabel: '',
  showGroupLabel: true,
  showCollegeName: true,
  clickable: true,
  compact: false,
  logoPosition: 'left',
  zoneId: null,
  zoneName: null,
});

const emit = defineEmits<{
  select: [payload: TeamSelectPayload];
}>();

function onClick() {
  if (!props.clickable || !props.teamName || props.teamName === '-') {
    return;
  }
  emit('select', {
    teamName: props.teamName,
    collegeName: props.collegeName,
    zoneId: props.zoneId,
    zoneName: props.zoneName,
  });
}
</script>

<template>
  <article class="team-info" :class="{ compact, clickable, 'logo-right': logoPosition === 'right' }" @click="onClick">
    <div class="team-info-inner">
      <TeamLogo :logo="logo" :team-name="teamName" :custom-size="logoSize || (compact ? '1.75rem' : '')" />
      <div class="meta">
        <div class="head-row">
          <slot name="headPrefix" />
          <h4>{{ teamName }}</h4>
          <TeamGroupTag
            v-if="showGroupLabel && groupLabel"
            :label="groupLabel"
            :team-name="teamName"
            :zone-id="zoneId"
            :zone-name="zoneName"
            @pick-team="emit('select', $event)"
          />
          <slot name="headExtra" />
        </div>
        <p v-if="showCollegeName">{{ collegeName || '-' }}</p>
      </div>
    </div>
  </article>
</template>

<style scoped>
.team-info {
  display: block;
  padding: 0.55rem 0.6rem;
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

.team-info-inner.logo-right {
  flex-direction: row-reverse;
}

.team-info.logo-right .team-info-inner {
  flex-direction: row-reverse;
}

.team-info.logo-right .meta {
  text-align: right;
}

.team-info.logo-right .head-row {
  justify-content: flex-end;
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

.head-row h4 {
  flex: 0 1 auto;
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

.team-info.compact {
  padding: 0.35rem 0.45rem;
}

.team-info.compact h4 {
  font-size: 0.86rem;
}

.team-info.compact p {
  font-size: 0.74rem;
}
</style>
