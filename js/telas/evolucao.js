// evolucao.js: tela Evolução (#/evolucao). PROJETO.md, seção 8, "6. Evolução" (etapas 19 a 22).
// De cima para baixo:
// - Constância: foguinho, "N semanas seguidas", "X de Y treinos nesta semana" (Y = dias por semana da
//   rotina atual, meta.rotinaAtualId) e barras das últimas 8 semanas (a atual com contorno claro).
// - Dois recordes lado a lado: a melhor série dos 2 exercícios com recorde mais recente.
// - Gráfico compacto: melhor série de cada treino do exercício (começa no mais treinado), "▾" troca o
//   exercício num modal, ganho no período em laranja.
// - "Últimos treinos": linha do tempo com os 10 treinos concluídos mais recentes; pílula "+N" (séries
//   que superaram o "antes") ou "="; tocar abre o resumo (#/evolucao/treino/:id, Detalhe da sessão).
// Números em logica/evolucao.js, só com dados reais do banco (sessões concluídas).
// render aceita um 3º parâmetro opcional { db, catalogo, agora } (só os testes, como Trilhas).
import { h, limpar } from '../ui/dom.js';
import { abrirModal } from '../ui/componentes.js';
import { graficoCompacto } from '../ui/grafico.js';
import { obterCatalogo } from '../catalogo.js';
import { lerMeta } from '../db/meta.js';
import { listarSessoes } from '../db/sessoes.js';
import { listarTodasSeries } from '../db/series.js';
import { textoDuracao } from '../logica/datas.js';
import { formatarSerie } from '../logica/tipos.js';
import {
  constancia, textoSemanasSeguidas, textoNestaSemana, recordes, exerciciosTreinados,
  pontosDoExercicio, ganhoNoPeriodo, ultimosTreinos, textoGanhos,
} from '../logica/evolucao.js';

export const MENSAGEM_VAZIA = 'Faça seu primeiro treino para ver sua evolução';

const formatoData = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const SVG = 'http://www.w3.org/2000/svg';

