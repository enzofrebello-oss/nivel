// descanso.test.js: testes do Descanso (PROJETO.md, etapa 15): js/logica/descanso.js, as funções do
// cronômetro que o descanso usa (ajustar, fimEm, retomar, fracaoRestante) e a gravação em sessao.descanso
// (js/db/sessoes.js, salvarDescanso). Instantes fixos (sem esperar de verdade). No fim, a tela Treino
// montada: descanso entre exercícios com o "a seguir", reabrir no meio, −15/+15, Pular e sem descanso
// depois da última série do treino.
// O banco é separado, 'nivel-teste-descanso', apagado no começo e no fim; NUNCA o banco real 'nivel'.

import { teste, igual, lanca } from './mini-teste.js';
import { deleteDB } from '../vendor/idb/index.js';
import { abrirBanco, NOME_BANCO } from '../js/db/conexao.js';
import { obterSessao, salvarDescanso } from '../js/db/sessoes.js';
import { carregarCatalogo } from '../js/catalogo.js';
import { render as renderTreino } from '../js/telas/treino.js';
import {
  rodando, segundosRestantes, zerou, restanteMs, ajustar, fimEm, retomar, fracaoRestante, novoCronometro,
} from '../js/logica/cronometro.js';
import {
  DESCANSO_PADRAO, duracaoDoItem, deveDescansar, comecarDescanso, ajustarDescanso, paraSalvar, doSalvo,
  textoASeguir,
} from '../js/logica/descanso.js';

const itens = [
  { exercicioId: 'a', series: 3, descanso: 90 },
  { exercicioId: 'b', series: 2, descanso: 45 },
];

// ---------- Quando descansar e quanto ----------

teste('descanso: duração = descanso do item', () => {
  igual(duracaoDoItem(itens[0]), 90);
  igual(duracaoDoItem(itens[1]), 45);
});

teste('descanso: item sem descanso válido usa o padrão', () => {
  igual(duracaoDoItem({ series: 3 }), DESCANSO_PADRAO);
  igual(duracaoDoItem({ descanso: 0 }), DESCANSO_PADRAO);
  igual(duracaoDoItem({ descanso: 'x' }), DESCANSO_PADRAO);
  igual(duracaoDoItem(undefined), DESCANSO_PADRAO);
});

teste('descanso: depois de uma série no meio do exercício, descansa', () => {
  igual(deveDescansar(itens, [1, 0]), true);
});

teste('descanso: depois da última série de um exercício (com outro pendente), descansa', () => {
  igual(deveDescansar(itens, [3, 0]), true);
  igual(deveDescansar(itens, [0, 2]), true, 'último da lista feito, primeiro pendente');
});

teste('descanso: depois da última série do treino, NÃO descansa', () => {
  igual(deveDescansar(itens, [3, 2]), false);
  igual(deveDescansar(itens, [5, 2]), false, 'série extra com tudo feito');
  igual(deveDescansar([{ exercicioId: 'a', series: 1, descanso: 60 }], [1]), false, 'treino de 1 série');
});

// ---------- Contagem pelo horário de término ----------

teste('descanso: começa rodando com o tempo inteiro e termina em agora + duração', () => {
  const c = comecarDescanso(90, 1000);
  igual(rodando(c), true);
  igual(segundosRestantes(c, 1000), 90);
  igual(fimEm(c), 91000);
  igual(paraSalvar(c), { ate: 91000, duracao: 90 });
});

teste('descanso: o tempo vem do horário de término (aba minimizada / tela apagada)', () => {
  const c = comecarDescanso(60, 0);
  igual(segundosRestantes(c, 25000), 35, 'sem nenhum tique no meio');
  igual(zerou(c, 59999), false);
  igual(zerou(c, 60000), true);
  igual(restanteMs(c, 600000), 0, 'muito depois: zerado, nunca negativo');
});

teste('descanso: gravar e retomar (recarregar no meio) dá o mesmo tempo', () => {
  const c = comecarDescanso(90, 0);
  const salvo = paraSalvar(c);
  const depois = doSalvo(salvo, 30000);
  igual(segundosRestantes(depois, 30000), 60);
  igual(segundosRestantes(depois, 80000), 10);
  igual(fimEm(depois), 90000, 'o término não muda');
  igual(depois.total, 90);
});

