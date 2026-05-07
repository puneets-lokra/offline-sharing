import fs from 'fs';
import path from 'path';

/** Bridge configuration shape */
export interface BridgeConfig {
  port: number;
  hotspot: {
    ssid: string;
    password: string;
    enabled: boolean;
  };
  cloudApi: {
    url: string;
    syncIntervalSeconds: number;
  };
  db: {
    path: string;
  };
  /**
   * Public ngrok/cloudflare URL for this bridge (e.g. https://abc123.trycloudflare.com).
   * When set, QR codes encode this URL so patients on different networks can reach the PWA.
   * Leave empty to use the local hotspot IP (192.168.137.1) in QR codes.
   */
  ngrokUrl: string;
  /**
   * GitHub Pages URL for the PWA (e.g. https://username.github.io/repo).
   * When set, QR codes point to GitHub Pages with ?bridge=<ngrokUrl> embedded,
   * so the PWA hosted on GitHub Pages knows which bridge to sync to.
   * Leave empty to serve PWA from the bridge itself.
   */
  githubPagesUrl: string;
}

const DEFAULT_CONFIG: BridgeConfig = {
  port: 8765,
  hotspot: {
    ssid: 'ClinicBridge',
    password: 'clinic1234',
    enabled: true,
  },
  cloudApi: {
    url: 'http://localhost:3001',
    syncIntervalSeconds: 30,
  },
  db: {
    path: './data/bridge.db',
  },
  ngrokUrl: '',
  githubPagesUrl: '',
};

/**
 * Loads bridge.config.json from the current working directory.
 * Falls back to defaults for any missing keys.
 */
export function loadConfig(): BridgeConfig {
  const configPath = path.resolve(process.cwd(), 'bridge.config.json');
  if (!fs.existsSync(configPath)) {
    console.warn('[config] bridge.config.json not found, using defaults');
    return DEFAULT_CONFIG;
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (err) {
    console.error('[config] Failed to parse bridge.config.json:', err);
    return DEFAULT_CONFIG;
  }
}
