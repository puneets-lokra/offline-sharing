import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { BridgeConfig } from '../config';

/**
 * GET /qr
 * Returns a printable HTML page with two QR codes:
 *   Left  — Wi-Fi join code (WIFI: format, native camera on Android/iOS)
 *   Right — PWA URL with optional doctorId/doctorName query params
 *
 * Query params (optional):
 *   ?doctorId=DR-01&doctorName=Dr+Smith
 *
 * When ngrokUrl is set in config, QR codes use the public URL.
 * Otherwise falls back to the local hotspot IP.
 */
export function qrRouter(config: BridgeConfig): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    const { doctorId = '', doctorName = '' } = req.query as Record<string, string>;

    // Resolve base URL — ngrok takes priority over local hotspot
    const baseUrl = config.ngrokUrl
      ? config.ngrokUrl.replace(/\/$/, '')
      : `http://192.168.137.1:${config.port}`;

    // PWA URL with doctor context embedded as query params
    const params = new URLSearchParams();
    if (doctorId)   params.set('doctorId',   doctorId);
    if (doctorName) params.set('doctorName', doctorName);
    const pwaUrl = params.toString() ? `${baseUrl}?${params}` : baseUrl;

    // Wi-Fi join QR (WIFI: format — read by native phone camera)
    const wifiString = `WIFI:S:${config.hotspot.ssid};T:WPA;P:${config.hotspot.password};;`;

    try {
      const [wifiQR, pwaQR] = await Promise.all([
        QRCode.toDataURL(wifiString,  { width: 300, margin: 2, color: { dark: '#1a1a2e', light: '#ffffff' } }),
        QRCode.toDataURL(pwaUrl,      { width: 300, margin: 2, color: { dark: '#1a73e8', light: '#ffffff' } }),
      ]);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(buildHtml({ wifiQR, pwaQR, pwaUrl, wifiString, config, doctorId, doctorName }));
    } catch (err: any) {
      res.status(500).json({ ok: false, error: 'QR generation failed', detail: err.message });
    }
  });

  return router;
}

interface HtmlParams {
  wifiQR: string;
  pwaQR: string;
  pwaUrl: string;
  wifiString: string;
  config: BridgeConfig;
  doctorId: string;
  doctorName: string;
}

function buildHtml(p: HtmlParams): string {
  const doctorLine = p.doctorId
    ? `<p class="doctor-line">Doctor: <strong>${esc(p.doctorName || p.doctorId)}</strong> &nbsp;|&nbsp; ID: <strong>${esc(p.doctorId)}</strong></p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>ClinicBridge — Patient QR</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f0f4f8; display: flex; flex-direction: column; align-items: center; min-height: 100vh; padding: 2rem 1rem; }
    .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,.1); padding: 2rem; max-width: 720px; width: 100%; }
    h1 { font-size: 1.6rem; color: #1a73e8; margin-bottom: 0.25rem; text-align: center; }
    .subtitle { text-align: center; color: #555; font-size: 0.95rem; margin-bottom: 0.5rem; }
    .doctor-line { text-align: center; color: #333; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .qr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 1.5rem; }
    @media (max-width: 500px) { .qr-grid { grid-template-columns: 1fr; } }
    .qr-box { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
    .step { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; font-size: 0.85rem; font-weight: 700; color: #fff; flex-shrink: 0; }
    .step-1 { background: #34a853; }
    .step-2 { background: #1a73e8; }
    .qr-label { font-size: 1rem; font-weight: 700; color: #222; text-align: center; display: flex; align-items: center; gap: 0.5rem; }
    .qr-sub { font-size: 0.78rem; color: #666; text-align: center; line-height: 1.4; }
    img.qr { border-radius: 8px; border: 2px solid #e0e0e0; }
    .divider { border: none; border-top: 1px solid #e0e0e0; margin: 1.5rem 0; }
    .instructions { font-size: 0.85rem; color: #444; line-height: 1.7; }
    .instructions li { margin-left: 1.25rem; }
    .url-box { background: #f0f4f8; border-radius: 6px; padding: 0.5rem 0.75rem; font-size: 0.78rem; font-family: monospace; color: #1a73e8; word-break: break-all; margin-top: 0.5rem; text-align: center; }
    .print-btn { display: block; margin: 1.5rem auto 0; padding: 0.65rem 2rem; background: #1a73e8; color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; }
    @media print { .print-btn { display: none; } body { background: #fff; } .card { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="card">
    <h1>Patient Check-In</h1>
    <p class="subtitle">Scan to submit your details — no app required</p>
    ${doctorLine}

    <div class="qr-grid">
      <div class="qr-box">
        <div class="qr-label"><span class="step step-1">1</span> Join Wi-Fi</div>
        <img class="qr" src="${p.wifiQR}" width="220" height="220" alt="Wi-Fi QR"/>
        <p class="qr-sub">Scan with your phone camera to connect to <strong>${esc(p.config.hotspot.ssid)}</strong> Wi-Fi</p>
      </div>

      <div class="qr-box">
        <div class="qr-label"><span class="step step-2">2</span> Open Form</div>
        <img class="qr" src="${p.pwaQR}" width="220" height="220" alt="PWA QR"/>
        <p class="qr-sub">Scan to open the patient form — fill in your details and submit</p>
        <div class="url-box">${esc(p.pwaUrl)}</div>
      </div>
    </div>

    <hr class="divider"/>
    <ul class="instructions">
      <li>Point your phone camera at <strong>Step 1</strong> to join the clinic Wi-Fi (no internet needed)</li>
      <li>Then scan <strong>Step 2</strong> to open the form in your browser</li>
      <li>Fill in your name, age, and reason for visit, then tap <strong>Submit</strong></li>
      <li>The doctor will see your record appear on their screen</li>
    </ul>

    <button class="print-btn" onclick="window.print()">Print this page</button>
  </div>
</body>
</html>`;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