teste('descanso: retomar depois do fim volta zerado', () => {
  const c = doSalvo({ ate: 5000, duracao: 60 }, 9000);
  igual(zerou(c, 9000), true);
});

teste('descanso: nada gravado ou dado inválido = sem descanso', () => {
  igual(doSalvo(null, 0), null);
  igual(doSalvo(undefined, 0), null);
  igual(doSalvo({ ate: 'x', duracao: 60 }, 0), null);
  igual(doSalvo({ ate: 1000, duracao: 0 }, 0), null);
  igual(doSalvo({ ate: 1000, duracao: 1.5 }, 0), null);
});

teste('cronômetro: retomar recusa total ou término inválidos', () => {
  lanca(() => retomar(0, 1000, 0));
  lanca(() => retomar(30, NaN, 0));
});

// ---------- −15 s / +15 s ----------

teste('descanso: +15 s empurra o término 15 s', () => {
  let c = comecarDescanso(90, 0);
  c = ajustarDescanso(c, 1, 10000);
  igual(segundosRestantes(c, 10000), 95);
  igual(fimEm(c), 105000);
  igual(rodando(c), true);
});

teste('descanso: −15 s puxa o término 15 s', () => {
  let c = comecarDescanso(90, 0);
  c = ajustarDescanso(c, -1, 10000);
  igual(segundosRestantes(c, 10000), 65);
  igual(fimEm(c), 75000);
});

teste('descanso: −15 s com menos de 15 s restantes zera (nunca negativo)', () => {
  let c = comecarDescanso(30, 0);
  c = ajustarDescanso(c, -1, 20000);
  igual(zerou(c, 20000), true);
  igual(restanteMs(c, 20000), 0);
});

teste('descanso: +15 s além do total aumenta o total (anel não passa de cheio)', () => {
  let c = comecarDescanso(60, 0);
  c = ajustarDescanso(c, 1, 0);
  igual(c.total, 75);
  igual(fracaoRestante(c, 0), 1);
  igual(paraSalvar(c), { ate: 75000, duracao: 75 });
});

teste('descanso: −15 s não muda o total (o anel mostra o que já passou)', () => {
  let c = comecarDescanso(60, 0);
  c = ajustarDescanso(c, -1, 0);
  igual(c.total, 60);
  igual(fracaoRestante(c, 0), 0.75);
});

teste('cronômetro: ajustar pausado continua pausado', () => {
  const c = ajustar(novoCronometro(30), 15, 5000);
  igual(rodando(c), false);
  igual(segundosRestantes(c, 99999), 45);
  igual(fimEm(c), null);
});

teste('cronômetro: fração do anel vai de 1 a 0', () => {
  const c = comecarDescanso(100, 0);
  igual(fracaoRestante(c, 0), 1);
  igual(fracaoRestante(c, 50000), 0.5);
  igual(fracaoRestante(c, 100000), 0);
  igual(fracaoRestante(c, 200000), 0);
});

// ---------- "A seguir" ----------

teste('descanso: "a seguir" mostra o exercício e a próxima série', () => {
  igual(textoASeguir('Flexão no chão', 2, 4), 'Flexão no chão · série 3 de 4');
  igual(textoASeguir('Agachamento', 0, 3), 'Agachamento · série 1 de 3', 'próximo exercício');
  igual(textoASeguir('Flexão no chão', 4, 4), 'Flexão no chão · série extra 5');
});

// ---------- Gravação em sessao.descanso ----------

const NOME_TESTE = 'nivel-teste-descanso';
let db = null;

async function apagarBancoDeTeste() {
  if (db) db.close();
  db = null;
  await deleteDB(NOME_TESTE);
}

const SESSAO = {
  id: 's-1', rotinaId: 'massa-3-casa', diaId: 'a', nome: 'A · Empurrar', local: 'casa',
  itens: [{ exercicioId: 'flexao-no-chao', trilhaId: 'flexoes', series: 4, alvo: '12', descanso: 90 }],
  inicio: 1760790000000, fim: null, status: 'andamento', descanso: null, versaoDados: 1,
};

