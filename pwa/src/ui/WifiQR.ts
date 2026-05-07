import QRCode from 'qrcode';

/**
 * WifiQR — fetches Wi-Fi credentials from the bridge and renders
 * a scannable WIFI: QR code so patients can share the hotspot with others.
 *
 * Hidden by default. Call show() after bridge is reachable.
 */
export async function WifiQR(bridgeUrl: string): Promise<HTMLElement | null> {
  try {
    const res = await fetch(`${bridgeUrl}/qr-config`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const { ssid, password } = await res.json();
    if (!ssid) return null;

    const el = document.createElement('div');
    el.className = 'wifi-qr-section';
    el.innerHTML = `
      <details class="wifi-qr-details">
        <summary class="wifi-qr-summary">Connect others to this network</summary>
        <div class="wifi-qr-body">
          <canvas id="wifi-qr-canvas"></canvas>
          <p class="wifi-qr-hint">Scan with phone camera to join <strong>${ssid}</strong></p>
        </div>
      </details>
    `;

    // Render QR after inserting into DOM
    requestAnimationFrame(async () => {
      const canvas = el.querySelector<HTMLCanvasElement>('#wifi-qr-canvas');
      if (!canvas) return;
      await QRCode.toCanvas(canvas, `WIFI:S:${ssid};T:WPA;P:${password};;`, {
        width: 200,
        margin: 2,
        color: { dark: '#1a2e1a', light: '#ffffff' },
      });
    });

    return el;
  } catch {
    return null;
  }
}
