// DentCare Pro — Treatment Plans
// Wired for the active root indext.html application.
// Uses: api(), toast(), role(), esc(), fmtMoney(), statusBadge()

const TPLAN_FALLBACK_KEY = 'treatment_plans_fallback_v1';

function isTreatmentPlanNotFound(error) {
  const message = String(error?.message || error || '').toLowerCase();

  return (
    error?.status === 404 ||
    message.includes('404') ||
    message.includes('not found')
  );
}

function getFallbackPlans() {
  try {
    return JSON.parse(
      localStorage.getItem(TPLAN_FALLBACK_KEY) || '[]'
    );
  } catch {
    return [];
  }
}

function saveFallbackPlans(plans) {
  localStorage.setItem(
    TPLAN_FALLBACK_KEY,
    JSON.stringify(plans)
  );
}

function generateLocalId() {
  return `tp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

async function fetchTreatmentPlans() {
  try {
    return await api('/treatment-plans');
  } catch (error) {
    if (isTreatmentPlanNotFound(error)) {
      return getFallbackPlans();
    }

    throw error;
  }
}

async function fetchPatientTreatmentPlans(patientId) {
  try {
    return await api(
      `/patients/${encodeURIComponent(
        patientId
      )}/treatment-plans`
    );
  } catch (error) {
    if (isTreatmentPlanNotFound(error)) {
      return getFallbackPlans().filter(
        plan =>
          String(plan.patient_id) === String(patientId)
      );
    }

    throw error;
  }
}

async function fetchTreatmentPlan(id) {
  try {
    return await api(
      `/treatment-plans/${encodeURIComponent(id)}`
    );
  } catch (error) {
    if (isTreatmentPlanNotFound(error)) {
      return (
        getFallbackPlans().find(
          plan => String(plan.id) === String(id)
        ) || null
      );
    }

    throw error;
  }
}

async function postTreatmentPlan(payload) {
  try {
    return await api('/treatment-plans', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  } catch (error) {
    if (!isTreatmentPlanNotFound(error)) {
      throw error;
    }

    const plans = getFallbackPlans();

    const record = {
      id: generateLocalId(),
      ...payload,
      created_at: new Date().toISOString()
    };

    plans.unshift(record);
    saveFallbackPlans(plans);

    return record;
  }
}

async function patchTreatmentPlan(id, payload) {
  try {
    return await api(
      `/treatment-plans/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }
    );
  } catch (error) {
    if (!isTreatmentPlanNotFound(error)) {
      throw error;
    }

    const plans = getFallbackPlans();

    const index = plans.findIndex(
      plan => String(plan.id) === String(id)
    );

    if (index < 0) {
      throw new Error('Treatment plan not found');
    }

    plans[index] = {
      ...plans[index],
      ...payload,
      updated_at: new Date().toISOString()
    };

    saveFallbackPlans(plans);

    return plans[index];
  }
}

function ensureTreatmentPlanModal() {
  let overlay = document.getElementById(
    'm-treatment-plan'
  );

  if (!overlay) {
    overlay = document.createElement('div');

    overlay.id = 'm-treatment-plan';
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div
        class="modal"
        id="m-treatment-plan-inner"
      ></div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        closeTreatmentPlanModal();
      }
    });
  }

  return overlay;
}

function closeTreatmentPlanModal() {
  const overlay = document.getElementById(
    'm-treatment-plan'
  );

  if (overlay) {
    overlay.classList.remove('open');
  }
}

function showTreatmentPlanModal(title, bodyHtml) {
  const overlay = ensureTreatmentPlanModal();

  const inner = document.getElementById(
    'm-treatment-plan-inner'
  );

  inner.innerHTML = `
    <div class="modal-header">
      <h2>${esc(title)}</h2>

      <button
        type="button"
        class="modal-close"
        id="tp-modal-close"
      >
        ✕
      </button>
    </div>

    ${bodyHtml}
  `;

  document
    .getElementById('tp-modal-close')
    ?.addEventListener(
      'click',
      closeTreatmentPlanModal
    );

  overlay.classList.add('open');
}

