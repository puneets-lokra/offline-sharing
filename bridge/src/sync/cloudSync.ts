import https from 'https';
import http from 'http';
import { Database } from '../storage/sqlite';

export interface CloudApiConfig {
  url: string;
  syncIntervalSeconds: number;
}

/**
 * CloudSync periodically checks for internet connectivity and pushes
 * all pending SQLite records to the configured cloud REST API.
 */
export class CloudSync {
  private db: Database;
  private config: CloudApiConfig;
  private timer: NodeJS.Timeout | null = null;
  private online = false;
  private lastSyncAt: string | null = null;

  constructor(db: Database, config: CloudApiConfig) {
    this.db = db;
    this.config = config;
  }

  /** Start polling loop */
  start(): void {
    console.log(`[cloudSync] Sync agent started — interval: ${this.config.syncIntervalSeconds}s`);
    this.tick();
    this.timer = setInterval(() => this.tick(), this.config.syncIntervalSeconds * 1000);
  }

  /** Stop polling loop */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[cloudSync] Sync agent stopped');
  }

  isOnline(): boolean {
    return this.online;
  }

  getLastSyncTime(): string | null {
    return this.lastSyncAt;
  }

  /** Check connectivity and push pending records if online */
  private async tick(): Promise<void> {
    const reachable = await this.checkInternet();
    this.online = reachable;

    if (!reachable) {
      return;
    }

    const pending = this.db.getPendingRecords();
    if (pending.length === 0) {
      return;
    }

    console.log(`[cloudSync] Internet available. Pushing ${pending.length} pending record(s)...`);

    try {
      const response = await this.postToCloud(pending);
      if (response.ok) {
        const ids = pending.map((r) => r.id);
        this.db.markSynced(ids);
        this.lastSyncAt = new Date().toISOString();
        console.log(`[cloudSync] Successfully synced ${ids.length} record(s)`);
      } else {
        console.warn(`[cloudSync] Cloud API returned error: ${response.status}`);
      }
    } catch (err: any) {
      console.warn('[cloudSync] Failed to push to cloud:', err.message);
    }
  }

  /**
   * Checks reachability by making a HEAD/GET request to the configured cloud API health endpoint.
   * Works in local dev (localhost:3001) and in production (real HTTPS URL).
   * This is more reliable than probing dns.google because it validates the actual target.
   */
  private checkInternet(): Promise<boolean> {
    return new Promise((resolve) => {
      const url = new URL(`${this.config.url}/health`);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname,
          method: 'HEAD',
          timeout: 3000,
        },
        (res) => resolve(res.statusCode !== undefined && res.statusCode < 500)
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    });
  }

  /**
   * POSTs an array of patient records to the cloud API endpoint.
   */
  private postToCloud(records: object[]): Promise<{ ok: boolean; status: number }> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify(records);
      const url = new URL(`${this.config.url}/records`);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 10000,
      };

      const req = lib.request(options, (res) => {
        resolve({ ok: res.statusCode !== undefined && res.statusCode < 300, status: res.statusCode ?? 0 });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Cloud API request timed out')); });
      req.write(body);
      req.end();
    });
  }
}
