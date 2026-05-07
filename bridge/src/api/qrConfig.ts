import { Router } from 'express';
import { networkInterfaces } from 'os';
import { BridgeConfig } from '../config';

/**
 * Returns the best local IPv4 address for LAN access.
 * Prefers the Mobile Hotspot adapter (192.168.137.x) if present,
 * otherwise falls back to the first non-loopback IPv4.
 */
function getLanIp(): string {
  const nets = networkInterfaces();
  let fallback = '127.0.0.1';
  for (const iface of Object.values(nets)) {
    for (const addr of iface ?? []) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      if (addr.address.startsWith('192.168.137.')) return addr.address; // hotspot
      if (
        addr.address.startsWith('192.168.') ||
        addr.address.startsWith('10.') ||
        addr.address.startsWith('172.')
      ) {
        fallback = addr.address;
      }
    }
  }
  return fallback;
}

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
    // Prefer explicit tunnel URL; fall back to auto-detected LAN IP
    const bridgeUrl = config.ngrokUrl
      ? config.ngrokUrl.replace(/\/$/, '')
      : `http://${getLanIp()}:${config.port}`;

    res.json({
      bridgeUrl,
      githubPagesUrl: (config.githubPagesUrl ?? '').replace(/\/$/, ''),
      ssid:     config.hotspot.ssid,
      password: config.hotspot.password,
      lanIp:    getLanIp(),  // always expose so dashboard can show it
    });
  });

  return router;
}
