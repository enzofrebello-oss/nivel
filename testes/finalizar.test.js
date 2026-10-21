// finalizar.test.js: testes da etapa 16 (PROJETO.md, "Finalizar, descartar e resumo"):
// - funções puras: pendentes (logica/fluxo-treino.js), textoDuracao e concluidaHoje (logica/datas.js),
//   seriesDeAntesDaSessao (logica/comparacao.js);
// - banco: finalizarSessao e descartarSessao (js/db/sessoes.js), descartar apaga a sessão e as séries dela
//   e não mexe nas de outro treino;
// - telas: treino inteiro do Hoje até o resumo (Começar treino → registrar todas as séries → Finalizar
//   treino → Detalhe da sessão), o calendário marca o dia e o Hoje mostra o treino concluído e o próximo
//   dia da rotina; menu "⋯" (Sair e continuar depois, Finalizar agora com confirmação, Descartar);
//   +1 no resumo de um segundo treino;
// - backup exportado depois do treino e importado restaura a sessão e as séries.
// O banco é separado, 'nivel-teste-finalizar', apagado no começo e no fim; NUNCA o banco real 'nivel'.

import { teste, igual } from './mini-teste.js';
import { deleteDB } from '../vendor/idb/index.js';
import { abrirBanco, NOME_BANCO } from '../js/db/conexao.js';
import { carregarCatalogo } from '../js/catalogo.js';
import { gravarMeta } from '../js/db/meta.js';
import {
  iniciarSessao, obterSessao, sessaoEmAndamento, finalizarSessao, descartarSessao, listarSessoes,
} from '../js/db/sessoes.js';
import { adicionarSerie, listarSeriesDaSessao } from '../js/db/series.js';
import { exportarBackup, backupParaTexto, lerBackup, importarBackup } from '../js/db/backup.js';
import { pendentes } from '../js/logica/fluxo-treino.js';
import { textoDuracao, concluidaHoje, chaveDoDia } from '../js/logica/datas.js';
import { seriesDeAntesDaSessao } from '../js/logica/comparacao.js';
import { diaDoTreino, treinoDoDia } from '../js/logica/rotina.js';
import { render as renderHoje } from '../js/telas/hoje.js';
import { render as renderTreino } from '../js/telas/treino.js';
import { render as renderDetalhe } from '../js/telas/sessao-detalhe.js';

const NOME_TESTE = 'nivel-teste-finalizar';
const NOME_RESTAURADO = `${NOME_TESTE}-restaurado`;
let db = null;
let catalogo = null;
let sessaoDoFluxo = null; // id do treino feito do Hoje ao resumo (usado pelo backup no fim)

