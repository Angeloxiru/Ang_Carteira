/* Tradução entre as linhas cruas da planilha e os objetos usados pelas telas. */

import { toNumber, parseSheetDate, todayBr } from './utils/format.js';
import { ESTRATEGIA_SHEET } from './config.js';

/* Índices das colunas A..S da aba Estrategia. */
const COL = {
  ATIVO: 0, SETOR: 1, OBJETIVO: 2, HORIZONTE: 3, QTD: 4, PM: 5, PRECO: 6,
  COMPRA1: 7, COMPRA2: 8, COMPRA3: 9, VENDA1: 10, VENDA2: 11, VENDA3: 12,
  DIST_COMPRA: 13, DIST_VENDA: 14, SINAL: 15, TESE: 16, NOTICIA: 17, ATUALIZADO: 18,
};

export const OBJETIVOS = ['Aumentar', 'Reduzir', 'Manter'];
export const HORIZONTES = ['LP', 'Swing', 'LP+Swing'];

/** Normaliza a coluna Sinal para 'COMPRA' | 'VENDA' | 'aguardar'. */
function normalizeSinal(raw, preco, compra1, venda1) {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === 'COMPRA' || s === 'VENDA') return s;
  if (s === 'AGUARDAR') return 'aguardar';
  // Fórmula com erro ou célula vazia: recalcula localmente como fallback.
  if (preco === null) return 'aguardar';
  if (compra1 !== null && preco <= compra1) return 'COMPRA';
  if (venda1 !== null && preco >= venda1) return 'VENDA';
  return 'aguardar';
}

/** Distância até um alvo de compra: (preço - alvo) / preço. Positivo = falta cair. */
export function distToCompra(preco, alvo) {
  if (preco === null || alvo === null || preco === 0) return null;
  return (preco - alvo) / preco;
}

/** Distância até um alvo de venda: (alvo - preço) / preço. Positivo = falta subir. */
export function distToVenda(preco, alvo) {
  if (preco === null || alvo === null || preco === 0) return null;
  return (alvo - preco) / preco;
}

/** Resultado da posição: (preço - PM) / PM. */
export function resultadoPosicao(preco, pm) {
  if (preco === null || pm === null || pm === 0) return null;
  return (preco - pm) / pm;
}

/** Linha crua da Estrategia -> objeto de ticker. */
export function parseTicker({ row, cells }) {
  const get = (i) => cells[i];
  const preco = toNumber(get(COL.PRECO));
  const compras = [
    toNumber(get(COL.COMPRA1)), toNumber(get(COL.COMPRA2)), toNumber(get(COL.COMPRA3)),
  ];
  const vendas = [
    toNumber(get(COL.VENDA1)), toNumber(get(COL.VENDA2)), toNumber(get(COL.VENDA3)),
  ];

  const distCompraSheet = toNumber(get(COL.DIST_COMPRA));
  const distVendaSheet = toNumber(get(COL.DIST_VENDA));

  return {
    row,
    ativo: String(get(COL.ATIVO) ?? '').trim(),
    setor: String(get(COL.SETOR) ?? '').trim(),
    objetivo: String(get(COL.OBJETIVO) ?? '').trim(),
    horizonte: String(get(COL.HORIZONTE) ?? '').trim(),
    qtd: toNumber(get(COL.QTD)),
    pm: toNumber(get(COL.PM)),
    preco,                                   // null quando o GOOGLEFINANCE falha
    precoIndisponivel: preco === null,
    compras,
    vendas,
    distCompra: distCompraSheet ?? distToCompra(preco, compras[0]),
    distVenda: distVendaSheet ?? distToVenda(preco, vendas[0]),
    sinal: normalizeSinal(get(COL.SINAL), preco, compras[0], vendas[0]),
    tese: String(get(COL.TESE) ?? ''),
    noticia: String(get(COL.NOTICIA) ?? ''),
    atualizadoEm: parseSheetDate(get(COL.ATUALIZADO)),
  };
}

/** Linhas cruas -> lista de tickers (ignora linhas sem ticker na coluna A). */
export function parseTickers(rows) {
  return rows.map(parseTicker).filter((t) => t.ativo);
}

