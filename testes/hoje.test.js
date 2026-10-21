// hoje.test.js: testes da etapa 16b (PROJETO.md, "16b. Hoje novo"):
// - funções puras (js/logica/hoje.js e js/logica/datas.js): data sugerida do próximo treino
//   (último treino concluído + intervalo, nunca antes de hoje, sem treino = hoje): rotina de 3 dias = 2;
//   rotina de 4 dias alterna 1 e 2 (treina, treina, descansa); as três situações (dia de treino, já treinou hoje, dia de descanso); data por
//   extenso; frases motivacionais (sorteio e frase fixa por treino);
// - banco: finalizar grava a frase na sessão; o backup aceita a frase e recusa uma inválida;
// - tela Hoje com um "agora" fixo (quarta, 21/10/2026): as três situações, o diálogo do dia de descanso
//   ("Não" não começa, "Sim" começa, sem "Fechar"), a linha compacta do próximo treino que abre o card
//   completo, o ↻ com confirmação ("Não" não refaz, "Sim" refaz o mesmo treino do zero) e o calendário
//   marcando o dia uma vez só com dois treinos.
// O banco é separado, 'nivel-teste-hoje', apagado no começo e no fim; NUNCA o banco real 'nivel'.

import { teste, igual } from './mini-teste.js';
import { deleteDB } from '../vendor/idb/index.js';
import { abrirBanco, NOME_BANCO } from '../js/db/conexao.js';
import { carregarCatalogo } from '../js/catalogo.js';
import { gravarMeta } from '../js/db/meta.js';
import {
  iniciarSessao, finalizarSessao, descartarSessao, listarSessoes, sessaoEmAndamento, obterSessao,
} from '../js/db/sessoes.js';
import { exportarBackup, backupParaTexto, lerBackup } from '../js/db/backup.js';
import { textoDataLonga, somarDias, inicioDoDia } from '../js/logica/datas.js';
import {
  FRASES, intervaloEntreTreinos, proximaDataTreino, situacaoDoHoje, sortearFrase, fraseDaSessao,
  concluidaAntesDoDia,
} from '../js/logica/hoje.js';
import {
  render as renderHoje, ROTULO_CONCLUIDO, TITULO_CONCLUIDO, TEXTO_DESCANSO, PERGUNTA_HOJE, perguntaRefazer,
} from '../js/telas/hoje.js';

const NOME_TESTE = 'nivel-teste-hoje';
let db = null;
let catalogo = null;

// Datas locais fixas (outubro de 2026: seg 19, ter 20, qua 21, qui 22, sex 23, sáb 24, dom 25).
const dia = (d, hora = 12, min = 0) => new Date(2026, 9, d, hora, min).getTime();
const meiaNoite = (d) => new Date(2026, 9, d).getTime();
const QUARTA = dia(21); // o "hoje" dos testes de tela

const concluida = (inicio, extra = {}) => ({ id: `s${inicio}`, status: 'concluida', inicio, fim: inicio + 3600000, ...extra });

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
async function esperarAte(condicao) {
  for (let i = 0; i < 150; i++) {
    if (await condicao()) return true;
    await pausa(20);
  }
  return false;
}
function montarContainer() {
  const container = document.createElement('div');
  container.hidden = true;
  document.body.append(container);
  return container;
}
const botaoCom = (raiz, texto) => [...raiz.querySelectorAll('button')].find((b) => b.textContent === texto);
const modal = () => document.querySelector('dialog.modal[open]');
function limparRestos() {
  document.querySelectorAll('dialog.modal').forEach((d) => { if (d.open) d.close(); d.remove(); });
  history.replaceState(null, '', location.pathname + location.search);
}

// Apaga todas as sessões do banco de teste (cada teste de tela começa do zero).
async function apagarSessoes() {
  const tx = db.transaction(['sessoes', 'series'], 'readwrite');
  await tx.objectStore('sessoes').clear();
  await tx.objectStore('series').clear();
  await tx.done;
}

