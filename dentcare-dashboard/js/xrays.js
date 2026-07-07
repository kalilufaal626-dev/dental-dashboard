// X-Ray Management module
// Temporary localStorage fallback until backend X-Ray routes exist.
const XRAY_FALLBACK_KEY = 'xrays_fallback_v1';
const XRAY_TYPES = ['Bitewing','Periapical','Occlusal','Panoramic (OPG)','Cephalometric','CBCT','Intraoral Photo','Extraoral Photo','Other'];

function getFallbackXRays(){
  try{ return JSON.parse(localStorage.getItem(XRAY_FALLBACK_KEY) || '[]'); }
  catch(e){ return []; }
}
function saveFallbackXRays(data){ localStorage.setItem(XRAY_FALLBACK_KEY, JSON.stringify(data)); }
function generateXRayId(){ return 'xray_' + Date.now() + '_' + Math.floor(Math.random()*1000); }

async function fetchAllXRays(){
  try{ return await api('/xrays'); }
  catch(err){ if(err.status === 404){ return getFallbackXRays(); } throw err; }
}

async function fetchPatientXRays(patientId){
  try{ return await api(`/patients/${patientId}/xrays`); }
  catch(err){
    if(err.status === 404){
      return getFallbackXRays().filter(x=> String(x.patient_id) === String(patientId));
    }
    throw err;
  }
}

async function postXRay(patientId, formData, progressCallback){
  try{
    return await uploadXRayToApi(patientId, formData, progressCallback);
  }catch(err){
    if(err.status === 404){
      const stored = getFallbackXRays();
      const file = formData.get('image');
      const record = { id: generateXRayId(), patient_id: patientId, title: formData.get('title'), type: formData.get('type'), tooth_number: formData.get('tooth_number'), taken_date: formData.get('taken_date'), doctor: formData.get('doctor'), notes: formData.get('notes'), image: '', created_at: new Date().toISOString() };
      if(file && file instanceof File){
        record.image = ''; // will be set by FileReader below
        const reader = new FileReader();
        reader.onload = function(){ record.image = reader.result; stored.unshift(record); saveFallbackXRays(stored); };
        reader.readAsDataURL(file);
      } else { stored.unshift(record); saveFallbackXRays(stored); }
      return record;
    }
    throw err;
  }
}

