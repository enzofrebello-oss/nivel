// series.test.js: testes de js/db/sessoes.js e js/db/series.js (PROJETO.md, seção 4.2, e etapa 13).
// Usa um banco separado, 'nivel-teste-series', apagado no começo e no fim; NUNCA o banco real 'nivel'.
// Abre pelo mesmo abrirBanco do app (mesmas migrações). O catálogo é o real (dados/).
// Confere também que as sessões e séries geradas entram no backup e passam na validação dele.

import { teste, igual } from './mini-teste.js';
import { deleteDB } from '../vendor/idb/index.js';
import { abrirBanco, NOME_BANCO } from '../js/db/conexao.js';
import { carregarCatalogo } from '../js/catalogo.js';
import { iniciarSessao, obterSessao, sessaoEmAndamento, listarSessoes } from '../js/db/sessoes.js';
import { adicionarSerie, editarSerie, apagarSerie, listarSeriesDaSessao } from '../js/db/series.js';
import { exportarBackup, backupParaTexto, lerBackup, importarBackup } from '../js/db/backup.js';
import { treinoDoDia } from '../js/logica/rotina.js';

const NOME_TESTE = 'nivel-teste-series';
let db = null;
let catalogo = null;
let sessao = null;

async function apagarBancoDeTeste() {
  if (db) db.close();
  db = null;
  await deleteDB(NOME_TESTE);
}

async function reabrir() {
  if (db) db.close();
  db = await abrirBanco({ nome: NOME_TESTE });
  return db;
}

// Mensagem do erro lançado por fn (ou null se não lançou).
async function erroDe(fn) {
  try {
    await fn();
  } catch (erro) {
    return erro.message;
  }
  return null;
}

const ex = (id) => catalogo.exercicioPorId.get(id);

// Dados de início a partir do treino do dia de uma rotina real (como o Hoje faz).
function dadosDoTreino(rotinaId) {
  const rotina = catalogo.rotinaPorId.get(rotinaId);
  const { dia, itens } = treinoDoDia(rotina, [], catalogo);
  return { rotinaId, diaId: dia.id, nome: dia.nome, local: rotina.local, itens, versaoDados: catalogo.versaoDados };
}

// ---------- Preparação ----------

teste('banco de teste: o nome não é o do banco real', () => {
  if (NOME_TESTE === NOME_BANCO) throw new Error('o teste usaria o banco real');
});

teste('preparação: catálogo real e banco de teste vazio', async () => {
  catalogo = await carregarCatalogo();
  igual(ex('supino-reto-barra').tipo, 'carga');
  igual(ex('flexao-no-chao').tipo, 'corpo');
  igual(ex('prancha-alta').tipo, 'tempo');
  await apagarBancoDeTeste();
  await reabrir();
  igual(await db.count('sessoes'), 0);
  igual(await sessaoEmAndamento(db), null);
});

// ---------- Sessões ----------

teste('iniciar: cria a sessão em andamento com os itens copiados (formato da seção 4.2)', async () => {
  const dados = dadosDoTreino('massa-3-casa');
  const { sessao: s, jaExistia } = await iniciarSessao(dados, { agora: 1760790000000 }, db);
  igual(jaExistia, false);
  sessao = s;
  igual(typeof s.id === 'string' && s.id.length > 0, true, 'id');
  igual(s.rotinaId, 'massa-3-casa');
  igual(s.diaId, 'a');
  igual(s.nome, dados.nome);
  igual(s.local, 'casa');
  igual(s.inicio, 1760790000000);
  igual(s.fim, null);
  igual(s.status, 'andamento');
  igual(s.descanso, null);
  igual(s.versaoDados, catalogo.versaoDados);
  igual(s.itens, dados.itens.map((i) => ({ exercicioId: i.exercicioId, trilhaId: i.trilhaId, series: i.series, alvo: i.alvo, descanso: i.descanso })));
  igual(Object.keys(s).sort(), ['descanso', 'diaId', 'fim', 'id', 'inicio', 'itens', 'local', 'nome', 'rotinaId', 'status', 'versaoDados']);
  igual(await obterSessao(s.id, db), s, 'gravada no banco');
});

