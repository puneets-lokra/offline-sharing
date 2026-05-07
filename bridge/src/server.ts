import express from 'express';
import cors from 'cors';
import path from 'path';
import { BridgeConfig } from './config';
import { healthRouter } from './api/health';
import { statusRouter } from './api/status';
import { dataRouter } from './api/data';
import { recordsRouter } from './api/records';
import { qrRouter } from './api/qr';
import { qrConfigRouter } from './api/qrConfig';
import { sessionRouter } from './api/session';
import { Database } from './storage/sqlite';
import { CloudSync } from './sync/cloudSync';

/**
 * Creates and configures the Express server.
 * Serves the PWA static files and mounts all API routes.
 */
export function createServer(
  config: BridgeConfig,
  db: Database,
  cloudSync: CloudSync
): express.Application {
  const app = express();

  // Enable CORS for all origins — PWA may be loaded from any device on the hotspot
  app.use(cors());
  app.use(express.json());

  // Serve built PWA from pwa/dist/ at /
  const pwaDistPath = path.resolve(process.cwd(), '..', 'pwa', 'dist');
  app.use(express.static(pwaDistPath));

  // Serve dashboard from dashboard/dist/ at /dashboard
  const dashDistPath = path.resolve(process.cwd(), '..', 'dashboard', 'dist');
  app.use('/dashboard', express.static(dashDistPath));

  // API routes
  app.use('/health', healthRouter());
  app.use('/status', statusRouter(db, cloudSync));
  app.use('/data', dataRouter(db));
  app.use('/records', recordsRouter(db));
  app.use('/qr', qrRouter(config));
  app.use('/qr-config', qrConfigRouter(config));
  app.use('/session', sessionRouter());

  // SPA fallback — return PWA index.html for unknown routes (except /dashboard)
  app.get('*', (req, res) => {
    if (req.path.startsWith('/dashboard')) {
      res.sendFile(path.join(dashDistPath, 'index.html'));
    } else {
      res.sendFile(path.join(pwaDistPath, 'index.html'));
    }
  });

  return app;
}
