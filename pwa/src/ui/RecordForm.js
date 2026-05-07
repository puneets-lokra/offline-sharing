import { addRecord } from '../api/records';
/**
 * RecordForm — renders the patient data entry form.
 *
 * When defaults.doctorId is provided (from QR code URL params):
 *  - Doctor ID field is pre-filled and made read-only
 *  - A "Assigned doctor" line shows the doctor's name if provided
 *
 * On submit, saves record to IndexedDB and calls onSaved callback.
 */
export function RecordForm(onSaved, defaults = {}) {
    const { doctorId = '', doctorName = '' } = defaults;
    const doctorLocked = doctorId.length > 0;
    const doctorBanner = doctorLocked
        ? `<div class="doctor-banner">
         Assigned to: <strong>${esc(doctorName || doctorId)}</strong>
         ${doctorName ? `<span class="doctor-id-badge">${esc(doctorId)}</span>` : ''}
       </div>`
        : '';
    const form = document.createElement('form');
    form.className = 'record-form';
    form.innerHTML = `
    <h2>${doctorLocked ? 'Patient Check-In' : 'New Patient Record'}</h2>
    ${doctorBanner}
    <div class="field">
      <label for="patientId">Patient ID</label>
      <input id="patientId" name="patientId" type="text" required placeholder="e.g. P-00123" />
    </div>
    <div class="field">
      <label for="name">Full Name</label>
      <input id="name" name="name" type="text" required placeholder="Your full name" />
    </div>
    <div class="field row">
      <div>
        <label for="age">Age</label>
        <input id="age" name="age" type="number" min="0" max="150" required placeholder="Age" />
      </div>
      <div>
        <label for="gender">Gender</label>
        <select id="gender" name="gender" required>
          <option value="">Select</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>
    </div>
    <div class="field" ${doctorLocked ? 'style="display:none"' : ''}>
      <label for="doctorId">Doctor ID</label>
      <input id="doctorId" name="doctorId" type="text"
        ${doctorLocked ? '' : 'required'}
        placeholder="e.g. DR-007"
        value="${esc(doctorId)}"
        ${doctorLocked ? 'readonly' : ''} />
    </div>
    <div class="field">
      <label for="diagnosis">Chief Complaint / Reason for Visit</label>
      <input id="diagnosis" name="diagnosis" type="text" required placeholder="e.g. Headache, fever..." />
    </div>
    <div class="field">
      <label for="notes">Additional Notes</label>
      <textarea id="notes" name="notes" rows="3" placeholder="Any other details (optional)"></textarea>
    </div>
    <button type="submit" class="btn-primary">${doctorLocked ? 'Submit Check-In' : 'Save Record'}</button>
    <p class="form-note">${doctorLocked
        ? 'Your record will be sent to the doctor immediately.'
        : 'Record is saved locally and will sync when bridge is reachable.'}</p>
  `;
    // If doctor is locked, inject hidden input so FormData still has doctorId
    if (doctorLocked) {
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = 'doctorId';
        hidden.value = doctorId;
        form.appendChild(hidden);
    }
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        try {
            await addRecord({
                patientId: fd.get('patientId'),
                name: fd.get('name'),
                age: Number(fd.get('age')),
                gender: fd.get('gender'),
                doctorId: fd.get('doctorId'),
                diagnosis: fd.get('diagnosis'),
                notes: fd.get('notes') || '',
            });
            form.reset();
            // Restore locked fields after reset
            if (doctorLocked) {
                const hiddenInput = form.querySelector('input[name="doctorId"][type="hidden"]');
                if (hiddenInput)
                    hiddenInput.value = doctorId;
            }
            onSaved();
            // Show success feedback
            const note = form.querySelector('.form-note');
            const original = note.textContent;
            note.textContent = doctorLocked ? 'Submitted! You can add another record below.' : 'Saved!';
            note.style.color = '#16a34a';
            setTimeout(() => { note.textContent = original; note.style.color = ''; }, 3000);
        }
        catch (err) {
            console.error('Failed to save record:', err);
            alert('Failed to save record. Please try again.');
        }
        finally {
            btn.disabled = false;
            btn.textContent = doctorLocked ? 'Submit Check-In' : 'Save Record';
        }
    });
    return form;
}
function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