teste('banco de teste: o nome não é o do banco real', () => {
  if (NOME_TESTE === NOME_BANCO) throw new Error('o teste usaria o banco real');
});

teste('salvarDescanso: grava { ate, duracao } e limpa com null', async () => {
  await apagarBancoDeTeste();
  db = await abrirBanco({ nome: NOME_TESTE });
  await db.put('sessoes', SESSAO);
  const salvo = paraSalvar(comecarDescanso(90, 1000));
  await salvarDescanso('s-1', salvo, db);
  igual((await obterSessao('s-1', db)).descanso, { ate: 91000, duracao: 90 });
  // Recarregar: o que foi lido do banco dá o mesmo tempo.
  const lido = doSalvo((await obterSessao('s-1', db)).descanso, 31000);
  igual(segundosRestantes(lido, 31000), 60);
  await salvarDescanso('s-1', null, db);
  const depois = await obterSessao('s-1', db);
  igual(depois.descanso, null);
  igual({ ...depois, descanso: null }, SESSAO, 'o resto da sessão não muda');
});

teste('salvarDescanso: recusa descanso inválido', async () => {
  let erro = null;
  try {
    await salvarDescanso('s-1', { ate: 1000, duracao: 0 }, db);
  } catch (e) {
    erro = e.message;
  }
  igual(erro, 'Descanso inválido.');
});

teste('salvarDescanso: sessão inexistente ou finalizada não grava', async () => {
  igual(await salvarDescanso('nao-existe', { ate: 1000, duracao: 60 }, db), null);
  await db.put('sessoes', { ...SESSAO, id: 's-2', status: 'concluida', fim: 1760793600000 });
  igual(await salvarDescanso('s-2', { ate: 1000, duracao: 60 }, db), null);
  igual((await obterSessao('s-2', db)).descanso, null);
});

// Espera até achar o seletor no container (ou desiste em ~2 s).
async function esperar(container, seletor) {
  for (let i = 0; i < 100 && !container.querySelector(seletor); i++) await new Promise((r) => setTimeout(r, 20));
  return container.querySelector(seletor);
}

teste('tela Treino: descanso entre exercícios, reabrir no meio, −15/+15, Pular e nada depois da última série', async () => {
  const catalogo = await carregarCatalogo();
  const itensTela = [
    { exercicioId: 'flexao-no-chao', trilhaId: null, series: 1, alvo: '10', descanso: 45 },
    { exercicioId: 'flexao-diamante', trilhaId: null, series: 1, alvo: '8', descanso: 60 },
  ];
  await db.put('sessoes', { ...SESSAO, id: 's-tela', itens: itensTela });
  const container = document.createElement('div');
  container.hidden = true;
  document.body.append(container);
  let limpeza = await renderTreino(container, { id: 's-tela' }, { db, catalogo });
  const botaoCom = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent === texto);
  try {
    // Última (e única) série do 1º exercício: descansa os 45 s dele antes do próximo.
    document.querySelectorAll('.toast').forEach((t) => t.remove()); // toasts de testes anteriores
    const antes = Date.now();
    botaoCom('Registrar série 1').click();
    igual(Boolean(await esperar(container, '.descanso')), true, 'abriu o descanso');
    const toastProximo = [...document.querySelectorAll('.toast')].some((t) => t.textContent.startsWith('Próximo:'));
    igual(toastProximo, false, 'sem o toast "Próximo" durante o descanso (já tem "A seguir")');
    const gravado = (await obterSessao('s-tela', db)).descanso;
    igual(gravado.duracao, 45);
    igual(gravado.ate >= antes + 45000 && gravado.ate <= Date.now() + 45000, true, 'término = agora + 45 s');
    igual(container.querySelector('.descanso-seguir').textContent, 'A seguir Flexão diamante · série 1 de 1');
    igual(container.querySelector('.descanso-tempo').textContent, '0:45');
    igual(Boolean(container.querySelector('.anel svg')), true, 'anel desenhado');

    // Reabrir a tela (como recarregar o app): continua no descanso, com o mesmo término.
    limpeza();
    container.replaceChildren();
    limpeza = await renderTreino(container, { id: 's-tela' }, { db, catalogo });
    igual(Boolean(container.querySelector('.descanso')), true, 'reabriu no descanso');
    igual((await obterSessao('s-tela', db)).descanso.ate, gravado.ate);

    // −15 s e +15 s mudam o término gravado.
    botaoCom('−15 s').click();
    await new Promise((r) => setTimeout(r, 100));
    const menos = (await obterSessao('s-tela', db)).descanso.ate;
    igual(Math.abs(menos - (gravado.ate - 15000)) < 1000, true, `−15 s: ${menos - gravado.ate} ms`);
    botaoCom('+15 s').click();
    await new Promise((r) => setTimeout(r, 100));
    const mais = (await obterSessao('s-tela', db)).descanso.ate;
    igual(Math.abs(mais - gravado.ate) < 1000, true, `+15 s: ${mais - gravado.ate} ms`);

    // Pular: volta para a série (do próximo exercício) e limpa o descanso.
    botaoCom('Pular descanso').click();
    await esperar(container, '.contador-numero');
    igual(Boolean(container.querySelector('.descanso')), false);
    igual((await obterSessao('s-tela', db)).descanso, null);
    igual(container.querySelector('.treino-exercicio-nome').textContent, 'Flexão diamante');

    // Última série do treino: sem descanso.
    botaoCom('Registrar série 1').click();
    await esperar(container, '.treino-final');
    igual(Boolean(container.querySelector('.descanso')), false, 'sem descanso no fim do treino');
    igual((await obterSessao('s-tela', db)).descanso, null);
  } finally {
    if (limpeza) limpeza();
    container.remove();
  }
});

