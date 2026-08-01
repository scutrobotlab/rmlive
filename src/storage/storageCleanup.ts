const MAX_LOCALSTORAGE_SIZE = 5 * 1024 * 1024;
const INDEXEDDB_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function pruneLargeLocalStorageEntries(): void {
  try {
    const keysToCheck: Array<{ key: string; size: number }> = [
      { key: 'rmlive:danmu-history-cache', size: 0 },
      { key: 'rmlive:rm-data-cache', size: 0 },
      { key: 'rmlive:zone-selection', size: 0 },
    ];

    let totalSize = 0;
    for (const entry of keysToCheck) {
      const value = localStorage.getItem(entry.key);
      entry.size = value ? value.length * 2 : 0;
      totalSize += entry.size;
    }

    if (totalSize > MAX_LOCALSTORAGE_SIZE) {
      console.warn(
        `[StorageCleanup] localStorage exceeds ${(MAX_LOCALSTORAGE_SIZE / 1024 / 1024).toFixed(1)}MB, pruning...`,
      );
      for (const entry of keysToCheck) {
        if (totalSize <= MAX_LOCALSTORAGE_SIZE) break;
        localStorage.removeItem(entry.key);
        totalSize -= entry.size;
      }
    }
  } catch {
  }
}

export async function checkStorageQuota(): Promise<void> {
  if (!('storage' in navigator)) return;

  try {
    const estimate = await navigator.storage.estimate();
    const usageRatio = (estimate.usage ?? 0) / (estimate.quota ?? 1);
    if (usageRatio > 0.8) {
      console.warn(
        `[StorageCleanup] storage usage ${(usageRatio * 100).toFixed(1)}%, consider cleanup`,
      );
    }
  } catch {
  }
}

export async function pruneExpiredIndexedDBData(): Promise<void> {
  try {
    const { openScheduleNotifyDb, STORE_MATCHES } = await import('./scheduleNotifyDb');
    const db = await openScheduleNotifyDb();

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_MATCHES, 'readwrite');
        const store = tx.objectStore(STORE_MATCHES);
        const allReq = store.getAll();

        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };

        allReq.onsuccess = () => {
          const rows = (allReq.result as Array<{ id: string; updatedAt?: number }>) ?? [];
          const cutoff = Date.now() - INDEXEDDB_MAX_AGE_MS;

          for (const row of rows) {
            if (row.updatedAt && row.updatedAt < cutoff) {
              store.delete(row.id);
            }
          }
        };
        allReq.onerror = () => {
          db.close();
          resolve();
        };
      } catch {
        db.close();
        resolve();
      }
    });
  } catch {
  }
}
