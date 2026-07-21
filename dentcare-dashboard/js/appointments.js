function showAppointmentDetails(appointment){
  window.__PRINT_APPOINTMENT = appointment;

  const html = `
    <div class="modal-details">
      <div><strong>Patient:</strong> ${esc(appointment.patient_name || appointment.patient_id || 'N/A')}</div>
      <div><strong>Dentist:</strong> ${esc(appointment.doctor_name || 'N/A')}</div>
      <div><strong>Treatment:</strong> ${esc(appointment.treatment || 'N/A')}</div>
      <div><strong>Date:</strong> ${esc(appointment.date || 'N/A')}</div>
      <div><strong>Time:</strong> ${esc(appointment.time || 'N/A')}</div>
      <div><strong>Status:</strong> ${esc(appointment.status || 'N/A')}</div>
      ${appointment.notes ? `<div><strong>Notes:</strong> ${esc(appointment.notes)}</div>` : ''}
      <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
  <button type="button" id="appointment-open-patient">Open Patient</button>
  ${canManageAppointments() ? `<button type="button" id="appointment-edit">Edit</button>
  <button type="button" id="appointment-cancel">Cancel</button>
  <button type="button" id="appointment-complete">Complete</button>` : ''}
  <button type="button" id="appointment-print">Print Slip</button>
</div>
  `;
  showModal(html, 'Appointment Details');
  el('#appointment-open-patient')?.addEventListener('click', openAppointmentPatient);
  el('#appointment-edit')?.addEventListener('click', editAppointment);
  el('#appointment-cancel')?.addEventListener('click', cancelAppointment);
  el('#appointment-complete')?.addEventListener('click', completeAppointment);
  el('#appointment-print')?.addEventListener('click', printAppointmentSlip);
}

function canManageAppointments(){ return ['admin','dentist','receptionist'].includes(window.APP_STATE.user?.role); }

window.addEventListener('navigate', async event=>{
  if(!['appointments','patient-appointments'].includes(event.detail.page)) return;
  await renderAppointments(event.detail.page === 'patient-appointments');
});

async function renderAppointments(patientOnly=false){
  const container=el('#content'); clear(container); container.appendChild(create('h2',{},[patientOnly?'My Appointments':'Appointments']));
  try{
    const data=await api('/appointments'); const patientId=window.APP_STATE.user?.patient_id;
    const rows=patientOnly?(data||[]).filter(a=>String(a.patient_id)===String(patientId)):(data||[]);
    if(!rows.length){ container.appendChild(create('div',{class:'card'},['No appointments found.'])); return; }
    rows.forEach(appointment=>{ const card=create('div',{class:'card'},[]);
      card.appendChild(create('h3',{},[`${appointment.date||'No date'} ${(appointment.time||'').slice(0,5)}`.trim()]));
      if(!patientOnly) card.appendChild(create('div',{},[`Patient: ${appointment.patient_name||appointment.patient_id||'N/A'}`]));
      card.appendChild(create('div',{},[`Treatment: ${appointment.treatment||'N/A'}`])); card.appendChild(create('div',{},[`Dentist: ${appointment.doctor_name||'N/A'}`])); card.appendChild(create('div',{},[`Status: ${appointment.status||'N/A'}`]));
      if(!patientOnly){ const button=create('button',{},['View Details']); button.addEventListener('click',()=>showAppointmentDetails(appointment)); card.appendChild(button); } container.appendChild(card); });
  }catch(error){ container.appendChild(create('div',{class:'card'},[error.message||'Failed to load appointments'])); }
}

async function openAppointmentPatient(){ const appointment=window.__PRINT_APPOINTMENT; if(!appointment?.patient_id){showToast('No patient is attached to this appointment');return;} try{const patient=await api(`/patients/${appointment.patient_id}`);closeModal();await openPatientProfile(patient);}catch(error){showToast(error.message||'Failed to open patient');} }

function editAppointment(){
  if(!canManageAppointments()){showToast('You do not have permission to edit appointments');return;} const appointment=window.__PRINT_APPOINTMENT;if(!appointment)return;
  showModal(`<form id="appointment-edit-form"><label>Date<input type="date" name="date" value="${esc(appointment.date||'')}" required></label><label>Time<input type="time" name="time" value="${esc((appointment.time||'').slice(0,5))}" required></label><label>Treatment<input name="treatment" value="${esc(appointment.treatment||'')}" required></label><label>Notes<textarea name="notes">${esc(appointment.notes||'')}</textarea></label><button type="submit">Save Changes</button></form>`,'Edit Appointment');
  el('#appointment-edit-form').addEventListener('submit',async event=>{event.preventDefault();try{await api(`/appointments/${appointment.id}`,{method:'PATCH',body:Object.fromEntries(new FormData(event.currentTarget).entries())});closeModal();showToast('Appointment updated');await renderAppointments();}catch(error){showToast(error.message||'Failed to update appointment');}});
}
async function updateSelectedAppointment(status){if(!canManageAppointments()){showToast('You do not have permission to update appointments');return;}const appointment=window.__PRINT_APPOINTMENT;if(!appointment)return;try{await api(`/appointments/${appointment.id}`,{method:'PATCH',body:{status}});closeModal();showToast(`Appointment ${status}`);await renderAppointments();}catch(error){showToast(error.message||'Failed to update appointment');}}
function cancelAppointment(){return updateSelectedAppointment('cancelled');}
function completeAppointment(){return updateSelectedAppointment('completed');}

function printAppointmentSlip(){
  const appointment = window.__PRINT_APPOINTMENT;
  if(!appointment){
    showToast('No appointment selected');
    return;
  }

  const html = `
    <!doctype html>
    <html>
    <head>
      <title>Appointment Slip</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; }
        h2 { text-align: center; margin-bottom: 5px; }
        .sub { text-align: center; margin-bottom: 25px; color: #555; }
        .row { margin: 10px 0; font-size: 15px; }
        .label { font-weight: bold; }
        .footer { margin-top: 35px; font-size: 12px; color: #666; text-align: center; }
      </style>
    </head>
    <body>
      <h2>DentCare Pro</h2>
      <div class="sub">Appointment Slip</div>

      <div class="row"><span class="label">Patient:</span> ${esc(appointment.patient_name || appointment.patient_id || 'N/A')}</div>
      <div class="row"><span class="label">Dentist:</span> ${esc(appointment.doctor_name || 'N/A')}</div>
      <div class="row"><span class="label">Treatment:</span> ${esc(appointment.treatment || 'N/A')}</div>
      <div class="row"><span class="label">Date:</span> ${esc(appointment.date || 'N/A')}</div>
      <div class="row"><span class="label">Time:</span> ${esc(appointment.time || 'N/A')}</div>
      <div class="row"><span class="label">Status:</span> ${esc(appointment.status || 'N/A')}</div>
      ${appointment.notes ? `<div class="row"><span class="label">Notes:</span> ${esc(appointment.notes)}</div>` : ''}

      <div class="footer">Generated by DentCare Pro</div>
    </body>
    </html>
  `;

  const win = window.open('', '_blank', 'width=600,height=700');
  if(!win){ showToast('Allow pop-ups to print the appointment slip'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
