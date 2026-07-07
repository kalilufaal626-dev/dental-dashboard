window.addEventListener('navigate', (e)=>{ if(e.detail.page==='settings') renderSettings(); });

async function renderSettings(){
  const c = el('#content'); clear(c);
  c.appendChild(create('h2',{},['Settings']));
  const user = window.APP_STATE.user || {};
  const ul = create('div',{},[`Logged in as: ${user.email || 'N/A'} (${user.role || ''})`]);
  c.appendChild(ul);
  const health = create('button',{},['API Health Check']);
  health.addEventListener('click', async ()=>{
    try{ const h = await api('/health'); showToast('API: '+JSON.stringify(h)); }
    catch(e){ showToast('Health check failed') }
  });
  c.appendChild(health);
  const clear = create('button',{},['Clear Session']); clear.addEventListener('click', ()=> logout()); c.appendChild(clear);
  c.appendChild(create('div',{},['Version: '+APP_VERSION]));
}
