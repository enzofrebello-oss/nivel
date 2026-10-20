// backup.test.js: testes do backup (PROJETO.md, seção 2, "Backup (exportar/importar JSON)", e etapa 11).
// Usa um banco separado, 'nivel-teste', apagado no começo e no fim; NUNCA o banco real 'nivel'.
// Abre pelo mesmo abrirBanco do app (mesmas migrações), só com outro nome. O catálogo é o real (dados/).

import { teste, igual, lanca } from './mini-teste.js';
import { deleteDB } from '../vendor/idb/index.js';
import { abrirBanco, NOME_BANCO } from '../js/db/conexao.js';
import { carregarCatalogo } from '../js/catalogo.js';
import {
  APP_BACKUP, FORMATO_BACKUP, STORES_BACKUP, nomeArquivoBackup, exportarBackup, backupParaTexto,
  lerBackup, validarBackup, importarBackup, resumirBackup, textoResumo, entregarBackup, baixarArquivo,
} from '../js/db/backup.js';

const NOME_TESTE = 'nivel-teste';
let db = null;
let catalogo = null;

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

// Cópia profunda (o backup não pode compartilhar objetos com os dados fixos).
const copia = (v) => JSON.parse(JSON.stringify(v));
const porChave = (lista, chave) => [...lista].sort((a, b) => (a[chave] < b[chave] ? -1 : a[chave] > b[chave] ? 1 : 0));
const CHAVES = { sessoes: 'id', series: 'id', trilhas: 'trilhaId', meta: 'chave' };

// ---------- Dados fixos nas 4 stores ----------

const SESSOES = [
  {
    id: 's-1', rotinaId: 'massa-3-casa', diaId: 'a', nome: 'A · Empurrar', local: 'casa',
    itens: [
      { exercicioId: 'flexao-no-chao', trilhaId: 'flexoes', series: 4, alvo: '12', descanso: 90 },
      { exercicioId: 'prancha-alta', trilhaId: null, series: 3, alvo: '30-45', descanso: 60 },
    ],
    inicio: 1760790000000, fim: 1760793600000, status: 'concluida', descanso: null, versaoDados: 1,
  },
  {
    id: 's-2', rotinaId: null, diaId: null, nome: 'Treino livre', local: 'academia',
    itens: [{ exercicioId: 'supino-reto-barra', trilhaId: null, series: 3, alvo: '8-12', descanso: 120 }],
    inicio: 1760880000000, fim: null, status: 'andamento', descanso: { ate: 1760880300000, duracao: 120 }, versaoDados: 1,
  },
];
const SERIES = [
  { id: 'e-1', sessaoId: 's-1', exercicioId: 'flexao-no-chao', tipo: 'corpo', grupos: ['peito', 'triceps', 'ombros', 'core'], reps: 15, feitaEm: 1760790500000 },
  { id: 'e-2', sessaoId: 's-1', exercicioId: 'flexao-no-chao', tipo: 'corpo', grupos: ['peito', 'triceps', 'ombros', 'core'], reps: 12, feitaEm: 1760790700000 },
  { id: 'e-3', sessaoId: 's-1', exercicioId: 'prancha-alta', tipo: 'tempo', grupos: ['core', 'ombros', 'lombar', 'gluteos'], segundos: 50, feitaEm: 1760791800000 },
  { id: 'e-4', sessaoId: 's-2', exercicioId: 'supino-reto-barra', tipo: 'carga', grupos: ['peito', 'triceps', 'ombros'], carga: 62.5, reps: 8, feitaEm: 1760880200000 },
  { id: 'e-5', sessaoId: 's-2', exercicioId: 'supino-reto-barra', tipo: 'carga', grupos: ['peito', 'triceps', 'ombros'], carga: 60.25, reps: 10, feitaEm: 1760880100000 },
];
const TRILHAS = [
  {
    trilhaId: 'flexoes', exercicioAtualId: 'flexao-no-chao',
    concluidos: [
      { exercicioId: 'flexao-na-parede', em: 1760700000000, como: 'manual' },
      { exercicioId: 'flexao-inclinada-mesa', em: 1760790000000, como: 'meta' },
    ],
    atualizadoEm: 1760790000000,
  },
  { trilhaId: 'barra-fixa', exercicioAtualId: null, concluidos: [], atualizadoEm: 1760800000000 },
];
const META = [
  { chave: 'rotinaAtualId', valor: 'massa-3-casa' },
  { chave: 'ultimoBackup', valor: 1760700000000 },
  { chave: 'versaoDadosVista', valor: 1 },
  { chave: 'persistenciaPedida', valor: true },
];
const FIXOS = { sessoes: SESSOES, series: SERIES, trilhas: TRILHAS, meta: META };

