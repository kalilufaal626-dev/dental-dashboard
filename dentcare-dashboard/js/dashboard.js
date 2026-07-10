// Dashboard rendering
window.addEventListener('navigate', async (e) => {
  if (e.detail.page !== 'dashboard') return;
  await renderDashboard();
});

async function renderDashboard() {
  const container = el('#content');
  clear(container);

  const user = window.APP_STATE.user || {};
  const wrap = create('div', {}, []);
  wrap.appendChild(create('h2', {}, [PAGE_TITLES['dashboard'] || 'Dashboard']));

  // Admin-only stats
  if (user.role === 'admin') {
    try {
      const stats = await api('/stats');
      wrap.appendChild(create('div', { class: 'card' }, [
        create('h3', {}, ['Admin Stats']),
        create('pre', {}, [JSON.stringify(stats, null, 2)])
      ]));
    } catch (err) {
      wrap.appendChild(create('div', { class: 'card' }, ['Could not load admin stats']));
    }
  }

  // Safe dashboard for all staff roles
  const apptsCard = create('div', { class: 'card' }, [
    create('h3', {}, [`Today's Appointments`])
  ]);

  try {
    const today = new Date().toISOString().slice(0, 10);
    const data = await api(`/appointments?date=${today}`);

    if (!data || data.length === 0) {
      apptsCard.appendChild(create('div', {}, ['No appointments today']));
    } else {
      const list = create('div', {}, []);
      data.slice(0, 10).forEach(a => {
        list.appendChild(create('div', {}, [
          `${a.time || ''} — ${a.patient_name || a.patient_id || 'Patient'} — ${a.treatment || ''} — ${a.status || ''}`
        ]));
      });
      apptsCard.appendChild(list);
    }
  } catch (err) {
    apptsCard.appendChild(create('div', {}, ['No appointments available']));
  }

  wrap.appendChild(apptsCard);
  container.appendChild(wrap);
}