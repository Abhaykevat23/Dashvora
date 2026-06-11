/**
 * IndexedDB-based storage adapter for Zustand persist middleware.
 *
 * localStorage has a ~5 MB per-origin limit, which large datasets (uploaded CSVs,
 * dashboard configurations, chat histories) frequently exceed.
 *
 * IndexedDB typically allows 50%+ of available disk space, and the API is
 * asynchronous so it integrates cleanly with Zustand persist internals.
 */

const DB_NAME = 'dashvora-store';
const DB_VERSION = 1;
const STORE_NAME = 'persist';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Zustand persist storage adapter backed by IndexedDB.
 *
 * Falls back to a trimmed localStorage if IndexedDB is unavailable (e.g. in SSR).
 */
export const indexedDBStorage: {
  getItem: (name: string) => Promise<string | null>;
  setItem: (name: string, value: string) => Promise<void>;
  removeItem: (name: string) => Promise<void>;
} = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(name);
        req.onsuccess = () => {
          resolve(req.result ?? null);
          db.close();
        };
        req.onerror = () => {
          reject(req.error);
          db.close();
        };
      });
    } catch {
      // Fallback: try localStorage (e.g. SSR or very restricted environments)
      try {
        return localStorage.getItem(name);
      } catch {
        console.debug('[storage] IndexedDB unavailable (SSR?); returning null.');
        return null;
      }
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, name);
        req.onsuccess = () => {
          resolve();
          db.close();
        };
        req.onerror = () => {
          reject(req.error);
          db.close();
        };
      });
    } catch (err) {
      console.debug('[storage] IndexedDB unavailable, falling back to localStorage.', err);
      // Fallback: try localStorage if IndexedDB fails
      try {
        localStorage.setItem(name, value);
      } catch (localErr: any) {
        // Last resort: silently swallow QuotaExceededError so the app still works
        if (localErr.name === 'QuotaExceededError') {
          console.warn(
            '[storage] localStorage quota exceeded and IndexedDB unavailable. ' +
            'Consider clearing old data or uploading smaller files.'
          );
        } else {
          throw localErr;
        }
      }
    }
  },

  removeItem: async (name: string): Promise<void> => {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(name);
        req.onsuccess = () => {
          resolve();
          db.close();
        };
        req.onerror = () => {
          reject(req.error);
          db.close();
        };
      });
    } catch {
      try {
        localStorage.removeItem(name);
      } catch {
        console.debug('[storage] Unable to remove item (SSR?).');
      }
    }
  },
};
