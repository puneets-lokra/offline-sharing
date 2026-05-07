import { Router } from 'express';

const VERSION = '1.0.0';

/**
 * GET /health
 * Returns a simple health check payload.
 * Used by the PWA to detect bridge availability.
 */
export function healthRouter(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ status: 'ok', version: VERSION });
  });

  return router;
}
