// sessao-detalhe.js: detalhe/resumo de um treino (#/evolucao/treino/:id). Etapa 2: placeholder só com o título.
import { h } from '../ui/dom.js';

export async function render(container, params) {
  container.append(
    h('h2', { class: 'tela-titulo' }, 'Detalhe da sessão'),
    h('p', { class: 'tela-id' }, `id = "${params.id}"`)
  );
}
