// comparacao.test.js: testes de js/logica/comparacao.js, de db/series.js (seriesDaUltimaVez) e da tela
// Treino montada com um banco de teste (PROJETO.md, seção 4.2 "Comparação" e etapa 14).
// Cobre: os 3 tipos, mais séries hoje que antes, sem "antes", carga e reps mudando juntas, a escolha do
// "antes" (só o último treino CONCLUÍDO; nunca o atual nem um em andamento) e o valor inicial do contador.
//
// REGRA DA CARGA (a mesma do código, logica/comparacao.js): compara campo a campo, d = hoje − antes.
//   "+" (laranja) só quando carga_hoje ≥ carga_antes E reps_hoje ≥ reps_antes, com pelo menos um maior.
//   "=" quando os dois são iguais. Cinza quando os dois pioram ou não melhoram ("menos"), e também quando
//   um sobe e o outro desce ("misto": mais carga com menos reps, ou menos carga com mais reps).
//   O texto mostra só os campos que mudaram: "+2,5 kg", "+2", "+2,5 kg +1", "+5 kg −2".
//
// O banco é separado ('nivel-teste-comparacao'), apagado no começo e no fim; NUNCA o banco real 'nivel'.

import { teste, igual } from './mini-teste.js';
import { deleteDB } from '../vendor/idb/index.js';
import { abrirBanco, NOME_BANCO } from '../js/db/conexao.js';
import { carregarCatalogo } from '../js/catalogo.js';
import { seriesDaUltimaVez, adicionarSerie } from '../js/db/series.js';
import {
  seriesDeAntes, textoAntes, compararSerie, compararSeries, valoresIniciais, minimoDoAlvo,
} from '../js/logica/comparacao.js';
import { render as renderTreino } from '../js/telas/treino.js';

const M = '−'; // sinal de menos usado no texto (−)

// Séries mínimas (só o que a comparação lê).
const corpo = (reps) => ({ tipo: 'corpo', reps });
const carga = (kg, reps) => ({ tipo: 'carga', carga: kg, reps });
const tempo = (segundos) => ({ tipo: 'tempo', segundos });
const textos = (lista) => lista.map((c) => (c ? `${c.resultado}:${c.texto}` : null));

// ---------- +1 nos 3 tipos ----------

teste('+1 corpo: ganho, igual e perda', () => {
  igual(compararSerie(corpo(20), corpo(22)), { resultado: 'mais', texto: '+2' });
  igual(compararSerie(corpo(20), corpo(20)), { resultado: 'igual', texto: '=' });
  igual(compararSerie(corpo(18), corpo(17)), { resultado: 'menos', texto: `${M}1` });
});

teste('+1 tempo: diferença em segundos', () => {
  igual(compararSerie(tempo(45), tempo(50)), { resultado: 'mais', texto: '+5 s' });
  igual(compararSerie(tempo(50), tempo(50)), { resultado: 'igual', texto: '=' });
  igual(compararSerie(tempo(90), tempo(75)), { resultado: 'menos', texto: `${M}15 s` });
});

teste('+1 carga: só a carga sobe, só as reps sobem, os dois sobem', () => {
  igual(compararSerie(carga(60, 10), carga(62.5, 10)), { resultado: 'mais', texto: '+2,5 kg' });
  igual(compararSerie(carga(60, 10), carga(60, 12)), { resultado: 'mais', texto: '+2' });
  igual(compararSerie(carga(60, 10), carga(62.5, 11)), { resultado: 'mais', texto: '+2,5 kg +1' });
  igual(compararSerie(carga(60, 10), carga(60, 10)), { resultado: 'igual', texto: '=' });
});

teste('+1 carga e reps mudando juntas: mais carga com menos reps NÃO é "+" (e o contrário também não)', () => {
  igual(compararSerie(carga(60, 10), carga(65, 8)), { resultado: 'misto', texto: `+5 kg ${M}2` });
  igual(compararSerie(carga(60, 10), carga(57.5, 12)), { resultado: 'misto', texto: `${M}2,5 kg +2` });
  igual(compararSerie(carga(60, 10), carga(55, 8)), { resultado: 'menos', texto: `${M}5 kg ${M}2` });
  igual(compararSerie(carga(60, 10), carga(55, 10)), { resultado: 'menos', texto: `${M}5 kg` });
  igual(compararSerie(carga(60, 10), carga(60, 9)), { resultado: 'menos', texto: `${M}1` });
});

