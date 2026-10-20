// rotina.js: rotina e treino do dia (PROJETO.md, seção 4.1 "rotinas.json", seção 5 "Treino do dia" e etapa 12).
// Funções puras: recebem o catálogo, as sessões e o progresso das trilhas como parâmetros
// (não tocam DOM, banco nem fetch).
// - Treino do dia: o dia seguinte ao da última sessão concluída daquela rotina, em ciclo
//   (A → B → C → A; com 4 dias, A → B → C → D → A); sem sessões, o dia A. Não depende do dia da semana.
// - Item de trilha vira o exercício do nível atual: sem registro = nível 1; trilha concluída = último nível.

import { formatarTempo } from './tipos.js';

export const NOME_LOCAL = { casa: 'Casa', academia: 'Academia' };
export const ORDEM_LOCAIS = ['casa', 'academia']; // o usuário treina em casa: casa vem primeiro

// "Ganhar massa · 3 dias · Casa" (o nome exibido é montado pelo app, seção 4.1).
export function nomeRotina(rotina, catalogo) {
  const objetivo = catalogo.objetivos.find((o) => o.id === rotina.objetivo);
  return `${objetivo ? objetivo.nome : rotina.objetivo} · ${rotina.diasPorSemana} dias · ${NOME_LOCAL[rotina.local] || rotina.local}`;
}

// Rotinas para a escolha: primeiro as de casa, depois as de academia (nenhuma escondida);
// dentro de cada local, agrupadas por objetivo (na ordem do catálogo) e por dias por semana.
// Devolve [{ local, nome, objetivos: [{ objetivo, rotinas: [...] }] }].
export function rotinasParaEscolha(catalogo) {
  return ORDEM_LOCAIS.map((local) => ({
    local,
    nome: NOME_LOCAL[local],
    objetivos: catalogo.objetivos.map((objetivo) => ({
      objetivo,
      rotinas: catalogo.rotinas
        .filter((r) => r.local === local && r.objetivo === objetivo.id)
        .sort((a, b) => a.diasPorSemana - b.diasPorSemana),
    })).filter((grupo) => grupo.rotinas.length > 0),
  })).filter((secao) => secao.objetivos.length > 0);
}

// Dia do treino de hoje na rotina. sessoes = registros da store sessoes (qualquer rotina e status).
// Conta só as concluídas desta rotina; a última é a de maior início. Se o diaId dela não existir
// mais na rotina, volta ao dia A.
export function diaDoTreino(rotina, sessoes) {
  let ultima = null;
  for (const sessao of sessoes || []) {
    if (sessao.rotinaId !== rotina.id || sessao.status !== 'concluida') continue;
    if (!ultima || sessao.inicio > ultima.inicio) ultima = sessao;
  }
  if (!ultima) return rotina.dias[0];
  const i = rotina.dias.findIndex((dia) => dia.id === ultima.diaId);
  if (i === -1) return rotina.dias[0];
  return rotina.dias[(i + 1) % rotina.dias.length];
}

// Nível atual de uma trilha do catálogo, pelo registro da store trilhas (ou undefined/null se não há).
// Sem registro: nível 1. exercicioAtualId null (trilha concluída): último nível.
// Exercício que não está mais na trilha (antes da conciliação): primeiro nível não concluído, senão o último.
// Devolve { exercicioId, meta, posicao } (posicao 1 = primeiro nível).
export function nivelAtualDaTrilha(trilha, registro) {
  const niveis = trilha.niveis;
  let i = 0;
  if (registro) {
    if (registro.exercicioAtualId === null) {
      i = niveis.length - 1;
    } else {
      i = niveis.findIndex((n) => n.exercicio === registro.exercicioAtualId);
      if (i === -1) {
        const concluidos = new Set((registro.concluidos || []).map((c) => c.exercicioId));
        i = niveis.findIndex((n) => !concluidos.has(n.exercicio));
        if (i === -1) i = niveis.length - 1;
      }
    }
  }
  const nivel = niveis[i];
  return { exercicioId: nivel.exercicio, meta: nivel.meta, posicao: i + 1 };
}

// Um item do dia resolvido no formato de sessao.itens: { exercicioId, trilhaId, series, alvo, descanso }.
// Item de trilha: exercício do nível atual; series = a do item, senão meta.series; alvo = valor da meta
// (reps ou segundos) em texto. descanso = o do item, senão o da rotina.
// progresso = Map trilhaId → registro da store trilhas.
export function resolverItem(item, rotina, catalogo, progresso = new Map()) {
  const descanso = item.descanso !== undefined ? item.descanso : rotina.descanso;
  if (item.trilha) {
    const trilha = catalogo.trilhaPorId.get(item.trilha);
    const nivel = nivelAtualDaTrilha(trilha, progresso.get(item.trilha));
    const valor = nivel.meta.reps !== undefined ? nivel.meta.reps : nivel.meta.segundos;
    return {
      exercicioId: nivel.exercicioId,
      trilhaId: trilha.id,
      series: item.series !== undefined ? item.series : nivel.meta.series,
      alvo: String(valor),
      descanso,
    };
  }
  return { exercicioId: item.exercicio, trilhaId: null, series: item.series, alvo: item.alvo, descanso };
}

// Treino do dia: { dia, itens } com os itens já resolvidos (ver resolverItem).
export function treinoDoDia(rotina, sessoes, catalogo, progresso = new Map()) {
  const dia = diaDoTreino(rotina, sessoes);
  return { dia, itens: dia.itens.map((item) => resolverItem(item, rotina, catalogo, progresso)) };
}

// Séries × alvo para exibir: "4 × 10-15" (reps) ou "3 × 0:45" / "3 × 0:30-0:45" (tipo tempo, em m:ss).
export function textoAlvo(item, tipo) {
  const alvo = tipo === 'tempo'
    ? item.alvo.split('-').map((s) => formatarTempo(Number(s))).join('-')
    : item.alvo;
  return `${item.series} × ${alvo}`;
}
