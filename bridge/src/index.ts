import { loadConfig } from './config';
import { startHotspot, stopHotspot } from './hotspot';
import { createServer } from './server';
import { initDatabase } from './storage/sqlite';
import { CloudSync } from './sync/cloudSync';
import { startBLE, BLEServer } from './bluetooth/ble';

const VERSION = '1.0.0';

async function main() {
  console.log(`[bridge] Offline Clinic Bridge v${VERSION} starting...`);

  // Load config
  const config = loadConfig();

  // Initialise SQLite database
  const db = await initDatabase(config.db.path);

  // Start cloud sync agent (polls for internet, pushes pending records)
  const cloudSync = new CloudSync(db, config.cloudApi);
  cloudSync.start();

  // Start Wi-Fi Direct hotspot if enabled
  if (config.hotspot.enabled) {
    await startHotspot(config.hotspot);
  }

  // Start HTTP server
  const app = createServer(config, db, cloudSync);
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[bridge] HTTP server listening on 0.0.0.0:${config.port}`);
    console.log(`[bridge] PWA available at http://192.168.137.1:${config.port}`);
    console.log(`[bridge] Health check: http://192.168.137.1:${config.port}/health`);
  });

  // Start BLE GATT server (non-fatal — bridge works fine over HTTP only if BT unavailable)
  let bleServer: BLEServer | null = null;
  try {
    bleServer = await startBLE(db);
    console.log('[bridge] BLE GATT server started — both HTTP and BLE transports active');
  } catch (err: any) {
    console.warn('[bridge] BLE unavailable — HTTP-only mode:', err.message);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[bridge] Shutting down...');
    cloudSync.stop();
    bleServer?.stop();
    if (config.hotspot.enabled) {
      await stopHotspot();
    }
    server.close(() => {
      console.log('[bridge] Server closed. Goodbye.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[bridge] Fatal startup error:', err);
  process.exit(1);
});
