import QRCode from 'qrcode';

export interface QRPanelConfig {
  /** Wi-Fi SSID — embedded in the Wi-Fi QR */
  ssid: string;
  /** Wi-Fi password — embedded in the Wi-Fi QR */
  password: string;
  /**
   * Public base URL the patient's phone will use to reach the PWA.
   * In ngrok mode: https://abc123.ngrok-free.app
   * In hotspot mode: http://192.168.137.1:8765
   * In LAN test mode: http://192.168.x.x:8765
   */
  pwaBaseUrl: string;
}

/**
 * Returns true only when the URL is the real clinic hotspot IP.
 * In that case the Wi-Fi QR is shown because doctors need patients
 * to join the hotspot first.
 * In LAN/ngrok mode the Wi-Fi QR is hidden — phone is already connected.
 */
function isHotspotMode(url: string): boolean {
  return url.includes('192.168.137.1');
}

/**
 * QRPanel — renders the doctor's QR generation UI.
 *
 * Layout:
 *   [ Doctor ID input ]  [ Doctor Name input ]  [ Generate button ]
 *   ─────────────────────────────────────────────────────────────
 *   [ Wi-Fi QR — Step 1 ]     [ PWA URL QR — Step 2 ]
 *   [ instructions ]
 *
 * The panel is hidden by default; call show() / hide() to toggle.
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

  const hotspot = isHotspotMode(cfg.pwaBaseUrl);

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
      ${!hotspot ? `<p class="qr-mode-notice">Phone must be on the same Wi-Fi as this PC</p>` : ''}
      <div id="qr-output" class="qr-output" style="display:none">
        <div class="qr-grid" id="qr-grid">
          ${hotspot ? `
          <div class="qr-box" id="qr-wifi-box">
            <div class="qr-step-label"><span class="qr-step qr-step--1">1</span> Join Wi-Fi</div>
            <canvas id="qr-wifi-canvas"></canvas>
            <p class="qr-hint">Scan with phone camera to join <strong id="qr-ssid-label"></strong></p>
          </div>` : ''}
          <div class="qr-box">
            <div class="qr-step-label">
              ${hotspot ? '<span class="qr-step qr-step--2">2</span>' : ''}
              Scan to Open Patient Form
            </div>
            <canvas id="qr-pwa-canvas"></canvas>
            <p class="qr-hint">Scan with phone camera — Doctor ID is pre-filled automatically</p>
            <div class="qr-url-box" id="qr-url-display"></div>
          </div>
        </div>
        <p class="qr-instructions">
          ${hotspot
            ? 'Patient scans Step 1 first (joins Wi-Fi), then Step 2 (opens form).'
            : 'Patient scans the QR code to open the form. Make sure their phone is on the same Wi-Fi network.'}
        </p>
        <button id="qr-print-btn" class="qr-print-btn" onclick="window.print()">Print</button>
      </div>
    </div>
  `;

  const doctorIdInput   = el.querySelector<HTMLInputElement>('#qr-doctor-id')!;
  const doctorNameInput = el.querySelector<HTMLInputElement>('#qr-doctor-name')!;
  const generateBtn     = el.querySelector<HTMLButtonElement>('#qr-generate-btn')!;
  const output          = el.querySelector<HTMLElement>('#qr-output')!;
  const wifiCanvas      = el.querySelector<HTMLCanvasElement>('#qr-wifi-canvas')!;
  const pwaCanvas       = el.querySelector<HTMLCanvasElement>('#qr-pwa-canvas')!;
  const ssidLabel       = el.querySelector<HTMLElement>('#qr-ssid-label')!;
  const urlDisplay      = el.querySelector<HTMLElement>('#qr-url-display')!;

  generateBtn.addEventListener('click', async () => {
    const doctorId   = doctorIdInput.value.trim();
    const doctorName = doctorNameInput.value.trim();

    if (!doctorId) {
      doctorIdInput.focus();
      doctorIdInput.style.borderColor = '#ea4335';
      return;
    }
    doctorIdInput.style.borderColor = '';

    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    try {
      // Build PWA URL with doctor context
      // pwaBaseUrl may already contain ?bridge=... so append with & not ?
      const separator = cfg.pwaBaseUrl.includes('?') ? '&' : '?';
      const doctorParams = new URLSearchParams({ doctorId });
      if (doctorName) doctorParams.set('doctorName', doctorName);
      const pwaUrl = `${cfg.pwaBaseUrl}${separator}${doctorParams}`;

      // Wi-Fi QR (WIFI: format — native camera reads this)
      const wifiString = `WIFI:S:${cfg.ssid};T:WPA;P:${cfg.password};;`;

      await Promise.all([
        QRCode.toCanvas(wifiCanvas, wifiString, {
          width: 240,
          margin: 2,
          color: { dark: '#1a2e1a', light: '#ffffff' },
        }),
        QRCode.toCanvas(pwaCanvas, pwaUrl, {
          width: 240,
          margin: 2,
          color: { dark: '#1a1a73', light: '#ffffff' },
        }),
      ]);

      ssidLabel.textContent = cfg.ssid;
      urlDisplay.textContent = pwaUrl;
      output.style.display = 'block';
    } catch (err: any) {
      console.error('[qr] Generation failed:', err);
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
