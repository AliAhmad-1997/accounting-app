'use strict';

// Small DOM + IPC helpers shared by every screen. Kept dependency-free so the
// renderer stays a plain, fast, context-isolated page.
(function () {
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k in node && k !== 'list') node[k] = v;
        else node.setAttribute(k, v);
      }
    }
    for (const c of [].concat(children || [])) {
      if (c == null || c === false) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  // Invoke a repository action across the IPC bridge, unwrapping { ok, data }.
  async function call(entity, action, ...args) {
    const res = await window.api.call(entity, action, ...args);
    if (!res || !res.ok) throw new Error((res && res.error && res.error.message) || 'خطأ غير متوقع');
    return res.data;
  }

  let toastWrap = null;
  function toast(message, type) {
    if (!toastWrap) {
      toastWrap = el('div', { class: 'toast-wrap' });
      document.body.appendChild(toastWrap);
    }
    const t = el('div', { class: `toast ${type || ''}`, text: message });
    toastWrap.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 250);
    }, 2600);
  }

  const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = () => new Date().toISOString().slice(0, 10);
  const confirmMsg = (m) => window.confirm(m);

  window.UI = { el, clear, call, toast, money, today, confirm: confirmMsg };
})();

