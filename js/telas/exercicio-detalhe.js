// exercicio-detalhe.js: detalhe do exercício (#/biblioteca/:id). Etapa 2: placeholder só com o título.
import { h } from '../ui/dom.js';

export async function render(container, params) {
  container.append(
    h('h2', { class: 'tela-titulo' }, 'Detalhe do exercício'),
    h('p', { class: 'tela-id' }, `id = "${params.id}"`)
  );
}
