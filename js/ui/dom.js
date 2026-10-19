// dom.js: criação de elementos sem innerHTML.
// h(tag, attrs, ...filhos) cria um elemento; textos viram nós de texto (nunca HTML).

export function h(tag, attrs, ...filhos) {
  const el = document.createElement(tag);

  for (const [chave, valor] of Object.entries(attrs || {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (chave === 'class') {
      el.className = valor;
    } else if (chave.startsWith('on') && typeof valor === 'function') {
      el.addEventListener(chave.slice(2).toLowerCase(), valor);
    } else if (valor === true) {
      el.setAttribute(chave, '');
    } else {
      el.setAttribute(chave, String(valor));
    }
  }

  acrescentar(el, filhos);
  return el;
}

function acrescentar(el, filhos) {
  for (const filho of filhos) {
    if (filho === null || filho === undefined || filho === false) continue;
    if (Array.isArray(filho)) {
      acrescentar(el, filho);
    } else if (filho instanceof Node) {
      el.append(filho);
    } else {
      el.append(document.createTextNode(String(filho)));
    }
  }
}

// Remove todos os filhos de um elemento.
export function limpar(el) {
  el.replaceChildren();
}