teste('+1 carga: diferença com decimais sem erro de ponto flutuante', () => {
  igual(compararSerie(carga(60.25, 8), carga(62.5, 8)).texto, '+2,25 kg');
  igual(compararSerie(carga(20.1, 8), carga(20.3, 8)).texto, '+0,2 kg');
});

// ---------- Pareamento por posição ----------

teste('mais séries hoje que antes: as extras ficam sem +1', () => {
  const antes = [corpo(20), corpo(20)];
  const hoje = [corpo(21), corpo(20), corpo(19), corpo(18)];
  igual(textos(compararSeries(antes, hoje)), ['mais:+1', 'igual:=', null, null]);
});

teste('menos séries hoje que antes: compara só as feitas', () => {
  igual(textos(compararSeries([corpo(20), corpo(20), corpo(18)], [corpo(22)])), ['mais:+2']);
});

teste('sem "antes": nenhum +1 e linha "antes" vazia', () => {
  igual(compararSeries([], [corpo(10), corpo(12)]), [null, null]);
  igual(compararSeries(undefined, [corpo(10)]), [null]);
  igual(compararSerie(undefined, corpo(10)), null);
  igual(textoAntes([]), '');
  igual(compararSeries([corpo(10)], []), [], 'nada feito hoje');
});

teste('linha "antes" nos 3 tipos', () => {
  igual(textoAntes([corpo(20), corpo(20), corpo(18)]), '20 · 20 · 18');
  igual(textoAntes([carga(60, 10), carga(62.5, 8)]), '60×10 · 62,5×8');
  igual(textoAntes([tempo(50), tempo(90)]), '0:50 · 1:30');
});

// ---------- Qual treino é o "antes" ----------

const sessoes = [
  { id: 's1', status: 'concluida', inicio: 1000 },
  { id: 's2', status: 'concluida', inicio: 3000 },
  { id: 's3', status: 'andamento', inicio: 9000 }, // em andamento (mais novo): ignorado
  { id: 'atual', status: 'andamento', inicio: 10000 },
];
const s = (sessaoId, feitaEm, reps) => ({ sessaoId, feitaEm, tipo: 'corpo', reps });

teste('antes = séries do último treino CONCLUÍDO, em ordem de feitaEm', () => {
  const series = [s('s1', 1100, 10), s('s2', 3200, 13), s('s2', 3100, 12), s('s3', 9100, 30), s('atual', 10100, 40)];
  igual(seriesDeAntes(series, sessoes, 'atual').map((x) => x.reps), [12, 13]);
  igual(seriesDeAntes(series, new Map(sessoes.map((x) => [x.id, x])), 'atual').map((x) => x.reps), [12, 13], 'aceita Map');
});

teste('antes: nunca usa o treino atual (mesmo concluído) nem um em andamento', () => {
  const series = [s('s1', 1100, 10), s('s3', 9100, 30), s('atual', 10100, 40)];
  igual(seriesDeAntes(series, sessoes, 'atual').map((x) => x.reps), [10], 's2 não tem séries: cai no s1');
  const atualConcluida = sessoes.map((x) => (x.id === 'atual' ? { ...x, status: 'concluida' } : x));
  igual(seriesDeAntes([s('atual', 10100, 40)], atualConcluida, 'atual'), [], 'a própria sessão não conta');
  igual(seriesDeAntes([s('s3', 9100, 30)], sessoes, 'atual'), [], 'só em andamento = sem antes');
  igual(seriesDeAntes([s('sumiu', 1, 5)], sessoes, 'atual'), [], 'sessão inexistente');
  igual(seriesDeAntes([], sessoes, 'atual'), []);
});

teste('antes: o último é o de maior início, não o de série mais recente', () => {
  // s1 (início 1000) ganhou uma série "esquecida" depois: continua valendo o s2 (início 3000).
  const series = [s('s2', 3100, 12), s('s1', 20000, 99)];
  igual(seriesDeAntes(series, sessoes, 'atual').map((x) => x.reps), [12]);
});

// ---------- Valor inicial do contador ----------

