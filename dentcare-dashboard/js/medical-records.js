window.addEventListener('navigate', async (e)=>{
  if(e.detail.page !== 'medical-records') return;
  await renderMedicalRecords();
});

async function renderMedicalRecords(){
  const container = el('#content'); clear(container);
  container.appendChild(create('h2',{},['Medical Records']));
  const pid = window.APP_STATE.selectedPatientId || (window.APP_STATE.user && window.APP_STATE.user.patient_id);
  try{
    const rec = await api(`/patients/${pid}/records`);
    if(!(rec||[]).length) container.appendChild(create('div',{},['No records available yet.']));
    else rec.forEach(r=> container.appendChild(create('div',{class:'card'},[formatDate(r.date)||''+' '+(r.note||'')])));
  }catch(e){ container.appendChild(create('div',{},['Failed to load records'])) }
}
