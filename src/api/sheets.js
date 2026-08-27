/* Wrapper fino da Google Sheets API v4 usando API Key (sem OAuth, sem backend).
   Só existem 3 operações: ler Estrategia, ler Log, gravar campos editáveis. */

import {
  SPREADSHEET_ID, API_KEY,
  ESTRATEGIA_SHEET, ESTRATEGIA_FIRST_ROW, ESTRATEGIA_MAX_ROWS,
  LOG_SHEET, LOG_FIRST_ROW, LOG_MAX_ROWS,
} from '../config.js';

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export class SheetsError extends Error {
  constructor(message, { status = 0, hint = '' } = {}) {
    super(message);
    this.name = 'SheetsError';
    this.status = status;
    this.hint = hint;
  }
}

export function isConfigured() {
  return Boolean(SPREADSHEET_ID && API_KEY);
}

function assertConfigured() {
  if (!isConfigured()) {
    throw new SheetsError('App não configurado', {
      hint: 'Preencha SPREADSHEET_ID e API_KEY em src/config.js (veja o README).',
    });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mensagem amigável por status HTTP. */
function describe(status, apiMessage) {
  switch (status) {
    case 400:
      return ['Requisição inválida', apiMessage || 'Confira o nome das abas em src/config.js.'];
    case 403:
      return ['Acesso negado (403)', apiMessage ||
        'A API Key pode estar restrita a outro domínio, a Sheets API pode estar desabilitada, ' +
        'ou a planilha não está compartilhada como "qualquer pessoa com o link".'];
    case 404:
      return ['Planilha não encontrada (404)', 'Confira o SPREADSHEET_ID em src/config.js.'];
    case 429:
      return ['Limite de requisições atingido (429)', 'Aguarde alguns segundos e tente de novo.'];
    default:
      return status >= 500
        ? ['Google Sheets fora do ar', `Erro ${status}. Tente novamente em instantes.`]
        : [`Erro ${status}`, apiMessage || ''];
  }
}

/**
 * fetch + JSON com retry exponencial em 429 e 5xx (e falha de rede).
 * 4xx que não seja 429 falha na hora — repetir não vai adiantar.
 */
async function request(url, options = {}, { retries = 3 } = {}) {
  let attempt = 0;
  for (;;) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (networkErr) {
      if (attempt >= retries) {
        throw new SheetsError('Sem conexão com o Google Sheets', {
          hint: navigator.onLine ? String(networkErr.message || networkErr) : 'Você está offline.',
        });
      }
      await sleep(2 ** attempt * 1000);
      attempt++;
      continue;
    }

    if (res.ok) return res.json();

    let apiMessage = '';
    try {
      const body = await res.json();
      apiMessage = body?.error?.message || '';
    } catch { /* corpo não-JSON, segue com a mensagem genérica */ }

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < retries) {
      await sleep(2 ** attempt * 1000);
      attempt++;
      continue;
    }
    const [message, hint] = describe(res.status, apiMessage);
    throw new SheetsError(message, { status: res.status, hint });
  }
}

function valuesUrl(range, params = {}) {
  const qs = new URLSearchParams({ key: API_KEY, ...params });
  return `${BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?${qs}`;
}

/** Linhas cruas da aba Estrategia (A5:S<max>), já com o número da linha real. */
export async function fetchEstrategia() {
  assertConfigured();
  const lastRow = ESTRATEGIA_FIRST_ROW + ESTRATEGIA_MAX_ROWS - 1;
  const range = `${ESTRATEGIA_SHEET}!A${ESTRATEGIA_FIRST_ROW}:S${lastRow}`;
  const data = await request(valuesUrl(range, { valueRenderOption: 'UNFORMATTED_VALUE' }));
  return (data.values || []).map((cells, i) => ({ row: ESTRATEGIA_FIRST_ROW + i, cells }));
}

/**
 * Última linha da aba Log, via metadados (resposta minúscula).
 * `rowCount` é o tamanho da grade, não o número de linhas preenchidas — serve
 * como limite superior, e o passo seguinte lida com a sobra vazia.
 * Se a chamada falhar, cai no teto configurado.
 */
async function fetchLogLastRow() {
  const qs = new URLSearchParams({
    key: API_KEY,
    fields: 'sheets(properties(title,gridProperties(rowCount)))',
  });
  try {
    const meta = await request(`${BASE}/${SPREADSHEET_ID}?${qs}`, {}, { retries: 1 });
    const sheet = (meta.sheets || []).find((s) => s.properties?.title === LOG_SHEET);
    const rowCount = sheet?.properties?.gridProperties?.rowCount;
    if (rowCount) return rowCount;
  } catch {
    /* segue com o fallback abaixo */
  }
  return LOG_FIRST_ROW + LOG_MAX_ROWS - 1;
}

/**
 * Linhas cruas da aba Log, do fim para o começo.
 * O log só cresce por append, então os eventos recentes ficam nas últimas
 * linhas — ler do topo traria histórico velho depois de alguns meses.
 * Lê uma janela final de LOG_MAX_ROWS linhas; se a grade tiver muita linha
 * vazia sobrando no fim, amplia a janela para trás até juntar dados ou chegar
 * ao início da aba.
 */
export async function fetchLog() {
  assertConfigured();
  const lastRow = await fetchLogLastRow();

  let windowSize = LOG_MAX_ROWS;
  for (let attempt = 0; attempt < 3; attempt++) {
    const start = Math.max(LOG_FIRST_ROW, lastRow - windowSize + 1);
    const range = `${LOG_SHEET}!A${start}:J${lastRow}`;
    const data = await request(valuesUrl(range, { valueRenderOption: 'UNFORMATTED_VALUE' }));
    const rows = (data.values || []).filter((r) => r.length && r[0] !== '' && r[0] !== undefined);

    // Sobrar um pouco de grade vazia no fim é normal e não muda nada.
    // Só vale reler se a janela caiu quase toda em linhas vazias.
    if (rows.length >= windowSize / 2 || start === LOG_FIRST_ROW) return rows;

    windowSize *= 2;   // a janela pegou grade vazia: busca mais para trás
  }
  return [];
}

/**
 * Grava os campos editáveis de um ticker em uma única chamada.
 * `blocks` é um array de { range, values } já montado por models.js.
 * Estratégia de concorrência: last-write-wins, sem merge (decisão do projeto).
 */
export async function writeRanges(blocks) {
  assertConfigured();
  const qs = new URLSearchParams({ key: API_KEY });
  return request(`${BASE}/${SPREADSHEET_ID}/values:batchUpdate?${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: blocks }),
  }, { retries: 2 });
}
