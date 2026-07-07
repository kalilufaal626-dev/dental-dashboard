// Treatment Plans module
// Tries backend endpoints first; falls back to localStorage when 404.
const TPLAN_FALLBACK_KEY = 'treatment_plans_fallback_v1';

function getFallbackPlans(){
  try{ return JSON.parse(localStorage.getItem(TPLAN_FALLBACK_KEY) || '[]') }catch(e){ return [] }
}
function saveFallbackPlans(plans){ localStorage.setItem(TPLAN_FALLBACK_KEY, JSON.stringify(plans)); }
function generateLocalId(){ return 'tp_' + Date.now() + '_' + Math.floor(Math.random()*1000) }

async function fetchTreatmentPlans(){
  try{
    return await api('/treatment-plans');
  }catch(err){
    if(err.status === 404) return getFallbackPlans();
    throw err;
  }
}

async function fetchPatientTreatmentPlans(patientId){
  try{ return await api(`/patients/${patientId}/treatment-plans`); }
  catch(err){ if(err.status===404){ return getFallbackPlans().filter(p=>String(p.patient_id)===String(patientId)) } throw err }
}

async function postTreatmentPlan(payload){
  try{ return await api('/treatment-plans',{method:'POST', body:payload}); }
  catch(err){ if(err.status===404){ const plans = getFallbackPlans(); const id = generateLocalId(); const rec = Object.assign({id}, payload, {created_at: new Date().toISOString()}); plans.unshift(rec); saveFallbackPlans(plans); return rec } throw err }
}

async function patchTreatmentPlan(id, payload){
  try{ return await api(`/treatment-plans/${id}`,{method:'PATCH', body:payload}); }
  catch(err){ if(err.status===404){ const plans = getFallbackPlans(); const i = plans.findIndex(p=>String(p.id)===String(id)); if(i>=0){ plans[i] = Object.assign({}, plans[i], payload); saveFallbackPlans(plans); return plans[i]; } throw err } throw err }
}

// Render list view
async function renderTreatmentPlans(){
  const container = el('#page-treatment-plans'); if(!container) return;
  clear(container);
  container.appendChild(create('h2',{},['Treatment Plans']));
  const topbar = create('div',{},[]);
  const search = create('input',{placeholder:'Search by patient name or Patient ID'});
  const statusSel = create('select',{},[]);
  ['','draft','proposed','accepted','in_progress','completed','cancelled'].forEach(s=> statusSel.appendChild(create('option',{value:s},[s||'All statuses'])));
  topbar.appendChild(search); topbar.appendChild(statusSel);
  const user = window.APP_STATE.user || {};
  if(['admin','dentist','receptionist'].includes(user.role)){
    const add = create('button',{},['Add Treatment Plan']); add.addEventListener('click', ()=> openTreatmentPlanModal()); topbar.appendChild(add);
  }
  container.appendChild(topbar);

  const list = create('div',{},[]); container.appendChild(list);

  async function load(){
    clear(list);
    try{
      let data = await fetchTreatmentPlans();
      const q = (search.value||'').toLowerCase();
      const status = statusSel.value;
      data = (data||[]).filter(p=>{
        const matchQ = !q || (p.title||'').toLowerCase().includes(q) || (p.patient_name||'').toLowerCase().includes(q) || String(p.patient_id||'').includes(q);
        const matchStatus = !status || p.status === status;
        return matchQ && matchStatus;
      });
      if(data.length===0) list.appendChild(create('div',{},['No treatment plans available yet.']));
      data.forEach(p=>{
        const card = create('div',{class:'card treatment-plan-card'},[]);
        card.appendChild(create('div',{},[`${p.title} — ${p.patient_name || p.patient_id}`]));
        card.appendChild(create('div',{},[`Estimate: ${p.estimated_total || 0} — Status: ${p.status || 'draft'}`]));
        const actions = create('div',{},[]);
        const viewBtn = create('button',{},['View']); viewBtn.addEventListener('click', ()=> viewTreatmentPlan(p.id)); actions.appendChild(viewBtn);
        if(['admin','dentist'].includes(user.role)){
          const edit = create('button',{},['Edit']); edit.addEventListener('click', ()=> openTreatmentPlanModal(p.patient_id || p.patient_id, p)); actions.appendChild(edit);
          const accept = create('button',{},['Mark Accepted']); accept.addEventListener('click', ()=> updateTreatmentPlanStatus(p.id,'accepted')); actions.appendChild(accept);
          const inprog = create('button',{},['Mark In Progress']); inprog.addEventListener('click', ()=> updateTreatmentPlanStatus(p.id,'in_progress')); actions.appendChild(inprog);
          const comp = create('button',{},['Mark Completed']); comp.addEventListener('click', ()=> updateTreatmentPlanStatus(p.id,'completed')); actions.appendChild(comp);
        }
        if(['admin','receptionist'].includes(user.role)){
          const inv = create('button',{},['Create Invoice']); inv.addEventListener('click', ()=> createInvoiceFromTreatmentPlan(p.id)); actions.appendChild(inv);
        }
        card.appendChild(actions);
        list.appendChild(card);
      });
    }catch(err){ list.appendChild(create('div',{},['Failed to load treatment plans'])) }
  }

  search.addEventListener('input', load); statusSel.addEventListener('change', load);
  await load();
}

