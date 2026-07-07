// Global app state (allowed global)
window.APP_STATE = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  page: null,
  selectedPatientId: null
};