teste('contador começa com a mesma série da última vez (3 tipos)', () => {
  igual(valoresIniciais('corpo', '12', [corpo(20), corpo(20), corpo(18)], []), { reps: 20 });
  igual(valoresIniciais('corpo', '12', [corpo(20), corpo(20), corpo(18)], [corpo(22), corpo(20)]), { reps: 18 });
  igual(valoresIniciais('carga', '8-12', [carga(60, 10), carga(62.5, 8)], [carga(70, 5)]), { carga: 62.5, reps: 8 });
  igual(valoresIniciais('tempo', '45', [tempo(50), tempo(40)], [tempo(55)]), { segundos: 40 });
});

teste('contador sem histórico para a série: meta da rotina (mínimo do alvo)', () => {
  igual(valoresIniciais('corpo', '8-12', [], []), { reps: 8 });
  igual(valoresIniciais('corpo', '12', [corpo(20)], [corpo(20)]), { reps: 12 }, 'mais séries hoje que antes');
  igual(valoresIniciais('tempo', '45', [], []), { segundos: 45 });
  igual(minimoDoAlvo('abc', 'reps', 'corpo'), 1, 'alvo estranho fica no mínimo válido');
  igual(minimoDoAlvo('200', 'reps', 'carga'), 100, 'acima do máximo fica no máximo');
});

teste('contador de carga sem a série de antes: última carga de hoje, senão última de antes, senão vazio', () => {
  igual(valoresIniciais('carga', '8-12', [carga(60, 10)], [carga(60, 10), carga(65, 9)]), { carga: 65, reps: 8 });
  igual(valoresIniciais('carga', '8-12', [], [carga(40, 10)]), { carga: 40, reps: 8 });
  igual(valoresIniciais('carga', '10', [carga(50, 10)], [carga(50, 10)]), { carga: 50, reps: 10 });
  igual(valoresIniciais('carga', '6-8', [], []), { carga: null, reps: 6 }, 'sem nenhum histórico: carga vazia (sem padrão)');
});

// ---------- Banco de teste: seriesDaUltimaVez e a tela montada ----------

const NOME_TESTE = 'nivel-teste-comparacao';
let db = null;
let catalogo = null;

async function apagarBancoDeTeste() {
  if (db) db.close();
  db = null;
  await deleteDB(NOME_TESTE);
}

async function bancoNovo() {
  await apagarBancoDeTeste();
  db = await abrirBanco({ nome: NOME_TESTE });
}

// Sessão no formato da seção 4.2.
function sessao(id, status, inicio, itens) {
  return {
    id, rotinaId: null, diaId: null, nome: 'Treino de teste', local: 'casa', itens,
    inicio, fim: status === 'concluida' ? inicio + 3600000 : null, status, descanso: null, versaoDados: catalogo.versaoDados,
  };
}

async function serie(sessaoId, exercicioId, medidas, feitaEm) {
  return adicionarSerie({ sessaoId, exercicio: catalogo.exercicioPorId.get(exercicioId), medidas }, { agora: feitaEm }, db);
}

teste('banco de teste: o nome não é o do banco real', () => {
  if (NOME_TESTE === NOME_BANCO) throw new Error('o teste usaria o banco real');
});

teste('preparação: catálogo real e banco de teste vazio', async () => {
  catalogo = await carregarCatalogo();
  igual(catalogo.exercicioPorId.get('flexao-no-chao').tipo, 'corpo');
  igual(catalogo.exercicioPorId.get('supino-reto-barra').tipo, 'carga');
  await bancoNovo();
  igual(await db.count('series'), 0);
});

teste('seriesDaUltimaVez (banco): último concluído; ignora o atual, o em andamento e outros exercícios', async () => {
  const item = { exercicioId: 'supino-reto-barra', trilhaId: null, series: 3, alvo: '8-12', descanso: 90 };
  await db.put('sessoes', sessao('velha', 'concluida', 1000, [item]));
  await db.put('sessoes', sessao('ultima', 'concluida', 5000, [item]));
  await db.put('sessoes', sessao('aberta', 'andamento', 8000, [item]));
  await db.put('sessoes', sessao('atual', 'andamento', 9000, [item]));
  await serie('velha', 'supino-reto-barra', { carga: 50, reps: 10 }, 1100);
  await serie('ultima', 'supino-reto-barra', { carga: 62.5, reps: 8 }, 5200);
  await serie('ultima', 'supino-reto-barra', { carga: 60, reps: 10 }, 5100);
  await serie('ultima', 'flexao-no-chao', { reps: 20 }, 5300);
  await serie('aberta', 'supino-reto-barra', { carga: 80, reps: 5 }, 8100);
  await serie('atual', 'supino-reto-barra', { carga: 90, reps: 3 }, 9100);

  const antes = await seriesDaUltimaVez('supino-reto-barra', 'atual', db);
  igual(antes.map((x) => [x.sessaoId, x.carga, x.reps]), [['ultima', 60, 10], ['ultima', 62.5, 8]]);
  igual(await seriesDaUltimaVez('prancha-alta', 'atual', db), [], 'exercício nunca feito');
});

