<script setup lang="ts">
import { computed } from 'vue';
import { useDanmuStore } from '../../stores/danmu';
import type { DanmuMessage } from '../../types/api';

const props = defineProps<{
  message: DanmuMessage;
}>();

const danmuStore = useDanmuStore();

const school = computed(() => danmuStore.resolveDisplaySchool(props.message));
const nickname = computed(() => danmuStore.resolveDisplayNickname(props.message));
const tooltipMeta = computed(() => danmuStore.resolveTooltipMeta(props.message));

function escapeHtml(value: string): string {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const tooltipHtml = computed(() => {
  const meta = tooltipMeta.value;
  const chips: string[] = [];

  if (meta.school) {
    chips.push(`<span class="danmu-tip-chip danmu-tip-chip--school">${escapeHtml(meta.school)}</span>`);
  }
  if (meta.year) {
    chips.push(`<span class="danmu-tip-chip">${escapeHtml(meta.year)}</span>`);
  }
  if (meta.role) {
    chips.push(`<span class="danmu-tip-chip">${escapeHtml(meta.role)}</span>`);
  }

  const usernameBlock = meta.username ? `<p class="danmu-tip-raw">${escapeHtml(meta.username)}</p>` : '';

  return [
    '<section class="danmu-tip-card">',
    '  <header class="danmu-tip-head">',
    `    <span class="danmu-tip-name">${escapeHtml(meta.nickname)}</span>`,
    `    <span class="danmu-tip-source">${escapeHtml(meta.sourceLabel)}</span>`,
    '  </header>',
    `  <p class="danmu-tip-message">${escapeHtml(props.message.text)}</p>`,
    chips.length ? `  <div class="danmu-tip-chips">${chips.join('')}</div>` : '',
    usernameBlock,
    `  <footer class="danmu-tip-time">${escapeHtml(meta.timeLabel)}</footer>`,
    '</section>',
  ].join('');
});
</script>

<template>
  <article
    v-tooltip.left="{
      value: tooltipHtml,
      escape: false,
      showDelay: 120,
      hideDelay: 80,
    }"
    class="danmu-item"
  >
    <aside class="meta-col">
      <p class="school">{{ school }}</p>
      <p class="nickname">{{ nickname }}</p>
    </aside>
    <p class="content">{{ message.text }}</p>
  </article>
</template>

<style scoped>
.danmu-item {
  display: grid;
  grid-template-columns: 8.2rem 1fr;
  gap: 0.45rem;
  align-items: start;
  padding: 0.28rem 0.4rem;
  border-radius: 0.4rem;
  background: var(--danmu-item-bg);
}

.meta-col {
  min-width: 0;
}

.school,
.nickname {
  margin: 0;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.school {
  font-size: 0.68rem;
  opacity: 0.88;
}

.nickname {
  font-size: 0.74rem;
  font-weight: 600;
}

.content {
  margin: 0;
  min-width: 0;
  font-size: 0.74rem;
  line-height: 1.25;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}
</style>
