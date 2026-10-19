// tipos.js: regras dos 3 tipos de exercício (PROJETO.md, seção 4.2, "Regras por tipo de exercício").
// carga (carga + reps), corpo (reps), tempo (segundos): campos, validação, parse e formatação.
// Funções puras: sem DOM, sem banco. Entradas de texto aceitam vírgula decimal e tempo em ss ou m:ss.
//
// Parse devolve { ok: true, valor } ou { ok: false, erro } (erro em pt-BR, pronto para a interface).

export const TIPOS = ['carga', 'corpo', 'tempo'];

// Campos de medida de cada tipo. Campos de outro tipo ficam ausentes (não 0).
export const CAMPOS = {
  carga: ['carga', 'reps'],
  corpo: ['reps'],
  tempo: ['segundos'],
};

// Todos os campos de medida que uma série pode ter.
const CAMPOS_MEDIDA = ['carga', 'reps', 'segundos'];

export const LIMITES = {
  carga: { min: 0, max: 1000, casas: 2 }, // kg; > 0 (min exclusivo) e ≤ 1000
  repsCarga: { min: 1, max: 100 },
  repsCorpo: { min: 1, max: 500 },
  segundos: { min: 1, max: 7200 },
};

export function tipoValido(tipo) {
  return TIPOS.includes(tipo);
}

function ok(valor) {
  return { ok: true, valor };
}

function falha(erro) {
  return { ok: false, erro };
}

function limitesReps(tipo) {
  return tipo === 'corpo' ? LIMITES.repsCorpo : LIMITES.repsCarga;
}

// Conta as casas decimais de um número já convertido (62.25 → 2). Usa o texto do número.
function casasDecimais(numero) {
  const texto = String(numero);
  if (/e/i.test(texto)) return Infinity; // notação científica: muito pequeno ou muito grande
  const ponto = texto.indexOf('.');
  return ponto === -1 ? 0 : texto.length - ponto - 1;
}

// ---------- Validação de valores numéricos (já convertidos) ----------

export function validarCarga(valor) {
  const { min, max, casas } = LIMITES.carga;
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return falha('Carga inválida.');
  if (valor <= min) return falha('A carga precisa ser maior que 0.');
  if (valor > max) return falha(`A carga pode ir até ${max} kg.`);
  if (casasDecimais(valor) > casas) return falha(`A carga aceita até ${casas} casas decimais.`);
  return ok(valor);
}

export function validarReps(valor, tipo) {
  const { min, max } = limitesReps(tipo);
  if (typeof valor !== 'number' || !Number.isInteger(valor)) return falha('Repetições precisam ser um número inteiro.');
  if (valor < min || valor > max) return falha(`Repetições: de ${min} a ${max}.`);
  return ok(valor);
}

export function validarSegundos(valor) {
  const { min, max } = LIMITES.segundos;
  if (typeof valor !== 'number' || !Number.isInteger(valor)) return falha('Tempo inválido.');
  if (valor < min || valor > max) return falha(`Tempo: de 0:01 a ${formatarTempo(max)}.`);
  return ok(valor);
}

// ---------- Parse de texto digitado ----------

function limparTexto(texto) {
  return typeof texto === 'string' ? texto.trim() : '';
}

// "62,5" e "62.5" → 62.5. Até 2 casas decimais, sem sinal, sem notação científica.
export function parseCarga(texto) {
  const t = limparTexto(texto);
  if (t === '') return falha('Informe a carga.');
  if (!/^\d+([.,]\d+)?$/.test(t)) return falha('Carga inválida. Use números, ex.: 62,5.');
  const decimais = t.split(/[.,]/)[1];
  if (decimais && decimais.length > LIMITES.carga.casas) {
    return falha(`A carga aceita até ${LIMITES.carga.casas} casas decimais.`);
  }
  return validarCarga(Number(t.replace(',', '.')));
}

