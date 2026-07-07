// Authentication handling
window.addEventListener('session:expired', ()=>{
  // lazy: wait for auth to load
  try{ logout(true) }catch(e){ console.warn('session expired - auth not ready') }
});

async function login(email, password){
  try{
    const data = await api('/auth/login',{method:'POST', body:{email,password}});
    if(data.token){
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.APP_STATE.token = data.token;
      window.APP_STATE.user = data.user;
      window.dispatchEvent(new CustomEvent('auth:login', {detail: data.user}));
      showToast('Signed in successfully');
      return data.user;
    }else{
      throw new Error('Invalid login response');
    }
  }catch(err){
    console.error(err);
    showToast(err.message || 'Login failed');
    throw err;
  }
}

function logout(silent){
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.APP_STATE.token = null;
  window.APP_STATE.user = null;
  if(!silent) showToast('Logged out');
  // reload to show login
  setTimeout(()=>{ window.location.reload() }, 200);
}

// Patient self-register modal
function openPatientRegister(){
  const html = `
    <form id="patient-register-form">
      <label>Patient ID<input name="patient_id" required></label>
      <label>Email<input type="email" name="email" required></label>
      <label>Phone<input name="phone"></label>
      <label>Password<input type="password" name="password" required></label>
      <label>Confirm Password<input type="password" name="confirm_password" required></label>
      <div style="margin-top:8px"><button type="submit">Register</button></div>
    </form>
  `;
  showModal(html, 'Patient Registration');
  const form = document.querySelector('#patient-register-form');
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      patient_id: fd.get('patient_id'),
      email: fd.get('email'),
      phone: fd.get('phone'),
      password: fd.get('password'),
      confirm_password: fd.get('confirm_password')
    };
    if(payload.password !== payload.confirm_password){ showToast('Passwords do not match'); return }
    try{
      const res = await api('/auth/patient-register',{method:'POST', body:payload});
      closeModal();
      el('#login-email').value = payload.email;
      showToast('Registration successful. Please login.');
    }catch(err){ showToast(err.message || 'Registration failed') }
  });
}
