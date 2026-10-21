// evolucao.test.js: testes da tela Evolução (PROJETO.md, seção 8, "6. Evolução") e das funções puras
// dela (js/logica/evolucao.js):
// - constância: nenhum dado, semana atual incompleta (não quebra), semana atual completa (conta), semana
//   que não bate a rotina (quebra), dois treinos no mesmo dia = 1 dia, treino em andamento não conta,
//   rotina de 4 dias, sem rotina (3 dias), barras das 8 semanas;
// - recorde: corpo, carga (carga manda, reps desempatam), tempo, empate (fica a data da primeira vez),
//   os 2 mais recentes, nenhum dado, treino em andamento fora;
// - gráfico: melhor série de cada treino, exercício mais treinado (empate: o mais recente), ganho no
//   período com unidade (reps, kg, s, "=", negativo, 1 ponto só), coordenadas;
// - "+N": séries que superaram o "antes" (primeiro treino = 0, carga com menos reps não conta, "antes" é
//   o treino anterior e não um posterior), últimos treinos;
// - a tela montada com um banco de teste: vazia (mensagem amigável) e com treinos reais.
// O banco é separado, 'nivel-teste-evolucao', apagado no começo e no fim; NUNCA o banco real 'nivel'.

import { teste, igual } from './mini-teste.js';
import { deleteDB } from '../vendor/idb/index.js';
import { abrirBanco, NOME_BANCO } from '../js/db/conexao.js';
import { carregarCatalogo } from '../js/catalogo.js';
import { gravarMeta } from '../js/db/meta.js';
import { iniciarSessao, finalizarSessao } from '../js/db/sessoes.js';
import { adicionarSerie } from '../js/db/series.js';
import {
  constancia, textoSemanasSeguidas, textoNestaSemana, melhorSerie, recordes, exerciciosTreinados,
  exercicioMaisTreinado, pontosDoExercicio, ganhoNoPeriodo, coordenadasDoGrafico, ganhosDoTreino,
  ultimosTreinos, textoGanhos,
} from '../js/logica/evolucao.js';
import { render as renderEvolucao, MENSAGEM_VAZIA } from '../js/telas/evolucao.js';

const NOME_TESTE = 'nivel-teste-evolucao';
let db = null;
let catalogo = null;

// "Agora" fixo: quarta-feira, 21/10/2026, 12h (hora local). A semana atual começa na segunda 19/10.
const AGORA = new Date(2026, 9, 21, 12).getTime();
// Dia `diaSemana` (0 = segunda) de `semanasAtras` semanas antes da atual, às `hora` h.
const dia = (semanasAtras, diaSemana, hora = 10) => new Date(2026, 9, 19 - 7 * semanasAtras + diaSemana, hora).getTime();

let contador = 0;
const sessao = (inicio, status = 'concluida', id = `s${++contador}`) => ({ id, status, inicio, fim: inicio + 3_600_000, nome: `Treino ${id}` });
const corpo = (sessaoId, exercicioId, reps, feitaEm) => ({ id: `x${++contador}`, sessaoId, exercicioId, tipo: 'corpo', grupos: [], reps, feitaEm });
const carga = (sessaoId, exercicioId, kg, reps, feitaEm) => ({ id: `x${++contador}`, sessaoId, exercicioId, tipo: 'carga', grupos: [], carga: kg, reps, feitaEm });
const tempo = (sessaoId, exercicioId, segundos, feitaEm) => ({ id: `x${++contador}`, sessaoId, exercicioId, tipo: 'tempo', grupos: [], segundos, feitaEm });

// Sessões concluídas em dias dados: [[semanasAtras, diaSemana], ...].
const nosDias = (lista) => lista.map(([s, d]) => sessao(dia(s, d)));

// ---------- Constância ----------

teste('constância: nenhum dado = 0 semanas seguidas, 0 de 3 nesta semana e 8 barras zeradas', () => {
  const c = constancia({ sessoes: [], diasPorSemana: 3, agora: AGORA });
  igual(c.semanasSeguidas, 0);
  igual(c.nestaSemana, 0);
  igual(c.meta, 3);
  igual(c.barras.length, 8);
  igual(c.barras.map((b) => b.treinos), [0, 0, 0, 0, 0, 0, 0, 0]);
  igual(c.barras.map((b) => b.atual), [false, false, false, false, false, false, false, true]);
  igual(textoSemanasSeguidas(c.semanasSeguidas), '0 semanas seguidas');
  igual(textoNestaSemana(c), '0 de 3 treinos nesta semana');
});

