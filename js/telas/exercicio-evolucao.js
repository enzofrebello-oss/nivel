// exercicio-evolucao.js: gráfico e recordes de um exercício (#/evolucao/exercicio/:id). Etapa 2: placeholder só com o título.
import { h } from '../ui/dom.js';

export async function render(container, params) {
  container.append(
    h('h2', { class: 'tela-titulo' }, 'Evolução do exercício'),
    h('p', { class: 'tela-id' }, `id = "${params.id}"`)
  );
}
