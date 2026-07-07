// App bootstrap
document.addEventListener('DOMContentLoaded', ()=>{
  // login form
  const loginForm = el('#login-form');
  if(loginForm) loginForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = el('#login-email').value;
    const pw = el('#login-password').value;
    try{ await login(email,pw); openApp(); }
    catch(e){}
  });
  const openReg = el('#open-register'); if(openReg) openReg.addEventListener('click', openPatientRegister);

  // if already logged in
  if(window.APP_STATE.token && window.APP_STATE.user){
    openApp();
  }else{
    show(el('#login-view'));
    hide(el('#app'));
  }

  window.addEventListener('auth:login', ()=> openApp());
});

function openApp(){
  hide(el('#login-view'));
  show(el('#app'));
  buildSidebar();
  // set topbar
  const top = el('#topbar'); clear(top);
  const user = window.APP_STATE.user || {};
  top.appendChild(create('div',{},[`Signed in as ${user.email||user.name||''} (${user.role||''})`]));
  // navigate to default
  const def = defaultPageForUser();
  showPage(def);
}
