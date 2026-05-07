import { READ_CHAR_UUID } from './uuids';
import { Database } from '../storage/sqlite';

export class ReadCharacteristic {
  private char: any;

  constructor(bleno: any, db: Database) {
    this.char = new bleno.Characteristic({
      uuid: READ_CHAR_UUID,
      properties: ['read'],
      onReadRequest(_offset: number, callback: (result: number, data?: Buffer) => void) {
        try {
          const records = db.getAllRecords();
          const buf = Buffer.from(JSON.stringify({ ok: true, records }), 'utf-8');
          callback(bleno.Characteristic.RESULT_SUCCESS, buf);
        } catch {
          callback(bleno.Characteristic.RESULT_UNLIKELY_ERROR);
        }
      },
    });
  }

  get bleChar(): any { return this.char; }
}
