// evolucao.js: números da tela Evolução (PROJETO.md, seção 8, "6. Evolução"; etapas 19 a 22).
// Funções puras: recebem sessões, séries e o "agora" como parâmetros (não tocam DOM, banco nem fetch).
// Só dados reais: só contam sessões CONCLUÍDAS (treino em andamento ainda pode ser descartado).
//
// - Constância: uma semana (seg–dom) conta para a sequência quando os DIAS com treino concluído nela
//   chegam aos dias por semana da rotina atual. Dois treinos no mesmo dia contam como um dia (igual ao
//   calendário do Hoje). A semana atual entra na sequência quando já bateu; se ainda não bateu, NÃO
//   quebra (só quebra depois que termina). Barras = dias com treino em cada uma das últimas 8 semanas.
// - Melhor série de um exercício: carga = maior carga (empate: mais reps); corpo = mais reps;
//   tempo = mais segundos. Empate exato: fica a mais antiga (empatar não bate recorde).
// - Recordes: a melhor série de cada exercício, com a data em que foi feita; os mais recentes primeiro.
// - Gráfico: um ponto por treino concluído com o exercício = a melhor série daquele treino. Começa no
//   exercício mais treinado (em mais treinos; empate: o feito mais recentemente).
// - "+N" de um treino: quantas séries superaram a de mesma posição do "antes" (logica/comparacao.js,
//   mesma noção da Etapa 14/16: último treino concluído que começou antes deste; resultado 'mais').

import { inicioDaSemana, chaveDoDia } from './datas.js';
import { formatarCarga } from './tipos.js';
import { seriesDeAntesDaSessao, compararSeries } from './comparacao.js';

const MENOS = '−';

// Dias por semana usados quando não há rotina escolhida (a menor rotina do catálogo tem 3 dias).
export const DIAS_PADRAO = 3;

// Sessões concluídas em Map por id.
function concluidasPorId(sessoes) {
  return new Map((sessoes || [])
    .filter((s) => s && s.status === 'concluida' && Number.isFinite(s.inicio))
    .map((s) => [s.id, s]));
}

// Segunda-feira k semanas antes da semana que começa em `inicioSemana` (em ms, hora local).
// Montada por new Date(ano, mês, dia − 7k): horário de verão não desloca a semana.
export function semanaDeslocada(inicioSemana, k) {
  const d = new Date(inicioSemana);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7 * k).getTime();
}

// ---------- Constância ----------

// Dias distintos com treino concluído, por semana: Map<inicioDaSemana, Set<chaveDoDia>>.
export function diasPorSemanaTreinada(sessoes) {
  const mapa = new Map();
  for (const sessao of concluidasPorId(sessoes).values()) {
    const semana = inicioDaSemana(sessao.inicio);
    if (!mapa.has(semana)) mapa.set(semana, new Set());
    mapa.get(semana).add(chaveDoDia(sessao.inicio));
  }
  return mapa;
}

// { semanasSeguidas, nestaSemana, meta, barras: [{ inicio, treinos, atual, bateu }] (da mais antiga para a atual) }.
export function constancia({ sessoes, diasPorSemana, agora = Date.now(), semanas = 8 }) {
  const meta = Number.isInteger(diasPorSemana) && diasPorSemana >= 1 ? diasPorSemana : DIAS_PADRAO;
  const porSemana = diasPorSemanaTreinada(sessoes);
  const contar = (inicio) => (porSemana.has(inicio) ? porSemana.get(inicio).size : 0);
  const atual = inicioDaSemana(agora);
  const nestaSemana = contar(atual);

  let semanasSeguidas = nestaSemana >= meta ? 1 : 0;
  const maisAntiga = porSemana.size ? Math.min(...porSemana.keys()) : Infinity;
  for (let k = 1; ; k++) {
    const inicio = semanaDeslocada(atual, k);
    if (inicio < maisAntiga || contar(inicio) < meta) break;
    semanasSeguidas++;
  }

  const barras = [];
  for (let k = semanas - 1; k >= 0; k--) {
    const inicio = semanaDeslocada(atual, k);
    const treinos = contar(inicio);
    barras.push({ inicio, treinos, atual: k === 0, bateu: treinos >= meta });
  }
  return { semanasSeguidas, nestaSemana, meta, barras };
}

// "1 semana seguida", "3 semanas seguidas", "0 semanas seguidas".
export function textoSemanasSeguidas(n) {
  return `${n} ${n === 1 ? 'semana seguida' : 'semanas seguidas'}`;
}

