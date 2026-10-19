// biblioteca.js: tela Biblioteca (#/biblioteca). Etapa 5 (PROJETO.md, seção 5).
// Busca (sem diferenciar acentos e maiúsculas), filtros Local (Todos / Casa / Academia) e Grupo (chips),
// lista com selo do tipo e da dificuldade. Descontinuados não aparecem. Tocar num exercício abre o detalhe.
// A busca e os filtros ficam em js/logica/busca.js (função pura).

import { h, limpar } from '../ui/dom.js';
import { seloTipo, seloDificuldade } from '../ui/componentes.js';
import { obterCatalogo } from '../catalogo.js';
import { filtrarExercicios, LOCAIS_FILTRO, TODOS } from '../logica/busca.js';

const NOME_LOCAL = { todos: 'Todos', casa: 'Casa', academia: 'Academia' };

// Busca e filtros lembrados enquanto o app está aberto: ao voltar do detalhe, a lista é a mesma.
// (Não vão para o banco; recarregar o app volta ao padrão.)
const estado = { busca: '', local: TODOS, grupo: TODOS };

export async function render(container) {
  const catalogo = obterCatalogo();

  const contagem = h('p', { class: 'biblioteca-contagem', 'aria-live': 'polite' });
  const lista = h('ul', { class: 'lista-exercicios' });

  const campoBusca = h('input', {
    class: 'campo-busca',
    type: 'search',
    placeholder: 'Buscar exercício',
    'aria-label': 'Buscar exercício pelo nome',
    autocomplete: 'off',
    enterkeyhint: 'search',
    value: estado.busca,
    oninput: (ev) => {
      estado.busca = ev.target.value;
      atualizarLista();
    },
  });

  const chipsLocal = grupoDeChips('Local', LOCAIS_FILTRO.map((id) => ({ id, nome: NOME_LOCAL[id] })),
    () => estado.local, (id) => { estado.local = id; atualizarLista(); });

  const chipsGrupo = grupoDeChips('Grupo', [{ id: TODOS, nome: 'Todos' }, ...catalogo.grupos],
    () => estado.grupo, (id) => { estado.grupo = id; atualizarLista(); }, true);

  function atualizarLista() {
    const resultado = filtrarExercicios(catalogo.exercicios, estado);
    contagem.textContent = resultado.length === 1 ? '1 exercício' : `${resultado.length} exercícios`;
    limpar(lista);
    if (!resultado.length) {
      lista.append(h('li', { class: 'lista-vazia' }, 'Nenhum exercício com essa busca e esses filtros.'));
      return;
    }
    lista.append(...resultado.map(itemExercicio));
  }

  container.append(
    h('div', { class: 'biblioteca-filtros' },
      h('div', { class: 'busca' }, iconeLupa(), campoBusca),
      chipsLocal,
      chipsGrupo),
    contagem,
    lista,
  );

  atualizarLista();
}

// Linha de chips de escolha única. rolavel = uma linha só com rolagem horizontal.
function grupoDeChips(rotulo, opcoes, atual, escolher, rolavel = false) {
  const botoes = opcoes.map((op) => h('button', {
    type: 'button',
    class: 'chip',
    'aria-pressed': String(op.id === atual()),
    'data-id': op.id,
    onclick: () => {
      escolher(op.id);
      for (const b of botoes) b.setAttribute('aria-pressed', String(b.dataset.id === op.id));
    },
  }, op.nome));

  return h('div', { class: 'filtro', role: 'group', 'aria-label': rotulo },
    h('span', { class: 'filtro-rotulo' }, rotulo),
    h('div', { class: `chips${rolavel ? ' chips-rolaveis' : ''}` }, botoes));
}

function itemExercicio(exercicio) {
  return h('li', null,
    h('a', { class: 'item-exercicio cartao', href: `#/biblioteca/${encodeURIComponent(exercicio.id)}` },
      h('span', { class: 'item-exercicio-nome' }, exercicio.nome),
      h('span', { class: 'item-exercicio-selos' }, seloTipo(exercicio.tipo), seloDificuldade(exercicio.nivel)),
    ));
}

// Lupa do campo de busca. SVG precisa de createElementNS (h() cria só elementos HTML).
function iconeLupa() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'icone busca-icone');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const circulo = document.createElementNS(ns, 'circle');
  circulo.setAttribute('cx', '11');
  circulo.setAttribute('cy', '11');
  circulo.setAttribute('r', '7');
  const linha = document.createElementNS(ns, 'path');
  linha.setAttribute('d', 'M20 20l-4-4');
  svg.append(circulo, linha);
  return svg;
}
