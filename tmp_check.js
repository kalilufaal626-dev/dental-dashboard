
// =====================================================================
// CONFIG / SESSION
// =====================================================================
const API_BASE = 'https://dental-92vv.onrender.com';let TOKEN = localStorage.getItem('dc_token') || null;
let USER  = JSON.parse(localStorage.getItem('dc_user') || 'null');
let CURRENT_PATIENT_ID = null;
let REPORT_MODE = 'card'; // 'card' | 'referral' — which document renderReportCard builds
let CACHE = { patients: [], staff: [], services: [] };
let BILL_ITEMS = [];

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;
  const res = await fetch(API_BASE + path, { ...opts, headers });
  let data = null;
  try { data = await res.json(); } catch {}
  if (res.status === 401) { logout(); throw new Error('Session expired — please sign in again'); }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}
function esc(s){ return (s===null||s===undefined)?'':String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtMoney(n){ return 'D' + Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function toast(msg,type=''){
  const wrap=document.getElementById('toasts');
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.innerHTML=`${type==='s'?'✅':type==='e'?'❌':'ℹ️'} ${esc(msg)}`;
  wrap.appendChild(el);
  setTimeout(()=>el.remove(),3500);
}

// =====================================================================
// PERMISSIONS — single source of truth for pages AND action buttons
// =====================================================================
const PERMISSIONS = {
  admin: {
    pages:['dashboard','appointments','patients','patient-profile','prescriptions','pharmacy','billing','staff','reports','report-card'],
    actions:['book-appt','add-patient','update-tooth','create-invoice','pay-invoice','add-drug','add-staff','write-rx','dispense-rx','add-record','add-xray']
  },
  dentist: {
    pages:['dashboard','appointments','patients','patient-profile','prescriptions','reports','report-card'],
    actions:['book-appt','add-patient','update-tooth','write-rx','add-record','add-xray']
  },
  receptionist: {
    pages:['dashboard','appointments','patients','patient-profile','billing','reports','report-card'],
    actions:['book-appt','add-patient','create-invoice','pay-invoice']
  },
  pharmacist: {
    pages:['dashboard','pharmacy','prescriptions'],
    actions:['add-drug','dispense-rx']
  },
  nurse: {
    pages:['dashboard','appointments','patients','patient-profile'],
    actions:['add-record']
  },
  patient: {
    pages:['patient-home','appointments','patient-profile','billing','report-card'],
    actions:['book-appt']
  },
};
function role(){ return USER ? USER.role : null; }
function canAccessPage(page){ return !!(PERMISSIONS[role()] && PERMISSIONS[role()].pages.includes(page)); }
function canDo(action){ return !!(PERMISSIONS[role()] && PERMISSIONS[role()].actions.includes(action)); }

// =====================================================================
// NAV CONFIG
// =====================================================================
const NAV_CFG = {
  admin:[
    {s:'Main'},{id:'dashboard',icon:'📊',lbl:'Dashboard'},
    {id:'appointments',icon:'📅',lbl:'Appointments'},
    {id:'patients',icon:'👤',lbl:'Patients'},
    {s:'Clinical'},{id:'prescriptions',icon:'💊',lbl:'Prescriptions'},
    {s:'Admin'},{id:'pharmacy',icon:'🏪',lbl:'Pharmacy'},
    {id:'billing',icon:'💰',lbl:'Billing'},{id:'staff',icon:'👥',lbl:'Staff'},
    {id:'reports',icon:'🖨️',lbl:'Reports'},
  ],
  dentist:[
    {s:'My Patients'},{id:'dashboard',icon:'📊',lbl:'Dashboard'},
    {id:'appointments',icon:'📅',lbl:'Appointments'},{id:'patients',icon:'👤',lbl:'Patients'},
    {id:'prescriptions',icon:'💊',lbl:'Prescriptions'},{id:'reports',icon:'🖨️',lbl:'Reports'},
  ],
  receptionist:[
    {s:'Front Desk'},{id:'dashboard',icon:'📊',lbl:'Dashboard'},
    {id:'appointments',icon:'📅',lbl:'Appointments'},{id:'patients',icon:'👤',lbl:'Patients'},
    {id:'billing',icon:'💰',lbl:'Billing'},
  ],
  pharmacist:[
    {s:'Pharmacy'},{id:'dashboard',icon:'📊',lbl:'Dashboard'},
    {id:'pharmacy',icon:'🏪',lbl:'Drug Inventory'},{id:'prescriptions',icon:'💊',lbl:'Prescriptions'},
  ],
  nurse:[
    {s:'Care'},{id:'dashboard',icon:'📊',lbl:'Dashboard'},
    {id:'appointments',icon:'📅',lbl:'Appointments'},{id:'patients',icon:'👤',lbl:'Patients'},
  ],
  patient:[
    {s:'My Portal'},{id:'patient-home',icon:'🏠',lbl:'My Dashboard'},
    {id:'appointments',icon:'📅',lbl:'My Appointments'},{id:'patient-profile',icon:'🦷',lbl:'My Dental Record'},
    {id:'billing',icon:'💰',lbl:'My Bills'},
  ],
};
const PAGE_TITLES = {
  dashboard:'Dashboard','patient-home':'My Dashboard', appointments:'Appointments', patients:'Patients',
  'patient-profile':'Patient Profile', billing:'Billing', pharmacy:'Pharmacy', prescriptions:'Prescriptions',
  staff:'Staff', reports:'Reports', 'report-card':'Printable Report Card',
};

// =====================================================================
// AUTH
// =====================================================================
async function doLogin() {
  const email = document.getElementById('li-email').value.trim();
  const password = document.getElementById('li-pass').value;
  const errEl = document.getElementById('auth-err');
  const btn = document.getElementById('login-btn');
  errEl.style.display = 'none';
  if (!email || !password) { errEl.textContent = 'Email and password required'; errEl.style.display='block'; return; }
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const data = await api('/auth/login', { method:'POST', body: JSON.stringify({ email, password }) });
    TOKEN = data.token; USER = data.user;
    localStorage.setItem('dc_token', TOKEN);
    localStorage.setItem('dc_user', JSON.stringify(USER));
    enterApp();
  } catch(e) {
    errEl.textContent = e.message || 'Login failed'; errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Sign in →';
  }
}
function logout(){
  TOKEN = null; USER = null;
  localStorage.removeItem('dc_token'); localStorage.removeItem('dc_user');
  document.getElementById('auth-wrap').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}
function enterApp(){
  document.getElementById('auth-wrap').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('sb-name').textContent = USER.full_name;
  document.getElementById('sb-role').textContent = USER.role;
  document.getElementById('sb-av').textContent = (USER.full_name||'U').charAt(0).toUpperCase();
  document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  buildNav();
  buildNotifications();
  showPage(role() === 'patient' ? 'patient-home' : 'dashboard');
}
if (TOKEN && USER) enterApp();

// =====================================================================
// NAVIGATION BUILDER
// =====================================================================
function buildNav(){
  const nav = document.getElementById('sb-nav');
  const cfg = NAV_CFG[role()] || [];
  nav.innerHTML = cfg.map(i => i.s ? `<div class="sb-sec">${i.s}</div>`
    : `<div class="nav-item" id="nav-${i.id}" onclick="showPage('${i.id}')"><span class="nav-icon">${i.icon}</span>${i.lbl}</div>`).join('');
}

async function showPage(page, param){
  if (!canAccessPage(page)) { toast(`Your role (${role()}) doesn't have access to that page`,'e'); return; }
  if (page === 'patient-profile' && param) CURRENT_PATIENT_ID = param;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const pe = document.getElementById(`page-${page}`); if (pe) pe.classList.add('active');
  const ne = document.getElementById(`nav-${page}`); if (ne) ne.classList.add('active');
  document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;
  closeSidebar();
  if (document.getElementById('notif-panel').classList.contains('open')) toggleNotif();
  try {
    if (page==='dashboard') await renderDashboard();
    else if (page==='patient-home') await renderPatientHome();
    else if (page==='appointments') await renderAppointments();
    else if (page==='patients') await renderPatients();
    else if (page==='patient-profile') await renderProfile();
    else if (page==='billing') await renderBilling();
    else if (page==='pharmacy') await renderPharmacy();
    else if (page==='prescriptions') await renderPrescriptions();
    else if (page==='staff') await renderStaff();
    else if (page==='reports') await renderReports();
    else if (page==='report-card') await renderReportCard();
  } catch(e) {
    document.getElementById(`page-${page}`).innerHTML = `<div class="empty"><div class="ei">⚠️</div><h3>Couldn't load this page</h3><p>${esc(e.message)}</p></div>`;
  }
}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('sb-overlay').classList.toggle('open');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sb-overlay').classList.remove('open');}
function toggleNotif(){document.getElementById('notif-panel').classList.toggle('open');}
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');}));
function statusBadge(s){ return {completed:'badge-green','in-progress':'badge-amber',scheduled:'badge-blue',confirmed:'badge-blue',cancelled:'badge-rose',no_show:'badge-rose',paid:'badge-green',partial:'badge-amber',unpaid:'badge-rose',dispensed:'badge-green',pending:'badge-amber',active:'badge-green',inactive:'badge-gray'}[s]||'badge-gray'; }

// =====================================================================
// NOTIFICATIONS (built from real low-stock + pending-rx data)
// =====================================================================
async function buildNotifications(){
  const list = document.getElementById('notif-list');
  const dot = document.getElementById('notif-dot');
  if (role() === 'patient') {
    try {
      const appts = await api('/appointments');
      const upcoming = appts.filter(a=>['scheduled','confirmed'].includes(a.status));
      list.innerHTML = upcoming.length ? upcoming.slice(0,5).map(a=>`
        <div class="notif-item"><div class="notif-icon" style="background:var(--teal-light);">📅</div>
          <div><h4>Upcoming appointment</h4><p>${esc(a.treatment)} — ${esc(a.date)} ${esc(a.time.slice(0,5))}</p></div></div>`).join('')
        : `<div class="empty"><div class="ei">🔔</div><h3>No notifications</h3></div>`;
      dot.style.display = upcoming.length ? 'block' : 'none';
    } catch { list.innerHTML = `<div class="empty"><div class="ei">🔔</div><h3>No notifications</h3></div>`; }
    return;
  }
  try {
    const [lowDrugs, pendingRx] = await Promise.all([
      api('/drugs?low_stock=true').catch(()=>[]),
      api('/prescriptions?status=pending').catch(()=>[]),
    ]);
    const items = [
      ...lowDrugs.slice(0,3).map(d=>({icon:'🚨',bg:'var(--rose-light)',title:'Low drug stock',msg:`${d.name} — ${d.stock} units left`})),
      ...pendingRx.slice(0,3).map(r=>({icon:'💊',bg:'var(--amber-light)',title:'Prescription pending',msg:`${r.patient_name} — ${r.drug_name}`})),
    ];
    list.innerHTML = items.length ? items.map(n=>`
      <div class="notif-item"><div class="notif-icon" style="background:${n.bg};">${n.icon}</div><div><h4>${esc(n.title)}</h4><p>${esc(n.msg)}</p></div></div>`).join('')
      : `<div class="empty"><div class="ei">✅</div><h3>All caught up</h3></div>`;
    dot.style.display = items.length ? 'block' : 'none';
  } catch { list.innerHTML = `<div class="empty"><div class="ei">🔔</div><h3>No notifications</h3></div>`; }
}

// =====================================================================
// DASHBOARD
// =====================================================================
async function renderDashboard(){
  const el = document.getElementById('page-dashboard');
  el.innerHTML = '<div class="spinner">Loading dashboard…</div>';
  if (role() === 'admin') {
    const stats = await api('/stats');
    el.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card" style="--sc:var(--teal);--sb:var(--teal-light);"><div class="stat-icon">📅</div><div class="stat-label">Appointments Today</div>
          <div class="stat-value">${stats.today_appointments.total}</div><div class="stat-sub">${stats.today_appointments.completed} completed · ${stats.today_appointments.pending} pending · ${stats.today_appointments.cancelled} cancelled</div></div>
        <div class="stat-card" style="--sc:var(--green);--sb:var(--green-light);"><div class="stat-icon">💰</div><div class="stat-label">Revenue Today</div>
          <div class="stat-value">${fmtMoney(stats.revenue.collected_today)}</div><div class="stat-sub">${fmtMoney(stats.revenue.outstanding)} outstanding</div></div>
        <div class="stat-card" style="--sc:var(--rose);--sb:var(--rose-light);"><div class="stat-icon">💊</div><div class="stat-label">Low Stock Drugs</div>
          <div class="stat-value">${stats.low_stock_drugs}</div><div class="stat-sub">${stats.low_stock_drugs>0?'Needs reordering':'All good'}</div></div>
        <div class="stat-card" style="--sc:var(--purple);--sb:var(--purple-light);"><div class="stat-icon">📋</div><div class="stat-label">Total Patients</div>
          <div class="stat-value">${stats.total_patients}</div><div class="stat-sub">${stats.pending_prescriptions} prescriptions pending</div></div>
      </div>
      <div class="card"><div class="card-header"><span class="card-title">📅 Today's Appointments</span><button class="btn btn-teal btn-sm" onclick="showPage('appointments')">View all →</button></div>
        <div class="card-body" id="dash-appts"><div class="spinner">Loading…</div></div></div>`;
  } else {
    el.innerHTML = `<div class="card"><div class="card-header"><span class="card-title">📅 Today's Appointments</span><button class="btn btn-teal btn-sm" onclick="showPage('appointments')">View all →</button></div>
      <div class="card-body" id="dash-appts"><div class="spinner">Loading…</div></div></div>`;
  }
  const appts = await api(`/appointments?date=${todayISO()}`);
  document.getElementById('dash-appts').innerHTML = renderApptList(appts);
}
function renderApptList(appts){
  if (!appts.length) return `<div class="empty"><div class="ei">📅</div><h3>No appointments</h3><p>Nothing scheduled for today.</p></div>`;
  return appts.map(a=>`
    <div class="appt-card"><div class="appt-time"><div class="t">${esc(a.time.slice(0,5))}</div></div>
      <div class="appt-info"><h4>${esc(a.patient_name||'')}</h4><p>${esc(a.treatment)}</p><div class="doc">${esc(a.doctor_name||'—')}</div></div>
      <span class="badge ${statusBadge(a.status)}">${esc(a.status)}</span></div>`).join('');
}

// =====================================================================
// PATIENT PORTAL HOME
// =====================================================================
async function renderPatientHome(){
  const el = document.getElementById('page-patient-home');
  el.innerHTML = '<div class="spinner">Loading…</div>';
  const [appts, rx, invoices] = await Promise.all([api('/appointments'), api('/prescriptions'), api('/invoices')]);
  const upcoming = appts.filter(a=>['scheduled','confirmed'].includes(a.status));
  el.innerHTML = `
    <div style="background:linear-gradient(135deg,var(--teal-dark),var(--blue));border-radius:14px;padding:22px;margin-bottom:20px;color:#fff;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      <div style="width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;border:3px solid rgba(255,255,255,.3);">${(USER.full_name||'P').charAt(0)}</div>
      <div style="flex:1;"><h2 style="font-size:19px;font-weight:800;margin-bottom:3px;">Welcome, ${esc(USER.full_name)}</h2>
        <p style="opacity:.75;font-size:13px;">${upcoming.length?`Next appointment: ${esc(upcoming[0].date)} at ${esc(upcoming[0].time.slice(0,5))}`:'No upcoming appointments'}</p></div>
      <button class="btn btn-sm" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.3);" onclick="openBookApptModal()">📅 Book</button>
    </div>
    <div class="two-col">
      <div class="card"><div class="card-header"><span class="card-title">📅 My Appointments</span></div><div class="card-body">${renderApptList(appts)}</div></div>
      <div>
        <div class="card"><div class="card-header"><span class="card-title">💊 My Prescriptions</span></div>
          <div class="card-body">${rx.length?rx.map(r=>`<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f1f5f9;">
            <div><strong style="font-size:13px;">${esc(r.drug_name)}</strong><div style="font-size:11px;color:var(--text-2);">${esc(r.dosage)} · ${esc(r.frequency)} · ${esc(r.duration)}</div></div>
            <span class="badge ${statusBadge(r.status)}">${esc(r.status)}</span></div>`).join(''):`<div class="empty"><div class="ei">💊</div><h3>No prescriptions</h3></div>`}</div></div>
        <div class="card"><div class="card-header"><span class="card-title">💰 My Bills</span></div>
          <div class="card-body">${invoices.length?invoices.map(i=>`<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f1f5f9;">
            <strong style="font-size:13px;">${esc(i.invoice_no)}</strong><span>${fmtMoney(i.total)}</span><span class="badge ${statusBadge(i.status)}">${esc(i.status)}</span></div>`).join(''):`<div class="empty"><div class="ei">💰</div><h3>No bills</h3></div>`}</div></div>
      </div>
    </div>`;
}
  function openPatientSignup(){
    document.getElementById('m-patient-signup-inner').innerHTML = `
    <div class="modal-header">
      <h2>👤 Create Patient Account</h2>
      <button class="modal-close" onclick="closeModal('m-patient-signup')">✕</button>
    </div>
    <div class="fg">
      <label>Patient ID *</label>
      <input type="text" id="ps-patient-id" placeholder="PAT-000001">
    </div>
    <div class="fg">
      <label>Email *</label>
      <input type="email" id="ps-email" placeholder="you@example.com">
    </div>
    <div class="fg">
      <label>Phone</label>
      <input type="text" id="ps-phone" placeholder="+220...">
    </div>
    <div class="fg">
      <label>Password *</label>
      <input type="password" id="ps-password">
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn btn-outline" onclick="closeModal('m-patient-signup')">Cancel</button>
      <button class="btn btn-teal" onclick="submitPatientSignup()">Create Account</button>
    </div>
  `;
    openModal('m-patient-signup');
  }

  async function submitPatientSignup(){
    const body = {
      patient_id: document.getElementById('ps-patient-id').value.trim(),
      email: document.getElementById('ps-email').value.trim(),
      phone: document.getElementById('ps-phone').value.trim(),
      password: document.getElementById('ps-password').value
    };
    if (!body.patient_id || !body.email || !body.password) {
      toast('Patient ID, email and password are required','e');
      return;
    }
    try {
      await api('/auth/patient-register', {
        method:'POST',
        body: JSON.stringify(body)
      });
      closeModal('m-patient-signup');
      toast('Account created. You can now sign in.','s');
      document.getElementById('li-email').value = body.email;
      document.getElementById('li-pass').value = body.password;
    } catch(e){
      toast(e.message,'e');
    }
  }

// =====================================================================
// APPOINTMENTS
// =====================================================================
async function renderAppointments(){
  const el = document.getElementById('page-appointments');
  const isPatient = role() === 'patient';
  el.innerHTML = `
    <div class="sec-hdr">
      ${!isPatient ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input type="date" class="search-input" id="appt-date-f" style="width:170px;">
        <select class="search-input" id="appt-status-f" style="width:150px;">
          <option value="">All statuses</option>
          ${['scheduled','confirmed','in-progress','completed','cancelled','no_show'].map(s=>`<option value="${s}">${s}</option>`).join('')}
        </select>
        <button class="btn btn-outline btn-sm" onclick="filterAppts()">Filter</button>
        <button class="btn btn-outline btn-sm" onclick="renderAppointments()">Clear</button>
      </div>` : '<span></span>'}
      ${canDo('book-appt') ? `<button class="btn btn-teal" onclick="openBookApptModal()">+ ${isPatient?'Request':'Book'} Appointment</button>` : ''}
    </div>
    <div class="card"><div class="card-header"><span class="card-title">Appointments</span></div><div id="appt-table"><div class="spinner">Loading…</div></div></div>`;
  await filterAppts();
}
async function filterAppts(){
  const isPatient = role() === 'patient';
  const params = new URLSearchParams();
  if (!isPatient) {
    const d = document.getElementById('appt-date-f')?.value; if (d) params.set('date', d);
    const s = document.getElementById('appt-status-f')?.value; if (s) params.set('status', s);
  }
  const q = params.toString();
  const appts = await api(`/appointments${q?'?'+q:''}`);
  window.__APPOINTMENTS = appts;
  document.getElementById('appt-table').innerHTML = appts.length ? `
    <table><thead><tr><th>Date</th><th>Time</th>${isPatient?'':'<th>Patient</th>'}<th>Treatment</th><th>Doctor</th><th>Status</th>${isPatient?'':'<th></th>'}</tr></thead>
    <tbody>${appts.map(a=>`<tr onclick="showAppointmentDetails(${a.id})" style="cursor:pointer;">
      <td>${esc(a.date)}</td><td><strong>${esc(a.time.slice(0,5))}</strong></td>
      ${isPatient?'':`<td>${esc(a.patient_name)}</td>`}
      <td>${esc(a.treatment)}</td><td style="font-size:12px;color:var(--text-2);">${esc(a.doctor_name||'—')}</td>
      <td><span class="badge ${statusBadge(a.status)}">${esc(a.status)}</span></td>
      ${isPatient?'':`<td><select class="search-input" style="padding:5px 8px;font-size:11px;" onchange="updateApptStatus(${a.id},this.value)">
        <option value="">Set status…</option>${['scheduled','confirmed','in-progress','completed','cancelled','no_show'].map(s=>`<option value="${s}">${s}</option>`).join('')}
      </select></td>`}
    </tr>`).join('')}</tbody></table>` : `<div class="empty"><div class="ei">📅</div><h3>No appointments found</h3></div>`;
}
async function updateApptStatus(id, status){
  await setAppointmentStatus(id, status);
}
async function setAppointmentStatus(id, status, options = {}){
  if (!status) return;
  try {
    await api(`/appointments/${id}`, { method:'PATCH', body: JSON.stringify({ status }) });
    toast(`Appointment ${status.replace('_',' ')}.`, 's');
    if (options.closeModal) closeModal('m-appt-details');
    filterAppts();
  } catch(e){ toast(e.message,'e'); }
}
function openAppointmentPatientProfile(id){
  const appts = window.__APPOINTMENTS || [];
  const appointment = appts.find(a=>String(a.id) === String(id));
  const patientId = appointment ? appointment.patient_id : null;
  if (!patientId) { toast('Patient data not available','e'); return; }
  showPage('patient-profile', patientId);
}
function editAppointment(id){
  const appts = window.__APPOINTMENTS || [];
  const appointment = appts.find(a=>String(a.id) === String(id));
  if (!appointment) { toast('Appointment not found','e'); return; }
  openBookApptModal(appointment);
}
async function completeAppointment(id){
  await setAppointmentStatus(id, 'completed', { closeModal: true });
}
async function cancelAppointment(id){
  await setAppointmentStatus(id, 'cancelled', { closeModal: true });
}
function printAppointmentSlip(id){
  const appts = window.__APPOINTMENTS || [];
  const appointment = appts.find(a=>String(a.id) === String(id));
  if (!appointment) { toast('Appointment not found','e'); return; }
  const content = `
    <html><head><title>Appointment Slip</title>
      <style>body{font-family:Arial,sans-serif;padding:18px;}h1{font-size:20px;}p{margin:8px 0;} .label{font-weight:700;}</style>
    </head><body>
      <h1>Appointment Slip</h1>
      <p><span class="label">Patient:</span> ${esc(appointment.patient_name || appointment.patient_id || 'N/A')}</p>
      <p><span class="label">Dentist:</span> ${esc(appointment.doctor_name || 'N/A')}</p>
      <p><span class="label">Treatment:</span> ${esc(appointment.treatment || 'N/A')}</p>
      <p><span class="label">Date:</span> ${esc(appointment.date || 'N/A')}</p>
      <p><span class="label">Time:</span> ${esc(appointment.time || 'N/A')}</p>
      <p><span class="label">Status:</span> ${esc(appointment.status || 'N/A')}</p>
      ${appointment.notes ? `<p><span class="label">Notes:</span> ${esc(appointment.notes)}</p>` : ''}
      <p style="margin-top:22px;font-size:12px;color:#666;">Generated from DentCare Pro</p>
    </body></html>
  `;
  const printWindow = window.open('', '_blank');
  if (!printWindow) { toast('Unable to open print window','e'); return; }
  printWindow.document.write(content);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
function showAppointmentDetails(id){
  const appts = window.__APPOINTMENTS || [];
  const appointment = appts.find(a=>String(a.id) === String(id));
  if(!appointment){ toast('Appointment not found','e'); return; }
  const html = `
    <div class="modal-header"><h2>Appointment Details</h2><button class="modal-close" onclick="closeModal('m-appt-details')">✕</button></div>
    <div class="fg"><strong>Patient:</strong> ${esc(appointment.patient_name || appointment.patient_id || 'N/A')}</div>
    <div class="fg"><strong>Dentist:</strong> ${esc(appointment.doctor_name || 'N/A')}</div>
    <div class="fg"><strong>Treatment:</strong> ${esc(appointment.treatment || 'N/A')}</div>
    <div class="fg"><strong>Date:</strong> ${esc(appointment.date || 'N/A')}</div>
    <div class="fg"><strong>Time:</strong> ${esc(appointment.time || 'N/A')}</div>
    <div class="fg"><strong>Status:</strong> ${esc(appointment.status || 'N/A')}</div>
    ${appointment.notes ? `<div class="fg"><strong>Notes:</strong> ${esc(appointment.notes)}</div>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:18px;justify-content:flex-end;">
      <button class="btn btn-outline" onclick="openAppointmentPatientProfile(${appointment.id})">Open Patient</button>
      <button class="btn btn-outline" onclick="editAppointment(${appointment.id})">Edit</button>
      <button class="btn btn-teal" onclick="completeAppointment(${appointment.id})">Complete</button>
      <button class="btn btn-outline" onclick="cancelAppointment(${appointment.id})">Cancel</button>
      <button class="btn btn-outline" onclick="printAppointmentSlip(${appointment.id})">Print Appointment</button>
    </div>
  `;
  document.getElementById('m-appt-details-inner').innerHTML = html;
  openModal('m-appt-details');
}
async function openBookApptModal(appointment = null){
  const isPatient = role() === 'patient';
  const editMode = !!appointment;
  window.__EDIT_APPOINTMENT = appointment;
  let patientsOpts = '', doctorsOpts = '', doctorsWarning = '';
  if (!isPatient) {
    try { const patients = await api('/patients'); CACHE.patients = patients;
      patientsOpts = patients.map(p=>`<option value="${p.id}" ${appointment && String(p.id)===String(appointment.patient_id)?'selected':''}>${esc(p.full_name)} (${esc(p.patient_id)})</option>`).join(''); }
    catch { patientsOpts = '<option value="">Failed to load patients</option>'; }
  }
  try {    let dentists = [];    try {      dentists = await api('/dentists');    } catch {      if (!isPatient) {        const staff = await api('/staff');        dentists = staff.filter(s => s.role === 'dentist');      } else {        throw new Error('Dentist list is not available for patient booking yet.');      }    }    doctorsOpts = dentists.map(d=>`<option value="${d.id}" ${appointment && String(d.id)===String(appointment.doctor_id)?'selected':''}>${esc(d.full_name)}${d.specialization?' — '+esc(d.specialization):''}</option>`).join('');  }  catch {    doctorsWarning = `<div class="notice notice-amber">Couldn't load the dentist list. Add GET /dentists to the API.</div>`;  }
  document.getElementById('m-book-inner').innerHTML = `
    <div class="modal-header"><h2>📅 ${editMode ? 'Edit' : isPatient ? 'Request' : 'Book'} Appointment</h2><button class="modal-close" onclick="closeModal('m-book')">✕</button></div>
    ${doctorsWarning}
    ${!isPatient ? `<div class="fg"><label>Patient *</label><select id="ba-patient">${patientsOpts||'<option value="">No patients found</option>'}</select></div>` : ''}
    <div class="form-row">
      <div class="fg"><label>Date *</label><input type="date" id="ba-date" value="${esc((appointment && appointment.date) || todayISO())}"></div>
      <div class="fg"><label>Time *</label><input type="time" id="ba-time" value="${esc(appointment ? appointment.time.slice(0,5) : '')}"></div>
    </div>
    <div class="fg"><label>Dentist *</label><select id="ba-doctor">${doctorsOpts||'<option value="">No dentists available</option>'}</select></div>
    <div class="fg"><label>Treatment *</label><select id="ba-treatment">
      <option ${appointment && appointment.treatment==='Consultation & Checkup' ? 'selected' : ''}>Consultation & Checkup</option>
      <option ${appointment && appointment.treatment==='Teeth Cleaning' ? 'selected' : ''}>Teeth Cleaning</option>
      <option ${appointment && appointment.treatment==='Tooth Extraction' ? 'selected' : ''}>Tooth Extraction</option>
      <option ${appointment && appointment.treatment==='Root Canal Treatment' ? 'selected' : ''}>Root Canal Treatment</option>
      <option ${appointment && appointment.treatment==='Dental Filling' ? 'selected' : ''}>Dental Filing</option>
      <option ${appointment && appointment.treatment==='Crown Fitting' ? 'selected' : ''}>Crown Fitting</option>
      <option ${appointment && appointment.treatment==='Dental Implant' ? 'selected' : ''}>Dental Implant</option>
      <option ${appointment && appointment.treatment==='X-Ray' ? 'selected' : ''}>X-Ray</option>
      <option ${appointment && appointment.treatment==='Other' ? 'selected' : ''}>Other</option></select></div>
    <div class="fg"><label>Notes</label><textarea id="ba-notes" style="height:65px;resize:none;">${esc(appointment ? appointment.notes : '')}</textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn btn-outline" onclick="closeModal('m-book')">Cancel</button>
      <button class="btn btn-teal" onclick="submitBookAppt(${isPatient})">${editMode ? 'Save changes' : 'Book'}</button>
    </div>`;
  openModal('m-book');
}
async function submitBookAppt(isPatient){
  const appointment = window.__EDIT_APPOINTMENT || null;
  const patient_id = isPatient ? USER.patient_id : document.getElementById('ba-patient').value;
  const doctor_id = document.getElementById('ba-doctor').value;
  const date = document.getElementById('ba-date').value;
  const time = document.getElementById('ba-time').value;
  const treatment = document.getElementById('ba-treatment').value;
  const notes = document.getElementById('ba-notes').value;
  if (!patient_id || !doctor_id || !date || !time || !treatment) { toast('Please fill all required fields','e'); return; }
  try {
    const payload = { patient_id, doctor_id, date, time, treatment, notes };
    if (appointment) {
      await api(`/appointments/${appointment.id}`, { method:'PATCH', body: JSON.stringify(payload) });
      toast('Appointment updated!','s');
    } else {
      await api('/appointments', { method:'POST', body: JSON.stringify(payload) });
      toast('Appointment booked!','s');
    }
    window.__EDIT_APPOINTMENT = null;
    closeModal('m-book');
    showPage(isPatient ? 'patient-home' : 'appointments');
  } catch(e){ toast(e.message,'e'); }
}

// =====================================================================
// PATIENTS
// =====================================================================
async function renderPatients(search=''){
  const el = document.getElementById('page-patients');
  el.innerHTML = `
    <div class="sec-hdr">
      <input type="text" class="search-input" id="patient-search" placeholder="🔍 Search patients..." style="width:250px;" value="${esc(search)}" onkeypress="if(event.key==='Enter')renderPatients(this.value)">
      ${canDo('add-patient') ? `<button class="btn btn-teal" onclick="openAddPatientModal()">+ Register Patient</button>` : ''}
    </div>
    <div class="card" id="patients-table"><div class="spinner">Loading…</div></div>`;
  const patients = await api(`/patients${search?'?search='+encodeURIComponent(search):''}`);
  CACHE.patients = patients;
  document.getElementById('patients-table').innerHTML = patients.length ? `
    <table><thead><tr><th>Patient ID</th><th>Name</th><th>Phone</th><th>Blood Type</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${patients.map(p=>`<tr>
      <td><span class="badge badge-teal">${esc(p.patient_id)}</span></td><td><strong>${esc(p.full_name)}</strong></td>
      <td style="font-size:12px;color:var(--text-2);">${esc(p.phone||'—')}</td>
      <td>${p.blood_type?`<span class="badge badge-blue">${esc(p.blood_type)}</span>`:'—'}</td>
      <td><span class="badge ${statusBadge(p.status)}">${esc(p.status)}</span></td>
      <td><button class="btn btn-teal btn-sm" onclick="showPage('patient-profile', ${p.id})">View →</button></td>
    </tr>`).join('')}</tbody></table>` : `<div class="empty"><div class="ei">👤</div><h3>No patients found</h3></div>`;
}
function openAddPatientModal(){
  document.getElementById('m-add-patient-inner').innerHTML = `
    <div class="modal-header"><h2>👤 Register Patient</h2><button class="modal-close" onclick="closeModal('m-add-patient')">✕</button></div>
    <div class="form-row"><div class="fg"><label>Full Name *</label><input type="text" id="ap-name"></div><div class="fg"><label>Date of Birth</label><input type="date" id="ap-dob"></div></div>
    <div class="form-row"><div class="fg"><label>Gender</label><select id="ap-gender"><option>Male</option><option>Female</option></select></div>
    <div class="fg"><label>Blood Type</label><select id="ap-blood"><option value="">—</option>${['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(b=>`<option>${b}</option>`).join('')}</select></div></div>
    <div class="fg"><label>Allergies</label><input type="text" id="ap-allergies" placeholder="e.g. Penicillin, Latex"></div>
    <div class="form-row"><div class="fg"><label>Phone *</label><input type="text" id="ap-phone" placeholder="+220 7701234"></div><div class="fg"><label>Email</label><input type="email" id="ap-email"></div></div>
    <div class="form-row"><div class="fg"><label>Emergency Name</label><input type="text" id="ap-em-name"></div><div class="fg"><label>Emergency Phone</label><input type="text" id="ap-em-phone"></div></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn btn-outline" onclick="closeModal('m-add-patient')">Cancel</button>
      <button class="btn btn-teal" onclick="submitAddPatient()">Register Patient</button></div>`;
  openModal('m-add-patient');
}
async function submitAddPatient(){
  const full_name = document.getElementById('ap-name').value.trim();
  if (!full_name) { toast('Full name is required','e'); return; }
  const body = { full_name, date_of_birth: document.getElementById('ap-dob').value||null, gender: document.getElementById('ap-gender').value,
    blood_type: document.getElementById('ap-blood').value||null, allergies: document.getElementById('ap-allergies').value||null,
    phone: document.getElementById('ap-phone').value||null, email: document.getElementById('ap-email').value||null,
    emergency_name: document.getElementById('ap-em-name').value||null, emergency_phone: document.getElementById('ap-em-phone').value||null };
  try { const p = await api('/patients', { method:'POST', body: JSON.stringify(body) }); closeModal('m-add-patient'); toast(`Registered — ID: ${p.patient_id}`,'s'); renderPatients(); }
  catch(e){ toast(e.message,'e'); }
}

// =====================================================================
// PATIENT PROFILE
// =====================================================================
async function renderProfile(){
  const el = document.getElementById('page-patient-profile');
  const id = role()==='patient' ? USER.patient_id : CURRENT_PATIENT_ID;
  if (!id) { el.innerHTML = `<div class="empty"><div class="ei">👤</div><h3>No patient selected</h3><p>Go to Patients and pick one.</p></div>`; return; }
  el.innerHTML = '<div class="spinner">Loading patient…</div>';
  const p = await api(`/patients/${id}`);
  CURRENT_PATIENT_ID = p.id;
  const initials = (p.full_name||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  el.innerHTML = `
    ${role()!=='patient' ? `<button class="btn btn-outline btn-sm" style="margin-bottom:14px;" onclick="showPage('patients')">← Back to patients</button>` : ''}
    <div class="patient-hero"><div class="patient-av">${initials}</div>
      <div style="flex:1;"><h2>${esc(p.full_name)}</h2><p>Patient ID: ${esc(p.patient_id)}</p>
        <div class="patient-meta">
          ${p.date_of_birth?`<span>🎂 ${esc(p.date_of_birth)}</span>`:''}
          ${p.blood_type?`<span>🩸 ${esc(p.blood_type)}</span>`:''}
          ${p.allergies?`<span>⚠️ Allergic: ${esc(p.allergies)}</span>`:''}
          ${p.phone?`<span>📞 ${esc(p.phone)}</span>`:''}
        </div></div>
      <div style="display:flex;gap:8px;">
        ${canDo('book-appt')?`<button class="btn btn-teal btn-sm" onclick="openBookApptModal()">📅 Book</button>`:''}
        <button class="btn btn-sm" style="background:rgba(255,255,255,.2);color:#fff;" onclick="REPORT_MODE='card';showPage('report-card')">🖨️ Report Card</button>
      </div></div>
    <div class="tab-bar">
      <button class="tab-btn active" onclick="switchTab(this,'tab-chart')">🦷 Dental Chart</button>
      <button class="tab-btn" onclick="switchTab(this,'tab-records')">📋 Records</button>
      <button class="tab-btn" onclick="switchTab(this,'tab-xray')">🩻 X-Rays</button>
      <button class="tab-btn" onclick="switchTab(this,'tab-rx')">💊 Prescriptions</button>
    </div>
    <div id="tab-chart" class="tab-content"><div class="spinner">Loading…</div></div>
    <div id="tab-records" class="tab-content" style="display:none;"><div class="spinner">Loading…</div></div>
    <div id="tab-xray" class="tab-content" style="display:none;"><div class="spinner">Loading…</div></div>
    <div id="tab-rx" class="tab-content" style="display:none;"><div class="spinner">Loading…</div></div>`;
  const [chart, records, xrays, rx] = await Promise.all([
    api(`/patients/${id}/chart`), api(`/patients/${id}/records`), api(`/patients/${id}/xrays`), api(`/prescriptions?patient_id=${id}`)
  ]);
  fillChartTab(chart); fillRecordsTab(records); fillXrayTab(xrays); fillRxTab(rx);
}
function switchTab(btn, tabId){
  const bar = btn.closest('.tab-bar');
  bar.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
  bar.parentElement.querySelectorAll('.tab-content').forEach(t=>t.style.display='none');
  document.getElementById(tabId).style.display='block';
}
function toothIcon(c){ return {healthy:'⬜',cavity:'🟡',filling:'🔵',crown:'🟣','root-canal':'🔴',implant:'🟢',extraction:'✖'}[c]||'⬜'; }
let CHART_MAP = {};
function fillChartTab(rows){
  CHART_MAP = {}; rows.forEach(r=>CHART_MAP[r.tooth_number]=r);
  const toothHtml = n => { const r=CHART_MAP[n]; const cond=r?r.condition:'healthy';
    return `<div class="tooth ${cond}" title="Tooth ${n}${r?' — '+cond:''}" onclick="toothClick(${n})"><div>${toothIcon(cond)}</div><div class="tooth-num">${n}</div></div>`; };
  document.getElementById('tab-chart').innerHTML = `
    <div class="two-col">
      <div class="card"><div class="card-header"><span class="card-title">🦷 Dental Chart (Universal Numbering)</span>${canDo('update-tooth')?'':'<span class="badge badge-gray">View only</span>'}</div>
        <div style="padding:18px;">
          <div class="jaw-label">Upper Jaw (1–16)</div><div class="teeth-row">${[...Array(16)].map((_,i)=>toothHtml(i+1)).join('')}</div>
          <div class="chart-divider"></div><div class="jaw-label">Lower Jaw (17–32)</div><div class="teeth-row">${[...Array(16)].map((_,i)=>toothHtml(i+17)).join('')}</div>
          <div class="tooth-legend">${[['healthy','#e2e8f0','Healthy'],['cavity','#fde68a','Cavity'],['filling','#bfdbfe','Filling'],['crown','#c4b5fd','Crown'],['root-canal','#fecdd3','Root Canal'],['implant','#99f6e4','Implant'],['extraction','#e2e8f0','Extracted']].map(([c,col,l])=>`<div class="legend-item"><div class="legend-dot" style="background:${col};border:1px solid #e2e8f0;"></div>${l}</div>`).join('')}</div>
        </div></div>
      <div class="card"><div class="card-header"><span class="card-title">📋 Tooth Conditions</span></div>
        <table><thead><tr><th>Tooth</th><th>Condition</th><th>Date</th><th>Doctor</th></tr></thead>
        <tbody>${rows.length?rows.sort((a,b)=>a.tooth_number-b.tooth_number).map(r=>`<tr><td><strong>#${r.tooth_number}</strong></td><td><span class="badge badge-teal">${esc(r.condition)}</span></td><td style="font-size:12px;color:var(--text-2);">${esc(r.treatment_date||'—')}</td><td style="font-size:12px;color:var(--text-2);">${esc(r.doctor_name||'—')}</td></tr>`).join(''):`<tr><td colspan="4" style="text-align:center;color:var(--text-2);">No chart entries yet</td></tr>`}</tbody></table></div>
    </div>`;
}
function toothClick(num){
  if (!canDo('update-tooth')) {
    const r = CHART_MAP[num];
    toast(r ? `Tooth ${num}: ${r.condition}` : `Tooth ${num}: healthy`, 's');
    return;
  }
  const current = CHART_MAP[num] ? CHART_MAP[num].condition : 'healthy';
  document.getElementById('m-tooth-inner').innerHTML = `
    <div class="modal-header"><h2>Tooth #${num}</h2><button class="modal-close" onclick="closeModal('m-tooth')">✕</button></div>
    <div class="fg"><label>Condition</label><select id="td-condition">
      ${['healthy','cavity','filling','crown','root-canal','implant','extraction'].map(c=>`<option value="${c}" ${c===current?'selected':''}>${c}</option>`).join('')}</select></div>
    <div class="fg"><label>Treatment Date</label><input type="date" id="td-date" value="${todayISO()}"></div>
    <div class="fg"><label>Notes</label><textarea id="td-notes" style="height:75px;resize:none;"></textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn btn-outline" onclick="closeModal('m-tooth')">Cancel</button>
      <button class="btn btn-teal" onclick="saveTooth(${num})">Save</button></div>`;
  openModal('m-tooth');
}
async function saveTooth(num){
  const condition = document.getElementById('td-condition').value;
  const treatment_date = document.getElementById('td-date').value;
  const notes = document.getElementById('td-notes').value;
  try {
    await api(`/patients/${CURRENT_PATIENT_ID}/chart`, { method:'POST', body: JSON.stringify({ tooth_number: num, condition, treatment_date, notes }) });
    closeModal('m-tooth'); toast('Tooth updated','s');
    const chart = await api(`/patients/${CURRENT_PATIENT_ID}/chart`); fillChartTab(chart);
  } catch(e){ toast(e.message,'e'); }
}
function fillRecordsTab(rows){
  document.getElementById('tab-records').innerHTML = `
    <div class="card"><div class="card-header"><span class="card-title">📋 Visit History</span>${canDo('add-record')?`<button class="btn btn-teal btn-sm" onclick="openAddRecordModal()">+ Add Record</button>`:''}</div>
    <table><thead><tr><th>Date</th><th>Diagnosis</th><th>Treatment</th><th>Doctor</th><th>Vitals</th></tr></thead>
    <tbody>${rows.length?rows.map(r=>`<tr><td style="font-size:12px;color:var(--text-2);">${new Date(r.created_at).toLocaleDateString()}</td>
      <td>${esc(r.diagnosis||'—')}</td><td>${esc(r.treatment_done||'—')}</td><td style="font-size:12px;color:var(--text-2);">${esc(r.doctor_name||'—')}</td>
      <td style="font-size:11px;color:var(--text-2);">${[r.bp&&'BP '+r.bp,r.temperature&&r.temperature+'°C',r.pulse&&r.pulse+' bpm'].filter(Boolean).join(' · ')||'—'}</td></tr>`).join(''):`<tr><td colspan="5" style="text-align:center;color:var(--text-2);">No records yet</td></tr>`}</tbody></table></div>`;
}
function openAddRecordModal(){
  document.getElementById('m-add-record-inner').innerHTML = `
    <div class="modal-header"><h2>📋 Add Consultation Record</h2><button class="modal-close" onclick="closeModal('m-add-record')">✕</button></div>
    <div class="fg"><label>Diagnosis</label><input type="text" id="rec-diag"></div>
    <div class="fg"><label>Treatment Done</label><input type="text" id="rec-done"></div>
    <div class="fg"><label>Treatment Plan</label><input type="text" id="rec-plan"></div>
    <div class="form-row"><div class="fg"><label>Blood Pressure</label><input type="text" id="rec-bp" placeholder="120/80"></div><div class="fg"><label>Temperature (°C)</label><input type="text" id="rec-temp"></div></div>
    <div class="form-row"><div class="fg"><label>Pulse (bpm)</label><input type="text" id="rec-pulse"></div><div class="fg"><label>Weight (kg)</label><input type="text" id="rec-weight"></div></div>
    <div class="fg"><label>Notes</label><textarea id="rec-notes" style="height:65px;resize:none;"></textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;"><button class="btn btn-outline" onclick="closeModal('m-add-record')">Cancel</button><button class="btn btn-teal" onclick="submitRecord()">Save</button></div>`;
  openModal('m-add-record');
}
async function submitRecord(){
  const body = { diagnosis: document.getElementById('rec-diag').value||null, treatment_done: document.getElementById('rec-done').value||null,
    treatment_plan: document.getElementById('rec-plan').value||null, bp: document.getElementById('rec-bp').value||null,
    temperature: document.getElementById('rec-temp').value||null, pulse: document.getElementById('rec-pulse').value||null,
    weight: document.getElementById('rec-weight').value||null, notes: document.getElementById('rec-notes').value||null };
  try { await api(`/patients/${CURRENT_PATIENT_ID}/records`, { method:'POST', body: JSON.stringify(body) });
    closeModal('m-add-record'); toast('Record saved','s'); fillRecordsTab(await api(`/patients/${CURRENT_PATIENT_ID}/records`)); }
  catch(e){ toast(e.message,'e'); }
}
function fillXrayTab(rows){
  document.getElementById('tab-xray').innerHTML = `
    <div class="sec-hdr"><span></span>${canDo('add-xray')?`<button class="btn btn-teal btn-sm" onclick="openAddXrayModal()">+ Add X-Ray / Lab Result</button>`:''}</div>
    <div class="three-col">${rows.length?rows.map(x=>`<div class="card">
      <div style="background:linear-gradient(135deg,#1a3040,#0f2027);height:110px;display:flex;align-items:center;justify-content:center;font-size:32px;">🩻</div>
      <div class="card-body" style="padding:11px;"><div style="font-size:13px;font-weight:700;">${esc(x.type)}${x.tooth_number?' — #'+x.tooth_number:''}</div>
      <div style="font-size:11px;color:var(--text-2);">${new Date(x.created_at).toLocaleDateString()} · ${esc(x.doctor_name||'—')}</div>
      <div style="font-size:12px;margin-top:5px;">${esc(x.findings||'No findings noted')}</div>
      <span class="badge ${statusBadge(x.status)}" style="margin-top:6px;">${esc(x.status)}</span>
      ${x.file_url?`<div style="margin-top:6px;"><a href="${esc(x.file_url)}" target="_blank" style="font-size:12px;color:var(--teal);">View file →</a></div>`:''}</div></div>`).join(''):`<div class="empty" style="grid-column:1/-1;"><div class="ei">🩻</div><h3>No x-rays yet</h3></div>`}</div>`;
}
function openAddXrayModal(){
  document.getElementById('m-add-xray-inner').innerHTML = `
    <div class="modal-header"><h2>🩻 Add X-Ray / Lab Result</h2><button class="modal-close" onclick="closeModal('m-add-xray')">✕</button></div>
    <div class="fg"><label>Type</label><select id="xr-type"><option value="xray">X-Ray</option><option value="lab_result">Lab Result</option><option value="photo">Photo</option></select></div>
    <div class="fg"><label>Tooth Number (1–32, optional)</label><input type="number" id="xr-tooth" min="1" max="32"></div>
    <div class="fg"><label>File URL</label><input type="text" id="xr-url" placeholder="Paste Cloudinary / storage link"></div>
    <div class="fg"><label>Findings</label><textarea id="xr-findings" style="height:65px;resize:none;"></textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;"><button class="btn btn-outline" onclick="closeModal('m-add-xray')">Cancel</button><button class="btn btn-teal" onclick="submitXray()">Save</button></div>`;
  openModal('m-add-xray');
}
async function submitXray(){
  const body = { type: document.getElementById('xr-type').value, tooth_number: document.getElementById('xr-tooth').value||null,
    file_url: document.getElementById('xr-url').value||null, findings: document.getElementById('xr-findings').value||null };
  try { await api(`/patients/${CURRENT_PATIENT_ID}/xrays`, { method:'POST', body: JSON.stringify(body) });
    closeModal('m-add-xray'); toast('Uploaded','s'); fillXrayTab(await api(`/patients/${CURRENT_PATIENT_ID}/xrays`)); }
  catch(e){ toast(e.message,'e'); }
}
function fillRxTab(rows){
  document.getElementById('tab-rx').innerHTML = `
    <div class="sec-hdr"><span></span>${canDo('write-rx')?`<button class="btn btn-teal btn-sm" onclick="openWriteRxModal()">+ Write Prescription</button>`:''}</div>
    <div class="card"><table><thead><tr><th>Date</th><th>Drug</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Status</th>${canDo('dispense-rx')?'<th></th>':''}</tr></thead>
    <tbody>${rows.length?rows.map(r=>`<tr><td style="font-size:12px;color:var(--text-2);">${new Date(r.created_at).toLocaleDateString()}</td>
      <td><strong>${esc(r.drug_name)}</strong></td><td>${esc(r.dosage)}</td><td>${esc(r.frequency)}</td><td>${esc(r.duration)}</td>
      <td><span class="badge ${statusBadge(r.status)}">${esc(r.status)}</span></td>
      ${canDo('dispense-rx')?`<td>${r.status==='pending'?`<button class="btn btn-green btn-sm" onclick="dispenseRx(${r.id})">Dispense</button>`:''}</td>`:''}</tr>`).join(''):`<tr><td colspan="7" style="text-align:center;color:var(--text-2);">No prescriptions yet</td></tr>`}</tbody></table></div>`;
}
function openWriteRxModal(){
  document.getElementById('m-write-rx-inner').innerHTML = `
    <div class="modal-header"><h2>💊 Write Prescription</h2><button class="modal-close" onclick="closeModal('m-write-rx')">✕</button></div>
    <div class="fg"><label>Drug Name *</label><input type="text" id="rx-drug"></div>
    <div class="form-row"><div class="fg"><label>Dosage *</label><input type="text" id="rx-dose" placeholder="500mg"></div><div class="fg"><label>Frequency *</label><input type="text" id="rx-freq" placeholder="3x daily"></div></div>
    <div class="fg"><label>Duration *</label><input type="text" id="rx-dur" placeholder="7 days"></div>
    <div class="fg"><label>Notes</label><textarea id="rx-notes" style="height:60px;resize:none;"></textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;"><button class="btn btn-outline" onclick="closeModal('m-write-rx')">Cancel</button><button class="btn btn-teal" onclick="submitRx()">Save</button></div>`;
  openModal('m-write-rx');
}
async function submitRx(){
  const body = { patient_id: CURRENT_PATIENT_ID, drug_name: document.getElementById('rx-drug').value.trim(),
    dosage: document.getElementById('rx-dose').value.trim(), frequency: document.getElementById('rx-freq').value.trim(),
    duration: document.getElementById('rx-dur').value.trim(), notes: document.getElementById('rx-notes').value||null };
  if (!body.drug_name||!body.dosage||!body.frequency||!body.duration) { toast('Fill all required fields','e'); return; }
  try { await api('/prescriptions', { method:'POST', body: JSON.stringify(body) }); closeModal('m-write-rx'); toast('Prescription saved','s');
    fillRxTab(await api(`/prescriptions?patient_id=${CURRENT_PATIENT_ID}`)); }
  catch(e){ toast(e.message,'e'); }
}
async function dispenseRx(id){
  try { await api(`/prescriptions/${id}/dispense`, { method:'PATCH' }); toast('Dispensed ✓','s');
    if (document.getElementById('page-patient-profile').classList.contains('active')) fillRxTab(await api(`/prescriptions?patient_id=${CURRENT_PATIENT_ID}`));
    else await renderPrescriptions();
  } catch(e){ toast(e.message,'e'); }
}

// =====================================================================
// PRESCRIPTIONS (system-wide)
// =====================================================================
async function renderPrescriptions(){
  const el = document.getElementById('page-prescriptions');
  el.innerHTML = `<div class="sec-hdr"><select class="search-input" id="rx-status-f" onchange="filterRx()"><option value="">All statuses</option><option value="pending">Pending</option><option value="dispensed">Dispensed</option></select></div>
    <div class="card" id="rx-table"><div class="spinner">Loading…</div></div>`;
  await filterRx();
}
async function filterRx(){
  const status = document.getElementById('rx-status-f')?.value || '';
  const rows = await api(`/prescriptions${status?'?status='+status:''}`);
  document.getElementById('rx-table').innerHTML = rows.length ? `
    <table><thead><tr><th>Date</th><th>Patient</th><th>Drug</th><th>Dosage</th><th>Freq</th><th>Duration</th><th>Doctor</th><th>Status</th>${canDo('dispense-rx')?'<th></th>':''}</tr></thead>
    <tbody>${rows.map(r=>`<tr><td style="font-size:12px;color:var(--text-2);">${new Date(r.created_at).toLocaleDateString()}</td>
      <td><strong>${esc(r.patient_name)}</strong></td><td>${esc(r.drug_name)}</td><td>${esc(r.dosage)}</td><td>${esc(r.frequency)}</td><td>${esc(r.duration)}</td>
      <td style="font-size:12px;color:var(--text-2);">${esc(r.doctor_name||'—')}</td><td><span class="badge ${statusBadge(r.status)}">${esc(r.status)}</span></td>
      ${canDo('dispense-rx')?`<td>${r.status==='pending'?`<button class="btn btn-green btn-sm" onclick="dispenseRx(${r.id})">Dispense</button>`:''}</td>`:''}</tr>`).join('')}</tbody></table>`
    : `<div class="empty"><div class="ei">💊</div><h3>No prescriptions found</h3></div>`;
}

// =====================================================================
// BILLING
// =====================================================================
async function renderBilling(){
  const el = document.getElementById('page-billing');
  el.innerHTML = `<div class="sec-hdr"><select class="search-input" id="inv-status-f" onchange="filterInvoices()" style="width:150px;">
      <option value="">All statuses</option><option value="unpaid">Unpaid</option><option value="partial">Partial</option><option value="paid">Paid</option></select>
      ${canDo('create-invoice')?`<button class="btn btn-teal" onclick="openInvoiceModal()">+ Create Invoice</button>`:''}</div>
    <div class="stats-grid" id="billing-stats" style="grid-template-columns:repeat(3,1fr);"></div>
    <div class="card" id="inv-table"><div class="spinner">Loading…</div></div>`;
  await filterInvoices();
}
async function filterInvoices(){
  const status = document.getElementById('inv-status-f')?.value || '';
  const isPatient = role()==='patient';
  const rows = await api(`/invoices${status?'?status='+status:''}`);
  if (!isPatient) {
    const today = todayISO();
    const collectedToday = rows.filter(i=>i.created_at.slice(0,10)===today).reduce((s,i)=>s+Number(i.amount_paid),0);
    const outstanding = rows.reduce((s,i)=>s+(Number(i.total)-Number(i.amount_paid)),0);
    const monthTotal = rows.filter(i=>i.created_at.slice(0,7)===today.slice(0,7)).reduce((s,i)=>s+Number(i.total),0);
    document.getElementById('billing-stats').innerHTML = `
      <div class="stat-card" style="--sc:var(--green);--sb:var(--green-light);"><div class="stat-icon">✅</div><div class="stat-label">Collected Today</div><div class="stat-value">${fmtMoney(collectedToday)}</div></div>
      <div class="stat-card" style="--sc:var(--amber);--sb:var(--amber-light);"><div class="stat-icon">⏳</div><div class="stat-label">Outstanding</div><div class="stat-value">${fmtMoney(outstanding)}</div></div>
      <div class="stat-card" style="--sc:var(--blue);--sb:var(--blue-light);"><div class="stat-icon">📊</div><div class="stat-label">This Month</div><div class="stat-value">${fmtMoney(monthTotal)}</div></div>`;
  } else { document.getElementById('billing-stats').innerHTML = ''; }
  document.getElementById('inv-table').innerHTML = rows.length ? `
    <table><thead><tr><th>Invoice #</th>${isPatient?'':'<th>Patient</th>'}<th>Total</th><th>Paid</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
    <tbody>${rows.map(i=>`<tr><td><span class="badge badge-teal">${esc(i.invoice_no)}</span></td>${isPatient?'':`<td><strong>${esc(i.patient_name)}</strong></td>`}
      <td><strong>${fmtMoney(i.total)}</strong></td><td>${fmtMoney(i.amount_paid)}</td><td><span class="badge ${statusBadge(i.status)}">${esc(i.status)}</span></td>
      <td style="font-size:12px;color:var(--text-2);">${new Date(i.created_at).toLocaleDateString()}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="viewInvoiceItems(${i.id})">Items</button>
        ${i.status!=='paid'&&canDo('pay-invoice')?`<button class="btn btn-teal btn-sm" onclick="openPayModal(${i.id},${i.total-i.amount_paid})">Pay</button>`:''}
      </td></tr>`).join('')}</tbody></table>` : `<div class="empty"><div class="ei">💰</div><h3>No invoices found</h3></div>`;
}
async function viewInvoiceItems(id){
  try { const items = await api(`/invoices/${id}/items`);
    toast(items.length ? items.map(it=>`${it.service} ×${it.quantity} — ${fmtMoney(it.total)}`).join(' · ') : 'No line items on this invoice');
  } catch(e){ toast(e.message,'e'); }
}
async function openInvoiceModal(){
  BILL_ITEMS = [];
  let patientsOpts = '', servicesOpts = '';
  try { const patients = CACHE.patients.length?CACHE.patients:await api('/patients'); patientsOpts = patients.map(p=>`<option value="${p.id}">${esc(p.full_name)} (${esc(p.patient_id)})</option>`).join(''); } catch {}
  try { const services = await api('/services'); CACHE.services = services; servicesOpts = services.map(s=>`<option value="${s.id}" data-price="${s.price}" data-name="${esc(s.name)}">${esc(s.name)} — ${fmtMoney(s.price)}</option>`).join(''); }
  catch { servicesOpts = ''; }
  document.getElementById('m-invoice-inner').innerHTML = `
    <div class="modal-header"><h2>💰 Create Invoice</h2><button class="modal-close" onclick="closeModal('m-invoice')">✕</button></div>
    <div class="fg"><label>Patient *</label><select id="cb-patient">${patientsOpts||'<option value="">No patients found</option>'}</select></div>
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-2);margin:14px 0 8px;">Add Service</div>
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <select id="cb-service" style="flex:1;padding:9px;border:1.5px solid #e2e8f0;border-radius:10px;">${servicesOpts||'<option value="">No services in catalog yet</option>'}</select>
      <button class="btn btn-outline btn-sm" onclick="addBillItem()">+ Add</button>
    </div>
    <div id="cb-items"></div>
    <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:15px;font-weight:800;border-top:2px solid var(--teal);margin-top:8px;"><span>Total</span><span style="color:var(--teal);" id="cb-total">D0.00</span></div>
    <div class="fg"><label>Discount</label><input type="number" id="cb-discount" value="0" min="0" oninput="renderBillItems()"></div>
    <div class="fg"><label>Notes</label><input type="text" id="cb-notes"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;"><button class="btn btn-outline" onclick="closeModal('m-invoice')">Cancel</button><button class="btn btn-teal" onclick="submitInvoice()">Create Invoice</button></div>`;
  renderBillItems();
  openModal('m-invoice');
}
function addBillItem(){
  const sel = document.getElementById('cb-service'); const opt = sel.options[sel.selectedIndex];
  if (!opt || !opt.value) { toast('Select a service first','e'); return; }
  BILL_ITEMS.push({ service: opt.dataset.name, quantity: 1, unit_price: parseFloat(opt.dataset.price) });
  renderBillItems();
}
function removeBillItem(idx){ BILL_ITEMS.splice(idx,1); renderBillItems(); }
function renderBillItems(){
  document.getElementById('cb-items').innerHTML = BILL_ITEMS.length ? BILL_ITEMS.map((it,idx)=>`
    <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px;align-items:center;">
      <span>${esc(it.service)} ×${it.quantity}</span><div style="display:flex;gap:8px;align-items:center;"><strong>${fmtMoney(it.unit_price*it.quantity)}</strong>
      <button style="background:none;border:none;color:var(--rose);cursor:pointer;" onclick="removeBillItem(${idx})">✕</button></div></div>`).join('')
    : `<div style="text-align:center;color:var(--text-2);font-size:12px;padding:8px 0;">No services added yet</div>`;
  const subtotal = BILL_ITEMS.reduce((s,i)=>s+i.unit_price*i.quantity,0);
  const discount = parseFloat(document.getElementById('cb-discount')?.value||0);
  document.getElementById('cb-total').textContent = fmtMoney(subtotal-discount);
}
async function submitInvoice(){
  const patient_id = document.getElementById('cb-patient').value;
  if (!patient_id || !BILL_ITEMS.length) { toast('Select a patient and add at least one service','e'); return; }
  const body = { patient_id, items: BILL_ITEMS, discount: parseFloat(document.getElementById('cb-discount').value||0), notes: document.getElementById('cb-notes').value||null };
  try { await api('/invoices', { method:'POST', body: JSON.stringify(body) }); closeModal('m-invoice'); toast('Invoice created','s'); renderBilling(); }
  catch(e){ toast(e.message,'e'); }
}
function openPayModal(id, balance){
  document.getElementById('m-pay-inner').innerHTML = `
    <div class="modal-header"><h2>💰 Record Payment</h2><button class="modal-close" onclick="closeModal('m-pay')">✕</button></div>
    <div class="fg"><label>Amount Due: ${fmtMoney(balance)}</label><input type="number" id="pi-amount" value="${balance}" min="0" step="0.01"></div>
    <div class="fg"><label>Payment Method</label><select id="pi-method"><option>cash</option><option>card</option><option>mobile_money</option><option>bank_transfer</option></select></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;"><button class="btn btn-outline" onclick="closeModal('m-pay')">Cancel</button><button class="btn btn-teal" onclick="submitPay(${id})">Record Payment</button></div>`;
  openModal('m-pay');
}
async function submitPay(id){
  const amount_paid = parseFloat(document.getElementById('pi-amount').value);
  const payment_method = document.getElementById('pi-method').value;
  if (!amount_paid || amount_paid<=0) { toast('Enter a valid amount','e'); return; }
  try { await api(`/invoices/${id}/pay`, { method:'PATCH', body: JSON.stringify({ amount_paid, payment_method }) }); closeModal('m-pay'); toast('Payment recorded','s'); renderBilling(); }
  catch(e){ toast(e.message,'e'); }
}

// =====================================================================
// PHARMACY
// =====================================================================
async function renderPharmacy(lowOnly=false){
  const el = document.getElementById('page-pharmacy');
  el.innerHTML = `<div class="sec-hdr">
      <label style="display:flex;gap:8px;align-items:center;font-size:13px;font-weight:600;"><input type="checkbox" id="ph-low" ${lowOnly?'checked':''} onchange="renderPharmacy(this.checked)"> Low stock only</label>
      ${canDo('add-drug')?`<button class="btn btn-teal" onclick="openAddDrugModal()">+ Add Drug</button>`:''}</div>
    <div class="two-col">
      <div class="card"><div class="card-header"><span class="card-title">💊 Drug Inventory</span><span style="font-size:12px;color:var(--text-2);" id="drug-count"></span></div>
        <div id="drugs-table"><div class="spinner">Loading…</div></div></div>
      <div class="card" style="align-self:start;"><div class="card-header"><span class="card-title">📋 Pending Prescriptions</span><span class="badge badge-rose" id="pending-rx-count">0</span></div>
        <div class="card-body" id="pending-rx-list"><div class="spinner">Loading…</div></div></div>
    </div>`;
  const drugs = await api(`/drugs${lowOnly?'?low_stock=true':''}`);
  document.getElementById('drug-count').textContent = drugs.length + ' drugs';
  document.getElementById('drugs-table').innerHTML = drugs.length ? `
    <table><thead><tr><th>Drug Name</th><th>Stock</th><th>Price</th><th>Expiry</th><th>Status</th>${canDo('add-drug')?'<th></th>':''}</tr></thead>
    <tbody>${drugs.map(d=>{const low=d.stock<=d.min_stock;return `<tr>
      <td><strong>${esc(d.name)}</strong>${d.category?`<div style="font-size:11px;color:var(--text-2);">${esc(d.category)}</div>`:''}</td>
      <td>${d.stock} ${esc(d.unit||'')}</td><td>${d.price?fmtMoney(d.price):'—'}</td><td style="font-size:12px;color:var(--text-2);">${esc(d.expiry_date||'—')}</td>
      <td><span class="badge ${low?'badge-rose':'badge-green'}">${low?'⚠ Low':'OK'}</span></td>
      ${canDo('add-drug')?`<td><button class="btn btn-outline btn-sm" onclick="openEditDrugModal(${d.id},${d.stock},${d.price||0})">Update</button></td>`:''}
    </tr>`;}).join('')}</tbody></table>` : `<div class="empty"><div class="ei">💊</div><h3>No drugs found</h3></div>`;
  const pending = await api('/prescriptions?status=pending');
  document.getElementById('pending-rx-count').textContent = pending.length;
  document.getElementById('pending-rx-list').innerHTML = pending.length ? pending.map(r=>`
    <div style="padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
        <div><div style="font-size:13px;font-weight:700;">${esc(r.patient_name)}</div><div style="font-size:12px;color:var(--teal);font-weight:600;">${esc(r.doctor_name||'')}</div></div>
        ${canDo('dispense-rx')?`<button class="btn btn-green btn-sm" onclick="dispenseRx(${r.id})">Dispense</button>`:''}
      </div><div style="font-size:12px;color:var(--text-2);">${esc(r.drug_name)} · ${esc(r.frequency)} · ${esc(r.duration)}</div></div>`).join('')
    : `<div class="empty"><div class="ei">✅</div><h3>Nothing pending</h3></div>`;
}
function openAddDrugModal(){
  document.getElementById('m-add-drug-inner').innerHTML = `
    <div class="modal-header"><h2>💊 Add Drug</h2><button class="modal-close" onclick="closeModal('m-add-drug')">✕</button></div>
    <div class="fg"><label>Drug Name *</label><input type="text" id="dg-name"></div>
    <div class="form-row"><div class="fg"><label>Category</label><input type="text" id="dg-category"></div><div class="fg"><label>Unit</label><input type="text" id="dg-unit" value="tablet"></div></div>
    <div class="form-row"><div class="fg"><label>Stock *</label><input type="number" id="dg-stock" value="0"></div><div class="fg"><label>Min Stock</label><input type="number" id="dg-minstock" value="10"></div></div>
    <div class="form-row"><div class="fg"><label>Price</label><input type="number" id="dg-price" step="0.01"></div><div class="fg"><label>Expiry Date</label><input type="date" id="dg-expiry"></div></div>
    <div class="fg"><label>Supplier</label><input type="text" id="dg-supplier"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;"><button class="btn btn-outline" onclick="closeModal('m-add-drug')">Cancel</button><button class="btn btn-teal" onclick="submitAddDrug()">Add Drug</button></div>`;
  openModal('m-add-drug');
}
async function submitAddDrug(){
  const body = { name: document.getElementById('dg-name').value.trim(), category: document.getElementById('dg-category').value||null,
    unit: document.getElementById('dg-unit').value||'tablet', stock: parseInt(document.getElementById('dg-stock').value||0),
    min_stock: parseInt(document.getElementById('dg-minstock').value||10), price: parseFloat(document.getElementById('dg-price').value)||null,
    expiry_date: document.getElementById('dg-expiry').value||null, supplier: document.getElementById('dg-supplier').value||null };
  if (!body.name) { toast('Drug name required','e'); return; }
  try { await api('/drugs', { method:'POST', body: JSON.stringify(body) }); closeModal('m-add-drug'); toast('Drug added','s'); renderPharmacy(); }
  catch(e){ toast(e.message,'e'); }
}
function openEditDrugModal(id, stock, price){
  document.getElementById('m-add-drug-inner').innerHTML = `
    <div class="modal-header"><h2>Update Stock</h2><button class="modal-close" onclick="closeModal('m-add-drug')">✕</button></div>
    <div class="fg"><label>New Stock Level</label><input type="number" id="ed-stock" value="${stock}"></div>
    <div class="fg"><label>Price</label><input type="number" id="ed-price" step="0.01" value="${price}"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;"><button class="btn btn-outline" onclick="closeModal('m-add-drug')">Cancel</button><button class="btn btn-teal" onclick="submitEditDrug(${id})">Save</button></div>`;
  openModal('m-add-drug');
}
async function submitEditDrug(id){
  const body = { stock: parseInt(document.getElementById('ed-stock').value), price: parseFloat(document.getElementById('ed-price').value)||null };
  try { await api(`/drugs/${id}`, { method:'PATCH', body: JSON.stringify(body) }); closeModal('m-add-drug'); toast('Stock updated','s'); renderPharmacy(); }
  catch(e){ toast(e.message,'e'); }
}

// =====================================================================
// STAFF (admin only)
// =====================================================================
async function renderStaff(){
  const el = document.getElementById('page-staff');
  el.innerHTML = `<div class="sec-hdr"><span></span>${canDo('add-staff')?`<button class="btn btn-teal" onclick="openAddStaffModal()">+ Add Staff</button>`:''}</div>
    <div class="card" id="staff-table"><div class="spinner">Loading…</div></div>`;
  const staff = await api('/staff'); CACHE.staff = staff;
  document.getElementById('staff-table').innerHTML = staff.length ? `
    <table><thead><tr><th>Name</th><th>Role</th><th>Specialization</th><th>Phone</th><th>Status</th><th></th></tr></thead>
    <tbody>${staff.map(s=>`<tr><td><strong>${esc(s.full_name)}</strong></td>
      <td><span class="badge ${s.role==='dentist'?'badge-teal':s.role==='pharmacist'?'badge-purple':s.role==='admin'?'badge-rose':'badge-amber'}">${esc(s.role)}</span></td>
      <td style="font-size:12px;color:var(--text-2);">${esc(s.specialization||'—')}</td><td style="font-size:12px;color:var(--text-2);">${esc(s.phone||'—')}</td>
      <td><span class="badge ${statusBadge(s.status)}">${esc(s.status)}</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="toggleStaffStatus(${s.id},'${s.status==='active'?'inactive':'active'}')">${s.status==='active'?'Deactivate':'Activate'}</button></td>
    </tr>`).join('')}</tbody></table>` : `<div class="empty"><div class="ei">👥</div><h3>No staff yet</h3></div>`;
}
function openAddStaffModal(){
  document.getElementById('m-add-staff-inner').innerHTML = `
    <div class="modal-header"><h2>👥 Add Staff</h2><button class="modal-close" onclick="closeModal('m-add-staff')">✕</button></div>
    <div class="fg"><label>Full Name *</label><input type="text" id="st-name"></div>
    <div class="fg"><label>Email *</label><input type="email" id="st-email"></div>
    <div class="fg"><label>Temporary Password *</label><input type="text" id="st-pass"></div>
    <div class="form-row"><div class="fg"><label>Role *</label><select id="st-role"><option value="dentist">Dentist</option><option value="receptionist">Receptionist</option><option value="pharmacist">Pharmacist</option><option value="nurse">Nurse</option><option value="admin">Admin</option></select></div>
    <div class="fg"><label>Specialization</label><input type="text" id="st-spec"></div></div>
    <div class="fg"><label>Phone</label><input type="text" id="st-phone"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;"><button class="btn btn-outline" onclick="closeModal('m-add-staff')">Cancel</button><button class="btn btn-teal" onclick="submitAddStaff()">Add Staff</button></div>`;
  openModal('m-add-staff');
}
async function submitAddStaff(){
  const body = { full_name: document.getElementById('st-name').value.trim(), email: document.getElementById('st-email').value.trim(),
    password: document.getElementById('st-pass').value, role: document.getElementById('st-role').value,
    specialization: document.getElementById('st-spec').value||null, phone: document.getElementById('st-phone').value||null };
  if (!body.full_name||!body.email||!body.password) { toast('Name, email and password required','e'); return; }
  try { await api('/staff', { method:'POST', body: JSON.stringify(body) }); closeModal('m-add-staff'); toast('Staff added','s'); renderStaff(); }
  catch(e){ toast(e.message,'e'); }
}
async function toggleStaffStatus(id, status){
  try { await api(`/staff/${id}`, { method:'PATCH', body: JSON.stringify({ status }) }); toast('Staff updated','s'); renderStaff(); }
  catch(e){ toast(e.message,'e'); }
}

// =====================================================================
// REPORTS
// =====================================================================
async function renderReports(){
  const el = document.getElementById('page-reports');
  const reports = [
    {icon:'🦷',title:'Patient Report Card',desc:'Full dental record with chart summary — live data',action:()=>{ if(!CURRENT_PATIENT_ID){toast('Open a patient profile first','e');return;} REPORT_MODE='card'; showPage('report-card'); }},
    {icon:'📄',title:'Invoice / Receipt',desc:'Open the billing page to review invoices and receipts',action:()=>{ showPage('billing'); }},
    {icon:'💊',title:'Prescription Slip',desc:'View prescriptions and print slips from the prescriptions page',action:()=>{ if(!CURRENT_PATIENT_ID){toast('Open a patient profile first','e');return;} showPage('prescriptions'); }},
    {icon:'📋',title:'Referral Letter',desc:'Generate a patient referral using live chart and visit data',action:()=>{ if(!CURRENT_PATIENT_ID){toast('Open a patient profile first','e');return;} REPORT_MODE='referral'; showPage('report-card'); }},
    {icon:'📊',title:'Monthly Revenue',desc:'Review monthly revenue and invoice summary on the billing page',action:()=>{ showPage('billing'); }},
    {icon:'📅',title:'Staff Attendance',desc:'View staff availability summary on the staff page',action:()=>{ showPage('staff'); }},
  ];
  // Uses data-idx + a single delegated listener instead of inline onclick strings —
  // avoids the duplicate-attribute bug where a second onclick="" was silently dropped.
  el.innerHTML = `<div class="three-col">${reports.map((r,i)=>`
    <div class="card report-card-tile" data-idx="${i}" style="cursor:pointer;">
      <div class="card-body" style="text-align:center;padding:20px 14px;">
        <div style="font-size:32px;margin-bottom:8px;">${r.icon}</div>
        <div style="font-size:14px;font-weight:700;margin-bottom:4px;">${esc(r.title)}</div>
        <div style="font-size:12px;color:var(--text-2);margin-bottom:12px;">${esc(r.desc)}</div>
        <button class="btn btn-teal btn-sm">View</button>
      </div></div>`).join('')}</div>`;
  window.__REPORTS = reports;
  el.querySelectorAll('.report-card-tile').forEach(tile => {
    tile.addEventListener('click', () => window.__REPORTS[parseInt(tile.dataset.idx)].action());
  });
}

// =====================================================================
// REFERRAL LETTER (live data via GET /reports/referral/:patientId)
// =====================================================================
async function renderReferralLetter(){
  const el = document.getElementById('page-report-card');
  const id = CURRENT_PATIENT_ID;
  el.innerHTML = '<div class="spinner">Building referral letter…</div>';
  const data = await api(`/reports/referral/${id}`);
  const { patient, latestVisit, dentalChart, prescriptions } = data;
  const chartSummary = dentalChart.length
    ? dentalChart.sort((a,b)=>a.tooth_number-b.tooth_number).map(c=>`#${c.tooth_number} (${esc(c.condition)})`).join(', ')
    : 'No dental chart entries on file.';
  const rxSummary = prescriptions.length
    ? prescriptions.map(p=>`${esc(p.drug_name)} ${esc(p.dosage)} — ${esc(p.frequency)}, ${esc(p.duration)}`).join('<br>')
    : 'No recent prescriptions on file.';
  el.innerHTML = `
    <div class="sec-hdr"><button class="btn btn-outline btn-sm" onclick="showPage('patient-profile')">← Back</button><button class="btn btn-teal" onclick="window.print()">🖨️ Print</button></div>
    <div class="report-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;padding-bottom:16px;border-bottom:2px solid var(--teal);flex-wrap:wrap;gap:12px;">
        <div><div style="font-family:'Syne',sans-serif;font-size:19px;font-weight:800;color:var(--teal);">DentCare Pro</div><div style="font-size:12px;color:var(--text-2);">Dental Clinic & Management System</div></div>
        <div style="text-align:right;"><div style="font-size:17px;font-weight:800;">Referral Letter</div><div style="font-size:12px;color:var(--text-2);">Generated: ${new Date(data.generatedAt).toLocaleDateString()}</div></div>
      </div>
      <p style="font-size:13px;margin-bottom:16px;">To whom it may concern,</p>
      <p style="font-size:13px;margin-bottom:16px;line-height:1.6;">
        We are referring our patient <strong>${esc(patient.full_name)}</strong> (Patient ID: ${esc(patient.patient_id)}, DOB: ${esc(patient.date_of_birth||'—')})
        for further evaluation. ${patient.allergies ? `The patient has noted allergies: <strong style="color:var(--rose);">${esc(patient.allergies)}</strong>.` : ''}
      </p>
      <div style="margin-bottom:16px;"><strong style="font-size:13px;">Most recent visit:</strong>
        <p style="font-size:13px;color:var(--text-2);margin-top:4px;">
          ${latestVisit ? `${new Date(latestVisit.created_at).toLocaleDateString()} — ${esc(latestVisit.diagnosis||latestVisit.treatment_done||'No diagnosis recorded')} (seen by ${esc(latestVisit.doctor_name||'clinic staff')})` : 'No visit history on file.'}
        </p></div>
      <div style="margin-bottom:16px;"><strong style="font-size:13px;">Dental chart summary:</strong>
        <p style="font-size:13px;color:var(--text-2);margin-top:4px;">${chartSummary}</p></div>
      <div style="margin-bottom:26px;"><strong style="font-size:13px;">Current prescriptions:</strong>
        <p style="font-size:13px;color:var(--text-2);margin-top:4px;">${rxSummary}</p></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:36px;padding-top:16px;border-top:1px solid #e2e8f0;">
        <div style="text-align:center;"><div style="height:36px;"></div><div style="border-top:1.5px solid var(--text);padding-top:7px;font-size:12px;color:var(--text-2);">Referring Doctor Signature</div></div>
        <div style="text-align:center;"><div style="height:36px;"></div><div style="border-top:1.5px solid var(--text);padding-top:7px;font-size:12px;color:var(--text-2);">Clinic Stamp & Date</div></div></div>
      <div style="text-align:center;margin-top:18px;font-size:10px;color:var(--text-2);">This document is computer generated by DentCare Pro · Confidential Medical Record</div>
    </div>`;
}

// =====================================================================
// PRINTABLE REPORT CARD (live data)
// =====================================================================
async function renderReportCard(){
  if (REPORT_MODE === 'referral') { await renderReferralLetter(); return; }
  const el = document.getElementById('page-report-card');
  const id = role() === 'patient' ? USER.patient_id : CURRENT_PATIENT_ID;
  if (!id) { el.innerHTML = `<div class="empty"><div class="ei">👤</div><h3>No patient selected</h3><p>Open a patient profile first.</p></div>`; return; }
  el.innerHTML = '<div class="spinner">Building report…</div>';
  const [p, chart, records] = await Promise.all([api(`/patients/${id}`), api(`/patients/${id}/chart`), api(`/patients/${id}/records`)]);
  const chartRows = chart.length ? chart.sort((a,b)=>a.tooth_number-b.tooth_number).map((r,i)=>`
    <tr style="background:${i%2?'#fff':'#f8fffe'};"><td style="padding:7px 11px;font-weight:700;">#${r.tooth_number}</td><td style="padding:7px 11px;">${esc(r.condition)}</td><td style="padding:7px 11px;color:#64748b;">${esc(r.treatment_date||'—')}</td><td style="padding:7px 11px;color:#64748b;">${esc(r.doctor_name||'—')}</td></tr>`).join('')
    : `<tr><td colspan="4" style="padding:10px;text-align:center;color:#64748b;">No dental chart entries</td></tr>`;
  const recordRows = records.length ? records.slice(0,6).map((r,i)=>`
    <tr style="background:${i%2?'#fff':'#f8fffe'};"><td style="padding:7px 11px;">${new Date(r.created_at).toLocaleDateString()}</td><td style="padding:7px 11px;font-weight:600;">${esc(r.diagnosis||r.treatment_done||'—')}</td><td style="padding:7px 11px;color:#64748b;">${esc(r.doctor_name||'—')}</td></tr>`).join('')
    : `<tr><td colspan="3" style="padding:10px;text-align:center;color:#64748b;">No visit history</td></tr>`;
  const latestNote = records[0];
  el.innerHTML = `
    <div class="sec-hdr"><button class="btn btn-outline btn-sm" onclick="showPage('patient-profile')">← Back</button><button class="btn btn-teal" onclick="window.print()">🖨️ Print</button></div>
    <div class="report-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;padding-bottom:16px;border-bottom:2px solid var(--teal);flex-wrap:wrap;gap:12px;">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:50px;height:50px;border-radius:13px;background:linear-gradient(135deg,var(--teal),var(--blue));display:flex;align-items:center;justify-content:center;">
            <svg width="28" height="28" viewBox="0 0 56 56" fill="none"><path d="M28 8C28 8 18 14 18 26C18 32 22 36 28 36C34 36 38 32 38 26C38 14 28 8Z" fill="white" opacity="0.9"/><path d="M28 36C28 36 20 38 20 44C20 47 23 48 28 48C33 48 36 47 36 44C36 38 28 36 28 36Z" fill="white" opacity="0.6"/></svg></div>
          <div><div style="font-family:'Syne',sans-serif;font-size:19px;font-weight:800;color:var(--teal);">DentCare Pro</div><div style="font-size:12px;color:var(--text-2);">Dental Clinic & Management System</div></div>
        </div>
        <div style="text-align:right;"><div style="font-size:17px;font-weight:800;">Patient Report Card</div><div style="font-size:12px;color:var(--text-2);">Generated: ${new Date().toLocaleDateString()}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:22px;padding:16px;background:#f8fffe;border-radius:10px;border:1px solid var(--border);">
        <div><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-2);margin-bottom:8px;">Patient Information</div>
          <div style="font-size:13px;margin-bottom:5px;"><span style="color:var(--text-2);">Full Name:</span> <strong>${esc(p.full_name)}</strong></div>
          <div style="font-size:13px;margin-bottom:5px;"><span style="color:var(--text-2);">Patient ID:</span> <strong>${esc(p.patient_id)}</strong></div>
          <div style="font-size:13px;margin-bottom:5px;"><span style="color:var(--text-2);">Date of Birth:</span> <strong>${esc(p.date_of_birth||'—')}</strong></div>
          <div style="font-size:13px;margin-bottom:5px;"><span style="color:var(--text-2);">Blood Type:</span> <strong>${esc(p.blood_type||'—')}</strong></div>
          <div style="font-size:13px;"><span style="color:var(--text-2);">Allergies:</span> <strong style="color:var(--rose);">${esc(p.allergies||'None recorded')}</strong></div></div>
        <div><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-2);margin-bottom:8px;">Contact Details</div>
          <div style="font-size:13px;margin-bottom:5px;"><span style="color:var(--text-2);">Phone:</span> <strong>${esc(p.phone||'—')}</strong></div>
          <div style="font-size:13px;margin-bottom:5px;"><span style="color:var(--text-2);">Email:</span> <strong>${esc(p.email||'—')}</strong></div>
          <div style="font-size:13px;margin-bottom:5px;"><span style="color:var(--text-2);">Emergency:</span> <strong>${esc(p.emergency_name||'—')}${p.emergency_phone?' · '+esc(p.emergency_phone):''}</strong></div>
          <div style="font-size:13px;"><span style="color:var(--text-2);">Address:</span> <strong>${esc(p.address||'—')}</strong></div></div>
      </div>
      <div style="margin-bottom:22px;"><div style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--teal);text-transform:uppercase;">🦷 Dental Chart Summary</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:var(--teal);color:#fff;"><th style="padding:7px 11px;text-align:left;">Tooth</th><th style="padding:7px 11px;text-align:left;">Condition</th><th style="padding:7px 11px;text-align:left;">Date</th><th style="padding:7px 11px;text-align:left;">Doctor</th></tr></thead><tbody>${chartRows}</tbody></table></div>
      <div style="margin-bottom:22px;"><div style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--teal);text-transform:uppercase;">📋 Recent Visit History</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:var(--teal);color:#fff;"><th style="padding:7px 11px;text-align:left;">Date</th><th style="padding:7px 11px;text-align:left;">Diagnosis / Treatment</th><th style="padding:7px 11px;text-align:left;">Doctor</th></tr></thead><tbody>${recordRows}</tbody></table></div>
      ${latestNote?`<div style="margin-bottom:26px;"><div style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--teal);text-transform:uppercase;">📝 Doctor's Notes</div>
        <div style="padding:13px;background:#f8fffe;border-radius:9px;border-left:3px solid var(--teal);font-size:13px;">${esc(latestNote.notes||latestNote.treatment_plan||'No additional notes.')}
        <div style="margin-top:7px;font-size:11px;color:var(--text-2);">— ${esc(latestNote.doctor_name||'Clinic staff')} · ${new Date(latestNote.created_at).toLocaleDateString()}</div></div></div>`:''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:36px;padding-top:16px;border-top:1px solid #e2e8f0;">
        <div style="text-align:center;"><div style="height:36px;"></div><div style="border-top:1.5px solid var(--text);padding-top:7px;font-size:12px;color:var(--text-2);">Treating Doctor Signature</div></div>
        <div style="text-align:center;"><div style="height:36px;"></div><div style="border-top:1.5px solid var(--text);padding-top:7px;font-size:12px;color:var(--text-2);">Clinic Stamp & Date</div></div></div>
      <div style="text-align:center;margin-top:18px;font-size:10px;color:var(--text-2);">This document is computer generated by DentCare Pro · Confidential Medical Record</div>
    </div>`;
}
