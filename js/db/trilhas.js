// trilhas.js: progresso das trilhas no banco (PROJETO.md, seção 4.2, "trilhas" e "Versões e migração").
// Etapa 9: conciliação com versaoDados. Etapa 12: lerProgressoTrilhas (o Hoje resolve os itens de trilha
// do treino do dia). Etapa 15b: registroComNivel/definirNivelAtual (o usuário escolhe o nível atual de
// cada trilha em Ajustes). O avanço automático ao bater a meta entra na etapa 18.

import { obterBanco } from './conexao.js';

// Progresso de todas as trilhas: Map trilhaId → registro da store trilhas.
// Trilha sem registro não aparece (= nível 1 é o atual, seção 4.2).
export async function lerProgressoTrilhas(db) {
  const banco = db || await obterBanco();
  const registros = await banco.getAll('trilhas');
  return new Map(registros.map((r) => [r.trilhaId, r]));
}

// Regra da conciliação para um registro de trilhas (função pura, não grava nada).
// Se exercicioAtualId saiu da trilha do catálogo, passa ao primeiro nível não concluído
// (null se todos estão concluídos). Devolve o registro novo, ou null se não precisa mudar.
// Trilha concluída (exercicioAtualId null) e trilha que não está no catálogo ficam como estão.
export function reposicionarTrilha(registro, trilha, agora = Date.now()) {
  if (!trilha || registro.exercicioAtualId === null) return null;
  const niveis = trilha.niveis.map((nivel) => nivel.exercicio);
  if (niveis.includes(registro.exercicioAtualId)) return null;
  const concluidos = new Set((registro.concluidos || []).map((c) => c.exercicioId));
  const proximo = niveis.find((id) => !concluidos.has(id));
  return { ...registro, exercicioAtualId: proximo === undefined ? null : proximo, atualizadoEm: agora };
}

// Ao abrir o app: se catalogo.versaoDados ≠ meta.versaoDadosVista, reposiciona as trilhas
// e grava a nova versaoDadosVista, tudo numa transação só (trilhas + meta).
// Devolve { mudou, ajustadas } (mudou = a versão vista era outra; ajustadas = trilhas reposicionadas).
export async function conciliarVersaoDados(catalogo, db) {
  const banco = db || await obterBanco();
  const tx = banco.transaction(['trilhas', 'meta'], 'readwrite');
  const meta = tx.objectStore('meta');
  const trilhas = tx.objectStore('trilhas');

  const vista = await meta.get('versaoDadosVista');
  if (vista && vista.valor === catalogo.versaoDados) {
    await tx.done;
    return { mudou: false, ajustadas: 0 };
  }

  const agora = Date.now();
  let ajustadas = 0;
  for (const registro of await trilhas.getAll()) {
    const novo = reposicionarTrilha(registro, catalogo.trilhaPorId.get(registro.trilhaId), agora);
    if (novo) {
      trilhas.put(novo);
      ajustadas++;
    }
  }
  meta.put({ chave: 'versaoDadosVista', valor: catalogo.versaoDados });
  await tx.done;
  return { mudou: true, ajustadas };
}

// Registro novo da store trilhas com exercicioId como nível atual (função pura, não grava nada).
// Escolha manual (seção 4.3): os níveis anteriores que faltavam em concluidos entram como 'manual'.
// Nenhuma conquista é apagada: tudo o que já estava em concluidos fica como estava (data e "como",
// 'meta' ou 'manual'), inclusive níveis acima do escolhido (voltar para um nível mais fácil só muda o
// nível atual; concluidos pode ter níveis acima do atual). Ordem: os níveis anteriores ao escolhido na
// ordem da trilha, depois os demais concluídos na ordem em que estavam.
// Lança erro se o exercício não é um nível da trilha.
export function registroComNivel(trilha, registro, exercicioId, agora = Date.now()) {
  const i = trilha.niveis.findIndex((nivel) => nivel.exercicio === exercicioId);
  if (i === -1) throw new Error(`"${exercicioId}" não é um nível da trilha "${trilha.id}"`);
  const existentes = (registro && registro.concluidos) || [];
  const antes = new Map(existentes.map((c) => [c.exercicioId, c]));
  const abaixo = trilha.niveis.slice(0, i).map((nivel) =>
    antes.get(nivel.exercicio) || { exercicioId: nivel.exercicio, em: agora, como: 'manual' });
  const jaPostos = new Set(abaixo.map((c) => c.exercicioId));
  const resto = existentes.filter((c) => !jaPostos.has(c.exercicioId));
  return { trilhaId: trilha.id, exercicioAtualId: exercicioId, concluidos: [...abaixo, ...resto], atualizadoEm: agora };
}

// Grava exercicioId como nível atual da trilha (trilha = objeto do catálogo). Lê e grava na mesma
// transação. Devolve o registro gravado. Treino em andamento não muda: os itens dele foram copiados no início.
export async function definirNivelAtual(trilha, exercicioId, { agora = Date.now() } = {}, db) {
  const banco = db || await obterBanco();
  const tx = banco.transaction('trilhas', 'readwrite');
  const store = tx.objectStore('trilhas');
  let novo;
  try {
    novo = registroComNivel(trilha, await store.get(trilha.id), exercicioId, agora);
  } catch (erro) {
    tx.abort();
    await tx.done.catch(() => {});
    throw erro;
  }
  store.put(novo);
  await tx.done;
  return novo;
}
