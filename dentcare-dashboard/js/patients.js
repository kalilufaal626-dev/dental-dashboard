// Patients search and profile
window.addEventListener('navigate', async (e)=>{
  if(e.detail.page !== 'patients') return;
  await renderPatients();
});

async function renderPatients(){
  const container = el('#content'); clear(container);
  container.appendChild(create('h2',{},['Patients']));
  const search = create('input',{placeholder:'Search by name, phone or patient id'});
  container.appendChild(search);
  const list = create('div',{},[]);
  container.appendChild(list);

  async function load(){
    try{
      const data = await api('/patients');
      const q = (search.value||'').toLowerCase();
      const filtered = (data||[]).filter(p => (
        (p.name||'').toLowerCase().includes(q) || (p.phone||'').includes(q) || (String(p.patient_id||'')).includes(q)
      ));
      clear(list);
      if(filtered.length===0) list.appendChild(create('div',{},['No records available yet.']));
      filtered.forEach(p=>{
        const node = create('div',{class:'card'},[]);
        node.appendChild(create('div',{},[`${p.name} — ${p.patient_id || p.id}`]));
        const open = create('button',{},['Open']);
        open.addEventListener('click', ()=> openPatientProfile(p));
        node.appendChild(open);
        list.appendChild(node);
      });
    }catch(err){ list.appendChild(create('div',{},['Failed to load patients'])) }
  }

  search.addEventListener('input', load);
  await load();
}

function openPatientProfile(patient){
  window.APP_STATE.selectedPatientId = patient.id || patient.patient_id;
  // load patient tabs
  el('#content').innerHTML = '';
  const header = create('h2',{},[patient.name || 'Patient']);
  el('#content').appendChild(header);
  const tabs = ['Overview','Dental Chart','Medical Records','Treatment Plans','X-Rays','Prescriptions','Billing'];
  const nav = create('div',{},[]);
  tabs.forEach(t=>{
    const b = create('button',{},[t]);
    b.addEventListener('click', ()=>{
      if(t==='Overview') renderPatientOverview(patient);
      if(t==='Dental Chart') renderPatientDentalChart(patient);
      if(t==='Medical Records') renderPatientRecords(patient);
      if(t==='Treatment Plans') renderPatientTreatmentPlans(patient.id || patient.patient_id);
      if(t==='X-Rays') renderPatientXRays(patient.id || patient.patient_id);
      if(t==='Prescriptions') renderPatientPrescriptions(patient);
      if(t==='Billing') renderPatientBilling(patient);
    });
    nav.appendChild(b);
  });
  el('#content').appendChild(nav);
  renderPatientOverview(patient);
}


async function renderPatientDentalChart(patient){
  const c = create('div',{class:'card'},['Dental Chart']);
  c.appendChild(create('div',{class:'tooth-grid',id:'patient-tooth-grid'}));
  el('#content').appendChild(c);
  await drawDentalChart(patient.id || patient.patient_id, 'patient-tooth-grid');
}

async function renderPatientRecords(patient){
  const c = create('div',{class:'card'},['Medical Records']);
  el('#content').appendChild(c);
  try{
    const rec = await api(`/patients/${patient.id || patient.patient_id}/records`);
    if(!(rec||[]).length) c.appendChild(create('div',{},['No records available yet.']));
    else rec.forEach(r=> c.appendChild(create('div',{},[formatDate(r.date)||''+' '+(r.note||'')])));
  }catch(e){ c.appendChild(create('div',{},['Failed to load records'])) }
}

async function renderPatientPrescriptions(patient){
  const c = create('div',{class:'card'},['Prescriptions']); el('#content').appendChild(c);
  try{
    const all = await api('/prescriptions');
    const mine = (all||[]).filter(p=> String(p.patient_id)===String(patient.id||patient.patient_id));
    if(mine.length===0) c.appendChild(create('div',{},['No records available yet.']));
    mine.forEach(p=> c.appendChild(create('div',{},[p.drug+' — '+(p.status||'')])));
  }catch(e){ c.appendChild(create('div',{},['Failed to load prescriptions'])) }
}

async function renderPatientBilling(patient){
  const c = create('div',{class:'card'},['Billing']); el('#content').appendChild(c);
  try{
    const invoices = await api('/invoices');
    const mine = (invoices||[]).filter(i=> String(i.patient_id)===String(patient.id||patient.patient_id));
    if(mine.length===0) c.appendChild(create('div',{},['No billing records yet.']));
    mine.forEach(i=> c.appendChild(create('div',{},[`Invoice #${i.id} — ${i.status||''} — ${i.total || i.amount || 0}`])));
  }catch(e){ c.appendChild(create('div',{},['Failed to load billing'])) }
}

async function renderPatientXRays(patientId){
  const c = create('div',{class:'card'},['X-Rays']); el('#content').appendChild(c);
  try{
    const xrays = await fetchPatientXRays(patientId);
    if((xrays||[]).length===0) c.appendChild(create('div',{},['No X-rays have been uploaded yet.']));
    xrays.forEach(x=>{
      const row = create('div',{class:'xray-summary-row'},[]);
      row.appendChild(create('div',{},[x.title || 'Untitled']));
      row.appendChild(create('div',{},[x.type || 'Other']));
      row.appendChild(create('div',{},[formatXRayDate(x.taken_date||x.created_at)]));
      const view = create('button',{},['Open']); view.addEventListener('click', ()=> viewXRay(x.id));
      row.appendChild(view);
      c.appendChild(row);
    });
  }catch(e){ c.appendChild(create('div',{},['Failed to load X-rays'])) }
}

async function renderPatientOverview(patient){
  const c = create('div',{class:'card'},['Overview']); el('#content').appendChild(c);
  c.appendChild(create('div',{},[`Patient ID: ${patient.patient_id || patient.id}`]));
  c.appendChild(create('div',{},[`Email: ${patient.email || 'N/A'}`]));
  c.appendChild(create('div',{},[`Phone: ${patient.phone || 'N/A'}`]));
  try{
    const xrays = await fetchPatientXRays(patient.id || patient.patient_id);
    c.appendChild(create('div',{},[`X-rays: ${xrays.length}`]));
    if(xrays.length){
      const latest = xrays.sort((a,b)=> new Date(b.taken_date||b.created_at) - new Date(a.taken_date||a.created_at))[0];
      c.appendChild(create('div',{},[`Latest X-ray: ${latest.type || 'N/A'} on ${formatXRayDate(latest.taken_date||latest.created_at)}`]));
    }
  }catch(e){ c.appendChild(create('div',{},['X-ray summary unavailable'])) }
}