teste('constância: semana atual incompleta não quebra a sequência (2 semanas cheias antes + 1 dia agora = 2)', () => {
  const sessoes = nosDias([[2, 0], [2, 2], [2, 4], [1, 0], [1, 2], [1, 4], [0, 0]]);
  const c = constancia({ sessoes, diasPorSemana: 3, agora: AGORA });
  igual(c.semanasSeguidas, 2);
  igual(c.nestaSemana, 1);
  igual(textoNestaSemana(c), '1 de 3 treinos nesta semana');
});

teste('constância: semana atual que já bateu a rotina entra na sequência', () => {
  const sessoes = nosDias([[1, 0], [1, 2], [1, 4], [0, 0], [0, 1], [0, 2]]);
  const c = constancia({ sessoes, diasPorSemana: 3, agora: AGORA });
  igual(c.semanasSeguidas, 2);
  igual(textoSemanasSeguidas(1), '1 semana seguida');
});

teste('constância: semana passada que não bateu os dias da rotina quebra a sequência', () => {
  // 3 semanas atrás: 3 dias; 2 atrás: só 2 dias (quebra); 1 atrás: 3 dias; atual: nada.
  const sessoes = nosDias([[3, 0], [3, 2], [3, 4], [2, 0], [2, 3], [1, 1], [1, 3], [1, 5]]);
  const c = constancia({ sessoes, diasPorSemana: 3, agora: AGORA });
  igual(c.semanasSeguidas, 1);
  igual(c.barras.slice(-4).map((b) => b.treinos), [3, 2, 3, 0]);
  igual(c.barras.slice(-4).map((b) => b.bateu), [true, false, true, false]);
});

teste('constância: semana vazia entre semanas cheias também quebra', () => {
  const sessoes = nosDias([[3, 0], [3, 2], [3, 4], [1, 0], [1, 2], [1, 4]]);
  igual(constancia({ sessoes, diasPorSemana: 3, agora: AGORA }).semanasSeguidas, 1);
});

teste('constância: dois treinos no mesmo dia contam como um dia; treino em andamento não conta', () => {
  const sessoes = [
    sessao(dia(1, 0, 8)), sessao(dia(1, 0, 18)), sessao(dia(1, 2)), // 2 dias só
    sessao(dia(0, 1), 'andamento'),
  ];
  const c = constancia({ sessoes, diasPorSemana: 3, agora: AGORA });
  igual(c.barras[6].treinos, 2);
  igual(c.semanasSeguidas, 0);
  igual(c.nestaSemana, 0);
});

teste('constância: rotina de 4 dias exige 4 dias; sem rotina usa 3', () => {
  const sessoes = nosDias([[1, 0], [1, 2], [1, 4]]);
  igual(constancia({ sessoes, diasPorSemana: 4, agora: AGORA }).semanasSeguidas, 0);
  igual(constancia({ sessoes, diasPorSemana: 4, agora: AGORA }).meta, 4);
  const semRotina = constancia({ sessoes, diasPorSemana: undefined, agora: AGORA });
  igual(semRotina.meta, 3);
  igual(semRotina.semanasSeguidas, 1);
});

teste('constância: barras das últimas 8 semanas (a mais antiga primeiro); treino de 9 semanas atrás fica fora das barras', () => {
  const sessoes = nosDias([[8, 0], [7, 0], [7, 1], [3, 2], [0, 0]]);
  const c = constancia({ sessoes, diasPorSemana: 3, agora: AGORA });
  igual(c.barras.map((b) => b.treinos), [2, 0, 0, 0, 1, 0, 0, 1]);
  igual(c.barras[7].inicio, new Date(2026, 9, 19).getTime());
});

// ---------- Recorde ----------

teste('recorde: corpo = a série com mais reps', () => {
  const s = sessao(dia(1, 0));
  const r = recordes([corpo(s.id, 'flexao', 10, 1), corpo(s.id, 'flexao', 14, 2), corpo(s.id, 'flexao', 12, 3)], [s]);
  igual(r.length, 1);
  igual(r[0].serie.reps, 14);
});

