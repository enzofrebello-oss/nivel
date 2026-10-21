// trilhas.test.js: testes da tela Trilhas (adiantada antes da etapa 16b) e das funções puras dela
// (js/logica/trilhas.js, PROJETO.md, seção 4.3):
// - conta do anel: pontuação da sessão (exemplo 3 × 12 com 12, 10, 8 = 83%), sem registro, acima da meta,
//   zero (meta inválida), limite em 100%, mais séries que a meta, tipo tempo;
// - "seu melhor": só séries reais de sessões concluídas, só do exercício certo (outros exercícios e
//   sessões em andamento ignorados), maior pontuação entre as sessões;
// - estado dos níveis no caminho (concluído, atual, bloqueado; conquista acima do atual; trilha concluída);
// - a tela montada com um banco de teste: chips (casa primeiro), "Nível N de M", anel e "seu melhor" com
//   séries gravadas pelo caminho do app, lembrar a trilha escolhida e abrir o "Como fazer".
// O banco é separado, 'nivel-teste-trilhas', apagado no começo e no fim; NUNCA o banco real 'nivel'.

import { teste, igual } from './mini-teste.js';
import { deleteDB } from '../vendor/idb/index.js';
import { abrirBanco, NOME_BANCO } from '../js/db/conexao.js';
import { carregarCatalogo } from '../js/catalogo.js';
import { lerMeta } from '../js/db/meta.js';
import { definirNivelAtual } from '../js/db/trilhas.js';
import { iniciarSessao, finalizarSessao } from '../js/db/sessoes.js';
import { adicionarSerie } from '../js/db/series.js';
import {
  valorDaSerie, pontuacaoDaSessao, seuMelhor, fracaoDoAnel, porcentagemDoAnel, textoSeuMelhor, caminhoDaTrilha,
} from '../js/logica/trilhas.js';
import { render as renderTrilhas, CHAVE_TRILHA_ESCOLHIDA } from '../js/telas/trilhas.js';

const NOME_TESTE = 'nivel-teste-trilhas';
let db = null;
let catalogo = null;

const META_REPS = { series: 3, reps: 12 };
const META_TEMPO = { series: 3, segundos: 45 };

const serie = (sessaoId, exercicioId, campos) => ({ id: `${sessaoId}-${Math.random()}`, sessaoId, exercicioId, tipo: 'corpo', grupos: [], feitaEm: 1, ...campos });
const sessao = (id, status = 'concluida', inicio = 1000) => ({ id, status, inicio });

// ---------- Conta do anel (funções puras) ----------

teste('anel: exemplo da seção 4.3, meta 3 × 12 com 12, 10 e 8 = 30/36 (83%)', () => {
  const r = pontuacaoDaSessao([serie('s', 'x', { reps: 12 }), serie('s', 'x', { reps: 10 }), serie('s', 'x', { reps: 8 })], META_REPS);
  igual(r.valores, [12, 10, 8]);
  igual(Math.abs(r.pontuacao - 30 / 36) < 1e-9, true, `pontuação ${r.pontuacao}`);
  igual(porcentagemDoAnel(r), 83);
});

teste('anel: sem registro = anel vazio (0) e "Sem registro ainda"', () => {
  igual(fracaoDoAnel(null), 0);
  igual(porcentagemDoAnel(null), 0);
  igual(pontuacaoDaSessao([], META_REPS), null);
  igual(textoSeuMelhor(null, META_REPS), 'Sem registro ainda');
});

teste('anel: acima da meta conta só até a meta e para em 100%', () => {
  const r = pontuacaoDaSessao([serie('s', 'x', { reps: 30 }), serie('s', 'x', { reps: 20 }), serie('s', 'x', { reps: 15 })], META_REPS);
  igual(r.pontuacao, 1);
  igual(fracaoDoAnel(r), 1);
  igual(porcentagemDoAnel(r), 100);
  igual(textoSeuMelhor(r, META_REPS), '30 · 20 · 15', '"seu melhor" mostra o que foi feito de verdade');
});

