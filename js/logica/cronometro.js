// cronometro.js: contagem regressiva do exercício de tempo (PROJETO.md, etapa 13b). Funções puras.
// O estado é um objeto imutável { total, restanteMs, inicioEm }: inicioEm = null quando parado/pausado.
// O tempo é calculado pela diferença de relógio (agora − inicioEm), não por tiques: continua certo se o
// navegador atrasar o setInterval (tela bloqueada, aba em segundo plano).
// Etapa 15: o mesmo cronômetro serve ao Descanso (logica/descanso.js): ajustar (−15 s / +15 s), o horário
// de término (fimEm, gravado no banco) e retomar a partir dele (depois de recarregar ou voltar à aba).

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

// Etapa 15. Soma (ou tira, com segundos negativos) tempo do restante, nunca abaixo de 0. Rodando, continua
// rodando a partir de agora. Se o restante passar do total, o total sobe junto (o anel nunca passa de cheio).
export function ajustar(c, segundos, agora) {
  const novo = Math.max(0, restanteMs(c, agora) + segundos * 1000);
  return {
    total: Math.max(c.total, Math.ceil(novo / 1000)),
    restanteMs: novo,
    inicioEm: rodando(c) ? agora : null,
  };
}

// Horário (ms) em que a contagem rodando chega a zero; null se parado/pausado.
export function fimEm(c) {
  return rodando(c) ? c.inicioEm + c.restanteMs : null;
}

// Cronômetro rodando que termina em `fim` (ms), com `total` segundos: o inverso de fimEm. Se `fim` já
// passou, volta zerado.
export function retomar(total, fim, agora) {
  if (!Number.isInteger(total) || total < 1) throw new Error('Tempo inválido para o cronômetro.');
  if (!Number.isFinite(fim)) throw new Error('Horário de término inválido.');
  return { total, restanteMs: Math.max(0, fim - agora), inicioEm: agora };
}

// Quanto falta, de 0 a 1 (para o anel): 1 = cheio, 0 = zerado.
export function fracaoRestante(c, agora) {
  return Math.min(1, Math.max(0, restanteMs(c, agora) / (c.total * 1000)));
}
