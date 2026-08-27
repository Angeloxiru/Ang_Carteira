/* Helpers de DOM. Tudo é criado por createElement (nunca innerHTML com dados
   da planilha), então texto de tese/notícia nunca vira HTML. */

/**
 * el('div', { class: 'card', onclick: fn }, 'texto', outroNó)
 * Props especiais: class, dataset, style (objeto), on* (listeners), html (cru).
 */
export function el(tag, props = null, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in node && typeof value !== 'object') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }

  append(node, children);
  return node;
}

export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export function frag(...children) {
  return append(document.createDocumentFragment(), children);
}

export function clear(node) {
  node.replaceChildren();
  return node;
}

/** Cria elementos SVG (createElement não serve para namespace SVG). */
export function svg(tag, props = null, ...children) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    node.setAttribute(key === 'class' ? 'class' : key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) if (child) node.appendChild(child);
  return node;
}
