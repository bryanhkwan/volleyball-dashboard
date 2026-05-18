// Thin IndexedDB wrapper used to persist the parsed dataset across page
// reloads, so coaches don't have to re-upload every visit.
//
// We store a single record under key 'current' containing:
//   { metadata, sessions, players, setters, updatedAt }
//
// IndexedDB beats localStorage here because the JSON can be several MB once
// the season fills out.

const storage = (() => {
    const DB_NAME = 'volleyball_stats_db';
    const STORE = 'datasets';
    const KEY = 'current';
    const DB_VERSION = 1;

    function open() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function get() {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async function set(dataset) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            const stamped = Object.assign({}, dataset, { updatedAt: new Date().toISOString() });
            tx.objectStore(STORE).put(stamped, KEY);
            tx.oncomplete = () => resolve(stamped);
            tx.onerror = () => reject(tx.error);
        });
    }

    async function clear() {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    return { get, set, clear };
})();

window.storage = storage;
