window.addEventListener('navigate', async (e)=>{
  if(e.detail.page !== 'billing') return;
  await renderBilling();
});

async function renderBilling(){
  const container = el('#content'); clear(container);
  container.appendChild(create('h2',{},['Billing']));
  try{
    const inv = await api('/invoices');
    if((inv||[]).length===0) container.appendChild(create('div',{},['No records available yet.']));
    inv.forEach(i=>{
      const node = create('div',{class:'card'},[]);
      node.appendChild(create('div',{},[`Invoice #${i.id} — ${i.patient_name || i.patient_id} — ${i.status || ''}`]));
      const pay = create('button',{},['Record Payment']);
      pay.addEventListener('click', async ()=>{
        try{ await api(`/invoices/${i.id}/pay`,{method:'PATCH'}); showToast('Payment recorded'); renderBilling(); }
        catch(e){ showToast('Failed to record payment') }
      });
      node.appendChild(pay);
      container.appendChild(node);
    });
  }catch(e){ container.appendChild(create('div',{},['Failed to load invoices'])) }
}