teste('iniciar: um segundo treino é impedido (devolve o que já está em andamento, não cria outro)', async () => {
  const r = await iniciarSessao(dadosDoTreino('forca-4-academia'), { agora: 1760800000000 }, db);
  igual(r.jaExistia, true);
  igual(r.sessao.id, sessao.id);
  igual(await db.count('sessoes'), 1);
  igual((await sessaoEmAndamento(db)).id, sessao.id);
});

teste('iniciar: dois pedidos ao mesmo tempo criam uma sessão só', async () => {
  await apagarBancoDeTeste();
  await reabrir();
  const [a, b] = await Promise.all([
    iniciarSessao(dadosDoTreino('massa-3-casa'), {}, db),
    iniciarSessao(dadosDoTreino('massa-3-casa'), {}, db),
  ]);
  igual([a.jaExistia, b.jaExistia].sort(), [false, true]);
  igual(await db.count('sessoes'), 1);
  sessao = a.jaExistia ? b.sessao : a.sessao;
});

teste('iniciar: treino sem exercícios é recusado', async () => {
  igual(typeof await erroDe(() => iniciarSessao({ ...dadosDoTreino('massa-3-casa'), itens: [] }, {}, db)), 'string');
});

teste('sessão concluída não conta como em andamento', async () => {
  await db.put('sessoes', { ...sessao, id: 's-velha', status: 'concluida', fim: 2, inicio: 1 });
  igual((await sessaoEmAndamento(db)).id, sessao.id);
  igual((await listarSessoes(db)).map((s) => s.id), ['s-velha', sessao.id]);
  await db.delete('sessoes', 's-velha');
});

// ---------- Séries ----------

teste('séries: os 3 tipos são gravados na hora, com tipo e grupos copiados do exercício', async () => {
  const carga = await adicionarSerie({ sessaoId: sessao.id, exercicio: ex('supino-reto-barra'), medidas: { carga: 62.5, reps: 10 } }, { agora: 1000 }, db);
  const corpo = await adicionarSerie({ sessaoId: sessao.id, exercicio: ex('flexao-no-chao'), medidas: { reps: 15 } }, { agora: 2000 }, db);
  const tempo = await adicionarSerie({ sessaoId: sessao.id, exercicio: ex('prancha-alta'), medidas: { segundos: 90 } }, { agora: 3000 }, db);

  igual(await db.get('series', carga.id), carga);
  igual(carga.tipo, 'carga');
  igual(carga.carga, 62.5);
  igual(carga.grupos, [...ex('supino-reto-barra').grupos]);
  igual(Object.keys(carga).sort(), ['carga', 'exercicioId', 'feitaEm', 'grupos', 'id', 'reps', 'sessaoId', 'tipo']);
  igual(Object.keys(corpo).sort(), ['exercicioId', 'feitaEm', 'grupos', 'id', 'reps', 'sessaoId', 'tipo'], 'corpo sem carga');
  igual(Object.keys(tempo).sort(), ['exercicioId', 'feitaEm', 'grupos', 'id', 'segundos', 'sessaoId', 'tipo'], 'tempo sem reps');
  igual(tempo.segundos, 90);
  igual(corpo.grupos, [...ex('flexao-no-chao').grupos]);
  igual((await db.get('series', tempo.id)).grupos, [...ex('prancha-alta').grupos]);
  igual(Object.isFrozen(carga.grupos), false, 'grupos é uma cópia, não o array congelado do catálogo');
});

teste('séries: valor inválido, campo de outro tipo e sessão inexistente são recusados (nada é gravado)', async () => {
  const antes = await db.count('series');
  igual(typeof await erroDe(() => adicionarSerie({ sessaoId: sessao.id, exercicio: ex('flexao-no-chao'), medidas: { reps: 0 } }, {}, db)), 'string');
  igual(typeof await erroDe(() => adicionarSerie({ sessaoId: sessao.id, exercicio: ex('supino-reto-barra'), medidas: { carga: 0, reps: 5 } }, {}, db)), 'string');
  igual(typeof await erroDe(() => adicionarSerie({ sessaoId: sessao.id, exercicio: ex('flexao-no-chao'), medidas: { reps: 10, carga: 5 } }, {}, db)), 'string');
  igual(typeof await erroDe(() => adicionarSerie({ sessaoId: sessao.id, exercicio: ex('prancha-alta'), medidas: {} }, {}, db)), 'string');
  igual(typeof await erroDe(() => adicionarSerie({ sessaoId: 'nao-existe', exercicio: ex('flexao-no-chao'), medidas: { reps: 10 } }, {}, db)), 'string');
  igual(await db.count('series'), antes);
});

