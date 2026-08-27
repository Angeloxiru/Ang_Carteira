/* Regra de cor das distâncias, compartilhada pelo dashboard e pelo detalhe.
   Positivo = ainda falta o preço andar. Negativo = alvo já ultrapassado. */

import { NEAR_TARGET_PCT } from '../config.js';
import { fmtPct, fmtBRL } from '../utils/format.js';
import { el } from './dom.js';

export function distanceClass(dist) {
  if (dist === null || dist === undefined || !isFinite(dist)) return 'dist--none';
  if (dist <= 0) return 'dist--hit';                          // disparou
  if (dist * 100 <= NEAR_TARGET_PCT) return 'dist--near';     // perto
  return 'dist--far';                                         // longe
}

/** Pílula "Compra 1 · R$ 18,05 · -1,11%". */
export function distancePill(label, alvo, dist) {
  return el('div', { class: `pill ${distanceClass(dist)}` },
    el('span', { class: 'pill__label' }, label),
    el('span', { class: 'pill__value' }, fmtBRL(alvo, 'sem alvo')),
    el('span', { class: 'pill__dist' }, fmtPct(dist)),
  );
}
