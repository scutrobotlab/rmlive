export type PollingRunner = () => Promise<void>;

export interface PollingTask {
  stop: () => void;
}

export interface PollingOptions {
  pauseWhenHidden?: boolean;
  hiddenCheckMs?: number;
  resumeImmediately?: boolean;
}

export function startPolling(runner: PollingRunner, intervalMs: number, options: PollingOptions = {}): PollingTask {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let running = false;

  const pauseWhenHidden = options.pauseWhenHidden ?? false;
  const hiddenCheckMs = options.hiddenCheckMs ?? Math.min(intervalMs, 5000);
  const resumeImmediately = options.resumeImmediately ?? true;

  function isHidden() {
    return pauseWhenHidden && typeof document !== 'undefined' && document.hidden;
  }

  function schedule(ms: number) {
    timer = setTimeout(tick, ms);
  }

  const tick = async () => {
    if (stopped || running) {
      return;
    }

    if (isHidden()) {
      schedule(hiddenCheckMs);
      return;
    }

    running = true;

    await runner().catch(() => {
      // 错误由上层处理，这里保持轮询继续执行
    });

    running = false;

    if (!stopped) {
      schedule(intervalMs);
    }
  };

  function onVisibilityChange() {
    if (!resumeImmediately || stopped || isHidden()) {
      return;
    }

    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }

    void tick();
  }

  if (pauseWhenHidden && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  void tick();

  return {
    stop() {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
      }

      if (pauseWhenHidden && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    },
  };
}
