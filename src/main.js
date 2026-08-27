/* Ponto de entrada: registra rotas, monta a navegação e o service worker. */

import { register, start, navigate, currentPath } from './router.js';
import { el } from './components/dom.js';
import { icon } from './components/icons.js';
import { dashboardView } from './views/dashboard.js';
import { tickerDetailView } from './views/tickerDetail.js';
import { logView } from './views/log.js';
import { statsView } from './views/stats.js';
import { state, hydrateFromCache, refreshAll, subscribe } from './store.js';
import { STALE_MS } from './config.js';

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

app.append(buildOfflineBanner(), outlet, buildNav());

hydrateFromCache();
start(outlet);

// Revalida ao voltar para o app (padrão: dados frescos a cada abertura).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const age = Date.now() - (state.estrategiaTs || 0);
  if (age > STALE_MS) refreshAll();
});

window.addEventListener('online', () => refreshAll());

/* ---------------------------- Service worker ------------------------------ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Caminho relativo: funciona tanto em user.github.io/repo/ quanto na raiz.
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url))
      .catch((err) => console.warn('Service worker não registrado:', err));
  });
}
