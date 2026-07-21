// Patient portal pages
window.addEventListener('navigate', async (e)=>{
  if(!e.detail.page.startsWith('patient')) return;
  const page = e.detail.page;
  const patientId=window.APP_STATE.user&&window.APP_STATE.user.patient_id;
  if(page==='patient-home') await renderPatientHome();
  if(page==='patient-xrays') await renderPortalPatientXRays(patientId);
  if(page==='patient-record') await renderPortalPatientRecord(patientId);
  if(page==='patient-billing') await renderPortalPatientBilling();
  if(page==='patient-treatment-plans') await renderPortalTreatmentPlans(patientId);
});

async function renderPortalPatientXRays(patientId){
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

async function renderPortalPatientRecord(patientId){
  const container=el('#content');clear(container);container.appendChild(create('h2',{},['My Record']));
  if(!patientId){container.appendChild(create('div',{class:'card'},['Patient account is not linked to a record.']));return;}
  try{const [patient,records]=await Promise.all([api(`/patients/${patientId}`),api(`/patients/${patientId}/records`)]);container.appendChild(create('div',{class:'card'},[`${patient.full_name||'Patient'} — Blood type: ${patient.blood_type||'Not recorded'} — Allergies: ${patient.allergies||'None recorded'}`]));if(!(records||[]).length){container.appendChild(create('div',{class:'card'},['No visit history available.']));return;}records.forEach(record=>container.appendChild(create('div',{class:'card'},[`${formatDate(record.created_at||record.date)} — ${record.diagnosis||record.treatment_done||record.notes||'Visit record'}`])));}catch(error){container.appendChild(create('div',{class:'card'},[error.message||'Failed to load your record']));}
}
async function renderPortalPatientBilling(){const container=el('#content');clear(container);container.appendChild(create('h2',{},['My Bills']));try{const invoices=await api('/invoices');if(!(invoices||[]).length){container.appendChild(create('div',{class:'card'},['No invoices found.']));return;}invoices.forEach(invoice=>container.appendChild(create('div',{class:'card'},[`${invoice.invoice_no||`Invoice #${invoice.id}`} — Total: D${Number(invoice.total||0).toFixed(2)} — Paid: D${Number(invoice.amount_paid||0).toFixed(2)} — ${invoice.status||''}`])));}catch(error){container.appendChild(create('div',{class:'card'},[error.message||'Failed to load invoices']));}}
async function renderPortalTreatmentPlans(patientId){const container=el('#content');clear(container);container.appendChild(create('h2',{},['My Treatment Plans']));const target=create('div',{id:'patient-treatment-plans-content'},[]);container.appendChild(target);if(typeof renderPatientTreatmentPlans!=='function'){target.appendChild(create('div',{class:'card'},['Treatment plans are unavailable.']));return;}await renderPatientTreatmentPlans(patientId,'patient-treatment-plans-content');}

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

async function renderReportForPatient(patientId,printImmediately=false){
  if(!patientId){showToast('Patient account is not linked to a record');return;}
  try{const [patient,records,chart]=await Promise.all([api(`/patients/${patientId}`),api(`/patients/${patientId}/records`),api(`/patients/${patientId}/chart`)]);const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);const report=`<!doctype html><html><head><title>Patient Report</title></head><body style="font-family:Arial;padding:30px"><h1>DentCare Pro</h1><h2>Patient Report</h2><p><strong>Name:</strong> ${safe(patient.full_name)}</p><p><strong>Patient ID:</strong> ${safe(patient.patient_id)}</p><p><strong>Blood type:</strong> ${safe(patient.blood_type||'Not recorded')}</p><p><strong>Allergies:</strong> ${safe(patient.allergies||'None recorded')}</p><h3>Dental Chart</h3>${(chart||[]).length?`<ul>${chart.map(item=>`<li>Tooth ${safe(item.tooth_number)}: ${safe(item.condition)}</li>`).join('')}</ul>`:'<p>No dental chart entries.</p>'}<h3>Visit History</h3>${(records||[]).length?`<ul>${records.map(item=>`<li>${safe(formatDate(item.created_at||item.date))}: ${safe(item.diagnosis||item.treatment_done||item.notes||'Visit')}</li>`).join('')}</ul>`:'<p>No visit history.</p>'}</body></html>`;const win=window.open('','_blank','width=800,height=900');if(!win){showToast('Allow pop-ups to open the report');return;}win.document.write(report);win.document.close();win.focus();if(printImmediately)win.print();}catch(error){showToast(error.message||'Failed to build patient report');}
}
