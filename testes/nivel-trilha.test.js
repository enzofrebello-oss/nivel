// nivel-trilha.test.js: testes do nível de cada trilha (PROJETO.md, etapa 15b): escolher o nível atual de
// uma trilha (db/trilhas.js, registroComNivel e definirNivelAtual), trocar de volta para um nível mais fácil
// (sem apagar os concluídos de cima; ✓ nos níveis concluídos em Ajustes),
// persistir no banco, aparecer no card do treino do dia (Hoje) e na tela Treino, e entrar no backup.
// No fim, as telas Ajustes, Hoje e Treino montadas com o banco de teste.
// O banco é separado, 'nivel-teste-nivel', apagado no começo e no fim; NUNCA o banco real 'nivel'.

import { teste, igual, lanca } from './mini-teste.js';
import { deleteDB } from '../vendor/idb/index.js';
import { abrirBanco, NOME_BANCO } from '../js/db/conexao.js';
import { carregarCatalogo } from '../js/catalogo.js';
import { gravarMeta } from '../js/db/meta.js';
import { lerProgressoTrilhas, registroComNivel, definirNivelAtual } from '../js/db/trilhas.js';
import { iniciarSessao, obterSessao } from '../js/db/sessoes.js';
import { exportarBackup, backupParaTexto, lerBackup, importarBackup } from '../js/db/backup.js';
import {
  trilhasParaAjuste, textoNivel, textoMeta, trilhaDeCasa, treinoDoDia, textoTrilhaDoItem,
} from '../js/logica/rotina.js';
import { render as renderAjustes } from '../js/telas/ajustes.js';
import { render as renderHoje } from '../js/telas/hoje.js';
import { render as renderTreino } from '../js/telas/treino.js';

const NOME_TESTE = 'nivel-teste-nivel';
const NOME_RESTAURADO = `${NOME_TESTE}-restaurado`;
let db = null;
let catalogo = null;

async function apagarBancoDeTeste() {
  if (db) db.close();
  db = null;
  await deleteDB(NOME_TESTE);
  await deleteDB(NOME_RESTAURADO);
}

async function reabrir() {
  if (db) db.close();
  db = await abrirBanco({ nome: NOME_TESTE });
  return db;
}

// Espera até achar o seletor em raiz (ou desiste em ~2 s).
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

const flexoes = () => catalogo.trilhaPorId.get('flexoes');
const nomeDe = (id) => catalogo.exercicioPorId.get(id).nome;

// ---------- Preparação ----------

teste('banco de teste: o nome não é o do banco real', () => {
  igual(NOME_BANCO, 'nivel');
  if (NOME_TESTE === NOME_BANCO) throw new Error('o teste usaria o banco real');
});

teste('preparação: catálogo real e banco de teste novo, sem registros de trilhas', async () => {
  catalogo = await carregarCatalogo();
  await apagarBancoDeTeste();
  await reabrir();
  igual(db.name, NOME_TESTE);
  igual(await db.count('trilhas'), 0);
});

// ---------- Lista das trilhas (lógica do cartão) ----------

teste('lista: as 15 trilhas, as de casa primeiro (barra fixa e paralelas no fim)', () => {
  const linhas = trilhasParaAjuste(catalogo, new Map());
  igual(linhas.length, 15);
  igual(new Set(linhas.map((l) => l.trilha.id)).size, 15, 'nenhuma repetida');
  igual(linhas.slice(-2).map((l) => l.trilha.id), ['barra-fixa', 'paralelas']);
  igual(linhas.slice(0, 13).every((l) => l.deCasa), true, 'as 13 primeiras são de casa');
  igual(linhas.slice(13).some((l) => l.deCasa), false);
  igual(trilhaDeCasa(catalogo.trilhaPorId.get('barra-fixa'), catalogo), false);
});

