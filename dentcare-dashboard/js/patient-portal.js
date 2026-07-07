// Patient portal pages
window.addEventListener('navigate', async (e)=>{
  if(!e.detail.page.startsWith('patient')) return;
  const page = e.detail.page;
  if(page === 'patient-home') renderPatientHome();
  if(page === 'patient-xrays') renderPatientXRays(window.APP_STATE.user && window.APP_STATE.user.patient_id);
});

async function renderPatientXRays(patientId){
  const container = el('#content'); if(!container) return; clear(container);
  container.appendChild(create('h2',{},['My X-Rays']));
  try{
    const xrays = await fetchPatientXRays(patientId);
    if((xrays||[]).length===0){ container.appendChild(create('div',{},['No X-rays have been uploaded yet.'])); return; }
    xrays.forEach(x=>{
      const card = create('div',{class:'card xray-card'},[]);
      card.appendChild(create('div',{},[x.title || 'Untitled']));
      card.appendChild(create('div',{},[`Type: ${x.type || 'Other'}`]));
      card.appendChild(create('div',{},[`Date: ${formatXRayDate(x.taken_date||x.created_at)}`]));
      const btn = create('button',{},['Open']); btn.addEventListener('click', ()=> viewXRay(x.id));
      card.appendChild(btn);
      container.appendChild(card);
    });
  }catch(e){ container.appendChild(create('div',{},['Failed to load X-rays'])); }
}

async function renderPatientHome(){
  const container = el('#content'); clear(container);
  const user = window.APP_STATE.user;
  if(!user) { container.appendChild(create('div',{},['No user'])); return }
  const pid = user.patient_id;
  container.appendChild(create('h2',{},['My Dashboard']));

  // upcoming appointments
  const apptCard = create('div',{class:'card'},['Upcoming appointments']);
  try{
    const appts = await api('/appointments');
    const myAppts = (appts||[]).filter(a => String(a.patient_id) === String(pid));
    if(myAppts.length===0) apptCard.appendChild(create('div',{},['No upcoming appointments.']))
    else myAppts.forEach(a=> apptCard.appendChild(create('div',{},[`${formatDate(a.date)} — ${a.status||''}`])));
  }catch(e){ apptCard.appendChild(create('div',{},['No appointments available'])) }
  container.appendChild(apptCard);

  // print report button
  const rpt = create('div',{class:'card'},[]);
  const btn = create('button',{},['Print Report Card']);
  btn.addEventListener('click', ()=> renderReportForPatient(pid, true));
  rpt.appendChild(btn);
  container.appendChild(rpt);
}
