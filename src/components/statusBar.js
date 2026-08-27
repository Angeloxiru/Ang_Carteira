/* Faixa com "atualizado há X min", aviso de offline/cache e botão de recarregar. */

import { el } from './dom.js';
import { timeAgo } from '../utils/format.js';
import { state } from '../store.js';

export function statusBar({ ts, loading, error, fromCache = false, onRefresh }) {
  const bar = el('div', { class: 'statusbar' });

  const label = el('span', { class: 'statusbar__label' },
    loading ? 'Atualizando…' : `Atualizado ${timeAgo(ts)}`);

  bar.append(label, el('button', {
    class: 'statusbar__refresh',
    type: 'button',
    'aria-label': 'Recarregar dados da planilha',
    disabled: loading,
    onclick: onRefresh,
  }, '↻ Recarregar'));

  const notices = el('div', { class: 'notices' });
  if (!state.online) {
    notices.append(el('div', { class: 'notice notice--warn' },
      'Modo offline — mostrando os últimos dados salvos. Edição desabilitada.'));
  } else if (error) {
    notices.append(el('div', { class: 'notice notice--error' },
      el('strong', null, error.message),
      error.hint ? el('span', null, ` ${error.hint}`) : null));
  } else if (fromCache && ts) {
    notices.append(el('div', { class: 'notice notice--info' },
      'Mostrando dados do cache.'));
  }

  return el('div', { class: 'statusbar-wrap' }, bar, notices.children.length ? notices : null);
}