teste('lista: sem registro, cada trilha está no nível 1 ("Nível 1 de 6 · Flexão na parede")', () => {
  const linhas = trilhasParaAjuste(catalogo, new Map());
  igual(linhas.every((l) => l.nivel.posicao === 1 && !l.concluida), true);
  const linha = linhas.find((l) => l.trilha.id === 'flexoes');
  igual(`${linha.trilha.nome} · ${textoNivel(linha, catalogo)}`, 'Flexões · Nível 1 de 6 · Flexão na parede');
});

teste('lista: trilha concluída mostra o último nível com "concluída"', () => {
  const progresso = new Map([['flexoes', { trilhaId: 'flexoes', exercicioAtualId: null, concluidos: [], atualizadoEm: 1 }]]);
  const linha = trilhasParaAjuste(catalogo, progresso).find((l) => l.trilha.id === 'flexoes');
  igual(textoNivel(linha, catalogo), 'Nível 6 de 6 · Flexão arqueiro · concluída');
});

teste('meta do nível: "3 × 20" (reps) e "3 × 1:00" (segundos)', () => {
  igual(textoMeta({ series: 3, reps: 20 }), '3 × 20');
  igual(textoMeta({ series: 3, segundos: 60 }), '3 × 1:00');
  igual(textoMeta({ series: 2, segundos: 45 }), '2 × 0:45');
});

// ---------- Escolher nível (função pura) ----------

teste('escolher: nível 3 sem registro = atual flexao-no-chao, níveis 1 e 2 como "manual"', () => {
  const r = registroComNivel(flexoes(), undefined, 'flexao-no-chao', 1000);
  igual(r, {
    trilhaId: 'flexoes',
    exercicioAtualId: 'flexao-no-chao',
    concluidos: [
      { exercicioId: 'flexao-na-parede', em: 1000, como: 'manual' },
      { exercicioId: 'flexao-inclinada-mesa', em: 1000, como: 'manual' },
    ],
    atualizadoEm: 1000,
  });
});

teste('escolher: os níveis anteriores já concluídos mantêm data e "como" (meta)', () => {
  const antes = {
    trilhaId: 'flexoes', exercicioAtualId: 'flexao-inclinada-mesa',
    concluidos: [{ exercicioId: 'flexao-na-parede', em: 5, como: 'meta' }], atualizadoEm: 5,
  };
  const r = registroComNivel(flexoes(), antes, 'flexao-pes-elevados-cadeira', 9);
  igual(r.concluidos, [
    { exercicioId: 'flexao-na-parede', em: 5, como: 'meta' },
    { exercicioId: 'flexao-inclinada-mesa', em: 9, como: 'manual' },
    { exercicioId: 'flexao-no-chao', em: 9, como: 'manual' },
  ]);
});

teste('trocar de volta: nível mais fácil muda só o atual e mantém os concluídos de cima (data e "como")', () => {
  const nivel4 = registroComNivel(flexoes(), undefined, 'flexao-pes-elevados-cadeira', 1);
  // Como se o nível 3 tivesse sido batido pela meta.
  nivel4.concluidos[2] = { exercicioId: 'flexao-no-chao', em: 7, como: 'meta' };
  const nivel2 = registroComNivel(flexoes(), nivel4, 'flexao-inclinada-mesa', 2);
  igual(nivel2.exercicioAtualId, 'flexao-inclinada-mesa');
  igual(nivel2.concluidos, nivel4.concluidos, 'concluídos iguais (1, 2 e 3), inclusive os acima do atual');
  const nivel1 = registroComNivel(flexoes(), nivel2, 'flexao-na-parede', 3);
  igual(nivel1.exercicioAtualId, 'flexao-na-parede');
  igual(nivel1.concluidos, nivel4.concluidos, 'nenhuma conquista apagada');
  igual(nivel1.atualizadoEm, 3);
});