teste('anel: fração fora de 0 a 1 é limitada (nunca passa de 100% nem fica negativa)', () => {
  igual(fracaoDoAnel({ pontuacao: 1.7 }), 1);
  igual(fracaoDoAnel({ pontuacao: -0.2 }), 0);
  igual(fracaoDoAnel({ pontuacao: NaN }), 0);
  igual(porcentagemDoAnel({ pontuacao: 0.999 }), 99, 'só mostra 100% com a meta batida');
});

teste('anel: zero (meta com 0 séries ou alvo 0) dá 0, sem dividir por zero', () => {
  const s = [serie('s', 'x', { reps: 10 })];
  igual(pontuacaoDaSessao(s, { series: 0, reps: 12 }).pontuacao, 0);
  igual(pontuacaoDaSessao(s, { series: 3, reps: 0 }).pontuacao, 0);
  igual(fracaoDoAnel(pontuacaoDaSessao(s, { series: 3, reps: 0 })), 0);
});

teste('anel: série com valor zero, ausente ou inválido não conta (só uma série boa = 1/3 de 12)', () => {
  const r = pontuacaoDaSessao([serie('s', 'x', { reps: 0 }), serie('s', 'x', {}), serie('s', 'x', { reps: 'dez' }), serie('s', 'x', { reps: 12 })], META_REPS);
  igual(r.valores, [12]);
  igual(Math.abs(r.pontuacao - 12 / 36) < 1e-9, true);
  igual(valorDaSerie(serie('s', 'x', { reps: -3 }), META_REPS), null);
});

teste('anel: mais séries que a meta contam só as melhores', () => {
  const r = pontuacaoDaSessao([8, 12, 6, 11, 9].map((reps) => serie('s', 'x', { reps })), META_REPS);
  igual(r.valores, [12, 11, 9]);
  igual(Math.abs(r.pontuacao - 32 / 36) < 1e-9, true);
});

teste('anel: tipo tempo usa os segundos e "seu melhor" sai em m:ss', () => {
  const r = pontuacaoDaSessao([serie('s', 'x', { tipo: 'tempo', segundos: 45 }), serie('s', 'x', { tipo: 'tempo', segundos: 30 }), serie('s', 'x', { tipo: 'tempo', segundos: 60 })], META_TEMPO);
  igual(Math.abs(r.pontuacao - (45 + 30 + 45) / 135) < 1e-9, true);
  igual(textoSeuMelhor(r, META_TEMPO), '1:00 · 0:45 · 0:30');
});

teste('anel: em carga só as reps contam', () => {
  const r = pontuacaoDaSessao([serie('s', 'x', { tipo: 'carga', carga: 200, reps: 6 })], META_REPS);
  igual(r.valores, [6]);
});

// ---------- Seu melhor (funções puras) ----------

teste('seu melhor: a sessão concluída de maior pontuação, com as séries dela', () => {
  const sessoes = [sessao('a', 'concluida', 1000), sessao('b', 'concluida', 2000)];
  const series = [
    serie('a', 'x', { reps: 12 }), serie('a', 'x', { reps: 12 }), serie('a', 'x', { reps: 10 }),
    serie('b', 'x', { reps: 10 }), serie('b', 'x', { reps: 9 }), serie('b', 'x', { reps: 8 }),
  ];
  const m = seuMelhor({ exercicioId: 'x', meta: META_REPS, series, sessoes });
  igual(m.sessaoId, 'a');
  igual(m.valores, [12, 12, 10]);
  igual(textoSeuMelhor(m, META_REPS), '12 · 12 · 10');
});

teste('seu melhor: ignora séries de outros exercícios', () => {
  const sessoes = [sessao('a')];
  const series = [serie('a', 'outro', { reps: 50 }), serie('a', 'outro', { reps: 50 }), serie('a', 'x', { reps: 6 })];
  const m = seuMelhor({ exercicioId: 'x', meta: META_REPS, series, sessoes });
  igual(m.valores, [6]);
  igual(seuMelhor({ exercicioId: 'nenhum', meta: META_REPS, series, sessoes }), null);
});

