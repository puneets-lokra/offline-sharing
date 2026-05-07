import { v4 as uuidv4 } from 'uuid';

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

/**
 * PatientForm — doctor fills this on the dashboard.
 * Submits directly to bridge POST /data.
 * onSaved callback fires with the patientId after successful save.
 */
export function PatientForm(
  localBridgeUrl: string,
  onSaved: (patientId: string, record: PatientRecord) => void
): HTMLElement {
  const el = document.createElement('div');
  el.className = 'patient-form-section';
  el.innerHTML = `
    <h2 class="section-title">New Patient Record</h2>
    <div class="patient-form">
      <div class="form-row">
        <div class="form-field">
          <label>Patient ID</label>
          <input id="pf-patientId" type="text" placeholder="e.g. P-001" />
        </div>
        <div class="form-field">
          <label>Patient Name</label>
          <input id="pf-name" type="text" placeholder="Full name" />
        </div>
        <div class="form-field form-field--sm">
          <label>Age</label>
          <input id="pf-age" type="number" placeholder="Age" min="0" max="150" />
        </div>
        <div class="form-field form-field--sm">
          <label>Gender</label>
          <select id="pf-gender">
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label>Doctor ID</label>
          <input id="pf-doctorId" type="text" placeholder="e.g. DR-01" />
        </div>
        <div class="form-field form-field--wide">
          <label>Diagnosis</label>
          <input id="pf-diagnosis" type="text" placeholder="Primary diagnosis" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-field form-field--full">
          <label>Notes</label>
          <textarea id="pf-notes" rows="2" placeholder="Additional notes..."></textarea>
        </div>
      </div>
      <div class="form-actions">
        <button id="pf-submit" class="pf-submit-btn">Save Record</button>
        <span id="pf-status" class="pf-status"></span>
      </div>
    </div>
  `;

  const get = <T extends HTMLElement>(id: string) => el.querySelector<T>(`#${id}`)!;
  const patientIdInput = get<HTMLInputElement>('pf-patientId');
  const nameInput      = get<HTMLInputElement>('pf-name');
  const ageInput       = get<HTMLInputElement>('pf-age');
  const genderSelect   = get<HTMLSelectElement>('pf-gender');
  const doctorIdInput  = get<HTMLInputElement>('pf-doctorId');
  const diagnosisInput = get<HTMLInputElement>('pf-diagnosis');
  const notesInput     = get<HTMLTextAreaElement>('pf-notes');
  const submitBtn      = get<HTMLButtonElement>('pf-submit');
  const statusEl       = get<HTMLSpanElement>('pf-status');

  submitBtn.addEventListener('click', async () => {
    const patientId = patientIdInput.value.trim();
    const name      = nameInput.value.trim();
    const age       = parseInt(ageInput.value);
    const doctorId  = doctorIdInput.value.trim();
    const diagnosis = diagnosisInput.value.trim();

    if (!patientId || !name || isNaN(age) || !doctorId || !diagnosis) {
      statusEl.textContent = 'Please fill in all required fields.';
      statusEl.className = 'pf-status pf-status--error';
      return;
    }

    const record: PatientRecord = {
      id: uuidv4(),
      patientId,
      name,
      age,
      gender: genderSelect.value as 'male' | 'female' | 'other',
      diagnosis,
      notes: notesInput.value.trim(),
      doctorId,
      timestamp: new Date().toISOString(),
      syncStatus: 'pending',
    };

    submitBtn.disabled = true;
    statusEl.textContent = 'Saving...';
    statusEl.className = 'pf-status';

    try {
      const res = await fetch(`${localBridgeUrl}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error(`Bridge returned ${res.status}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Unknown error');

      statusEl.textContent = `Saved — Patient ID: ${patientId}`;
      statusEl.className = 'pf-status pf-status--ok';
      onSaved(patientId, record);

      // Clear form fields except doctorId
      patientIdInput.value = '';
      nameInput.value = '';
      ageInput.value = '';
      diagnosisInput.value = '';
      notesInput.value = '';
    } catch (err: any) {
      statusEl.textContent = `Failed: ${err.message}`;
      statusEl.className = 'pf-status pf-status--error';
    } finally {
      submitBtn.disabled = false;
    }
  });

  return el;
}