// Treino concluído pelo mesmo caminho do app (começar e finalizar), com o início e o fim dados.
async function treinoConcluido(rotina, diaId, inicio, frase) {
  const d = rotina.dias.find((x) => x.id === diaId);
  const { sessao } = await iniciarSessao({
    rotinaId: rotina.id, diaId: d.id, nome: d.nome, local: rotina.local, versaoDados: catalogo.versaoDados,
    itens: [{ exercicioId: 'flexao-no-chao', trilhaId: null, series: 2, alvo: '10', descanso: 60 }],
  }, { agora: inicio }, db);
  return finalizarSessao(sessao.id, { agora: inicio + 40 * 60000, frase }, db);
}

// ---------- Datas ----------

teste('textoDataLonga: "Terça, 20 de outubro" (sem "-feira", mês em minúsculas)', () => {
  igual(textoDataLonga(dia(20)), 'Terça, 20 de outubro');
  igual(textoDataLonga(dia(25, 23, 59)), 'Domingo, 25 de outubro');
  igual(textoDataLonga(new Date(2026, 2, 1).getTime()), 'Domingo, 1 de março');
});

teste('somarDias: meia-noite local, vira o mês e o ano', () => {
  igual(somarDias(dia(21, 18), 2), meiaNoite(23));
  igual(somarDias(dia(30), 2), new Date(2026, 10, 1).getTime());
  igual(somarDias(new Date(2026, 11, 31, 9).getTime(), 1), new Date(2027, 0, 1).getTime());
});

// ---------- Data sugerida do próximo treino ----------

teste('intervalo: 3 dias = 2; 4 dias alterna 1 e 2; outras = Math.round(7 ÷ dias)', () => {
  igual(intervaloEntreTreinos(3), 2);
  igual(intervaloEntreTreinos(3, dia(22), dia(21)), 2, '3 dias: 2 mesmo depois de dois dias seguidos');
  igual(intervaloEntreTreinos(4, dia(22)), 1, '4 dias, um treino só: 1');
  igual(intervaloEntreTreinos(4, dia(22), dia(21)), 2, '4 dias, o anterior foi na véspera: 2');
  igual(intervaloEntreTreinos(4, dia(22), dia(20)), 1, '4 dias, o anterior não foi na véspera: 1');
  igual(intervaloEntreTreinos(4, dia(22, 7), dia(21, 23, 50)), 2, 'conta o dia do início, não 24 h');
  igual(intervaloEntreTreinos(2), 4, '3,5 arredonda para 4');
  igual(intervaloEntreTreinos(7), 1);
  igual(intervaloEntreTreinos(undefined), 1, 'sem rotina = 1');
});

teste('próxima data, rotina de 3 dias: último treino + 2 dias', () => {
  // Treinou na segunda (19) às 18h: a sugerida é quarta (21), meia-noite.
  igual(proximaDataTreino(dia(19, 18), 3, dia(20, 9)), meiaNoite(21), 'vista da terça');
  igual(proximaDataTreino(dia(19, 18), 3, dia(21, 7)), meiaNoite(21), 'vista da própria quarta');
  // Treino que começou às 23h50 conta para o dia do início.
  igual(proximaDataTreino(dia(19, 23, 50), 3, dia(20)), meiaNoite(21));
  // Com dois dias seguidos (20 e 21), continua + 2.
  igual(proximaDataTreino(dia(21, 8), 3, dia(21, 20), dia(20, 8)), meiaNoite(23), 'dias seguidos: + 2');
});

teste('próxima data, rotina de 4 dias: alterna 1 e 2 (treina, treina, descansa)', () => {
  // Um treino só (quinta 22): + 1, sexta.
  igual(proximaDataTreino(dia(22, 7), 4, dia(22, 20)), meiaNoite(23), 'um treino só: sexta');
  igual(proximaDataTreino(dia(22, 7), 4, dia(22, 20), null), meiaNoite(23));
  // Quarta (21) e quinta (22): o anterior foi na véspera, + 2: sábado.
  igual(proximaDataTreino(dia(22, 7), 4, dia(22, 20), dia(21, 7)), meiaNoite(24), 'treina, treina: descansa');
  // Terça (20) e quinta (22): o anterior não foi na véspera, + 1: sexta.
  igual(proximaDataTreino(dia(22, 7), 4, dia(23), dia(20, 7)), meiaNoite(23), 'depois do descanso: + 1');
});

