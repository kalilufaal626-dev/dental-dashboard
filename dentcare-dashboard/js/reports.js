// Report generation and printing
async function safeFetch(path, fallback){
  try{ return await api(path); }
  catch(err){ if(err.status === 404) return fallback; throw err; }
}

async function fetchAllPatients(){
  if(window.__PATIENT_SEARCH_CACHE) return window.__PATIENT_SEARCH_CACHE;
  try{ window.__PATIENT_SEARCH_CACHE = await api('/patients'); }
  catch(err){ window.__PATIENT_SEARCH_CACHE = []; }
  return window.__PATIENT_SEARCH_CACHE;
}

async function fetchReferralReport(patientId){
  try{ return await api(`/reports/referral/${patientId}`); }
  catch(err){ if(err.status === 404) return null; throw err; }
}

async function loadReferralReportData(patientId){
  const report = await fetchReferralReport(patientId);
  if(report){ return Object.assign({ source:'backend' }, report); }
  const patient = await api(`/patients/${patientId}`);
  const appointments = await safeFetch('/appointments', []);
  const prescriptions = await safeFetch('/prescriptions', []);
  const latestVisit = (appointments||[]).filter(a=> String(a.patient_id) === String(patientId)).sort((a,b)=> new Date(b.date||b.created_at) - new Date(a.date||a.created_at))[0] || null;
  const latestPrescription = (prescriptions||[]).filter(p=> String(p.patient_id)===String(patientId)).sort((a,b)=> new Date(b.date||b.created_at) - new Date(a.date||a.created_at))[0] || null;
  const latestDentalChart = await safeFetch(`/patients/${patientId}/chart`, {});
  const dentist = window.APP_STATE.user && (window.APP_STATE.user.name || window.APP_STATE.user.full_name || window.APP_STATE.user.email) || '';
  return {
    source:'fallback',
    patient,
    latestVisit,
    latestDentalChart,
    latestPrescription,
    dentist,
    generatedAt: new Date().toISOString()
  };
}

