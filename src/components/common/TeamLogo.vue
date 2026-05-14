<script setup lang="ts">
import { computed } from 'vue';
import { buildImageUrl } from '@/utils/urlProxy';

interface Props {
  logo?: string;
  teamName?: string;
  size?: 'normal' | 'large' | 'xlarge';
  rounded?: boolean;
  customSize?: string;
}

const props = withDefaults(defineProps<Props>(), {
  logo: '',
  teamName: '',
  size: 'normal',
  rounded: true,
  customSize: '',
});

const logoUrl = computed(() => (props.logo ? buildImageUrl(props.logo) : ''));

const placeholderText = computed(() => {
  const value = String(props.teamName ?? '').trim();
  if (!value) {
    return '';
  }

  return [...value].slice(0, 2).join('');
});

const wrapperStyle = computed(() => {
  if (props.customSize) {
    return {
      width: props.customSize,
      height: props.customSize,
    };
  }

  const sizeMap = {
    normal: '2rem',
    large: '3rem',
    xlarge: '4rem',
  };
  return {
    width: sizeMap[props.size],
    height: sizeMap[props.size],
  };
});
</script>

<template>
  <div
    class="team-logo-wrapper"
    :class="{ rounded: rounded, square: !rounded, placeholder: !logoUrl }"
    :style="{
      ...wrapperStyle,
    }"
    :aria-label="teamName"
    role="img"
  >
    <img v-if="logoUrl" :src="logoUrl" :alt="teamName" class="team-logo-img" decoding="async" />
    <span v-else class="team-logo-placeholder">{{ placeholderText }}</span>
  </div>
</template>

<style scoped>
.team-logo-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: white;
  flex-shrink: 0;
  overflow: hidden;
  color: var(--text-color-secondary);
  font-weight: 700;
  font-size: 0.72em;
  line-height: 1;
}

.team-logo-wrapper.rounded {
  border-radius: 50%;
}

.team-logo-wrapper.square {
  border-radius: 0.25rem;
}

.team-logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.team-logo-wrapper.placeholder {
  background: linear-gradient(135deg, rgba(148, 163, 184, 0.18), rgba(148, 163, 184, 0.08));
  border: 1px solid rgba(148, 163, 184, 0.28);
}

.team-logo-placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  user-select: none;
}
</style>
