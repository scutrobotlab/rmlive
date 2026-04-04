import { SCHEDULE_JSON_POLL_MS, SCHEDULE_NOTIFY_SW_THROTTLE_MS } from '@/constants/schedulePoll';
import { useRmDataStore } from '@/stores/rmData';
import { storeToRefs } from 'pinia';
import { onMounted, onUnmounted, watch } from 'vue';

/**
 * Keeps SW schedule.json + notification diff roughly in sync with the page:
 * - **Primary**: whenever Pinia `schedule` updates (same cadence as main `fetchSchedule`), ping the SW (throttled).
 * - **Fallback**: interval while the tab is visible (same period as rmApi schedule poll).
 *
 * **Not** relying on Periodic Background Sync for timely updates — it is registered only as a best-effort
 * supplement when the browser supports it; actual firing interval is browser-controlled and often long.
 */
export function useScheduleNotifyPolling(): void {
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopScheduleWatch: (() => void) | null = null;
  let lastPing = 0;

  const dataStore = useRmDataStore();
  const { schedule } = storeToRefs(dataStore);

  onMounted(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    void navigator.serviceWorker.ready.then((reg) => {
      function ping() {
        if (document.visibilityState !== 'visible') {
          return;
        }
        const now = Date.now();
        if (now - lastPing < SCHEDULE_NOTIFY_SW_THROTTLE_MS) {
          return;
        }
        lastPing = now;
        reg.active?.postMessage({ type: 'POLL_SCHEDULE' });
      }

      timer = setInterval(ping, SCHEDULE_JSON_POLL_MS);
      ping();

      stopScheduleWatch = watch(schedule, ping, { flush: 'post' });

      try {
        const anyReg = reg as ServiceWorkerRegistration & {
          sync?: { register: (tag: string) => Promise<void> };
        };
        if (anyReg.sync) {
          void anyReg.sync.register('schedule-sync').catch(() => {});
        }
      } catch {
        /* ignore */
      }

      try {
        const anyReg = reg as ServiceWorkerRegistration & {
          periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
        };
        if (anyReg.periodicSync) {
          void anyReg.periodicSync.register('schedule', { minInterval: 15 * 60 * 1000 }).catch(() => {});
        }
      } catch {
        /* ignore */
      }
    });
  });

  onUnmounted(() => {
    stopScheduleWatch?.();
    stopScheduleWatch = null;
    if (timer) {
      clearInterval(timer);
    }
  });
}