teste('recorde: carga = maior carga (mesmo com menos reps); mesma carga desempata pelas reps', () => {
  const s = sessao(dia(1, 0));
  igual(melhorSerie([carga(s.id, 'supino', 60, 10, 1), carga(s.id, 'supino', 65, 6, 2)]).carga, 65);
  const m = melhorSerie([carga(s.id, 'supino', 60, 8, 1), carga(s.id, 'supino', 60, 10, 2), carga(s.id, 'supino', 57.5, 12, 3)]);
  igual([m.carga, m.reps], [60, 10]);
});

teste('recorde: tempo = a série mais longa', () => {
  const s = sessao(dia(1, 0));
  igual(melhorSerie([tempo(s.id, 'prancha', 45, 1), tempo(s.id, 'prancha', 62, 2), tempo(s.id, 'prancha', 50, 3)]).segundos, 62);
});

teste('recorde: empate não bate recorde, a data continua a da primeira vez', () => {
  const s1 = sessao(dia(2, 0));
  const s2 = sessao(dia(1, 0));
  const primeira = corpo(s1.id, 'flexao', 15, dia(2, 0) + 1000);
  const r = recordes([primeira, corpo(s2.id, 'flexao', 15, dia(1, 0) + 1000), corpo(s2.id, 'flexao', 12, dia(1, 0) + 2000)], [s1, s2]);
  igual(r[0].serie.id, primeira.id);
  igual(r[0].em, dia(2, 0) + 1000);
});

teste('recorde: os 2 mais recentes, o mais novo primeiro', () => {
  const s1 = sessao(dia(3, 0));
  const s2 = sessao(dia(2, 0));
  const s3 = sessao(dia(1, 0));
  const series = [
    corpo(s1.id, 'a', 10, dia(3, 0)), corpo(s2.id, 'b', 10, dia(2, 0)), tempo(s3.id, 'c', 30, dia(1, 0)),
    corpo(s3.id, 'a', 8, dia(1, 0) + 1), // não bate o recorde de 'a' (continua o de 3 semanas atrás)
  ];
  igual(recordes(series, [s1, s2, s3], 2).map((r) => r.exercicioId), ['c', 'b']);
});

teste('recorde: nenhum dado = lista vazia; treino em andamento e série inválida ficam fora', () => {
  igual(recordes([], []), []);
  const andando = sessao(dia(0, 0), 'andamento');
  const feito = sessao(dia(1, 0));
  const r = recordes([corpo(andando.id, 'flexao', 30, 5), corpo(feito.id, 'flexao', 12, 1), corpo(feito.id, 'flexao', 0, 2)], [andando, feito]);
  igual(r.map((x) => x.serie.reps), [12]);
  igual(melhorSerie([]), null);
});

// ---------- Gráfico ----------

teste('gráfico: um ponto por treino concluído = a melhor série dele, em ordem de data', () => {
  const s1 = sessao(dia(2, 0));
  const s2 = sessao(dia(1, 0));
  const anda = sessao(dia(0, 0), 'andamento');
  const series = [
    corpo(s2.id, 'flexao', 14, 4), corpo(s2.id, 'flexao', 12, 5),
    corpo(s1.id, 'flexao', 10, 1), corpo(s1.id, 'flexao', 11, 2),
    corpo(anda.id, 'flexao', 20, 6), corpo(s1.id, 'outro', 50, 3),
  ];
  const pontos = pontosDoExercicio('flexao', series, [s1, s2, anda]);
  igual(pontos.map((p) => [p.sessaoId, p.valor]), [[s1.id, 11], [s2.id, 14]]);
});

teste('gráfico: carga usa a maior carga de cada treino', () => {
  const s1 = sessao(dia(1, 0));
  const pontos = pontosDoExercicio('supino', [carga(s1.id, 'supino', 60, 10, 1), carga(s1.id, 'supino', 65, 6, 2)], [s1]);
  igual(pontos[0].valor, 65);
});