teste('seu melhor: só séries reais de sessões concluídas (em andamento e sessão inexistente ficam fora)', () => {
  const sessoes = [sessao('feita'), sessao('agora', 'andamento', 5000)];
  const series = [
    serie('agora', 'x', { reps: 12 }), serie('agora', 'x', { reps: 12 }), serie('agora', 'x', { reps: 12 }),
    serie('sumiu', 'x', { reps: 12 }),
    serie('feita', 'x', { reps: 7 }),
  ];
  const m = seuMelhor({ exercicioId: 'x', meta: META_REPS, series, sessoes });
  igual(m.sessaoId, 'feita');
  igual(m.valores, [7]);
  igual(seuMelhor({ exercicioId: 'x', meta: META_REPS, series: [], sessoes }), null, 'sem séries = sem registro');
  igual(seuMelhor({ exercicioId: 'x', meta: META_REPS, series, sessoes: [] }), null, 'sem sessões concluídas = sem registro');
});

teste('seu melhor: empate na pontuação fica com a maior soma real, depois a mais recente', () => {
  const sessoes = [sessao('a', 'concluida', 1000), sessao('b', 'concluida', 2000), sessao('c', 'concluida', 3000)];
  const series = [
    ...[15, 12, 12].map((reps) => serie('a', 'x', { reps })),
    ...[12, 12, 12].map((reps) => serie('b', 'x', { reps })),
    ...[12, 12, 12].map((reps) => serie('c', 'x', { reps })),
  ];
  igual(seuMelhor({ exercicioId: 'x', meta: META_REPS, series, sessoes }).sessaoId, 'a');
  igual(seuMelhor({ exercicioId: 'x', meta: META_REPS, series: series.slice(3), sessoes }).sessaoId, 'c');
});

// ---------- Estado dos níveis no caminho ----------

teste('preparação: catálogo real', async () => {
  catalogo = await carregarCatalogo();
  igual(catalogo.trilhaPorId.has('flexoes'), true);
});

teste('caminho: sem registro, nível 1 atual e os outros bloqueados', () => {
  const c = caminhoDaTrilha(catalogo.trilhaPorId.get('flexoes'), undefined);
  igual(c.atual, 1);
  igual(c.total, 6);
  igual(c.concluidos, 0);
  igual(c.niveis.map((n) => n.estado), ['atual', 'bloqueado', 'bloqueado', 'bloqueado', 'bloqueado', 'bloqueado']);
});

teste('caminho: nível 3 atual, 1 e 2 concluídos; conquista acima do atual guardada com ✓', () => {
  const t = catalogo.trilhaPorId.get('flexoes');
  const registro = {
    trilhaId: 'flexoes',
    exercicioAtualId: 'flexao-no-chao',
    concluidos: ['flexao-na-parede', 'flexao-inclinada-mesa', 'flexao-diamante'].map((exercicioId) => ({ exercicioId, em: 1, como: 'manual' })),
    atualizadoEm: 1,
  };
  const c = caminhoDaTrilha(t, registro);
  igual(c.atual, 3);
  igual(c.concluidos, 3);
  igual(c.niveis.map((n) => n.estado), ['concluido', 'concluido', 'atual', 'bloqueado', 'concluido', 'bloqueado']);
});

teste('caminho: trilha concluída não tem atual e todos ficam concluídos', () => {
  const t = catalogo.trilhaPorId.get('core-prancha');
  const c = caminhoDaTrilha(t, { trilhaId: t.id, exercicioAtualId: null, concluidos: [], atualizadoEm: 1 });
  igual(c.concluida, true);
  igual(c.atual, null);
  igual(c.niveis.every((n) => n.estado === 'concluido'), true);
});

// ---------- Tela com banco de teste ----------