async function renderPatientTreatmentPlans(
  patientId,
  containerId = 'tab-treatment-plans'
) {
  const container =
    document.getElementById(containerId);

  if (!container) {
    toast(
      'Treatment Plans container not found',
      'e'
    );
    return;
  }

  container.innerHTML =
    '<div class="spinner">Loading treatment plans…</div>';

  try {
    const plans =
      await fetchPatientTreatmentPlans(patientId);

    const canEdit =
      ['admin', 'dentist'].includes(role());

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">
            📑 Treatment Plans
          </span>

          ${
            canEdit
              ? `
                <button
                  type="button"
                  class="btn btn-teal btn-sm"
                  id="tp-add-plan"
                >
                  + Add Treatment Plan
                </button>
              `
              : ''
          }
        </div>

        <div
          class="card-body"
          id="tp-patient-plan-list"
        ></div>
      </div>
    `;

    document
      .getElementById('tp-add-plan')
      ?.addEventListener('click', () => {
        openTreatmentPlanModal(patientId);
      });

    const list = document.getElementById(
      'tp-patient-plan-list'
    );

    if (!plans || plans.length === 0) {
      list.innerHTML = `
        <div class="empty">
          <div class="ei">📑</div>

          <h3>No treatment plans</h3>

          <p>
            No treatment plans have been created
            for this patient.
          </p>
        </div>
      `;

      return;
    }

    list.innerHTML = '';

    plans.forEach(plan => {
      const card =
        document.createElement('div');

      card.style.cssText = `
        border:1px solid #e2e8f0;
        border-radius:12px;
        padding:14px;
        margin-bottom:12px;
      `;

      card.innerHTML = `
        <div
          style="
            display:flex;
            justify-content:space-between;
            gap:12px;
            flex-wrap:wrap;
          "
        >
          <div>
            <h3
              style="
                font-size:14px;
                margin-bottom:5px;
              "
            >
              ${
                esc(
                  plan.title ||
                  'Untitled Treatment Plan'
                )
              }
            </h3>

            <div
              style="
                font-size:12px;
                color:var(--text-2);
              "
            >
              Treatments:
              ${(plan.items || []).length}
            </div>

            <div
              style="
                font-size:12px;
                color:var(--text-2);
              "
            >
              Estimated total:
              ${fmtMoney(
                plan.estimated_total || 0
              )}
            </div>
          </div>

          <span
            class="badge ${
              statusBadge(
                plan.status || 'draft'
              )
            }"
          >
            ${
              esc(
                (
                  plan.status || 'draft'
                ).replaceAll('_', ' ')
              )
            }
          </span>
        </div>

        <div
          class="tp-actions"
          style="
            display:flex;
            gap:8px;
            flex-wrap:wrap;
            margin-top:12px;
          "
        ></div>
      `;

      const actions =
        card.querySelector('.tp-actions');

      const viewButton =
        document.createElement('button');

      viewButton.type = 'button';
      viewButton.className =
        'btn btn-outline btn-sm';
      viewButton.textContent = 'View';

      viewButton.addEventListener(
        'click',
        () => {
          viewTreatmentPlan(plan.id);
        }
      );

      actions.appendChild(viewButton);

      if (canEdit) {
        const editButton =
          document.createElement('button');

        editButton.type = 'button';
        editButton.className =
          'btn btn-outline btn-sm';
        editButton.textContent = 'Edit';

        editButton.addEventListener(
          'click',
          () => {
            openTreatmentPlanModal(
              patientId,
              plan
            );
          }
        );

        actions.appendChild(editButton);
      }

      list.appendChild(card);
    });
  } catch (error) {
    console.error(
      'Treatment plan error:',
      error
    );

    container.innerHTML = `
      <div class="empty">
        <div class="ei">⚠️</div>

        <h3>
          Could not load treatment plans
        </h3>

        <p>
          ${
            esc(
              error.message ||
              'Unknown error'
            )
          }
        </p>
      </div>
    `;
  }
}
function openTreatmentPlanModal(
  patientId = null,
  existing = null
) {
  const canEdit =
    ['admin', 'dentist'].includes(role());

  if (!canEdit && !existing) {
    toast(
      'You do not have permission to create treatment plans',
      'e'
    );
    return;
  }

  const plan = existing || {
    patient_id: patientId || '',
    title: '',
    diagnosis: '',
    objectives: '',
    notes: '',
    status: 'draft',
    estimated_total: 0,
    items: []
  };

  const items = (plan.items || []).map(
    item => ({ ...item })
  );

  const toothOptions = Array.from(
    { length: 32 },
    (_, index) => {
      const tooth = index + 1;

      return `
        <option value="${tooth}">
          ${tooth}
        </option>
      `;
    }
  ).join('');

  showTreatmentPlanModal(
    existing
      ? 'Edit Treatment Plan'
      : 'New Treatment Plan',
    `
      <form id="tp-form">
        <div class="fg">
          <label>Patient ID</label>

          <input
            name="patient_id"
            value="${
              esc(
                plan.patient_id ||
                patientId ||
                ''
              )
            }"
            required
          >
        </div>

        <div class="fg">
          <label>Plan Title</label>

          <input
            name="title"
            value="${esc(plan.title || '')}"
            placeholder="Example: Root Canal Treatment Plan"
            required
          >
        </div>

        <div class="fg">
          <label>Diagnosis</label>

          <textarea name="diagnosis">${
            esc(plan.diagnosis || '')
          }</textarea>
        </div>

        <div class="fg">
          <label>Objectives</label>

          <textarea name="objectives">${
            esc(plan.objectives || '')
          }</textarea>
        </div>

        <h3 style="margin:18px 0 10px;">
          Treatments
        </h3>

        <div
          style="
            padding:12px;
            border:1px solid #e2e8f0;
            border-radius:10px;
            margin-bottom:12px;
          "
        >
          <div class="form-row">
            <div class="fg">
              <label>Tooth</label>

              <select id="tp-item-tooth">
                <option value="">
                  General / All Teeth
                </option>

                ${toothOptions}
              </select>
            </div>

            <div class="fg">
              <label>Treatment</label>

              <select id="tp-item-service">
                <option value="">
                  Select treatment
                </option>

                <option value="Consultation">
                  Consultation
                </option>

                <option value="Dental Cleaning">
                  Dental Cleaning
                </option>

                <option value="Dental Filling">
                  Dental Filling
                </option>

                <option value="Tooth Extraction">
                  Tooth Extraction
                </option>

                <option value="Root Canal">
                  Root Canal
                </option>

                <option value="Crown">
                  Crown
                </option>

                <option value="Dental Implant">
                  Dental Implant
                </option>

                <option value="X-Ray">
                  X-Ray
                </option>

                <option value="Other">
                  Other
                </option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="fg">
              <label>Estimated Cost</label>

              <input
                id="tp-item-cost"
                type="number"
                min="0"
                step="0.01"
                value="0"
              >
            </div>

            <div class="fg">
              <label>Priority</label>

              <select id="tp-item-priority">
                <option value="low">
                  Low
                </option>

                <option
                  value="medium"
                  selected
                >
                  Medium
                </option>

                <option value="high">
                  High
                </option>

                <option value="urgent">
                  Urgent
                </option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="fg">
              <label>Status</label>

              <select id="tp-item-status">
                <option value="pending">
                  Pending
                </option>

                <option value="in_progress">
                  In Progress
                </option>

                <option value="completed">
                  Completed
                </option>

                <option value="cancelled">
                  Cancelled
                </option>
              </select>
            </div>

            <div
              style="
                display:flex;
                align-items:end;
                margin-bottom:15px;
              "
            >
              <button
                type="button"
                class="btn btn-teal"
                id="tp-add-item"
              >
                Add Treatment
              </button>
            </div>
          </div>
        </div>

        <div id="tp-items"></div>

        <div
          id="tp-total"
          style="
            text-align:right;
            font-size:16px;
            font-weight:700;
            margin-top:14px;
          "
        >
          Estimated Total: D0.00
        </div>

        <div
          class="fg"
          style="margin-top:16px;"
        >
          <label>Notes</label>

          <textarea name="notes">${
            esc(plan.notes || '')
          }</textarea>
        </div>

        <div
          style="
            display:flex;
            justify-content:flex-end;
            gap:8px;
            margin-top:12px;
          "
        >
          <button
            type="button"
            class="btn btn-outline"
            id="tp-cancel"
          >
            Cancel
          </button>

          <button
            type="submit"
            class="btn btn-teal"
          >
            ${
              existing
                ? 'Save Changes'
                : 'Save Treatment Plan'
            }
          </button>
        </div>
      </form>
    `
  );

  const form =
    document.getElementById('tp-form');

  const itemsContainer =
    document.getElementById('tp-items');

  const totalElement =
    document.getElementById('tp-total');

  function calculateTotal() {
    return items.reduce(
      (total, item) =>
        total +
        Number(item.estimated_cost || 0),
      0
    );
  }

  function renderItems() {
    if (!items.length) {
      itemsContainer.innerHTML = `
        <div
          style="
            padding:14px;
            text-align:center;
            color:#64748b;
          "
        >
          No treatments added yet.
        </div>
      `;
    } else {
      itemsContainer.innerHTML = `
        <div style="overflow-x:auto;">
          <table>
            <thead>
              <tr>
                <th>Tooth</th>
                <th>Treatment</th>
                <th>Cost</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody id="tp-items-body">
            </tbody>
          </table>
        </div>
      `;

      const tbody =
        document.getElementById(
          'tp-items-body'
        );

      items.forEach((item, index) => {
        const row =
          document.createElement('tr');

        row.innerHTML = `
          <td>
            ${
              esc(
                item.tooth_number ||
                'General'
              )
            }
          </td>

          <td>
            ${
              esc(
                item.service ||
                'Treatment'
              )
            }
          </td>

          <td>
            ${
              fmtMoney(
                item.estimated_cost ||
                0
              )
            }
          </td>

          <td>
            ${
              esc(
                item.priority ||
                'medium'
              )
            }
          </td>

          <td>
            ${
              esc(
                (
                  item.status ||
                  'pending'
                ).replaceAll('_', ' ')
              )
            }
          </td>

          <td></td>
        `;

        const removeButton =
          document.createElement('button');

        removeButton.type = 'button';

        removeButton.className =
          'btn btn-outline btn-sm';

        removeButton.textContent =
          'Remove';

        removeButton.addEventListener(
          'click',
          () => {
            items.splice(index, 1);
            renderItems();
          }
        );

        row.lastElementChild
          .appendChild(removeButton);

        tbody.appendChild(row);
      });
    }

    totalElement.textContent =
      `Estimated Total: ${
        fmtMoney(calculateTotal())
      }`;
  }

  document
    .getElementById('tp-cancel')
    ?.addEventListener(
      'click',
      closeTreatmentPlanModal
    );

  document
    .getElementById('tp-add-item')
    ?.addEventListener(
      'click',
      () => {
        const service =
          document.getElementById(
            'tp-item-service'
          ).value;

        if (!service) {
          toast(
            'Select a treatment first',
            'e'
          );
          return;
        }

        items.push({
          tooth_number:
            document.getElementById(
              'tp-item-tooth'
            ).value || null,

          service,

          description: '',

          estimated_cost:
            Number(
              document.getElementById(
                'tp-item-cost'
              ).value || 0
            ),

          priority:
            document.getElementById(
              'tp-item-priority'
            ).value,

          status:
            document.getElementById(
              'tp-item-status'
            ).value
        });

        document.getElementById(
          'tp-item-tooth'
        ).value = '';

        document.getElementById(
          'tp-item-service'
        ).value = '';

        document.getElementById(
          'tp-item-cost'
        ).value = '0';

        document.getElementById(
          'tp-item-priority'
        ).value = 'medium';

        document.getElementById(
          'tp-item-status'
        ).value = 'pending';

        renderItems();
      }
    );
      form.addEventListener(
    'submit',
    async event => {
      event.preventDefault();

      if (!items.length) {
        toast(
          'Add at least one treatment',
          'e'
        );
        return;
      }

      const formData =
        new FormData(form);

      const payload = {
        patient_id:
          formData.get('patient_id'),

        title:
          formData.get('title'),

        diagnosis:
          formData.get('diagnosis'),

        objectives:
          formData.get('objectives'),

        notes:
          formData.get('notes'),

        status:
          existing
            ? existing.status
            : 'draft',

        estimated_total:
          calculateTotal(),

        items
      };

      try {
        if (existing?.id) {
          await patchTreatmentPlan(
            existing.id,
            payload
          );

          toast(
            'Treatment plan updated',
            's'
          );
        } else {
          await postTreatmentPlan(
            payload
          );

          toast(
            'Treatment plan created',
            's'
          );
        }

        closeTreatmentPlanModal();

        await renderPatientTreatmentPlans(
          patientId ||
          payload.patient_id,
          'tab-treatment-plans'
        );
      } catch (error) {
        console.error(
          'Treatment plan save error:',
          error
        );

        toast(
          error.message ||
          'Failed to save treatment plan',
          'e'
        );
      }
    }
  );

  renderItems();
}

async function viewTreatmentPlan(id) {
  try {
    const plan =
      await fetchTreatmentPlan(id);

    if (!plan) {
      toast(
        'Treatment plan not found',
        'e'
      );
      return;
    }

    const items =
      plan.items || [];

    showTreatmentPlanModal(
      'Treatment Plan',
      `
        <div style="margin-bottom:16px;">
          <h3>
            ${
              esc(
                plan.title ||
                'Untitled Treatment Plan'
              )
            }
          </h3>

          <p>
            <strong>Patient:</strong>

            ${
              esc(
                plan.patient_name ||
                plan.patient_id ||
                'Unknown'
              )
            }
          </p>

          <p>
            <strong>Status:</strong>

            ${
              esc(
                (
                  plan.status ||
                  'draft'
                ).replaceAll('_', ' ')
              )
            }
          </p>

          <p>
            <strong>
              Estimated total:
            </strong>

            ${
              fmtMoney(
                plan.estimated_total ||
                0
              )
            }
          </p>
        </div>

        ${
          items.length
            ? `
              <div
                style="overflow-x:auto;"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Tooth</th>
                      <th>Treatment</th>
                      <th>Cost</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    ${
                      items.map(item => `
                        <tr>
                          <td>
                            ${
                              esc(
                                item.tooth_number ||
                                'General'
                              )
                            }
                          </td>

                          <td>
                            ${
                              esc(
                                item.service ||
                                item.description ||
                                'Treatment'
                              )
                            }
                          </td>

                          <td>
                            ${
                              fmtMoney(
                                item.estimated_cost ||
                                0
                              )
                            }
                          </td>

                          <td>
                            ${
                              esc(
                                (
                                  item.status ||
                                  'pending'
                                ).replaceAll(
                                  '_',
                                  ' '
                                )
                              )
                            }
                          </td>
                        </tr>
                      `).join('')
                    }
                  </tbody>
                </table>
              </div>
            `
            : `
              <div class="empty">
                <p>
                  No treatments in this plan.
                </p>
              </div>
            `
        }

        ${
          plan.notes
            ? `
              <div
                style="margin-top:16px;"
              >
                <strong>Notes:</strong>

                <p>
                  ${esc(plan.notes)}
                </p>
              </div>
            `
            : ''
        }
      `
    );
  } catch (error) {
    console.error(error);

    toast(
      error.message ||
      'Failed to load treatment plan',
      'e'
    );
  }
}

// Make these functions available to indext.html.
window.renderPatientTreatmentPlans =
  renderPatientTreatmentPlans;

window.openTreatmentPlanModal =
  openTreatmentPlanModal;

window.viewTreatmentPlan =
  viewTreatmentPlan;

window.closeTreatmentPlanModal =
  closeTreatmentPlanModal;