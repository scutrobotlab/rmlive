export function scheduleDeferredMount(task: () => void, delayMs = 180): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => {
      task();
    });
    return () => {
      window.cancelIdleCallback(id);
    };
  }

  const timer = window.setTimeout(() => task(), delayMs);
  return () => {
    window.clearTimeout(timer);
  };
}
