window.addEventListener('navigate', async (e)=>{
  if(e.detail.page !== 'staff') return;
  await renderStaff();
});

async function renderStaff(){
  const container = el('#content'); clear(container);
  container.appendChild(create('h2',{},['Staff']));
  const add = create('button',{},['Add Staff']);
  add.addEventListener('click', ()=> showStaffForm());
  container.appendChild(add);
  try{
    const staff = await api('/staff');
    if((staff||[]).length===0) container.appendChild(create('div',{},['No records available yet.']));
    staff.forEach(s=>{
      const node = create('div',{class:'card'},[`${s.name||s.email} — ${s.role}`]);
      container.appendChild(node);
    });
  }catch(e){ container.appendChild(create('div',{},['Failed to load staff'])) }
}

function showStaffForm(){
  const html = `
    <form id="staff-form">
      <label>Email<input name="email" required></label>
      <label>Role<select name="role">${['admin','dentist','receptionist','pharmacist','assistant'].map(r=>`<option value="${r}">${r}</option>`).join('')}</select></label>
      <div><button type="submit">Create</button></div>
    </form>
  `;
  showModal(html,'Create Staff');
  document.querySelector('#staff-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = { email: fd.get('email'), role: fd.get('role') };
    try{ await api('/staff',{method:'POST', body:payload}); closeModal(); showToast('Staff created'); renderStaff(); }
    catch(err){ showToast('Failed to create staff') }
  });
}