teste('subir de novo: os de baixo que faltam entram como "manual" e os de cima continuam', () => {
  const registro = {
    trilhaId: 'flexoes', exercicioAtualId: 'flexao-na-parede',
    concluidos: [
      { exercicioId: 'flexao-no-chao', em: 5, como: 'meta' },
      { exercicioId: 'flexao-arqueiro', em: 6, como: 'manual' },
    ],
    atualizadoEm: 6,
  };
  const r = registroComNivel(flexoes(), registro, 'flexao-diamante', 9);
  igual(r.exercicioAtualId, 'flexao-diamante');
  igual(r.concluidos, [
    { exercicioId: 'flexao-na-parede', em: 9, como: 'manual' },
    { exercicioId: 'flexao-inclinada-mesa', em: 9, como: 'manual' },
    { exercicioId: 'flexao-no-chao', em: 5, como: 'meta' },
    { exercicioId: 'flexao-pes-elevados-cadeira', em: 9, como: 'manual' },
    { exercicioId: 'flexao-arqueiro', em: 6, como: 'manual' },
  ]);
});

teste('concluídos acima do atual: o treino do dia segue o nível atual', () => {
  const registro = {
    trilhaId: 'flexoes', exercicioAtualId: 'flexao-na-parede',
    concluidos: [{ exercicioId: 'flexao-no-chao', em: 5, como: 'meta' }], atualizadoEm: 5,
  };
  const linha = trilhasParaAjuste(catalogo, new Map([['flexoes', registro]])).find((l) => l.trilha.id === 'flexoes');
  igual(textoNivel(linha, catalogo), 'Nível 1 de 6 · Flexão na parede');
  igual([...linha.concluidos], ['flexao-no-chao']);
  const { itens } = treinoDoDia(catalogo.rotinaPorId.get('massa-3-casa'), [], catalogo, new Map([['flexoes', registro]]));
  igual(itens[0].exercicioId, 'flexao-na-parede');
});

teste('escolher: trilha concluída (exercicioAtualId null) volta a ter nível atual', () => {
  const concluida = { trilhaId: 'flexoes', exercicioAtualId: null, concluidos: [], atualizadoEm: 1 };
  igual(registroComNivel(flexoes(), concluida, 'flexao-inclinada-mesa', 2).exercicioAtualId, 'flexao-inclinada-mesa');
});

teste('escolher: exercício que não é nível da trilha é recusado', () => {
  lanca(() => registroComNivel(flexoes(), undefined, 'prancha-alta', 1));
  lanca(() => registroComNivel(flexoes(), undefined, 'nao-existe', 1));
});

// ---------- Banco ----------

teste('banco: escolher o nível 3 grava o registro e lerProgressoTrilhas o devolve', async () => {
  const gravado = await definirNivelAtual(flexoes(), 'flexao-no-chao', { agora: 2000 }, db);
  igual(await db.get('trilhas', 'flexoes'), gravado);
  igual(gravado.exercicioAtualId, 'flexao-no-chao');
  const progresso = await lerProgressoTrilhas(db);
  igual(progresso.get('flexoes').exercicioAtualId, 'flexao-no-chao');
  const linha = trilhasParaAjuste(catalogo, progresso).find((l) => l.trilha.id === 'flexoes');
  igual(textoNivel(linha, catalogo), 'Nível 3 de 6 · Flexão no chão');
});

teste('banco: fechar e reabrir mantém o nível escolhido', async () => {
  await reabrir();
  igual((await db.get('trilhas', 'flexoes')).exercicioAtualId, 'flexao-no-chao');
});

teste('banco: trocar de volta para o nível 1 e depois para o 5 grava cada troca', async () => {
  await definirNivelAtual(flexoes(), 'flexao-na-parede', { agora: 3000 }, db);
  let r = await db.get('trilhas', 'flexoes');
  igual(r.exercicioAtualId, 'flexao-na-parede');
  igual(r.concluidos.map((c) => c.exercicioId), ['flexao-na-parede', 'flexao-inclinada-mesa'], 'os concluídos de cima ficam');
  igual(r.concluidos.every((c) => c.em === 2000), true, 'com a data de antes');
  await definirNivelAtual(flexoes(), 'flexao-diamante', { agora: 4000 }, db);
  r = await db.get('trilhas', 'flexoes');
  igual(r.exercicioAtualId, 'flexao-diamante');
  igual(r.concluidos.length, 4);
  igual(r.atualizadoEm, 4000);
});

