/**
 * Локальное хранилище дневника: фото и раскладка переживают перезагрузку страницы.
 * Всё лежит в IndexedDB этого браузера — никуда не отправляется.
 */

const DB_NAME = 'photobook';
const DB_VERSION = 1;
const PHOTOS = 'photos';
const STATE = 'state';

export type StoredPhoto = {
  id: string;
  name: string;
  w: number;
  h: number;
  date: number | null;
  blob: Blob;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STATE)) db.createObjectStore(STATE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const putPhoto = (p: StoredPhoto) => tx(PHOTOS, 'readwrite', (s) => s.put(p));
export const dropPhoto = (id: string) => tx(PHOTOS, 'readwrite', (s) => s.delete(id));
export const allPhotos = () => tx<StoredPhoto[]>(PHOTOS, 'readonly', (s) => s.getAll());

export const putState = (value: unknown) => tx(STATE, 'readwrite', (s) => s.put(value, 'book'));
export const getState = <T>() => tx<T | undefined>(STATE, 'readonly', (s) => s.get('book'));

export async function clearAll() {
  await tx(PHOTOS, 'readwrite', (s) => s.clear());
  await tx(STATE, 'readwrite', (s) => s.clear());
}
