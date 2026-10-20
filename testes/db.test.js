// db.test.js: testes do banco (PROJETO.md, seção 2, "Migrações do schema", seção 4.2 e etapas 9 e 12).
// Usa um banco separado, 'nivel-teste-db', apagado no começo e no fim; NUNCA o banco real 'nivel'.
// Abre pelo mesmo abrirBanco do app (mesmas migrações), só com outro nome.

import { teste, igual } from './mini-teste.js';
import { deleteDB } from '../vendor/idb/index.js';
import { abrirBanco, NOME_BANCO } from '../js/db/conexao.js';
import { migracoes, DB_VERSAO } from '../js/db/migracoes.js';
import { lerMeta, gravarMeta } from '../js/db/meta.js';
import { reposicionarTrilha, conciliarVersaoDados, lerProgressoTrilhas } from '../js/db/trilhas.js';
import { listarSessoes } from '../js/db/sessoes.js';

const NOME_TESTE = 'nivel-teste-db';
let db = null;

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

// Índices de uma store como { nome: { keyPath, unique, multiEntry } }.
function indicesDe(store) {
  const saida = {};
  for (const nome of Array.from(store.indexNames)) {
    const indice = store.index(nome);
    const keyPath = Array.isArray(indice.keyPath) ? Array.from(indice.keyPath) : indice.keyPath;
    saida[nome] = { keyPath, unique: indice.unique, multiEntry: indice.multiEntry };
  }
  return saida;
}

// ---------- Dados fixos ----------

const SESSAO = {
  id: 's-1', rotinaId: 'massa-3-casa', diaId: 'a', nome: 'A · Empurrar', local: 'casa',
  itens: [{ exercicioId: 'flexao-no-chao', trilhaId: 'flexoes', series: 4, alvo: '12', descanso: 90 }],
  inicio: 1760790000000, fim: null, status: 'andamento', descanso: null, versaoDados: 1,
};
const SERIES = [
  { id: 'e-1', sessaoId: 's-1', exercicioId: 'supino-reto-barra', tipo: 'carga', grupos: ['peito', 'triceps', 'ombros'], carga: 60, reps: 10, feitaEm: 1760791200000 },
  { id: 'e-2', sessaoId: 's-1', exercicioId: 'flexao-no-chao', tipo: 'corpo', grupos: ['peito', 'triceps', 'ombros', 'core'], reps: 15, feitaEm: 1760791500000 },
  { id: 'e-3', sessaoId: 's-1', exercicioId: 'prancha-alta', tipo: 'tempo', grupos: ['core', 'ombros', 'lombar', 'gluteos'], segundos: 50, feitaEm: 1760791800000 },
  { id: 'e-4', sessaoId: 's-1', exercicioId: 'supino-reto-barra', tipo: 'carga', grupos: ['peito', 'triceps', 'ombros'], carga: 62.5, reps: 8, feitaEm: 1760791300000 },
];
const TRILHA = {
  trilhaId: 'flexoes', exercicioAtualId: 'flexao-no-chao',
  concluidos: [{ exercicioId: 'flexao-na-parede', em: 1760700000000, como: 'manual' }],
  atualizadoEm: 1760790000000,
};

// Trilha do catálogo, no formato de progressoes.json (só o que a conciliação usa).
const TRILHA_CATALOGO = { id: 'flexoes', niveis: [{ exercicio: 'flexao-na-parede' }, { exercicio: 'flexao-inclinada-mesa' }, { exercicio: 'flexao-no-chao' }] };

function catalogoFalso(versaoDados, trilhas) {
  return { versaoDados, trilhaPorId: new Map(trilhas.map((t) => [t.id, t])) };
}

// ---------- Migrações ----------

teste('banco de teste: o nome não é o do banco real', () => {
  igual(NOME_BANCO, 'nivel');
  if (NOME_TESTE === NOME_BANCO) throw new Error('o teste usaria o banco real');
});

teste('migrações: DB_VERSAO é a maior chave (1 nesta versão)', () => {
  igual(Object.keys(migracoes), ['1']);
  igual(DB_VERSAO, 1);
});

// ---------- Criação ----------

teste('banco: é criado do zero na versão DB_VERSAO', async () => {
  await apagarBancoDeTeste();
  await reabrir();
  igual(db.name, NOME_TESTE);
  igual(db.version, DB_VERSAO);
});

teste('banco: tem exatamente as 4 stores (meta, series, sessoes, trilhas)', () => {
  igual(Array.from(db.objectStoreNames).sort(), ['meta', 'series', 'sessoes', 'trilhas']);
});