teste('situação, rotina de 4 dias: a semana alterna (seg, ter, descansa, qui, sex, descansa)', () => {
  const seg = concluida(dia(19, 8));
  const ter = concluida(dia(20, 8));
  const qui = concluida(dia(22, 8));
  const sex = concluida(dia(23, 8));
  const quatro = (sessoes, agora) => situacaoDoHoje({ sessoes, diasPorSemana: 4, agora });
  igual(quatro([seg], dia(19, 20)).proxima, meiaNoite(20), 'só segunda: terça');
  igual(quatro([seg, ter], dia(20, 20)).proxima, meiaNoite(22), 'segunda e terça: quinta');
  igual(quatro([seg, ter], dia(21)).situacao, 'descanso', 'quarta descansa');
  igual(quatro([seg, ter, qui], dia(22, 20)).proxima, meiaNoite(23), 'quinta: sexta');
  igual(quatro([seg, ter, qui, sex], dia(23, 20)).proxima, meiaNoite(25), 'quinta e sexta: domingo');
  // Dois treinos no mesmo dia (↻) contam como um dia só.
  const terRefeito = concluida(dia(20, 19));
  igual(quatro([seg, ter, terRefeito], dia(20, 21)).proxima, meiaNoite(22), '↻ na terça: continua quinta');
  igual(concluidaAntesDoDia([seg, ter, terRefeito], terRefeito.inicio).id, seg.id, 'o anterior é o de segunda');
  igual(concluidaAntesDoDia([ter], ter.inicio), null);
});

teste('próxima data: nunca antes de hoje (se cair antes, vira hoje)', () => {
  // Rotina de 3 dias: último treino na segunda (19) daria quarta (21); vista do sábado (24), é o sábado.
  igual(proximaDataTreino(dia(19), 3, dia(24, 15)), meiaNoite(24));
  // Rotina de 4 dias: último treino há um mês.
  igual(proximaDataTreino(new Date(2026, 8, 10).getTime(), 4, dia(21, 22)), meiaNoite(21));
  igual(proximaDataTreino(dia(15), 4, dia(21, 22), dia(14)), meiaNoite(21), '4 dias, + 2 também não volta');
});

teste('próxima data: sem treino concluído, o próximo é hoje', () => {
  igual(proximaDataTreino(null, 3, dia(21, 15)), meiaNoite(21));
  igual(proximaDataTreino(undefined, 4, dia(21, 15)), meiaNoite(21));
});

// ---------- Três situações ----------

teste('situação "treino": sem nenhum treino concluído (e em andamento não conta)', () => {
  const r = situacaoDoHoje({ sessoes: [{ id: 'x', status: 'andamento', inicio: dia(21, 8), fim: null }], diasPorSemana: 3, agora: QUARTA });
  igual(r, { situacao: 'treino', proxima: meiaNoite(21), concluida: null });
  igual(situacaoDoHoje({ sessoes: [], diasPorSemana: 4, agora: QUARTA }).situacao, 'treino');
});

teste('situação "treino": a data sugerida é hoje ou já passou', () => {
  igual(situacaoDoHoje({ sessoes: [concluida(dia(19, 18))], diasPorSemana: 3, agora: QUARTA }).situacao, 'treino', 'é hoje');
  igual(situacaoDoHoje({ sessoes: [concluida(dia(15))], diasPorSemana: 4, agora: QUARTA }).situacao, 'treino', 'já passou');
});

teste('situação "concluido": já treinou hoje (o mais recente de hoje); próxima pela regra', () => {
  const manha = concluida(dia(21, 7));
  const noite = concluida(dia(21, 19));
  const r = situacaoDoHoje({ sessoes: [concluida(dia(19)), noite, manha], diasPorSemana: 3, agora: dia(21, 21) });
  igual(r.situacao, 'concluido');
  igual(r.concluida.id, noite.id, 'o mais recente de hoje');
  igual(r.proxima, meiaNoite(23));
  igual(situacaoDoHoje({ sessoes: [manha], diasPorSemana: 4, agora: dia(21, 21) }).proxima, meiaNoite(22), '4 dias, um treino só: + 1');
  igual(situacaoDoHoje({ sessoes: [concluida(dia(20)), manha], diasPorSemana: 4, agora: dia(21, 21) }).proxima, meiaNoite(23), '4 dias, ontem e hoje: + 2');
});