// "2 de 3 treinos nesta semana".
export function textoNestaSemana(c) {
  return `${c.nestaSemana} de ${c.meta} ${c.meta === 1 ? 'treino' : 'treinos'} nesta semana`;
}

// ---------- Melhor série e recordes ----------

// Valor principal da série (o que o gráfico mostra): carga, reps ou segundos. null se inválido.
export function valorPrincipal(serie) {
  if (!serie) return null;
  const campo = serie.tipo === 'carga' ? 'carga' : serie.tipo === 'tempo' ? 'segundos' : 'reps';
  const v = serie[campo];
  if (!(Number.isFinite(v) && v > 0)) return null;
  if (serie.tipo === 'carga' && !(Number.isFinite(serie.reps) && serie.reps > 0)) return null;
  return v;
}

// > 0 se a é melhor que b; 0 se empatam; < 0 se b é melhor. Carga: carga, depois reps.
export function compararMelhor(a, b) {
  const d = valorPrincipal(a) - valorPrincipal(b);
  if (d !== 0) return d;
  if (a.tipo === 'carga') return a.reps - b.reps;
  return 0;
}

// A melhor série da lista (séries inválidas ficam fora). Empate: a feita primeiro. null se nenhuma.
export function melhorSerie(series) {
  const validas = (series || []).filter((s) => valorPrincipal(s) !== null)
    .sort((a, b) => a.feitaEm - b.feitaEm);
  let melhor = null;
  for (const s of validas) {
    if (!melhor || compararMelhor(s, melhor) > 0) melhor = s;
  }
  return melhor;
}

// Séries de sessões concluídas, agrupadas por exercício: Map<exercicioId, séries>.
function seriesConcluidasPorExercicio(series, sessoes) {
  const concluidas = concluidasPorId(sessoes);
  const mapa = new Map();
  for (const s of series || []) {
    if (!s || !concluidas.has(s.sessaoId)) continue;
    if (!mapa.has(s.exercicioId)) mapa.set(s.exercicioId, []);
    mapa.get(s.exercicioId).push(s);
  }
  return mapa;
}

// Recorde de cada exercício: [{ exercicioId, serie, em }], do mais recente para o mais antigo
// (em = feitaEm da série recorde). `quantos` limita a lista (a tela mostra 2).
export function recordes(series, sessoes, quantos = Infinity) {
  const lista = [];
  for (const [exercicioId, daqui] of seriesConcluidasPorExercicio(series, sessoes)) {
    const melhor = melhorSerie(daqui);
    if (melhor) lista.push({ exercicioId, serie: melhor, em: melhor.feitaEm });
  }
  lista.sort((a, b) => b.em - a.em || (a.exercicioId < b.exercicioId ? -1 : 1));
  return lista.slice(0, quantos);
}

// ---------- Gráfico ----------

// Exercícios com séries em treinos concluídos: [{ exercicioId, treinos, ultimo }], o mais treinado
// primeiro (empate: o feito mais recentemente; depois o id). ultimo = início do último treino.
export function exerciciosTreinados(series, sessoes) {
  const concluidas = concluidasPorId(sessoes);
  const lista = [];
  for (const [exercicioId, daqui] of seriesConcluidasPorExercicio(series, sessoes)) {
    const ids = new Set(daqui.filter((s) => valorPrincipal(s) !== null).map((s) => s.sessaoId));
    if (!ids.size) continue;
    const ultimo = Math.max(...[...ids].map((id) => concluidas.get(id).inicio));
    lista.push({ exercicioId, treinos: ids.size, ultimo });
  }
  return lista.sort((a, b) => b.treinos - a.treinos || b.ultimo - a.ultimo || (a.exercicioId < b.exercicioId ? -1 : 1));
}

// O exercício mais treinado (onde o gráfico começa), ou null sem dados.
export function exercicioMaisTreinado(series, sessoes) {
  const lista = exerciciosTreinados(series, sessoes);
  return lista.length ? lista[0].exercicioId : null;
}