teste('banco: keyPath de cada store (sessoes id, series id, trilhas trilhaId, meta chave)', () => {
  const tx = db.transaction(['sessoes', 'series', 'trilhas', 'meta']);
  igual(tx.objectStore('sessoes').keyPath, 'id');
  igual(tx.objectStore('series').keyPath, 'id');
  igual(tx.objectStore('trilhas').keyPath, 'trilhaId');
  igual(tx.objectStore('meta').keyPath, 'chave');
  igual(tx.objectStore('sessoes').autoIncrement, false, 'sessoes sem autoIncrement');
});

teste('banco: sessoes tem os índices por_inicio (inicio) e por_status (status)', () => {
  igual(indicesDe(db.transaction('sessoes').store), {
    por_inicio: { keyPath: 'inicio', unique: false, multiEntry: false },
    por_status: { keyPath: 'status', unique: false, multiEntry: false },
  });
});

teste('banco: series tem os índices por_sessao (sessaoId) e por_exercicio ([exercicioId, feitaEm])', () => {
  igual(indicesDe(db.transaction('series').store), {
    por_sessao: { keyPath: 'sessaoId', unique: false, multiEntry: false },
    por_exercicio: { keyPath: ['exercicioId', 'feitaEm'], unique: false, multiEntry: false },
  });
});

teste('banco: trilhas e meta não têm índices', () => {
  igual(Array.from(db.transaction('trilhas').store.indexNames), []);
  igual(Array.from(db.transaction('meta').store.indexNames), []);
});

// ---------- Salvar e ler ----------

teste('salvar e ler: sessão volta igual', async () => {
  await db.put('sessoes', SESSAO);
  igual(await db.get('sessoes', 's-1'), SESSAO);
});

teste('salvar e ler: séries dos 3 tipos voltam iguais (campos de outro tipo ausentes)', async () => {
  const tx = db.transaction('series', 'readwrite');
  await Promise.all([...SERIES.map((s) => tx.store.put(s)), tx.done]);
  for (const serie of SERIES) igual(await db.get('series', serie.id), serie, serie.id);
  igual('carga' in (await db.get('series', 'e-2')), false, 'série corpo sem carga');
});

teste('salvar e ler: trilha volta igual', async () => {
  await db.put('trilhas', TRILHA);
  igual(await db.get('trilhas', 'flexoes'), TRILHA);
});

teste('salvar e ler: meta por gravarMeta / lerMeta; chave inexistente dá undefined', async () => {
  await gravarMeta('rotinaAtualId', 'massa-3-casa', db);
  igual(await lerMeta('rotinaAtualId', db), 'massa-3-casa');
  igual(await db.get('meta', 'rotinaAtualId'), { chave: 'rotinaAtualId', valor: 'massa-3-casa' });
  igual(await lerMeta('nao-existe', db), undefined);
  await gravarMeta('rotinaAtualId', 'forca-4-academia', db);
  igual(await lerMeta('rotinaAtualId', db), 'forca-4-academia', 'gravar de novo substitui');
});

teste('índices: por_exercicio devolve as séries do exercício em ordem de feitaEm', async () => {
  const faixa = IDBKeyRange.bound(['supino-reto-barra', 0], ['supino-reto-barra', Infinity]);
  const series = await db.getAllFromIndex('series', 'por_exercicio', faixa);
  igual(series.map((s) => s.id), ['e-1', 'e-4']);
});

teste('índices: por_sessao, por_status e por_inicio encontram os registros', async () => {
  igual((await db.getAllFromIndex('series', 'por_sessao', 's-1')).length, 4);
  igual((await db.getAllFromIndex('sessoes', 'por_status', 'andamento')).map((s) => s.id), ['s-1']);
  igual((await db.getAllFromIndex('sessoes', 'por_inicio', IDBKeyRange.lowerBound(0))).map((s) => s.id), ['s-1']);
});

// ---------- Fechar e abrir de novo ----------

teste('reabrir: fechar e abrir de novo não apaga nem duplica nada', async () => {
  await reabrir();
  igual(db.version, DB_VERSAO);
  igual(await db.count('sessoes'), 1);
  igual(await db.count('series'), 4);
  igual(await db.count('trilhas'), 1);
  igual(await db.count('meta'), 1);
  igual(await db.get('sessoes', 's-1'), SESSAO);
  igual(await db.get('series', 'e-3'), SERIES[2]);
  igual(await db.get('trilhas', 'flexoes'), TRILHA);
  igual(await lerMeta('rotinaAtualId', db), 'forca-4-academia');
});

