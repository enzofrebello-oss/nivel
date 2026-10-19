// catalogo.js: catálogo somente leitura (PROJETO.md, seções 2 e 4.1).
// fetch dos 3 JSON de dados/, validarDados(), congelamento profundo e mapas por id
// (exercício, trilha, trilha do exercício, rotina). As telas só leem o catálogo por aqui.

import { validarDados } from './logica/validar-dados.js';

export const ARQUIVOS_DADOS = {
  exercicios: new URL('../dados/exercicios.json', import.meta.url).href,
  progressoes: new URL('../dados/progressoes.json', import.meta.url).href,
  rotinas: new URL('../dados/rotinas.json', import.meta.url).href,
};

// Erro de catálogo: JSON que não carrega, não é JSON válido ou não passa nas regras.
// erros traz uma mensagem por problema.
export class ErroDadosInvalidos extends Error {
  constructor(erros) {
    super(`Dados do app inválidos: ${erros[0]}${erros.length > 1 ? ` (e mais ${erros.length - 1})` : ''}`);
    this.name = 'ErroDadosInvalidos';
    this.erros = erros;
  }
}

// Congela o objeto e tudo o que ele contém.
export function congelar(valor) {
  if (typeof valor === 'object' && valor !== null && !Object.isFrozen(valor)) {
    Object.freeze(valor);
    for (const filho of Object.values(valor)) congelar(filho);
  }
  return valor;
}

// Map que não aceita mudanças (Object.freeze não impede set/delete/clear num Map).
function mapaSomenteLeitura(entradas) {
  const mapa = new Map(entradas);
  const recusar = () => {
    throw new TypeError('O catálogo é somente leitura');
  };
  mapa.set = recusar;
  mapa.delete = recusar;
  mapa.clear = recusar;
  return Object.freeze(mapa);
}

// Recebe o conteúdo dos 3 arquivos, valida e devolve o catálogo congelado com os mapas.
// Lança ErroDadosInvalidos se alguma regra falhar.
export function montarCatalogo(dados) {
  const { ok, erros } = validarDados(dados);
  if (!ok) throw new ErroDadosInvalidos(erros);

  const { exercicios, progressoes, rotinas } = congelar(dados);

  // Trilha do exercício: { trilha, posicao (1 = primeiro nível), meta }.
  const trilhaDoExercicio = [];
  for (const trilha of progressoes.trilhas) {
    trilha.niveis.forEach((nivel, i) => {
      trilhaDoExercicio.push([nivel.exercicio, Object.freeze({ trilha, posicao: i + 1, meta: nivel.meta })]);
    });
  }

  return Object.freeze({
    versaoDados: exercicios.versaoDados,
    grupos: exercicios.grupos,
    exercicios: exercicios.exercicios,
    trilhas: progressoes.trilhas,
    objetivos: rotinas.objetivos,
    rotinas: rotinas.rotinas,
    exercicioPorId: mapaSomenteLeitura(exercicios.exercicios.map((e) => [e.id, e])),
    trilhaPorId: mapaSomenteLeitura(progressoes.trilhas.map((t) => [t.id, t])),
    trilhaDoExercicio: mapaSomenteLeitura(trilhaDoExercicio),
    rotinaPorId: mapaSomenteLeitura(rotinas.rotinas.map((r) => [r.id, r])),
  });
}

// Busca os 3 JSON e monta o catálogo. buscar = fetch (os testes passam um fetch falso).
// Arquivo que não carrega ou que não é JSON válido também vira ErroDadosInvalidos.
export async function carregarCatalogo(buscar = fetch) {
  const nomes = Object.keys(ARQUIVOS_DADOS);
  const erros = [];
  const dados = {};
  await Promise.all(nomes.map(async (nome) => {
    try {
      const resposta = await buscar(ARQUIVOS_DADOS[nome]);
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      dados[nome] = await resposta.json();
    } catch (erro) {
      erros.push(`${nome}.json: não foi possível ler (${erro && erro.message ? erro.message : erro})`);
    }
  }));
  if (erros.length) throw new ErroDadosInvalidos(erros);
  return montarCatalogo(dados);
}

// ---------- Catálogo do app (carregado uma vez na abertura) ----------

let catalogo = null;

export async function iniciarCatalogo(buscar = fetch) {
  catalogo = await carregarCatalogo(buscar);
  return catalogo;
}

export function obterCatalogo() {
  if (!catalogo) throw new Error('Catálogo ainda não carregado');
  return catalogo;
}