teste('banco: exercício fora da trilha é recusado sem mudar nada', async () => {
  const antes = await db.get('trilhas', 'flexoes');
  let erro = null;
  try {
    await definirNivelAtual(flexoes(), 'prancha-alta', {}, db);
  } catch (e) {
    erro = e;
  }
  igual(Boolean(erro), true, 'recusou');
  igual(await db.get('trilhas', 'flexoes'), antes);
  igual(await db.count('trilhas'), 1);
});

// ---------- Treino do dia ----------

teste('treino do dia: o item da trilha usa o nível escolhido (exercício e meta)', async () => {
  await definirNivelAtual(flexoes(), 'flexao-no-chao', {}, db);
  const rotina = catalogo.rotinaPorId.get('massa-3-casa');
  const { itens } = treinoDoDia(rotina, [], catalogo, await lerProgressoTrilhas(db));
  igual(itens[0], { exercicioId: 'flexao-no-chao', trilhaId: 'flexoes', series: 4, alvo: '15', descanso: 90 });
  igual(textoTrilhaDoItem(itens[0], catalogo), 'Trilha Flexões · nível\u00A03\u00A0de\u00A06');
  igual(textoTrilhaDoItem(itens[2], catalogo), null, 'exercício fixo não tem trilha');
});

// ---------- Telas ----------

teste('tela Ajustes: cartão com as 15 trilhas (Casa primeiro) e o nível atual de cada uma', async () => {
  const container = montarContainer();
  const limpeza = await renderAjustes(container, {}, { db, catalogo });
  try {
    const cartao = container.querySelector('.niveis');
    igual(cartao.querySelector('.cartao-titulo').textContent, 'Nível de cada trilha');
    const botoes = [...cartao.querySelectorAll('.niveis-trilha')];
    igual(botoes.length, 15);
    igual([...cartao.querySelectorAll('.niveis-grupo-nome')].map((e) => e.textContent), ['Casa', 'Academia']);
    igual(botoes.slice(-2).map((b) => b.dataset.trilha), ['barra-fixa', 'paralelas']);
    const flex = cartao.querySelector('[data-trilha="flexoes"]');
    igual(flex.querySelector('.niveis-trilha-nome').textContent, 'Flexões');
    igual(flex.querySelector('.niveis-trilha-nivel').textContent, 'Nível 3 de 6 · Flexão no chão');
    igual(cartao.querySelector('[data-trilha="paralelas"] .niveis-trilha-nivel').textContent.startsWith('Nível 1 de 3 · '), true);
  } finally {
    if (limpeza) limpeza();
    container.remove();
  }
});

