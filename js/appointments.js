// Appointments module moved out of index.html
// Contains: renderAppointments, filterAppts, updateApptStatus, openBookApptModal, submitBookAppt

async function renderAppointments(){
  const el = document.getElementById('page-appointments');
  const isPatient = role() === 'patient';
  el.innerHTML = `
    <div class="sec-hdr">
      ${!isPatient ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input type="date" class="search-input" id="appt-date-f" style="width:170px;">
        <select class="search-input" id="appt-status-f" style="width:150px;">
          <option value="">All statuses</option>
          ${['scheduled','confirmed','in-progress','completed','cancelled','no_show'].map(s=>`<option value="${s}">${s}</option>`).join('')}
        </select>
        <button class="btn btn-outline btn-sm" onclick="filterAppts()">Filter</button>
        <button class="btn btn-outline btn-sm" onclick="renderAppointments()">Clear</button>
      </div>` : '<span></span>'}
      ${canDo('book-appt') ? `<button class="btn btn-teal" onclick="openBookApptModal()">+ ${isPatient?'Request':'Book'} Appointment</button>` : ''}
    </div>
    <div class="card"><div class="card-header"><span class="card-title">Appointments</span></div><div id="appt-table"><div class="spinner">Loading…</div></div></div>`;
  await filterAppts();
}

async function filterAppts(){
  const isPatient = role() === 'patient';
  const params = new URLSearchParams();
  if (!isPatient) {
    const d = document.getElementById('appt-date-f')?.value; if (d) params.set('date', d);
    const s = document.getElementById('appt-status-f')?.value; if (s) params.set('status', s);
  }
  const q = params.toString();
  const appts = await api(`/appointments${q?'?'+q:''}`);
  window.__APPOINTMENTS = appts;
  document.getElementById('appt-table').innerHTML = appts.length ? `
    <table><thead><tr><th>Date</th><th>Time</th>${isPatient?'':'<th>Patient</th>'}<th>Treatment</th><th>Doctor</th><th>Status</th></tr></thead>
    <tbody>${appts.map(a=>`<tr ${!isPatient ? `onclick="showAppointmentDetails(${a.id})" style="cursor:pointer;"` : ''}>
      <td>${esc(a.date)}</td><td><strong>${esc(a.time.slice(0,5))}</strong></td>
      ${isPatient?'':`<td>${esc(a.patient_name)}</td>`}
      <td>${esc(a.treatment)}</td><td style="font-size:12px;color:var(--text-2);">${esc(a.doctor_name||'—')}</td>
      <td><span class="badge ${statusBadge(a.status)}">${esc(a.status)}</span></td>
    </tr>`).join('')}</tbody></table>` : `<div class="empty"><div class="ei">📅</div><h3>No appointments found</h3></div>`;
}

function showAppointmentDetails(id){
  const appts = window.__APPOINTMENTS || [];
  const appointment = appts.find(a=>String(a.id) === String(id));
  if (!appointment) { toast('Appointment not found','e'); return; }
  document.getElementById('m-appt-details-inner').innerHTML = `
    <div class="modal-header"><h2>Appointment Details</h2><button class="modal-close" onclick="closeModal('m-appt-details')">✕</button></div>
    <div class="fg"><strong>Patient:</strong> ${esc(appointment.patient_name || appointment.patient_id || 'N/A')}</div>
    <div class="fg"><strong>Dentist:</strong> ${esc(appointment.doctor_name || 'N/A')}</div>
    <div class="fg"><strong>Treatment:</strong> ${esc(appointment.treatment || 'N/A')}</div>
    <div class="fg"><strong>Date:</strong> ${esc(appointment.date || 'N/A')}</div>
    <div class="fg"><strong>Time:</strong> ${esc(appointment.time ? appointment.time.slice(0,5) : 'N/A')}</div>
    <div class="fg"><strong>Status:</strong> <span class="badge ${statusBadge(appointment.status)}">${esc(appointment.status || 'N/A')}</span></div>
    ${appointment.notes ? `<div class="fg"><strong>Notes:</strong><div style="white-space:pre-wrap;">${esc(appointment.notes)}</div></div>` : '<div class="fg"><strong>Notes:</strong> —</div>'}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap;">
      <button class="btn btn-outline" onclick="closeModal('m-appt-details'); showPage('patient-profile', ${JSON.stringify(appointment.patient_id)} )">Open Patient</button>
      <button class="btn btn-outline" onclick="updateApptStatus(${appointment.id}, 'cancelled', { closeModal: true })">Cancel</button>
      <button class="btn btn-teal" onclick="updateApptStatus(${appointment.id}, 'completed', { closeModal: true })">Complete</button>
    </div>
  `;
  openModal('m-appt-details');
}

async function updateApptStatus(id, status, options = {}){
  try {
    if (!status) return;
    await api(`/appointments/${id}`, { method:'PATCH', body: JSON.stringify({ status }) });
    if (options.closeModal) closeModal('m-appt-details');
    if (document.getElementById('page-dashboard')?.classList.contains('active') && typeof renderDashboard === 'function') {
      await renderDashboard();
    }
    await filterAppts();
    toast(`Appointment ${status.replace('_',' ')}.`, 's');
  } catch(e){ toast(e.message,'e'); }
}

async function openBookApptModal(appointment = null){
  const isPatient = role() === 'patient';
  const editMode = !!appointment;
  window.__EDIT_APPOINTMENT = appointment;
  let patientsOpts = '', doctorsOpts = '', doctorsWarning = '';
  if (!isPatient) {
    try { const patients = await api('/patients'); CACHE.patients = patients;
      patientsOpts = patients.map(p=>`<option value="${p.id}" ${appointment && String(p.id)===String(appointment.patient_id)?'selected':''}>${esc(p.full_name)} (${esc(p.patient_id)})</option>`).join(''); }
    catch { patientsOpts = '<option value="">Failed to load patients</option>'; }
  }
  try {
    let dentists = [];
    try { dentists = await api('/dentists'); }
    catch {
      if (!isPatient) { const staff = await api('/staff'); dentists = staff.filter(s => s.role === 'dentist'); }
      else { throw new Error('Dentist list is not available for patient booking yet.'); }
    }
    doctorsOpts = dentists.map(d=>`<option value="${d.id}" ${appointment && String(d.id)===String(appointment.doctor_id)?'selected':''}>${esc(d.full_name)}${d.specialization?' — '+esc(d.specialization):''}</option>`).join('');
  } catch { doctorsWarning = `<div class="notice notice-amber">Couldn't load the dentist list. Add GET /dentists to the API.</div>`; }
  document.getElementById('m-book-inner').innerHTML = `
    <div class="modal-header"><h2>📅 ${editMode ? 'Edit' : isPatient ? 'Request' : 'Book'} Appointment</h2><button class="modal-close" onclick="closeModal('m-book')">✕</button></div>
    ${doctorsWarning}
    ${!isPatient ? `<div class="fg"><label>Patient *</label><select id="ba-patient">${patientsOpts||'<option value="">No patients found</option>'}</select></div>` : ''}
    <div class="form-row">
      <div class="fg"><label>Date *</label><input type="date" id="ba-date" value="${esc((appointment && appointment.date) || todayISO())}"></div>
      <div class="fg"><label>Time *</label><input type="time" id="ba-time" value="${esc(appointment ? appointment.time.slice(0,5) : '')}"></div>
    </div>
    <div class="fg"><label>Dentist *</label><select id="ba-doctor">${doctorsOpts||'<option value="">No dentists available</option>'}</select></div>
    <div class="fg"><label>Treatment *</label><select id="ba-treatment">
      <option ${appointment && appointment.treatment==='Consultation & Checkup' ? 'selected' : ''}>Consultation & Checkup</option>
      <option ${appointment && appointment.treatment==='Teeth Cleaning' ? 'selected' : ''}>Teeth Cleaning</option>
      <option ${appointment && appointment.treatment==='Tooth Extraction' ? 'selected' : ''}>Tooth Extraction</option>
      <option ${appointment && appointment.treatment==='Root Canal Treatment' ? 'selected' : ''}>Root Canal Treatment</option>
      <option ${appointment && appointment.treatment==='Dental Filling' ? 'selected' : ''}>Dental Filing</option>
      <option ${appointment && appointment.treatment==='Crown Fitting' ? 'selected' : ''}>Crown Fitting</option>
      <option ${appointment && appointment.treatment==='Dental Implant' ? 'selected' : ''}>Dental Implant</option>
      <option ${appointment && appointment.treatment==='X-Ray' ? 'selected' : ''}>X-Ray</option>
      <option ${appointment && appointment.treatment==='Other' ? 'selected' : ''}>Other</option></select></div>
    <div class="fg"><label>Notes</label><textarea id="ba-notes" style="height:65px;resize:none;">${esc(appointment ? appointment.notes : '')}</textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn btn-outline" onclick="closeModal('m-book')">Cancel</button>
      <button class="btn btn-teal" onclick="submitBookAppt(${isPatient})">${editMode ? 'Save changes' : 'Book'}</button>
    </div>`;
  openModal('m-book');
}

