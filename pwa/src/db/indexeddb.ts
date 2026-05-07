import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface PatientRecord {
  id: string;
  patientId: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  diagnosis: string;
  notes: string;
  doctorId: string;
  timestamp: string;
  syncStatus: 'pending' | 'synced';
}

interface ClinicDB extends DBSchema {
  records: {
    key: string;
    value: PatientRecord;
    indexes: { 'by-syncStatus': string };
  };
}

let dbInstance: IDBPDatabase<ClinicDB> | null = null;

/** Opens (or reuses) the IndexedDB database */
async function getDB(): Promise<IDBPDatabase<ClinicDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<ClinicDB>('clinic-records', 1, {
    upgrade(db) {
      const store = db.createObjectStore('records', { keyPath: 'id' });
      store.createIndex('by-syncStatus', 'syncStatus');
    },
  });
  return dbInstance;
}

/** Saves a patient record to IndexedDB (upsert by id) */
export async function saveRecord(record: PatientRecord): Promise<void> {
  const db = await getDB();
  await db.put('records', record);
}

/** Returns all records with syncStatus = 'pending' */
export async function getPendingRecords(): Promise<PatientRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('records', 'by-syncStatus', 'pending');
}

/** Returns all records regardless of sync status */
export async function getAllRecords(): Promise<PatientRecord[]> {
  const db = await getDB();
  return db.getAll('records');
}

/** Marks a list of record IDs as synced */
export async function markRecordsSynced(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('records', 'readwrite');
  await Promise.all(
    ids.map(async (id) => {
      const record = await tx.store.get(id);
      if (record) {
        await tx.store.put({ ...record, syncStatus: 'synced' });
      }
    })
  );
  await tx.done;
}
