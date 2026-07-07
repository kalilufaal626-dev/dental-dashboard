// Simple modal system
function showModal(contentHtml, title){
  const root = el('#modal-root');
  clear(root);
  const modal = create('div',{class:'modal'},[]);
  const panel = create('div',{class:'panel'},[]);
  if(title) panel.appendChild(create('h3',{},[title]));
  const content = typeof contentHtml === 'string' ? create('div',{html:contentHtml}) : contentHtml;
  panel.appendChild(content);
  const closeBtn = create('button',{class:'secondary'},['Close']);
  closeBtn.addEventListener('click', closeModal);
  panel.appendChild(closeBtn);
  modal.appendChild(panel);
  root.appendChild(modal);
}

function closeModal(){ const root = el('#modal-root'); clear(root) }
