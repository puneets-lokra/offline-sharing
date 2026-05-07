"use strict";
// Service worker registration handled by vite-plugin-pwa via registerSW.js
const POLL_INTERVAL_MS = 3000;
const urlParams = new URLSearchParams(window.location.search);
const sessionCode = urlParams.get('session') ?? '';
const explicitBridge = urlParams.get('bridge') ?? '';
/** Resolve which bridge URL to use */
function resolveBridgeUrl() {
    if (explicitBridge)
        return explicitBridge.replace(/\/$/, '');
    const { protocol, hostname, port } = window.location;
    const origin = `${protocol}//${hostname}${port ? ':' + port : ''}`;
    if (!origin.includes('github.io'))
        return origin;
    return 'http://192.168.137.1:8765';
}
const bridgeUrl = resolveBridgeUrl();
/** Fetch patientId from bridge session */
async function fetchSession() {
    if (!sessionCode)
        return null;
    try {
        const res = await fetch(`${bridgeUrl}/session/${sessionCode}`, { signal: AbortSignal.timeout(4000) });
        if (!res.ok)
            return null;
        const { patientId } = await res.json();
        return patientId ?? null;
    }
    catch {
        return null;
    }
}
/** Fetch records for this patient from bridge */
async function fetchRecords(patientId) {
    try {
        const res = await fetch(`${bridgeUrl}/records/${encodeURIComponent(patientId)}`, { signal: AbortSignal.timeout(4000) });
        if (!res.ok)
            return [];
        const { records } = await res.json();
        return records ?? [];
    }
    catch {
        return [];
    }
}
function renderRecords(container, records) {
    if (records.length === 0) {
        container.innerHTML = `<p class="empty">No records yet. Your doctor will add them shortly.</p>`;
        return;
    }
    container.innerHTML = records.map(r => `
    <div class="record-card">
      <div class="record-card-header">
        <span class="record-name">${r.name}</span>
        <span class="record-time">${new Date(r.timestamp).toLocaleString()}</span>
      </div>
      <div class="record-row"><span class="record-label">Patient ID</span><span>${r.patientId}</span></div>
      <div class="record-row"><span class="record-label">Age / Gender</span><span>${r.age} / ${r.gender}</span></div>
      <div class="record-row"><span class="record-label">Doctor</span><span>${r.doctorId}</span></div>
      <div class="record-row"><span class="record-label">Diagnosis</span><span class="record-diagnosis">${r.diagnosis}</span></div>
      ${r.notes ? `<div class="record-row"><span class="record-label">Notes</span><span>${r.notes}</span></div>` : ''}
    </div>
  `).join('');
}
async function main() {
    const app = document.getElementById('app');
    app.innerHTML = `
    <header>
      <h1>Your Health Records</h1>
      <p id="subtitle">Connecting to clinic...</p>
    </header>
    <div id="status-bar" class="status-bar status-bar--checking">Connecting...</div>
    <main id="records-container" class="records-container"></main>
  `;
    const subtitle = document.getElementById('subtitle');
    const statusBar = document.getElementById('status-bar');
    const recordsContainer = document.getElementById('records-container');
    // Resolve patientId
    const patientId = await fetchSession();
    if (!patientId) {
        subtitle.textContent = 'No session found';
        statusBar.textContent = sessionCode
            ? 'Session expired or invalid. Ask your doctor to regenerate the QR code.'
            : 'No session code in URL. Scan the QR code from your doctor.';
        statusBar.className = 'status-bar status-bar--error';
        return;
    }
    subtitle.textContent = `Patient ID: ${patientId}`;
    // Real-time polling loop
    let lastCount = -1;
    async function poll() {
        const records = await fetchRecords(patientId);
        if (records.length !== lastCount) {
            renderRecords(recordsContainer, records);
            lastCount = records.length;
        }
        statusBar.textContent = `Live — last updated ${new Date().toLocaleTimeString()}`;
        statusBar.className = 'status-bar status-bar--ok';
    }
    await poll();
    setInterval(poll, POLL_INTERVAL_MS);
}
main();
