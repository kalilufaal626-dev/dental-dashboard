// Dental chart rendering and interactions
async function drawDentalChart(patientId, containerId){
  const container = containerId ? el('#'+containerId) : el('#content');
  if(!container) return;
  clear(container);
  const grid = create('div',{class:'tooth-grid'});
  // try fetch chart
  let chart = [];
  try{ chart = await api(`/patients/${patientId}/chart`); }catch(e){ chart = [] }
  for(let i=1;i<=32;i++){
    const state = (chart && chart[i]) || {}; // chart may be array/object
    const status = state.status || 'healthy';
    const t = create('div',{class:'tooth'},[]);
    t.textContent = i;
    const badge = create('div',{class:`badge ${STATUS_BADGES[status] ? STATUS_BADGES[status].class : ''}`},[STATUS_BADGES[status] ? STATUS_BADGES[status].label : status]);
    t.appendChild(badge);
    t.addEventListener('click', ()=>{
      if(window.APP_STATE.user && ['admin','dentist'].includes(window.APP_STATE.user.role)){
        // show quick edit
        const html = `
          <form id="tooth-form">
            <label>Status<select name="status">
              ${Object.keys(STATUS_BADGES).map(s=>`<option value="${s}" ${s===status? 'selected':''}>${STATUS_BADGES[s].label}</option>`).join('')}
            </select></label>
            <div><button type="submit">Save</button></div>
          </form>
        `;
        showModal(html, `Tooth ${i}`);
        document.querySelector('#tooth-form').addEventListener('submit', async (ev)=>{
          ev.preventDefault();
          const fd = new FormData(ev.target);
          const payload = { tooth: i, status: fd.get('status') };
          try{
            await api(`/patients/${patientId}/chart`,{method:'POST', body:payload});
            closeModal(); showToast('Tooth updated');
            drawDentalChart(patientId, containerId);
          }catch(err){ showToast(err.message||'Update failed') }
        });
      }else{
        // patient: show status in toast/modal
        showToast(`Tooth ${i}: ${status}`);
      }
    });
    grid.appendChild(t);
  }
  container.appendChild(grid);
}

window.addEventListener('navigate', (e)=>{
  if(e.detail.page === 'dental-chart'){
    const pid = window.APP_STATE.selectedPatientId || (window.APP_STATE.user && window.APP_STATE.user.patient_id);
    el('#content').innerHTML = '';
    el('#content').appendChild(create('h2',{},['Dental Chart']));
    el('#content').appendChild(create('div',{id:'tooth-grid-container'}));
    drawDentalChart(pid, 'tooth-grid-container');
  }
});