export async function render(container, params, { db, catalogo: catalogoDeTeste, agora = Date.now() } = {}) {
  const catalogo = catalogoDeTeste || obterCatalogo();
  const tela = h('div', { class: 'evolucao' });
  container.append(tela);
  const ctx = { fecharModal: null };

  let sessoes = [];
  let series = [];
  let rotinaId;
  try {
    [sessoes, series, rotinaId] = await Promise.all([listarSessoes(db), listarTodasSeries(db), lerMeta('rotinaAtualId', db)]);
  } catch (erro) {
    console.error('Evolução: banco indisponível:', erro);
    tela.append(h('section', { class: 'cartao' }, h('p', { class: 'evolucao-vazio' }, 'Banco indisponível: não dá para mostrar a evolução agora.')));
    return undefined;
  }
  const rotina = rotinaId ? catalogo.rotinaPorId.get(rotinaId) : undefined;
  const nomeDe = (id) => {
    const exercicio = catalogo.exercicioPorId.get(id);
    return exercicio ? exercicio.nome : id;
  };

  const c = constancia({ sessoes, diasPorSemana: rotina ? rotina.diasPorSemana : undefined, agora });
  tela.append(cartaoConstancia(c));

  const treinados = exerciciosTreinados(series, sessoes);
  if (!treinados.length) {
    tela.append(h('section', { class: 'cartao evolucao-vazio-cartao' }, h('p', { class: 'evolucao-vazio' }, MENSAGEM_VAZIA)));
    return () => { if (ctx.fecharModal) ctx.fecharModal(); };
  }

  // Recordes (os 2 mais recentes).
  tela.append(h('div', { class: 'evolucao-recordes' },
    recordes(series, sessoes, 2).map((r) => h('section', { class: 'cartao evolucao-recorde', 'data-exercicio': r.exercicioId },
      h('p', { class: 'evolucao-rotulo' }, `Recorde · ${nomeDe(r.exercicioId)}`),
      h('p', { class: 'evolucao-recorde-valor' }, formatarSerie(r.serie))))));

  // Gráfico compacto.
  const cartaoGrafico = h('section', { class: 'cartao evolucao-grafico' });
  tela.append(cartaoGrafico);
  const desenharGrafico = (exercicioId) => {
    const pontos = pontosDoExercicio(exercicioId, series, sessoes);
    const ganho = ganhoNoPeriodo(pontos);
    const nome = nomeDe(exercicioId);
    limpar(cartaoGrafico);
    cartaoGrafico.dataset.exercicio = exercicioId;
    cartaoGrafico.append(
      h('div', { class: 'evolucao-grafico-topo' },
        h('button', {
          type: 'button',
          class: 'evolucao-trocar',
          'aria-label': `${nome}. Trocar o exercício do gráfico`,
          onclick: () => escolherExercicio(),
        }, h('span', { class: 'evolucao-trocar-nome' }, nome), h('span', { 'aria-hidden': 'true' }, ' ▾')),
        ganho ? h('span', { class: `evolucao-ganho${ganho.ganho ? ' positivo' : ''}` }, ganho.texto) : null),
      graficoCompacto(pontos, { rotulo: `Melhor série de cada treino de ${nome}: ${pontos.map((p) => formatarSerie(p.serie)).join(', ')}` }),
      h('p', { class: 'evolucao-legenda' }, pontos.length < 2
        ? 'Melhor série por treino · treine de novo para ver a linha'
        : `Melhor série por treino · ${pontos.length} treinos`));
  };
  const escolherExercicio = () => {
    if (ctx.fecharModal) ctx.fecharModal();
    ctx.fecharModal = abrirModal({
      titulo: 'Exercício do gráfico',
      conteudo: h('ul', { class: 'evolucao-escolha' }, treinados.map((t) => h('li', null,
        h('button', {
          type: 'button',
          class: 'evolucao-escolha-item',
          'data-exercicio': t.exercicioId,
          'aria-pressed': cartaoGrafico.dataset.exercicio === t.exercicioId ? 'true' : 'false',
          onclick: () => {
            if (ctx.fecharModal) ctx.fecharModal();
            ctx.fecharModal = null;
            desenharGrafico(t.exercicioId);
          },
        }, h('span', null, nomeDe(t.exercicioId)),
        h('span', { class: 'evolucao-escolha-treinos' }, `${t.treinos} ${t.treinos === 1 ? 'treino' : 'treinos'}`))))),
    });
  };
  desenharGrafico(treinados[0].exercicioId);

  // Últimos treinos.
  const ultimos = ultimosTreinos(sessoes, series);
  tela.append(
    h('h2', { class: 'evolucao-rotulo evolucao-secao' }, 'Últimos treinos'),
    h('ol', { class: 'evolucao-linha-tempo' }, ultimos.map((u, i) => h('li', { class: `evolucao-treino${i === 0 ? ' recente' : ''}` },
      h('a', {
        class: 'evolucao-treino-link',
        href: `#/evolucao/treino/${encodeURIComponent(u.sessao.id)}`,
        'data-sessao': u.sessao.id,
      },
      h('span', { class: 'evolucao-bolinha', 'aria-hidden': 'true' }),
      h('span', { class: 'evolucao-treino-texto' },
        h('span', { class: 'evolucao-treino-nome' }, u.sessao.nome),
        h('span', { class: 'evolucao-treino-detalhe' },
          `${formatoData.format(u.sessao.inicio).replace('.', '')} · ${textoDuracao(u.sessao.fim - u.sessao.inicio)} · ${u.series} ${u.series === 1 ? 'série' : 'séries'}`)),
      h('span', {
        class: `evolucao-pilula${u.ganhos > 0 ? ' positivo' : ''}`,
        'aria-label': u.ganhos > 0 ? `${u.ganhos} ${u.ganhos === 1 ? 'série superou' : 'séries superaram'} a última vez` : 'Nenhuma série superou a última vez',
      }, textoGanhos(u.ganhos)))))));

  return () => { if (ctx.fecharModal) ctx.fecharModal(); };
}

function cartaoConstancia(c) {
  const maior = Math.max(c.meta, ...c.barras.map((b) => b.treinos));
  return h('section', { class: 'cartao evolucao-constancia' },
    h('div', { class: 'evolucao-constancia-topo' },
      h('span', { class: 'evolucao-fogo', 'aria-hidden': 'true' }, foguinho()),
      h('div', null,
        h('p', { class: 'evolucao-seguidas' }, textoSemanasSeguidas(c.semanasSeguidas)),
        h('p', { class: 'evolucao-nesta-semana' }, textoNestaSemana(c)))),
    h('ol', { class: 'evolucao-barras', 'aria-label': `Dias com treino nas últimas 8 semanas: ${c.barras.map((b) => b.treinos).join(', ')}` },
      c.barras.map((b) => h('li', {
        class: `evolucao-barra${b.atual ? ' atual' : ''}${b.treinos ? '' : ' vazia'}`,
        'data-treinos': b.treinos,
        style: `--altura: ${Math.round((b.treinos / maior) * 100)}%`,
      }))),
    h('p', { class: 'evolucao-legenda' }, 'treinos por semana · últimas 8'));
}

function foguinho() {
  const desenho = document.createElementNS(SVG, 'svg');
  desenho.setAttribute('viewBox', '0 0 24 24');
  desenho.setAttribute('focusable', 'false');
  const caminho = document.createElementNS(SVG, 'path');
  caminho.setAttribute('d', 'M12 2c1 3.5-1.5 5-1.5 7.5 0 1.2.8 2 1.7 2 1.4 0 2-1.3 1.8-3 2.4 1.6 4 4.2 4 7a6 6 0 0 1-12 0c0-3.6 2.4-6.2 4.3-8.4C11.5 5.6 12.4 4 12 2z');
  caminho.setAttribute('fill', 'currentColor');
  desenho.append(caminho);
  return desenho;
}
