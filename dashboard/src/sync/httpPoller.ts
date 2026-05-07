/**
 * httpPoller.ts — Dashboard HTTP transport.
 *
 * Polls GET /records on the bridge every N seconds.
 * Falls back automatically if the bridge IP changes.
 */

const CANDIDATES = [
  'http://localhost:8765',
  'http://192.168.137.1:8765',
];

export interface PatientRecord {
  id: string;
  patientId: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  diagnosis: string;
  notes: string;
  doctorId: string;
  timestamp: string;
  syncStatus: 'pending' | 'synced';
}

export class HttpPoller {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private baseUrl: string | null = null;
  private pollMs: number;
  private onRecords: (records: PatientRecord[]) => void;
  private onStatus: (status: 'polling' | 'connected' | 'offline') => void;

  constructor(
    onRecords: (records: PatientRecord[]) => void,
    onStatus: (status: 'polling' | 'connected' | 'offline') => void,
    pollMs = 5000
  ) {
    this.onRecords = onRecords;
    this.onStatus = onStatus;
    this.pollMs = pollMs;
  }

  start(): void {
    this.poll();
    this.intervalId = setInterval(() => this.poll(), this.pollMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async poll(): Promise<void> {
    this.onStatus('polling');

    // Try cached base URL first, then rediscover
    const candidates = this.baseUrl
      ? [this.baseUrl, ...CANDIDATES.filter((c) => c !== this.baseUrl)]
      : CANDIDATES;

    for (const base of candidates) {
      try {
        const res = await fetch(`${base}/records`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) continue;
        const data = await res.json();
        this.baseUrl = base;
        this.onStatus('connected');
        this.onRecords(data.records ?? []);
        return;
      } catch {
        // try next candidate
      }
    }

    this.baseUrl = null;
    this.onStatus('offline');
  }
}