// Só inteiros: "8,5" é recusado. tipo define o limite ('carga' 1–100, 'corpo' 1–500).
export function parseReps(texto, tipo) {
  const t = limparTexto(texto);
  if (t === '') return falha('Informe as repetições.');
  if (!/^\d+$/.test(t)) return falha('Repetições precisam ser um número inteiro.');
  return validarReps(Number(t), tipo);
}

// "90" (só segundos) → 90; "1:30" (m:ss) → 90. Em m:ss os segundos têm 2 dígitos, de 00 a 59.
export function parseTempo(texto) {
  const t = limparTexto(texto);
  if (t === '') return falha('Informe o tempo.');
  let segundos;
  if (/^\d+$/.test(t)) {
    segundos = Number(t);
  } else {
    const partes = /^(\d+):(\d{2})$/.exec(t);
    if (!partes) return falha('Tempo inválido. Use segundos (90) ou m:ss (1:30).');
    const seg = Number(partes[2]);
    if (seg > 59) return falha('Em m:ss os segundos vão de 00 a 59.');
    segundos = Number(partes[1]) * 60 + seg;
  }
  return validarSegundos(segundos);
}

// Monta os campos de uma série a partir dos textos digitados.
// entradas: { carga: '62,5', reps: '10' }. Campo de outro tipo é recusado.
// Devolve { ok: true, valor: { carga: 62.5, reps: 10 } } ou { ok: false, erro }.
export function parseSerie(tipo, entradas) {
  if (!tipoValido(tipo)) return falha('Tipo de exercício desconhecido.');
  const dados = entradas || {};
  const campos = CAMPOS[tipo];

  for (const chave of Object.keys(dados)) {
    if (!campos.includes(chave)) return falha(`O campo "${chave}" não existe no tipo ${tipo}.`);
  }

  const serie = {};
  for (const campo of campos) {
    let r;
    if (campo === 'carga') r = parseCarga(dados.carga);
    else if (campo === 'reps') r = parseReps(dados.reps, tipo);
    else r = parseTempo(dados.segundos);
    if (!r.ok) return r;
    serie[campo] = r.valor;
  }
  return ok(serie);
}

// ---------- Validação de uma série gravada ----------

// Confere os campos de medida de uma série { tipo, carga?, reps?, segundos?, ... }.
// Os campos do tipo são obrigatórios e válidos; os de outro tipo precisam estar ausentes (nem 0).
// Outros campos do registro (id, sessaoId, feitaEm...) não são conferidos aqui.
// Devolve { ok: true, valor: serie } ou { ok: false, erro }.
export function validarSerie(serie) {
  if (!serie || typeof serie !== 'object') return falha('Série inválida.');
  const { tipo } = serie;
  if (!tipoValido(tipo)) return falha('Tipo de exercício desconhecido.');
  const campos = CAMPOS[tipo];

  for (const campo of CAMPOS_MEDIDA) {
    if (!campos.includes(campo) && campo in serie) {
      return falha(`O campo "${campo}" não existe no tipo ${tipo}.`);
    }
  }

  for (const campo of campos) {
    if (!(campo in serie)) return falha(`Falta o campo "${campo}".`);
    let r;
    if (campo === 'carga') r = validarCarga(serie.carga);
    else if (campo === 'reps') r = validarReps(serie.reps, tipo);
    else r = validarSegundos(serie.segundos);
    if (!r.ok) return r;
  }
  return ok(serie);
}

// ---------- Formatação ----------

// 62.5 → "62,5"; 60 → "60"; 62.25 → "62,25".
export function formatarCarga(kg) {
  return String(kg).replace('.', ',');
}

// 90 → "1:30"; 50 → "0:50"; 3600 → "60:00".
export function formatarTempo(segundos) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Exibição de uma série: "60 kg × 10", "15 reps", "0:50".
export function formatarSerie(serie) {
  switch (serie.tipo) {
    case 'carga':
      return `${formatarCarga(serie.carga)} kg × ${serie.reps}`;
    case 'corpo':
      return `${serie.reps} ${serie.reps === 1 ? 'rep' : 'reps'}`;
    case 'tempo':
      return formatarTempo(serie.segundos);
    default:
      return '';
  }
}