async function esperar(raiz, seletor, condicao = () => true) {
  for (let i = 0; i < 100; i++) {
    const el = raiz.querySelector(seletor);
    if (el && condicao(el)) return el;
    await new Promise((r) => setTimeout(r, 20));
  }
  return raiz.querySelector(seletor);
}

function montarContainer() {
  const container = document.createElement('div');
  container.hidden = true;
  document.body.append(container);
  return container;
}

// Treino concluído com séries do exercício, pelo mesmo caminho do app (iniciar, registrar, finalizar).
async function treinoComSeries(exercicioId, reps, inicio) {
  const exercicio = catalogo.exercicioPorId.get(exercicioId);
  const { sessao: s } = await iniciarSessao({
    rotinaId: null, diaId: null, nome: 'Teste', local: 'casa', versaoDados: catalogo.versaoDados,
    itens: [{ exercicioId, trilhaId: 'flexoes', series: 3, alvo: '15', descanso: 60 }],
  }, { agora: inicio }, db);
  for (const [i, r] of reps.entries()) {
    await adicionarSerie({ sessaoId: s.id, exercicio, medidas: { reps: r } }, { agora: inicio + (i + 1) * 1000 }, db);
  }
  await finalizarSessao(s.id, { agora: inicio + 60000 }, db);
  return s;
}

teste('banco de teste: o nome não é o do banco real', () => {
  igual(NOME_TESTE === NOME_BANCO, false);
});

teste('preparação: banco de teste novo', async () => {
  await deleteDB(NOME_TESTE);
  db = await abrirBanco({ nome: NOME_TESTE });
  igual(await db.count('series'), 0);
});

teste('tela: chips com as 15 trilhas (casa primeiro), Flexões escolhida, nível 1, anel vazio e "Sem registro ainda"', async () => {
  const container = montarContainer();
  const limpeza = await renderTrilhas(container, {}, { db, catalogo });
  try {
    const chips = [...container.querySelectorAll('.trilhas-chips .chip')];
    igual(chips.length, 15);
    igual(chips[0].dataset.trilha, 'flexoes');
    igual(chips.slice(-2).map((c) => c.dataset.trilha), ['barra-fixa', 'paralelas']);
    igual(container.querySelector('.chip[aria-pressed="true"]').dataset.trilha, 'flexoes');
    igual(container.querySelector('.trilha-resumo').textContent, 'Nível 1 de 6 · 0 concluídos');
    igual(container.querySelector('.trilha-nivel.atual').dataset.exercicio, 'flexao-na-parede');
    igual(container.querySelector('.trilha-melhor').textContent, 'Sem registro ainda');
    igual(container.querySelector('.trilha-anel-texto').textContent, '—');
    igual(container.querySelector('.trilha-anel .anel-traco').getAttribute('stroke-dashoffset'),
      container.querySelector('.trilha-anel .anel-traco').getAttribute('stroke-dasharray'), 'anel vazio');
    igual(container.querySelectorAll('.trilha-nivel.bloqueado').length, 5);
    igual(container.querySelector('.trilha-caminho li:first-child').dataset.exercicio, 'flexao-arqueiro', 'último nível em cima');
  } finally {
    if (limpeza) limpeza();
    container.remove();
  }
});

teste('tela: com séries reais do nível atual, anel parcial e "seu melhor" da melhor sessão; outro exercício não entra', async () => {
  await definirNivelAtual(catalogo.trilhaPorId.get('flexoes'), 'flexao-no-chao', {}, db); // meta 3 × 15
  await treinoComSeries('flexao-no-chao', [10, 9, 8], 1_000_000);
  await treinoComSeries('flexao-no-chao', [12, 11, 10], 2_000_000);
  await treinoComSeries('flexao-diamante', [15, 15, 15], 3_000_000);
  const container = montarContainer();
  const limpeza = await renderTrilhas(container, {}, { db, catalogo });
  try {
    igual(container.querySelector('.trilha-resumo').textContent, 'Nível 3 de 6 · 2 concluídos');
    igual(container.querySelector('.trilha-melhor').textContent, '12 · 11 · 10');
    igual(container.querySelector('.trilha-anel-texto').textContent, '73%', '33/45');
    igual(container.querySelectorAll('.trilha-nivel.concluido').length, 2);
  } finally {
    if (limpeza) limpeza();
    container.remove();
  }
});