teste('séries: por sessão, em ordem de feitaEm', async () => {
  await adicionarSerie({ sessaoId: sessao.id, exercicio: ex('flexao-no-chao'), medidas: { reps: 12 } }, { agora: 1500 }, db);
  const lista = await listarSeriesDaSessao(sessao.id, db);
  igual(lista.map((s) => s.feitaEm), [1000, 1500, 2000, 3000]);
  igual(await listarSeriesDaSessao('outra', db), []);
});

teste('editar: troca só as medidas (id, tipo, grupos e feitaEm ficam) e valida', async () => {
  const [primeira] = await listarSeriesDaSessao(sessao.id, db);
  const nova = await editarSerie(primeira.id, { carga: 65, reps: 8 }, db);
  igual(nova, { ...primeira, carga: 65, reps: 8 });
  igual(await db.get('series', primeira.id), nova);
  igual(typeof await erroDe(() => editarSerie(primeira.id, { reps: 0 }, db)), 'string');
  igual(typeof await erroDe(() => editarSerie(primeira.id, { segundos: 30 }, db)), 'string', 'campo de outro tipo');
  igual(typeof await erroDe(() => editarSerie('nao-existe', { reps: 3 }, db)), 'string');
  igual(await db.get('series', primeira.id), nova, 'edição recusada não muda nada');
});

teste('apagar: remove só aquela série', async () => {
  const lista = await listarSeriesDaSessao(sessao.id, db);
  await apagarSerie(lista[1].id, db);
  igual((await listarSeriesDaSessao(sessao.id, db)).map((s) => s.id), [lista[0].id, lista[2].id, lista[3].id]);
});

teste('fechar e reabrir o banco (fechar a aba): sessão em andamento e séries continuam lá', async () => {
  const antes = await listarSeriesDaSessao(sessao.id, db);
  await reabrir();
  igual((await sessaoEmAndamento(db)).id, sessao.id);
  igual(await listarSeriesDaSessao(sessao.id, db), antes);
});

// ---------- Backup ----------

teste('backup: sessões e séries geradas entram no backup e passam na validação; ida e volta igual', async () => {
  const backup = await exportarBackup({ versaoDados: catalogo.versaoDados }, db);
  igual(backup.dados.sessoes.length, 1);
  igual(backup.dados.series.length, 3);
  igual([...new Set(backup.dados.series.map((s) => s.tipo))].sort(), ['carga', 'corpo', 'tempo']);
  const lido = lerBackup(backupParaTexto(backup), catalogo);
  igual(lido.ok, true, lido.erros && lido.erros.join(' | '));
  igual(lido.resumo, { treinos: 1, series: 3, trilhas: 0 });

  const original = { sessoes: await db.getAll('sessoes'), series: await db.getAll('series') };
  await apagarBancoDeTeste();
  await reabrir();
  await importarBackup(lido.backup, catalogo, db);
  igual(await db.getAll('sessoes'), original.sessoes);
  igual(await db.getAll('series'), original.series);
});

teste('backup: as sessões do treino do dia de todas as 12 rotinas passam na validação', async () => {
  for (const rotina of catalogo.rotinas) {
    await apagarBancoDeTeste();
    await reabrir();
    const { sessao: s } = await iniciarSessao(dadosDoTreino(rotina.id), {}, db);
    const item = s.itens[0];
    const exercicio = ex(item.exercicioId);
    const medidas = { carga: { carga: 20, reps: 10 }, corpo: { reps: 10 }, tempo: { segundos: 30 } }[exercicio.tipo];
    await adicionarSerie({ sessaoId: s.id, exercicio, medidas }, {}, db);
    const lido = lerBackup(backupParaTexto(await exportarBackup({ versaoDados: catalogo.versaoDados }, db)), catalogo);
    igual(lido.ok, true, `${rotina.id}: ${lido.erros && lido.erros.join(' | ')}`);
  }
});

// ---------- Limpeza ----------

teste('banco de teste: é apagado no fim', async () => {
  await apagarBancoDeTeste();
  const bancos = indexedDB.databases ? await indexedDB.databases() : [];
  igual(bancos.some((b) => b.name === NOME_TESTE), false);
});
