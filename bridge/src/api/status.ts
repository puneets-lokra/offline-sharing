import { Router } from 'express';
import { Database } from '../storage/sqlite';
import { CloudSync } from '../sync/cloudSync';

/**
 * GET /status
 * Returns runtime status: record counts, sync state, internet availability.
 */
export function statusRouter(db: Database, cloudSync: CloudSync): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const counts = db.getRecordCounts();
    res.json({
      status: 'ok',
      records: {
        total: counts.total,
        pending: counts.pending,
        synced: counts.synced,
      },
      sync: {
        internetAvailable: cloudSync.isOnline(),
        lastSyncAt: cloudSync.getLastSyncTime(),
      },
    });
  });

  return router;
}