teste('situação "descanso": a data sugerida é depois de hoje', () => {
  const r = situacaoDoHoje({ sessoes: [concluida(dia(20, 18))], diasPorSemana: 3, agora: QUARTA });
  igual(r, { situacao: 'descanso', proxima: meiaNoite(22), concluida: null });
  igual(situacaoDoHoje({ sessoes: [concluida(dia(19, 6)), concluida(dia(20, 6))], diasPorSemana: 4, agora: QUARTA }).situacao, 'descanso', '4 dias: segunda e terça, quarta descansa');
  igual(situacaoDoHoje({ sessoes: [concluida(dia(20, 6))], diasPorSemana: 4, agora: QUARTA }).situacao, 'treino', '4 dias: só terça, quarta treina');
});

teste('situação: o último treino é o de maior início, de qualquer rotina', () => {
  const sessoes = [concluida(dia(20), { rotinaId: 'forca-3-casa' }), concluida(dia(15), { rotinaId: 'massa-3-casa' })];
  igual(situacaoDoHoje({ sessoes, diasPorSemana: 3, agora: QUARTA }).situacao, 'descanso');
});

// ---------- Frases ----------

teste('frases: 20, curtas, sem repetir', () => {
  igual(FRASES.length, 20);
  igual(new Set(FRASES).size, 20, 'sem repetidas');
  const longas = FRASES.filter((f) => f.length > 45 || !f.trim());
  igual(longas, [], 'até 45 caracteres');
});

teste('sortearFrase: usa o número aleatório dado e sempre devolve uma frase da lista', () => {
  igual(sortearFrase(() => 0), FRASES[0]);
  igual(sortearFrase(() => 0.9999), FRASES[19]);
  igual(sortearFrase(() => 0.5), FRASES[10]);
  igual(FRASES.includes(sortearFrase()), true);
});

teste('fraseDaSessao: a gravada; sem ela, sempre a mesma para o mesmo treino', () => {
  igual(fraseDaSessao({ id: 'a', frase: 'Hoje valeu a pena.' }), 'Hoje valeu a pena.');
  const antiga = { id: 'b0c1e2d3-sem-frase' };
  igual(FRASES.includes(fraseDaSessao(antiga)), true);
  igual(fraseDaSessao(antiga), fraseDaSessao({ ...antiga }), 'estável');
});

// ---------- Banco ----------

teste('banco de teste: o nome não é o do banco real', () => {
  igual(NOME_BANCO, 'nivel');
  if (NOME_TESTE === NOME_BANCO) throw new Error('o teste usaria o banco real');
});

teste('preparação: catálogo real e banco de teste novo', async () => {
  catalogo = await carregarCatalogo();
  await deleteDB(NOME_TESTE);
  db = await abrirBanco({ nome: NOME_TESTE });
  igual(db.name, NOME_TESTE);
  igual(await db.count('sessoes'), 0);
});

teste('finalizar grava a frase; sem frase, o registro fica sem o campo', async () => {
  const rotina = catalogo.rotinaPorId.get('massa-3-casa');
  const comFrase = await treinoConcluido(rotina, 'a', dia(10), 'Devagar e sempre.');
  igual((await obterSessao(comFrase.id, db)).frase, 'Devagar e sempre.');
  const semFrase = await treinoConcluido(rotina, 'b', dia(11));
  igual('frase' in (await obterSessao(semFrase.id, db)), false);
});

teste('backup: a frase entra no arquivo; frase vazia é recusada', async () => {
  const backup = await exportarBackup({ versaoDados: catalogo.versaoDados }, db);
  const lido = lerBackup(backupParaTexto(backup), catalogo);
  igual(lido.ok, true);
  igual(lido.backup.dados.sessoes.some((s) => s.frase === 'Devagar e sempre.'), true);
  backup.dados.sessoes[0].frase = '';
  const ruim = lerBackup(backupParaTexto(backup), catalogo);
  igual(ruim.ok, false);
  igual(ruim.erros.some((e) => e.includes('frase inválida')), true);
  await apagarSessoes();
});

// ---------- Tela Hoje (agora fixo: quarta, 21/10/2026, meio-dia) ----------

