/* Tela 3 — Histórico de sinais (aba Log), somente leitura. */

import { el, clear } from '../components/dom.js';
import { logSignalBadge } from '../components/signalBadge.js';
import { distanceClass } from '../components/distance.js';
import { statusBar } from '../components/statusBar.js';
import { attachPullToRefresh } from '../components/pullToRefresh.js';
import { fmtBRL, fmtPct, fmtDateTime, nowSerial } from '../utils/format.js';
import { LOG_PAGE_SIZE, STALE_MS } from '../config.js';
import { state, subscribe, loadLog } from '../store.js';
import { setupNotice } from './setup.js';

const PERIODS = [
  { id: 'hoje', label: 'Hoje', days: 0 },
  { id: '7', label: '7 dias', days: 7 },
  { id: '30', label: '30 dias', days: 30 },
  { id: '90', label: '90 dias', days: 90 },
  { id: 'tudo', label: 'Tudo', days: null },
];

/** Corte em "serial" do Sheets para o período escolhido (null = sem corte). */
export function periodCutoff(periodId, now = nowSerial()) {
  const period = PERIODS.find((p) => p.id === periodId);
  if (!period || period.days === null) return null;
  if (period.days === 0) return Math.floor(now);      // meia-noite de hoje (São Paulo)
  return now - period.days;
}

export function filterEvents(events, { period, ticker, tipo }) {
  const cutoff = periodCutoff(period);
  return events.filter((e) => {
    if (cutoff !== null && (e.serial === null || e.serial < cutoff)) return false;
    if (ticker !== 'todos' && e.ticker !== ticker) return false;
    if (tipo !== 'todos' && e.tipo !== tipo) return false;
    return true;
  });
}

export function logView(_params, outlet) {
  const filters = { period: '7', ticker: 'todos', tipo: 'todos' };
  let page = 1;

  const content = el('div', { class: 'view__content' });
  const root = el('div', { class: 'view' }, content);
  outlet.appendChild(root);
  attachPullToRefresh(root, () => loadLog({ force: true }));

  function setFilter(patch) {
    Object.assign(filters, patch);
    page = 1;
    render();
  }

  function renderControls(tickers) {
    return el('div', { class: 'filters' },
      el('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrar por período' },
        PERIODS.map((p) => el('button', {
          class: `chip ${filters.period === p.id ? 'is-active' : ''}`,
          type: 'button',
          'aria-pressed': String(filters.period === p.id),
          onclick: () => setFilter({ period: p.id }),
        }, p.label)),
      ),
      el('div', { class: 'filters__row' },
        el('label', { class: 'field field--inline' },
          el('span', { class: 'field__label' }, 'Ticker'),
          el('select', {
            class: 'input',
            onchange: (e) => setFilter({ ticker: e.target.value }),
          },
            el('option', { value: 'todos', selected: filters.ticker === 'todos' }, 'Todos'),
            tickers.map((t) => el('option', { value: t, selected: filters.ticker === t }, t)),
          ),
        ),
        el('label', { class: 'field field--inline' },
          el('span', { class: 'field__label' }, 'Tipo'),
          el('select', {
            class: 'input',
            onchange: (e) => setFilter({ tipo: e.target.value }),
          },
            ['todos', 'COMPRA', 'VENDA'].map((v) => el('option',
              { value: v, selected: filters.tipo === v }, v === 'todos' ? 'Todos' : v)),
          ),
        ),
      ),
    );
  }

  function eventRow(e) {
    const alvoTexto = e.alvo
      ? `${e.alvo}${e.precoAlvo !== null ? ` em ${fmtBRL(e.precoAlvo)}` : ''}`
      : '—';

    return el('article', { class: `logrow ${e.mudou ? 'logrow--change' : ''}` },
      el('div', { class: 'logrow__top' },
        el('time', { class: 'logrow__time' }, fmtDateTime(e.data)),
        el('span', { class: 'logrow__ticker' }, e.ticker),
        logSignalBadge(e),
        e.mudou ? el('span', { class: 'logrow__flash', title: e.mudouTexto }, '⚡') : null,
      ),
      el('div', { class: 'logrow__body' },
        el('span', { class: 'logrow__alvo' }, alvoTexto),
        el('span', { class: `logrow__dist ${distanceClass(e.dist)}` }, fmtPct(e.dist)),
      ),
      el('div', { class: 'logrow__foot' },
        el('span', null, `Preço ${fmtBRL(e.preco)}`),
        e.objetivo ? el('span', { class: 'tag tag--sm' }, e.objetivo) : null,
        e.horizonte ? el('span', { class: 'tag tag--sm' }, e.horizonte) : null,
      ),
    );
  }

  function render() {
    clear(content);
    if (!state.configured) { content.appendChild(setupNotice()); return; }

    const tickers = [...new Set(state.log.map((e) => e.ticker))].sort();
    const visible = filterEvents(state.log, filters);
    const shown = visible.slice(0, page * LOG_PAGE_SIZE);
    const uniqueTickers = new Set(visible.map((e) => e.ticker)).size;

    content.append(
      el('header', { class: 'view__header' },
        el('h1', null, 'Histórico'),
        el('p', { class: 'view__sub' },
          `Mostrando ${visible.length} ${visible.length === 1 ? 'evento' : 'eventos'}, ${uniqueTickers} ${uniqueTickers === 1 ? 'ticker único' : 'tickers únicos'}`),
      ),
      statusBar({
        ts: state.logTs,
        fromCache: state.logFromCache,
        loading: state.loadingLog,
        error: state.errorLog,
        onRefresh: () => loadLog({ force: true }),
      }),
      renderControls(tickers),
    );

    if (!shown.length) {
      content.appendChild(el('p', { class: 'empty' }, state.loadingLog
        ? 'Carregando o log…'
        : 'Nenhum evento no período selecionado.'));
      return;
    }

    content.appendChild(el('div', { class: 'logrows' }, shown.map(eventRow)));

    if (shown.length < visible.length) {
      content.appendChild(el('button', {
        class: 'btn btn--ghost btn--block',
        type: 'button',
        onclick: () => { page += 1; render(); },
      }, `Carregar mais (${visible.length - shown.length} restantes)`));
    }
  }

  const unsubscribe = subscribe(render);
  render();
  loadLog({ maxAge: STALE_MS });

  return { destroy: unsubscribe };
}
