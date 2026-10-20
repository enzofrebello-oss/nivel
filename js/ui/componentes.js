// componentes.js: componentes compartilhados (PROJETO.md, seção 5).
// Etapa 5: "Como fazer" (espaço da ilustração, 3 passos, erro comum) e selos de tipo e dificuldade.
// Etapa 8: banner de atualização ("Nova versão disponível · Atualizar").
// Etapa 12: modal (abrirModal), usado pela escolha da rotina no Hoje.
// Os outros componentes (confirmação, toast, stepper, contador, seletor) entram nas etapas que os usam.

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

// Banner de atualização: fica fixo acima das abas até o usuário tocar em "Atualizar".
// aoAtualizar() é chamada no toque; o botão fica desativado para não mandar o pedido duas vezes.
export function bannerAtualizacao(aoAtualizar) {
  const botao = h('button', {
    type: 'button',
    class: 'banner-atualizacao-botao',
    onclick: () => {
      botao.disabled = true;
      botao.textContent = 'Atualizando…';
      aoAtualizar();
    },
  }, 'Atualizar');

  return h('div', { class: 'banner-atualizacao', role: 'status' },
    h('span', { class: 'banner-atualizacao-texto' }, 'Nova versão disponível'),
    botao,
  );
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

// Modal: <dialog> nativo aberto com showModal() (prende o foco, Esc fecha, fundo escurecido).
// Toque fora do quadro ou em "Fechar" também fecha. O dialog sai do DOM ao fechar.
// conteudo = nó (ou lista de nós) do corpo. Devolve fechar().
export function abrirModal({ titulo, conteudo }) {
  const idTitulo = `modal-titulo-${Date.now()}`;
  const fechar = () => {
    if (dialogo.open) dialogo.close();
  };
  const dialogo = h('dialog', { class: 'modal', 'aria-labelledby': idTitulo },
    h('div', { class: 'modal-quadro' },
      h('div', { class: 'modal-topo' },
        h('h2', { class: 'modal-titulo', id: idTitulo }, titulo),
        h('button', { type: 'button', class: 'botao', onclick: fechar }, 'Fechar')),
      h('div', { class: 'modal-corpo' }, conteudo)),
  );
  // Toque no fundo: o alvo é o próprio dialog (o quadro cobre todo o conteúdo).
  dialogo.addEventListener('click', (ev) => {
    if (ev.target === dialogo) fechar();
  });
  dialogo.addEventListener('close', () => dialogo.remove());
  document.body.append(dialogo);
  dialogo.showModal();
  return fechar;
}
