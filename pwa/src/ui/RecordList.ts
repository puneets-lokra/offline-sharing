import { PatientRecord, getAllRecords } from '../db/indexeddb';

/**
 * RecordList — renders a table of all patient records with sync status badges.
 */
export async function RecordList(): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'record-list';

  const records = await getAllRecords();
  // Sort newest first
  records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (records.length === 0) {
    container.innerHTML = `<p class="empty-state">No records yet. Add a patient record above.</p>`;
    return container;
  }

  container.innerHTML = `
    <h2>Records (${records.length})</h2>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Patient ID</th>
            <th>Name</th>
            <th>Age</th>
            <th>Diagnosis</th>
            <th>Doctor</th>
            <th>Time</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${records.map((r) => rowHTML(r)).join('')}
        </tbody>
      </table>
    </div>
  `;

  return container;
}

function rowHTML(r: PatientRecord): string {
  const time = new Date(r.timestamp).toLocaleString();
  const badge =
    r.syncStatus === 'synced'
      ? `<span class="badge badge-synced">Synced</span>`
      : `<span class="badge badge-pending">Pending</span>`;
  return `
    <tr>
      <td>${esc(r.patientId)}</td>
      <td>${esc(r.name)}</td>
      <td>${r.age}</td>
      <td>${esc(r.diagnosis)}</td>
      <td>${esc(r.doctorId)}</td>
      <td>${time}</td>
      <td>${badge}</td>
    </tr>
  `;
}

/** Minimal HTML escape to prevent XSS from user-entered data */
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
