/**
 * bleSync.ts — Web Bluetooth transport for the Doctor PWA (Client 1).
 *
 * Flow:
 *   1. User calls connect() — Chrome shows device picker, user selects "ClinicBridge"
 *   2. sendRecord(record) encodes JSON + 2-byte header and writes to WRITE characteristic
 *   3. disconnect() tears down the connection
 *
 * Constraints:
 *   - Web Bluetooth only works in Chrome (Android, Windows, macOS) over HTTPS or localhost
 *   - connect() MUST be called from a user gesture (button click)
 *   - MTU ~512 bytes; patient JSON ~250 bytes — no chunking needed in practice
 */
import { SERVICE_UUID, WRITE_CHAR_UUID } from './bleUuids';
export class BLESync {
    constructor(onStatusChange = () => { }) {
        Object.defineProperty(this, "device", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "writeChar", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "_status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'disconnected'
        });
        Object.defineProperty(this, "onStatusChange", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.onStatusChange = onStatusChange;
    }
    get status() {
        return this._status;
    }
    get isConnected() {
        return this._status === 'connected' || this._status === 'sending';
    }
    /** Returns true if Web Bluetooth is available in this browser */
    static isSupported() {
        return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
    }
    /**
     * Opens the Chrome BLE device picker and connects to ClinicBridge GATT server.
     * MUST be called from a user gesture.
     */
    async connect() {
        if (!BLESync.isSupported()) {
            throw new Error('Web Bluetooth not supported in this browser');
        }
        this.setStatus('connecting');
        try {
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ name: 'ClinicBridge' }],
                optionalServices: [SERVICE_UUID],
            });
            this.device.addEventListener('gattserverdisconnected', () => {
                console.log('[ble] Device disconnected');
                this.writeChar = null;
                this.setStatus('disconnected');
            });
            const server = await this.device.gatt.connect();
            const service = await server.getPrimaryService(SERVICE_UUID);
            this.writeChar = await service.getCharacteristic(WRITE_CHAR_UUID);
            this.setStatus('connected');
            console.log('[ble] Connected to ClinicBridge');
        }
        catch (err) {
            this.setStatus('error');
            throw err;
        }
    }
    /**
     * Sends a single patient record to the bridge via BLE WRITE.
     * Prepends 2-byte header: [seq=0, total=1] for single-packet protocol.
     */
    async sendRecord(record) {
        if (!this.writeChar)
            throw new Error('BLE not connected');
        this.setStatus('sending');
        try {
            const json = JSON.stringify(record);
            const jsonBytes = new TextEncoder().encode(json);
            // Protocol: byte 0 = seq index, byte 1 = total chunks
            const packet = new Uint8Array(2 + jsonBytes.length);
            packet[0] = 0; // seq 0
            packet[1] = 1; // total 1
            packet.set(jsonBytes, 2);
            await this.writeChar.writeValueWithResponse(packet.buffer);
            this.setStatus('connected');
        }
        catch (err) {
            this.setStatus('error');
            throw err;
        }
    }
    /** Closes the GATT connection */
    disconnect() {
        if (this.device?.gatt?.connected) {
            this.device.gatt.disconnect();
        }
        this.writeChar = null;
        this.setStatus('disconnected');
    }
    setStatus(s) {
        this._status = s;
        this.onStatusChange(s);
    }
}