// Monta a tela Treino num container fora da vista, com o banco e o catálogo de teste.
async function montarTela(sessaoId) {
  const container = document.createElement('div');
  container.hidden = true;
  document.body.append(container);
  const limpeza = await renderTreino(container, { id: sessaoId }, { db, catalogo });
  const ler = (seletor) => [...container.querySelectorAll(seletor)];
  const tela = {
    antes: ler('.treino-antes').map((el) => el.textContent),
    bolinhas: ler('.treino-bolinha:not(.treino-bolinha-vazia)').map((el) => el.textContent),
    vazias: ler('.treino-bolinha-vazia').length,
    mais: ler('.treino-mais').map((el) => el.textContent),
    laranja: ler('.treino-mais').map((el) => el.classList.contains('treino-mais-mais')),
    contador: ler('.contador-numero').map((el) => el.value),
    registrar: ler('.botao-grande').map((el) => el.textContent),
  };
  if (limpeza) limpeza();
  container.remove();
  return tela;
}

teste('tela Treino com 2 treinos no banco (1 concluído, 1 em andamento): "antes" vem só do concluído', async () => {
  await bancoNovo();
  const item = { exercicioId: 'flexao-no-chao', trilhaId: null, series: 4, alvo: '12', descanso: 90 };
  await db.put('sessoes', sessao('concluido', 'concluida', 1000, [item]));
  await db.put('sessoes', sessao('em-andamento', 'andamento', 50000, [item]));
  await serie('concluido', 'flexao-no-chao', { reps: 20 }, 1100);
  await serie('concluido', 'flexao-no-chao', { reps: 20 }, 1200);
  await serie('concluido', 'flexao-no-chao', { reps: 18 }, 1300);
  await serie('em-andamento', 'flexao-no-chao', { reps: 22 }, 50100);
  await serie('em-andamento', 'flexao-no-chao', { reps: 20 }, 50200);

  const tela = await montarTela('em-andamento');
  igual(tela.antes, ['Antes 20 · 20 · 18'], 'linha "antes" = treino concluído (não 22 · 20 do em andamento)');
  igual(tela.bolinhas, ['22', '20']);
  igual(tela.vazias, 2);
  igual(tela.mais, ['+2', '=']);
  igual(tela.laranja, [true, false], 'só o ganho fica em laranja');
  igual(tela.contador, ['18'], 'série 3 começa com a série 3 de antes');
  igual(tela.registrar, ['Registrar série 3']);
});

teste('tela Treino: outro treino em andamento, mais novo que o concluído, também é ignorado', async () => {
  // Dado quebrado (a regra é no máximo 1 em andamento), mas prova que o "antes" exige status concluída
  // e não só "não é o treino atual".
  const item = { exercicioId: 'flexao-no-chao', trilhaId: null, series: 4, alvo: '12', descanso: 90 };
  await db.put('sessoes', sessao('outro-aberto', 'andamento', 30000, [item]));
  await serie('outro-aberto', 'flexao-no-chao', { reps: 40 }, 30100);
  const tela = await montarTela('em-andamento');
  igual(tela.antes, ['Antes 20 · 20 · 18']);
  igual(tela.mais, ['+2', '=']);
  await db.delete('sessoes', 'outro-aberto');
});

teste('tela Treino: série além das de antes fica sem +1 e o contador começa na meta', async () => {
  await serie('em-andamento', 'flexao-no-chao', { reps: 17 }, 50300);
  const tela = await montarTela('em-andamento');
  igual(tela.bolinhas, ['22', '20', '17']);
  igual(tela.mais, ['+2', '=', `${M}1`]);
  igual(tela.laranja, [true, false, false]);
  igual(tela.contador, ['12'], 'série 4 não existe em antes: meta da rotina (alvo 12)');

  await serie('em-andamento', 'flexao-no-chao', { reps: 15 }, 50400);
  await serie('em-andamento', 'flexao-no-chao', { reps: 15 }, 50500); // série extra (5 de 4)
  const final = await montarTela('em-andamento');
  igual(final.bolinhas, ['22', '20', '17', '15', '15']);
  igual(final.mais, ['+2', '=', `${M}1`], 'as séries 4 e 5 não têm antes');
});