// Patient-specific rendering
async function renderPatientTreatmentPlans(patientId){
  const container = el('#content'); if(!container) return; clear(container);
  container.appendChild(create('h3',{},['Treatment Plans']));
  try{
    const plans = await fetchPatientTreatmentPlans(patientId);
    if((plans||[]).length===0) container.appendChild(create('div',{},['No treatment plans available yet.']));
    plans.forEach(p=>{
      const card = create('div',{class:'card treatment-plan-card'},[]);
      card.appendChild(create('div',{},[`${p.title} — ${p.status}`]));
      const view = create('button',{},['View']); view.addEventListener('click', ()=> viewTreatmentPlan(p.id)); card.appendChild(view);
      container.appendChild(card);
    });
  }catch(e){ container.appendChild(create('div',{},['Failed to load treatment plans'])) }
}

// Open create/edit modal
function openTreatmentPlanModal(patientId = null, existing = null){
  const user = window.APP_STATE.user || {};
  if(!['admin','dentist'].includes(user.role) && !existing){ showToast('You do not have permission to create treatment plans'); return }
  const tpl = existing || {patient_id: patientId || '', title:'', diagnosis:'', objectives:'', notes:'', status:'draft', estimated_total:0, items:[] };
  const html = document.createElement('div');
  html.innerHTML = `
    <form id="tp-form">
      <label>Patient ID<input name="patient_id" value="${tpl.patient_id||''}" required></label>
      <label>Title<input name="title" value="${tpl.title||''}" required></label>
      <label>Diagnosis<textarea name="diagnosis">${tpl.diagnosis||''}</textarea></label>
      <label>Objectives<textarea name="objectives">${tpl.objectives||''}</textarea></label>
      <label>Notes<textarea name="notes">${tpl.notes||''}</textarea></label>
      <div id="tp-items"></div>
      <div><button type="button" id="add-tp-item">Add Item</button></div>
      <div style="margin-top:8px"><button type="submit">Save Treatment Plan</button></div>
    </form>
  `;
  showModal(html.innerHTML, existing ? 'Edit Treatment Plan' : 'New Treatment Plan');
  const rootForm = document.querySelector('#tp-form');
  const itemsContainer = document.querySelector('#tp-items');
  function renderItems(items){ itemsContainer.innerHTML=''; if(!(items||[]).length) itemsContainer.appendChild(create('div',{},['No items yet'])); items.forEach((it,idx)=>{
    const row = create('div',{class:'treatment-item-row'},[]);
    row.appendChild(create('div',{},[`Tooth: ${it.tooth_number || ''} Service: ${it.service || ''} Cost: ${it.estimated_cost || 0}`]));
    const rem = create('button',{},['Remove']); rem.addEventListener('click', ()=>{ items.splice(idx,1); renderItems(items); }); row.appendChild(rem);
    itemsContainer.appendChild(row);
  }) }
  const items = existing ? (existing.items||[]) : [];
  renderItems(items);
  document.querySelector('#add-tp-item').addEventListener('click', ()=>{
    const idx = items.length;
    const item = {tooth_number:'', service:'', description:'', priority:'medium', estimated_cost:0, status:'pending'};
    items.push(item); renderItems(items);
  });
  rootForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(rootForm);
    const payload = {
      patient_id: fd.get('patient_id'), title: fd.get('title'), diagnosis: fd.get('diagnosis'), objectives: fd.get('objectives'), notes: fd.get('notes'), status: existing ? existing.status : 'draft', estimated_total: items.reduce((s,it)=>s + (Number(it.estimated_cost)||0),0), items: items
    };
    try{
      if(existing && existing.id){ await patchTreatmentPlan(existing.id, payload); showToast('Updated'); }
      else{ await postTreatmentPlan(payload); showToast('Created'); }
      closeModal();
      renderTreatmentPlans();
    }catch(err){ showToast('Failed to save treatment plan') }
  });
}

async function viewTreatmentPlan(id){
  try{
    let plan;
    try{ plan = await api(`/treatment-plans/${id}`); }
    catch(err){ if(err.status===404) plan = getFallbackPlans().find(p=>String(p.id)===String(id)); else throw err }
    if(!plan){ showToast('Plan not found'); return }
    const html = `<div><h3>${plan.title}</h3><div>Patient: ${plan.patient_name || plan.patient_id}</div><div>Status: ${plan.status}</div><div>Estimate: ${plan.estimated_total||0}</div><pre>${JSON.stringify(plan.items||[],null,2)}</pre></div>`;
    showModal(html, 'Treatment Plan');
  }catch(e){ showToast('Failed to load plan') }
}

async function updateTreatmentPlanStatus(id, status){
  try{ await patchTreatmentPlan(id, {status}); showToast('Status updated'); renderTreatmentPlans(); }
  catch(err){ showToast('Failed to update status') }
}

async function createInvoiceFromTreatmentPlan(id){
  try{
    // fetch plan
    let plan;
    try{ plan = await api(`/treatment-plans/${id}`); }catch(err){ if(err.status===404) plan = getFallbackPlans().find(p=>String(p.id)===String(id)); else throw err }
    if(!plan) { showToast('Plan not found'); return }
    const items = (plan.items||[]).map(it=>({description: it.service || it.description, amount: Number(it.estimated_cost)||0}));
    const payload = { patient_id: plan.patient_id, items: items, discount: 0, notes: `Invoice for treatment plan: ${plan.title}` };
    await api('/invoices',{method:'POST', body: payload});
    showToast('Invoice created');
  }catch(err){ showToast('Failed to create invoice') }
}

// Hook navigation
window.addEventListener('navigate', (e)=>{
  if(e.detail.page === 'treatment-plans') renderTreatmentPlans();
  if(e.detail.page === 'patient-treatment-plans'){
    const uid = window.APP_STATE.user && window.APP_STATE.user.patient_id; if(uid) renderPatientTreatmentPlans(uid);
  }
});
