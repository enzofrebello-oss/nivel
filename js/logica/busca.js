// busca.js: busca e filtros da Biblioteca (PROJETO.md, seção 5, tela Biblioteca).
// Funções puras: sem DOM, sem banco, sem fetch. Recebem a lista de exercícios do catálogo.
//
// - Busca pelo nome, sem diferenciar acentos e maiúsculas ("flexao" acha "Flexão").
//   Com várias palavras, todas precisam aparecer no nome, em qualquer ordem.
// - Filtro Local: 'todos' | 'casa' | 'academia'. Um exercício de casa e de academia
//   (locais ["casa", "academia"]) aparece nos dois filtros.
// - Filtro Grupo: id do vocabulário de grupos ou 'todos'. Conta qualquer grupo do
//   exercício, não só o principal.
// - Descontinuados não aparecem.
// - Resultado em ordem alfabética do nome (pt-BR, sem diferenciar acentos e maiúsculas).

export const LOCAIS_FILTRO = ['todos', 'casa', 'academia'];
export const TODOS = 'todos';

// Texto em minúsculas, sem acentos e com espaços simples nas pontas removidos.
export function normalizarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Palavras da busca já normalizadas; busca vazia (ou só espaços) → [].
function palavras(busca) {
  return normalizarTexto(busca).split(/\s+/).filter(Boolean);
}

const comparador = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

// Devolve um array novo com os exercícios que passam na busca e nos filtros, em ordem alfabética.
// filtros: { busca = '', local = 'todos', grupo = 'todos' }.
export function filtrarExercicios(exercicios, filtros = {}) {
  const termos = palavras(filtros.busca);
  const local = filtros.local || TODOS;
  const grupo = filtros.grupo || TODOS;

  return exercicios
    .filter((e) => {
      if (e.descontinuado) return false;
      if (local !== TODOS && !e.locais.includes(local)) return false;
      if (grupo !== TODOS && !e.grupos.includes(grupo)) return false;
      if (termos.length) {
        const nome = normalizarTexto(e.nome);
        if (!termos.every((t) => nome.includes(t))) return false;
      }
      return true;
    })
    .sort((a, b) => comparador.compare(a.nome, b.nome) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
