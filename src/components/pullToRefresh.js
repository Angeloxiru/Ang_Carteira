/* Pull-to-refresh para a lista principal. Só dispara quando a página já está
   no topo, para não brigar com o scroll normal. */

const THRESHOLD = 70;
const MAX_PULL = 120;

export function attachPullToRefresh(container, onRefresh) {
  const indicator = document.createElement('div');
  indicator.className = 'ptr';
  indicator.textContent = 'Puxe para atualizar';
  container.prepend(indicator);

  let startY = 0;
  let pulling = false;
  let distance = 0;
  let busy = false;

  const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

  const reset = () => {
    pulling = false;
    distance = 0;
    indicator.style.height = '';
    indicator.classList.remove('is-armed', 'is-busy');
    indicator.textContent = 'Puxe para atualizar';
  };

  container.addEventListener('touchstart', (e) => {
    if (busy || !atTop() || e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    distance = e.touches[0].clientY - startY;
    if (distance <= 0) { reset(); return; }
    distance = Math.min(distance * 0.5, MAX_PULL);
    indicator.style.height = `${distance}px`;
    indicator.classList.toggle('is-armed', distance >= THRESHOLD);
    indicator.textContent = distance >= THRESHOLD ? 'Solte para atualizar' : 'Puxe para atualizar';
  }, { passive: true });

  const finish = async () => {
    if (!pulling) return;
    const armed = distance >= THRESHOLD;
    if (!armed) { reset(); return; }
    busy = true;
    pulling = false;
    indicator.classList.add('is-busy');
    indicator.textContent = 'Atualizando…';
    indicator.style.height = `${THRESHOLD}px`;
    try { await onRefresh(); } finally { busy = false; reset(); }
  };

  container.addEventListener('touchend', finish, { passive: true });
  container.addEventListener('touchcancel', reset, { passive: true });
}