teste('tela, situação 1 (dia de treino): data grande, calendário e "Treino do dia" com "Começar treino"', async () => {
  limparRestos();
  await apagarSessoes();
  await gravarMeta('rotinaAtualId', 'massa-3-casa', db);
  const rotina = catalogo.rotinaPorId.get('massa-3-casa');
  const container = montarContainer();
  const limpeza = await renderHoje(container, {}, { db, catalogo, agora: QUARTA });
  try {
    const tela = container.querySelector('.hoje');
    igual(tela.dataset.situacao, 'treino');
    igual(container.querySelector('.hoje-data').textContent, 'Quarta, 21 de outubro');
    igual(container.querySelector('.semana-dia.hoje').getAttribute('aria-label').includes('21 de outubro'), true, 'calendário da semana de hoje');
    igual(container.querySelectorAll('.semana-dia.treinado').length, 0);
    const card = container.querySelector('.hoje-treino');
    igual(card.querySelector('.hoje-rotulo').textContent, 'Treino do dia');
    igual(card.querySelector('.hoje-treino-nome').textContent, rotina.dias[0].nome);
    igual(card.querySelectorAll('.hoje-item').length, rotina.dias[0].itens.length);
    igual(botaoCom(card, 'Começar treino').classList.contains('botao-destaque'), true, 'botão laranja');
    igual(container.querySelector('.hoje-descanso'), null);
    igual(container.querySelector('.hoje-concluido'), null);
    igual(Boolean(container.querySelector('.hoje-rotina-atual')), true, 'cartão da rotina no fim');
  } finally {
    if (limpeza) limpeza();
    container.remove();
  }
});

teste('tela, situação 3 (descanso): aviso, "Próximo treino · <data>" e o diálogo (Não não começa, Sim começa)', async () => {
  limparRestos();
  await apagarSessoes();
  const rotina = catalogo.rotinaPorId.get('massa-3-casa');
  await treinoConcluido(rotina, 'a', dia(20, 18)); // terça: a sugerida é quinta (22)
  const container = montarContainer();
  const limpeza = await renderHoje(container, {}, { db, catalogo, agora: QUARTA });
  try {
    igual(container.querySelector('.hoje').dataset.situacao, 'descanso');
    igual(container.querySelector('.hoje-descanso').textContent, TEXTO_DESCANSO);
    const card = container.querySelector('.hoje-treino');
    igual(card.classList.contains('hoje-treino-descanso'), true);
    igual(card.querySelector('.hoje-rotulo').textContent, 'Próximo treino · Quinta, 22 de outubro');
    igual(card.querySelector('.hoje-treino-nome').textContent, rotina.dias[1].nome, 'próximo dia da rotina (B)');
    const comecar = botaoCom(card, 'Começar treino');
    igual(comecar.classList.contains('botao-destaque'), false, 'sem laranja no dia de descanso');

    // "Não": fecha e não cria treino.
    comecar.click();
    igual(Boolean(modal()), true, 'abriu o diálogo');
    igual(modal().querySelector('.modal-titulo').textContent, PERGUNTA_HOJE);
    igual(botaoCom(modal(), 'Fechar'), undefined, 'sem o botão "Fechar"');
    igual(comecar.classList.contains('hoje-comecar-fixo'), true, 'botão preso acima das abas');
    const nao = botaoCom(modal(), 'Não');
    const sim = botaoCom(modal(), 'Sim');
    igual(nao.classList.contains('botao-destaque'), true, '"Não" em laranja');
    igual(sim.classList.contains('botao-escuro'), true, '"Sim" em preto');
    nao.click();
    igual(modal(), null, 'fechou');
    await pausa(50);
    igual(await sessaoEmAndamento(db), null, '"Não" não começa');

    // "Sim": começa o treino B e abre a tela Treino.
    comecar.click();
    botaoCom(modal(), 'Sim').click();
    igual(await esperarAte(async () => Boolean(await sessaoEmAndamento(db))), true, '"Sim" começa');
    const nova = await sessaoEmAndamento(db);
    igual(nova.diaId, 'b');
    await esperarAte(() => location.hash.startsWith('#/treino/'));
    igual(location.hash, `#/treino/${encodeURIComponent(nova.id)}`);
    await descartarSessao(nova.id, db);
  } finally {
    if (limpeza) limpeza();
    container.remove();
    limparRestos();
  }
});

