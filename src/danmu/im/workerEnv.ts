type LeancloudRuntimeModule = typeof import('leancloud-realtime');

let leancloudRuntimePromise: Promise<LeancloudRuntimeModule> | null = null;

function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
    getItem(key: string) {
      return entries.has(key) ? entries.get(key)! : null;
    },
    key(index: number) {
      return Array.from(entries.keys())[index] ?? null;
    },
    removeItem(key: string) {
      entries.delete(key);
    },
    setItem(key: string, value: string) {
      entries.set(String(key), String(value));
    },
  } as Storage;
}

export function ensureLeancloudWorkerEnvironment(): void {
  const scope = globalThis as any;
  if (!('window' in scope)) {
    scope.window = scope;
  }
  if (!('localStorage' in scope)) {
    scope.localStorage = createMemoryStorage();
  }
}

export async function loadLeancloudRuntime(): Promise<LeancloudRuntimeModule> {
  if (!leancloudRuntimePromise) {
    leancloudRuntimePromise = (async () => {
      ensureLeancloudWorkerEnvironment();
      return import('leancloud-realtime');
    })();
  }
  return leancloudRuntimePromise;
}
