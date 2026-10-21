// trilhas.js: progresso de um nível de trilha (PROJETO.md, seção 4.3). Funções puras: recebem a meta,
// as séries e as sessões como parâmetros (não tocam DOM, banco nem fetch).
// Tela Trilhas (adiantada antes da etapa 16b): só o necessário para exibir o anel e o "seu melhor".
// O avanço automático ao finalizar (etapa 17/18) ainda não está aqui.
// - Pontuação de uma sessão: as meta.series melhores séries do exercício, soma de mín(valor, meta) de
//   cada uma, dividida por meta.series × meta. Ex.: meta 3 × 12, séries 12, 10 e 8 → 30/36 = 83%.
// - Seu melhor: a sessão concluída com a maior pontuação (só séries reais gravadas no banco).
// - Anel: a pontuação do seu melhor, de 0 a 1 (sem registro = 0, nunca passa de 1).
// - Estado de cada nível no caminho da tela: concluído (✓), atual (anel) ou bloqueado.

import { formatarTempo } from './tipos.js';
import { nivelAtualDaTrilha } from './rotina.js';

// Valor de uma série que conta para a meta: reps (corpo e carga, em carga só as reps contam) ou segundos.
// Devolve null se a série não tem o campo da meta (ou ele não é um número positivo).
export function valorDaSerie(serie, meta) {
  const campo = meta.reps !== undefined ? 'reps' : 'segundos';
  const valor = serie ? serie[campo] : undefined;
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

// Alvo da meta (reps ou segundos) e quantidade de séries.
function alvoDaMeta(meta) {
  return meta.reps !== undefined ? meta.reps : meta.segundos;
}

// Pontuação de UMA sessão (séries já filtradas: só as do exercício, só desta sessão).
// Devolve { pontuacao (0 a 1), valores (as séries que contam, da maior para a menor) },
// ou null se nenhuma série tem valor. Meta com séries ou alvo zero (ou inválidos) dá pontuação 0.
export function pontuacaoDaSessao(series, meta) {
  const valores = (series || [])
    .map((s) => valorDaSerie(s, meta))
    .filter((v) => v !== null)
    .sort((a, b) => b - a);
  if (valores.length === 0) return null;
  const quantas = meta.series;
  const alvo = alvoDaMeta(meta);
  const contam = Number.isFinite(quantas) && quantas > 0 ? valores.slice(0, quantas) : valores;
  if (!(Number.isFinite(quantas) && quantas > 0) || !(Number.isFinite(alvo) && alvo > 0)) {
    return { pontuacao: 0, valores: contam };
  }
  const soma = contam.reduce((total, v) => total + Math.min(v, alvo), 0);
  return { pontuacao: Math.min(1, soma / (quantas * alvo)), valores: contam };
}

// Seu melhor num nível: entre as sessões CONCLUÍDAS, a de maior pontuação com séries de exercicioId.
// series = séries do banco (pode vir misturado: as de outros exercícios são ignoradas);
// sessoes = registros da store sessoes (as em andamento e as que não aparecem são ignoradas).
// Empate: a de maior soma das séries que contam; depois a mais recente.
// Devolve { pontuacao, valores, sessaoId, inicio } ou null (sem registro).
export function seuMelhor({ exercicioId, meta, series, sessoes }) {
  const concluidas = new Map((sessoes || [])
    .filter((s) => s && s.status === 'concluida')
    .map((s) => [s.id, s]));
  const porSessao = new Map();
  for (const serie of series || []) {
    if (!serie || serie.exercicioId !== exercicioId || !concluidas.has(serie.sessaoId)) continue;
    if (!porSessao.has(serie.sessaoId)) porSessao.set(serie.sessaoId, []);
    porSessao.get(serie.sessaoId).push(serie);
  }
  let melhor = null;
  for (const [sessaoId, daSessao] of porSessao) {
    const r = pontuacaoDaSessao(daSessao, meta);
    if (!r) continue;
    const candidato = { ...r, sessaoId, inicio: concluidas.get(sessaoId).inicio, soma: r.valores.reduce((a, b) => a + b, 0) };
    if (!melhor
      || candidato.pontuacao > melhor.pontuacao
      || (candidato.pontuacao === melhor.pontuacao && candidato.soma > melhor.soma)
      || (candidato.pontuacao === melhor.pontuacao && candidato.soma === melhor.soma && candidato.inicio > melhor.inicio)) {
      melhor = candidato;
    }
  }
  if (!melhor) return null;
  return { pontuacao: melhor.pontuacao, valores: melhor.valores, sessaoId: melhor.sessaoId, inicio: melhor.inicio };
}

// Fração do anel (0 a 1) a partir do seu melhor: sem registro = 0; nunca passa de 1 nem fica abaixo de 0.
export function fracaoDoAnel(melhor) {
  if (!melhor) return 0;
  const p = Number(melhor.pontuacao);
  if (!Number.isFinite(p)) return 0;
  return Math.min(1, Math.max(0, p));
}

// Porcentagem inteira do anel, arredondada para baixo (só mostra 100% quando a meta foi batida).
export function porcentagemDoAnel(melhor) {
  return Math.floor(fracaoDoAnel(melhor) * 100 + 1e-9);
}

// "Seu melhor" para exibir: "12 · 10 · 8" (reps) ou "0:45 · 0:40 · 0:30" (segundos);
// sem registro: "Sem registro ainda".
export function textoSeuMelhor(melhor, meta) {
  if (!melhor || !melhor.valores || melhor.valores.length === 0) return 'Sem registro ainda';
  const formatar = meta.reps !== undefined ? String : formatarTempo;
  return melhor.valores.map((v) => formatar(v)).join(' · ');
}

// Os níveis da trilha com o estado de cada um, pelo registro da store trilhas (ou undefined).
// concluido = está em registro.concluidos (inclusive acima do atual: conquista guardada);
// atual = o nível atual (rotina.js, nivelAtualDaTrilha), se não estiver concluído; os demais, bloqueado.
// Trilha concluída (exercicioAtualId null): nenhum atual.
// Devolve { niveis: [{ exercicioId, meta, posicao, estado }], atual (posição ou null), concluidos, total, concluida }.
export function caminhoDaTrilha(trilha, registro) {
  const feitos = new Set(((registro && registro.concluidos) || []).map((c) => c.exercicioId));
  const concluida = Boolean(registro) && registro.exercicioAtualId === null;
  const atual = concluida ? null : nivelAtualDaTrilha(trilha, registro).posicao;
  const niveis = trilha.niveis.map((nivel, i) => {
    const posicao = i + 1;
    let estado = 'bloqueado';
    if (posicao === atual) estado = 'atual';
    else if (feitos.has(nivel.exercicio) || concluida) estado = 'concluido';
    return { exercicioId: nivel.exercicio, meta: nivel.meta, posicao, estado };
  });
  return {
    niveis,
    atual,
    concluidos: niveis.filter((n) => n.estado === 'concluido').length,
    total: niveis.length,
    concluida,
  };
}
