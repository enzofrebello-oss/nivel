// comparacao.js: "antes / hoje / +1" da tela Treino (PROJETO.md, seção 4.2 "Comparação" e etapa 14).
// Funções puras: sem DOM, sem banco. Os registros chegam como parâmetro.
//
// - antes: as séries do mesmo exercício no último treino CONCLUÍDO (status 'concluida'), sem contar o
//   treino atual nem treino em andamento. "Último" = o de maior `inicio`. Séries em ordem de feitaEm.
// - Pareamento por posição: 1ª de hoje com a 1ª de antes, 2ª com a 2ª... Série de hoje sem par = sem +1.
// - +1 (regra única para os 3 tipos, campo a campo: carga, reps, segundos):
//     d = hoje − antes em cada campo do tipo.
//     'mais'  = nenhum campo piorou e pelo menos um melhorou  → texto em laranja (ex.: "+2", "+2,5 kg").
//     'igual' = todos os campos iguais                        → "=".
//     'menos' = nenhum campo melhorou e pelo menos um piorou  → texto cinza (ex.: "−2").
//     'misto' = um campo melhorou e outro piorou (só na carga: mais carga com menos reps, ou menos carga
//               com mais reps) → NÃO conta como ganho: texto cinza com os dois campos ("+2,5 kg −2").
//   Ou seja, na carga só é "+" quando carga ≥ antes E reps ≥ antes, com pelo menos um dos dois maior.
// - Valor inicial do contador da série n (0 = primeira): o valor da série n de antes; sem ela, a meta da
//   rotina (o mínimo do alvo, "8-12" → 8). A carga não tem meta na rotina: usa a última carga de hoje,
//   senão a última de antes; sem nenhuma das duas, fica null (campo vazio: a pessoa digita a carga).
// Só compara com a última vez: não sugere carga.
import { CAMPOS, LIMITES, formatarCarga } from './tipos.js';
import { textoBolinha } from './fluxo-treino.js';

const MENOS = '−'; // sinal de menos tipográfico (−)

// Séries do último treino concluído, a partir de todas as séries do exercício e das sessões delas.
// sessoes = lista (ou Map por id) das sessões; sessaoAtualId nunca entra (mesmo se estivesse concluída).
export function seriesDeAntes(seriesDoExercicio, sessoes, sessaoAtualId) {
  const porId = sessoes instanceof Map ? sessoes : new Map((sessoes || []).map((s) => [s.id, s]));
  let escolhida = null;
  for (const serie of seriesDoExercicio || []) {
    const sessao = porId.get(serie.sessaoId);
    if (!sessao || sessao.id === sessaoAtualId || sessao.status !== 'concluida') continue;
    if (!escolhida || sessao.inicio > escolhida.inicio) escolhida = sessao;
  }
  if (!escolhida) return [];
  return seriesDoExercicio
    .filter((s) => s.sessaoId === escolhida.id)
    .sort((a, b) => a.feitaEm - b.feitaEm);
}

// Etapa 16 (resumo = Detalhe da sessão): "antes" de uma sessão já feita = o último treino concluído que
// começou ANTES dela (os treinos feitos depois não contam). Para o treino que acabou de ser finalizado,
// dá o mesmo que seriesDeAntes.
export function seriesDeAntesDaSessao(seriesDoExercicio, sessoes, sessao) {
  const lista = sessoes instanceof Map ? [...sessoes.values()] : (sessoes || []);
  const anteriores = lista.filter((s) => s.inicio < sessao.inicio);
  return seriesDeAntes(seriesDoExercicio, anteriores, sessao.id);
}

// Texto da linha "antes": "20 · 20 · 18" (carga "60×10 · 60×8", tempo "0:50 · 0:45"); '' sem antes.
export function textoAntes(antes) {
  return (antes || []).map(textoBolinha).join(' · ');
}

function textoDiferenca(campo, d) {
  const sinal = d > 0 ? '+' : MENOS;
  const abs = Math.abs(d);
  if (campo === 'carga') return `${sinal}${formatarCarga(abs)} kg`;
  if (campo === 'segundos') return `${sinal}${abs} s`;
  return `${sinal}${abs}`;
}

// Compara uma série de hoje com a de mesma posição de antes.
// Devolve null sem antes; senão { resultado: 'mais' | 'igual' | 'menos' | 'misto', texto }.
export function compararSerie(antes, hoje) {
  if (!antes || !hoje) return null;
  const campos = CAMPOS[hoje.tipo] || [];
  const partes = [];
  let melhorou = false;
  let piorou = false;
  for (const campo of campos) {
    if (typeof antes[campo] !== 'number' || typeof hoje[campo] !== 'number') return null; // tipo trocou
    let d = hoje[campo] - antes[campo];
    if (campo === 'carga') d = Math.round(d * 100) / 100; // 62,5 − 60 sem erro de ponto flutuante
    if (d === 0) continue;
    if (d > 0) melhorou = true;
    else piorou = true;
    partes.push(textoDiferenca(campo, d));
  }
  if (!melhorou && !piorou) return { resultado: 'igual', texto: '=' };
  const resultado = melhorou && piorou ? 'misto' : melhorou ? 'mais' : 'menos';
  return { resultado, texto: partes.join(' ') };
}

// Uma comparação por série de hoje (mesma ordem). Séries de hoje além das de antes = null.
export function compararSeries(antes, hoje) {
  return (hoje || []).map((serie, i) => compararSerie((antes || [])[i], serie));
}

// "8-12" → 8; "45" → 45. Fora da faixa válida do campo, fica no limite.
export function minimoDoAlvo(alvo, campo, tipo) {
  const n = parseInt(String(alvo).split('-')[0], 10);
  const limites = campo === 'segundos' ? LIMITES.segundos : tipo === 'corpo' ? LIMITES.repsCorpo : LIMITES.repsCarga;
  if (!Number.isInteger(n)) return limites.min;
  return Math.min(Math.max(n, limites.min), limites.max);
}

// Valores iniciais do contador da próxima série (posição hoje.length).
// tipo e alvo = do exercício e do item da sessão; antes e hoje = séries (em ordem).
export function valoresIniciais(tipo, alvo, antes, hoje) {
  const listaAntes = antes || [];
  const listaHoje = hoje || [];
  const par = listaAntes[listaHoje.length];
  const valores = {};
  for (const campo of CAMPOS[tipo] || []) {
    if (par && typeof par[campo] === 'number') {
      valores[campo] = par[campo];
    } else if (campo === 'carga') {
      const ultimaHoje = listaHoje[listaHoje.length - 1];
      const ultimaAntes = listaAntes[listaAntes.length - 1];
      valores[campo] = (ultimaHoje && ultimaHoje.carga) || (ultimaAntes && ultimaAntes.carga) || null;
    } else {
      valores[campo] = minimoDoAlvo(alvo, campo, tipo);
    }
  }
  return valores;
}