teste('reabrir: as stores e os índices continuam os mesmos', () => {
  igual(Array.from(db.objectStoreNames).sort(), ['meta', 'series', 'sessoes', 'trilhas']);
  igual(Object.keys(indicesDe(db.transaction('series').store)).sort(), ['por_exercicio', 'por_sessao']);
  igual(Object.keys(indicesDe(db.transaction('sessoes').store)).sort(), ['por_inicio', 'por_status']);
});

// ---------- Conciliação de versaoDados ----------

teste('reposicionarTrilha: exercício atual ainda na trilha não muda', () => {
  igual(reposicionarTrilha(TRILHA, TRILHA_CATALOGO, 5), null);
});

teste('reposicionarTrilha: exercício atual que saiu passa ao primeiro nível não concluído', () => {
  const registro = { ...TRILHA, exercicioAtualId: 'flexao-que-saiu' };
  igual(reposicionarTrilha(registro, TRILHA_CATALOGO, 5), { ...registro, exercicioAtualId: 'flexao-inclinada-mesa', atualizadoEm: 5 });
});

teste('reposicionarTrilha: saiu e todos os níveis concluídos vira null; trilha concluída fica como está', () => {
  const todos = TRILHA_CATALOGO.niveis.map((n) => ({ exercicioId: n.exercicio, em: 1, como: 'meta' }));
  const registro = { ...TRILHA, exercicioAtualId: 'flexao-que-saiu', concluidos: todos };
  igual(reposicionarTrilha(registro, TRILHA_CATALOGO, 5).exercicioAtualId, null);
  igual(reposicionarTrilha({ ...TRILHA, exercicioAtualId: null }, TRILHA_CATALOGO, 5), null);
});

teste('conciliar: sem versaoDadosVista grava a versão do catálogo', async () => {
  const resultado = await conciliarVersaoDados(catalogoFalso(1, [TRILHA_CATALOGO]), db);
  igual(resultado, { mudou: true, ajustadas: 0 });
  igual(await lerMeta('versaoDadosVista', db), 1);
});

teste('conciliar: mesma versão não muda nada', async () => {
  igual(await conciliarVersaoDados(catalogoFalso(1, [TRILHA_CATALOGO]), db), { mudou: false, ajustadas: 0 });
  igual(await db.get('trilhas', 'flexoes'), TRILHA);
});

teste('conciliar: versão nova reposiciona a trilha cujo nível saiu e grava a nova versaoDadosVista', async () => {
  const semFlexaoNoChao = { id: 'flexoes', niveis: [{ exercicio: 'flexao-na-parede' }, { exercicio: 'flexao-inclinada-mesa' }, { exercicio: 'flexao-diamante' }] };
  const resultado = await conciliarVersaoDados(catalogoFalso(2, [semFlexaoNoChao]), db);
  igual(resultado, { mudou: true, ajustadas: 1 });
  igual((await db.get('trilhas', 'flexoes')).exercicioAtualId, 'flexao-inclinada-mesa');
  igual(await lerMeta('versaoDadosVista', db), 2);
});

// ---------- Leituras do Hoje (etapa 12) ----------

teste('listarSessoes: devolve as sessões do banco em ordem de início', async () => {
  const antiga = { ...SESSAO, id: 's-0', inicio: 1760000000000, fim: 1760003600000, status: 'concluida' };
  await db.put('sessoes', antiga);
  igual((await listarSessoes(db)).map((s) => s.id), ['s-0', 's-1']);
  await db.delete('sessoes', 's-0');
  igual((await listarSessoes(db)).map((s) => s.id), ['s-1']);
});

teste('listarSessoes: banco sem sessões devolve lista vazia', async () => {
  const vazio = await abrirBanco({ nome: `${NOME_TESTE}-vazio` });
  try {
    igual(await listarSessoes(vazio), []);
    igual((await lerProgressoTrilhas(vazio)).size, 0, 'sem registros de trilhas');
  } finally {
    vazio.close();
    await deleteDB(`${NOME_TESTE}-vazio`);
  }
});

teste('lerProgressoTrilhas: Map trilhaId → registro da store trilhas', async () => {
  const progresso = await lerProgressoTrilhas(db);
  igual([...progresso.keys()], ['flexoes']);
  igual(progresso.get('flexoes'), await db.get('trilhas', 'flexoes'));
});

// ---------- Limpeza ----------

teste('banco de teste: é apagado no fim', async () => {
  await apagarBancoDeTeste();
  const bancos = indexedDB.databases ? await indexedDB.databases() : [];
  igual(bancos.some((b) => b.name === NOME_TESTE), false);
});
