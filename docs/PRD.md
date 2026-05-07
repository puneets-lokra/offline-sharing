# Product Requirements Document
# Offline Clinic Data Sharing — PWA + Windows Bridge

**Version:** 2.0  
**Date:** April 2026  
**Status:** Active

---

## 1. Overview

### 1.1 Problem Statement

Doctors operating in clinics without reliable internet need to capture patient records digitally and sync them to a central database when connectivity is available. Standard web apps fail completely offline. A native app requires platform-specific installation.

### 1.2 Solution

A **Progressive Web App (PWA)** runs on the doctor's device (tablet/laptop/phone) and stores patient records locally in IndexedDB — no internet required. A **Windows bridge application** (`.exe`) runs on a dedicated clinic machine. It creates a Wi-Fi Direct hotspot. When the doctor connects their device to that hotspot, the PWA automatically detects the bridge and flushes all pending records over HTTP. When internet later becomes available, the bridge pushes records to a cloud REST API.

### 1.3 Goals

- Doctors can capture patient records with zero connectivity
- Records transfer to the clinic server over Wi-Fi Direct (no internet needed)
- Records eventually reach the cloud when internet returns — automatically
- PWA works on any device with Chrome; no app store installation

---

## 2. User Stories

### Doctor (PWA user)
- I can open the PWA on my tablet with no internet and add patient records
- My records are saved locally even if I close the browser
- When I connect to the clinic Wi-Fi hotspot, my records sync automatically
- I can see which records are pending sync and which are confirmed

### Clinic Admin (bridge operator)
- I run `bridge.exe` on the clinic Windows machine — no configuration needed
- The bridge automatically creates a Wi-Fi hotspot called "ClinicBridge"
- I can see how many records have been received and their sync status to cloud
- When internet returns, records push to the cloud automatically

---

## 3. Architecture

```
Doctor's Device (any OS, Chrome)
  PWA (offline-first)
  ├── IndexedDB: stores patient records locally
  ├── Service Worker: caches app shell, registers Background Sync
  └── bridgeSync: detects bridge at 192.168.137.1:8765, flushes queue

        ↕  Wi-Fi Direct (HTTP POST, no internet)
        ↕  SSID: ClinicBridge, IP: 192.168.137.1

Clinic Windows Machine (bridge.exe)
  Node.js Bridge
  ├── hotspot.ts: netsh wlan creates Wi-Fi Direct hosted network
  ├── server.ts: Express serves PWA + REST API on :8765
  ├── POST /data: validates + upserts record into SQLite
  ├── SQLite: local store, source of truth
  └── cloudSync: polls internet → pushes pending records to cloud API

        ↕  HTTPS (only when internet available)

Cloud API (Node.js REST)
  POST /records — receives batched records from bridge
  SQLite / PostgreSQL — permanent store
```

---

## 4. Functional Requirements

### 4.1 Bridge (.exe)

| ID | Requirement |
|---|---|
| BR-001 | Create Wi-Fi Direct hosted network (`ClinicBridge`) on startup via `netsh wlan` |
| BR-002 | Serve PWA static files from `pwa/dist/` at root `/` |
| BR-003 | `GET /health` → `{ status: "ok", version: "x.y.z" }` |
| BR-004 | `GET /status` → hotspot state, pending record count, last sync time, internet state |
| BR-005 | `POST /data` → validate record schema, upsert into SQLite by `id` |
| BR-006 | Enable CORS for all origins (PWA may be served from any path) |
| BR-007 | Poll for internet every 30s; when online push all `syncStatus=pending` records to cloud API |
| BR-008 | Mark records `synced` after successful cloud push |
| BR-009 | Produce a single `bridge.exe` via `pkg` (Node 18, Windows x64) |
| BR-010 | All config via `bridge.config.json` — port, hotspot SSID/password, cloud API URL |

### 4.2 PWA

