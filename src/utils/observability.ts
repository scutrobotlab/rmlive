type LogMeta = Record<string, unknown>;

const isTestEnv = import.meta.env.MODE === 'test' || Boolean(import.meta.env.VITEST);
const debugEnabled = (!isTestEnv && import.meta.env.DEV) || import.meta.env.VITE_DEBUG_LOGS === '1';
const warnEnabled = !isTestEnv || import.meta.env.VITE_TEST_WARN_LOGS === '1';

function withPrefix(scope: string, message: string): string {
  return `[rm-live][${scope}] ${message}`;
}

export function toErrorSummary(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function logInfo(scope: string, message: string, meta?: LogMeta): void {
  if (!debugEnabled) {
    return;
  }

  if (meta) {
    console.info(withPrefix(scope, message), meta);
    return;
  }

  console.info(withPrefix(scope, message));
}

export function logWarn(scope: string, message: string, meta?: LogMeta): void {
  if (!warnEnabled) {
    return;
  }

  if (meta) {
    console.warn(withPrefix(scope, message), meta);
    return;
  }

  console.warn(withPrefix(scope, message));
}

export function markPerformance(name: string): void {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') {
    return;
  }

  try {
    performance.mark(name);
  } catch {
    // ignore duplicate marks or unsupported contexts
  }
}

export function measurePerformance(name: string, startMark: string, endMark?: string): void {
  if (typeof performance === 'undefined' || typeof performance.measure !== 'function') {
    return;
  }

  try {
    if (endMark) {
      performance.measure(name, startMark, endMark);
      return;
    }

    performance.measure(name, startMark);
  } catch {
    // ignore missing marks or duplicate measures
  }
}
