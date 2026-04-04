import Aura from '@primeuix/themes/aura';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import 'primeicons/primeicons.css';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import { createApp } from 'vue';
import App from './App.vue';
import { markPerformance } from './utils/observability';

import './styles/mobile-input.css';
import './styles/primevue-theme.css';
const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia);

import './styles/danmu-tooltip.css';
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.app-dark',
      cssLayer: false,
    },
  },
});
app.use(ToastService);
app.directive('tooltip', Tooltip);

markPerformance('rm-app-mount-start');
app.mount('#app');
markPerformance('rm-app-mounted');

function registerServiceWorkerWhenIdle() {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    const updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh() {
        void updateServiceWorker(true).then(() => {
          window.location.reload();
        });
      },
    });
  });
}

if (typeof window !== 'undefined') {
  const idleScheduler = window.requestIdleCallback;
  if (typeof idleScheduler === 'function') {
    idleScheduler(registerServiceWorkerWhenIdle, { timeout: 3000 });
  } else {
    window.setTimeout(registerServiceWorkerWhenIdle, 0);
  }
}
