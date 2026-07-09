// Appointments listing and booking
window.addEventListener('navigate', async (e)=>{
  if(e.detail.page !== 'appointments') return;
  await renderAppointments();
});

async function renderAppointments(){
  const container = el('#content'); clear(container);
  container.appendChild(create('h2',{},['Appointments']));

  const viewControls = create('div',{class:'view-controls',style:'display:flex;gap:8px;margin-bottom:16px;'},[]);
  const listButton = create('button',{class:'tab-btn active'},['List View']);
  const calendarButton = create('button',{class:'tab-btn'},['Calendar View']);
  viewControls.appendChild(listButton);
  viewControls.appendChild(calendarButton);
  container.appendChild(viewControls);

  const btn = create('button',{},['Book Appointment']);
  btn.addEventListener('click', ()=> showAppointmentForm());
  container.appendChild(btn);

  const listWrapper = create('div',{id:'appointment-list',style:'margin-top:16px;'},[]);
  const calendarWrapper = create('div',{id:'appointment-calendar',style:'display:none;margin-top:16px;'},[]);
  container.appendChild(listWrapper);
  container.appendChild(calendarWrapper);

  listButton.addEventListener('click', ()=>{
    listWrapper.style.display = 'block';
    calendarWrapper.style.display = 'none';
    listButton.classList.add('active');
    calendarButton.classList.remove('active');
  });

  calendarButton.addEventListener('click', ()=>{
    listWrapper.style.display = 'none';
    calendarWrapper.style.display = 'block';
    listButton.classList.remove('active');
    calendarButton.classList.add('active');
  });

  try{
    const data = await api('/appointments');
    if((data||[]).length===0) listWrapper.appendChild(create('div',{},['No records available yet.']));
    (data||[]).forEach(a=>{
      const node = create('div',{class:'card'},[]);
      node.appendChild(create('div',{},[`${formatDate(a.date)} — ${a.patient_name || a.patient_id || ''} — ${a.status || ''}`]));
      const role = window.APP_STATE && window.APP_STATE.user && window.APP_STATE.user.role;
      if(role && role !== 'patient'){
        node.style.cursor = 'pointer';
        node.addEventListener('click', ()=> showAppointmentDetails(a));
      }
      listWrapper.appendChild(node);
    });
  }catch(e){ listWrapper.appendChild(create('div',{},['Failed to load appointments'])) }
}

function showAppointmentDetails(appointment){
  const html = `
    <div class="modal-details">
      <div><strong>Patient:</strong> ${esc(appointment.patient_name || appointment.patient_id || 'N/A')}</div>
      <div><strong>Dentist:</strong> ${esc(appointment.doctor_name || 'N/A')}</div>
      <div><strong>Treatment:</strong> ${esc(appointment.treatment || 'N/A')}</div>
      <div><strong>Date:</strong> ${esc(appointment.date || 'N/A')}</div>
      <div><strong>Time:</strong> ${esc(appointment.time || 'N/A')}</div>
      <div><strong>Status:</strong> ${esc(appointment.status || 'N/A')}</div>
      ${appointment.notes ? `<div><strong>Notes:</strong> ${esc(appointment.notes)}</div>` : ''}
    </div>
  `;
  showModal(html, 'Appointment Details');
}

function showAppointmentForm(){
  const html = `
    <form id="appt-form">
      <label>Patient ID<input name="patient_id" required></label>
      <label>Date<input type="datetime-local" name="date" required></label>
      <label>Dentist<select name="doctor_id" required><option value="">Loading dentists...</option></select></label>
      <div><button type="submit">Book</button></div>
    </form>
  `;
  showModal(html, 'Book Appointment');

  api('/dentists').then(dentists=>{
    const sel = document.querySelector('#appt-form select[name="doctor_id"]');

    if(!dentists || dentists.length === 0){
      sel.innerHTML = '<option value="">No dentists available</option>';
      return;
    }

    sel.innerHTML = '<option value="">Select dentist</option>';

    dentists.forEach(d=>{
      const label = d.specialization
        ? `${d.full_name} — ${d.specialization}`
        : d.full_name;

      sel.appendChild(create('option',{value:d.id},[label]));
    });
  }).catch(()=>{
    const sel = document.querySelector('#appt-form select[name="doctor_id"]');
    sel.innerHTML = '<option value="">Could not load dentists</option>';
  });

  document.querySelector('#appt-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      patient_id: fd.get('patient_id'),
      date: fd.get('date'),
      doctor_id: fd.get('doctor_id')
    };

    try{
      await api('/appointments',{method:'POST', body:payload});
      closeModal();
      showToast('Appointment booked');
      renderAppointments();
    }catch(err){
      showToast(err.message || 'Failed to book');
    }
  });
}