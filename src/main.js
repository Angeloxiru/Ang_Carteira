/* Ponto de entrada: registra rotas, monta a navegação e o service worker. */

import { register, start, navigate, currentPath } from './router.js';
import { el } from './components/dom.js';
import { icon } from './components/icons.js';
import { dashboardView } from './views/dashboard.js';
import { tickerDetailView } from './views/tickerDetail.js';
import { logView } from './views/log.js';
import { statsView } from './views/stats.js';
import { state, hydrateFromCache, refreshAll, subscribe, restoreSession } from './store.js';
import { STALE_MS } from './config.js';
import { initUpdater, applyUpdate, checkForUpdate } from './updater.js';

/* --------------------------------- Rotas ---------------------------------- */

register('/', dashboardView);
register('/ticker/:ativo', tickerDetailView);
register('/log', logView);
register('/stats', statsView);

/* ------------------------------- Navegação -------------------------------- */

const NAV = [
  { path: '/', label: 'Carteira', icon: 'carteira' },
  { path: '/log', label: 'Histórico', icon: 'historico' },
  { path: '/stats', label: 'Estatísticas', icon: 'stats' },
];

function buildNav() {
  const items = NAV.map((item) => el('button', {
    class: 'nav__item',
    type: 'button',
    dataset: { path: item.path },
    onclick: () => navigate(item.path),
  },
    el('span', { class: 'nav__icon' }, icon(item.icon)),
    el('span', { class: 'nav__label' }, item.label),
  ));

  const nav = el('nav', { class: 'nav', 'aria-label': 'Navegação principal' }, items);

  const highlight = () => {
    const path = currentPath();
    for (const btn of items) {
      const target = btn.dataset.path;
      const active = target === '/' ? (path === '/' || path.startsWith('/ticker/')) : path.startsWith(target);
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-current', active ? 'page' : 'false');
    }
  };

  document.addEventListener('route:changed', highlight);
  highlight();
  return nav;
}

/* ---------------------------- Nova versão disponível ------------------------ */

/* Só aparece quando a atualização não pôde ser aplicada sozinha — ou seja,
   quando há edição pendente. Na abertura do app o updater aplica direto. */
function buildUpdateBanner() {
  const banner = el('div', { class: 'updatebar', hidden: true },
    el('span', null, 'Nova versão disponível'),
    el('button', {
      class: 'updatebar__btn', type: 'button', onclick: () => applyUpdate(),
    }, 'Atualizar'),
  );
  return { banner, show: () => { banner.hidden = false; } };
}

/* ------------------------------ Indicador offline -------------------------- */

function buildOfflineBanner() {
  const banner = el('div', { class: 'offlinebar', hidden: true }, 'Sem conexão — modo leitura');
  const sync = () => { banner.hidden = state.online; };
  subscribe(sync);
  sync();
  return banner;
}

/* --------------------------------- Boot ----------------------------------- */

const app = document.getElementById('app');
const outlet = el('main', { class: 'outlet', id: 'outlet' });
const updates = buildUpdateBanner();

app.append(updates.banner, buildOfflineBanner(), outlet, buildNav());

hydrateFromCache();
start(outlet);

// Renova o login em silêncio quando já houve autorização neste navegador.
restoreSession();

// Revalida ao voltar para o app (padrão: dados frescos a cada abertura).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const age = Date.now() - (state.estrategiaTs || 0);
  if (age > STALE_MS) refreshAll();
});

// Ao voltar online, vale reconferir a versão além dos dados.
window.addEventListener('online', () => checkForUpdate({ force: true }));

window.addEventListener('online', () => refreshAll());

/* ------------------- Service worker e checagem de versão ------------------- */

// Registra o service worker e verifica a versão a cada abertura do app.
initUpdater({ onReady: updates.show });
