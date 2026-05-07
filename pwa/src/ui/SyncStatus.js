/**
 * SyncStatus — renders a status banner showing bridge connectivity and sync progress.
 * Call update() to re-render with a new state.
 */
export function SyncStatus() {
    const el = document.createElement('div');
    el.className = 'sync-status';
    function update(state) {
        el.className = `sync-status sync-status--${state.status}`;
        el.innerHTML = renderState(state);
    }
    update({ status: 'checking' });
    return { el, update };
}
function renderState(state) {
    switch (state.status) {
        case 'offline':
            return `<span class="dot dot-red"></span> Bridge not reachable — connect to <strong>ClinicBridge</strong> Wi-Fi`;
        case 'checking':
            return `<span class="dot dot-yellow"></span> Checking bridge connection...`;
        case 'reachable':
            return `<span class="dot dot-green"></span> Bridge connected — ${state.pendingCount} record(s) pending sync`;
        case 'syncing':
            return `<span class="dot dot-blue"></span> Syncing... ${state.done}/${state.total}`;
        case 'synced':
            return `<span class="dot dot-green"></span> All synced — ${state.count} record(s) sent to bridge`;
        case 'error':
            return `<span class="dot dot-red"></span> Sync error: ${state.message}`;
    }
}
