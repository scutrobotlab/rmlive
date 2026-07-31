<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';

const error = ref<Error | null>(null);
const errorInfo = ref('');

function reset() {
  error.value = null;
  errorInfo.value = '';
}

onErrorCaptured((err, instance, info) => {
  error.value = err as Error;
  errorInfo.value = info;
    console.error('[ErrorBoundary] caught component error:', err, info);
    return false;
});
</script>

<template>
  <div v-if="error" class="error-boundary">
    <div class="error-boundary__card">
      <div class="error-boundary__icon">
        <i class="pi pi-exclamation-triangle" />
      </div>
      <p class="error-boundary__title">组件加载失败</p>
      <p class="error-boundary__detail">{{ error.message }}</p>
      <button class="error-boundary__retry" @click="reset">
        重试
      </button>
    </div>
  </div>
  <slot v-else />
</template>

<style scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  min-height: 200px;
}

.error-boundary__card {
  text-align: center;
  color: var(--p-text-secondary-color, #888);
}

.error-boundary__icon {
  font-size: 2rem;
  color: var(--p-yellow-400, #f59e0b);
  margin-bottom: 0.75rem;
}

.error-boundary__title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-color, #fff);
  margin: 0 0 0.5rem;
}

.error-boundary__detail {
  font-size: 0.85rem;
  margin: 0 0 1rem;
  max-width: 320px;
}

.error-boundary__retry {
  padding: 0.4rem 1.2rem;
  border: 1px solid var(--p-surface-border, #444);
  border-radius: 6px;
  background: var(--p-surface-800, #222);
  color: var(--p-text-color, #fff);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s;
}

.error-boundary__retry:hover {
  background: var(--p-surface-700, #333);
}
</style>
