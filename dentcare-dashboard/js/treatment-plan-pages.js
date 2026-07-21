// Compatibility helpers and page routing for the reusable treatment-plan module.
window.role = window.role || function role(){ return window.APP_STATE.user?.role || null; };
window.esc = window.esc || function esc(value){
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[char]);
};
window.fmtMoney = window.fmtMoney || function fmtMoney(value){
  return `D${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
window.statusBadge = window.statusBadge || function statusBadge(status){
  return ['completed','active','approved','paid'].includes(status) ? 'badge-green' :
    ['cancelled','rejected'].includes(status) ? 'badge-rose' : 'badge-gray';
};
window.toast = window.toast || function toast(message){ showToast(message); };

window.addEventListener('navigate', async (event) => {
  if (event.detail.page !== 'treatment-plans') return;
  await renderTreatmentPlansPage();
});

async function renderTreatmentPlansPage(){
  const container = el('#content');
  clear(container);
  container.appendChild(create('h2', {}, ['Treatment Plans']));
  const list = create('div', {}, ['Loading treatment plans...']);
  container.appendChild(list);

  try{
    const plans = await fetchTreatmentPlans();
    clear(list);
    if(!(plans || []).length){
      list.appendChild(create('div', { class:'card' }, ['No treatment plans found.']));
      return;
    }
    plans.forEach(plan => {
      const card = create('div', { class:'card' }, []);
      card.appendChild(create('h3', {}, [plan.title || 'Untitled Treatment Plan']));
      card.appendChild(create('div', {}, [`Patient: ${plan.patient_name || plan.patient_id || 'N/A'}`]));
      if(plan.diagnosis) card.appendChild(create('div', {}, [`Diagnosis: ${plan.diagnosis}`]));
      card.appendChild(create('div', {}, [`Status: ${plan.status || 'draft'}`]));
      card.appendChild(create('div', {}, [`Estimated total: ${fmtMoney(plan.estimated_total || 0)}`]));
      const view = create('button', {}, ['View']);
      view.addEventListener('click', () => viewTreatmentPlan(plan.id));
      card.appendChild(view);
      list.appendChild(card);
    });
  }catch(error){
    clear(list);
    list.appendChild(create('div', { class:'card' }, [error.message || 'Failed to load treatment plans']));
  }
}
