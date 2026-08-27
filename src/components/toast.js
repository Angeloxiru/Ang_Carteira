/* Toast simples: "Salvo", "Erro ao salvar (...)". */

import { el } from './dom.js';

let host = null;

function getHost() {
  if (!host) {
    host = el('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(host);
  }
  return host;
}

export function toast(message, { type = 'info', timeout = 3200 } = {}) {
  const node = el('div', { class: `toast toast--${type}` }, message);
  getHost().appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  setTimeout(() => {
    node.classList.remove('is-visible');
    setTimeout(() => node.remove(), 250);
  }, timeout);
}