teste('tela: escolher outra trilha nos chips troca o caminho e fica lembrada ao abrir de novo', async () => {
  const container = montarContainer();
  const limpeza = await renderTrilhas(container, {}, { db, catalogo });
  try {
    container.querySelector('.chip[data-trilha="core-prancha"]').click();
    await esperar(container, '.trilha-titulo', (el) => el.textContent === catalogo.trilhaPorId.get('core-prancha').nome);
    igual(container.querySelector('.chip[aria-pressed="true"]').dataset.trilha, 'core-prancha');
    igual(container.querySelector('.trilha-resumo').textContent, 'Nível 1 de 3 · 0 concluídos');
  } finally {
    if (limpeza) limpeza();
    container.remove();
  }
  for (let i = 0; i < 50 && (await lerMeta(CHAVE_TRILHA_ESCOLHIDA, db)) !== 'core-prancha'; i++) {
    await new Promise((r) => setTimeout(r, 20));
  }
  igual(await lerMeta(CHAVE_TRILHA_ESCOLHIDA, db), 'core-prancha');
  const outra = montarContainer();
  const limpeza2 = await renderTrilhas(outra, {}, { db, catalogo });
  try {
    igual(outra.querySelector('.chip[aria-pressed="true"]').dataset.trilha, 'core-prancha');
  } finally {
    if (limpeza2) limpeza2();
    outra.remove();
  }
});

teste('tela: #/trilhas/:id abre aquela trilha; id inexistente cai na lembrada', async () => {
  const a = montarContainer();
  const l1 = await renderTrilhas(a, { id: 'flexoes' }, { db, catalogo });
  try {
    igual(a.querySelector('.chip[aria-pressed="true"]').dataset.trilha, 'flexoes');
  } finally {
    if (l1) l1();
    a.remove();
  }
  const b = montarContainer();
  const l2 = await renderTrilhas(b, { id: 'nao-existe' }, { db, catalogo });
  try {
    igual(Boolean(b.querySelector('.chip[aria-pressed="true"]')), true);
    igual(b.querySelectorAll('.trilha-nivel').length > 0, true);
  } finally {
    if (l2) l2();
    b.remove();
  }
});

teste('tela: tocar num nível abre o "Como fazer" do exercício', async () => {
  const container = montarContainer();
  const limpeza = await renderTrilhas(container, { id: 'flexoes' }, { db, catalogo });
  try {
    container.querySelector('.trilha-nivel[data-exercicio="flexao-diamante"] button').click();
    const modal = document.querySelector('dialog.modal');
    igual(Boolean(modal), true, 'modal aberto');
    igual(modal.querySelector('.modal-titulo').textContent, 'Flexão diamante');
    igual(Boolean(modal.querySelector('.como-fazer')), true);
    igual(modal.querySelectorAll('.como-fazer-passos li').length, 3);
  } finally {
    if (limpeza) limpeza();
    container.remove();
  }
  // O dialog sai do DOM no evento close, que chega logo depois do close().
  for (let i = 0; i < 50 && document.querySelector('dialog.modal'); i++) await new Promise((r) => setTimeout(r, 20));
  igual(Boolean(document.querySelector('dialog.modal')), false, 'a limpeza da tela fecha o modal');
});

// ---------- Limpeza ----------

teste('banco de teste: é apagado no fim', async () => {
  if (db) db.close();
  db = null;
  await deleteDB(NOME_TESTE);
  const bancos = indexedDB.databases ? await indexedDB.databases() : [];
  igual(bancos.some((b) => b.name === NOME_TESTE), false);
});
