// series.js: séries na store series (PROJETO.md, seção 4.2, "series").
// Etapa 13: adicionar (salva na hora, com tipo e grupos copiados do exercício), editar, apagar e
// listar por sessão. Por exercício e "última vez" entram na etapa 14 (comparação).
// Campos de medida conforme o tipo (js/logica/tipos.js): carga + reps, reps, ou segundos;
// os de outro tipo ficam ausentes. db é opcional: sem ele usa a conexão do app.

import { obterBanco } from './conexao.js';
import { CAMPOS, validarSerie } from '../logica/tipos.js';

// Só os campos de medida do tipo (o resto é ignorado).
function medidasDoTipo(tipo, medidas) {
  const saida = {};
  for (const campo of CAMPOS[tipo] || []) {
    if (medidas && medidas[campo] !== undefined) saida[campo] = medidas[campo];
  }
  return saida;
}

function validarOuLancar(serie) {
  const r = validarSerie(serie);
  if (!r.ok) throw new Error(r.erro);
}

// Registra uma série. exercicio = objeto do catálogo (tipo e grupos são COPIADOS no momento).
// medidas = { carga?, reps?, segundos? } já convertidos. A sessão precisa existir.
// Confere a sessão e grava na mesma transação. Devolve o registro gravado.
export async function adicionarSerie({ sessaoId, exercicio, medidas }, { agora = Date.now() } = {}, db) {
  if (!exercicio || !exercicio.id) throw new Error('Exercício inválido.');
  const serie = {
    id: crypto.randomUUID(),
    sessaoId,
    exercicioId: exercicio.id,
    tipo: exercicio.tipo,
    grupos: [...exercicio.grupos],
    ...medidasDoTipo(exercicio.tipo, medidas),
    feitaEm: agora,
  };
  // Campo de outro tipo vindo nas medidas é erro (não some calado).
  for (const chave of Object.keys(medidas || {})) {
    if (!(CAMPOS[exercicio.tipo] || []).includes(chave)) {
      throw new Error(`O campo "${chave}" não existe no tipo ${exercicio.tipo}.`);
    }
  }
  validarOuLancar(serie);
  const banco = db || await obterBanco();
  const tx = banco.transaction(['sessoes', 'series'], 'readwrite');
  const sessao = await tx.objectStore('sessoes').get(sessaoId);
  if (!sessao) {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error('Treino não encontrado.');
  }
  tx.objectStore('series').add(serie);
  await tx.done;
  return serie;
}

// Troca as medidas de uma série (mantém id, sessão, exercício, tipo, grupos e feitaEm).
// Devolve o registro novo. Lança se a série não existe ou se o valor é inválido.
export async function editarSerie(id, medidas, db) {
  const banco = db || await obterBanco();
  const tx = banco.transaction('series', 'readwrite');
  const store = tx.objectStore('series');
  const antiga = await store.get(id);
  if (!antiga) {
    await tx.done;
    throw new Error('Série não encontrada.');
  }
  const nova = { ...antiga, ...medidasDoTipo(antiga.tipo, medidas) };
  for (const chave of Object.keys(medidas || {})) {
    if (!(CAMPOS[antiga.tipo] || []).includes(chave)) {
      tx.abort();
      await tx.done.catch(() => {});
      throw new Error(`O campo "${chave}" não existe no tipo ${antiga.tipo}.`);
    }
  }
  const r = validarSerie(nova);
  if (!r.ok) {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error(r.erro);
  }
  store.put(nova);
  await tx.done;
  return nova;
}

// Apaga uma série (não mexe na sessão).
export async function apagarSerie(id, db) {
  const banco = db || await obterBanco();
  await banco.delete('series', id);
}

// Séries de uma sessão em ordem de feitaEm (índice por_sessao).
export async function listarSeriesDaSessao(sessaoId, db) {
  const banco = db || await obterBanco();
  const lista = await banco.getAllFromIndex('series', 'por_sessao', sessaoId);
  return lista.sort((a, b) => a.feitaEm - b.feitaEm);
}
