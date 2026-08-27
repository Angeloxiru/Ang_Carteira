/* Badge do sinal: COMPRA (verde), VENDA (vermelho), aguardar (neutro). */

import { el } from './dom.js';

const MODIFIER = { COMPRA: 'buy', VENDA: 'sell' };

export function signalBadge(sinal, { large = false } = {}) {
  const key = String(sinal || 'aguardar').toUpperCase();
  const mod = MODIFIER[key] || 'wait';
  const classes = ['badge', `badge--${mod}`, large ? 'badge--lg' : ''].filter(Boolean).join(' ');
  return el('span', { class: classes }, sinal || 'aguardar');
}

/** Badge menor usado no log, que também tem "saiu de COMPRA/VENDA". */
export function logSignalBadge(event) {
  const mod = event.saiu ? 'exit' : (MODIFIER[event.tipo] || 'wait');
  return el('span', { class: `badge badge--${mod} badge--sm` }, event.sinalRaw || '—');
}