teste('tela Ajustes: tocar na trilha lista os níveis com exercício e meta; escolher troca o nível atual', async () => {
  const container = montarContainer();
  const limpeza = await renderAjustes(container, {}, { db, catalogo });
  try {
    container.querySelector('[data-trilha="flexoes"]').click();
    const modal = document.querySelector('dialog.modal');
    igual(Boolean(modal), true, 'abriu o modal');
    igual(modal.querySelector('.modal-titulo').textContent, 'Flexões');
    const opcoes = [...modal.querySelectorAll('.niveis-opcao')];
    igual(opcoes.length, 6);
    igual(opcoes[0].querySelector('.niveis-opcao-nome').childNodes[0].textContent, '1. Flexão na parede');
    igual(opcoes[0].querySelector('.niveis-opcao-meta').textContent, 'Meta 3 × 20');
    igual(opcoes.map((o) => o.getAttribute('aria-pressed')), ['false', 'false', 'true', 'false', 'false', 'false'], 'nível 3 é o atual');
    igual(Boolean(modal.querySelector('.niveis-aviso')), false, 'sem treino em andamento, sem aviso');
    const marcas = () => [...document.querySelectorAll('dialog.modal .niveis-opcao')].map((o) => Boolean(o.querySelector('.niveis-feito')));
    igual(marcas(), [true, true, true, true, false, false], '✓ nos níveis 1 a 4');
    igual(opcoes[0].querySelector('.niveis-feito').textContent, ' ✓');

    // Escolher um nível mais fácil (o 2): os concluídos de cima continuam.
    opcoes[1].click();
    const nivel = await esperar(container, '[data-trilha="flexoes"] .niveis-trilha-nivel', (el) => el.textContent.startsWith('Nível 2'));
    igual(nivel.textContent, 'Nível 2 de 6 · Flexão inclinada na mesa');
    igual(document.querySelector('dialog.modal'), null, 'modal fechou');
    const r = await db.get('trilhas', 'flexoes');
    igual(r.exercicioAtualId, 'flexao-inclinada-mesa');
    igual(r.concluidos.length, 4, 'nenhum concluído apagado');

    // Reabrir: ✓ também nos níveis 3 e 4, acima do atual.
    container.querySelector('[data-trilha="flexoes"]').click();
    igual(marcas(), [true, true, true, true, false, false], '✓ inclusive acima do atual');
    igual([...document.querySelectorAll('dialog.modal .niveis-opcao')].map((o) => o.getAttribute('aria-pressed')),
      ['false', 'true', 'false', 'false', 'false', 'false'], 'nível 2 é o atual');

    // Trocar de novo, para o nível 4.
    document.querySelector('dialog.modal [data-exercicio="flexao-pes-elevados-cadeira"]').click();
    await esperar(container, '[data-trilha="flexoes"] .niveis-trilha-nivel', (el) => el.textContent.startsWith('Nível 4'));
    igual((await db.get('trilhas', 'flexoes')).exercicioAtualId, 'flexao-pes-elevados-cadeira');
  } finally {
    if (limpeza) limpeza();
    container.remove();
    document.querySelectorAll('.toast').forEach((t) => t.remove());
  }
});

teste('tela Hoje: o card do treino do dia mostra o exercício do nível escolhido', async () => {
  await gravarMeta('rotinaAtualId', 'massa-3-casa', db);
  await definirNivelAtual(flexoes(), 'flexao-no-chao', {}, db);
  const container = montarContainer();
  const limpeza = await renderHoje(container, {}, { db, catalogo });
  try {
    const item = container.querySelector('.hoje-treino .hoje-item');
    igual(Boolean(item), true, 'card do treino do dia');
    igual(item.querySelector('.hoje-item-nome').textContent, 'Flexão no chão');
    igual(item.querySelector('.hoje-item-trilha').textContent, 'Trilha Flexões · nível\u00A03\u00A0de\u00A06');
    igual(item.querySelector('.hoje-item-alvo').textContent, '4 × 15');
  } finally {
    if (limpeza) limpeza();
    container.remove();
  }
  // Trocar de volta para o nível 1 muda o card no próximo desenho.
  await definirNivelAtual(flexoes(), 'flexao-na-parede', {}, db);
  const outro = montarContainer();
  const limpeza2 = await renderHoje(outro, {}, { db, catalogo });
  try {
    igual(outro.querySelector('.hoje-treino .hoje-item-nome').textContent, nomeDe('flexao-na-parede'));
    igual(outro.querySelector('.hoje-treino .hoje-item-alvo').textContent, '4 × 20');
  } finally {
    if (limpeza2) limpeza2();
    outro.remove();
  }
});

