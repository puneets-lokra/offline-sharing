import QRCode from 'qrcode';

export interface QRPanelConfig {
  /** Public bridge URL — used to POST /session and as ?bridge= param */
  bridgeUrl: string;
  /**
   * If set, QR points to GitHub Pages with ?session=&bridge= params.
   * If empty, QR points directly to the bridge URL.
   */
  githubPagesUrl?: string;
}

/**
 * QRPanel — renders the doctor's QR generation UI.
 *
 * Flow:
 *   Doctor enters ID + Name → clicks Generate
 *   → POST /session to bridge → gets back a short code (e.g. "A3F9")
 *   → QR encodes: <bridgeUrl>?session=A3F9
 *   → Patient scans → PWA loads → fetches GET /session/A3F9 → doctor context pre-filled
 *
 * No doctor data in the URL. Session stored on the bridge, expires after 8h.
 */
export function QRPanel(cfg: QRPanelConfig): {
  el: HTMLElement;
  show: () => void;
  hide: () => void;
  toggle: () => void;
} {
  const el = document.createElement('div');
  el.className = 'qr-panel';
  el.style.display = 'none';

  el.innerHTML = `
    <div class="qr-panel-inner">
      <div class="qr-form-row">
        <div class="qr-field">
          <label for="qr-doctor-id">Doctor ID</label>
          <input id="qr-doctor-id" type="text" placeholder="e.g. DR-01" />
        </div>
        <div class="qr-field">
          <label for="qr-doctor-name">Doctor Name</label>
          <input id="qr-doctor-name" type="text" placeholder="e.g. Dr. Smith" />
        </div>
        <button id="qr-generate-btn" class="qr-generate-btn">Generate QR</button>
      </div>
      <div id="qr-error" class="qr-error" style="display:none"></div>
      <div id="qr-output" class="qr-output" style="display:none">
        <div class="qr-box">
          <div class="qr-step-label">Scan to Open Patient Form</div>
          <canvas id="qr-pwa-canvas"></canvas>
          <p class="qr-hint">Patient scans this QR — doctor info is pre-filled automatically</p>
          <div class="qr-url-box" id="qr-url-display"></div>
        </div>
        <button id="qr-print-btn" class="qr-print-btn" onclick="window.print()">Print</button>
      </div>
    </div>
  `;

  const doctorIdInput = el.querySelector<HTMLInputElement>('#qr-doctor-id')!;
  const doctorNameInput = el.querySelector<HTMLInputElement>('#qr-doctor-name')!;
  const generateBtn = el.querySelector<HTMLButtonElement>('#qr-generate-btn')!;
  const output = el.querySelector<HTMLElement>('#qr-output')!;
  const errorEl = el.querySelector<HTMLElement>('#qr-error')!;
  const pwaCanvas = el.querySelector<HTMLCanvasElement>('#qr-pwa-canvas')!;
  const urlDisplay = el.querySelector<HTMLElement>('#qr-url-display')!;

  generateBtn.addEventListener('click', async () => {
    const doctorId = doctorIdInput.value.trim();
    const doctorName = doctorNameInput.value.trim();

    if (!doctorId) {
      doctorIdInput.focus();
      doctorIdInput.style.borderColor = '#ea4335';
      return;
    }
    doctorIdInput.style.borderColor = '';
    errorEl.style.display = 'none';
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    try {
      // POST doctor context to bridge, get back a short session code
      const res = await fetch(`${cfg.bridgeUrl}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId, doctorName }),
      });

      if (!res.ok) throw new Error(`Bridge returned ${res.status}`);
      const { code } = await res.json();

      // Build QR URL:
      // - If GitHub Pages URL configured → point there with ?session=&bridge=
      // - Otherwise → point directly to bridge with ?session=
      const pwaUrl = cfg.githubPagesUrl
        ? `${cfg.githubPagesUrl}?session=${code}&bridge=${encodeURIComponent(cfg.bridgeUrl)}`
        : `${cfg.bridgeUrl}?session=${code}`;

      await QRCode.toCanvas(pwaCanvas, pwaUrl, {
        width: 280,
        margin: 2,
        color: { dark: '#1a1a73', light: '#ffffff' },
      });

      urlDisplay.textContent = pwaUrl;
      output.style.display = 'block';
    } catch (err: any) {
      console.error('[qr] Generation failed:', err);
      errorEl.textContent = `Failed to create session: ${err.message}. Is the bridge running?`;
      errorEl.style.display = 'block';
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate QR';
    }
  });

  return {
    el,
    show:   () => { el.style.display = 'block'; },
    hide:   () => { el.style.display = 'none'; },
    toggle: () => { el.style.display = el.style.display === 'none' ? 'block' : 'none'; },
  };
}
