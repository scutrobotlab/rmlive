import { defineStore } from 'pinia';
import { ref } from 'vue';

const THEME_KEY = 'rm-live-theme';
const NEXT_PANEL_KEY = 'rm-next-panel-expanded';
const MOBILE_BREAKPOINT = 768;

export const useUiStore = defineStore('ui', () => {
  const isDark = ref(true);
  const isMobile = ref(false);
  const nextMatchExpanded = ref(false);

  function applyTheme() {
    document.documentElement.classList.toggle('app-dark', isDark.value);
    localStorage.setItem(THEME_KEY, isDark.value ? 'dark' : 'light');
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
    localStorage.setItem(NEXT_PANEL_KEY, String(expanded));
  }

  function initializeUi() {
    const storedTheme = localStorage.getItem(THEME_KEY);
    isDark.value = storedTheme ? storedTheme === 'dark' : true;
    applyTheme();

    const storedExpanded = localStorage.getItem(NEXT_PANEL_KEY);
    nextMatchExpanded.value = storedExpanded ? storedExpanded === 'true' : false;

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