teste('gráfico: começa no exercício mais treinado (em mais treinos); empate fica com o feito mais recentemente', () => {
  const s1 = sessao(dia(3, 0));
  const s2 = sessao(dia(2, 0));
  const s3 = sessao(dia(1, 0));
  const series = [
    corpo(s1.id, 'a', 10, 1), corpo(s1.id, 'a', 10, 2), corpo(s1.id, 'a', 10, 3), // muitas séries, 1 treino
    corpo(s2.id, 'b', 10, 4), corpo(s3.id, 'b', 10, 5), // 2 treinos
    corpo(s1.id, 'c', 10, 6), corpo(s2.id, 'c', 10, 7), // 2 treinos, mas o último é mais antigo que o de 'b'
  ];
  igual(exercicioMaisTreinado(series, [s1, s2, s3]), 'b');
  igual(exerciciosTreinados(series, [s1, s2, s3]).map((t) => [t.exercicioId, t.treinos]), [['b', 2], ['c', 2], ['a', 1]]);
  igual(exercicioMaisTreinado([], []), null);
});

teste('gráfico: ganho no período com a unidade de cada tipo', () => {
  const p = (valor, serie) => ({ valor, serie });
  igual(ganhoNoPeriodo([p(10, { tipo: 'corpo' }), p(12, { tipo: 'corpo' }), p(14, { tipo: 'corpo' })]).texto, '+4 reps');
  igual(ganhoNoPeriodo([p(60, { tipo: 'carga' }), p(62.5, { tipo: 'carga' })]).texto, '+2,5 kg');
  igual(ganhoNoPeriodo([p(45, { tipo: 'tempo' }), p(55, { tipo: 'tempo' })]).texto, '+10 s');
  igual(ganhoNoPeriodo([p(10, { tipo: 'corpo' }), p(11, { tipo: 'corpo' })]).texto, '+1 rep');
  const igualdade = ganhoNoPeriodo([p(10, { tipo: 'corpo' }), p(10, { tipo: 'corpo' })]);
  igual([igualdade.texto, igualdade.ganho], ['=', false]);
  const queda = ganhoNoPeriodo([p(12, { tipo: 'corpo' }), p(10, { tipo: 'corpo' })]);
  igual([queda.texto, queda.ganho], ['−2 reps', false]);
  igual(ganhoNoPeriodo([p(10, { tipo: 'corpo' })]), null, '1 ponto não tem ganho');
  igual(ganhoNoPeriodo([]), null);
});

teste('gráfico: coordenadas com x proporcional à data e y ao valor; 1 ponto fica no meio', () => {
  const op = { largura: 300, altura: 120, margem: 10 };
  igual(coordenadasDoGrafico([], op), []);
  igual(coordenadasDoGrafico([{ inicio: 5, valor: 10 }], op), [{ x: 150, y: 60 }]);
  const c = coordenadasDoGrafico([{ inicio: 0, valor: 10 }, { inicio: 10, valor: 20 }, { inicio: 40, valor: 15 }], op);
  igual(c.map((p) => Math.round(p.x)), [10, 80, 290]);
  igual(c.map((p) => Math.round(p.y)), [110, 10, 60]);
});

// ---------- "+N" e últimos treinos ----------

teste('+N: primeiro treino = 0 ("="); séries que superaram o antes contam', () => {
  const s1 = sessao(dia(2, 0));
  const s2 = sessao(dia(1, 0));
  const series = [
    corpo(s1.id, 'flexao', 10, 1), corpo(s1.id, 'flexao', 10, 2), corpo(s1.id, 'flexao', 10, 3),
    corpo(s2.id, 'flexao', 12, 4), corpo(s2.id, 'flexao', 10, 5), corpo(s2.id, 'flexao', 11, 6), corpo(s2.id, 'flexao', 9, 7),
  ];
  igual(ganhosDoTreino(s1, series, [s1, s2]), 0);
  igual(ganhosDoTreino(s2, series, [s1, s2]), 2, '12 > 10 e 11 > 10; 10 = 10 e a 4ª série não tem par');
  igual(textoGanhos(0), '=');
  igual(textoGanhos(2), '+2');
});

