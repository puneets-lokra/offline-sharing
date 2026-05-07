import { exec } from 'child_process';
import { promisify } from 'util';
import { networkInterfaces } from 'os';

const execAsync = promisify(exec);

export interface HotspotConfig {
  ssid: string;
  password: string;
}

function getLanIp(): string {
  const nets = networkInterfaces();
  let fallback = '127.0.0.1';
  for (const iface of Object.values(nets)) {
    for (const addr of iface ?? []) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      if (addr.address.startsWith('192.168.137.')) return addr.address;
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
 * Attempts to start a Windows Wi-Fi Direct hosted network (hotspot).
 * netsh hostednetwork is deprecated on Windows 10 1903+ — if it fails,
 * prints clear manual instructions and continues (bridge still works over LAN).
 */
export async function startHotspot(config: HotspotConfig): Promise<void> {
  const { ssid, password } = config;
  try {
    await execAsync(
      `netsh wlan set hostednetwork mode=allow ssid="${ssid}" key="${password}"`
    );
    await execAsync('netsh wlan start hostednetwork');
    console.log(`[hotspot] Hotspot started — SSID: ${ssid}, IP: 192.168.137.1`);
  } catch (err: any) {
    const lanIp = getLanIp();
    console.warn('[hotspot] Could not start hotspot automatically (needs admin or not supported).');
    console.warn('[hotspot]');
    console.warn('[hotspot] ── Option A: Use Windows Mobile Hotspot (recommended) ──────────────');
    console.warn('[hotspot]   1. Settings → Network & Internet → Mobile hotspot → turn ON');
    console.warn(`[hotspot]   2. Set name="${ssid}", password="${password}"`);
    console.warn('[hotspot]   3. Phone connects to that hotspot, then opens http://192.168.137.1:8765');
    console.warn('[hotspot]');
    console.warn('[hotspot] ── Option B: Same Wi-Fi network (easiest for testing) ──────────────');
    console.warn(`[hotspot]   Phone + laptop on same Wi-Fi → phone opens http://${lanIp}:8765`);
    console.warn('[hotspot]');
    console.warn('[hotspot] ── Option C: Cloudflare tunnel (phone uses mobile data) ────────────');
    console.warn('[hotspot]   Set ngrokUrl in bridge.config.json → phone uses that URL');
    console.warn('[hotspot] ─────────────────────────────────────────────────────────────────────');
  }
}

/**
 * Stops the Windows Wi-Fi Direct hosted network.
 */
export async function stopHotspot(): Promise<void> {
  try {
    await execAsync('netsh wlan stop hostednetwork');
    console.log('[hotspot] Wi-Fi Direct hotspot stopped');
  } catch (err: any) {
    console.warn('[hotspot] Could not stop hotspot:', err.message);
  }
}
