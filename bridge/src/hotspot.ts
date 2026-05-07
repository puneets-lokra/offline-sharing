import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface HotspotConfig {
  ssid: string;
  password: string;
}

/**
 * Creates a Windows Wi-Fi Direct hosted network (hotspot) using netsh wlan.
 * The hotspot IP will be 192.168.137.1 (Windows default for hosted networks).
 *
 * Requirements:
 *  - Run as Administrator (right-click → Run as administrator), OR
 *  - Windows Mobile Hotspot must be enabled manually in Settings → Network → Mobile hotspot
 *
 * If this fails, the bridge still works over the regular LAN/localhost.
 * Doctors can connect their devices to the same Wi-Fi network instead.
 */
export async function startHotspot(config: HotspotConfig): Promise<void> {
  const { ssid, password } = config;
  try {
    await execAsync(
      `netsh wlan set hostednetwork mode=allow ssid="${ssid}" key="${password}"`
    );
    await execAsync('netsh wlan start hostednetwork');
    console.log(`[hotspot] Wi-Fi Direct hotspot started — SSID: ${ssid}`);
    console.log(`[hotspot] Devices can now connect to "${ssid}" Wi-Fi and open http://192.168.137.1:8765`);
  } catch (err: any) {
    console.warn('[hotspot] Could not start hotspot automatically.');
    console.warn('[hotspot] To enable manually, either:');
    console.warn('[hotspot]   1. Run bridge.exe as Administrator, OR');
    console.warn('[hotspot]   2. Open Windows Settings → Network → Mobile hotspot → turn ON');
    console.warn('[hotspot] Bridge HTTP server is still running — accessible on your local network IP.');
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
