import { HttpPoller, PatientRecord } from './sync/httpPoller';
import { BLEReceiver } from './sync/bleReceiver';
import { RecordTable } from './ui/RecordTable';
import { QRPanel } from './ui/QRPanel';

// In-memory record store (keyed by id for deduplication)
const recordMap = new Map<string, PatientRecord>();

let tableContainer: HTMLElement;
let totalEl: HTMLSpanElement;
let pendingEl: HTMLSpanElement;
let syncedEl: HTMLSpanElement;
let httpStatusEl: HTMLSpanElement;
let bleStatusEl: HTMLSpanElement;

function upsertRecord(record: PatientRecord): void {
  recordMap.set(record.id, record);
  renderTable();
  updateStats();
}

function setRecords(records: PatientRecord[]): void {
  records.forEach((r) => recordMap.set(r.id, r));
  renderTable();
  updateStats();
}

function renderTable(): void {
  const sorted = Array.from(recordMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const newTable = RecordTable(sorted);
  tableContainer.replaceChildren(newTable);
}

function updateStats(): void {
  const all = Array.from(recordMap.values());
  totalEl.textContent   = String(all.length);
  pendingEl.textContent = String(all.filter((r) => r.syncStatus === 'pending').length);
  syncedEl.textContent  = String(all.filter((r) => r.syncStatus === 'synced').length);
}

/**
 * Fetches QR config from the bridge (pwaBaseUrl, ssid, password).
 * Falls back to sensible defaults if bridge not reachable yet.
 */
async function fetchQRConfig(): Promise<{ bridgeUrl: string }> {
  const candidates = ['http://localhost:8765', 'http://192.168.137.1:8765'];
  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/qr-config`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return await res.json();
    } catch { /* try next */ }
  }
  return { bridgeUrl: 'http://192.168.137.1:8765' };
}

async function main() {
  const app = document.getElementById('app')!;

  app.innerHTML = `
    <header>
      <h1>Clinic Dashboard</h1>
      <p>Live patient records — received from Doctor PWA via Wi-Fi or Bluetooth</p>
    </header>

    <div class="connection-bar">
      <button id="http-btn" class="conn-btn conn-btn--http">Stop HTTP Polling</button>
      <span id="http-status" class="conn-status">Polling...</span>
      <button id="qr-btn" class="conn-btn conn-btn--qr">Show Patient QR</button>
      ${BLEReceiver.isSupported() ? `
        <button id="ble-btn" class="conn-btn conn-btn--ble">Connect via Bluetooth</button>
        <span id="ble-status" class="conn-status">Disconnected</span>
      ` : ''}
    </div>

    <div id="qr-panel-container"></div>

    <div class="stats-bar">
      <div class="stat"><span id="stat-total" class="stat-val">0</span>Total</div>
      <div class="stat"><span id="stat-pending" class="stat-val">0</span>Pending</div>
      <div class="stat"><span id="stat-synced" class="stat-val">0</span>Synced</div>
    </div>

    <main id="table-container"></main>
  `;

  tableContainer = document.getElementById('table-container')!;
  totalEl        = document.getElementById('stat-total')   as HTMLSpanElement;
  pendingEl      = document.getElementById('stat-pending') as HTMLSpanElement;
  syncedEl       = document.getElementById('stat-synced')  as HTMLSpanElement;
  httpStatusEl   = document.getElementById('http-status')  as HTMLSpanElement;

  renderTable();
  updateStats();

  // --- QR Panel ---
  const qrCfg = await fetchQRConfig();
  const qrPanel = QRPanel(qrCfg);
  document.getElementById('qr-panel-container')!.appendChild(qrPanel.el);

  const qrBtn = document.getElementById('qr-btn') as HTMLButtonElement;
  qrBtn.addEventListener('click', () => {
    qrPanel.toggle();
    qrBtn.textContent = qrPanel.el.style.display === 'none' ? 'Show Patient QR' : 'Hide Patient QR';
  });

  // --- HTTP Polling ---
  const poller = new HttpPoller(
    (records) => setRecords(records),
    (status) => {
      httpStatusEl.textContent = status === 'connected' ? 'Connected' : status === 'polling' ? 'Polling...' : 'Offline';
      httpStatusEl.className = `conn-status ${status === 'connected' ? 'conn-status--ok' : status === 'offline' ? 'conn-status--error' : ''}`;
    }
  );

  const httpBtn = document.getElementById('http-btn') as HTMLButtonElement;
  let polling = true;
  poller.start();

  httpBtn.addEventListener('click', () => {
    if (polling) {
      poller.stop();
      httpBtn.textContent = 'Start HTTP Polling';
      httpStatusEl.textContent = 'Stopped';
      httpStatusEl.className = 'conn-status';
      polling = false;
    } else {
      poller.start();
      httpBtn.textContent = 'Stop HTTP Polling';
      polling = true;
    }
  });

  // --- BLE Receive ---
  if (BLEReceiver.isSupported()) {
    bleStatusEl = document.getElementById('ble-status') as HTMLSpanElement;
    const bleBtn = document.getElementById('ble-btn') as HTMLButtonElement;

    const receiver = new BLEReceiver(
      (record) => upsertRecord(record as PatientRecord),
      (status) => {
        bleStatusEl.textContent = status;
        bleStatusEl.className = `conn-status ${status === 'subscribed' ? 'conn-status--ok' : status === 'error' ? 'conn-status--error' : ''}`;
        bleBtn.disabled = false;
        bleBtn.textContent = status === 'subscribed' ? 'Disconnect Bluetooth' : 'Connect via Bluetooth';
      }
    );

    bleBtn.addEventListener('click', async () => {
      if (receiver.status === 'subscribed') { receiver.disconnect(); return; }
      bleBtn.disabled = true;
      bleBtn.textContent = 'Connecting...';
      try {
        await receiver.connect();
      } catch (err: any) {
        bleStatusEl.textContent = `Error: ${err.message}`;
        bleStatusEl.className = 'conn-status conn-status--error';
        bleBtn.disabled = false;
        bleBtn.textContent = 'Connect via Bluetooth';
      }
    });
  }
}

main();
