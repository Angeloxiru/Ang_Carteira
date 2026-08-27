/* Card de um ticker no dashboard. */

import { el } from './dom.js';
import { signalBadge } from './signalBadge.js';
import { distancePill } from './distance.js';
import { fmtBRL, fmtPct } from '../utils/format.js';
import { resultadoPosicao } from '../models.js';
import { navigate } from '../router.js';

export function tickerCard(ticker) {
  const resultado = resultadoPosicao(ticker.preco, ticker.pm);

  const open = () => navigate(`/ticker/${encodeURIComponent(ticker.ativo)}`);

  return el('article', {
    class: 'card',
    role: 'link',
    tabindex: '0',
    onclick: open,
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } },
  },
    el('div', { class: 'card__top' },
      el('div', { class: 'card__id' },
        el('h2', { class: 'card__ticker' }, ticker.ativo),
        el('p', { class: 'card__setor' }, ticker.setor || '—'),
      ),
      signalBadge(ticker.sinal),
    ),

    el('div', { class: 'card__price' },
      ticker.precoIndisponivel
        ? el('span', { class: 'card__noprice' }, 'sem preço')
        : el('span', { class: 'card__priceValue' }, fmtBRL(ticker.preco)),
      resultado !== null && el('span', {
        class: `card__result ${resultado >= 0 ? 'is-up' : 'is-down'}`,
      }, `${fmtPct(resultado)} vs PM`),
    ),

    el('div', { class: 'card__pills' },
      distancePill('Compra 1', ticker.compras[0], ticker.distCompra),
      distancePill('Venda 1', ticker.vendas[0], ticker.distVenda),
    ),

    el('div', { class: 'card__meta' },
      el('span', { class: 'tag' }, ticker.objetivo || '—'),
      el('span', { class: 'tag' }, ticker.horizonte || '—'),
    ),
  );
}
