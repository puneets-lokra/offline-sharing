/**
 * bleReceiver.ts — Dashboard BLE transport (Client 2).
 *
 * Connects to ClinicBridge GATT server and subscribes to the NOTIFY characteristic.
 * The bridge pushes new patient records in real time as they arrive from Client 1.
 *
 * Web Bluetooth constraints:
 *  - Chrome only (Android, Windows, macOS)
 *  - Must be triggered by a user gesture
 *  - Requires HTTPS or localhost
 */

const SERVICE_UUID     = '12345678-1234-1234-1234-123456789abc';
const NOTIFY_CHAR_UUID = 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb';

export type BLEReceiverStatus = 'disconnected' | 'connecting' | 'subscribed' | 'error';

export class BLEReceiver {
  private device: BluetoothDevice | null = null;
  private _status: BLEReceiverStatus = 'disconnected';
  private onRecord: (record: object) => void;
  private onStatusChange: (s: BLEReceiverStatus) => void;

  constructor(
    onRecord: (record: object) => void,
    onStatusChange: (s: BLEReceiverStatus) => void = () => {}
  ) {
    this.onRecord = onRecord;
    this.onStatusChange = onStatusChange;
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  get status(): BLEReceiverStatus { return this._status; }

  /** Opens Chrome device picker, connects, and subscribes to NOTIFY. */
  async connect(): Promise<void> {
    if (!BLEReceiver.isSupported()) throw new Error('Web Bluetooth not supported');

    this.setStatus('connecting');
    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'ClinicBridge' }],
        optionalServices: [SERVICE_UUID],
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this.setStatus('disconnected');
      });

      const server = await this.device.gatt!.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const notifyChar = await service.getCharacteristic(NOTIFY_CHAR_UUID);

      await notifyChar.startNotifications();
      notifyChar.addEventListener('characteristicvaluechanged', (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        const value = target.value!;
        const json = new TextDecoder().decode(value);
        try {
          const record = JSON.parse(json);
          this.onRecord(record);
        } catch {
          console.warn('[ble-rx] Failed to parse record:', json);
        }
      });

      this.setStatus('subscribed');
      console.log('[ble-rx] Subscribed to ClinicBridge NOTIFY');
    } catch (err: any) {
      this.setStatus('error');
      throw err;
    }
  }

  disconnect(): void {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    this.setStatus('disconnected');
  }

  private setStatus(s: BLEReceiverStatus): void {
    this._status = s;
    this.onStatusChange(s);
  }
}