teste('tela, situação 2 (já treinou hoje): card compacto com frase, foguinho, ↻ e o próximo treino', async () => {
  limparRestos();
  await apagarSessoes();
  const rotina = catalogo.rotinaPorId.get('massa-3-casa');
  const feita = await treinoConcluido(rotina, 'a', dia(21, 8), 'Treino feito, cabeça leve.');
  const container = montarContainer();
  const limpeza = await renderHoje(container, {}, { db, catalogo, agora: QUARTA });
  try {
    igual(container.querySelector('.hoje').dataset.situacao, 'concluido');
    const card = container.querySelector('.hoje-concluido');
    igual(card.dataset.sessao, feita.id);
    igual(card.querySelector('.hoje-concluido-rotulo').textContent, ROTULO_CONCLUIDO);
    igual(card.querySelector('.hoje-concluido-titulo').textContent, TITULO_CONCLUIDO);
    igual(TITULO_CONCLUIDO, 'Parabéns, campeão');
    igual(card.querySelector('.hoje-concluido-titulo').textContent.includes('·'), false, 'sem o "·"');
    igual(card.querySelector('.hoje-concluido-frase').textContent, 'Treino feito, cabeça leve.');
    igual(Boolean(card.querySelector('.hoje-fogo svg')), true, 'foguinho');
    igual(card.querySelector('.hoje-refazer').textContent, '↻');
    igual(container.querySelector('.hoje-treino'), null, 'o card grande sai');
    igual(container.querySelector('.hoje-descanso'), null);
    const proximo = container.querySelector('.hoje-proximo');
    const linha = proximo.querySelector('.hoje-proximo-linha');
    igual(proximo.querySelector('.hoje-proximo-texto').textContent, `Próximo treino · ${rotina.dias[1].nome} · Sexta, 23 de outubro`);
    igual(proximo.querySelector('.hoje-proximo-nome').textContent, rotina.dias[1].nome);
    igual(proximo.querySelector('.hoje-proximo-data').textContent, 'Sexta, 23 de outubro');
    igual(proximo.querySelector('.hoje-proximo-seta').textContent, '›');
    const corpo = proximo.querySelector('.hoje-proximo-corpo');
    igual([corpo.hidden, linha.getAttribute('aria-expanded')], [true, 'false'], 'começa fechado');
    // Tocar na linha abre o card completo do próximo treino (exercícios e Começar, sem laranja).
    linha.click();
    igual([corpo.hidden, linha.getAttribute('aria-expanded')], [false, 'true'], 'abriu');
    igual(corpo.querySelectorAll('.hoje-item').length, rotina.dias[1].itens.length);
    const comecar = botaoCom(corpo, 'Começar treino');
    igual(comecar.classList.contains('botao-destaque'), false, 'sem laranja');
    // Começar pergunta antes; "Não" fecha sem começar.
    comecar.click();
    igual(modal().querySelector('.modal-titulo').textContent, PERGUNTA_HOJE);
    igual(botaoCom(modal(), 'Fechar'), undefined, 'sem "Fechar"');
    botaoCom(modal(), 'Não').click();
    igual(modal(), null);
    await pausa(50);
    igual(await sessaoEmAndamento(db), null, '"Não" não começa');
    linha.click();
    igual(corpo.hidden, true, 'tocar de novo fecha');
    igual(container.querySelectorAll('.semana-dia.treinado').length, 1);
    igual(container.querySelector('.semana-dia.hoje').classList.contains('treinado'), true);
  } finally {
    if (limpeza) limpeza();
    container.remove();
  }
  // A frase não muda ao desenhar de novo (recarregar).
  const outra = montarContainer();
  const limpeza2 = await renderHoje(outra, {}, { db, catalogo, agora: QUARTA });
  try {
    igual(outra.querySelector('.hoje-concluido-frase').textContent, 'Treino feito, cabeça leve.');
  } finally {
    if (limpeza2) limpeza2();
    outra.remove();
  }
});