async function submitBookAppt(isPatient){
  const appointment = window.__EDIT_APPOINTMENT || null;
  const patient_id = isPatient ? USER.patient_id : document.getElementById('ba-patient').value;
  const doctor_id = document.getElementById('ba-doctor').value;
  const date = document.getElementById('ba-date').value;
  const time = document.getElementById('ba-time').value;
  const treatment = document.getElementById('ba-treatment').value;
  const notes = document.getElementById('ba-notes').value;
  if (!patient_id || !doctor_id || !date || !time || !treatment) { toast('Please fill all required fields','e'); return; }
  try {
    const payload = { patient_id, doctor_id, date, time, treatment, notes };
    if (appointment) {
      await api(`/appointments/${appointment.id}`, { method:'PATCH', body: JSON.stringify(payload) });
      toast('Appointment updated!','s');
    } else {
      await api('/appointments', { method:'POST', body: JSON.stringify(payload) });
      toast('Appointment booked!','s');
    }
    window.__EDIT_APPOINTMENT = null;
    closeModal('m-book');
    showPage(isPatient ? 'patient-home' : 'appointments');
  } catch(e){ toast(e.message,'e'); }
}

// expose to global scope (already declared as functions; kept for clarity)
window.renderAppointments = renderAppointments;
window.filterAppts = filterAppts;
window.updateApptStatus = updateApptStatus;
window.openBookApptModal = openBookApptModal;
window.submitBookAppt = submitBookAppt;