function buildReferralLetterHtml(data, form){
  const patient = data.patient || {};
  const latestVisit = data.latestVisit || {};
  const latestDentalChart = data.latestDentalChart || {};
  const generatedAt = data.generatedAt ? formatDate(data.generatedAt) : formatDate(new Date());
  const referralDoctor = form.referralDoctor || '';
  const clinic = form.clinic || '';
  const reason = form.reason || 'Please evaluate this patient for further care.';
  const diagnosis = form.diagnosis || latestVisit.diagnosis || latestVisit.reason || '';
  const treatmentDone = form.treatmentDone || latestVisit.treatment || latestVisit.procedure || '';
  const notes = form.notes || '';
  const patientDetails = [
    patient.name ? `Name: ${patient.name}` : null,
    patient.patient_id ? `Patient ID: ${patient.patient_id}` : null,
    patient.dob ? `DOB: ${formatDate(patient.dob)}` : null,
    patient.gender ? `Gender: ${patient.gender}` : null,
    patient.phone ? `Phone: ${patient.phone}` : null,
    patient.email ? `Email: ${patient.email}` : null
  ].filter(Boolean).join('<br>');
  const visitSummary = latestVisit ? `<div style="line-height:1.6;color:#333;"><strong>Date:</strong> ${formatDate(latestVisit.date || latestVisit.created_at)}${latestVisit.doctor ? `<br><strong>Doctor:</strong> ${latestVisit.doctor}` : ''}${latestVisit.reason ? `<br><strong>Reason:</strong> ${latestVisit.reason}` : ''}${latestVisit.status ? `<br><strong>Status:</strong> ${latestVisit.status}` : ''}</div>` : '<div>No recent visit data found.</div>';
  const chartSummary = latestDentalChart && Object.keys(latestDentalChart).length ? `<pre style="white-space:pre-wrap;word-break:break-word;background:#f4f5f7;padding:12px;border-radius:8px;">${JSON.stringify(latestDentalChart,null,2)}</pre>` : '<div>No dental chart summary available.</div>';
  const sourceNotice = data.source === 'backend' ? '' : `<div style="padding:10px;background:#fff4e5;color:#663c00;border-radius:8px;margin-bottom:16px;">Referral data is built from patient profile and record endpoints because /reports/referral/${patient.patient_id||patient.id} is not available.</div>`;
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:760px;">
      ${sourceNotice}
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
        <div>
          <h1 style="margin:0 0 8px 0;">Referral Letter</h1>
          <div>${patient.name || 'Patient'}</div>
          <div style="color:#555;">${patient.patient_id ? `ID: ${patient.patient_id}` : patient.id ? `ID: ${patient.id}` : ''}</div>
        </div>
        <div style="text-align:right;color:#555;font-size:13px;">Generated ${generatedAt}</div>
      </div>

      <div style="margin-bottom:18px;">
        <strong>Referred to:</strong><br>
        ${referralDoctor || '[Referral doctor/clinic]'}<br>
        ${clinic || ''}
      </div>

      <p>Dear ${referralDoctor ? referralDoctor.split(/[\n,]/)[0] : 'Colleague'},</p>
      <p>Please evaluate this patient for additional dental care. Below are the referral details and recent history.</p>

      <section style="margin-bottom:18px;">
        <h2 style="margin:0 0 8px 0;font-size:16px;">Patient Information</h2>
        <div style="line-height:1.6;color:#333;">${patientDetails || 'Patient profile information is unavailable.'}</div>
      </section>

      <section style="margin-bottom:18px;">
        <h2 style="margin:0 0 8px 0;font-size:16px;">Reason for referral</h2>
        <div style="line-height:1.6;color:#333;">${reason || 'N/A'}</div>
      </section>

      <section style="margin-bottom:18px;">
        <h2 style="margin:0 0 8px 0;font-size:16px;">Diagnosis</h2>
        <div style="line-height:1.6;color:#333;">${diagnosis || 'N/A'}</div>
      </section>

      <section style="margin-bottom:18px;">
        <h2 style="margin:0 0 8px 0;font-size:16px;">Treatment already done</h2>
        <div style="line-height:1.6;color:#333;">${treatmentDone || 'N/A'}</div>
      </section>

      <section style="margin-bottom:18px;">
        <h2 style="margin:0 0 8px 0;font-size:16px;">Notes</h2>
        <div style="line-height:1.6;color:#333;">${notes || 'N/A'}</div>
      </section>

      <section style="margin-bottom:18px;">
        <h2 style="margin:0 0 8px 0;font-size:16px;">Recent visit summary</h2>
        ${visitSummary}
      </section>

      <section style="margin-bottom:18px;">
        <h2 style="margin:0 0 8px 0;font-size:16px;">Latest dental chart summary</h2>
        ${chartSummary}
      </section>

      <p style="margin-top:24px;">Thank you for your attention to this referral.</p>

      <div style="margin-top:40px;color:#333;line-height:1.6;">
        <div><strong>Referring dentist:</strong> ${data.dentist || '[Dentist name]'}</div>
        <div><strong>Date:</strong> ${generatedAt}</div>
      </div>
    </div>
  `;
}

async function renderReferralLetterModal(initialPatientId = null){
  const content = create('div',{style:'display:grid;gap:14px;max-width:900px;'},[]);
  const loading = create('div',{style:'padding:16px;color:#555;'},['Loading patients...']);
  content.appendChild(loading);
  showModal(content, 'Referral Letter');

  let patients = [];
  try{ patients = await fetchAllPatients(); }
  catch(err){ loading.textContent = `Unable to load patient list: ${err.message}`; return; }

  const search = create('input',{type:'search',placeholder:'Search patient by name, ID or phone',style:'width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;'});
  const results = create('div',{style:'display:grid;gap:10px;max-height:220px;overflow:auto;border:1px solid #eee;border-radius:10px;padding:10px;'},[]);
  const selectedCard = create('div',{style:'padding:14px;border:1px solid #eee;border-radius:10px;background:#fafafa;display:none;'},[]);
  const previewArea = create('div',{style:'margin-top:18px;'},[]);
  const buttons = create('div',{style:'display:flex;gap:10px;flex-wrap:wrap;'},[]);
  const previewButton = create('button',{class:'btn btn-teal'},['Preview Letter']);
  const printButton = create('button',{class:'btn btn-outline',disabled:true},['Print Letter']);
  buttons.appendChild(previewButton);
  buttons.appendChild(printButton);

  const inputs = {
    referralDoctor: create('input',{type:'text',placeholder:'Referral doctor / clinic',style:'width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;'}),
    clinic: create('input',{type:'text',placeholder:'Clinic name',style:'width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;'}),
    reason: create('textarea',{placeholder:'Reason for referral',style:'width:100%;min-height:80px;padding:10px;border:1px solid #ccc;border-radius:8px;'}),
    diagnosis: create('textarea',{placeholder:'Diagnosis',style:'width:100%;min-height:80px;padding:10px;border:1px solid #ccc;border-radius:8px;'}),
    treatmentDone: create('textarea',{placeholder:'Treatment already done',style:'width:100%;min-height:80px;padding:10px;border:1px solid #ccc;border-radius:8px;'}),
    notes: create('textarea',{placeholder:'Notes',style:'width:100%;min-height:80px;padding:10px;border:1px solid #ccc;border-radius:8px;'})
  };

  clear(content);
  content.appendChild(create('div',{style:'display:grid;gap:14px;'},[
    create('div',{style:'font-size:14px;color:#333;'},['Select a patient for the referral letter.']),
    search,
    results,
    selectedCard,
    create('div',{style:'display:grid;gap:10px;'},[
      create('label',{},['Referral doctor / clinic', inputs.referralDoctor]),
      create('label',{},['Clinic', inputs.clinic]),
      create('label',{},['Reason for referral', inputs.reason]),
      create('label',{},['Diagnosis', inputs.diagnosis]),
      create('label',{},['Treatment already done', inputs.treatmentDone]),
      create('label',{},['Notes', inputs.notes])
    ]),
    buttons,
    previewArea
  ]));

  let selectedPatient = null;
  function renderPatientSummary(patient){
    clear(selectedCard);
    selectedCard.style.display = 'block';
    selectedCard.appendChild(create('div',{style:'font-weight:700;margin-bottom:8px;'},[patient.name || 'Patient']));
    selectedCard.appendChild(create('div',{},[`ID: ${patient.patient_id || patient.id || 'N/A'}`]));
    if(patient.phone) selectedCard.appendChild(create('div',{style:'color:#555;font-size:13px;'},[`Phone: ${patient.phone}`]));
    if(patient.email) selectedCard.appendChild(create('div',{style:'color:#555;font-size:13px;'},[`Email: ${patient.email}`]));
    if(patient.dob) selectedCard.appendChild(create('div',{style:'color:#555;font-size:13px;'},[`DOB: ${formatDate(patient.dob)}`]));
  }

  function selectPatient(patient){
    selectedPatient = patient;
    renderPatientSummary(patient);
    previewArea.innerHTML = '';
    printButton.disabled = true;
  }

  function updateResults(){
    const q = (search.value||'').toLowerCase();
    const matches = (patients||[]).filter(p => {
      return (p.name||'').toLowerCase().includes(q) || (p.patient_id||'').toString().toLowerCase().includes(q) || (p.phone||'').toLowerCase().includes(q);
    }).slice(0, 12);
    clear(results);
    if(matches.length === 0){ results.appendChild(create('div',{style:'color:#555;'},['No matching patients.'])); return; }
    matches.forEach(p=>{
      const card = create('div',{style:'padding:10px;border:1px solid #ddd;border-radius:10px;cursor:pointer;background:#fff;'},[]);
      card.addEventListener('click', ()=> selectPatient(p));
      card.appendChild(create('div',{style:'font-weight:700;'},[p.name || 'Patient']));
      card.appendChild(create('div',{style:'color:#555;font-size:13px;'},[`ID: ${p.patient_id || p.id || 'N/A'}`]));
      if(p.phone) card.appendChild(create('div',{style:'color:#555;font-size:13px;'},[p.phone]));
      results.appendChild(card);
    });
  }

  search.addEventListener('input', updateResults);
  updateResults();

  if(initialPatientId){
    const found = patients.find(p=> String(p.patient_id)===String(initialPatientId) || String(p.id)===String(initialPatientId));
    if(found) selectPatient(found);
  }

  previewButton.addEventListener('click', async ()=>{
    if(!selectedPatient){ showToast('Select a patient first'); return; }
    const patientId = selectedPatient.id || selectedPatient.patient_id;
    let referralData;
    try{ referralData = await loadReferralReportData(patientId); }
    catch(err){ previewArea.innerHTML = `<div style="color:#b00020;padding:12px;">Unable to load referral data: ${err.message}</div>`; return; }
    const formValues = {
      referralDoctor: inputs.referralDoctor.value.trim(),
      clinic: inputs.clinic.value.trim(),
      reason: inputs.reason.value.trim(),
      diagnosis: inputs.diagnosis.value.trim(),
      treatmentDone: inputs.treatmentDone.value.trim(),
      notes: inputs.notes.value.trim()
    };
    const html = buildReferralLetterHtml(referralData, formValues);
    previewArea.innerHTML = html;
    printButton.disabled = false;
    printButton.onclick = ()=> openReportPrintWindow('Referral Letter', html);
  });
}

function formatMoney(value){
  return typeof value === 'number' ? `$${value.toFixed(2)}` : value ? `$${Number(value).toFixed(2)}` : '$0.00';
}

function createReportSection(title, children){
  const section = create('div',{class:'card',style:'margin-bottom:16px;padding:16px;'} ,[]);
  section.appendChild(create('h3',{style:'margin-top:0;margin-bottom:12px;'},[title]));
  children.forEach(child => section.appendChild(child));
  return section;
}

function buildPatientReportHtml(data){
  const patient = data.patient || {};
  const contact = [];
  if(patient.email) contact.push(`Email: ${patient.email}`);
  if(patient.phone) contact.push(`Phone: ${patient.phone}`);
  if(patient.dob) contact.push(`DOB: ${formatDate(patient.dob)}`);
  if(patient.gender) contact.push(`Gender: ${patient.gender}`);
  const header = [`<div style="margin-bottom:16px;"><strong>${patient.name || 'Patient'}</strong><br>${patient.patient_id || patient.id || ''}<br>${contact.join(' | ')}</div>`];

  const appointmentsHtml = data.visitHistory.length ? data.visitHistory.map(a => `
      <div style="margin-bottom:10px;"><strong>${formatDate(a.date) || ''}</strong> — ${a.status || ''} ${a.doctor ? `| Dr. ${a.doctor}` : ''}<div style="font-size:13px;color:#555;">${a.notes || a.notes || ''}</div></div>`).join('') : '<div>No visits on record.</div>';
  const chartHtml = data.chart && Object.keys(data.chart).length ? `<pre style="white-space:pre-wrap;word-break:break-word;background:#f9fafb;padding:12px;border-radius:8px;">${JSON.stringify(data.chart,null,2)}</pre>` : '<div>No dental chart data available.</div>';
  const prescriptionsHtml = data.prescriptions.length ? data.prescriptions.map(p => `<div style="margin-bottom:8px;"><strong>${p.drug || p.name || 'Medication'}</strong> — ${p.status || ''}${p.dosage ? ` | ${p.dosage}` : ''}${p.date ? ` | ${formatDate(p.date)}` : ''}</div>`).join('') : '<div>No prescriptions found.</div>';
  const invoicesHtml = data.invoices.length ? data.invoices.map(i => `<div style="margin-bottom:8px;"><strong>Invoice #${i.id || i.invoice_number || ''}</strong> — ${i.status || ''} — ${formatMoney(i.total || i.amount || i.balance)}${i.date ? ` | ${formatDate(i.date)}` : ''}</div>`).join('') : '<div>No billing records yet.</div>';
  const notesHtml = data.doctorNotes.length ? data.doctorNotes.map(n => `<div style="margin-bottom:8px;"><strong>${formatDate(n.date) || ''}${n.doctor ? ` | Dr. ${n.doctor}` : ''}</strong><div style="font-size:13px;color:#333;">${n.note}</div></div>`).join('') : '<div>No doctor notes available.</div>';

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111;">
      <h1 style="margin-top:0;">Patient Report Card</h1>
      <div style="margin-bottom:18px;font-size:14px;color:#333;">${data.warning || ''}</div>
      <div style="margin-bottom:16px;">${header.join('')}</div>
      <section style="margin-bottom:24px;">
        <h2 style="margin-bottom:10px;">Visit History</h2>
        ${appointmentsHtml}
      </section>
      <section style="margin-bottom:24px;">
        <h2 style="margin-bottom:10px;">Dental Chart Summary</h2>
        ${chartHtml}
      </section>
      <section style="margin-bottom:24px;">
        <h2 style="margin-bottom:10px;">Prescriptions</h2>
        ${prescriptionsHtml}
      </section>
      <section style="margin-bottom:24px;">
        <h2 style="margin-bottom:10px;">Billing Summary</h2>
        ${invoicesHtml}
      </section>
      <section style="margin-bottom:24px;">
        <h2 style="margin-bottom:10px;">Doctor Notes</h2>
        ${notesHtml}
      </section>
      <div style="font-size:12px;color:#555;margin-top:20px;">Use your browser print dialog to save this report as PDF.</div>
    </div>
  `;
}

function openReportPrintWindow(title, html){
  const printWindow = window.open('', '_blank');
  if(!printWindow){ showToast('Unable to open print window. Please allow popups.'); return; }
  printWindow.document.write(`<!doctype html><html><head><title>${title}</title><style>body{font-family:Arial,Helvetica,sans-serif;margin:20px;color:#111;}h1,h2{margin:0 0 12px;}pre{white-space:pre-wrap;word-break:break-word;background:#f4f5f7;padding:12px;border-radius:8px;}div{line-height:1.5;}</style></head><body>${html}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

async function loadPatientReportData(patientId){
  const missing = [];
  const appointmentList = await safeFetch('/appointments', []);
  const prescriptions = await safeFetch('/prescriptions', []);
  const invoices = await safeFetch('/invoices', []);
  const records = await safeFetch(`/patients/${patientId}/records`, []);
  const chart = await safeFetch(`/patients/${patientId}/chart`, {});

  const patient = await api(`/patients/${patientId}`);
  const visitHistory = (appointmentList||[]).filter(a => String(a.patient_id) === String(patientId)).sort((a,b)=> new Date(b.date||b.created_at) - new Date(a.date||a.created_at));
  const filteredPrescriptions = (prescriptions||[]).filter(p => String(p.patient_id) === String(patientId));
  const filteredInvoices = (invoices||[]).filter(i => String(i.patient_id) === String(patientId));
  const doctorNotes = (records||[]).filter(r => r.note || r.doctor_notes || r.doctor).map(r => ({
    date: r.date || r.created_at || '',
    doctor: r.doctor || r.doctor_name || '',
    note: r.doctor_notes || r.note || ''
  }));

  if(!Array.isArray(appointmentList)) missing.push('/appointments');
  if(!Array.isArray(prescriptions)) missing.push('/prescriptions');
  if(!Array.isArray(invoices)) missing.push('/invoices');
  if(!Array.isArray(records)) missing.push(`/patients/${patientId}/records`);
  if(!chart || typeof chart !== 'object') missing.push(`/patients/${patientId}/chart`);

  return {
    patient,
    visitHistory,
    chart,
    prescriptions: filteredPrescriptions,
    invoices: filteredInvoices,
    doctorNotes,
    missingRoutes: missing.filter((v,i,self)=> self.indexOf(v)===i)
  };
}

function renderReportCardDocument(data){
  const warning = data.missingRoutes.length ? `<div style="padding:12px;background:#fff4e5;color:#663c00;border-radius:8px;margin-bottom:16px;">Missing backend data for: ${data.missingRoutes.join(', ')}</div>` : '';
  return Object.assign({}, data, { warning });
}

async function renderReportForPatient(patientId, doPrint){
  const loading = create('div',{style:'padding:16px;font-size:14px;color:#555;'},['Loading patient report...']);
  const modalContent = create('div',{},[]);
  modalContent.appendChild(loading);

  const actionButtons = create('div',{style:'display:flex;gap:10px;margin-bottom:16px;'},[]);
  const printButton = create('button',{class:'btn btn-teal'},['Print']);
  const pdfButton = create('button',{class:'btn btn-outline'},['Download PDF']);
  actionButtons.appendChild(printButton);
  actionButtons.appendChild(pdfButton);
  modalContent.appendChild(actionButtons);

  const body = create('div',{},[]);
  modalContent.appendChild(body);
  showModal(modalContent, 'Patient Report Card');

  let reportData;
  try{
    reportData = await loadPatientReportData(patientId);
    const documentData = renderReportCardDocument(reportData);
    const reportHtml = buildPatientReportHtml(documentData);
    body.innerHTML = reportHtml;
    printButton.addEventListener('click', ()=> openReportPrintWindow('Patient Report Card', reportHtml));
    pdfButton.addEventListener('click', ()=> openReportPrintWindow('Patient Report Card', reportHtml));
    if(doPrint){ openReportPrintWindow('Patient Report Card', reportHtml); }
  }catch(err){
    body.innerHTML = `<div style="padding:16px;color:#b00020;">Unable to load report: ${err.message}</div>`;
  }
}

async function renderReportsPage(){
  const container = el('#content');
  clear(container);
  container.appendChild(create('h2',{},['Reports']));
  container.appendChild(create('div',{style:'margin:16px 0 8px;font-size:14px;color:#555;'},['Generate a Patient Report Card using a Patient ID or selected patient profile.']));
  const patientInput = create('input',{placeholder:'Patient ID',value: window.APP_STATE.selectedPatientId || '',style:'width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;margin-bottom:12px;'});
  const generateButton = create('button',{class:'btn btn-teal'},['Generate Patient Report Card']);
  generateButton.addEventListener('click', ()=>{
    const patientId = (patientInput.value||'').trim() || window.APP_STATE.selectedPatientId;
    if(!patientId){ showToast('Enter a patient ID or select a patient first.'); return; }
    renderReportForPatient(patientId);
  });
  container.appendChild(patientInput);
  container.appendChild(generateButton);
  if(window.APP_STATE.selectedPatientId){
    container.appendChild(create('div',{style:'margin-top:12px;font-size:13px;color:#555;'},[`Selected patient: ${window.APP_STATE.selectedPatientId}`]));
  }

  const referralSection = create('div',{class:'card',style:'margin-top:24px;padding:16px;'},[]);
  referralSection.appendChild(create('h3',{style:'margin-top:0;margin-bottom:12px;'},['Referral Letter']));
  referralSection.appendChild(create('div',{style:'margin-bottom:12px;color:#555;'},['Create a printable referral letter using patient profile data and custom referral details.']));
  const referralButton = create('button',{class:'btn btn-outline'},['Create Referral Letter']);
  referralButton.addEventListener('click', ()=> renderReferralLetterModal(window.APP_STATE.selectedPatientId));
  referralSection.appendChild(referralButton);
  container.appendChild(referralSection);
}

window.addEventListener('navigate', (e)=>{ if(e.detail.page==='reports') renderReportsPage(); });