teste('tela Treino sem treino concluído: sem linha "antes" e sem +1', async () => {
  await db.delete('sessoes', 'concluido');
  const tela = await montarTela('em-andamento');
  igual(tela.antes, []);
  igual(tela.mais, []);
  igual(tela.bolinhas.length, 5);
});

teste('tela Treino de carga: antes, +1 com a regra da carga e contador com carga e reps de antes', async () => {
  await bancoNovo();
  const item = { exercicioId: 'supino-reto-barra', trilhaId: null, series: 3, alvo: '8-12', descanso: 90 };
  await db.put('sessoes', sessao('concluido', 'concluida', 1000, [item]));
  await db.put('sessoes', sessao('em-andamento', 'andamento', 50000, [item]));
  await serie('concluido', 'supino-reto-barra', { carga: 60, reps: 10 }, 1100);
  await serie('concluido', 'supino-reto-barra', { carga: 60, reps: 10 }, 1200);
  await serie('concluido', 'supino-reto-barra', { carga: 60, reps: 8 }, 1300);
  await serie('em-andamento', 'supino-reto-barra', { carga: 62.5, reps: 10 }, 50100);
  await serie('em-andamento', 'supino-reto-barra', { carga: 65, reps: 8 }, 50200);

  const tela = await montarTela('em-andamento');
  igual(tela.antes, ['Antes 60×10 · 60×10 · 60×8']);
  igual(tela.mais, ['+2,5 kg', `+5 kg ${M}2`]);
  igual(tela.laranja, [true, false], 'mais carga com menos reps não é ganho');
  igual(tela.contador, ['60', '8'], 'carga e reps da série 3 de antes');
});

teste('tela Treino de carga sem nenhum histórico: carga vazia e "Registrar série" bloqueado até preencher', async () => {
  await bancoNovo();
  const item = { exercicioId: 'supino-reto-barra', trilhaId: null, series: 3, alvo: '8-12', descanso: 90 };
  await db.put('sessoes', sessao('em-andamento', 'andamento', 50000, [item]));

  const container = document.createElement('div');
  container.hidden = true;
  document.body.append(container);
  const limpeza = await renderTreino(container, { id: 'em-andamento' }, { db, catalogo });
  try {
    const [cargaEl, repsEl] = container.querySelectorAll('.contador-numero');
    const botao = () => container.querySelector('.botao-grande');
    igual(cargaEl.value, '', 'carga começa vazia (sem 10 kg)');
    igual(cargaEl.placeholder, 'Digite a carga (kg)');
    igual(repsEl.value, '8', 'reps na meta da rotina');
    igual(botao().disabled, true, 'registrar bloqueado com a carga vazia');

    const digitar = (texto) => {
      cargaEl.value = texto;
      cargaEl.dispatchEvent(new Event('input'));
    };
    digitar('0');
    igual(botao().disabled, true, 'carga 0 não é válida');
    digitar('abc');
    igual(botao().disabled, true, 'texto não é carga');
    digitar('40');
    igual(botao().disabled, false, 'carga válida libera o botão');
    digitar('');
    igual(botao().disabled, true, 'apagar de novo bloqueia');
    digitar('42,5');
    igual(botao().disabled, false);

    botao().click();
    for (let i = 0; i < 100 && !container.querySelector('.treino-bolinha:not(.treino-bolinha-vazia)'); i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    const series = await db.getAll('series');
    igual(series.map((x) => [x.carga, x.reps]), [[42.5, 8]], 'gravou a carga digitada');
    const [cargaDepois] = container.querySelectorAll('.contador-numero');
    igual(cargaDepois.value, '42,5', 'série 2 começa com a última carga de hoje');
    igual(botao().disabled, false);
  } finally {
    if (limpeza) limpeza();
    container.remove();
  }
});

teste('banco de teste: é apagado no fim', async () => {
  await apagarBancoDeTeste();
  const bancos = indexedDB.databases ? await indexedDB.databases() : [];
  igual(bancos.some((b) => b.name === NOME_TESTE), false);
});
