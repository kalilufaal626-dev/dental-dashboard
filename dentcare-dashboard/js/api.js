// API helper
async function api(path, options = {}){
  const url = API_BASE + path;
  const opts = { headers: {}, ...options };
  if(opts.body && typeof opts.body === 'object'){
    opts.body = JSON.stringify(opts.body);
    opts.headers['Content-Type'] = 'application/json';
  }
  const token = window.APP_STATE.token || localStorage.getItem('token');
  if(token) opts.headers['Authorization'] = 'Bearer ' + token;

  let res;
  try{
    res = await fetch(url, opts);
  }catch(err){
    console.error('Network error', err);
    throw new Error('Network error. Please check your connection.');
  }

  if(res.status === 401){
    // notify auth layer to logout
    window.dispatchEvent(new CustomEvent('session:expired'));
    throw new Error('Session expired. Please login again.');
  }

  const text = await res.text();
  let data = null;
  try{ data = text ? JSON.parse(text) : null } catch(e){ data = text }

  if(!res.ok){
    const message = (data && data.message) || (typeof data === 'string' ? data : `Request failed: ${res.status}`);
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
