/* Faixa de login. Consultar é público; entrar só libera o Salvar. */

import { el } from './dom.js';
import { toast } from './toast.js';
import { state, signIn, signOutUser } from '../store.js';

export function authBar() {
  if (!state.online) return null;

  if (!state.authConfigured) {
    return el('div', { class: 'authbar authbar--off' },
      el('span', { class: 'authbar__text' },
        'Edição indisponível: falta configurar o login (GOOGLE_CLIENT_ID).'));
  }

  if (state.authorized) {
    return el('div', { class: 'authbar' },
      el('span', { class: 'authbar__text' },
        el('span', { class: 'authbar__dot' }), 'Edição liberada'),
      el('button', {
        class: 'authbar__btn', type: 'button', onclick: () => signOutUser(),
      }, 'Sair'),
    );
  }

  return el('div', { class: 'authbar' },
    el('span', { class: 'authbar__text' }, 'Entre para salvar'),
    el('button', {
      class: 'authbar__btn authbar__btn--primary',
      type: 'button',
      onclick: async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          await signIn();
        } catch (err) {
          toast(`${err.message}${err.hint ? ` — ${err.hint}` : ''}`, { type: 'error', timeout: 6000 });
        } finally {
          btn.disabled = false;
        }
      },
    }, 'Entrar com Google'),
  );
}