teste('+N: carga com mais carga e menos reps não conta; mais carga com as mesmas reps conta; tempo também', () => {
  const s1 = sessao(dia(2, 0));
  const s2 = sessao(dia(1, 0));
  const series = [
    carga(s1.id, 'supino', 60, 10, 1), carga(s1.id, 'supino', 60, 10, 2), tempo(s1.id, 'prancha', 45, 3),
    carga(s2.id, 'supino', 65, 8, 4), carga(s2.id, 'supino', 62.5, 10, 5), tempo(s2.id, 'prancha', 50, 6),
  ];
  igual(ganhosDoTreino(s2, series, [s1, s2]), 2);
});

teste('+N: o "antes" é o último treino concluído ANTES deste (um treino posterior ou em andamento não conta)', () => {
  const s1 = sessao(dia(3, 0));
  const s2 = sessao(dia(2, 0));
  const s3 = sessao(dia(1, 0));
  const anda = sessao(dia(2, 3), 'andamento');
  const series = [
    corpo(s1.id, 'flexao', 8, 1), corpo(s2.id, 'flexao', 10, 2), corpo(s3.id, 'flexao', 20, 3), corpo(anda.id, 'flexao', 5, 4),
  ];
  igual(ganhosDoTreino(s2, series, [s1, s2, s3, anda]), 1, 's2 compara com s1 (8), não com s3 nem com o em andamento');
  igual(ganhosDoTreino(s3, series, [s1, s2, s3, anda]), 1, 's3 compara com s2 (10)');
});

teste('últimos treinos: só concluídos, o mais recente primeiro, com séries e +N; limite de quantidade', () => {
  const s1 = sessao(dia(2, 0));
  const s2 = sessao(dia(1, 0));
  const anda = sessao(dia(0, 0), 'andamento');
  const series = [corpo(s1.id, 'flexao', 10, 1), corpo(s2.id, 'flexao', 11, 2), corpo(s2.id, 'flexao', 9, 3)];
  const lista = ultimosTreinos([s1, anda, s2], series);
  igual(lista.map((u) => [u.sessao.id, u.series, u.ganhos]), [[s2.id, 2, 1], [s1.id, 1, 0]]);
  igual(ultimosTreinos([s1, s2], series, 1).length, 1);
  igual(ultimosTreinos([], []), []);
});

// ---------- Tela com banco de teste ----------

function montarContainer() {
  const container = document.createElement('div');
  container.hidden = true;
  document.body.append(container);
  return container;
}

// Treino concluído pelo mesmo caminho do app: [[exercicioId, medidas], ...].
async function treino(nome, inicio, registros) {
  const { sessao: s } = await iniciarSessao({
    rotinaId: null, diaId: null, nome, local: 'casa', versaoDados: catalogo.versaoDados,
    itens: [{ exercicioId: registros[0][0], trilhaId: null, series: 3, alvo: '10', descanso: 60 }],
  }, { agora: inicio }, db);
  for (const [i, [exercicioId, medidas]] of registros.entries()) {
    await adicionarSerie({ sessaoId: s.id, exercicio: catalogo.exercicioPorId.get(exercicioId), medidas }, { agora: inicio + (i + 1) * 1000 }, db);
  }
  await finalizarSessao(s.id, { agora: inicio + 45 * 60000 }, db);
  return s;
}

teste('preparação: catálogo real e banco de teste novo (nome diferente do real)', async () => {
  catalogo = await carregarCatalogo();
  igual(NOME_TESTE === NOME_BANCO, false);
  await deleteDB(NOME_TESTE);
  db = await abrirBanco({ nome: NOME_TESTE });
  igual(await db.count('series'), 0);
});

teste('tela: sem nenhum treino, constância zerada e a mensagem amigável', async () => {
  const container = montarContainer();
  const limpeza = await renderEvolucao(container, {}, { db, catalogo, agora: AGORA });
  try {
    igual(container.querySelector('.evolucao-seguidas').textContent, '0 semanas seguidas');
    igual(container.querySelector('.evolucao-nesta-semana').textContent, '0 de 3 treinos nesta semana');
    igual(container.querySelectorAll('.evolucao-barra').length, 8);
    igual(container.querySelectorAll('.evolucao-barra.atual').length, 1);
    igual(container.querySelector('.evolucao-vazio').textContent, MENSAGEM_VAZIA);
    igual(container.querySelectorAll('.evolucao-recorde').length, 0);
    igual(container.querySelector('.evolucao-grafico'), null);
    igual(container.querySelector('.evolucao-legenda').textContent, 'treinos por semana · últimas 8');
  } finally {
    if (limpeza) limpeza();
    container.remove();
  }
});

