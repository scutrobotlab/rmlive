import type { MatchNotifySnapshot, NotifyPolicy } from '../utils/scheduleNotifyDiff';

export const SCHEDULE_NOTIFY_DB = 'rm-live-schedule-notify';
export const SCHEDULE_NOTIFY_DB_VERSION = 1;
export const STORE_MATCHES = 'matches';
export const STORE_PREFS = 'prefs';
const PREFS_KEY = 'config';

export interface ScheduleNotifyPrefsRecord {
  policy: NotifyPolicy;
  followedMatchIds: string[];
}

const defaultPrefs: ScheduleNotifyPrefsRecord = {
  policy: 'all',
  followedMatchIds: [],
};

export function openScheduleNotifyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SCHEDULE_NOTIFY_DB, SCHEDULE_NOTIFY_DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MATCHES)) {
        db.createObjectStore(STORE_MATCHES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PREFS)) {
        db.createObjectStore(STORE_PREFS);
      }
    };
  });
}

export async function getPrefsFromDb(): Promise<ScheduleNotifyPrefsRecord> {
  const db = await openScheduleNotifyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PREFS, 'readonly');
    const store = tx.objectStore(STORE_PREFS);
    const g = store.get(PREFS_KEY);
    g.onerror = () => reject(g.error);
    g.onsuccess = () => {
      db.close();
      resolve((g.result as ScheduleNotifyPrefsRecord | undefined) ?? defaultPrefs);
    };
  });
}

/** IDB structured clone cannot store Vue reactive proxies; unwrap to plain data. */
function toPlainPrefsRecord(prefs: ScheduleNotifyPrefsRecord): ScheduleNotifyPrefsRecord {
  return {
    policy: prefs.policy,
    followedMatchIds: Array.from(prefs.followedMatchIds ?? []),
  };
}

export async function putPrefsToDb(prefs: ScheduleNotifyPrefsRecord): Promise<void> {
  const plain = toPlainPrefsRecord(prefs);
  const db = await openScheduleNotifyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PREFS, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_PREFS).put(plain, PREFS_KEY);
  });
}

export async function getAllMatchSnapshots(): Promise<Map<string, MatchNotifySnapshot>> {
  const db = await openScheduleNotifyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MATCHES, 'readonly');
    const store = tx.objectStore(STORE_MATCHES);
    const g = store.getAll();
    g.onerror = () => reject(g.error);
    g.onsuccess = () => {
      db.close();
      const map = new Map<string, MatchNotifySnapshot>();
      for (const row of g.result as MatchNotifySnapshot[]) {
        if (row?.id) {
          map.set(row.id, row);
        }
      }
      resolve(map);
    };
  });
}

export async function replaceAllMatchSnapshots(rows: MatchNotifySnapshot[]): Promise<void> {
  const db = await openScheduleNotifyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MATCHES, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore(STORE_MATCHES);
    store.clear();
    const now = Date.now();
    for (const row of rows) {
      if (row.id) {
        store.put({ ...row, updatedAt: now });
      }
    }
  });
}
