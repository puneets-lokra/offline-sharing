import QRCode from 'qrcode';

export interface QRPanelConfig {
  /** Public bridge URL — embedded in QR as ?bridge= param for the phone to sync to */
  bridgeUrl: string;
  /** Local bridge URL — used by dashboard to POST /session (always localhost) */
  localBridgeUrl: string;
  /** GitHub Pages URL — if set, QR points here with ?session=&bridge= */
  githubPagesUrl?: string;
  /** Wi-Fi SSID for the WiFi join QR */
  ssid: string;
  /** Wi-Fi password for the WiFi join QR */
  password: string;
}

/**
 * QRPanel — shown after doctor saves a record.
 *
 * Shows TWO QR codes side by side:
 *   Step 1: Scan to join ClinicBridge WiFi (WIFI: format)
 *   Step 2: Scan to open patient records on phone
 *
 * Patient scans Step 1 first (joins bridge WiFi), then Step 2 (opens their records).
 * Records update in real-time as doctor edits.
 */
export function QRPanel(cfg: QRPanelConfig): {
  el: HTMLElement;
  showForPatient: (patientId: string) => Promise<void>;
  hide: () => void;
} {
  const el = document.createElement('div');
  el.className = 'qr-panel';
  el.style.display = 'none';

  el.innerHTML = `
    <div class="qr-panel-inner">
      <div class="qr-panel-header">
        <span id="qr-patient-label" class="qr-patient-label"></span>
        <button id="qr-close-btn" class="qr-close-btn">✕ Close</button>
      </div>
      <div class="qr-grid">
        <div class="qr-box">
          <div class="qr-step-label"><span class="qr-step qr-step--1">1</span> Join Clinic WiFi</div>
          <canvas id="qr-wifi-canvas"></canvas>
          <p class="qr-hint">Scan with camera to join <strong>${cfg.ssid}</strong></p>
        </div>
        <div class="qr-box">
          <div class="qr-step-label"><span class="qr-step qr-step--2">2</span> Open Your Records</div>
          <canvas id="qr-patient-canvas"></canvas>
          <p class="qr-hint">Scan to view your records — updates live as doctor adds notes</p>
          <div class="qr-url-box" id="qr-url-display"></div>
        </div>
      </div>
      <p class="qr-instructions">Patient scans Step 1 to join the clinic network, then Step 2 to open their records on their phone.</p>
    </div>
  `;

  el.querySelector('#qr-close-btn')!.addEventListener('click', () => {
    el.style.display = 'none';
  });

  const wifiCanvas   = el.querySelector<HTMLCanvasElement>('#qr-wifi-canvas')!;
  const patientCanvas = el.querySelector<HTMLCanvasElement>('#qr-patient-canvas')!;
  const patientLabel = el.querySelector<HTMLElement>('#qr-patient-label')!;
  const urlDisplay   = el.querySelector<HTMLElement>('#qr-url-display')!;

  // Pre-render the WiFi QR immediately (it never changes)
  QRCode.toCanvas(wifiCanvas, `WIFI:S:${cfg.ssid};T:WPA;P:${cfg.password};;`, {
    width: 220, margin: 2,
    color: { dark: '#1a2e1a', light: '#ffffff' },
  }).catch(() => {});

  const showForPatient = async (patientId: string) => {
    patientLabel.textContent = `Patient: ${patientId}`;
    el.style.display = 'block';

    try {
      // Create session on bridge for this patientId
      const res = await fetch(`${cfg.localBridgeUrl}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      });
      if (!res.ok) throw new Error(`Bridge returned ${res.status}`);
      const { code } = await res.json();

      // Build patient URL
      const pwaUrl = cfg.githubPagesUrl
        ? `${cfg.githubPagesUrl}?session=${code}&bridge=${encodeURIComponent(cfg.bridgeUrl)}`
        : `${cfg.bridgeUrl}?session=${code}`;

      await QRCode.toCanvas(patientCanvas, pwaUrl, {
        width: 220, margin: 2,
        color: { dark: '#1a1a73', light: '#ffffff' },
      });

      urlDisplay.textContent = pwaUrl;
    } catch (err: any) {
      patientLabel.textContent = `Error: ${err.message}`;
    }
  };

  return {
    el,
    showForPatient,
    hide: () => { el.style.display = 'none'; },
  };
}
