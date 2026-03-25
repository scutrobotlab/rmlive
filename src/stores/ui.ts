import { useLocalStorage } from '@vueuse/core';
import { defineStore } from 'pinia';
import { ref } from 'vue';

const THEME_KEY = 'rm-live-theme';
const NEXT_PANEL_KEY = 'rm-next-panel-expanded';
const MOBILE_BREAKPOINT = 768;

export const useUiStore = defineStore('ui', () => {
  const isDark = useLocalStorage<boolean>(THEME_KEY, true);
  const isMobile = ref(false);
  const nextMatchExpanded = useLocalStorage<boolean>(NEXT_PANEL_KEY, false);

  function applyTheme() {
    document.documentElement.classList.toggle('app-dark', isDark.value);
  }

  function setDarkMode(enabled: boolean) {
    isDark.value = enabled;
    applyTheme();
  }

  function updateViewport() {
    isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT;
  }

  function onResize() {
    updateViewport();
  }

  function setNextMatchExpanded(expanded: boolean) {
    nextMatchExpanded.value = expanded;
  }

  function initializeUi() {
    applyTheme();

    updateViewport();
    window.addEventListener('resize', onResize);
  }

  function teardownUi() {
    window.removeEventListener('resize', onResize);
  }

  return {
    isDark,
    isMobile,
    nextMatchExpanded,
    setDarkMode,
    setNextMatchExpanded,
    initializeUi,
    teardownUi,
  };
});
