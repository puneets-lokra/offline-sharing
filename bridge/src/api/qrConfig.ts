import { Router } from 'express';
import { BridgeConfig } from '../config';

/**
 * GET /qr-config
 * Returns the public-facing base URL and Wi-Fi credentials the dashboard
 * needs to generate QR codes client-side.
 *
 * Deliberately exposes only what the dashboard needs — not the full config.
 */
export function qrConfigRouter(config: BridgeConfig): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const bridgeUrl = config.ngrokUrl
      ? config.ngrokUrl.replace(/\/$/, '')
      : `http://192.168.137.1:${config.port}`;

    res.json({
      bridgeUrl,
      ssid:     config.hotspot.ssid,
      password: config.hotspot.password,
    });
  });

  return router;
}