async function gravarFixos() {
  const tx = db.transaction([...STORES_BACKUP], 'readwrite');
  const pedidos = [];
  for (const store of STORES_BACKUP) for (const r of FIXOS[store]) pedidos.push(tx.objectStore(store).put(copia(r)));
  await Promise.all([...pedidos, tx.done]);
}

// Tudo o que está no banco agora, store por store (getAll vem em ordem de chave).
async function lerBancoInteiro() {
  const saida = {};
  for (const store of Array.from(db.objectStoreNames)) saida[store] = await db.getAll(store);
  return saida;
}

// Backup válido mínimo para os testes de recusa (cópia nova a cada chamada).
function backupValido() {
  return copia({ app: APP_BACKUP, formato: FORMATO_BACKUP, versaoDb: 1, versaoDados: 1, exportadoEm: 1, dados: FIXOS });
}

// ---------- Preparação ----------

teste('banco de teste: o nome não é o do banco real', () => {
  igual(NOME_BANCO, 'nivel');
  if (NOME_TESTE === NOME_BANCO) throw new Error('o teste usaria o banco real');
});

teste('preparação: catálogo real carrega e os ids dos dados fixos existem nele', async () => {
  catalogo = await carregarCatalogo();
  for (const id of ['flexao-no-chao', 'prancha-alta', 'supino-reto-barra', 'flexao-na-parede', 'flexao-inclinada-mesa']) {
    igual(catalogo.exercicioPorId.has(id), true, `exercício ${id}`);
  }
  igual(catalogo.trilhaPorId.has('flexoes') && catalogo.trilhaPorId.has('barra-fixa'), true, 'trilhas');
});

teste('preparação: banco de teste novo recebe os dados fixos nas 4 stores', async () => {
  await apagarBancoDeTeste();
  await reabrir();
  igual(db.name, NOME_TESTE);
  await gravarFixos();
  igual(await db.count('sessoes'), 2);
  igual(await db.count('series'), 5);
  igual(await db.count('trilhas'), 2);
  igual(await db.count('meta'), 4);
});

// ---------- Nome do arquivo ----------

teste('nome: nivel-backup-AAAA-MM-DD.json com zeros à esquerda', () => {
  igual(nomeArquivoBackup(new Date(2026, 0, 5, 10, 0)), 'nivel-backup-2026-01-05.json');
  igual(nomeArquivoBackup(new Date(2026, 11, 31, 12, 0)), 'nivel-backup-2026-12-31.json');
});

teste('nome: usa a data local, não a UTC (meia-noite e 23:59 locais)', () => {
  igual(nomeArquivoBackup(new Date(2026, 9, 19, 23, 59, 59)), 'nivel-backup-2026-10-19.json');
  igual(nomeArquivoBackup(new Date(2026, 9, 20, 0, 0, 1)), 'nivel-backup-2026-10-20.json');
});