async function apagarBancoDeTeste() {
  if (db) db.close();
  db = null;
  await deleteDB(NOME_TESTE);
  await deleteDB(NOME_RESTAURADO);
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// Espera até achar o seletor em raiz e a condição valer (ou desiste em ~3 s).
async function esperar(raiz, seletor, condicao = () => true) {
  for (let i = 0; i < 150; i++) {
    const el = raiz.querySelector(seletor);
    if (el && condicao(el)) return el;
    await pausa(20);
  }
  return raiz.querySelector(seletor);
}

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
// Modal aberto (o dialog só sai do DOM no evento close, que vem depois).
const modal = () => document.querySelector('dialog.modal[open]');

function limparRestos() {
  document.querySelectorAll('dialog.modal').forEach((d) => { if (d.open) d.close(); d.remove(); });
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  history.replaceState(null, '', location.pathname + location.search);
}

const ITEM = (exercicioId, series, alvo = '10') => ({ exercicioId, trilhaId: null, series, alvo, descanso: 1 });
const dadosSessao = (itens, nome = 'A · Empurrar') => ({
  rotinaId: 'massa-3-casa', diaId: 'a', nome, local: 'casa', itens, versaoDados: 1,
});

// ---------- Funções puras ----------

teste('pendentes: índices dos exercícios sem as séries pedidas', () => {
  const itens = [{ series: 3 }, { series: 2 }, { series: 1 }];
  igual(pendentes(itens, [3, 1, 0]), [1, 2]);
  igual(pendentes(itens, [3, 2, 1]), [], 'treino completo');
  igual(pendentes(itens, [4, 2, 5]), [], 'séries extras contam como feito');
  igual(pendentes(itens, []), [0, 1, 2], 'sem nada registrado');
});

teste('textoDuracao: minutos arredondados, horas com dois dígitos nos minutos', () => {
  igual(textoDuracao(20 * 1000), 'menos de 1 min');
  igual(textoDuracao(0), 'menos de 1 min');
  igual(textoDuracao(-5), 'menos de 1 min');
  igual(textoDuracao(NaN), 'menos de 1 min');
  igual(textoDuracao(52 * 60000), '52 min');
  igual(textoDuracao(60 * 60000), '1 h');
  igual(textoDuracao(65 * 60000 + 10000), '1 h 05 min');
});

teste('concluidaHoje: a concluída mais recente que começou hoje; em andamento e outros dias não contam', () => {
  const agora = new Date(2026, 9, 21, 20, 0).getTime();
  const s = (id, inicio, status = 'concluida') => ({ id, inicio, status });
  const sessoes = [
    s('ontem', new Date(2026, 9, 20, 23, 30).getTime()),
    s('manha', new Date(2026, 9, 21, 7, 0).getTime()),
    s('tarde', new Date(2026, 9, 21, 15, 0).getTime()),
    s('andamento', new Date(2026, 9, 21, 19, 0).getTime(), 'andamento'),
  ];
  igual(concluidaHoje(sessoes, agora).id, 'tarde');
  igual(concluidaHoje(sessoes.slice(0, 1), agora), null);
  igual(concluidaHoje([], agora), null);
});

teste('seriesDeAntesDaSessao: só treinos concluídos que começaram antes da sessão', () => {
  const sessoes = [
    { id: 's1', inicio: 100, status: 'concluida' },
    { id: 's2', inicio: 200, status: 'concluida' },
    { id: 's3', inicio: 300, status: 'concluida' },
  ];
  const series = [
    { id: 'a', sessaoId: 's1', feitaEm: 101 }, { id: 'b', sessaoId: 's2', feitaEm: 201 },
    { id: 'c', sessaoId: 's2', feitaEm: 202 }, { id: 'd', sessaoId: 's3', feitaEm: 301 },
  ];
  igual(seriesDeAntesDaSessao(series, sessoes, sessoes[2]).map((x) => x.id), ['b', 'c'], 'antes de s3 = s2');
  igual(seriesDeAntesDaSessao(series, sessoes, sessoes[1]).map((x) => x.id), ['a'], 'antes de s2 = s1 (s3 é depois)');
  igual(seriesDeAntesDaSessao(series, sessoes, sessoes[0]), [], 'nada antes de s1');
});

// ---------- Banco ----------

teste('banco de teste: o nome não é o do banco real', () => {
  igual(NOME_BANCO, 'nivel');
  if (NOME_TESTE === NOME_BANCO) throw new Error('o teste usaria o banco real');
});

teste('preparação: catálogo real e banco de teste novo', async () => {
  catalogo = await carregarCatalogo();
  await apagarBancoDeTeste();
  db = await abrirBanco({ nome: NOME_TESTE });
  igual(db.name, NOME_TESTE);
  igual(await db.count('sessoes'), 0);
});

teste('finalizarSessao: status concluida, fim e descanso limpo; finalizar de novo não grava', async () => {
  const { sessao } = await iniciarSessao(dadosSessao([ITEM('flexao-no-chao', 2)]), { agora: 1000 }, db);
  await db.put('sessoes', { ...sessao, descanso: { ate: 5000, duracao: 60 } });
  const feita = await finalizarSessao(sessao.id, { agora: 61000 }, db);
  igual(feita.status, 'concluida');
  igual(feita.fim, 61000);
  igual(feita.descanso, null);
  igual(await obterSessao(sessao.id, db), feita, 'gravada');
  igual(await sessaoEmAndamento(db), null, 'nenhum treino em andamento');
  igual(await finalizarSessao(sessao.id, { agora: 99000 }, db), null, 'já finalizada');
  igual((await obterSessao(sessao.id, db)).fim, 61000, 'fim não muda');
  igual(await finalizarSessao('nao-existe', {}, db), null);
  await db.clear('sessoes');
});

teste('descartarSessao: apaga a sessão e as séries dela; as de outro treino ficam', async () => {
  const flexao = catalogo.exercicioPorId.get('flexao-no-chao');
  const { sessao: antiga } = await iniciarSessao(dadosSessao([ITEM('flexao-no-chao', 1)]), { agora: 1000 }, db);
  const daAntiga = await adicionarSerie({ sessaoId: antiga.id, exercicio: flexao, medidas: { reps: 10 } }, { agora: 1100 }, db);
  await finalizarSessao(antiga.id, { agora: 2000 }, db);

  const { sessao } = await iniciarSessao(dadosSessao([ITEM('flexao-no-chao', 3)]), { agora: 3000 }, db);
  for (let i = 0; i < 3; i++) {
    await adicionarSerie({ sessaoId: sessao.id, exercicio: flexao, medidas: { reps: 12 } }, { agora: 3100 + i }, db);
  }
  igual((await listarSeriesDaSessao(sessao.id, db)).length, 3);
  igual(await descartarSessao(sessao.id, db), 3, 'devolve quantas séries apagou');
  igual(await obterSessao(sessao.id, db), undefined, 'sessão apagada');
  igual(await listarSeriesDaSessao(sessao.id, db), [], 'séries apagadas');
  igual(await db.count('series'), 1, 'só sobra a série do treino antigo');
  igual((await db.get('series', daAntiga.id)).sessaoId, antiga.id);

  // Treino concluído não é descartado (apagar é do Detalhe da sessão, etapa 19).
  igual(await descartarSessao(antiga.id, db), null);
  igual(Boolean(await obterSessao(antiga.id, db)), true, 'concluído continua');
  igual(await descartarSessao('nao-existe', db), null);
  await db.clear('sessoes');
  await db.clear('series');
});

// ---------- Telas: treino inteiro do Hoje até o resumo ----------

// Registra todas as séries pedidas na tela Treino: pula os descansos e digita a carga quando o campo vem
// vazio (carga sem histórico). Para quando aparece o "Finalizar treino" do último exercício.
async function fazerTreinoInteiro(container) {
  for (let passo = 0; passo < 80; passo++) {
    await esperar(container, '.descanso, .treino-finalizar, .contador-numero');
    if (container.querySelector('.treino-finalizar')) return true;
    const pular = botaoCom(container, 'Pular descanso');
    if (pular) {
      pular.click();
      await esperar(container, '.treino-finalizar, .contador-numero');
      continue;
    }
    for (const campo of container.querySelectorAll('.contador-numero')) {
      if (campo.value === '') {
        campo.value = '5';
        campo.dispatchEvent(new Event('input'));
      }
    }
    const registrar = [...container.querySelectorAll('button')].find((b) => b.textContent.startsWith('Registrar série'));
    if (!registrar) throw new Error('sem o botão "Registrar série"');
    const nome = container.querySelector('.treino-exercicio-nome').textContent;
    const texto = registrar.textContent;
    registrar.click();
    // Espera o desenho seguinte (descanso, outro exercício, outra série ou o fim).
    await esperarAte(() => {
      const r = [...container.querySelectorAll('button')].find((b) => b.textContent.startsWith('Registrar série'));
      const n = container.querySelector('.treino-exercicio-nome');
      return container.querySelector('.descanso') || container.querySelector('.treino-finalizar')
        || (r && n && (r.textContent !== texto || n.textContent !== nome));
    });
  }
  return false;
}

teste('treino inteiro: Hoje → Começar treino → todas as séries → Finalizar treino → resumo', async () => {
  limparRestos();
  await gravarMeta('rotinaAtualId', 'massa-3-casa', db);
  const rotina = catalogo.rotinaPorId.get('massa-3-casa');

  // Hoje: card do treino do dia (A) e "Começar treino".
  const hoje = montarContainer();
  let limpezaHoje = await renderHoje(hoje, {}, { db, catalogo });
  try {
    igual(hoje.querySelector('.hoje-treino-nome').textContent, 'A · Empurrar');
    igual(hoje.querySelector('.semana-dia.hoje.treinado'), null, 'hoje ainda não está marcado');
    botaoCom(hoje, 'Começar treino').click();
    igual(await esperarAte(async () => Boolean(await sessaoEmAndamento(db))), true, 'criou a sessão');
  } finally {
    if (limpezaHoje) limpezaHoje();
    hoje.remove();
  }
  const sessao = await sessaoEmAndamento(db);
  sessaoDoFluxo = sessao.id;
  igual(location.hash, `#/treino/${encodeURIComponent(sessao.id)}`, 'Começar abre a tela Treino');
  const previstas = sessao.itens.reduce((t, it) => t + it.series, 0);

  // Treino: registra tudo e chega ao último exercício concluído.
  const treino = montarContainer();
  const limpezaTreino = await renderTreino(treino, { id: sessao.id }, { db, catalogo });
  try {
    igual(Boolean(treino.querySelector('.treino-menu-botao')), true, 'menu "⋯" no topo');
    igual(await fazerTreinoInteiro(treino), true, 'chegou ao fim do treino');
    const nav = treino.querySelector('.treino-navegacao');
    igual([...nav.querySelectorAll('button')].map((b) => b.textContent), ['‹ Anterior', 'Finalizar treino'],
      'no fim: só Anterior e Finalizar treino');
    igual(botaoCom(treino, 'Sair'), undefined, 'sem o "Sair" antigo');
    igual((await listarSeriesDaSessao(sessao.id, db)).length, previstas, 'todas as séries pedidas');

    // Treino completo: Finalizar não pede confirmação.
    botaoCom(treino, 'Finalizar treino').click();
    igual(await esperarAte(async () => (await obterSessao(sessao.id, db)).status === 'concluida'), true, 'finalizou');
    igual(modal(), null, 'sem confirmação');
    await esperarAte(() => location.hash.startsWith('#/evolucao/'));
    igual(location.hash, `#/evolucao/treino/${encodeURIComponent(sessao.id)}`, 'abre o resumo');
  } finally {
    if (limpezaTreino) limpezaTreino();
    treino.remove();
  }
  const finalizada = await obterSessao(sessao.id, db);
  igual(Number.isFinite(finalizada.fim) && finalizada.fim >= finalizada.inicio, true, 'fim gravado');
  igual(finalizada.descanso, null);

  // Resumo: Detalhe da sessão em modo leitura.
  const resumo = montarContainer();
  const limpezaResumo = await renderDetalhe(resumo, { id: sessao.id }, { db, catalogo });
  try {
    igual(resumo.querySelector('.resumo-nome').textContent, 'A · Empurrar');
    igual(resumo.querySelector('.resumo-cabecalho .hoje-rotulo').textContent, 'Treino concluído');
    igual(resumo.querySelector('.resumo-data').textContent.length > 0, true, 'data');
    igual(resumo.querySelector('.resumo-duracao .resumo-valor').textContent, textoDuracao(finalizada.fim - finalizada.inicio));
    igual(resumo.querySelector('.resumo-series .resumo-valor').textContent, String(previstas));
    igual(resumo.querySelector('.resumo-exercicios .resumo-valor').textContent, String(sessao.itens.length));
    igual(resumo.querySelector('.resumo-local .resumo-valor').textContent, 'Casa');
    const cartoes = [...resumo.querySelectorAll('.resumo-exercicio')];
    igual(cartoes.map((c) => c.dataset.exercicio), sessao.itens.map((it) => it.exercicioId), 'exercícios na ordem');
    igual(cartoes.map((c) => c.querySelectorAll('.resumo-bolinha').length), sessao.itens.map((it) => it.series), 'séries de cada um');
    igual(cartoes.every((c) => c.querySelector('.resumo-exercicio-feitas.completo')), true, 'todos completos');
    igual(resumo.querySelectorAll('.treino-mais').length, 0, 'primeiro treino: sem +1');
    igual(resumo.querySelectorAll('input, .contador').length, 0, 'modo leitura: sem campos');
    igual([...resumo.querySelector('.resumo').childNodes].some((n) => n.nodeType === Node.TEXT_NODE), false, 'sem texto solto ("null")');
    igual(Boolean([...resumo.querySelectorAll('a')].find((a) => a.textContent === 'Voltar para o Hoje')), true);
  } finally {
    if (typeof limpezaResumo === 'function') limpezaResumo();
    resumo.remove();
  }

  // Hoje depois de finalizar: dia marcado, treino concluído e o próximo dia da rotina (B).
  const depois = montarContainer();
  limpezaHoje = await renderHoje(depois, {}, { db, catalogo });
  try {
    const marcado = depois.querySelector('.semana-dia.hoje');
    igual(marcado.classList.contains('treinado'), true, 'o calendário marca o dia');
    const concluido = depois.querySelector('.hoje-concluido');
    igual(Boolean(concluido), true, 'card do treino concluído');
    igual(concluido.querySelector('.hoje-concluido-nome').textContent, 'A · Empurrar');
    igual(concluido.querySelector('.hoje-concluido-texto').textContent.endsWith(`${previstas} séries`), true);
    igual(concluido.querySelector('a').getAttribute('href'), `#/evolucao/treino/${encodeURIComponent(sessao.id)}`, 'Ver resumo');
    const proximo = depois.querySelector('.hoje-treino');
    igual(proximo.querySelector('.hoje-rotulo').textContent, 'Próximo treino');
    igual(proximo.querySelector('.hoje-treino-nome').textContent, rotina.dias[1].nome, 'próximo dia da rotina (B)');
    igual(Boolean(botaoCom(proximo, 'Começar treino')), true);
  } finally {
    if (limpezaHoje) limpezaHoje();
    depois.remove();
    limparRestos();
  }
});

teste('próximo dia: depois de finalizar o B, o Hoje mostra o C; depois do C, volta ao A', async () => {
  const rotina = catalogo.rotinaPorId.get('massa-3-casa');
  for (const [i, esperado] of [[1, 'c'], [2, 'a']]) {
    const agora = Date.now() + i * 1000; // depois do treino do fluxo (o concluído de hoje é o mais recente)
    const dia = rotina.dias[i];
    const { sessao } = await iniciarSessao({
      rotinaId: rotina.id, diaId: dia.id, nome: dia.nome, local: 'casa', itens: [ITEM('flexao-no-chao', 1)], versaoDados: 1,
    }, { agora }, db);
    await finalizarSessao(sessao.id, { agora: agora + 60000 }, db);
    igual(diaDoTreino(rotina, await listarSessoes(db)).id, esperado);
    const container = montarContainer();
    const limpeza = await renderHoje(container, {}, { db, catalogo });
    try {
      igual(container.querySelector('.hoje-concluido-nome').textContent, dia.nome, 'concluído = o último');
      igual(container.querySelector('.hoje-treino-nome').textContent, rotina.dias.find((d) => d.id === esperado).nome);
    } finally {
      if (limpeza) limpeza();
      container.remove();
    }
  }
  // Limpa esses dois treinos (o fluxo acima continua no banco para o backup).
  for (const s of await listarSessoes(db)) {
    if (s.id !== sessaoDoFluxo) {
      const tx = db.transaction(['sessoes', 'series'], 'readwrite');
      for (const k of await tx.objectStore('series').index('por_sessao').getAllKeys(s.id)) tx.objectStore('series').delete(k);
      tx.objectStore('sessoes').delete(s.id);
      await tx.done;
    }
  }
});

teste('resumo: um segundo treino mostra o +1 em relação ao anterior', async () => {
  const flexao = catalogo.exercicioPorId.get('flexao-no-chao');
  const { sessao: s1 } = await iniciarSessao(dadosSessao([ITEM('flexao-no-chao', 2)]), { agora: 1000 }, db);
  await adicionarSerie({ sessaoId: s1.id, exercicio: flexao, medidas: { reps: 10 } }, { agora: 1100 }, db);
  await adicionarSerie({ sessaoId: s1.id, exercicio: flexao, medidas: { reps: 10 } }, { agora: 1200 }, db);
  await finalizarSessao(s1.id, { agora: 2000 }, db);
  const { sessao: s2 } = await iniciarSessao(dadosSessao([ITEM('flexao-no-chao', 2)]), { agora: 3000 }, db);
  await adicionarSerie({ sessaoId: s2.id, exercicio: flexao, medidas: { reps: 11 } }, { agora: 3100 }, db);
  await adicionarSerie({ sessaoId: s2.id, exercicio: flexao, medidas: { reps: 10 } }, { agora: 3200 }, db);
  await finalizarSessao(s2.id, { agora: 3000 + 52 * 60000 }, db);

  const container = montarContainer();
  await renderDetalhe(container, { id: s2.id }, { db, catalogo });
  try {
    igual(container.querySelector('.resumo-duracao .resumo-valor').textContent, '52 min');
    igual(container.querySelector('.treino-antes').textContent, 'Antes 10 · 10');
    igual([...container.querySelectorAll('.resumo-bolinha')].map((b) => b.textContent), ['11', '10']);
    igual([...container.querySelectorAll('.treino-mais')].map((m) => m.textContent), ['+1', '=']);
    igual(Boolean(container.querySelector('.treino-mais-mais')), true, '+1 em laranja');
  } finally {
    container.remove();
  }
  // O primeiro treino continua sem "antes" (o segundo é depois dele).
  const outro = montarContainer();
  await renderDetalhe(outro, { id: s1.id }, { db, catalogo });
  try {
    igual(outro.querySelector('.treino-antes'), null);
    igual(outro.querySelectorAll('.treino-mais').length, 0);
  } finally {
    outro.remove();
  }
  for (const id of [s1.id, s2.id]) {
    const tx = db.transaction(['sessoes', 'series'], 'readwrite');
    for (const k of await tx.objectStore('series').index('por_sessao').getAllKeys(id)) tx.objectStore('series').delete(k);
    tx.objectStore('sessoes').delete(id);
    await tx.done;
  }
});

teste('resumo: séries com carga mostram "kg" ("2 kg × 10", "1,5 kg × 12"); corpo e tempo sem unidade', async () => {
  const supino = catalogo.exercicioPorId.get('supino-reto-barra');
  const flexao = catalogo.exercicioPorId.get('flexao-no-chao');
  const prancha = catalogo.exercicioPorId.get('prancha-alta');
  const { sessao } = await iniciarSessao(dadosSessao([ITEM('supino-reto-barra', 2), ITEM('flexao-no-chao', 1), ITEM('prancha-alta', 1)]), { agora: 5000 }, db);
  await adicionarSerie({ sessaoId: sessao.id, exercicio: supino, medidas: { carga: 2, reps: 10 } }, { agora: 5100 }, db);
  await adicionarSerie({ sessaoId: sessao.id, exercicio: supino, medidas: { carga: 1.5, reps: 12 } }, { agora: 5200 }, db);
  await adicionarSerie({ sessaoId: sessao.id, exercicio: flexao, medidas: { reps: 20 } }, { agora: 5300 }, db);
  await adicionarSerie({ sessaoId: sessao.id, exercicio: prancha, medidas: { segundos: 60 } }, { agora: 5400 }, db);
  await finalizarSessao(sessao.id, { agora: 6000 }, db);

  const container = montarContainer();
  await renderDetalhe(container, { id: sessao.id }, { db, catalogo });
  try {
    igual([...container.querySelectorAll('.resumo-bolinha')].map((b) => b.textContent), ['2 kg × 10', '1,5 kg × 12', '20', '1:00']);
  } finally {
    container.remove();
  }
  const tx = db.transaction(['sessoes', 'series'], 'readwrite');
  for (const k of await tx.objectStore('series').index('por_sessao').getAllKeys(sessao.id)) tx.objectStore('series').delete(k);
  tx.objectStore('sessoes').delete(sessao.id);
  await tx.done;
});

// ---------- Menu "⋯" ----------

teste('menu: "Sair e continuar depois" volta ao Hoje e o treino segue em andamento', async () => {
  limparRestos();
  const { sessao } = await iniciarSessao(dadosSessao([ITEM('flexao-no-chao', 2), ITEM('flexao-diamante', 2)]), {}, db);
  const container = montarContainer();
  const limpeza = await renderTreino(container, { id: sessao.id }, { db, catalogo });
  try {
    container.querySelector('.treino-menu-botao').click();
    igual(modal().querySelector('.modal-titulo').textContent, 'Treino');
    igual([...modal().querySelectorAll('.treino-menu-opcao')].map((b) => b.textContent),
      ['Sair e continuar depois', 'Finalizar agora', 'Descartar treino']);
    botaoCom(modal(), 'Sair e continuar depois').click();
    igual(location.hash, '#/');
    igual(modal(), null, 'menu fechou');
    igual((await obterSessao(sessao.id, db)).status, 'andamento');
  } finally {
    if (limpeza) limpeza();
    container.remove();
    limparRestos();
  }
});

teste('menu: "Finalizar agora" com exercício faltando pede confirmação; Voltar mantém, confirmar finaliza', async () => {
  const sessao = await sessaoEmAndamento(db);
  const flexao = catalogo.exercicioPorId.get('flexao-no-chao');
  await adicionarSerie({ sessaoId: sessao.id, exercicio: flexao, medidas: { reps: 10 } }, {}, db);
  const container = montarContainer();
  const limpeza = await renderTreino(container, { id: sessao.id }, { db, catalogo });
  try {
    container.querySelector('.treino-menu-botao').click();
    botaoCom(modal(), 'Finalizar agora').click();
    igual(modal().querySelector('.treino-menu-texto').textContent, 'Faltam 2 exercícios:');
    igual([...modal().querySelectorAll('.treino-menu-faltam li')].map((li) => li.textContent), ['Flexão no chão', 'Flexão diamante']);
    botaoCom(modal(), 'Voltar ao treino').click();
    igual(modal(), null);
    await pausa(50);
    igual((await obterSessao(sessao.id, db)).status, 'andamento', 'Voltar não finaliza');

    container.querySelector('.treino-menu-botao').click();
    botaoCom(modal(), 'Finalizar agora').click();
    botaoCom(modal(), 'Finalizar mesmo assim').click();
    igual(await esperarAte(async () => (await obterSessao(sessao.id, db)).status === 'concluida'), true, 'finalizou');
    await esperarAte(() => location.hash.startsWith('#/evolucao/'));
    igual(location.hash, `#/evolucao/treino/${encodeURIComponent(sessao.id)}`);
    igual((await listarSeriesDaSessao(sessao.id, db)).length, 1, 'a série registrada fica salva');
  } finally {
    if (limpeza) limpeza();
    container.remove();
    limparRestos();
  }
  // Resumo de treino incompleto: "1 de 2" e "0 de 2", com "Nenhuma série registrada."
  const resumo = montarContainer();
  await renderDetalhe(resumo, { id: sessao.id }, { db, catalogo });
  try {
    igual([...resumo.querySelectorAll('.resumo-exercicio-feitas')].map((e) => e.textContent), ['1 de 2', '0 de 2']);
    igual(resumo.querySelector('.resumo-exercicios .resumo-valor').textContent, '1', 'só os exercícios feitos');
    igual(Boolean(resumo.querySelector('.treino-series-vazio')), true);
  } finally {
    resumo.remove();
  }
  const tx = db.transaction(['sessoes', 'series'], 'readwrite');
  for (const k of await tx.objectStore('series').index('por_sessao').getAllKeys(sessao.id)) tx.objectStore('series').delete(k);
  tx.objectStore('sessoes').delete(sessao.id);
  await tx.done;
});

teste('menu: "Descartar treino" confirma, apaga a sessão e as séries e volta ao Hoje', async () => {
  limparRestos();
  const flexao = catalogo.exercicioPorId.get('flexao-no-chao');
  const seriesAntes = await db.count('series');
  const { sessao } = await iniciarSessao(dadosSessao([ITEM('flexao-no-chao', 3)]), {}, db);
  await adicionarSerie({ sessaoId: sessao.id, exercicio: flexao, medidas: { reps: 10 } }, {}, db);
  await adicionarSerie({ sessaoId: sessao.id, exercicio: flexao, medidas: { reps: 9 } }, {}, db);
  const container = montarContainer();
  const limpeza = await renderTreino(container, { id: sessao.id }, { db, catalogo });
  try {
    // Cancelar não apaga nada.
    container.querySelector('.treino-menu-botao').click();
    botaoCom(modal(), 'Descartar treino').click();
    igual(modal().querySelector('.treino-menu-texto').textContent,
      'Descartar este treino? As 2 séries registradas serão apagadas. Não dá para desfazer.');
    botaoCom(modal(), 'Cancelar').click();
    await pausa(50);
    igual(Boolean(await obterSessao(sessao.id, db)), true, 'Cancelar mantém o treino');

    container.querySelector('.treino-menu-botao').click();
    botaoCom(modal(), 'Descartar treino').click();
    botaoCom(modal(), 'Descartar').click();
    igual(await esperarAte(async () => !(await obterSessao(sessao.id, db))), true, 'sessão apagada');
    igual(await listarSeriesDaSessao(sessao.id, db), [], 'séries apagadas');
    igual(await db.count('series'), seriesAntes, 'as séries de outros treinos ficam');
    await esperarAte(() => location.hash === '#/');
    igual(location.hash, '#/', 'volta ao Hoje');
    igual([...document.querySelectorAll('.toast')].some((t) => t.textContent === 'Treino descartado.'), true);
  } finally {
    if (limpeza) limpeza();
    container.remove();
    limparRestos();
  }
  // O Hoje volta a oferecer o treino do dia (sem treino em andamento).
  const hoje = montarContainer();
  const limpezaHoje = await renderHoje(hoje, {}, { db, catalogo });
  try {
    igual(Boolean(botaoCom(hoje, 'Começar treino')), true);
    igual(Boolean([...hoje.querySelectorAll('a')].find((a) => a.textContent === 'Continuar treino')), false);
  } finally {
    if (limpezaHoje) limpezaHoje();
    hoje.remove();
  }
});

teste('tela Treino: treino já finalizado mostra o aviso com "Ver resumo"', async () => {
  const container = montarContainer();
  const limpeza = await renderTreino(container, { id: sessaoDoFluxo }, { db, catalogo });
  try {
    igual(container.querySelector('.hoje-aviso').textContent, 'Este treino já foi finalizado.');
    const link = [...container.querySelectorAll('a')].find((a) => a.textContent === 'Ver resumo');
    igual(link.getAttribute('href'), `#/evolucao/treino/${encodeURIComponent(sessaoDoFluxo)}`);
  } finally {
    if (limpeza) limpeza();
    container.remove();
  }
});

// ---------- Backup ----------

teste('backup: exportado depois do treino e importado restaura a sessão e as séries', async () => {
  const sessao = await obterSessao(sessaoDoFluxo, db);
  const series = await listarSeriesDaSessao(sessaoDoFluxo, db);
  igual(sessao.status, 'concluida');
  igual(series.length > 0, true);

  const backup = await exportarBackup({ versaoDados: catalogo.versaoDados }, db);
  igual(backup.dados.sessoes.find((s) => s.id === sessaoDoFluxo), sessao, 'sessão no backup');
  igual(backup.dados.series.filter((s) => s.sessaoId === sessaoDoFluxo).length, series.length, 'séries no backup');
  const lido = lerBackup(backupParaTexto(backup), catalogo);
  igual(lido.ok, true, lido.erros ? lido.erros.join('; ') : '');

  const restaurado = await abrirBanco({ nome: NOME_RESTAURADO });
  try {
    await importarBackup(lido.backup, catalogo, restaurado);
    igual(await obterSessao(sessaoDoFluxo, restaurado), sessao, 'sessão restaurada igual');
    igual(await listarSeriesDaSessao(sessaoDoFluxo, restaurado), series, 'séries restauradas iguais');
    igual(chaveDoDia((await obterSessao(sessaoDoFluxo, restaurado)).inicio), chaveDoDia(sessao.inicio));
    // O banco restaurado também sabe o próximo dia da rotina.
    const rotina = catalogo.rotinaPorId.get('massa-3-casa');
    igual(treinoDoDia(rotina, await listarSessoes(restaurado), catalogo).dia.id, 'b');
    // E o resumo abre do banco restaurado.
    const container = montarContainer();
    await renderDetalhe(container, { id: sessaoDoFluxo }, { db: restaurado, catalogo });
    igual(container.querySelector('.resumo-series .resumo-valor').textContent, String(series.length));
    container.remove();
  } finally {
    restaurado.close();
    await deleteDB(NOME_RESTAURADO);
  }
});

// ---------- Limpeza ----------

teste('banco de teste: é apagado no fim', async () => {
  limparRestos();
  await apagarBancoDeTeste();
  const bancos = indexedDB.databases ? await indexedDB.databases() : [];
  igual(bancos.some((b) => b.name === NOME_TESTE || b.name === NOME_RESTAURADO), false);
});
