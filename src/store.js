/* Estado global do app: dados da planilha, cache offline e notificação de mudanças.
   Store minimalista feito à mão — não vale a pena uma lib para 3 telas. */

import { fetchEstrategia, fetchLog, writeRanges, isConfigured, SheetsError } from './api/sheets.js';
import { parseTickers, parseLog, buildWriteBlocks } from './models.js';

const CACHE_KEY = 'carteira:cache:v1';

/* Quantas linhas do log guardar no localStorage. O log inteiro pode passar da
   cota de ~5 MB; para uso offline as mais recentes bastam, e o service worker
   ainda guarda a resposta completa da API. */
const LOG_CACHE_ROWS = 2000;

export const state = {
  tickers: [],
  log: [],
  estrategiaTs: null,   // Date.now() da última leitura bem-sucedida
  logTs: null,
  loadingEstrategia: false,
  loadingLog: false,
  errorEstrategia: null,
  errorLog: null,
  // true enquanto o que está na tela veio do cache (e não da rede)
  estrategiaFromCache: false,
  logFromCache: false,
  online: navigator.onLine,
  configured: isConfigured(),
};

/* ------------------------------ Assinaturas ------------------------------- */

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(state);
}

/* -------------------------------- Cache ----------------------------------- */

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeCache(patch) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...readCache(), ...patch }));
  } catch {
    /* quota cheia ou modo privado: cache é opcional, segue o jogo */
  }
}

/** Carrega o que estiver em cache para a tela pintar antes da rede responder. */
export function hydrateFromCache() {
  const cache = readCache();
  if (Array.isArray(cache.estrategiaRows)) {
    state.tickers = parseTickers(cache.estrategiaRows);
    state.estrategiaTs = cache.estrategiaTs || null;
    state.estrategiaFromCache = true;
  }
  if (Array.isArray(cache.logRows)) {
    state.log = parseLog(cache.logRows);
    state.logTs = cache.logTs || null;
    state.logFromCache = true;
  }
  emit();
}

/* ------------------------------- Carregamento ------------------------------ */

/** Dados já carregados da rede e ainda dentro da janela de frescor? */
function isFresh(ts, fromCache, maxAge) {
  return Boolean(ts) && !fromCache && (Date.now() - ts) < maxAge;
}

export async function loadEstrategia({ force = false, maxAge = 0 } = {}) {
  if (state.loadingEstrategia) return;
  if (!force && isFresh(state.estrategiaTs, state.estrategiaFromCache, maxAge)) return;

  state.loadingEstrategia = true;
  state.errorEstrategia = null;
  emit();

  try {
    const rows = await fetchEstrategia();
    state.tickers = parseTickers(rows);
    state.estrategiaTs = Date.now();
    state.estrategiaFromCache = false;
    writeCache({ estrategiaRows: rows, estrategiaTs: state.estrategiaTs });
  } catch (err) {
    state.errorEstrategia = toErrorInfo(err);
    // Mantém os dados antigos na tela; o aviso de erro/offline explica a situação.
    if (state.tickers.length) state.estrategiaFromCache = true;
  } finally {
    state.loadingEstrategia = false;
    emit();
  }
}

export async function loadLog({ force = false, maxAge = 0 } = {}) {
  if (state.loadingLog) return;
  if (!force && isFresh(state.logTs, state.logFromCache, maxAge)) return;

  state.loadingLog = true;
  state.errorLog = null;
  emit();

  try {
    const rows = await fetchLog();
    state.log = parseLog(rows);
    state.logTs = Date.now();
    state.logFromCache = false;
    // rows vem em ordem cronológica crescente: as recentes estão no fim.
    writeCache({ logRows: rows.slice(-LOG_CACHE_ROWS), logTs: state.logTs });
  } catch (err) {
    state.errorLog = toErrorInfo(err);
    if (state.log.length) state.logFromCache = true;
  } finally {
    state.loadingLog = false;
    emit();
  }
}

/** Recarrega tudo que já foi visitado (botão de recarregar / pull-to-refresh). */
export async function refreshAll() {
  const jobs = [loadEstrategia({ force: true })];
  if (state.logTs) jobs.push(loadLog({ force: true }));
  await Promise.all(jobs);
}

/* --------------------------------- Escrita -------------------------------- */

/**
 * Salva os campos editáveis de um ticker e recarrega a planilha para confirmar.
 * Concorrência: last-write-wins, por decisão do projeto.
 */
export async function saveTicker(ticker, draft) {
  if (!state.online) {
    throw new SheetsError('Você está offline', { hint: 'A edição só funciona com internet.' });
  }
  await writeRanges(buildWriteBlocks(ticker, draft));
  await loadEstrategia({ force: true });
}

export function getTicker(ativo) {
  const key = String(ativo || '').toUpperCase();
  return state.tickers.find((t) => t.ativo.toUpperCase() === key) || null;
}

/* --------------------------------- Auxiliares ------------------------------ */

function toErrorInfo(err) {
  if (err instanceof SheetsError) return { message: err.message, hint: err.hint, status: err.status };
  return { message: 'Erro inesperado', hint: String(err?.message || err), status: 0 };
}

window.addEventListener('online', () => { state.online = true; emit(); });
window.addEventListener('offline', () => { state.online = false; emit(); });
