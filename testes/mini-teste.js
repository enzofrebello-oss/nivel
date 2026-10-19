// mini-teste.js: mini framework de testes que roda no navegador, sem dependências.
// teste(nome, fn) registra um teste; igual(a, b) e lanca(fn) são as conferências.
// rodar() executa os testes registrados (inclusive async) e devolve os resultados.

const registrados = [];

// Registra um teste. fn pode ser async. O teste passa se fn terminar sem lançar erro.
export function teste(nome, fn) {
  registrados.push({ nome, fn });
}

// Confere que a e b são iguais. Compara objetos e arrays por conteúdo.
export function igual(obtido, esperado, mensagem) {
  if (!iguais(obtido, esperado)) {
    const prefixo = mensagem ? `${mensagem}: ` : '';
    throw new Error(`${prefixo}esperado ${mostrar(esperado)}, veio ${mostrar(obtido)}`);
  }
}

// Confere que fn lança um erro.
export function lanca(fn, mensagem) {
  let lancou = false;
  try {
    fn();
  } catch {
    lancou = true;
  }
  if (!lancou) throw new Error(mensagem || 'esperava que lançasse um erro, mas não lançou');
}

// Executa em ordem os testes registrados desde a última chamada e esvazia a lista
// (assim cada arquivo de teste é rodado uma vez só). Devolve [{ nome, passou, erro }].
export async function rodar() {
  const resultados = [];
  for (const { nome, fn } of registrados.splice(0)) {
    try {
      await fn();
      resultados.push({ nome, passou: true, erro: null });
    } catch (erro) {
      resultados.push({ nome, passou: false, erro: erro && erro.message ? erro.message : String(erro) });
    }
  }
  return resultados;
}

function iguais(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const chavesA = Object.keys(a);
  const chavesB = Object.keys(b);
  if (chavesA.length !== chavesB.length) return false;
  return chavesA.every((chave) => Object.prototype.hasOwnProperty.call(b, chave) && iguais(a[chave], b[chave]));
}

function mostrar(valor) {
  if (valor === undefined) return 'undefined';
  try {
    return JSON.stringify(valor);
  } catch {
    return String(valor);
  }
}
