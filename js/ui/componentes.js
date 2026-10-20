// componentes.js: componentes compartilhados (PROJETO.md, seção 5).
// Etapa 5: "Como fazer" (espaço da ilustração, 3 passos, erro comum) e selos de tipo e dificuldade.
// Etapa 8: banner de atualização ("Nova versão disponível · Atualizar").
// Etapa 12: modal (abrirModal), usado pela escolha da rotina no Hoje.
// Etapa 13: contador (número grande com − e +, que vira campo de digitação ao tocar), usado na tela Treino.
// Etapa 13b: toast (aviso curto que some sozinho), usado no "Próximo: <nome>" da tela Treino.
// Os outros componentes (confirmação, seletor) entram nas etapas que os usam.

import { h } from './dom.js';
import { aplicarPasso, parseCampo, formatarCampo } from '../logica/tipos.js';

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

// ---------- Contador (etapa 13) ----------

const NOMES_CAMPO = { carga: 'Carga', reps: 'Repetições', segundos: 'Tempo' };
const UNIDADE_CAMPO = { carga: 'kg', reps: 'reps', segundos: 'm:ss' };
const PASSO_TEXTO = { carga: '1 kg', reps: '1 rep', segundos: '5 segundos' };

// Número grande com − e +. campo = 'carga' | 'reps' | 'segundos'; tipo = tipo do exercício (limite das reps).
// Os botões andam PASSOS[campo] e param no mínimo/máximo válido (logica/tipos.js, aplicarPasso).
// Tocar no número abre o teclado numérico: é um <input type="text"> com inputmode numeric (decimal na
// carga, que aceita vírgula). No tempo, o que se digita é em segundos ("90" aparece como 1:30).
// grande = número do contador principal (maior). Devolve { elemento, valor(), confirmar(), preenchido() }:
// confirmar() aplica o texto ainda em digitação e diz se o valor é válido.
// valor null = campo vazio (etapa 14: carga sem histórico): mostra `placeholder`, − e + ficam desabilitados
// e confirmar() só dá true depois de digitar um valor válido. preenchido() diz, sem mexer em nada, se o que
// está no campo agora é válido; aoValidar(ok) é chamado a cada tecla e a cada mudança de valor.
export function contador({ campo, tipo, valor, grande = false, aoMudar, aoValidar, placeholder }) {
  let atual = valor;
  const idCampo = `contador-${campo}-${Math.random().toString(36).slice(2, 8)}`;

  const erro = h('p', { class: 'contador-erro', 'aria-live': 'polite' });
  const entrada = h('input', {
    id: idCampo,
    class: 'contador-numero',
    type: 'text',
    inputmode: campo === 'carga' ? 'decimal' : 'numeric',
    autocomplete: 'off',
    enterkeyhint: 'done',
    'aria-describedby': `${idCampo}-dica`,
    placeholder: placeholder || null,
  });
  const menos = h('button', { type: 'button', class: 'contador-botao', 'aria-label': `Diminuir ${PASSO_TEXTO[campo]}` }, '−');
  const mais = h('button', { type: 'button', class: 'contador-botao', 'aria-label': `Aumentar ${PASSO_TEXTO[campo]}` }, '+');

  const vazio = () => atual === null || atual === undefined;

  function mostrar() {
    entrada.value = vazio() ? '' : formatarCampo(campo, atual);
    menos.disabled = aplicarPasso(campo, atual, -1, tipo) === null;
    mais.disabled = aplicarPasso(campo, atual, +1, tipo) === null;
  }

  function definir(novo) {
    atual = novo;
    erro.textContent = '';
    mostrar();
    if (aoMudar) aoMudar(atual);
    if (aoValidar) aoValidar(true);
  }

  // O texto do campo agora é válido? Vazio vale o valor que já estava (nenhum, se o campo começou vazio).
  function preenchido() {
    const texto = entrada.value.trim();
    if (texto === '') return !vazio();
    if (!vazio() && (texto === formatarCampo(campo, atual) || texto === String(atual))) return true;
    return parseCampo(campo, texto, tipo).ok;
  }

  // Aplica o texto que está no campo (não depende do foco: vale também se o blur não veio).
  // Vazio ou igual ao que estava = mantém. Inválido = mostra o erro e volta ao valor anterior.
  function confirmar() {
    const texto = entrada.value.trim();
    if (texto === '') {
      mostrar();
      return !vazio();
    }
    if (!vazio() && (texto === formatarCampo(campo, atual) || texto === String(atual))) {
      mostrar();
      return true;
    }
    const r = parseCampo(campo, texto, tipo);
    if (!r.ok) {
      mostrar();
      erro.textContent = r.erro;
      return false;
    }
    definir(r.valor);
    return true;
  }

  entrada.addEventListener('focus', () => {
    erro.textContent = '';
    // No tempo, a digitação é em segundos: mostra 90 (e não 1:30) para editar.
    if (!vazio()) entrada.value = campo === 'segundos' ? String(atual) : formatarCampo(campo, atual);
    entrada.select();
  });
  entrada.addEventListener('input', () => {
    if (aoValidar) aoValidar(preenchido());
  });
  entrada.addEventListener('blur', confirmar);
  entrada.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      entrada.blur();
    }
  });
  const passo = (direcao) => {
    confirmar();
    const novo = aplicarPasso(campo, atual, direcao, tipo);
    if (novo !== null) definir(novo);
  };
  menos.addEventListener('click', () => passo(-1));
  mais.addEventListener('click', () => passo(+1));

  mostrar();

  const dica = campo === 'segundos'
    ? 'Toque no número para digitar em segundos (90 = 1:30)'
    : `Toque no número para digitar · ${UNIDADE_CAMPO[campo]}`;
  const elemento = h('div', { class: `contador${grande ? ' contador-grande' : ''}` },
    h('label', { class: 'contador-rotulo', for: idCampo }, NOMES_CAMPO[campo]),
    h('div', { class: 'contador-linha' }, menos, entrada, mais),
    h('p', { class: 'contador-dica', id: `${idCampo}-dica` }, dica),
    erro);

  return { elemento, valor: () => atual, confirmar, preenchido };
}

// ---------- Toast (etapa 13b) ----------

let toastAtual = null;

// Aviso curto no pé da tela que some sozinho depois de `duracao` ms. Um novo toast substitui o anterior.
export function toast(texto, { duracao = 2500 } = {}) {
  if (toastAtual) toastAtual.remove();
  const elemento = h('div', { class: 'toast', role: 'status' }, texto);
  document.body.append(elemento);
  toastAtual = elemento;
  setTimeout(() => {
    elemento.remove();
    if (toastAtual === elemento) toastAtual = null;
  }, duracao);
}
