import { openDB } from 'idb';
let dbInstance = null;
/** Opens (or reuses) the IndexedDB database */
async function getDB() {
    if (dbInstance)
        return dbInstance;
    dbInstance = await openDB('clinic-records', 1, {
        upgrade(db) {
            const store = db.createObjectStore('records', { keyPath: 'id' });
            store.createIndex('by-syncStatus', 'syncStatus');
        },
    });
    return dbInstance;
}
/** Saves a patient record to IndexedDB (upsert by id) */
export async function saveRecord(record) {
    const db = await getDB();
    await db.put('records', record);
}
/** Returns all records with syncStatus = 'pending' */
export async function getPendingRecords() {
    const db = await getDB();
    return db.getAllFromIndex('records', 'by-syncStatus', 'pending');
}
/** Returns all records regardless of sync status */
export async function getAllRecords() {
    const db = await getDB();
    return db.getAll('records');
}
/** Marks a list of record IDs as synced */
export async function markRecordsSynced(ids) {
    const db = await getDB();
    const tx = db.transaction('records', 'readwrite');
    await Promise.all(ids.map(async (id) => {
        const record = await tx.store.get(id);
        if (record) {
            await tx.store.put({ ...record, syncStatus: 'synced' });
        }
    }));
    await tx.done;
}
