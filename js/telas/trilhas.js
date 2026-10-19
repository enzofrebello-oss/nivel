// trilhas.js: tela Trilhas (#/trilhas e #/trilhas/:id). Etapa 2: placeholder só com o título.
import { h } from '../ui/dom.js';

export async function render(container, params) {
  container.append(h('h2', { class: 'tela-titulo' }, 'Trilhas'));
  if (params.id) {
    container.append(h('p', { class: 'tela-id' }, `id = "${params.id}"`));
  }
}
