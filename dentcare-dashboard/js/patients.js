// Patients search and profile
window.addEventListener('navigate', async (e) => {
  if (e.detail.page !== 'patients') return;
  await renderPatients();
});

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------
function patientValue(value) {
  if (value === null || value === undefined || value === '') {
    return 'Not available';
  }

  return String(value);
}

function calculatePatientAge(dateOfBirth) {
  if (!dateOfBirth) return 'Not available';

  const birthDate = new Date(dateOfBirth);

  if (Number.isNaN(birthDate.getTime())) {
    return 'Not available';
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();

  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ?String(age) : 'Not available';
}

function getPatientName(patient) {
  return (
    patient.full_name ||
    patient.name ||
    'Unnamed Patient'
  );
}

function getPatientDatabaseId(patient) {
  return patient.id || patient.patient_id;
}

function clearPatientTabContent() {
  const tabContent = el('#patient-tab-content');

  if (tabContent) {
    clear(tabContent);
  }

  return tabContent;
}

// ---------------------------------------------------------
// Patients list
// ---------------------------------------------------------
async function renderPatients() {
  const container = el('#content');
  clear(container);

  container.appendChild(create('h2', {}, ['Patients']));

  const search = create('input', {
    placeholder: 'Search by name, phone or patient ID',
    class: 'search-input',
    style: 'width:100%;max-width:420px;margin-bottom:16px;'
  });

  container.appendChild(search);

  const list = create('div', {}, []);
  container.appendChild(list);

  async function load() {
    clear(list);
    list.appendChild(create('div', {}, ['Loading patients...']));

    try {
      const data = await api('/patients');
      const query = (search.value || '').trim().toLowerCase();

      const filtered = (data || []).filter((patient) => {
        const name = getPatientName(patient).toLowerCase();
        const phone = String(patient.phone || '').toLowerCase();
        const patientId = String(patient.patient_id || patient.id || '').toLowerCase();

        return (
          name.includes(query) ||
          phone.includes(query) ||
          patientId.includes(query)
        );
      });

      clear(list);

      if (filtered.length === 0) {
        list.appendChild(
          create('div', { class: 'card' }, ['No patients found.'])
        );
        return;
      }

      filtered.forEach((patient) => {
        const card = create('div', { class: 'card' }, []);

        const details = create('div', {
          style: 'display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;'
        }, []);

        const info = create('div', {}, []);

        info.appendChild(
          create('h3', {
            style: 'margin:0 0 6px 0;'
          }, [getPatientName(patient)])
        );

        info.appendChild(
          create('div', {}, [
            `Patient ID: ${patientValue(patient.patient_id || patient.id)}`
          ])
        );

        info.appendChild(
          create('div', {}, [
            `Phone: ${patientValue(patient.phone)}`
          ])
        );

        const openButton = create('button', {}, ['Open Patient']);

        openButton.addEventListener('click', () => {
          openPatientProfile(patient);
        });

        details.appendChild(info);
        details.appendChild(openButton);
        card.appendChild(details);
        list.appendChild(card);
      });
    } catch (error) {
      clear(list);

      list.appendChild(
        create('div', { class: 'card' }, [
          error.message || 'Failed to load patients'
        ])
      );
    }
  }

  let searchTimer;

  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(load, 250);
  });

  await load();
}

