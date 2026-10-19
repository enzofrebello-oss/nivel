// componentes.js: componentes compartilhados (PROJETO.md, seção 5).
// Etapa 5: "Como fazer" (espaço da ilustração, 3 passos, erro comum) e selos de tipo e dificuldade.
// Os outros componentes (modal, toast, stepper, contador, seletor) entram nas etapas que os usam.

import { h } from './dom.js';

// Nome exibido de cada tipo de exercício (seção 4.1: "peso do corpo" → "corpo").
export const NOME_TIPO = {
  carga: 'Carga',
  corpo: 'Peso do corpo',
  tempo: 'Tempo',
};

export function seloTipo(tipo) {
  return h('span', { class: `selo selo-${tipo}` }, NOME_TIPO[tipo] || tipo);
}

// Dificuldade = campo nivel do exercício (1 a 5, seção 4.1). Mostrada como "Dificuldade N/5" porque
// a palavra "Nível" fica reservada à posição na trilha ("Nível X de Y").
export function seloDificuldade(nivel) {
  return h('span', { class: 'selo selo-dificuldade' }, `Dificuldade ${nivel}/5`);
}

// "Como fazer": ilustração (ou o espaço reservado para ela), os 3 passos e o erro comum.
// Na v1 o campo imagem é null: aparece só o espaço reservado, sem imagem inventada.
export function comoFazer(exercicio) {
  const ilustracao = exercicio.imagem
    ? h('img', { class: 'como-fazer-imagem', src: exercicio.imagem, alt: `Ilustração: ${exercicio.nome}`, loading: 'lazy' })
    : h('div', { class: 'como-fazer-imagem como-fazer-imagem-vazia', role: 'img', 'aria-label': 'Espaço reservado para a ilustração' },
      h('span', null, 'Espaço para a ilustração'));

  return h('section', { class: 'como-fazer cartao', 'aria-labelledby': 'como-fazer-titulo' },
    h('h3', { class: 'cartao-titulo', id: 'como-fazer-titulo' }, 'Como fazer'),
    ilustracao,
    h('ol', { class: 'como-fazer-passos' },
      exercicio.passos.map((passo, i) => h('li', null,
        h('span', { class: 'como-fazer-numero', 'aria-hidden': 'true' }, String(i + 1)),
        h('span', null, passo)))),
    h('div', { class: 'como-fazer-erro' },
      h('strong', null, 'Erro comum'),
      h('p', null, exercicio.erroComum)),
  );
}
