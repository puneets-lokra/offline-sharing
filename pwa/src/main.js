import { RecordForm } from './ui/RecordForm';
import { RecordList } from './ui/RecordList';
import { SyncStatus } from './ui/SyncStatus';
import { getPendingRecords, markRecordsSynced } from './db/indexeddb';
import { isBridgeReachable, flushRecords } from './sync/bridgeSync';
import { BLESync } from './sync/bleSync';
const SYNC_POLL_INTERVAL_MS = 5000;
// Parse doctor context from QR code URL params
const urlParams = new URLSearchParams(window.location.search);
const qrDoctorId = urlParams.get('doctorId') ?? '';
const qrDoctorName = urlParams.get('doctorName') ?? '';
const isPatientMode = qrDoctorId.length > 0;
// Single shared BLE instance
const bleSync = new BLESync((status) => {
    console.log('[ble-status]', status);
});
async function renderRecordList(container) {
    const existing = container.querySelector('.record-list');
    if (existing)
        existing.remove();
    const list = await RecordList();
    container.appendChild(list);
}
/** Send all pending IndexedDB records via BLE */
async function bleSendPending(listSection) {
    const pending = await getPendingRecords();
    if (pending.length === 0)
        return { sent: 0, failed: 0 };
    const syncedIds = [];
    for (const record of pending) {
        try {
            await bleSync.sendRecord(record);
            syncedIds.push(record.id);
        }
        catch {
            // continue — will retry on next attempt
        }
    }
    if (syncedIds.length > 0) {
        await markRecordsSynced(syncedIds);
        await renderRecordList(listSection);
    }
    return { sent: syncedIds.length, failed: pending.length - syncedIds.length };
}
async function main() {
    const app = document.getElementById('app');
    // Header
    const header = document.createElement('header');
    header.innerHTML = `
    <div class="header-inner">
      <h1>${isPatientMode ? 'Patient Check-In' : 'Clinic Records'}</h1>
      <p class="subtitle">${isPatientMode
        ? `Assigned to <strong>${qrDoctorName || qrDoctorId}</strong>`
        : 'Offline patient data capture'}</p>
    </div>
  `;
    app.appendChild(header);
    // Sync status banner
    const { el: syncEl, update: updateSync } = SyncStatus();
    app.appendChild(syncEl);
    // BLE connect button (only shown if Web Bluetooth available)
    if (BLESync.isSupported()) {
        const bleBar = document.createElement('div');
        bleBar.className = 'ble-bar';
        bleBar.innerHTML = `
      <button id="ble-btn" class="ble-btn">Connect via Bluetooth</button>
      <span id="ble-status" class="ble-status">Disconnected</span>
    `;
        app.appendChild(bleBar);
        const bleBtn = bleBar.querySelector('#ble-btn');
        const bleStatusEl = bleBar.querySelector('#ble-status');
        bleBtn.addEventListener('click', async () => {
            if (bleSync.isConnected) {
                bleSync.disconnect();
                bleBtn.textContent = 'Connect via Bluetooth';
                bleStatusEl.textContent = 'Disconnected';
                bleStatusEl.className = 'ble-status';
                return;
            }
            bleBtn.disabled = true;
            bleBtn.textContent = 'Connecting...';
            try {
                await bleSync.connect();
                bleBtn.textContent = 'Disconnect Bluetooth';
                bleStatusEl.textContent = 'Connected';
                bleStatusEl.className = 'ble-status ble-status--connected';
                // Immediately flush pending records over BLE after connect
                const listSection = document.querySelector('.section:last-of-type');
                const { sent } = await bleSendPending(listSection);
                if (sent > 0) {
                    updateSync({ status: 'synced', count: sent });
                }
            }
            catch (err) {
                bleBtn.textContent = 'Connect via Bluetooth';
                bleStatusEl.textContent = `BLE error: ${err.message}`;
                bleStatusEl.className = 'ble-status ble-status--error';
            }
            finally {
                bleBtn.disabled = false;
            }
        });
    }
    // Main content
    const mainEl = document.createElement('main');
    app.appendChild(mainEl);
    // Record form
    const formSection = document.createElement('section');
    formSection.className = 'section';
    formSection.appendChild(RecordForm(async () => {
        await renderRecordList(listSection);
        // If BLE is connected, send the newly added record immediately
        if (bleSync.isConnected) {
            await bleSendPending(listSection);
        }
    }, { doctorId: qrDoctorId, doctorName: qrDoctorName }));
    mainEl.appendChild(formSection);
    // Record list
    const listSection = document.createElement('section');
    listSection.className = 'section';
    mainEl.appendChild(listSection);
    await renderRecordList(listSection);
    // HTTP sync polling loop (runs alongside BLE — whichever connects first wins)
    async function syncLoop() {
        // Skip HTTP poll if BLE is actively sending
        if (bleSync.status === 'sending')
            return;
        updateSync({ status: 'checking' });
        const reachable = await isBridgeReachable();
        if (!reachable) {
            updateSync({ status: 'offline' });
            return;
        }
        const pending = await getPendingRecords();
        if (pending.length === 0) {
            updateSync({ status: 'synced', count: 0 });
            return;
        }
        updateSync({ status: 'reachable', pendingCount: pending.length });
        await new Promise((r) => setTimeout(r, 500));
        updateSync({ status: 'syncing', total: pending.length, done: 0 });
        try {
            const syncedIds = await flushRecords(pending);
            await markRecordsSynced(syncedIds);
            if (syncedIds.length > 0) {
                await renderRecordList(listSection);
            }
            if (syncedIds.length < pending.length) {
                updateSync({
                    status: 'error',
                    message: `${pending.length - syncedIds.length} record(s) failed to send`,
                });
            }
            else {
                updateSync({ status: 'synced', count: syncedIds.length });
            }
        }
        catch (err) {
            updateSync({ status: 'error', message: err.message });
        }
    }
    await syncLoop();
    setInterval(syncLoop, SYNC_POLL_INTERVAL_MS);
}
main();