// ---------------------------------------------------------
// Patient profile
// ---------------------------------------------------------
async function openPatientProfile(patient) {
  const patientId = getPatientDatabaseId(patient);

  window.APP_STATE.selectedPatientId = patientId;
  window.APP_STATE.selectedPatient = patient;

  const container = el('#content');
  clear(container);

  let currentPatient = patient;

  // Load the latest patient information from the backend.
  try {
    currentPatient = await api(`/patients/${patientId}`);
    window.APP_STATE.selectedPatient = currentPatient;
  } catch (error) {
    // Continue using the patient information already loaded from the list.
    console.warn('Could not refresh patient profile:', error);
  }

  const header = create('div', {
    style: 'display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px;'
  }, []);

  header.appendChild(
    create('h2', {}, [getPatientName(currentPatient)])
  );

  const backButton = create('button', {}, ['← Back to Patients']);

  backButton.addEventListener('click', () => {
    renderPatients();
  });

  header.appendChild(backButton);
  container.appendChild(header);

  const tabs = [
    'Overview',
    'Dental Chart',
    'Medical Records',
    'Treatment Plans',
    'X-Rays',
    'Prescriptions',
    'Billing'
  ];

  const nav = create('div', {
    class: 'tab-bar',
    style: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;'
  }, []);

  const tabContent = create('div', {
    id: 'patient-tab-content'
  }, []);

  tabs.forEach((tabName) => {
    const button = create('button', {
      class: tabName === 'Overview' ?'tab-btn active' : 'tab-btn'
    }, [tabName]);

    button.addEventListener('click', async () => {
      nav.querySelectorAll('button').forEach((tabButton) => {
        tabButton.classList.remove('active');
      });

      button.classList.add('active');
      clear(tabContent);

      if (tabName === 'Overview') {
        await renderPatientOverview(currentPatient);
      } else if (tabName === 'Dental Chart') {
        await renderPatientDentalChart(currentPatient);
      } else if (tabName === 'Medical Records') {
        await renderPatientRecords(currentPatient);
      } else if (tabName === 'Treatment Plans') {
        if (typeof renderPatientTreatmentPlans === 'function') {
          await renderPatientTreatmentPlans(patientId);
        } else {
          tabContent.appendChild(
            create('div', { class: 'card' }, [
              'Treatment Plans are not available yet.'
            ])
          );
        }
      } else if (tabName === 'X-Rays') {
        await renderPatientXRays(patientId);
      } else if (tabName === 'Prescriptions') {
        await renderPatientPrescriptions(currentPatient);
      } else if (tabName === 'Billing') {
        await renderPatientBilling(currentPatient);
      }
    });

    nav.appendChild(button);
  });

  container.appendChild(nav);
  container.appendChild(tabContent);

  await renderPatientOverview(currentPatient);
}

// ---------------------------------------------------------
// Patient overview
// ---------------------------------------------------------
async function renderPatientOverview(patient) {
  const container = clearPatientTabContent();
  if (!container) return;

  const card = create('div', {
    class: 'card'
  }, []);

  card.appendChild(
    create('h3', {
      style: 'margin-bottom:16px;'
    }, ['Patient Information'])
  );

  const initials = getPatientName(patient)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  const topSection = create('div', {
    style: 'display:flex;align-items:center;gap:16px;margin-bottom:22px;flex-wrap:wrap;'
  }, []);

  topSection.appendChild(
    create('div', {
      style: `
        width:72px;
        height:72px;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#0d9488;
        color:white;
        font-size:24px;
        font-weight:700;
      `
    }, [initials || 'P'])
  );

  const identity = create('div', {}, []);

  identity.appendChild(
    create('h2', {
      style: 'margin:0 0 5px 0;'
    }, [getPatientName(patient)])
  );

  identity.appendChild(
    create('div', {}, [
      `Patient ID: ${patientValue(patient.patient_id || patient.id)}`
    ])
  );

  topSection.appendChild(identity);
  card.appendChild(topSection);

  const information = [
    ['Full Name', getPatientName(patient)],
    ['Patient ID', patient.patient_id || patient.id],
    ['Gender', patient.gender],
    ['Date of Birth', patient.date_of_birth],
    ['Age', calculatePatientAge(patient.date_of_birth)],
    ['Phone', patient.phone],
    ['Email', patient.email],
    ['Address', patient.address],
    ['Blood Type', patient.blood_type],
    ['Allergies', patient.allergies],
    ['Emergency Contact', patient.emergency_name],
    ['Emergency Phone', patient.emergency_phone]
  ];

  const grid = create('div', {
    style: `
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
      gap:14px;
    `
  }, []);

  information.forEach(([label, value]) => {
    const field = create('div', {
      style: `
        padding:12px;
        border:1px solid #e2e8f0;
        border-radius:10px;
        background:#fafafa;
      `
    }, []);

    field.appendChild(
      create('div', {
        style: 'font-size:12px;color:#64748b;margin-bottom:5px;font-weight:600;'
      }, [label])
    );

    field.appendChild(
      create('div', {
        style: 'font-size:14px;font-weight:500;word-break:break-word;'
      }, [patientValue(value)])
    );

    grid.appendChild(field);
  });

  card.appendChild(grid);
  container.appendChild(card);

  // Existing X-ray summary
  const summaryCard = create('div', {
    class: 'card'
  }, []);

  summaryCard.appendChild(
    create('h3', {}, ['Clinical Summary'])
  );

  try {
    const xrays = await fetchPatientXRays(getPatientDatabaseId(patient));
    const xrayList = xrays || [];

    summaryCard.appendChild(
      create('div', {}, [`X-rays: ${xrayList.length}`])
    );

    if (xrayList.length > 0) {
      const latest = [...xrayList].sort((a, b) => {
        return (
          new Date(b.taken_date || b.created_at) -
          new Date(a.taken_date || a.created_at)
        );
      })[0];

      summaryCard.appendChild(
        create('div', {}, [
          `Latest X-ray: ${patientValue(latest.type)} on ${
            formatXRayDate(latest.taken_date || latest.created_at)
          }`
        ])
      );
    }
  } catch (error) {
    summaryCard.appendChild(
      create('div', {}, ['X-ray summary unavailable'])
    );
  }

  container.appendChild(summaryCard);
}

