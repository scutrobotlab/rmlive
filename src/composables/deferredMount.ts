export function scheduleDeferredMount(task: () => void, delayMs = 180): () => void {
  const idleCallback = window.requestIdleCallback;
  if (idleCallback) {
    idleCallback(() => {
      task();
    });
    return () => {};
  }

  const timer = window.setTimeout(() => task(), delayMs);
  return () => {
    window.clearTimeout(timer);
  };
}
