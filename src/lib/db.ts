"use client";

const DB_NAME = "OppenheimSlidesDB";
const STORE_NAME = "slides";
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onerror = (event) => {
      console.error("Error al inicializar IndexedDB:", (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

const saveSlideToDB = (id: string, content: string | null): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    if (!db) {
      try {
        await initDB();
      } catch (error) {
        reject("La base de datos no está inicializada.");
        return;
      }
    }
    const transaction = db!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id, content });
    request.onsuccess = () => resolve();
    request.onerror = (event) => {
      console.error("Error al guardar la diapositiva:", (event.target as IDBRequest).error);
      reject((event.target as IDBRequest).error);
    };
  });
};

const loadAllSlidesFromDB = (): Promise<{id: string, content: string}[]> => {
  return new Promise(async (resolve, reject) => {
    if (!db) {
       try {
        await initDB();
      } catch (error) {
        reject("La base de datos no está inicializada.");
        return;
      }
    }
    const transaction = db!.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = (event) => resolve((event.target as IDBRequest).result);
    request.onerror = (event) => {
      console.error("Error al cargar las diapositivas:", (event.target as IDBRequest).error);
      reject((event.target as IDBRequest).error);
    };
  });
};

export { initDB, saveSlideToDB, loadAllSlidesFromDB };
