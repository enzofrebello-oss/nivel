// cronometro.js: contagem regressiva do exercício de tempo (PROJETO.md, etapa 13b). Funções puras.
// O estado é um objeto imutável { total, restanteMs, inicioEm }: inicioEm = null quando parado/pausado.
// O tempo é calculado pela diferença de relógio (agora − inicioEm), não por tiques: continua certo se o
// navegador atrasar o setInterval (tela bloqueada, aba em segundo plano).

export function novoCronometro(segundos) {
  if (!Number.isInteger(segundos) || segundos < 1) throw new Error('Tempo inválido para o cronômetro.');
  return { total: segundos, restanteMs: segundos * 1000, inicioEm: null };
}

export function rodando(c) {
  return c.inicioEm !== null;
}

export function restanteMs(c, agora) {
  const gasto = rodando(c) ? Math.max(0, agora - c.inicioEm) : 0;
  return Math.max(0, c.restanteMs - gasto);
}

// Segundos para mostrar (arredonda para cima: 0,2 s restante ainda mostra 0:01).
export function segundosRestantes(c, agora) {
  return Math.ceil(restanteMs(c, agora) / 1000);
}

export function zerou(c, agora) {
  return restanteMs(c, agora) === 0;
}

export function iniciar(c, agora) {
  if (rodando(c) || c.restanteMs === 0) return c;
  return { ...c, inicioEm: agora };
}

export function pausar(c, agora) {
  if (!rodando(c)) return c;
  return { ...c, restanteMs: restanteMs(c, agora), inicioEm: null };
}
