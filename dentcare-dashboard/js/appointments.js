// Appointments listing and booking
window.addEventListener('navigate', async (e)=>{
  if(e.detail.page !== 'appointments') return;
  await renderAppointments();
});

async function renderAppointments(){
  const container = el('#content'); clear(container);
  container.appendChild(create('h2',{},['Appointments']));
  const btn = create('button',{},['Book Appointment']);
  btn.addEventListener('click', ()=> showAppointmentForm());
  container.appendChild(btn);
  const list = create('div',{},[]); container.appendChild(list);
  try{
    const data = await api('/appointments');
    if((data||[]).length===0) list.appendChild(create('div',{},['No records available yet.']));
    (data||[]).forEach(a=>{
      const node = create('div',{class:'card'},[]);
      node.appendChild(create('div',{},[`${formatDate(a.date)} — ${a.patient_name || a.patient_id || ''} — ${a.status || ''}`]));
      list.appendChild(node);
    });
  }catch(e){ list.appendChild(create('div',{},['Failed to load appointments'])) }
}

function showAppointmentForm(){
  const html = `
    <form id="appt-form">
      <label>Patient ID<input name="patient_id" required></label>
      <label>Date<input type="datetime-local" name="date" required></label>
      <label>Doctor<select name="doctor_id"><option value="">Select doctor</option></select></label>
      <div><button type="submit">Book</button></div>
    </form>
  `;
  showModal(html, 'Book Appointment');
  // load doctors
  api('/doctors').then(d=>{
    const sel = document.querySelector('#appt-form select[name="doctor_id"]');
    (d||[]).forEach(doc=> sel.appendChild(create('option',{value:doc.id},[doc.name||doc.email||doc.id])));
  }).catch(()=>{ const sel = document.querySelector('#appt-form select[name="doctor_id"]'); sel.innerHTML = '<option value="">No doctors available</option>' });

  document.querySelector('#appt-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = { patient_id: fd.get('patient_id'), date: fd.get('date'), doctor_id: fd.get('doctor_id') };
    try{
      await api('/appointments',{method:'POST', body:payload});
      closeModal(); showToast('Appointment booked'); renderAppointments();
    }catch(err){ showToast(err.message||'Failed to book') }
  });
}
