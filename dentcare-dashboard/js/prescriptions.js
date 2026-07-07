window.addEventListener('navigate', async (e)=>{
  if(e.detail.page !== 'prescriptions') return;
  await renderPrescriptions();
});

async function renderPrescriptions(){
  const container = el('#content'); clear(container);
  container.appendChild(create('h2',{},['Prescriptions']));
  try{
    const data = await api('/prescriptions');
    if((data||[]).length===0) container.appendChild(create('div',{},['No records available yet.']));
    data.forEach(p=>{
      const node = create('div',{class:'card'},[]);
      node.appendChild(create('div',{},[`${p.drug} — ${p.patient_name || p.patient_id}`]));
      if(window.APP_STATE.user && ['pharmacist','admin'].includes(window.APP_STATE.user.role)){
        const btn = create('button',{},['Dispense']);
        btn.addEventListener('click', async ()=>{
          try{ await api(`/prescriptions/${p.id}/dispense`,{method:'PATCH'}); showToast('Dispensed'); renderPrescriptions(); }
          catch(err){ showToast('Failed to dispense') }
        });
        node.appendChild(btn);
      }
      container.appendChild(node);
    });
  }catch(e){ container.appendChild(create('div',{},['Failed to load prescriptions'])) }
}
