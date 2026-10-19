// biblioteca.js: tela Biblioteca (#/biblioteca). Etapa 2: placeholder só com o título.
import { h } from '../ui/dom.js';

export async function render(container) {
  container.append(h('h2', { class: 'tela-titulo' }, 'Biblioteca'));
}
