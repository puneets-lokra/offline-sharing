import { Router, Request, Response } from 'express';
import { Database } from '../storage/sqlite';

/**
 * GET /records
 * Returns all patient records stored in SQLite.
 * Used by Client 2 (Dashboard) for HTTP polling fallback.
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

  return router;
}
