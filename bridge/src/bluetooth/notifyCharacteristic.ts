import { NOTIFY_CHAR_UUID } from './uuids';

export class NotifyCharacteristic {
  private char: any;
  private updateValueCallback: ((data: Buffer) => void) | null = null;

  constructor(bleno: any) {
    const self = this;
    this.char = new bleno.Characteristic({
      uuid: NOTIFY_CHAR_UUID,
      properties: ['notify'],
      descriptors: [new bleno.Descriptor({ uuid: '2902', value: Buffer.alloc(2) })],
      onSubscribe(_maxValueSize: number, cb: (data: Buffer) => void) {
        console.log('[ble] Client 2 subscribed to NOTIFY');
        self.updateValueCallback = cb;
      },
      onUnsubscribe() {
        console.log('[ble] Client 2 unsubscribed');
        self.updateValueCallback = null;
      },
    });
  }

  get bleChar(): any { return this.char; }

  push(record: object): void {
    if (!this.updateValueCallback) return;
    const buf = Buffer.from(JSON.stringify(record), 'utf-8');
    this.updateValueCallback(buf);
  }
}
