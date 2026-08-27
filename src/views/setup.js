/* Mostrado quando src/config.js ainda não tem SPREADSHEET_ID + API_KEY. */

import { el } from '../components/dom.js';
import { SPREADSHEET_ID, API_KEY } from '../config.js';

export function setupNotice() {
  const missing = [];
  if (!SPREADSHEET_ID) missing.push('SPREADSHEET_ID');
  if (!API_KEY) missing.push('API_KEY');

  return el('section', { class: 'setup' },
    el('h1', null, 'Falta configurar'),
    el('p', null, `Preencha ${missing.join(' e ')} em `, el('code', null, 'src/config.js'), '.'),
    el('ol', { class: 'setup__steps' },
      el('li', null, 'No Google Cloud Console, crie um projeto e ative a Google Sheets API.'),
      el('li', null, 'Gere uma API Key e restrinja por referrer HTTP (o domínio do GitHub Pages) e por API (só Sheets).'),
      el('li', null, 'Compartilhe a planilha como "qualquer pessoa com o link pode editar".'),
      el('li', null, 'Cole a chave em ', el('code', null, 'src/config.js'), ' e publique.'),
    ),
    el('p', { class: 'setup__hint' }, 'O passo a passo completo está no README do repositório.'),
  );
}
