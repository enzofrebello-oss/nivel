// sessoes.js: treinos na store sessoes (PROJETO.md, seção 4.2, "sessoes").
// Etapa 12: leitura (o Hoje usa para o calendário da semana e o treino do dia).
// Etapa 13: iniciar (no máximo uma sessão em andamento), ler uma sessão e a sessão em andamento.
// Etapa 15: gravar/limpar o descanso em curso (sessao.descanso). Finalizar e descartar entram na etapa 16.
// db é opcional: sem ele usa a conexão do app (os testes passam um banco separado).

import { obterBanco } from './conexao.js';

// Todas as sessões, em ordem de início (índice por_inicio).
export async function listarSessoes(db) {
  const banco = db || await obterBanco();
  return banco.getAllFromIndex('sessoes', 'por_inicio');
}

// Uma sessão pelo id, ou undefined.
export async function obterSessao(id, db) {
  const banco = db || await obterBanco();
  return banco.get('sessoes', id);
}

// A sessão em andamento (índice por_status), ou null. Pela regra há no máximo uma; se houver mais
// (dado antigo quebrado), devolve a mais recente.
export async function sessaoEmAndamento(db) {
  const banco = db || await obterBanco();
  const lista = await banco.getAllFromIndex('sessoes', 'por_status', 'andamento');
  if (!lista.length) return null;
  return lista.reduce((a, b) => (b.inicio > a.inicio ? b : a));
}

// Cópia de um item resolvido no formato de sessao.itens (seção 4.2).
function copiarItem(item) {
  return {
    exercicioId: item.exercicioId,
    trilhaId: item.trilhaId === undefined ? null : item.trilhaId,
    series: item.series,
    alvo: item.alvo,
    descanso: item.descanso,
  };
}

// Inicia um treino. dados = { rotinaId, diaId, nome, local, itens, versaoDados }; os itens já vêm
// resolvidos (js/logica/rotina.js, treinoDoDia) e são copiados para a sessão.
// Confere e grava na MESMA transação: se já existe uma sessão em andamento, não cria outra.
// Devolve { sessao, jaExistia } (jaExistia = true: sessao é a que já estava em andamento).
export async function iniciarSessao(dados, { agora = Date.now() } = {}, db) {
  if (!dados || !Array.isArray(dados.itens) || dados.itens.length === 0) {
    throw new Error('Treino sem exercícios.');
  }
  const banco = db || await obterBanco();
  const tx = banco.transaction('sessoes', 'readwrite');
  const store = tx.objectStore('sessoes');
  const abertas = await store.index('por_status').getAll('andamento');
  if (abertas.length) {
    await tx.done;
    return { sessao: abertas.reduce((a, b) => (b.inicio > a.inicio ? b : a)), jaExistia: true };
  }
  const sessao = {
    id: crypto.randomUUID(),
    rotinaId: dados.rotinaId === undefined ? null : dados.rotinaId,
    diaId: dados.diaId === undefined ? null : dados.diaId,
    nome: dados.nome,
    local: dados.local,
    itens: dados.itens.map(copiarItem),
    inicio: agora,
    fim: null,
    status: 'andamento',
    descanso: null,
    versaoDados: dados.versaoDados,
  };
  store.add(sessao);
  await tx.done;
  return { sessao, jaExistia: false };
}

// Etapa 15. Grava o descanso em curso da sessão ({ ate, duracao }) ou limpa (null). Ler e gravar na
// mesma transação. Devolve a sessão atualizada; sem a sessão (ou já finalizada), não grava e devolve null.
export async function salvarDescanso(id, descanso, db) {
  if (descanso !== null && !(descanso && Number.isFinite(descanso.ate)
    && Number.isInteger(descanso.duracao) && descanso.duracao >= 1)) {
    throw new Error('Descanso inválido.');
  }
  const banco = db || await obterBanco();
  const tx = banco.transaction('sessoes', 'readwrite');
  const store = tx.objectStore('sessoes');
  const sessao = await store.get(id);
  if (!sessao || sessao.status !== 'andamento') {
    await tx.done;
    return null;
  }
  const nova = { ...sessao, descanso: descanso === null ? null : { ate: descanso.ate, duracao: descanso.duracao } };
  store.put(nova);
  await tx.done;
  return nova;
}
