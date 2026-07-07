window.addEventListener('navigate', async (e)=>{
  if(e.detail.page !== 'pharmacy') return;
  await renderPharmacy();
});

async function renderPharmacy(){
  const container = el('#content'); clear(container);
  container.appendChild(create('h2',{},['Pharmacy']));
  try{
    const drugs = await api('/drugs');
    if((drugs||[]).length===0) container.appendChild(create('div',{},['No records available yet.']));
    drugs.forEach(d => {
      const node = create('div',{class:'card'},[]);
      node.appendChild(create('div',{},[d.name+' — Stock: '+(d.stock||0)]));
      if(d.expiry_date && new Date(d.expiry_date) < new Date(Date.now() + 1000*60*60*24*30)){
        node.appendChild(create('div',{},['Expiry soon']));
      }
      if(window.APP_STATE.user && ['pharmacist','admin'].includes(window.APP_STATE.user.role)){
        const upd = create('button',{},['Update Stock']);
        upd.addEventListener('click', async ()=>{
          const qty = prompt('New stock quantity', String(d.stock||0));
          if(qty!=null) await api(`/drugs/${d.id}`,{method:'PATCH', body:{stock:Number(qty)}}).then(()=>{ showToast('Updated'); renderPharmacy() }).catch(()=>showToast('Failed'));
        });
        node.appendChild(upd);
      }
      container.appendChild(node);
    });
  }catch(e){ container.appendChild(create('div',{},['Failed to load drugs'])) }
}