// ---------------------------------------------------------
// Dental chart
// ---------------------------------------------------------
async function renderPatientDentalChart(patient) {
  const container = clearPatientTabContent();
  if (!container) return;

  const card = create('div', { class: 'card' }, []);
  card.appendChild(create('h3', {}, ['Dental Chart']));

  const grid = create('div', {
    class: 'tooth-grid',
    id: 'patient-tooth-grid'
  }, []);

  card.appendChild(grid);
  container.appendChild(card);

  try {
    await drawDentalChart(
      getPatientDatabaseId(patient),
      'patient-tooth-grid'
    );
  } catch (error) {
    grid.appendChild(
      create('div', {}, ['Failed to load dental chart'])
    );
  }
}

// ---------------------------------------------------------
// Medical records
// ---------------------------------------------------------
async function renderPatientRecords(patient) {
  const container = clearPatientTabContent();
  if (!container) return;

  const card = create('div', { class: 'card' }, []);
  card.appendChild(create('h3', {}, ['Medical Records']));
  container.appendChild(card);

  try {
    const records = await api(
      `/patients/${getPatientDatabaseId(patient)}/records`
    );

    if (!(records || []).length) {
      card.appendChild(
        create('div', {}, ['No medical records available yet.'])
      );
      return;
    }

    records.forEach((record) => {
      const recordCard = create('div', {
        style: 'padding:12px 0;border-bottom:1px solid #e2e8f0;'
      }, []);

      const recordDate =
        record.created_at ||
        record.date ||
        record.treatment_date;

      recordCard.appendChild(
        create('strong', {}, [
          recordDate ?formatDate(recordDate) : 'Record'
        ])
      );

      if (record.diagnosis) {
        recordCard.appendChild(
          create('div', {}, [`Diagnosis: ${record.diagnosis}`])
        );
      }

      if (record.treatment_done) {
        recordCard.appendChild(
          create('div', {}, [
            `Treatment: ${record.treatment_done}`
          ])
        );
      }

      if (record.notes || record.note) {
        recordCard.appendChild(
          create('div', {}, [
            `Notes: ${record.notes || record.note}`
          ])
        );
      }

      card.appendChild(recordCard);
    });
  } catch (error) {
    card.appendChild(
      create('div', {}, ['Failed to load medical records'])
    );
  }
}

// ---------------------------------------------------------
// Prescriptions
// ---------------------------------------------------------
async function renderPatientPrescriptions(patient) {
  const container = clearPatientTabContent();
  if (!container) return;

  const card = create('div', { class: 'card' }, []);
  card.appendChild(create('h3', {}, ['Prescriptions']));
  container.appendChild(card);

  try {
    const patientId = getPatientDatabaseId(patient);
    const prescriptions = await api(
      `/prescriptions?patient_id=${encodeURIComponent(patientId)}`
    );

    if (!(prescriptions || []).length) {
      card.appendChild(
        create('div', {}, ['No prescriptions available yet.'])
      );
      return;
    }

    prescriptions.forEach((prescription) => {
      const drugName =
        prescription.drug_name ||
        prescription.drug ||
        'Medication';

      card.appendChild(
        create('div', {
          style: 'padding:10px 0;border-bottom:1px solid #e2e8f0;'
        }, [
          `${drugName} — ${prescription.dosage || ''} — ${
            prescription.status || ''
          }`
        ])
      );
    });
  } catch (error) {
    card.appendChild(
      create('div', {}, ['Failed to load prescriptions'])
    );
  }
}

