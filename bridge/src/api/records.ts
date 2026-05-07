import { Router, Request, Response } from 'express';
import { Database } from '../storage/sqlite';

/**
 * GET /records          — all records (used by dashboard polling)
 * GET /records/:patientId — records for a specific patient (used by patient PWA)
 */
export function recordsRouter(db: Database): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    try {
      const records = db.getAllRecords();
      res.json({ ok: true, count: records.length, records });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: 'Failed to fetch records' });
    }
  });

  router.get('/:patientId', (req: Request, res: Response) => {
    try {
      const records = db.getRecordsByPatientId(req.params.patientId);
      res.json({ ok: true, count: records.length, records });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: 'Failed to fetch records' });
    }
  });

  return router;
}
