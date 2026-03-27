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
    :icon="iconClass"
    rounded
    text
    severity="contrast"
    :aria-label="ariaLabel"
    size="small"
    @click="onToggleTheme"
  />
</template>
s
