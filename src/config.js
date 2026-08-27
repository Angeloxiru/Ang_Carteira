/* =========================================================================
   CONFIGURAÇÃO — edite apenas este arquivo para apontar o app para a sua
   planilha. Nada aqui é secreto (o app é público, por decisão do dono).
   ========================================================================= */

/**
 * ID da planilha do Google Sheets.
 * Está na URL: https://docs.google.com/spreadsheets/d/<ESTE_PEDACO>/edit
 */
export const SPREADSHEET_ID = '1h_QRbk94w9FLo4zplaIoMhE_bp7_1AFk14TNGK3HjbE';

/**
 * API Key do Google Cloud Console (Sheets API habilitada).
 * Deixe vazio para o app abrir a tela de configuração explicando o passo a passo.
 * Veja o README.md, seção "Gerando a API Key".
 */
export const API_KEY = '';

/* --------------------------- Layout da planilha --------------------------- */

/** Aba de estratégia. Cabeçalho vai até a linha 4; os dados começam na 5. */
export const ESTRATEGIA_SHEET = 'Estrategia';
export const ESTRATEGIA_FIRST_ROW = 5;
/** Quantas linhas de ticker ler (18 hoje, folga até 30). */
export const ESTRATEGIA_MAX_ROWS = 30;

/** Aba de log. Linha 1 = cabeçalho, linha 2 = texto explicativo, dados na 3. */
export const LOG_SHEET = 'Log';
export const LOG_FIRST_ROW = 3;
/** Teto de linhas lidas do log por vez (o filtro de período corta o resto). */
export const LOG_MAX_ROWS = 10000;

/* ------------------------------- Comportamento ---------------------------- */

/** Fuso usado para TODAS as datas exibidas e gravadas. */
export const TIMEZONE = 'America/Sao_Paulo';

/** De quanto em quanto tempo o Apps Script roda (usado só nas estatísticas). */
export const EXEC_INTERVAL_MIN = 30;

/** Quantos eventos do log renderizar por página. */
export const LOG_PAGE_SIZE = 50;

/**
 * Limiar (em %) abaixo do qual a distância até um alvo é considerada "perto"
 * e pintada de amarelo no dashboard.
 */
export const NEAR_TARGET_PCT = 3;

/**
 * Por quanto tempo os dados já carregados são considerados frescos.
 * Trocar de aba dentro dessa janela não gera nova chamada à API; passar dela
 * (ou voltar para o app) dispara revalidação. O botão ↻ e o pull-to-refresh
 * ignoram essa janela e sempre releem.
 */
export const STALE_MS = 60_000;
