import { PatientRecord } from '../sync/httpPoller';

/**
 * RecordTable — renders a sortable table of patient records.
 * Returns an element that can be replaced in-place on updates.
 */
export function RecordTable(records: PatientRecord[]): HTMLElement {
  const wrapper = document.createElement('div');

  if (records.length === 0) {
    wrapper.innerHTML = `<p class="empty">No records yet. Waiting for data from Doctor PWA...</p>`;
    return wrapper;
  }

  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>#</th>
        <th>Patient ID</th>
        <th>Name</th>
        <th>Age</th>
        <th>Gender</th>
        <th>Diagnosis</th>
        <th>Doctor</th>
        <th>Time</th>
        <th>Status</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');
  records.forEach((r, i) => {
    const tr = document.createElement('tr');
    const time = new Date(r.timestamp).toLocaleString();
    const badge = r.syncStatus === 'synced'
      ? `<span class="badge badge--synced">synced</span>`
      : `<span class="badge badge--pending">pending</span>`;

    tr.innerHTML = `
      <td>${records.length - i}</td>
      <td>${safe(r.patientId)}</td>
      <td>${safe(r.name)}</td>
      <td>${r.age}</td>
      <td>${safe(r.gender)}</td>
      <td>${safe(r.diagnosis)}</td>
      <td>${safe(r.doctorId)}</td>
      <td>${safe(time)}</td>
      <td>${badge}</td>
    `;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrapper.appendChild(table);
  return wrapper;
}

function safe(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
