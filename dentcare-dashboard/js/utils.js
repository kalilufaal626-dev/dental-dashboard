// Small DOM and utility helpers
function el(sel){return document.querySelector(sel)}
function q(sel){return Array.from(document.querySelectorAll(sel))}
function show(node){ if(node) node.classList.remove('hidden') }
function hide(node){ if(node) node.classList.add('hidden') }
function clear(node){ if(node) node.innerHTML = '' }

function create(tag, attrs={}, children=[]){
  const e = document.createElement(tag);
  for(const k in attrs){ if(k==='class') e.className = attrs[k]; else if(k==='html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]) }
  children.forEach(c => typeof c === 'string' ? e.appendChild(document.createTextNode(c)) : e.appendChild(c));
  return e;
}

function formatDate(d){ if(!d) return ''; const dt = new Date(d); return dt.toLocaleString(); }

function showToast(msg, opts={type:'info',duration:4000}){
  const root = el('#toast-root');
  const t = create('div',{class:'toast'},[msg]);
  root.appendChild(t);
  setTimeout(()=>{ t.remove() }, opts.duration || 3000);
}
