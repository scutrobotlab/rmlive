<script setup lang="ts">
import { computed } from 'vue';
import { buildImageUrl } from '../../services/urlProxy';

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
    v-if="logoUrl"
    class="team-logo-wrapper"
    :class="{ rounded: rounded, square: !rounded }"
    :style="{
      ...wrapperStyle,
    }"
  >
    <img :src="logoUrl" :alt="teamName" class="team-logo-img" />
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
</style>
