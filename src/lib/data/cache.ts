/**
 * Caché local en IndexedDB.
 *
 *  - `kv`: el temario y el borrador de edición.
 *  - `content`: el HTML de cada tema, con la revisión con la que se guardó.
 *
 * Si IndexedDB no está disponible (modo privado estricto, cuota agotada) la
 * caché degrada a memoria: la app funciona igual, solo vuelve a descargar al
 * recargar. Ninguna función lanza.
 */
const DB_NAME = 'sys-course';
const DB_VERSION = 1;

export type CacheStore = 'kv' | 'content';

const memory: Record<CacheStore, Map<string, unknown>> = { kv: new Map(), content: new Map() };
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('content')) db.createObjectStore('content');
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(store: CacheStore, mode: IDBTransactionMode, work: (objectStore: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDatabase().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) {
          resolve(undefined);
          return;
        }
        try {
          const transaction = db.transaction(store, mode);
          const request = work(transaction.objectStore(store));
          let value: T | undefined;
          if (request) request.onsuccess = () => { value = request.result; };
          transaction.oncomplete = () => resolve(value);
          transaction.onerror = () => resolve(undefined);
          transaction.onabort = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export async function cacheGet<T>(store: CacheStore, key: string): Promise<T | undefined> {
  if (memory[store].has(key)) return memory[store].get(key) as T;
  const value = await run<T>(store, 'readonly', (os) => os.get(key) as IDBRequest<T>);
  return value === null ? undefined : value;
}

export async function cacheSet(store: CacheStore, key: string, value: unknown): Promise<void> {
  // El contenido puede sumar varios MB: solo se retiene en memoria si
  // IndexedDB no está disponible.
  const db = await openDatabase();
  if (!db) {
    memory[store].set(key, value);
    return;
  }
  memory[store].delete(key);
  await run(store, 'readwrite', (os) => { os.put(value, key); });
}

export async function cacheSetMany(store: CacheStore, entries: Array<[string, unknown]>): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    for (const [key, value] of entries) memory[store].set(key, value);
    return;
  }
  await run(store, 'readwrite', (os) => {
    for (const [key, value] of entries) os.put(value, key);
  });
}

export async function cacheDelete(store: CacheStore, key: string): Promise<void> {
  memory[store].delete(key);
  await run(store, 'readwrite', (os) => { os.delete(key); });
}

export async function cacheClear(store: CacheStore): Promise<void> {
  memory[store].clear();
  await run(store, 'readwrite', (os) => { os.clear(); });
}

/**
 * Borra la copia local de la versión anterior de la app (un único registro de
 * ~12 MB con todo el curso). Solo se llama cuando el servidor ya usa el
 * formato nuevo, momento en que esa copia deja de tener uso.
 */
export function deleteLegacyLocalData(): void {
  try {
    if (typeof indexedDB !== 'undefined') indexedDB.deleteDatabase('fire-db-sys.local-backups');
    if (typeof localStorage !== 'undefined') localStorage.removeItem('fire-db-sys.index.v1');
  } catch {
    // Sin importancia: es solo limpieza de espacio.
  }
}
