// Dashboard rendering
window.addEventListener('navigate', async (e)=>{
  if(e.detail.page !== 'dashboard') return;
  await renderDashboard();
});

async function renderDashboard(){
  const container = el('#content');
  clear(container);
  const user = window.APP_STATE.user || {};
  const wrap = create('div',{},[]);
  const title = create('h2',{},[PAGE_TITLES['dashboard'] || 'Dashboard']);
  wrap.appendChild(title);

  // Try /stats for admin
  try{
    const stats = await api('/stats');
    const statsCard = create('div',{class:'card'},[create('pre',{html:JSON.stringify(stats,null,2)})]);
    wrap.appendChild(statsCard);
  }catch(err){
    // non-admin may not access /stats — show role-based overview
    const appts = create('div',{class:'card',html:'<strong>Today\'s appointments</strong>'});
    wrap.appendChild(appts);
    // attempt to fetch appointments
    try{
      const data = await api('/appointments');
      const list = create('div',{},[]);
      (data || []).slice(0,10).forEach(a=>{
        list.appendChild(create('div',{},[`${a.time || a.date || ''} — ${a.patient_name || a.patient_id || a.id}`]));
      });
      appts.appendChild(list);
    }catch(err){ appts.appendChild(create('div',{},['No appointments available'])) }
  }

  try{
    const xrays = await fetchAllXRays();
    const recent = (xrays||[]).slice(0,3);
    const xcard = create('div',{class:'card'},['Recent X-Rays']);
    if(!recent.length) xcard.appendChild(create('div',{},['No X-rays available']));
    recent.forEach(x=>{
      const line = create('div',{},[`${x.patient_id || x.patient_name || 'Patient'} — ${formatXRayDate(x.taken_date||x.created_at)} `]);
      if(x.image) line.appendChild(create('img',{src:getXRayImageSrc(x),style:'width:48px;height:48px;object-fit:cover;margin-left:8px;'}));
      xcard.appendChild(line);
    });
    wrap.appendChild(xcard);
  }catch(e){ }
  container.appendChild(wrap);
}