| ID | Requirement |
|---|---|
| PW-001 | App shell fully cached by Service Worker after first load |
| PW-002 | Patient records stored in IndexedDB (`idb` library) |
| PW-003 | Record form: patientId, name, age, gender, diagnosis, notes, doctorId |
| PW-004 | Auto-generate `id` (UUID v4) and `timestamp` (ISO-8601) on record creation |
| PW-005 | `bridgeSync` polls `http://192.168.137.1:8765/health` every 5s to detect bridge |
| PW-006 | When bridge detected, flush all pending IndexedDB records via `POST /data` |
| PW-007 | Show sync status: `offline` / `bridge found` / `syncing` / `synced (N records)` |
| PW-008 | Records in IndexedDB survive browser close/refresh |
| PW-009 | Installable via `manifest.json` (add to home screen / desktop) |
| PW-010 | Works on Chrome for Android, Windows, macOS |

### 4.3 Cloud API

| ID | Requirement |
|---|---|
| CA-001 | `POST /records` accepts array of patient records |
| CA-002 | Upsert by `id` — idempotent |
| CA-003 | `GET /records` returns all records (for verification) |
| CA-004 | SQLite backend by default; connection swappable to PostgreSQL |

---

## 5. Patient Record Schema

```typescript
interface PatientRecord {
  id: string           // UUID v4, client-generated
  patientId: string    // clinic patient identifier
  name: string
  age: number
  gender: 'male' | 'female' | 'other'
  diagnosis: string
  notes: string
  doctorId: string
  timestamp: string    // ISO-8601
  syncStatus: 'pending' | 'synced'
}
```

---

## 6. Bridge Config (`bridge.config.json`)

```json
{
  "port": 8765,
  "hotspot": {
    "ssid": "ClinicBridge",
    "password": "clinic1234",
    "enabled": true
  },
  "cloudApi": {
    "url": "https://your-cloud-api.example.com",
    "syncIntervalSeconds": 30
  },
  "db": {
    "path": "./data/bridge.db"
  }
}
```

---

## 7. Sync Flow (Step by Step)

1. Doctor opens PWA on tablet (no internet, service worker serves cached app)
2. Doctor adds patient records → stored in IndexedDB with `syncStatus: pending`
3. Clinic machine runs `bridge.exe` → hotspot `ClinicBridge` is active
4. Doctor connects tablet to `ClinicBridge` Wi-Fi
5. PWA detects bridge at `192.168.137.1:8765/health` → status turns green
6. PWA POSTs each pending record to `POST /data`
7. Bridge validates, upserts into SQLite, responds `{ ok: true }`
8. PWA marks those IndexedDB records as `synced`
9. (Later) Bridge detects internet → POSTs all SQLite `pending` records to cloud API
10. Cloud API upserts records → bridge marks them `synced`

---

## 8. Non-Functional Requirements

| NFR | Requirement |
|---|---|
| NFR-001 | Bridge must start in under 3 seconds |
| NFR-002 | POST /data must respond in under 100ms for a single record |
| NFR-003 | Bridge `.exe` size under 60MB (Node runtime + app bundled) |
| NFR-004 | PWA must load from cache in under 2 seconds with no network |
| NFR-005 | All writes idempotent — sending same record twice must not duplicate |
| NFR-006 | Bridge must run without administrator privileges on Windows 10/11 |

---

## 9. Out of Scope (v1)

- Bluetooth transport
- Multi-bridge setups
- Authentication / login on PWA
- Record editing or deletion after sync
- Real-time push from bridge to PWA

---

## 10. Milestones

| Milestone | Deliverable | Target |
|---|---|---|
| M1 | Bridge: Express + SQLite + /health /data /status | Week 1 |
| M2 | Bridge: Wi-Fi Direct hotspot via netsh + serves PWA | Week 2 |
| M3 | PWA: IndexedDB + record form + service worker cache | Week 3 |
| M4 | PWA: bridgeSync — auto-detect bridge + flush queue | Week 4 |
| M5 | Bridge: cloudSync agent — push to cloud when online | Week 5 |
| M6 | Cloud API: POST /records + SQLite | Week 5 |
| M7 | pkg packaging → bridge.exe, end-to-end test | Week 6 |