// Pontos do gráfico de um exercício: [{ sessaoId, inicio, valor, serie }] em ordem de início.
export function pontosDoExercicio(exercicioId, series, sessoes) {
  const concluidas = concluidasPorId(sessoes);
  const porSessao = new Map();
  for (const s of series || []) {
    if (!s || s.exercicioId !== exercicioId || !concluidas.has(s.sessaoId)) continue;
    if (!porSessao.has(s.sessaoId)) porSessao.set(s.sessaoId, []);
    porSessao.get(s.sessaoId).push(s);
  }
  const pontos = [];
  for (const [sessaoId, daqui] of porSessao) {
    const melhor = melhorSerie(daqui);
    if (!melhor) continue;
    pontos.push({ sessaoId, inicio: concluidas.get(sessaoId).inicio, valor: valorPrincipal(melhor), serie: melhor });
  }
  return pontos.sort((a, b) => a.inicio - b.inicio);
}

// Diferença entre o primeiro e o último ponto, com unidade: "+4 reps", "+2,5 kg", "+10 s", "=", "−1 rep".
// null com menos de 2 pontos. Devolve { diferenca, texto, ganho (true se > 0) }.
export function ganhoNoPeriodo(pontos) {
  if (!pontos || pontos.length < 2) return null;
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  let d = ultimo.valor - primeiro.valor;
  const tipo = ultimo.serie.tipo;
  if (tipo === 'carga') d = Math.round(d * 100) / 100;
  if (d === 0) return { diferenca: 0, texto: '=', ganho: false };
  const sinal = d > 0 ? '+' : MENOS;
  const abs = Math.abs(d);
  let texto;
  if (tipo === 'carga') texto = `${sinal}${formatarCarga(abs)} kg`;
  else if (tipo === 'tempo') texto = `${sinal}${abs} s`;
  else texto = `${sinal}${abs} ${abs === 1 ? 'rep' : 'reps'}`;
  return { diferenca: d, texto, ganho: d > 0 };
}

// Coordenadas dos pontos no SVG (x proporcional à data, y ao valor). Um ponto só (ou todos na mesma
// data) fica no meio na horizontal; todos com o mesmo valor ficam no meio na vertical.
export function coordenadasDoGrafico(pontos, { largura = 300, altura = 120, margem = 12 } = {}) {
  if (!pontos || !pontos.length) return [];
  const tempos = pontos.map((p) => p.inicio);
  const valores = pontos.map((p) => p.valor);
  const t0 = Math.min(...tempos);
  const t1 = Math.max(...tempos);
  const v0 = Math.min(...valores);
  const v1 = Math.max(...valores);
  const larguraUtil = largura - 2 * margem;
  const alturaUtil = altura - 2 * margem;
  return pontos.map((p) => ({
    x: t1 === t0 ? largura / 2 : margem + ((p.inicio - t0) / (t1 - t0)) * larguraUtil,
    y: v1 === v0 ? altura / 2 : margem + (1 - (p.valor - v0) / (v1 - v0)) * alturaUtil,
  }));
}

// ---------- Últimos treinos e "+N" ----------

// Quantas séries do treino superaram a de mesma posição no "antes" (por exercício).
// seriesDoBanco = todas as séries (de qualquer sessão); sessoes = todas as sessões.
export function ganhosDoTreino(sessao, seriesDoBanco, sessoes) {
  const porExercicio = new Map();
  for (const s of seriesDoBanco || []) {
    if (!s) continue;
    if (!porExercicio.has(s.exercicioId)) porExercicio.set(s.exercicioId, []);
    porExercicio.get(s.exercicioId).push(s);
  }
  let total = 0;
  for (const doExercicio of porExercicio.values()) {
    const hoje = doExercicio.filter((s) => s.sessaoId === sessao.id).sort((a, b) => a.feitaEm - b.feitaEm);
    if (!hoje.length) continue;
    const antes = seriesDeAntesDaSessao(doExercicio, sessoes, sessao);
    total += compararSeries(antes, hoje).filter((c) => c && c.resultado === 'mais').length;
  }
  return total;
}

// Os treinos concluídos mais recentes: [{ sessao, series, ganhos }] (series = quantas séries tem).
export function ultimosTreinos(sessoes, seriesDoBanco, quantos = 10) {
  const recentes = [...concluidasPorId(sessoes).values()]
    .sort((a, b) => b.inicio - a.inicio)
    .slice(0, quantos);
  return recentes.map((sessao) => ({
    sessao,
    series: (seriesDoBanco || []).filter((s) => s && s.sessaoId === sessao.id).length,
    ganhos: ganhosDoTreino(sessao, seriesDoBanco, sessoes),
  }));
}

// Pílula: "+N" (ganho) ou "=" (nenhuma série superou).
export function textoGanhos(n) {
  return n > 0 ? `+${n}` : '=';
}