teste('tela: com treinos reais, constância, 2 recordes, gráfico no mais treinado e últimos treinos com +N', async () => {
  await gravarMeta('rotinaAtualId', 'massa-4-casa', db);
  const a = await treino('A · Empurrar', dia(1, 0), [['flexao-no-chao', { reps: 10 }], ['flexao-no-chao', { reps: 10 }]]);
  await treino('B · Puxar', dia(1, 2), [['prancha-alta', { segundos: 40 }]]);
  const c = await treino('A · Empurrar', dia(0, 0), [['flexao-no-chao', { reps: 12 }], ['flexao-no-chao', { reps: 14 }]]);
  const container = montarContainer();
  const limpeza = await renderEvolucao(container, {}, { db, catalogo, agora: AGORA });
  try {
    igual(container.querySelector('.evolucao-seguidas').textContent, '0 semanas seguidas', 'semana passada: 2 de 4 dias');
    igual(container.querySelector('.evolucao-nesta-semana').textContent, '1 de 4 treinos nesta semana');
    igual([...container.querySelectorAll('.evolucao-barra')].slice(-2).map((b) => b.dataset.treinos), ['2', '1']);

    const cartoes = [...container.querySelectorAll('.evolucao-recorde')];
    igual(cartoes.map((r) => r.dataset.exercicio), ['flexao-no-chao', 'prancha-alta']);
    igual(cartoes[0].querySelector('.evolucao-recorde-valor').textContent, '14 reps');
    igual(cartoes[1].querySelector('.evolucao-recorde-valor').textContent, '0:40');
    igual(cartoes[0].querySelector('.evolucao-rotulo').textContent, 'Recorde');
    igual(cartoes[0].querySelector('.evolucao-recorde-nome').textContent, catalogo.exercicioPorId.get('flexao-no-chao').nome);

    igual(container.querySelector('.evolucao-grafico').dataset.exercicio, 'flexao-no-chao');
    igual(container.querySelector('.evolucao-ganho').textContent, '+4 reps');
    igual(container.querySelectorAll('.grafico-ponto').length, 2);

    const itens = [...container.querySelectorAll('.evolucao-treino')];
    igual(itens.length, 3);
    igual(itens[0].classList.contains('recente'), true);
    igual(itens[0].querySelector('a').getAttribute('href'), `#/evolucao/treino/${c.id}`);
    igual(itens[0].querySelector('.evolucao-pilula').textContent, '+2');
    igual(itens[0].querySelector('.evolucao-pilula').classList.contains('positivo'), true);
    igual(itens[2].querySelector('a').dataset.sessao, a.id);
    igual(itens[2].querySelector('.evolucao-pilula').textContent, '=');
    igual(itens[0].querySelector('.evolucao-treino-detalhe').textContent.endsWith('45 min · 2 séries'), true,
      itens[0].querySelector('.evolucao-treino-detalhe').textContent);
  } finally {
    if (limpeza) limpeza();
    container.remove();
  }
});

teste('tela: ▾ abre a escolha do exercício e escolher troca o gráfico', async () => {
  const container = montarContainer();
  const limpeza = await renderEvolucao(container, {}, { db, catalogo, agora: AGORA });
  try {
    container.querySelector('.evolucao-trocar').click();
    const opcao = document.querySelector('dialog .evolucao-escolha-item[data-exercicio="prancha-alta"]');
    igual(Boolean(opcao), true, 'o modal lista a prancha');
    opcao.click();
    igual(container.querySelector('.evolucao-grafico').dataset.exercicio, 'prancha-alta');
    igual(container.querySelector('.evolucao-ganho'), null, '1 treino só: sem ganho');
    igual(container.querySelectorAll('.grafico-ponto').length, 1);
  } finally {
    if (limpeza) limpeza();
    container.remove();
  }
  await new Promise((r) => setTimeout(r, 50)); // o dialog sai do DOM no evento close (assíncrono)
  igual(document.querySelector('dialog.modal'), null, 'nenhum modal sobrando');
});

teste('limpeza: apaga o banco de teste', async () => {
  db.close();
  await deleteDB(NOME_TESTE);
});
