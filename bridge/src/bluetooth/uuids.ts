/**
 * BLE UUIDs for the ClinicBridge GATT service.
 * Custom 128-bit UUIDs — safe to use for private services.
 */
export const SERVICE_UUID        = '12345678123412341234123456789abc';
export const WRITE_CHAR_UUID     = 'aaaaaaaa111111111111aaaaaaaaaaaa'; // Client 1 → Bridge
export const NOTIFY_CHAR_UUID    = 'bbbbbbbb222222222222bbbbbbbbbbbb'; // Bridge → Client 2 (push)
export const READ_CHAR_UUID      = 'cccccccc333333333333cccccccccccc'; // Client 2 → Bridge (pull)
