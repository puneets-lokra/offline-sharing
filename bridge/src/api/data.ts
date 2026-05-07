import { Router, Request, Response } from 'express';
import { Database } from '../storage/sqlite';

/** Expected shape of an incoming patient record */
interface PatientRecord {
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

/**
 * Validates that a payload has all required fields with correct types.
 * Returns an error message string if invalid, or null if valid.
 */
function validateRecord(body: any): string | null {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object';
  if (typeof body.id !== 'string' || !body.id) return 'Missing or invalid field: id';
  if (typeof body.patientId !== 'string' || !body.patientId) return 'Missing or invalid field: patientId';
  if (typeof body.name !== 'string' || !body.name) return 'Missing or invalid field: name';
  if (typeof body.age !== 'number' || body.age < 0) return 'Missing or invalid field: age';
  if (!['male', 'female', 'other'].includes(body.gender)) return 'Invalid field: gender must be male|female|other';
  if (typeof body.diagnosis !== 'string' || !body.diagnosis) return 'Missing or invalid field: diagnosis';
  if (typeof body.doctorId !== 'string' || !body.doctorId) return 'Missing or invalid field: doctorId';
  if (typeof body.timestamp !== 'string' || !body.timestamp) return 'Missing or invalid field: timestamp';
  return null;
}

/**
 * POST /data
 * Accepts a single patient record, validates it, and upserts into SQLite.
 * Idempotent: sending the same id twice will update, not duplicate.
 */
export function dataRouter(db: Database): Router {
  const router = Router();

  router.post('/', (req: Request, res: Response) => {
    const error = validateRecord(req.body);
    if (error) {
      res.status(400).json({ ok: false, error });
      return;
    }

    const record: PatientRecord = {
      ...req.body,
      syncStatus: 'pending', // always reset to pending when received from PWA
    };

    try {
      db.upsertRecord(record);
      res.json({ ok: true, id: record.id });
    } catch (err: any) {
      console.error('[data] DB write failed:', err.message);
      res.status(500).json({ ok: false, error: 'Database write failed' });
    }
  });

  return router;
}
