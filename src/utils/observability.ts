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
