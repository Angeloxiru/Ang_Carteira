/* Service worker.
   - Arquivos do app: cache-first (com revalidação em segundo plano).
   - GET da Sheets API: network-first com fallback para o cache (modo offline).
   - POST da Sheets API (gravação): nunca cacheia, sempre rede.
   Ao mudar arquivos do app, suba o CACHE_VERSION para invalidar o cache antigo. */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `carteira-shell-${CACHE_VERSION}`;
const DATA_CACHE = `carteira-data-${CACHE_VERSION}`;
const SHEETS_HOST = 'sheets.googleapis.com';

/* Caminhos relativos ao sw.js, que fica na raiz do app. */
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './styles/app.css',
  './src/main.js',
  './src/config.js',
  './src/router.js',
  './src/store.js',
  './src/models.js',
  './src/api/sheets.js',
  './src/utils/format.js',
  './src/components/dom.js',
  './src/components/icons.js',
  './src/components/toast.js',
  './src/components/signalBadge.js',
  './src/components/distance.js',
  './src/components/tickerCard.js',
  './src/components/statusBar.js',
  './src/components/pullToRefresh.js',
  './src/views/dashboard.js',
  './src/views/tickerDetail.js',
  './src/views/log.js',
  './src/views/stats.js',
  './src/views/setup.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // addAll falha inteiro se um arquivo faltar; adiciona um a um para ser tolerante.
    await Promise.all(SHELL_ASSETS.map((asset) =>
      cache.add(new Request(asset, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith('carteira-') && k !== SHELL_CACHE && k !== DATA_CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/** Dados da planilha: rede primeiro, cache como rede reserva. */
async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

/** App shell: cache primeiro, atualizando em segundo plano. */
async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request, { ignoreSearch: false });
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  if (cached) return cached;
  const response = await network;
  if (response) return response;
  throw new Error('Recurso indisponível offline');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.hostname === SHEETS_HOST) {
    // Gravações (batchUpdate / PUT) sempre vão direto para a rede.
    if (request.method !== 'GET') return;
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Navegação (abrir o app, F5): devolve o index.html cacheado quando offline.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('./index.html'))
          || (await cache.match('./'))
          || Response.error();
      }
    })());
    return;
  }

  event.respondWith(cacheFirst(request));
});
