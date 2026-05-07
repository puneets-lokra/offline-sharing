import { PatientRecord, saveRecord } from '../db/indexeddb';
import { v4 as uuidv4 } from 'uuid';

/**
 * Creates a new patient record with auto-generated id and timestamp.
 * syncStatus is always 'pending' on creation.
 */
export function createRecord(
  data: Omit<PatientRecord, 'id' | 'timestamp' | 'syncStatus'>
): PatientRecord {
  return {
    ...data,
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    syncStatus: 'pending',
  };
}

/**
 * Saves a new patient record to local IndexedDB.
 */
export async function addRecord(
  data: Omit<PatientRecord, 'id' | 'timestamp' | 'syncStatus'>
): Promise<PatientRecord> {
  const record = createRecord(data);
  await saveRecord(record);
  return record;
}
