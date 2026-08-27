/* Roteador por hash. Hash (e não History API) porque o GitHub Pages não
   consegue reescrever URLs para o index.html em rotas profundas. */

const routes = [];
let outlet = null;
let current = null;      // { destroy?, beforeLeave? } devolvido pela view ativa
let navigating = false;

/** register('/ticker/:ativo', render) — render(params, outlet) */
export function register(pattern, render) {
  const keys = [];
  const regex = new RegExp('^' + pattern
    .replace(/\/:([^/]+)/g, (_, key) => { keys.push(key); return '/([^/]+)'; })
    .replace(/\/$/, '') + '/?$');
  routes.push({ regex, keys, render });
}

export function navigate(path, { replace = false } = {}) {
  const target = '#' + path;
  if (location.hash === target) return;
  if (replace) history.replaceState(null, '', target);
  else location.hash = target;
}

export function currentPath() {
  return (location.hash || '#/').slice(1) || '/';
}

function match(path) {
  const clean = path.split('?')[0];
  for (const route of routes) {
    const m = clean.match(route.regex);
    if (!m) continue;
    const params = {};
    route.keys.forEach((key, i) => { params[key] = decodeURIComponent(m[i + 1]); });
    return { route, params };
  }
  return null;
}

async function handle() {
  if (navigating) return;
  const path = currentPath();

  // A view ativa pode barrar a saída (ex.: alterações não salvas).
  if (current?.beforeLeave) {
    const ok = await current.beforeLeave();
    if (!ok) {
      navigating = true;
      history.replaceState(null, '', '#' + current.path);
      navigating = false;
      return;
    }
  }

  current?.destroy?.();
  current = null;
  outlet.innerHTML = '';
  window.scrollTo(0, 0);

  const found = match(path);
  if (!found) { navigate('/', { replace: true }); return; }

  const result = (await found.route.render(found.params, outlet)) || {};
  current = { ...result, path };
  document.dispatchEvent(new CustomEvent('route:changed', { detail: { path } }));
}

export function start(outletEl) {
  outlet = outletEl;
  window.addEventListener('hashchange', handle);
  if (!location.hash) history.replaceState(null, '', '#/');
  handle();
}
