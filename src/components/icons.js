/* Ícones da navegação. SVG inline para não depender de fonte nem de rede. */

import { svg } from './dom.js';

const PATHS = {
  carteira: ['M5 20v-7', 'M12 20V5', 'M19 20v-10', 'M3 20h18'],
  historico: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7.5V12l3 2'],
  stats: ['M12 3v9h9', 'M21 12a9 9 0 1 1-9-9'],
};

export function icon(name) {
  return svg('svg', {
    viewBox: '0 0 24 24',
    width: '22',
    height: '22',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  }, (PATHS[name] || []).map((d) => svg('path', { d })));
}
