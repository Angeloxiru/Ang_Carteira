/* Tela extra — Estatísticas dos últimos 30 dias, derivadas da aba Log.
   As "horas" são uma estimativa: cada linha do log representa uma execução
   do Apps Script, que roda a cada EXEC_INTERVAL_MIN minutos. */

import { el, clear } from '../components/dom.js';
import { statusBar } from '../components/statusBar.js';
import { fmtNum, fmtPct } from '../utils/format.js';
import { EXEC_INTERVAL_MIN, STALE_MS } from '../config.js';
import { state, subscribe, loadLog } from '../store.js';
import { periodCutoff } from './log.js';
import { setupNotice } from './setup.js';

export function computeStats(events, cutoff) {
  const byTicker = new Map();

  for (const e of events) {
    if (cutoff !== null && (e.serial === null || e.serial < cutoff)) continue;
    if (e.saiu || !e.tipo) continue;      // "saiu de COMPRA" não é tempo em sinal

    if (!byTicker.has(e.ticker)) {
      byTicker.set(e.ticker, {
        ticker: e.ticker, compras: 0, vendas: 0, mudancas: 0, distSum: 0, distCount: 0,
      });
    }
    const s = byTicker.get(e.ticker);
    if (e.tipo === 'COMPRA') s.compras++; else s.vendas++;
    if (e.mudou) s.mudancas++;
    if (e.dist !== null) { s.distSum += e.dist; s.distCount++; }
  }

  const factor = EXEC_INTERVAL_MIN / 60;
  return [...byTicker.values()]
    .map((s) => ({
      ...s,
      horasCompra: s.compras * factor,
      horasVenda: s.vendas * factor,
      distMedia: s.distCount ? s.distSum / s.distCount : null,
    }))
    .sort((a, b) => (b.horasCompra + b.horasVenda) - (a.horasCompra + a.horasVenda));
}

export function statsView(_params, outlet) {
  const content = el('div', { class: 'view__content' });
  outlet.appendChild(el('div', { class: 'view' }, content));

  function row(s) {
    return el('article', { class: 'statrow' },
      el('div', { class: 'statrow__head' },
        el('span', { class: 'statrow__ticker' }, s.ticker),
        s.mudancas
          ? el('span', { class: 'tag tag--sm' }, `${s.mudancas} ⚡`)
          : null,
      ),
      el('div', { class: 'grid grid--3' },
        el('div', { class: 'stat' },
          el('span', { class: 'stat__label' }, 'Horas em COMPRA'),
          el('span', { class: 'stat__value is-up' }, `${fmtNum(s.horasCompra, 1)}h`)),
        el('div', { class: 'stat' },
          el('span', { class: 'stat__label' }, 'Horas em VENDA'),
          el('span', { class: 'stat__value is-down' }, `${fmtNum(s.horasVenda, 1)}h`)),
        el('div', { class: 'stat' },
          el('span', { class: 'stat__label' }, 'Dist. média'),
          el('span', { class: 'stat__value' }, fmtPct(s.distMedia))),
      ),
    );
  }

  function render() {
    clear(content);
    if (!state.configured) { content.appendChild(setupNotice()); return; }

    const stats = computeStats(state.log, periodCutoff('30'));

    content.append(
      el('header', { class: 'view__header' },
        el('h1', null, 'Estatísticas'),
        el('p', { class: 'view__sub' }, 'Últimos 30 dias'),
      ),
      statusBar({
        ts: state.logTs,
        fromCache: state.logFromCache,
        loading: state.loadingLog,
        error: state.errorLog,
        onRefresh: () => loadLog({ force: true }),
      }),
    );

    if (!stats.length) {
      content.appendChild(el('p', { class: 'empty' },
        state.loadingLog ? 'Carregando o log…' : 'Nenhum sinal registrado nos últimos 30 dias.'));
      return;
    }

    content.append(
      el('div', { class: 'statrows' }, stats.map(row)),
      el('p', { class: 'block__hint' },
        `Horas estimadas: cada registro do log equivale a ${EXEC_INTERVAL_MIN} minutos em sinal. ` +
        'A distância média considera o momento em que cada alvo foi registrado.'),
    );
  }

  const unsubscribe = subscribe(render);
  render();
  loadLog({ maxAge: STALE_MS });

  return { destroy: unsubscribe };
}