/* --------------------------------- Edição --------------------------------- */

/** Cópia editável dos campos que o app pode gravar. */
export function toDraft(ticker) {
  return {
    objetivo: ticker.objetivo,
    horizonte: ticker.horizonte,
    compras: [...ticker.compras],
    vendas: [...ticker.vendas],
    tese: ticker.tese,
    noticia: ticker.noticia,
  };
}

/** Houve alteração real entre o ticker salvo e o rascunho? */
export function draftIsDirty(ticker, draft) {
  const base = toDraft(ticker);
  return JSON.stringify(base) !== JSON.stringify(draft);
}

/** Evita que um texto do usuário vire fórmula ao gravar com USER_ENTERED. */
function safeText(text) {
  const s = String(text ?? '');
  return /^[=+]/.test(s) ? `'${s}` : s;
}

/** Célula numérica: null/NaN viram '' (limpa a célula, ex.: Compra 3 vazia). */
function numCell(n) {
  return (n === null || n === undefined || !isFinite(n)) ? '' : n;
}

/**
 * Monta os blocos do batchUpdate para um ticker.
 * Três faixas contíguas: C:D (classificação), H:M (alvos), Q:S (textos + data).
 * A coluna S ("Atualizado em") recebe sempre a data de hoje em São Paulo.
 */
export function buildWriteBlocks(ticker, draft) {
  const r = ticker.row;
  const sheet = ESTRATEGIA_SHEET;
  return [
    {
      range: `${sheet}!C${r}:D${r}`,
      values: [[draft.objetivo || '', draft.horizonte || '']],
    },
    {
      range: `${sheet}!H${r}:M${r}`,
      values: [[...draft.compras.map(numCell), ...draft.vendas.map(numCell)]],
    },
    {
      range: `${sheet}!Q${r}:S${r}`,
      values: [[safeText(draft.tese), safeText(draft.noticia), todayBr()]],
    },
  ];
}

/* ----------------------------------- Log ---------------------------------- */

const LOG_COL = {
  DATA: 0, TICKER: 1, SINAL: 2, PRECO: 3, ALVO: 4, PRECO_ALVO: 5,
  DIST: 6, MUDOU: 7, OBJETIVO: 8, HORIZONTE: 9,
};

/** Linha crua da aba Log -> evento. */
export function parseLogRow(cells) {
  const rawSinal = String(cells[LOG_COL.SINAL] ?? '').trim();
  const upper = rawSinal.toUpperCase();
  const saiu = upper.startsWith('SAIU');
  const tipo = upper.includes('COMPRA') ? 'COMPRA' : upper.includes('VENDA') ? 'VENDA' : '';
  const mudou = /^sim/i.test(String(cells[LOG_COL.MUDOU] ?? '').trim());

  return {
    serial: typeof cells[LOG_COL.DATA] === 'number' ? cells[LOG_COL.DATA] : null,
    data: parseSheetDate(cells[LOG_COL.DATA]),
    ticker: String(cells[LOG_COL.TICKER] ?? '').trim(),
    sinalRaw: rawSinal,
    tipo,                 // 'COMPRA' | 'VENDA' | ''
    saiu,                 // true para "saiu de COMPRA/VENDA"
    preco: toNumber(cells[LOG_COL.PRECO]),
    alvo: String(cells[LOG_COL.ALVO] ?? '').trim(),
    precoAlvo: toNumber(cells[LOG_COL.PRECO_ALVO]),
    dist: toNumber(cells[LOG_COL.DIST]),
    mudou,
    mudouTexto: String(cells[LOG_COL.MUDOU] ?? '').trim(),
    objetivo: String(cells[LOG_COL.OBJETIVO] ?? '').trim(),
    horizonte: String(cells[LOG_COL.HORIZONTE] ?? '').trim(),
  };
}

/** Linhas cruas -> eventos, mais recentes primeiro. */
export function parseLog(rows) {
  const events = rows.map(parseLogRow).filter((e) => e.ticker && e.data);
  events.sort((a, b) => (b.serial ?? 0) - (a.serial ?? 0));
  return events;
}
