// treino.js: treino em andamento, com o modo Descanso (#/treino/:id). Etapa 2: placeholder só com o título.
import { h } from '../ui/dom.js';

export async function render(container, params) {
  container.append(
    h('h2', { class: 'tela-titulo' }, 'Treino em andamento'),
    h('p', { class: 'tela-id' }, `id = "${params.id}"`)
  );
}
