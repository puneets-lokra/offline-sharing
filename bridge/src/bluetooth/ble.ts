/**
 * ble.ts — BLE GATT peripheral server (optional transport).
 *
 * @abandonware/bleno is an optional dependency (requires node-gyp + Python to build).
 * If it is not installed, startBLE() resolves to null and the bridge continues in HTTP-only mode.
 */

import { Database } from '../storage/sqlite';

export interface BLEServer {
  notifyChar: { push(record: object): void };
  stop: () => void;
}

/**
 * Bleno crashes on process.exit when no USB BT adapter is present — it calls
 * controlTransfer on an undefined usbDevice inside its onExit hook.
 * Install a one-time uncaughtException guard BEFORE requiring bleno so the
 * bridge process doesn't die from bleno's cleanup errors.
 */
function installBlenoExitGuard(): void {
  process.on('uncaughtException', (err: Error) => {
    // Swallow bleno USB teardown errors — they are non-fatal
    const msg = err?.message ?? '';
    if (
      msg.includes('controlTransfer') ||
      msg.includes('usbDevice') ||
      msg.includes('bluetooth-hci-socket')
    ) {
      console.warn('[ble] Suppressed bleno USB teardown error (non-fatal):', msg);
      return;
    }
    // Re-throw anything else so real crashes still surface
    console.error('[bridge] Uncaught exception:', err);
    process.exit(1);
  });
}

export async function startBLE(db: Database): Promise<BLEServer | null> {
  let bleno: any;
  try {
    // Dynamic require — avoids build-time failure when bleno is not installed
    installBlenoExitGuard();
    bleno = require('@abandonware/bleno');
  } catch {
    console.warn('[ble] @abandonware/bleno not installed — BLE transport disabled');
    return null;
  }

  const { SERVICE_UUID } = await import('./uuids');
  const { WriteCharacteristic } = await import('./writeCharacteristic');
  const { NotifyCharacteristic } = await import('./notifyCharacteristic');
  const { ReadCharacteristic } = await import('./readCharacteristic');

  return new Promise((resolve) => {
    const notifyChar = new NotifyCharacteristic(bleno);
    const writeChar = new WriteCharacteristic(bleno, db, notifyChar);
    const readChar = new ReadCharacteristic(bleno, db);

    // bleno registers its own SIGINT/SIGTERM handlers that call process.exit().
    // Remove them so the bridge shutdown handler stays in control.
    const removeBlenoSignalHandlers = () => {
      process.removeAllListeners('SIGINT');
      process.removeAllListeners('SIGTERM');
    };

    const done = (result: BLEServer | null) => {
      removeBlenoSignalHandlers();
      resolve(result);
    };

    const timeout = setTimeout(() => {
      console.warn('[ble] BLE state timeout — continuing without BLE');
      done(null);
    }, 5000);

    bleno.on('stateChange', (state: string) => {
      if (state !== 'poweredOn') {
        console.warn(`[ble] Bluetooth state: ${state} — BLE not available`);
        clearTimeout(timeout);
        done(null);
        return;
      }

      bleno.startAdvertising('ClinicBridge', [SERVICE_UUID], (err: Error | null) => {
        if (err) {
          console.warn('[ble] Failed to start advertising:', err.message);
          clearTimeout(timeout);
          done(null);
        }
      });
    });

    bleno.on('advertisingStart', (err: Error | null) => {
      clearTimeout(timeout);
      if (err) {
        console.warn('[ble] advertisingStart error:', err.message);
        done(null);
        return;
      }

      bleno.setServices([
        new bleno.PrimaryService({
          uuid: SERVICE_UUID,
          characteristics: [writeChar.bleChar, notifyChar.bleChar, readChar.bleChar],
        }),
      ]);

      console.log('[ble] BLE GATT server advertising as "ClinicBridge"');

      done({
        notifyChar,
        stop: () => {
          bleno.stopAdvertising();
          bleno.disconnect();
          console.log('[ble] BLE server stopped');
        },
      });
    });

    bleno.on('accept', (addr: string) => console.log(`[ble] Client connected: ${addr}`));
    bleno.on('disconnect', (addr: string) => console.log(`[ble] Client disconnected: ${addr}`));
  });
}
