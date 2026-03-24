<script setup lang="ts">
import Button from 'primevue/button';
import { computed } from 'vue';

interface Props {
  isDark: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  change: [value: boolean];
}>();

const iconClass = computed(() => (props.isDark ? 'pi pi-moon' : 'pi pi-sun'));
const ariaLabel = computed(() => (props.isDark ? '切换到浅色主题' : '切换到深色主题'));

function onToggleTheme() {
  emit('change', !props.isDark);
}
</script>

<template>
  <Button
    class="theme-logo-button"
    :icon="iconClass"
    rounded
    text
    severity="contrast"
    :aria-label="ariaLabel"
    @click="onToggleTheme"
  />
</template>

<style scoped>
.theme-logo-button {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--p-surface-500) 45%, transparent);
  background: color-mix(in srgb, var(--p-surface-200) 78%, transparent);
}

.theme-logo-button :deep(.pi) {
  font-size: 0.88rem;
}
</style>
