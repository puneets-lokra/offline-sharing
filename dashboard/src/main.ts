import { HttpPoller, PatientRecord } from './sync/httpPoller';
import { BLEReceiver } from './sync/bleReceiver';
import { RecordTable } from './ui/RecordTable';
import { QRPanel } from './ui/QRPanel';
import { PatientForm } from './ui/PatientForm';

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
  tableContainer.replaceChildren(RecordTable(sorted));
}

function updateStats(): void {
  const all = Array.from(recordMap.values());
  totalEl.textContent   = String(all.length);
  pendingEl.textContent = String(all.filter((r) => r.syncStatus === 'pending').length);
  syncedEl.textContent  = String(all.filter((r) => r.syncStatus === 'synced').length);
}

async function fetchQRConfig(): Promise<{ bridgeUrl: string; localBridgeUrl: string; githubPagesUrl: string; ssid: string; password: string }> {
  const candidates = ['http://localhost:8765', 'http://192.168.137.1:8765'];
  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/qr-config`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const cfg = await res.json();
        return { ...cfg, localBridgeUrl: base };
      }
    } catch { /* try next */ }
  }
  return { bridgeUrl: 'http://192.168.137.1:8765', localBridgeUrl: 'http://localhost:8765', githubPagesUrl: '', ssid: 'ClinicBridge', password: 'clinic1234' };
}

async function main() {
  const app = document.getElementById('app')!;

  app.innerHTML = `
    <header>
      <h1>Clinic Dashboard</h1>
      <p>Doctor view — add patient records and share via QR</p>
    </header>

    <div class="connection-bar">
      <button id="http-btn" class="conn-btn conn-btn--http">Stop Polling</button>
      <span id="http-status" class="conn-status">Polling...</span>
      ${BLEReceiver.isSupported() ? `
        <button id="ble-btn" class="conn-btn conn-btn--ble">Connect Bluetooth</button>
        <span id="ble-status" class="conn-status">Disconnected</span>
      ` : ''}
    </div>

    <div id="qr-panel-container"></div>
    <div id="form-container"></div>

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

  // --- Fetch config & setup QR panel ---
  const qrCfg = await fetchQRConfig();
  const qrPanel = QRPanel(qrCfg);
  document.getElementById('qr-panel-container')!.appendChild(qrPanel.el);

  // --- Patient form (doctor fills this) ---
  const formEl = PatientForm(qrCfg.localBridgeUrl, (patientId, record) => {
    upsertRecord(record as PatientRecord);
    // Auto-show QR panel for this patient after saving
    qrPanel.showForPatient(patientId);
  });
  document.getElementById('form-container')!.appendChild(formEl);

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
      httpBtn.textContent = 'Start Polling';
      httpStatusEl.textContent = 'Stopped';
      httpStatusEl.className = 'conn-status';
      polling = false;
    } else {
      poller.start();
      httpBtn.textContent = 'Stop Polling';
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
        bleBtn.textContent = status === 'subscribed' ? 'Disconnect Bluetooth' : 'Connect Bluetooth';
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
        bleBtn.textContent = 'Connect Bluetooth';
      }
    });
  }
}

main();
