/* Tela 2 — Detalhe do ticker: todos os 19 campos, com edição dos que a
   planilha permite (Objetivo, Horizonte, alvos, Tese, Notícia). */

import { el, clear } from '../components/dom.js';
import { signalBadge } from '../components/signalBadge.js';
import { distanceClass } from '../components/distance.js';
import { toast } from '../components/toast.js';
import { fmtBRL, fmtNum, fmtPct, fmtDate, toNumber } from '../utils/format.js';
import {
  OBJETIVOS, HORIZONTES, toDraft, draftIsDirty,
  distToCompra, distToVenda, resultadoPosicao,
} from '../models.js';
import { STALE_MS } from '../config.js';
import { state, subscribe, getTicker, loadEstrategia, saveTicker } from '../store.js';
import { navigate } from '../router.js';

export function tickerDetailView(params, outlet) {
  const ativo = params.ativo;

  let ticker = null;          // último dado salvo, vindo da planilha
  let draft = null;           // rascunho editável
  let invalid = new Set();    // campos numéricos com texto inválido
  let saving = false;

  const content = el('div', { class: 'view__content view__content--form' });
  const root = el('div', { class: 'view' }, content);
  outlet.appendChild(root);

  const isDirty = () => Boolean(ticker && draft && draftIsDirty(ticker, draft));

  /* ------------------------------- Blocos -------------------------------- */

  function header() {
    return el('header', { class: 'detail__header' },
      el('button', {
        class: 'detail__back', type: 'button', 'aria-label': 'Voltar',
        onclick: () => navigate('/'),
      }, '‹'),
      el('div', { class: 'detail__title' },
        el('h1', null, ticker.ativo),
        el('p', { class: 'detail__setor' }, ticker.setor || '—'),
      ),
      signalBadge(ticker.sinal, { large: true }),
    );
  }

  function posicao() {
    const resultado = resultadoPosicao(ticker.preco, ticker.pm);
    return el('section', { class: 'block' },
      el('h2', { class: 'block__title' }, 'Posição'),
      el('div', { class: 'grid grid--2' },
        stat('Qtd', fmtNum(ticker.qtd, 0)),
        stat('Preço médio', fmtBRL(ticker.pm)),
        stat('Preço atual', ticker.precoIndisponivel ? 'sem preço' : fmtBRL(ticker.preco)),
        stat('Resultado', fmtPct(resultado), resultado === null ? '' : (resultado >= 0 ? 'is-up' : 'is-down')),
      ),
      ticker.precoIndisponivel
        ? el('p', { class: 'notice notice--info' },
            'O GOOGLEFINANCE não retornou preço para este ativo. Distâncias e resultado ficam indisponíveis.')
        : null,
    );
  }

  function stat(label, value, mod = '') {
    return el('div', { class: 'stat' },
      el('span', { class: 'stat__label' }, label),
      el('span', { class: `stat__value ${mod}` }, value),
    );
  }

  /** Campo numérico de alvo, com a distância recalculada a cada tecla. */
  function targetField(kind, index) {
    const key = kind === 'compra' ? 'compras' : 'vendas';
    const id = `${key}-${index}`;
    const value = draft[key][index];

    const distEl = el('span', { class: 'target__dist' });
    const update = () => {
      const alvo = draft[key][index];
      const dist = kind === 'compra'
        ? distToCompra(ticker.preco, alvo)
        : distToVenda(ticker.preco, alvo);
      distEl.textContent = fmtPct(dist);
      distEl.className = `target__dist ${distanceClass(dist)}`;
    };

    const input = el('input', {
      class: 'input input--num',
      id,
      type: 'text',
      inputmode: 'decimal',
      autocomplete: 'off',
      placeholder: index === 2 ? 'opcional' : '0,00',
      value: value === null ? '' : fmtNum(value, 2),
      disabled: !state.online,
      oninput: (e) => {
        const raw = e.target.value.trim();
        if (raw === '') {
          draft[key][index] = null;
          invalid.delete(id);
        } else {
          const n = toNumber(raw);
          if (n === null || n < 0) invalid.add(id);
          else { invalid.delete(id); draft[key][index] = n; }
        }
        e.target.classList.toggle('is-invalid', invalid.has(id));
        update();
        refreshFooter();
      },
    });

    update();
    return el('div', { class: 'target' },
      el('label', { class: 'target__label', for: id },
        `${kind === 'compra' ? 'Compra' : 'Venda'} ${index + 1}`),
      input,
      distEl,
    );
  }

  function alvos() {
    return el('section', { class: 'block' },
      el('h2', { class: 'block__title' }, 'Alvos'),
      el('p', { class: 'block__hint' },
        'Distância positiva = o preço ainda precisa andar. Negativa = alvo já atingido.'),
      el('div', { class: 'targets' },
        [0, 1, 2].map((i) => targetField('compra', i)),
        el('div', { class: 'targets__sep' }),
        [0, 1, 2].map((i) => targetField('venda', i)),
      ),
    );
  }

  function selectField(label, key, options) {
    const id = `field-${key}`;
    const current = draft[key];
    return el('div', { class: 'field' },
      el('label', { class: 'field__label', for: id }, label),
      el('select', {
        class: 'input', id, disabled: !state.online,
        onchange: (e) => { draft[key] = e.target.value; refreshFooter(); },
      },
        // Preserva um valor fora do enum, se a planilha tiver algo diferente.
        !options.includes(current) && current
          ? el('option', { value: current, selected: true }, current)
          : null,
        options.map((opt) => el('option',
          { value: opt, selected: opt === current }, opt)),
      ),
    );
  }

  function classificacao() {
    return el('section', { class: 'block' },
      el('h2', { class: 'block__title' }, 'Classificação'),
      el('div', { class: 'grid grid--2' },
        selectField('Objetivo', 'objetivo', OBJETIVOS),
        selectField('Horizonte', 'horizonte', HORIZONTES),
      ),
    );
  }

  function textBlock(title, key, placeholder) {
    return el('section', { class: 'block' },
      el('h2', { class: 'block__title' }, title),
      el('textarea', {
        class: 'input input--text',
        rows: '5',
        placeholder,
        value: draft[key],
        disabled: !state.online,
        oninput: (e) => { draft[key] = e.target.value; refreshFooter(); },
      }),
    );
  }

  function meta() {
    return el('p', { class: 'detail__meta' },
      `Atualizado em ${fmtDate(ticker.atualizadoEm)} · linha ${ticker.row} da planilha`);
  }

  /* -------------------------------- Rodapé -------------------------------- */

  const saveBtn = el('button', { class: 'btn btn--primary', type: 'button' }, 'Salvar');
  const cancelBtn = el('button', { class: 'btn btn--ghost', type: 'button' }, 'Cancelar');
  const footer = el('div', { class: 'formbar' }, cancelBtn, saveBtn);

  function refreshFooter() {
    const canSave = isDirty() && invalid.size === 0 && state.online && !saving;
    saveBtn.disabled = !canSave;
    saveBtn.textContent = saving ? 'Salvando…' : 'Salvar';
    footer.classList.toggle('is-dirty', isDirty());
  }

  cancelBtn.addEventListener('click', () => {
    if (isDirty() && !confirm('Descartar alterações?')) return;
    draft = toDraft(ticker);
    invalid = new Set();
    navigate('/');
  });

  saveBtn.addEventListener('click', async () => {
    if (saving) return;
    saving = true;
    refreshFooter();
    try {
      await saveTicker(ticker, draft);
      toast('Salvo', { type: 'success' });
      // loadEstrategia já rodou dentro de saveTicker: re-renderiza com o confirmado.
      saving = false;
      ticker = getTicker(ativo) || ticker;
      draft = toDraft(ticker);
      render();
    } catch (err) {
      saving = false;
      toast(`Erro ao salvar: ${err.message}${err.hint ? ` — ${err.hint}` : ''}`, { type: 'error', timeout: 6000 });
      refreshFooter();
    }
  });

  /* ------------------------------- Render --------------------------------- */

  function render() {
    clear(content);
    ticker = getTicker(ativo);

    if (!ticker) {
      content.append(
        el('header', { class: 'detail__header' },
          el('button', { class: 'detail__back', type: 'button', onclick: () => navigate('/') }, '‹'),
          el('div', { class: 'detail__title' }, el('h1', null, ativo)),
        ),
        el('p', { class: 'empty' }, state.loadingEstrategia
          ? 'Carregando…'
          : `Ticker "${ativo}" não está na planilha.`),
      );
      footer.remove();
      return;
    }

    if (!draft) draft = toDraft(ticker);

    content.append(header(), posicao(), alvos(), classificacao(),
      textBlock('Tese curta', 'tese', 'Por que você tem (ou quer) este papel'),
      textBlock('Notícia / Observação', 'noticia', 'Fatos recentes, contexto'),
      meta());

    if (!state.online) {
      content.appendChild(el('p', { class: 'notice notice--warn' },
        'Sem conexão: os campos ficam somente leitura até a rede voltar.'));
    }

    root.appendChild(footer);
    refreshFooter();
  }

  // Só re-renderiza sozinho quando não há edição pendente, para não apagar o
  // que o dono está digitando.
  const unsubscribe = subscribe(() => { if (!isDirty() && !saving) render(); });

  // Aviso do navegador ao fechar/recarregar a aba com edição pendente.
  const guard = (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', guard);

  render();
  loadEstrategia({ maxAge: STALE_MS });

  return {
    destroy: () => {
      unsubscribe();
      window.removeEventListener('beforeunload', guard);
      footer.remove();
    },
    beforeLeave: () => !isDirty() || confirm('Você tem alterações não salvas. Descartar?'),
  };
}
