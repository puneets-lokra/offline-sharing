# Offline Sharing Bridge — Project Instructions

Offline clinic data capture system. Doctors add patient records on a PWA (no internet needed). Records sync to a Windows bridge app via Wi-Fi Direct hotspot. When internet returns, bridge pushes records to cloud API.

## Project Structure

```
offline-sharing/
├── bridge/               # Node.js Windows bridge app → compiles to bridge.exe
│   ├── src/
│   │   ├── index.ts          # Entry point
│   │   ├── config.ts         # Config loader (bridge.config.json)
│   │   ├── hotspot.ts        # Wi-Fi Direct hotspot via netsh wlan
│   │   ├── server.ts         # Express server (serves PWA + API)
│   │   ├── api/
│   │   │   ├── health.ts     # GET /health
│   │   │   ├── status.ts     # GET /status
│   │   │   └── data.ts       # POST /data
│   │   ├── storage/
│   │   │   └── sqlite.ts     # SQLite via better-sqlite3
│   │   └── sync/
│   │       └── cloudSync.ts  # Push pending records to cloud when online
│   ├── bridge.config.json
│   ├── package.json
│   ├── tsconfig.json
│   └── pkg.config.json       # pkg → bridge.exe
├── pwa/                  # PWA — served by bridge, works offline
│   ├── public/
│   │   └── manifest.json
│   ├── src/
│   │   ├── main.ts
│   │   ├── service-worker.ts
│   │   ├── db/indexeddb.ts
│   │   ├── sync/bridgeSync.ts
│   │   ├── api/records.ts
│   │   └── ui/
│   │       ├── RecordForm.ts
│   │       ├── RecordList.ts
│   │       └── SyncStatus.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── cloud-api/            # Simple Node.js REST API (cloud-side receiver)
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/records.ts
│   │   └── db/sqlite.ts
│   └── package.json
├── docs/PRD.md
├── AGENTS.md
└── opencode.json
```

## Tech Stack

- **Bridge**: Node.js 18 + TypeScript + Express + better-sqlite3 + pkg (.exe)
- **PWA**: TypeScript + Vite + IndexedDB (idb) + Service Worker
- **Cloud API**: Node.js + Express + SQLite (swappable for PostgreSQL)
- **Transport**: Wi-Fi Direct via Windows `netsh wlan` hosted network
- **Hotspot IP**: `192.168.137.1` (Windows default for hosted network)

## Patient Record Schema

```json
{
  "id": "uuid-v4",
  "patientId": "string",
  "name": "string",
  "age": "number",
  "gender": "male | female | other",
  "diagnosis": "string",
  "notes": "string",
  "doctorId": "string",
  "timestamp": "ISO-8601",
  "syncStatus": "pending | synced"
}
```

## Code Standards

- All public APIs documented with inline comments
- Structured error types — never throw raw strings
- Async-first: all I/O non-blocking
- Idempotent writes: duplicate `id` values must upsert, not duplicate
- Bridge must expose `GET /health` returning `{ status: "ok", version }`
- Validate all incoming JSON before DB write
- CORS must be enabled on bridge for PWA origin

## Key Constraints

- Bridge `.exe` must run without admin privileges (hotspot setup may prompt once)
- PWA must work fully offline after first load (service worker caches all assets)
- Records stored in IndexedDB survive browser close/refresh
- Cloud sync is async — records are safe locally until confirmed synced

## Development Workflow

- `cd bridge && npm install && npm run build` — compile bridge TypeScript
- `cd bridge && npm run package` — produce `bridge/dist/bridge.exe` via pkg
- `cd bridge && npm run dev` — run bridge in dev mode (ts-node)
- `cd pwa && npm install && npm run dev` — Vite dev server for PWA
- `cd pwa && npm run build` — build PWA to `pwa/dist/` (bridge serves this)
- `cd cloud-api && npm install && npm run dev` — run cloud API locally

## Testing

- Bridge: test POST /data with curl or Postman, verify SQLite entry created
- PWA: open in Chrome, add records offline, then connect to bridge hotspot and verify sync
- Cloud sync: run bridge + cloud-api locally, trigger sync, verify records arrive
- Always test idempotency: send same record twice, verify only one DB entry