teste('tela Treino: ao zerar, vibra e volta sozinho para a série', async () => {
  const catalogo = await carregarCatalogo();
  await db.put('sessoes', {
    ...SESSAO,
    id: 's-zera',
    itens: [{ exercicioId: 'flexao-no-chao', trilhaId: null, series: 3, alvo: '10', descanso: 1 }],
  });
  const vibrou = [];
  const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'vibrate');
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (p) => { vibrou.push(p); return true; } });
  const container = document.createElement('div');
  container.hidden = true;
  document.body.append(container);
  const limpeza = await renderTreino(container, { id: 's-zera' }, { db, catalogo });
  try {
    [...container.querySelectorAll('button')].find((b) => b.textContent === 'Registrar série 1').click();
    await esperar(container, '.descanso');
    igual(Boolean(container.querySelector('.descanso')), true, 'abriu o descanso de 1 s');
    for (let i = 0; i < 150 && !container.querySelector('.contador-numero'); i++) await new Promise((r) => setTimeout(r, 20));
    igual(Boolean(container.querySelector('.descanso')), false, 'saiu do descanso sozinho');
    igual(container.querySelector('.treino-exercicio-nome').textContent, 'Flexão no chão', 'volta para a série 2');
    igual(vibrou.length, 1, 'vibrou uma vez');
    igual((await obterSessao('s-zera', db)).descanso, null);
  } finally {
    if (limpeza) limpeza();
    container.remove();
    delete navigator.vibrate;
    if (original && !('vibrate' in navigator)) Object.defineProperty(Navigator.prototype, 'vibrate', original);
  }
});

teste('tela Treino: descanso que já acabou com o app fechado só é limpo', async () => {
  const catalogo = await carregarCatalogo();
  await db.put('sessoes', {
    ...SESSAO,
    id: 's-velho',
    itens: [{ exercicioId: 'flexao-no-chao', trilhaId: null, series: 3, alvo: '10', descanso: 45 }],
    descanso: { ate: Date.now() - 1000, duracao: 45 },
  });
  const container = document.createElement('div');
  container.hidden = true;
  document.body.append(container);
  const limpeza = await renderTreino(container, { id: 's-velho' }, { db, catalogo });
  try {
    igual(Boolean(container.querySelector('.descanso')), false);
    igual(Boolean(container.querySelector('.contador-numero')), true, 'mostra a série');
    await new Promise((r) => setTimeout(r, 100));
    igual((await obterSessao('s-velho', db)).descanso, null);
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