teste('tela Treino: o treino começado usa o nível escolhido; trocar depois não muda o treino em andamento', async () => {
  await definirNivelAtual(flexoes(), 'flexao-diamante', {}, db);
  const rotina = catalogo.rotinaPorId.get('massa-3-casa');
  const treino = treinoDoDia(rotina, [], catalogo, await lerProgressoTrilhas(db));
  const { sessao } = await iniciarSessao({
    rotinaId: rotina.id, diaId: treino.dia.id, nome: treino.dia.nome, local: rotina.local,
    itens: treino.itens, versaoDados: catalogo.versaoDados,
  }, {}, db);
  igual(sessao.itens[0].exercicioId, 'flexao-diamante');
  igual(sessao.itens[0].alvo, '12');

  const container = montarContainer();
  const limpeza = await renderTreino(container, { id: sessao.id }, { db, catalogo });
  try {
    igual(container.querySelector('.treino-exercicio-nome').textContent, 'Flexão diamante');
    igual(container.querySelector('.treino-exercicio-trilha').textContent, 'Trilha Flexões · nível\u00A05\u00A0de\u00A06');
  } finally {
    if (limpeza) limpeza();
    container.remove();
  }

  // Com o treino em andamento, o modal avisa, e a troca não mexe nos itens da sessão.
  const ajustes = montarContainer();
  const limpezaAjustes = await renderAjustes(ajustes, {}, { db, catalogo });
  try {
    ajustes.querySelector('[data-trilha="flexoes"]').click();
    igual(Boolean(document.querySelector('dialog.modal .niveis-aviso')), true, 'aviso do treino em andamento');
    document.querySelector('dialog.modal [data-exercicio="flexao-no-chao"]').click();
    await esperar(ajustes, '[data-trilha="flexoes"] .niveis-trilha-nivel', (el) => el.textContent.startsWith('Nível 3'));
  } finally {
    if (limpezaAjustes) limpezaAjustes();
    ajustes.remove();
    document.querySelectorAll('.toast').forEach((t) => t.remove());
  }
  igual((await db.get('trilhas', 'flexoes')).exercicioAtualId, 'flexao-no-chao');
  igual((await obterSessao(sessao.id, db)).itens[0].exercicioId, 'flexao-diamante', 'sessão em andamento igual');
});

// ---------- Backup ----------

teste('backup: o nível escolhido entra no backup, passa na validação e volta igual ao importar', async () => {
  await definirNivelAtual(catalogo.trilhaPorId.get('core-prancha'), catalogo.trilhaPorId.get('core-prancha').niveis[1].exercicio, {}, db);
  const registros = await db.getAll('trilhas');
  const backup = await exportarBackup({ versaoDados: catalogo.versaoDados }, db);
  igual(backup.dados.trilhas, registros);
  igual(backup.dados.trilhas.find((t) => t.trilhaId === 'flexoes').exercicioAtualId, 'flexao-no-chao');

  const lido = lerBackup(backupParaTexto(backup), catalogo);
  igual(lido.ok, true, lido.erros ? lido.erros.join('; ') : '');

  const restaurado = await abrirBanco({ nome: NOME_RESTAURADO });
  try {
    await importarBackup(lido.backup, catalogo, restaurado);
    igual(await restaurado.getAll('trilhas'), registros);
    const rotina = catalogo.rotinaPorId.get('massa-3-casa');
    const { itens } = treinoDoDia(rotina, [], catalogo, await lerProgressoTrilhas(restaurado));
    igual(itens[0].exercicioId, 'flexao-no-chao', 'treino do dia do banco restaurado usa o nível escolhido');
  } finally {
    restaurado.close();
    await deleteDB(NOME_RESTAURADO);
  }
});

// ---------- Limpeza ----------

teste('banco de teste: é apagado no fim', async () => {
  await apagarBancoDeTeste();
  const bancos = indexedDB.databases ? await indexedDB.databases() : [];
  igual(bancos.some((b) => b.name === NOME_TESTE || b.name === NOME_RESTAURADO), false);
});
