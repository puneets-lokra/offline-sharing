/**
 * Build candidate bridge URLs in order:
 * 1. ?bridge= URL param — explicit override (used when PWA hosted on GitHub Pages)
 * 2. The origin the PWA was served from (covers cloudflare tunnel, LAN IP, hotspot IP)
 * 3. localhost:8765  — dev mode / single-machine
 * 4. 192.168.137.1  — Windows Wi-Fi Direct hotspot (production)
 */
function buildCandidates() {
    const candidates = [];
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const explicit = params.get('bridge');
        if (explicit)
            candidates.push(explicit.replace(/\/$/, ''));
        const { protocol, hostname, port } = window.location;
        const origin = `${protocol}//${hostname}${port ? ':' + port : ''}`;
        if (!origin.includes('github.io'))
            candidates.push(origin);
    }
    candidates.push('http://localhost:8765');
    candidates.push('http://192.168.137.1:8765');
    return [...new Set(candidates)];
}
const BRIDGE_CANDIDATES = buildCandidates();
const HEALTH_TIMEOUT_MS = 3000;
let resolvedBridgeUrl = null;
/**
 * Tries each candidate URL in order and returns the first reachable one.
 * Caches the result so subsequent calls are instant.
 */
async function resolveBridgeUrl() {
    // Return cached URL if still reachable
    if (resolvedBridgeUrl) {
        const still = await pingUrl(resolvedBridgeUrl);
        if (still)
            return resolvedBridgeUrl;
        resolvedBridgeUrl = null;
    }
    for (const url of BRIDGE_CANDIDATES) {
        if (await pingUrl(url)) {
            resolvedBridgeUrl = url;
            console.log(`[bridgeSync] Bridge found at ${url}`);
            return url;
        }
    }
    return null;
}
async function pingUrl(baseUrl) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
        const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        return res.ok;
    }
    catch {
        return false;
    }
}
/**
 * Attempts to reach the bridge.
 * Returns true if any candidate URL is responding.
 */
export async function isBridgeReachable() {
    const url = await resolveBridgeUrl();
    return url !== null;
}
/**
 * Sends a single patient record to the bridge via POST /data.
 */
export async function sendRecord(record) {
    const baseUrl = await resolveBridgeUrl();
    if (!baseUrl)
        return false;
    try {
        const res = await fetch(`${baseUrl}/data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record),
        });
        if (!res.ok)
            return false;
        const json = await res.json();
        return json.ok === true;
    }
    catch {
        return false;
    }
}
/**
 * Flushes a list of pending records to the bridge one by one.
 * Returns the IDs of successfully sent records.
 */
export async function flushRecords(records) {
    const synced = [];
    for (const record of records) {
        const ok = await sendRecord(record);
        if (ok)
            synced.push(record.id);
    }
    return synced;
}