teste('nome: sem argumento usa a data local de hoje', () => {
  const d = new Date();
  const esperado = `nivel-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  igual(nomeArquivoBackup(), esperado);
});

// ---------- (a) O backup contém tudo ----------

teste('exportar: as stores do backup são exatamente as stores do banco', () => {
  igual([...STORES_BACKUP].sort(), Array.from(db.objectStoreNames).sort());
});

teste('exportar: cabeçalho (app, formato, versaoDb, versaoDados, exportadoEm)', async () => {
  const backup = await exportarBackup({ versaoDados: catalogo.versaoDados, agora: 1760900000000 }, db);
  igual(backup.app, 'nivel');
  igual(backup.formato, 1);
  igual(backup.versaoDb, db.version);
  igual(backup.versaoDados, catalogo.versaoDados);
  igual(backup.exportadoEm, 1760900000000);
  igual(Object.keys(backup.dados), ['sessoes', 'series', 'trilhas', 'meta']);
});

teste('exportar: cada store tem todos os registros do banco, iguais (contagem e conteúdo)', async () => {
  const backup = await exportarBackup({ versaoDados: 1 }, db);
  const banco = await lerBancoInteiro();
  for (const store of Array.from(db.objectStoreNames)) {
    igual(backup.dados[store].length, await db.count(store), `contagem de ${store}`);
    igual(backup.dados[store], banco[store], `conteúdo de ${store}`);
    igual(porChave(backup.dados[store], CHAVES[store]), porChave(FIXOS[store], CHAVES[store]), `${store} = dados fixos`);
  }
});

teste('exportar: inclui as séries dos 3 tipos, a trilha concluída e as 4 chaves de meta (rotinaAtualId inclusive)', async () => {
  const { dados } = await exportarBackup({ versaoDados: 1 }, db);
  igual([...new Set(dados.series.map((s) => s.tipo))].sort(), ['carga', 'corpo', 'tempo']);
  igual(dados.trilhas.find((t) => t.trilhaId === 'barra-fixa').exercicioAtualId, null);
  igual(dados.meta.find((m) => m.chave === 'rotinaAtualId').valor, 'massa-3-casa');
  igual(dados.meta.map((m) => m.chave).sort(), ['persistenciaPedida', 'rotinaAtualId', 'ultimoBackup', 'versaoDadosVista']);
});

teste('exportar: não muda nada no banco', async () => {
  const antes = await lerBancoInteiro();
  await exportarBackup({ versaoDados: 1 }, db);
  igual(await lerBancoInteiro(), antes);
});

// ---------- (b) Ida e volta ----------

teste('ler: o texto do backup gerado passa na validação, com a prévia certa', async () => {
  const texto = backupParaTexto(await exportarBackup({ versaoDados: 1 }, db));
  const lido = lerBackup(texto, catalogo);
  igual(lido.ok, true, lido.erros && lido.erros.join(' | '));
  igual(lido.resumo, { treinos: 2, series: 5, trilhas: 1 });
  igual(textoResumo(lido.resumo), '2 treinos, 5 séries, 1 trilha em andamento');
  igual(textoResumo({ treinos: 80, series: 1900, trilhas: 5 }), '80 treinos, 1.900 séries, 5 trilhas em andamento');
});

teste('ida e volta: gerar → apagar o banco → importar → o banco fica igual ao original', async () => {
  const original = await lerBancoInteiro();
  const texto = backupParaTexto(await exportarBackup({ versaoDados: 1 }, db));

  await apagarBancoDeTeste();
  await reabrir();
  for (const store of STORES_BACKUP) igual(await db.count(store), 0, `${store} vazio depois de apagar`);

  const lido = lerBackup(texto, catalogo);
  igual(lido.ok, true);
  const resumo = await importarBackup(lido.backup, catalogo, db);
  igual(resumo, { treinos: 2, series: 5, trilhas: 1 });

  igual(await lerBancoInteiro(), original, 'banco depois de importar');
  for (const store of STORES_BACKUP) {
    igual(porChave(await db.getAll(store), CHAVES[store]), porChave(FIXOS[store], CHAVES[store]), `${store} = dados fixos`);
  }
});

teste('ida e volta: exportar de novo depois de importar dá os mesmos dados', async () => {
  const texto = backupParaTexto(await exportarBackup({ versaoDados: 1 }, db));
  await importarBackup(JSON.parse(texto), catalogo, db);
  const deNovo = await exportarBackup({ versaoDados: 1 }, db);
  igual(deNovo.dados, JSON.parse(texto).dados);
});

teste('ida e volta: os índices funcionam com os dados importados', async () => {
  const faixa = IDBKeyRange.bound(['supino-reto-barra', 0], ['supino-reto-barra', Infinity]);
  igual((await db.getAllFromIndex('series', 'por_exercicio', faixa)).map((s) => s.id), ['e-5', 'e-4']);
  igual((await db.getAllFromIndex('sessoes', 'por_status', 'andamento')).map((s) => s.id), ['s-2']);
  igual((await db.getAllFromIndex('series', 'por_sessao', 's-1')).length, 3);
});

teste('importar: substitui tudo (registros que não estão no backup somem)', async () => {
  await db.put('sessoes', { ...copia(SESSOES[0]), id: 's-extra' });
  await db.put('meta', { chave: 'extra', valor: 1 });
  await importarBackup(backupValido(), catalogo, db);
  igual(await db.get('sessoes', 's-extra'), undefined);
  igual(await db.get('meta', 'extra'), undefined);
  igual(await db.count('sessoes'), 2);
  igual(await db.count('meta'), 4);
});

teste('importar: backup com listas vazias deixa o banco vazio', async () => {
  const vazio = { ...backupValido(), dados: { sessoes: [], series: [], trilhas: [], meta: [] } };
  igual(await importarBackup(vazio, catalogo, db), { treinos: 0, series: 0, trilhas: 0 });
  for (const store of STORES_BACKUP) igual(await db.count(store), 0, store);
  await importarBackup(backupValido(), catalogo, db); // volta os dados para os próximos testes
});

teste('importar: é atômico (um registro que não grava desfaz tudo, inclusive a limpeza)', async () => {
  const antes = await lerBancoInteiro();
  const ruim = backupValido();
  ruim.dados.sessoes = [];
  ruim.dados.series = [];
  ruim.dados.meta.push({ chave: 'nao-clonavel', valor: () => 1 }); // passa na validação, falha no put
  let falhou = false;
  try {
    await importarBackup(ruim, catalogo, db);
  } catch {
    falhou = true;
  }
  igual(falhou, true, 'deveria falhar');
  igual(await lerBancoInteiro(), antes, 'banco intacto');
});

// ---------- Recusas ----------

function recusa(mexer, trecho) {
  const b = backupValido();
  mexer(b);
  const r = validarBackup(b, catalogo);
  igual(r.ok, false, 'deveria recusar');
  if (trecho && !r.erros.some((e) => e.includes(trecho))) throw new Error(`erro sem "${trecho}": ${r.erros.join(' | ')}`);
}

teste('recusa: arquivo que não é JSON', () => {
  const r = lerBackup('isto não é json', catalogo);
  igual(r.ok, false);
  igual(r.erros[0].includes('JSON'), true);
});

teste('recusa: arquivo de outro app ou sem app', () => {
  recusa((b) => { b.app = 'outro-app'; }, 'não é um backup do Nível');
  igual(validarBackup([], catalogo).ok, false);
  igual(validarBackup(null, catalogo).ok, false);
});

teste('recusa: formato mais novo que o do app, ou formato inválido', () => {
  recusa((b) => { b.formato = FORMATO_BACKUP + 1; }, 'versão mais nova');
  recusa((b) => { b.formato = '1'; }, 'formato');
});

teste('recusa: falta uma das listas', () => {
  for (const store of STORES_BACKUP) recusa((b) => { delete b.dados[store]; }, `"${store}"`);
});

teste('recusa: exercicioId fora do catálogo (série, item da sessão, trilha, concluídos)', () => {
  recusa((b) => { b.dados.series[0].exercicioId = 'exercicio-inventado'; }, 'exercicio-inventado');
  recusa((b) => { b.dados.sessoes[0].itens[0].exercicioId = 'exercicio-inventado'; }, 'exercicio-inventado');
  recusa((b) => { b.dados.trilhas[0].exercicioAtualId = 'exercicio-inventado'; }, 'exercicio-inventado');
  recusa((b) => { b.dados.trilhas[0].concluidos[0].exercicioId = 'exercicio-inventado'; }, 'exercicio-inventado');
});

teste('recusa: trilhaId fora do catálogo (trilha e item da sessão)', () => {
  recusa((b) => { b.dados.trilhas[0].trilhaId = 'trilha-inventada'; }, 'trilha-inventada');
  recusa((b) => { b.dados.sessoes[0].itens[0].trilhaId = 'trilha-inventada'; }, 'trilha-inventada');
});

teste('recusa: série com campo de outro tipo, campo faltando ou valor fora do limite', () => {
  recusa((b) => { b.dados.series[0].carga = 10; }, 'carga');
  recusa((b) => { delete b.dados.series[2].segundos; }, 'segundos');
  recusa((b) => { b.dados.series[3].reps = 0; }, 'series[3]');
  recusa((b) => { b.dados.series[0].tipo = 'outro'; }, 'tipo');
});

teste('recusa: série de sessão que não está no backup e ids repetidos', () => {
  recusa((b) => { b.dados.series[0].sessaoId = 's-nao-existe'; }, 's-nao-existe');
  recusa((b) => { b.dados.series[1].id = 'e-1'; }, 'repetido');
  recusa((b) => { delete b.dados.meta[0].chave; }, 'chave');
});

teste('recusa: sessão com campos inválidos e dois treinos em andamento', () => {
  recusa((b) => { b.dados.sessoes[0].local = 'praia'; }, 'local');
  recusa((b) => { b.dados.sessoes[0].status = 'andamento'; b.dados.sessoes[0].fim = null; }, 'mais de um');
  recusa((b) => { b.dados.sessoes[0].fim = null; }, 'sem fim');
  recusa((b) => { b.dados.trilhas[0].concluidos[0].como = 'sorte'; }, 'como');
});

teste('recusa: importar um backup inválido lança e não muda o banco', async () => {
  const antes = await lerBancoInteiro();
  const b = backupValido();
  b.dados.series[0].exercicioId = 'exercicio-inventado';
  let mensagem = null;
  try {
    await importarBackup(b, catalogo, db);
  } catch (erro) {
    mensagem = erro.message;
  }
  igual(typeof mensagem, 'string', 'deveria lançar');
  igual(await lerBancoInteiro(), antes);
});

teste('resumo: conta treinos, séries e trilhas com nível atual', () => {
  igual(resumirBackup(FIXOS), { treinos: 2, series: 5, trilhas: 1 });
  lanca(() => resumirBackup({}));
});

// ---------- Entregar o arquivo (share ou download) ----------

function navFalso({ canShare = true, share = async () => {} } = {}) {
  const chamadas = [];
  return {
    chamadas,
    canShare: () => canShare,
    share: async (dados) => {
      chamadas.push(dados);
      return share(dados);
    },
  };
}

function baixarFalso() {
  const baixados = [];
  const baixar = (blob, nome) => baixados.push({ blob, nome });
  return { baixados, baixar };
}

const erroNomeado = (name) => Object.assign(new Error(name), { name });

teste('entregar: com share de arquivos, compartilha um .json com o nome e o conteúdo certos', async () => {
  const nav = navFalso();
  const { baixados, baixar } = baixarFalso();
  igual(await entregarBackup('{"a":1}', 'nivel-backup-2026-10-20.json', { nav, baixar }), 'compartilhado');
  igual(baixados.length, 0);
  const arquivo = nav.chamadas[0].files[0];
  igual(arquivo.name, 'nivel-backup-2026-10-20.json');
  igual(arquivo.type, 'application/json');
  igual(await arquivo.text(), '{"a":1}');
});

teste('entregar: share cancelado (AbortError) não baixa nada', async () => {
  const nav = navFalso({ share: async () => { throw erroNomeado('AbortError'); } });
  const { baixados, baixar } = baixarFalso();
  igual(await entregarBackup('{}', 'x.json', { nav, baixar }), 'cancelado');
  igual(baixados.length, 0);
});

teste('entregar: share que falha com outro erro cai no download', async () => {
  const nav = navFalso({ share: async () => { throw erroNomeado('NotAllowedError'); } });
  const { baixados, baixar } = baixarFalso();
  igual(await entregarBackup('{"b":2}', 'nivel-backup-2026-10-20.json', { nav, baixar }), 'baixado');
  igual(baixados.length, 1);
  igual(baixados[0].nome, 'nivel-backup-2026-10-20.json');
  igual(await baixados[0].blob.text(), '{"b":2}');
});

teste('entregar: sem share, ou com canShare false para o arquivo, baixa', async () => {
  const { baixados, baixar } = baixarFalso();
  igual(await entregarBackup('{}', 'a.json', { nav: {}, baixar }), 'baixado');
  const nav = navFalso({ canShare: false });
  igual(await entregarBackup('{}', 'b.json', { nav, baixar }), 'baixado');
  igual(nav.chamadas.length, 0, 'não tenta compartilhar');
  igual(baixados.map((b) => b.nome), ['a.json', 'b.json']);
});

teste('baixarArquivo: link com download, no DOM na hora do click, removido depois e URL liberada com atraso', () => {
  const clickOriginal = HTMLAnchorElement.prototype.click;
  const revokeOriginal = URL.revokeObjectURL;
  const revogados = [];
  let visto = null;
  HTMLAnchorElement.prototype.click = function () {
    visto = { noDom: this.isConnected, download: this.download, href: this.href };
  };
  URL.revokeObjectURL = (url) => revogados.push(url);
  let link;
  try {
    baixarArquivo(new Blob(['{}'], { type: 'application/json' }), 'nivel-backup-2026-10-20.json');
    link = document.querySelector('a[download="nivel-backup-2026-10-20.json"]');
  } finally {
    HTMLAnchorElement.prototype.click = clickOriginal;
  }
  igual(visto && visto.noDom, true, 'link no DOM no click');
  igual(visto.download, 'nivel-backup-2026-10-20.json');
  igual(visto.href.startsWith('blob:'), true, 'href blob:');
  igual(link, null, 'link removido depois do click');
  igual(revogados.length, 0, 'URL não liberada na hora');
  URL.revokeObjectURL = revokeOriginal; // o setTimeout de 60 s libera a URL de verdade depois
});

// ---------- Limpeza ----------

teste('banco de teste: é apagado no fim', async () => {
  await apagarBancoDeTeste();
  const bancos = indexedDB.databases ? await indexedDB.databases() : [];
  igual(bancos.some((b) => b.name === NOME_TESTE), false);
});