teste('tela, situação 2: treino de antes da 16b (sem frase) mostra sempre a mesma frase', async () => {
  await apagarSessoes();
  const rotina = catalogo.rotinaPorId.get('massa-3-casa');
  const feita = await treinoConcluido(rotina, 'a', dia(21, 8));
  const textos = [];
  for (let i = 0; i < 2; i++) {
    const container = montarContainer();
    const limpeza = await renderHoje(container, {}, { db, catalogo, agora: QUARTA });
    textos.push(container.querySelector('.hoje-concluido-frase').textContent);
    if (limpeza) limpeza();
    container.remove();
  }
  igual(textos[0], fraseDaSessao(feita));
  igual(textos[1], textos[0]);
});

teste('tela, ↻: pergunta antes e refaz o mesmo treino do zero; depois de finalizar, o calendário marca o dia uma vez só', async () => {
  limparRestos();
  await apagarSessoes();
  const rotina = catalogo.rotinaPorId.get('massa-3-casa');
  const primeira = await treinoConcluido(rotina, 'a', dia(21, 8), 'Devagar e sempre.');
  const container = montarContainer();
  let limpeza = await renderHoje(container, {}, { db, catalogo, agora: QUARTA });
  let segunda;
  try {
    // ↻ pergunta antes: "Não" (laranja) fecha sem refazer.
    container.querySelector('.hoje-refazer').click();
    igual(modal().querySelector('.modal-titulo').textContent, 'Refazer o treino A do zero?');
    igual(perguntaRefazer(primeira), 'Refazer o treino A do zero?');
    igual(botaoCom(modal(), 'Fechar'), undefined, 'sem "Fechar"');
    igual(botaoCom(modal(), 'Não').classList.contains('botao-destaque'), true, '"Não" em laranja');
    igual(botaoCom(modal(), 'Sim').classList.contains('botao-escuro'), true, '"Sim" em preto');
    botaoCom(modal(), 'Não').click();
    igual(modal(), null, 'fechou');
    await pausa(50);
    igual(await sessaoEmAndamento(db), null, '"Não" não refaz');
    // "Sim": refaz.
    container.querySelector('.hoje-refazer').click();
    botaoCom(modal(), 'Sim').click();
    igual(modal(), null);
    igual(await esperarAte(async () => Boolean(await sessaoEmAndamento(db))), true, 'criou a sessão');
    segunda = await sessaoEmAndamento(db);
    igual(segunda.id === primeira.id, false, 'sessão nova');
    igual([segunda.rotinaId, segunda.diaId, segunda.nome, segunda.local], [primeira.rotinaId, primeira.diaId, primeira.nome, primeira.local]);
    igual(segunda.itens, primeira.itens, 'mesmos exercícios');
    await esperarAte(() => location.hash.startsWith('#/treino/'));
    igual(location.hash, `#/treino/${encodeURIComponent(segunda.id)}`, 'abre a tela Treino');
  } finally {
    if (limpeza) limpeza();
    container.remove();
    limparRestos();
  }
  // O segundo treino do dia, concluído à tarde (início ajustado para o dia fixo do teste).
  await db.put('sessoes', { ...segunda, inicio: dia(21, 10) });
  await finalizarSessao(segunda.id, { agora: dia(21, 11), frase: 'Hoje valeu a pena.' }, db);
  igual((await listarSessoes(db)).filter((s) => s.status === 'concluida').length, 2, 'dois treinos concluídos hoje');

  const depois = montarContainer();
  limpeza = await renderHoje(depois, {}, { db, catalogo, agora: QUARTA });
  try {
    igual(depois.querySelectorAll('.semana-dia.treinado').length, 1, 'o dia marcado uma vez só');
    igual(depois.querySelector('.hoje-concluido').dataset.sessao, segunda.id, 'mostra o mais recente');
    igual(depois.querySelector('.hoje-concluido-frase').textContent, 'Hoje valeu a pena.');
    igual(depois.querySelector('.hoje-proximo-nome').textContent, rotina.dias[1].nome, 'o próximo continua o B');
    igual(depois.querySelector('.hoje-proximo-data').textContent, 'Sexta, 23 de outubro');
  } finally {
    if (limpeza) limpeza();
    depois.remove();
  }
  igual(inicioDoDia(dia(21, 10)), meiaNoite(21));
});

teste('limpeza: apaga o banco de teste', async () => {
  limparRestos();
  await pausa(50);
  igual(document.querySelector('dialog.modal'), null, 'nenhum modal sobrando');
  db.close();
  await deleteDB(NOME_TESTE);
});
