import type { IndexItem } from '@/lib/types';

const LOCAL_INDEX_KEY = 'fire-db-sys.index.v1';
const DB_NAME = 'fire-db-sys.local-backups';
const DB_VERSION = 1;
const STORE_NAME = 'backups';
const FULL_INDEX_KEY = 'full-index.v1';

let writeQueue: Promise<void> = Promise.resolve();

function isIndex(value: unknown): value is IndexItem[] {
  return Array.isArray(value);
}

/**
 * localStorage is deliberately limited to a small structural fallback. The
 * complete slide HTML can be several megabytes and belongs in IndexedDB.
 */
export function stripIndexContent(items: IndexItem[]): IndexItem[] {
  return items.map(({ content: _content, children, ...item }) => ({
    ...item,
    ...(children ? { children: stripIndexContent(children) } : {}),
  }));
}

function openBackupDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open the local backup database'));
    request.onblocked = () => reject(new Error('The local backup database is blocked'));
  });
}

async function readIndexedDbBackup(): Promise<IndexItem[] | null> {
  const db = await openBackupDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(FULL_INDEX_KEY);
    let value: IndexItem[] | null = null;

    request.onsuccess = () => {
      value = isIndex(request.result) ? request.result : null;
    };
    transaction.oncomplete = () => {
      db.close();
      resolve(value);
    };
    transaction.onerror = () => {
      const error = transaction.error ?? new Error('Unable to read the local index backup');
      db.close();
      reject(error);
    };
    transaction.onabort = () => {
      const error = transaction.error ?? new Error('Reading the local index backup was aborted');
      db.close();
      reject(error);
    };
  });
}

async function writeIndexedDbBackup(index: IndexItem[]): Promise<void> {
  const db = await openBackupDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(index, FULL_INDEX_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      const error = transaction.error ?? new Error('Unable to write the local index backup');
      db.close();
      reject(error);
    };
    transaction.onabort = () => {
      const error = transaction.error ?? new Error('Writing the local index backup was aborted');
      db.close();
      reject(error);
    };
  });
}

function readLocalStorageFallback(): IndexItem[] | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(LOCAL_INDEX_KEY);
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  return isIndex(parsed) ? parsed : null;
}

function writeLocalStorageFallback(index: IndexItem[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_INDEX_KEY, JSON.stringify(stripIndexContent(index)));
}

export async function readLocalIndex(): Promise<IndexItem[] | null> {
  if (typeof window === 'undefined') return null;

  try {
    const indexedDbBackup = await readIndexedDbBackup();
    if (indexedDbBackup) return indexedDbBackup;
  } catch {
    // A compact localStorage fallback is read below when IndexedDB is disabled.
  }

  try {
    const fallback = readLocalStorageFallback();
    if (fallback) {
      // Migrate legacy full localStorage backups to IndexedDB and replace the
      // quota-heavy value with the compact structural fallback.
      await writeLocalIndex(fallback);
    }
    return fallback;
  } catch (error) {
    console.warn('[APP] Failed to read the local index backup:', error);
    return null;
  }
}

async function persistLocalIndex(index: IndexItem[]): Promise<void> {
  let indexedDbError: unknown;
  let localStorageError: unknown;

  try {
    await writeIndexedDbBackup(index);
  } catch (error) {
    indexedDbError = error;
  }

  try {
    writeLocalStorageFallback(index);
  } catch (error) {
    localStorageError = error;
  }

  if (indexedDbError && localStorageError) {
    console.warn('[APP] Failed to write the local index backup:', {
      indexedDbError,
      localStorageError,
    });
  }
}

export function writeLocalIndex(index: IndexItem[]): Promise<void> {
  const task = writeQueue.then(
    () => persistLocalIndex(index),
    () => persistLocalIndex(index),
  );
  writeQueue = task.catch(() => {});
  return task;
}
