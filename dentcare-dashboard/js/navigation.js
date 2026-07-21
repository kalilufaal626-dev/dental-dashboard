// Render sidebar and handle page changes
function buildSidebar(){
  const side = el('#sidebar'); clear(side);
  const user = window.APP_STATE.user;
  const role = user && user.role ? user.role : 'patient';
  const allowed = ROLE_PERMISSIONS[role] || [];
  NAV_CONFIG.forEach(item => {
    if(allowed.includes(item.id)){
      const node = create('div',{class:'nav-item',html:`${item.icon} ${item.label}`});
      node.addEventListener('click', ()=> showPage(item.id));
      side.appendChild(node);
    }
  });
  // add logout
  const logoutBtn = create('div',{class:'nav-item',html:'Logout'});
  logoutBtn.addEventListener('click', ()=> logout());
  side.appendChild(logoutBtn);
}

function showPage(page, params){
  const user = window.APP_STATE.user;
  const role = user && user.role ? user.role : 'patient';
  const allowed = ROLE_PERMISSIONS[role] || [];
  if(!allowed.includes(page)){
    showToast('You do not have permission to view this page');
    return;
  }
  window.APP_STATE.page = page;
  el('#content').innerHTML = `<h2>${PAGE_TITLES[page] || page}</h2>`;
  // dispatch page event
  window.dispatchEvent(new CustomEvent('navigate', {detail:{page,params}}));
}

// Default page choice
function defaultPageForUser(){
  const user = window.APP_STATE.user;
  if(!user) return 'dashboard';
  if(user.role === 'patient') return 'patient-home';
  return 'dashboard';
}