// ---------------------------------------------------------
// Billing
// ---------------------------------------------------------
async function renderPatientBilling(patient) {
  const container = clearPatientTabContent();
  if (!container) return;

  const card = create('div', { class: 'card' }, []);
  card.appendChild(create('h3', {}, ['Billing']));
  container.appendChild(card);

  try {
    const invoices = await api('/invoices');
    const patientId = getPatientDatabaseId(patient);

    const patientInvoices = (invoices || []).filter((invoice) => {
      return String(invoice.patient_id) === String(patientId);
    });

    if (patientInvoices.length === 0) {
      card.appendChild(
        create('div', {}, ['No billing records available yet.'])
      );
      return;
    }

    patientInvoices.forEach((invoice) => {
      card.appendChild(
        create('div', {
          style: 'padding:10px 0;border-bottom:1px solid #e2e8f0;'
        }, [
          `Invoice #${invoice.id} — ${
            invoice.status || 'unknown'
          } — D${Number(invoice.total || invoice.amount || 0).toFixed(2)}`
        ])
      );
    });
  } catch (error) {
    card.appendChild(
      create('div', {}, ['Failed to load billing'])
    );
  }
}

// ---------------------------------------------------------
// X-rays
// ---------------------------------------------------------
async function renderPatientXRays(patientId) {
  const container = clearPatientTabContent();
  if (!container) return;

  const card = create('div', { class: 'card' }, []);
  card.appendChild(create('h3', {}, ['X-Rays']));
  container.appendChild(card);

  try {
    const xrays = await fetchPatientXRays(patientId);

    if (!(xrays || []).length) {
      card.appendChild(
        create('div', {}, ['No X-rays have been uploaded yet.'])
      );
      return;
    }

    xrays.forEach((xray) => {
      const row = create('div', {
        class: 'xray-summary-row',
        style: 'padding:10px 0;border-bottom:1px solid #e2e8f0;'
      }, []);

      row.appendChild(
        create('div', {}, [xray.title || 'Untitled X-Ray'])
      );

      row.appendChild(
        create('div', {}, [xray.type || 'Other'])
      );

      row.appendChild(
        create('div', {}, [
          formatXRayDate(xray.taken_date || xray.created_at)
        ])
      );

      const viewButton = create('button', {}, ['Open']);

      viewButton.addEventListener('click', () => {
        viewXRay(xray.id);
      });

      row.appendChild(viewButton);
      card.appendChild(row);
    });
  } catch (error) {
    card.appendChild(
      create('div', {}, ['Failed to load X-rays'])
    );
  }
}
async function renderPatientSummary(patientId, containerId = 'patient-summary') {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '<div class="spinner">Loading summary...</div>';

  try {
    const [
      appointments,
      treatmentPlans,
      invoices,
      prescriptions,
      xrays
    ] = await Promise.all([
      api('/appointments'),
      api('/treatment-plans'),
      api('/invoices'),
      api('/prescriptions'),
      fetchPatientXRays(patientId)
    ]);

    const patientAppointments = (appointments || [])
      .filter(a => String(a.patient_id) === String(patientId));

    const patientPlans = (treatmentPlans || [])
      .filter(p => String(p.patient_id) === String(patientId));

    const patientInvoices = (invoices || [])
      .filter(i => String(i.patient_id) === String(patientId));

    const patientPrescriptions = (prescriptions || [])
      .filter(p => String(p.patient_id) === String(patientId));

    const outstanding = patientInvoices
      .filter(i => i.status !== 'paid')
      .reduce((sum, i) => sum + Number(i.total || i.amount || 0), 0);

    const lastVisit = patientAppointments
      .filter(a => new Date(a.date) <= new Date())
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    const nextVisit = patientAppointments
      .filter(a => new Date(a.date) > new Date())
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

    container.innerHTML = `
      <div class="summary-grid">

        <div class="summary-card">
          <h4>Last Visit</h4>
          <p>${lastVisit ? formatDate(lastVisit.date) : 'None'}</p>
        </div>

        <div class="summary-card">
          <h4>Next Appointment</h4>
          <p>${nextVisit ? formatDate(nextVisit.date) : 'None'}</p>
        </div>

        <div class="summary-card">
          <h4>Active Plans</h4>
          <p>${patientPlans.length}</p>
        </div>

        <div class="summary-card">
          <h4>Outstanding Balance</h4>
          <p>D${outstanding.toLocaleString()}</p>
        </div>

        <div class="summary-card">
          <h4>Prescriptions</h4>
          <p>${patientPrescriptions.length}</p>
        </div>

        <div class="summary-card">
          <h4>X-Rays</h4>
          <p>${xrays.length}</p>
        </div>

      </div>
    `;

  } catch (err) {
    container.innerHTML =
      '<div class="empty">Unable to load summary.</div>';
  }
}