async function uploadXRayToApi(patientId, formData, progressCallback){
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/patients/${patientId}/xrays`);
    const token = window.APP_STATE.token || localStorage.getItem('token');
    if(token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.upload.onprogress = function(event){ if(progressCallback && event.lengthComputable) progressCallback(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = function(){
      if(xhr.status === 401){ window.dispatchEvent(new CustomEvent('session:expired')); reject({status:401,message:'Unauthorized'}); return; }
      if(xhr.status >= 200 && xhr.status < 300){
        try{ resolve(JSON.parse(xhr.responseText)); }catch(e){ resolve(xhr.responseText); }
      } else {
        const message = xhr.responseText || `Upload failed: ${xhr.status}`;
        const err = new Error(message); err.status = xhr.status; reject(err);
      }
    };
    xhr.onerror = function(){ reject(new Error('Upload failed')); };
    xhr.send(formData);
  });
}

async function patchXRay(id, payload){
  try{ return await api(`/xrays/${id}`, {method:'PATCH', body: payload}); }
  catch(err){ if(err.status === 404){ const items = getFallbackXRays(); const index = items.findIndex(x=> String(x.id)===String(id)); if(index >= 0){ items[index] = Object.assign({}, items[index], payload); saveFallbackXRays(items); return items[index]; } throw err } throw err; }
}

async function deleteXRay(id){
  try{ await api(`/xrays/${id}`, {method:'DELETE'}); return true; }
  catch(err){ if(err.status === 404){ const items = getFallbackXRays().filter(x=> String(x.id) !== String(id)); saveFallbackXRays(items); return true; } throw err; }
}

function getXRayImageSrc(xray){
  if(!xray) return '';
  if(typeof xray.image === 'string' && xray.image.startsWith('data:')) return xray.image;
  if(typeof xray.image === 'string') return xray.image;
  return ''; 
}

function formatXRayDate(value){ if(!value) return ''; return new Date(value).toLocaleDateString(); }

async function renderXRays(patientId){
  const container = el('#content'); if(!container) return;
  clear(container);
  container.appendChild(create('h2',{},['X-Rays']));
  const toolbar = create('div',{class:'filter-row'},[]);
  const uploadBtn = create('button',{},['Upload X-Ray']);
  const user = window.APP_STATE.user || {};
  if(['admin','dentist','assistant'].includes(user.role)){
    uploadBtn.addEventListener('click', ()=> openXRayModal(patientId));
    toolbar.appendChild(uploadBtn);
  }
  const search = create('input',{placeholder:'Search title, type, doctor, tooth',class:'search-input'});
  const typeFilter = create('select',{},[]);
  typeFilter.appendChild(create('option',{value:''},['All types']));
  XRAY_TYPES.forEach(type=> typeFilter.appendChild(create('option',{value:type},[type])));
  const doctorFilter = create('input',{placeholder:'Doctor'});
  const toothFilter = create('input',{placeholder:'Tooth #'});
  const dateFilter = create('input',{type:'date'});
  toolbar.appendChild(search); toolbar.appendChild(typeFilter); toolbar.appendChild(doctorFilter); toolbar.appendChild(toothFilter); toolbar.appendChild(dateFilter);
  const timelineBtn = create('button',{class:'secondary'},['Timeline view']);
  let timelineMode = false;
  toolbar.appendChild(timelineBtn);
  const gallery = create('div',{class:'gallery-grid'},[]);
  container.appendChild(toolbar);
  container.appendChild(gallery);

  async function load(){
    clear(gallery);
    try{
      let items = patientId ? await fetchPatientXRays(patientId) : await fetchAllXRays();
      items = (items||[]).sort((a,b)=> new Date(b.taken_date || b.created_at) - new Date(a.taken_date || a.created_at));
      const q = (search.value||'').toLowerCase();
      const type = typeFilter.value;
      const doctor = (doctorFilter.value||'').toLowerCase();
      const tooth = (toothFilter.value||'').toLowerCase();
      const dateVal = dateFilter.value;
      items = items.filter(item=>{
        const matches = !q || ((item.title||'').toLowerCase().includes(q) || (item.type||'').toLowerCase().includes(q) || (item.doctor||'').toLowerCase().includes(q) || String(item.tooth_number||'').includes(q));
        const matchesType = !type || item.type === type;
        const matchesDoctor = !doctor || (item.doctor||'').toLowerCase().includes(doctor);
        const matchesTooth = !tooth || String(item.tooth_number||'').includes(tooth);
        const matchesDate = !dateVal || formatXRayDate(item.taken_date) === new Date(dateVal).toLocaleDateString();
        return matches && matchesType && matchesDoctor && matchesTooth && matchesDate;
      });
      if(items.length === 0){ gallery.appendChild(create('div',{},['No X-rays have been uploaded yet.'])); return; }
      items.forEach(item=>{
        const card = create('div',{class:'card xray-card'},[]);
        const thumb = create('div',{class:'xray-thumb'});
        const img = create('img',{src:getXRayImageSrc(item),alt:item.title});
        img.addEventListener('click', ()=> viewXRay(item.id));
        thumb.appendChild(img);
        card.appendChild(thumb);
        card.appendChild(create('div',{class:'xray-meta'},[create('div',{},[item.title || 'Untitled'])]));
        card.appendChild(create('div',{class:'xray-meta'},[`Type: ${item.type||'Other'}`]));
        card.appendChild(create('div',{class:'xray-meta'},[`Date: ${formatXRayDate(item.taken_date||item.created_at)}`]));
        card.appendChild(create('div',{class:'xray-meta'},[`Doctor: ${item.doctor || 'N/A'}`]));
        card.appendChild(create('div',{class:'xray-meta'},[`Tooth: ${item.tooth_number || 'N/A'}`]));
        const actions = create('div',{class:'xray-actions'},[]);
        const viewBtn = create('button',{},['Open']); viewBtn.addEventListener('click', ()=> viewXRay(item.id)); actions.appendChild(viewBtn);
        if(['admin','dentist'].includes(user.role)){
          const editBtn = create('button',{},['Edit']); editBtn.addEventListener('click', ()=> openXRayModal(patientId || item.patient_id, item)); actions.appendChild(editBtn);
        }
        if(['admin','dentist','assistant'].includes(user.role)){
          const deleteBtn = create('button',{},['Delete']); deleteBtn.addEventListener('click', async ()=>{ if(confirm('Delete this X-ray?')){ await deleteXRay(item.id); load(); showToast('X-ray deleted'); }}); actions.appendChild(deleteBtn);
        }
        const dlBtn = create('button',{},['Download']); dlBtn.addEventListener('click', ()=> downloadXRay(item.id)); actions.appendChild(dlBtn);
        const prBtn = create('button',{},['Print']); prBtn.addEventListener('click', ()=> printXRay(item.id)); actions.appendChild(prBtn);
        card.appendChild(actions);
        gallery.appendChild(card);
      });
    }catch(err){ gallery.appendChild(create('div',{},['Failed to load X-rays'])); }
  }

  search.addEventListener('input', load);
  typeFilter.addEventListener('change', load);
  doctorFilter.addEventListener('input', load);
  toothFilter.addEventListener('input', load);
  dateFilter.addEventListener('change', load);
  timelineBtn.addEventListener('click', ()=>{
    timelineMode = !timelineMode;
    gallery.classList.toggle('timeline-mode', timelineMode);
    timelineBtn.textContent = timelineMode ? 'Grid view' : 'Timeline view';
  });
  await load();
}

function openXRayModal(patientId, existing=null){
  const user = window.APP_STATE.user || {};
  if(!['admin','dentist','assistant'].includes(user.role) && !existing){ showToast('You do not have permission to upload X-rays'); return; }
  const record = existing || { title:'', type:'Bitewing', tooth_number:'', taken_date:'', doctor:'', notes:'', image:'', patient_id:patientId };
  const content = create('div',{},[]);
  content.innerHTML = `
    <form id="xray-form" class="xray-form">
      <label>Patient ID<input name="patient_id" value="${record.patient_id||''}" required></label>
      <label>Title<input name="title" value="${record.title||''}" required></label>
      <label>Type<select name="type">${XRAY_TYPES.map(type=>`<option value="${type}" ${type===record.type?'selected':''}>${type}</option>`).join('')}</select></label>
      <label>Tooth Number<input name="tooth_number" value="${record.tooth_number||''}"></label>
      <label>Date Taken<input type="date" name="taken_date" value="${record.taken_date ? record.taken_date.split('T')[0] : ''}"></label>
      <label>Doctor<input name="doctor" value="${record.doctor||''}"></label>
      <label>Notes<textarea name="notes">${record.notes||''}</textarea></label>
      <label>Image<input type="file" name="image" accept="image/jpeg,image/jpg,image/png,image/webp"></label>
      <div class="xray-preview" id="xray-preview"></div>
      <div class="xray-progress" id="xray-progress" hidden><div class="xray-progress-fill"></div></div>
      <div><button type="submit">Save X-Ray</button></div>
    </form>
  `;
  showModal(content.innerHTML, existing ? 'Edit X-Ray' : 'Upload X-Ray');
  const form = document.querySelector('#xray-form');
  const preview = document.querySelector('#xray-preview');
  const progress = document.querySelector('#xray-progress');
  const progressFill = progress.querySelector('.xray-progress-fill');
  const fileInput = form.querySelector('input[name="image"]');
  if(record.image){ preview.innerHTML = `<img src="${getXRayImageSrc(record)}" alt="Preview">`; }
  fileInput.addEventListener('change', ()=>{
    const file = fileInput.files[0];
    if(!file) return;
    if(!['image/jpeg','image/jpg','image/png','image/webp'].includes(file.type)){ showToast('Unsupported image format'); fileInput.value=''; return; }
    if(file.size > 10 * 1024 * 1024){ showToast('Maximum file size is 10MB'); fileInput.value=''; return; }
    const reader = new FileReader();
    reader.onload = ()=>{ preview.innerHTML = `<img src="${reader.result}" alt="Preview"> <div>Size: ${(file.size/1024/1024).toFixed(2)} MB</div>`; };
    reader.readAsDataURL(file);
  });
  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const fd = new FormData(form);
    if(!existing && !fd.get('image')){ showToast('Please select an image'); return; }
    progress.hidden = false;
    progressFill.style.width = '0%';
    try{
      let result;
      if(existing && !fd.get('image')){
        result = await patchXRay(existing.id, { title: fd.get('title'), type: fd.get('type'), tooth_number: fd.get('tooth_number'), taken_date: fd.get('taken_date'), doctor: fd.get('doctor'), notes: fd.get('notes') });
      } else {
        result = await postXRay(fd.get('patient_id'), fd, percent=>{ progressFill.style.width = percent + '%'; });
      }
      closeModal(); showToast('X-ray saved');
      renderXRays(existing ? existing.patient_id : fd.get('patient_id'));
    }catch(err){ showToast(err.message || 'Failed to save X-ray'); }
  });
}

async function viewXRay(id){
  try{
    let xray;
    try{ xray = await api(`/xrays/${id}`); }
    catch(err){ if(err.status===404){ xray = getFallbackXRays().find(x=> String(x.id)===String(id)); } else throw err; }
    if(!xray){ showToast('X-ray not found'); return; }
    const content = create('div',{class:'xray-lightbox'},[]);
    const img = create('img',{src:getXRayImageSrc(xray),alt:xray.title,style:'transform:scale(1) rotate(0deg);'});
    content.appendChild(img);
    const controls = create('div',{class:'xray-viewer-controls'},[]);
    let scale = 1; let rotation = 0;
    const zoomIn = create('button',{},['Zoom +']);
    const zoomOut = create('button',{},['Zoom -']);
    const left = create('button',{},['Rotate left']);
    const right = create('button',{},['Rotate right']);
    const dl = create('button',{},['Download']);
    const pr = create('button',{},['Print']);
    const closeBtn = create('button',{class:'secondary'},['Close']);
    zoomIn.addEventListener('click', ()=>{ scale += 0.2; img.style.transform = `scale(${scale}) rotate(${rotation}deg)`; });
    zoomOut.addEventListener('click', ()=>{ scale = Math.max(0.4, scale - 0.2); img.style.transform = `scale(${scale}) rotate(${rotation}deg)`; });
    left.addEventListener('click', ()=>{ rotation -= 90; img.style.transform = `scale(${scale}) rotate(${rotation}deg)`; });
    right.addEventListener('click', ()=>{ rotation += 90; img.style.transform = `scale(${scale}) rotate(${rotation}deg)`; });
    dl.addEventListener('click', ()=> downloadXRay(id));
    pr.addEventListener('click', ()=> printXRay(id));
    closeBtn.addEventListener('click', closeModal);
    controls.append(zoomIn, zoomOut, left, right, dl, pr, closeBtn);
    content.appendChild(controls);
    showModal('', xray.title || 'X-Ray');
    const modal = el('#modal-root .modal');
    if(modal){ const panel = modal.querySelector('.panel'); panel.innerHTML = ''; panel.appendChild(create('h3',{},[xray.title || 'X-Ray'])); panel.appendChild(content); }
  }catch(err){ showToast('Failed to load X-ray'); }
}

async function downloadXRay(id){
  let xray;
  try{ xray = await api(`/xrays/${id}`); }catch(err){ if(err.status===404) xray = getFallbackXRays().find(x=> String(x.id)===String(id)); else { showToast('Download failed'); return; } }
  if(!xray){ showToast('X-ray not found'); return; }
  const src = getXRayImageSrc(xray);
  if(!src){ showToast('No image available'); return; }
  const anchor = document.createElement('a');
  anchor.href = src;
  anchor.download = `${xray.title || 'xray'}.jpg`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function printXRay(id){
  let xray;
  try{ xray = await api(`/xrays/${id}`); }catch(err){ if(err.status===404) xray = getFallbackXRays().find(x=> String(x.id)===String(id)); else { showToast('Print failed'); return; } }
  if(!xray){ showToast('X-ray not found'); return; }
  const src = getXRayImageSrc(xray);
  const printWindow = window.open('', '_blank');
  if(!printWindow) return;
  printWindow.document.write(`<html><head><title>${xray.title}</title></head><body style="margin:0"><img src="${src}" style="width:100%"></body></html>`);
  printWindow.document.close();
  printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
}

window.addEventListener('navigate', (e)=>{
  if(e.detail.page === 'xrays'){ renderXRays(); }
  if(e.detail.page === 'patient-xrays'){ const uid = window.APP_STATE.user && window.APP_STATE.user.patient_id; if(uid) renderXRays(uid); }
});

// Expose helper for dashboard widget use
window.fetchAllXRays = fetchAllXRays;
window.fetchPatientXRays = fetchPatientXRays;
