import { WRITE_CHAR_UUID } from './uuids';
import { Database, PatientRecord } from '../storage/sqlite';
import { NotifyCharacteristic } from './notifyCharacteristic';

export class WriteCharacteristic {
  private char: any;
  private chunks: Map<string, Buffer[]> = new Map();

  constructor(bleno: any, db: Database, notifyChar: NotifyCharacteristic) {
    const self = this;
    this.char = new bleno.Characteristic({
      uuid: WRITE_CHAR_UUID,
      properties: ['writeWithoutResponse', 'write'],
      onWriteRequest(
        data: Buffer,
        _offset: number,
        _withoutResponse: boolean,
        callback: (result: number) => void
      ) {
        try {
          if (data.length < 2) {
            callback(bleno.Characteristic.RESULT_INVALID_ATTRIBUTE_LENGTH);
            return;
          }
          const seq = data[0];
          const total = data[1];
          const payload = data.slice(2);

          const sessionKey = seq === 0
            ? `session_${Date.now()}`
            : self.getActiveSession();

          if (seq === 0) {
            self.chunks.set(sessionKey, [payload]);
          } else {
            const existing = self.chunks.get(sessionKey) || [];
            existing[seq] = payload;
            self.chunks.set(sessionKey, existing);
          }

          if (seq === total - 1) {
            const allChunks = self.chunks.get(sessionKey) || [];
            const fullJson = Buffer.concat(allChunks).toString('utf-8');
            self.chunks.delete(sessionKey);
            const record: PatientRecord = JSON.parse(fullJson);
            record.syncStatus = 'pending';
            db.upsertRecord(record);
            console.log(`[ble] Received record: ${record.id}`);
            notifyChar.push(record);
          }

          callback(bleno.Characteristic.RESULT_SUCCESS);
        } catch (err: any) {
          console.error('[ble] Write error:', err.message);
          callback(bleno.Characteristic.RESULT_UNLIKELY_ERROR);
        }
      },
    });
  }

  get bleChar(): any { return this.char; }

  private getActiveSession(): string {
    const keys = Array.from(this.chunks.keys());
    return keys[keys.length - 1] || `session_${Date.now()}`;
  }
}
