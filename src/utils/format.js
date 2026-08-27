/* Formatação de números, datas e conversão de "serial date" do Sheets.
   Regra do projeto: tudo em America/Sao_Paulo. */

import { TIMEZONE } from '../config.js';

/* -------------------------------------------------------------------------
   Datas seriais do Google Sheets
   -------------------------------------------------------------------------
   Com valueRenderOption=UNFORMATTED_VALUE, uma célula de data volta como
   número: dias desde 1899-12-30, já no fuso da planilha (hora de parede).
   Tratamos o serial como UTC e lemos com getUTC*, assim o valor exibido é
   exatamente o que está na planilha, independente do fuso do celular.
   ------------------------------------------------------------------------- */

const SHEET_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86400000;

/** Serial do Sheets -> Date "de parede" (usar sempre com getUTC*). */
export function serialToDate(serial) {
  if (typeof serial !== 'number' || !isFinite(serial)) return null;
  // Arredonda para o minuto: seriais carregam ruído de ponto flutuante.
  const ms = SHEET_EPOCH_MS + Math.round(serial * DAY_MS / 60000) * 60000;
  return new Date(ms);
}

/** Date "de parede" -> serial do Sheets. */
export function dateToSerial(date) {
  return (date.getTime() - SHEET_EPOCH_MS) / DAY_MS;
}

/** Agora, como Date "de parede" em America/Sao_Paulo. */
export function nowInTz() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const p = {};
  for (const { type, value } of parts) p[type] = value;
  // 'en-CA' devolve hour 24 para meia-noite em alguns motores.
  const hour = p.hour === '24' ? '00' : p.hour;
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +hour, +p.minute, +p.second));
}

/** Serial correspondente a "agora" em America/Sao_Paulo. */
export function nowSerial() {
  return dateToSerial(nowInTz());
}

/* ----------------------------- Datas: exibição ---------------------------- */

const pad = (n) => String(n).padStart(2, '0');

/** Date "de parede" -> "dd/mm/yyyy". */
export function fmtDate(d) {
  if (!d) return '—';
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** Date "de parede" -> "dd/mm/yyyy HH:mm". */
export function fmtDateTime(d) {
  if (!d) return '—';
  return `${fmtDate(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "dd/mm/yyyy" de hoje em America/Sao_Paulo (usado ao gravar a coluna S). */
export function todayBr() {
  return fmtDate(nowInTz());
}

/**
 * Lê a coluna "Atualizado em", que pode voltar como serial (célula de data)
 * ou como texto "dd/mm/yyyy" (se alguém digitou como texto).
 */
export function parseSheetDate(value) {
  if (typeof value === 'number') return serialToDate(value);
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!m) return null;
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return new Date(Date.UTC(year, +m[2] - 1, +m[1]));
  }
  return null;
}

/** "há X minutos" a partir de um timestamp real (Date.now()). */
export function timeAgo(ts) {
  if (!ts) return 'nunca';
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 45) return 'agora mesmo';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.round(hours / 24)}d`;
}

/* --------------------------------- Números -------------------------------- */

/**
 * Converte um valor cru da API em número.
 * Devolve null para vazio, erro de fórmula ("#N/A", "#REF!") ou texto solto.
 */
export function toNumber(value) {
  if (typeof value === 'number') return isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s || s.startsWith('#')) return null;
  // Aceita "R$ 1.234,56" e "1234.56".
  const cleaned = s.replace(/[R$\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(cleaned);
  return isFinite(n) ? n : null;
}

/** Número -> "R$ 1.234,56". Devolve fallback se não houver número. */
export function fmtBRL(n, fallback = '—') {
  if (n === null || n === undefined || !isFinite(n)) return fallback;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Número puro com N casas, no padrão pt-BR. */
export function fmtNum(n, digits = 2, fallback = '—') {
  if (n === null || n === undefined || !isFinite(n)) return fallback;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Fração (0.0512) -> "+5,12%". */
export function fmtPct(fraction, fallback = '—', digits = 2) {
  if (fraction === null || fraction === undefined || !isFinite(fraction)) return fallback;
  const pct = fraction * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${fmtNum(pct, digits)}%`;
}
