// exercicio-detalhe.js: detalhe do exercício (#/biblioteca/:id). Etapa 5 (PROJETO.md, seção 5).
// Nome (é o título da tela; aqui o topo fica escondido e não ocupa espaço), selos de tipo e dificuldade, "Como fazer"
// (espaço da ilustração, 3 passos, erro comum), equipamento, músculos, grupos, local
// e, se o exercício estiver numa trilha, a trilha e a posição ("Nível X de Y"), com link para a tela Trilhas.
// "Ver evolução" depende do banco e entra na etapa 22.

import { h } from '../ui/dom.js';
import { comoFazer, seloTipo, seloDificuldade } from '../ui/componentes.js';
import { obterCatalogo } from '../catalogo.js';

const NOME_LOCAL = { casa: 'Casa', academia: 'Academia' };

export async function render(container, params) {
  const catalogo = obterCatalogo();
  const exercicio = catalogo.exercicioPorId.get(params.id);

  if (!exercicio) {
    document.title = 'Exercício não encontrado · Treino';
    container.append(
      h('section', { class: 'cartao nao-encontrado', role: 'alert' },
        h('h2', null, 'Exercício não encontrado'),
        h('p', null, 'Este exercício não existe na biblioteca.'),
        h('a', { class: 'link-destaque', href: '#/biblioteca' }, 'Voltar para a Biblioteca')),
    );
    return;
  }

  document.title = `${exercicio.nome} · Treino`;

  const naTrilha = catalogo.trilhaDoExercicio.get(exercicio.id);
  const nomeGrupo = new Map(catalogo.grupos.map((g) => [g.id, g.nome]));

  // append() escreveria "null" no lugar dos itens que não existem; por isso o filter.
  container.append(...[
    h('a', { class: 'link-voltar', href: '#/biblioteca' }, '‹ Biblioteca'),
    h('h2', { class: 'detalhe-nome' }, exercicio.nome),
    h('div', { class: 'detalhe-selos' }, seloTipo(exercicio.tipo), seloDificuldade(exercicio.nivel)),
    exercicio.descontinuado
      ? h('p', { class: 'detalhe-aviso' }, 'Exercício descontinuado: não aparece mais na Biblioteca.')
      : null,
    naTrilha ? cartaoTrilha(naTrilha) : null,
    comoFazer(exercicio),
    h('section', { class: 'cartao', 'aria-labelledby': 'ficha-titulo' },
      h('h3', { class: 'cartao-titulo', id: 'ficha-titulo' }, 'Ficha'),
      h('dl', { class: 'ficha' },
        linhaFicha('Equipamento', exercicio.equipamento.length ? exercicio.equipamento.join(', ') : 'Nenhum'),
        linhaFicha('Músculos', exercicio.musculos.join(', ')),
        linhaFicha('Grupos', exercicio.grupos.map((g) => nomeGrupo.get(g) || g).join(', ')),
        // A dificuldade não se repete aqui: já está no selo "Dificuldade N/5" logo abaixo do nome.
        linhaFicha('Local', exercicio.locais.map((l) => NOME_LOCAL[l] || l).join(' e ')))),
  ].filter(Boolean));
}

// Trilha e posição do exercício nela, com link para a trilha na tela Trilhas.
function cartaoTrilha({ trilha, posicao }) {
  return h('a', { class: 'cartao cartao-trilha', href: `#/trilhas/${encodeURIComponent(trilha.id)}` },
    h('span', { class: 'cartao-trilha-rotulo' }, 'Trilha'),
    h('span', { class: 'cartao-trilha-nome' }, trilha.nome),
    h('span', { class: 'cartao-trilha-posicao' }, `Nível ${posicao} de ${trilha.niveis.length}`),
  );
}

function linhaFicha(rotulo, valor) {
  return h('div', { class: 'ficha-linha' },
    h('dt', null, rotulo),
    h('dd', null, valor));
}
