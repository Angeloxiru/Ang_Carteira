/* Verificação de versão na abertura do app.

   Três mecanismos, porque nenhum sozinho é confiável:

   1. `registration.update()` a cada abertura e a cada volta ao primeiro plano,
      forçando o navegador a reler o sw.js em vez de esperar a heurística dele.
   2. Comparação com `version.json`, buscado sem cache. É o que responde
      "estou na última versão?" mesmo que o service worker esteja travado ou
      nem exista (aba comum, primeira visita).
   3. `controllerchange`: quando um service worker novo assume, a página
      recarrega uma vez para não ficar meio velha e meio nova.

   O deploy carimba o SHA do commit no sw.js, então todo deploy produz um
   service worker diferente em bytes — que é o que dispara a reinstalação.
   Antes isso dependia de alguém lembrar de subir uma constante à mão. */

import { APP_VERSION } from './version.js';

/* Espaçamento mínimo entre checagens NÃO forçadas. Curto de propósito: abrir
   o app é justamente quando a verificação precisa acontecer, e o custo é um
   version.json de 60 bytes mais um GET condicional do sw.js. O intervalo só
   existe para não repetir a checagem se o foco oscilar várias vezes seguidas. */
const CHECK_INTERVAL_MS = 10_000;

let registration = null;
let lastCheck = 0;
let reloading = false;
let onUpdateReady = () => {};

/* A página já é controlada por um service worker?
   Precisa ser variável, não uma foto do carregamento: na primeira visita não há
   controlador nenhum, e o primeiro 'controllerchange' é a instalação inicial —
   esse não recarrega. A partir daí passa a haver controlador, e toda troca
   seguinte é uma atualização de verdade, que recarrega. */
let hasController = Boolean(navigator.serviceWorker?.controller);

/** Quem estiver com trabalho não salvo registra um bloqueio de recarga. */
const reloadBlockers = new Set();

export function registerReloadBlocker(fn) {
  reloadBlockers.add(fn);
  return () => reloadBlockers.delete(fn);
}

function safeToReload() {
  for (const blocker of reloadBlockers) {
    try {
      if (blocker()) return false;
    } catch {
      return false;   // na dúvida, não recarrega por cima do usuário
    }
  }
  return true;
}

function reloadOnce() {
  if (reloading) return;
  reloading = true;
  location.reload();
}

/** Ativa o service worker que está esperando e recarrega quando ele assumir. */
export function applyUpdate() {
  const waiting = registration?.waiting;
  if (!waiting) { reloadOnce(); return; }
  waiting.postMessage({ type: 'skip-waiting' });
  // O reload real acontece no 'controllerchange'.
}

/** Um worker recém-instalado só é "atualização" se já havia um controlando. */
function handleInstalled(worker) {
  if (worker.state !== 'installed' || !navigator.serviceWorker.controller) return;
  if (safeToReload()) applyUpdate();
  else onUpdateReady();     // tem edição pendente: quem decide é o usuário
}

function watch(worker) {
  if (!worker) return;
  handleInstalled(worker);
  worker.addEventListener('statechange', () => handleInstalled(worker));
}

/** Pergunta ao servidor qual é a versão publicada agora. */
async function fetchDeployedVersion() {
  try {
    const res = await fetch(new URL('../version.json', import.meta.url), { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.version || null;
  } catch {
    return null;   // offline, ou rodando local sem version.json
  }
}

/**
 * Verifica se há versão nova. Chamado ao abrir o app e ao voltar para ele.
 * Devolve a versão publicada, quando der para saber.
 */
export async function checkForUpdate({ force = false } = {}) {
  if (!force && Date.now() - lastCheck < CHECK_INTERVAL_MS) return null;
  lastCheck = Date.now();

  // Força o navegador a reler o sw.js agora, sem esperar a heurística dele.
  try { await registration?.update(); } catch { /* offline: tudo bem */ }

  const deployed = await fetchDeployedVersion();
  if (deployed && APP_VERSION !== 'dev' && deployed !== APP_VERSION) {
    // O arquivo do app está velho. Se o worker novo já estiver pronto, aplica;
    // senão o 'updatefound' cuida assim que ele terminar de instalar.
    if (registration?.waiting && safeToReload()) applyUpdate();
    else if (registration?.waiting) onUpdateReady();
  }
  return deployed;
}

/** Liga tudo. `onReady` é chamado quando a atualização precisa do aval do usuário. */
export function initUpdater({ onReady = () => {} } = {}) {
  onUpdateReady = onReady;

  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hasController) { hasController = true; return; }   // instalação inicial
    reloadOnce();
  });

  window.addEventListener('load', async () => {
    try {
      // updateViaCache 'none': o próprio sw.js nunca vem do cache HTTP.
      registration = await navigator.serviceWorker.register(
        new URL('../sw.js', import.meta.url), { updateViaCache: 'none' });
    } catch (err) {
      console.warn('Service worker não registrado:', err);
      return;
    }

    // Já havia um worker esperando de um deploy anterior? Aplica na abertura.
    if (registration.waiting && navigator.serviceWorker.controller && safeToReload()) {
      applyUpdate();
      return;
    }

    watch(registration.installing);
    registration.addEventListener('updatefound', () => watch(registration.installing));

    checkForUpdate({ force: true });
  });

  // Voltar para o app conta como "abrir": verifica de verdade, sem throttle.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate({ force: true });
  });

  // pageshow cobre o caso de a página vir do bfcache, em que visibilitychange
  // não dispara — comum ao alternar apps no celular.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) checkForUpdate({ force: true });
  });
}
