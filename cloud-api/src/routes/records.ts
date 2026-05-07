import { Router, Request, Response } from 'express';
import { getDatabase, upsertRecord, getAllRecords, PatientRecord } from '../db/sqlite';

/**
 * POST /records — accepts array of patient records, upserts all. Idempotent.
 * GET  /records — returns all stored records.
 */
export function recordsRouter(): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    const body = req.body;
    if (!Array.isArray(body) || body.length === 0) {
      res.status(400).json({ ok: false, error: 'Body must be a non-empty array of records' });
      return;
    }

    const db = await getDatabase();
    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const record of body) {
      if (!record.id || !record.patientId) {
        results.push({ id: record.id ?? '?', ok: false, error: 'Missing id or patientId' });
        continue;
      }
      try {
        upsertRecord(db, record as PatientRecord);
        results.push({ id: record.id, ok: true });
      } catch (err: any) {
        results.push({ id: record.id, ok: false, error: err.message });
      }
    }

    const allOk = results.every((r) => r.ok);
    res.status(allOk ? 200 : 207).json({ ok: allOk, results });
  });

  router.get('/', async (_req: Request, res: Response) => {
    const db = await getDatabase();
    const records = getAllRecords(db);
    res.json({ ok: true, count: records.length, records });
  });

  return router;
}
