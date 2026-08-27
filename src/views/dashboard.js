/* Tela 1 — Dashboard: todos os tickers, filtro rápido e pull-to-refresh. */

import { el, clear } from '../components/dom.js';
import { tickerCard } from '../components/tickerCard.js';
import { statusBar } from '../components/statusBar.js';
import { attachPullToRefresh } from '../components/pullToRefresh.js';
import { STALE_MS } from '../config.js';
import { state, subscribe, loadEstrategia } from '../store.js';
import { setupNotice } from './setup.js';

const FILTERS = [
  { id: 'todos', label: 'Todos', test: () => true },
  { id: 'sinais', label: 'Só sinais', test: (t) => t.sinal === 'COMPRA' || t.sinal === 'VENDA' },
  { id: 'aumentar', label: 'Aumentar', test: (t) => t.objetivo === 'Aumentar' },
  { id: 'reduzir', label: 'Reduzir', test: (t) => t.objetivo === 'Reduzir' },
  { id: 'manter', label: 'Manter', test: (t) => t.objetivo === 'Manter' },
];

/** Quão perto está o próximo gatilho (0 = já disparou, null = sem preço). */
function proximityScore(ticker) {
  const candidates = [ticker.distCompra, ticker.distVenda]
    .filter((d) => d !== null && d !== undefined && isFinite(d))
    .map((d) => Math.max(0, d));
  return candidates.length ? Math.min(...candidates) : null;
}

function sortTickers(list) {
  return [...list].sort((a, b) => {
    const aActive = a.sinal !== 'aguardar' ? 0 : 1;
    const bActive = b.sinal !== 'aguardar' ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;

    const aScore = proximityScore(a);
    const bScore = proximityScore(b);
    if (aScore === null && bScore === null) return a.ativo.localeCompare(b.ativo);
    if (aScore === null) return 1;          // sem preço vai para o fim
    if (bScore === null) return -1;
    if (aScore !== bScore) return aScore - bScore;
    return a.ativo.localeCompare(b.ativo);
  });
}

export function dashboardView(_params, outlet) {
  let activeFilter = 'todos';

  const content = el('div', { class: 'view__content' });
  const root = el('div', { class: 'view' }, content);
  outlet.appendChild(root);
  attachPullToRefresh(root, () => loadEstrategia({ force: true }));

  function renderFilters() {
    const counts = Object.fromEntries(
      FILTERS.map((f) => [f.id, state.tickers.filter(f.test).length]));

    return el('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrar tickers' },
      FILTERS.map((f) => el('button', {
        class: `chip ${activeFilter === f.id ? 'is-active' : ''}`,
        type: 'button',
        'aria-pressed': String(activeFilter === f.id),
        onclick: () => { activeFilter = f.id; render(); },
      }, f.label, el('span', { class: 'chip__count' }, String(counts[f.id] ?? 0)))),
    );
  }

  function renderList() {
    const filter = FILTERS.find((f) => f.id === activeFilter) || FILTERS[0];
    const visible = sortTickers(state.tickers.filter(filter.test));

    if (!visible.length) {
      if (state.loadingEstrategia) return el('p', { class: 'empty' }, 'Carregando a planilha…');
      if (state.errorEstrategia) return el('p', { class: 'empty' }, 'Não foi possível carregar os dados.');
      return el('p', { class: 'empty' }, 'Nenhum ticker para este filtro.');
    }
    return el('div', { class: 'cards' }, visible.map(tickerCard));
  }

  function render() {
    clear(content);
    if (!state.configured) { content.appendChild(setupNotice()); return; }

    content.append(
      el('header', { class: 'view__header' },
        el('h1', null, 'Carteira'),
        el('p', { class: 'view__sub' },
          `${state.tickers.length} ${state.tickers.length === 1 ? 'ticker' : 'tickers'}`),
      ),
      statusBar({
        ts: state.estrategiaTs,
        fromCache: state.estrategiaFromCache,
        loading: state.loadingEstrategia,
        error: state.errorEstrategia,
        onRefresh: () => loadEstrategia({ force: true }),
      }),
      renderFilters(),
      renderList(),
    );
  }

  const unsubscribe = subscribe(render);
  render();
  loadEstrategia({ maxAge: STALE_MS });

  return { destroy: unsubscribe };
}
