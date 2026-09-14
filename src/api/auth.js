/* Login com a conta Google, só para gravar na planilha.
   A leitura continua pública (API Key) — ninguém precisa entrar para consultar.

   Usa o fluxo de token do Google Identity Services (GIS): o navegador pede um
   access token, sem backend e sem client secret. O token vive em memória e
   expira em ~1h; renovações silenciosas acontecem quando o Google já tem sessão
   ativa e a permissão já foi concedida antes. */

import { GOOGLE_CLIENT_ID } from '../config.js';

/** Permissão mínima para ler e escrever planilhas do usuário. */
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

/** Só marca que o usuário já autorizou uma vez — o token NUNCA é persistido. */
const GRANTED_KEY = 'carteira:oauth-granted';

/** Margem de segurança para não usar um token prestes a expirar. */
const EXPIRY_MARGIN_MS = 60_000;

export class AuthError extends Error {
  constructor(message, { hint = '' } = {}) {
    super(message);
    this.name = 'AuthError';
    this.hint = hint;
  }
}

let tokenClient = null;
let accessToken = null;
let expiresAt = 0;
let pending = null;

export function isAuthConfigured() {
  return Boolean(GOOGLE_CLIENT_ID);
}

export function hasValidToken() {
  return Boolean(accessToken) && Date.now() < expiresAt - EXPIRY_MARGIN_MS;
}

/** O usuário já concedeu a permissão alguma vez neste navegador? */
export function hasGrantedBefore() {
  try {
    return localStorage.getItem(GRANTED_KEY) === '1';
  } catch {
    return false;
  }
}

function setGranted(granted) {
  try {
    if (granted) localStorage.setItem(GRANTED_KEY, '1');
    else localStorage.removeItem(GRANTED_KEY);
  } catch {
    /* modo privado: só perde a renovação silenciosa */
  }
}

function ensureClient() {
  if (tokenClient) return tokenClient;

  if (!isAuthConfigured()) {
    throw new AuthError('Login não configurado', {
      hint: 'Preencha GOOGLE_CLIENT_ID em src/config.js (veja o README).',
    });
  }
  if (!window.google?.accounts?.oauth2) {
    throw new AuthError('O login do Google não carregou', {
      hint: 'Verifique a conexão e recarregue o app.',
    });
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPE,
    callback: () => {},        // trocado a cada pedido, em requestToken()
  });
  return tokenClient;
}

function describeOAuthError(error) {
  switch (error) {
    case 'popup_closed':
    case 'popup_closed_by_user':
      return ['Login cancelado', 'A janela do Google foi fechada antes de concluir.'];
    case 'popup_failed_to_open':
      return ['O navegador bloqueou a janela de login', 'Libere pop-ups para este site e tente de novo.'];
    case 'access_denied':
      return ['Permissão negada', 'Sem a permissão de planilhas o app não consegue salvar.'];
    case 'interaction_required':
    case 'consent_required':
    case 'login_required':
      return ['Sessão expirada', 'Entre de novo para continuar salvando.'];
    default:
      return ['Não foi possível entrar', String(error || '')];
  }
}

/**
 * Devolve um access token válido.
 * `silent: true` nunca abre janela — serve para renovar sem incomodar; falha se
 * o Google precisar de interação. O modo interativo abre pop-up e por isso só
 * pode ser chamado de dentro de um clique do usuário.
 */
export function requestToken({ silent = false } = {}) {
  if (hasValidToken()) return Promise.resolve(accessToken);
  if (pending) return pending;

  let client;
  try {
    client = ensureClient();
  } catch (err) {
    return Promise.reject(err);
  }

  pending = new Promise((resolve, reject) => {
    const fail = (error) => {
      pending = null;
      const [message, hint] = describeOAuthError(error);
      reject(new AuthError(message, { hint }));
    };

    client.callback = (response) => {
      if (response.error) { fail(response.error); return; }
      pending = null;
      accessToken = response.access_token;
      expiresAt = Date.now() + (Number(response.expires_in) || 3600) * 1000;
      setGranted(true);
      resolve(accessToken);
    };
    // Disparado quando a própria janela não abre (bloqueio de pop-up, etc.).
    client.error_callback = (err) => fail(err?.type || err?.message);

    client.requestAccessToken({ prompt: silent ? 'none' : '' });
  });

  return pending;
}

/** Tenta renovar sem interface. Nunca lança: é um "se der, deu". */
export async function requestTokenSilently() {
  if (!isAuthConfigured() || !hasGrantedBefore()) return null;
  try {
    return await requestToken({ silent: true });
  } catch {
    return null;
  }
}

/** Esquece o token atual (usado quando a API responde 401). */
export function forgetToken() {
  accessToken = null;
  expiresAt = 0;
}

/** Sai de verdade: revoga o token no Google e esquece a concessão. */
export function signOut() {
  const token = accessToken;
  forgetToken();
  setGranted(false);
  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token, () => {});
  }
}
