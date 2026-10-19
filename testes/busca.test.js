// busca.test.js: testes de js/logica/busca.js (PROJETO.md, seção 5, tela Biblioteca, e etapa 5).
// Busca sem diferenciar acentos e maiúsculas, filtros Local e Grupo (sozinhos e combinados),
// descontinuados fora, ordem alfabética e uma conferência com os dados reais de dados/.

import { teste, igual } from './mini-teste.js';
import { filtrarExercicios, normalizarTexto, LOCAIS_FILTRO } from '../js/logica/busca.js';
import { carregarCatalogo } from '../js/catalogo.js';

// ---------- Dados fixos ----------

function exercicio(id, nome, locais, grupos, extra = {}) {
  return { id, nome, tipo: 'corpo', locais, nivel: 2, grupos, ...extra };
}

const LISTA = [
  exercicio('flexao-no-chao', 'Flexão no chão', ['casa', 'academia'], ['peito', 'triceps', 'ombros']),
  exercicio('mergulho-cadeira', 'Mergulho na cadeira', ['casa'], ['triceps', 'peito']),
  exercicio('supino-reto-barra', 'Supino reto com barra', ['academia'], ['peito', 'triceps']),
  exercicio('rosca-mochila', 'Rosca bíceps com mochila', ['casa'], ['biceps']),
  exercicio('rosca-direta-barra', 'Rosca direta com barra', ['academia'], ['biceps', 'antebraco']),
  exercicio('agachamento-livre', 'Agachamento livre', ['casa', 'academia'], ['quadriceps', 'gluteos']),
  exercicio('elevacao-pelvica', 'Elevação pélvica', ['casa', 'academia'], ['gluteos', 'posterior']),
  exercicio('flexao-antiga', 'Flexão antiga', ['casa', 'academia'], ['peito'], { descontinuado: true }),
];

const ids = (lista) => lista.map((e) => e.id);
const ordenados = (lista) => ids(lista).slice().sort();

// ---------- normalizarTexto ----------

teste('normalizarTexto: tira acentos, passa para minúsculas e corta espaços das pontas', () => {
  igual(normalizarTexto('  Elevação PÉLVICA '), 'elevacao pelvica');
  igual(normalizarTexto('Bíceps, Tríceps, Glúteos, Quadríceps'), 'biceps, triceps, gluteos, quadriceps');
  igual(normalizarTexto(null), '');
});

// ---------- Busca ----------

teste('busca: sem acento acha nome com acento ("flexao" acha "Flexão no chão")', () => {
  igual(ids(filtrarExercicios(LISTA, { busca: 'flexao' })), ['flexao-no-chao']);
});

teste('busca: com acento acha o mesmo nome ("flexão" acha "Flexão no chão")', () => {
  igual(ids(filtrarExercicios(LISTA, { busca: 'flexão' })), ['flexao-no-chao']);
});

teste('busca: acento na busca acha nome sem acento no mesmo ponto ("cadéira" acha "Mergulho na cadeira")', () => {
  igual(ids(filtrarExercicios(LISTA, { busca: 'cadéira' })), ['mergulho-cadeira']);
});

teste('busca: não diferencia maiúsculas ("ELEVAÇÃO" e "eLeVaCaO" acham "Elevação pélvica")', () => {
  igual(ids(filtrarExercicios(LISTA, { busca: 'ELEVAÇÃO' })), ['elevacao-pelvica']);
  igual(ids(filtrarExercicios(LISTA, { busca: 'eLeVaCaO' })), ['elevacao-pelvica']);
});

teste('busca: trecho no meio do nome também acha ("barra" acha os dois com barra)', () => {
  igual(ids(filtrarExercicios(LISTA, { busca: 'barra' })), ['rosca-direta-barra', 'supino-reto-barra']);
});

teste('busca: várias palavras precisam aparecer todas, em qualquer ordem ("barra rosca")', () => {
  igual(ids(filtrarExercicios(LISTA, { busca: 'barra rosca' })), ['rosca-direta-barra']);
  igual(ids(filtrarExercicios(LISTA, { busca: '  rosca   mochila ' })), ['rosca-mochila']);
});

teste('busca: vazia, só espaços ou ausente lista todos os exercícios não descontinuados', () => {
  const esperado = ids(LISTA.filter((e) => !e.descontinuado)).sort();
  igual(ordenados(filtrarExercicios(LISTA, { busca: '' })), esperado);
  igual(ordenados(filtrarExercicios(LISTA, { busca: '   ' })), esperado);
  igual(ordenados(filtrarExercicios(LISTA)), esperado);
});

teste('busca: palavra que não existe em nenhum nome não acha nada', () => {
  igual(filtrarExercicios(LISTA, { busca: 'xyz' }), []);
});

teste('descontinuado: não aparece nem sem filtro, nem buscando pelo nome dele', () => {
  igual(ids(filtrarExercicios(LISTA)).includes('flexao-antiga'), false);
  igual(filtrarExercicios(LISTA, { busca: 'antiga' }), []);
});

// ---------- Filtro Local ----------

teste('filtro Local: os valores são Todos, Casa e Academia', () => {
  igual(LOCAIS_FILTRO, ['todos', 'casa', 'academia']);
});

teste('filtro Local "todos" lista casa, academia e os de ambos', () => {
  igual(filtrarExercicios(LISTA, { local: 'todos' }).length, 7);
});

teste('filtro Local "casa": só de casa + os de casa e academia (ambos)', () => {
  igual(ordenados(filtrarExercicios(LISTA, { local: 'casa' })),
    ['agachamento-livre', 'elevacao-pelvica', 'flexao-no-chao', 'mergulho-cadeira', 'rosca-mochila']);
});

teste('filtro Local "academia": só de academia + os de casa e academia (ambos)', () => {
  igual(ordenados(filtrarExercicios(LISTA, { local: 'academia' })),
    ['agachamento-livre', 'elevacao-pelvica', 'flexao-no-chao', 'rosca-direta-barra', 'supino-reto-barra']);
});

// ---------- Filtro Grupo ----------

teste('filtro Grupo: conta qualquer grupo do exercício, não só o principal ("triceps")', () => {
  igual(ordenados(filtrarExercicios(LISTA, { grupo: 'triceps' })),
    ['flexao-no-chao', 'mergulho-cadeira', 'supino-reto-barra']);
});

teste('filtro Grupo "todos" não filtra nada', () => {
  igual(filtrarExercicios(LISTA, { grupo: 'todos' }).length, 7);
});

teste('filtro Grupo sem nenhum exercício ("panturrilha") não acha nada', () => {
  igual(filtrarExercicios(LISTA, { grupo: 'panturrilha' }), []);
});

// ---------- Combinações ----------

teste('Local + Grupo: casa + peito = os de casa (ou ambos) que trabalham peito', () => {
  igual(ordenados(filtrarExercicios(LISTA, { local: 'casa', grupo: 'peito' })), ['flexao-no-chao', 'mergulho-cadeira']);
});

teste('Local + Grupo: academia + bíceps = só a rosca com barra', () => {
  igual(ids(filtrarExercicios(LISTA, { local: 'academia', grupo: 'biceps' })), ['rosca-direta-barra']);
});

teste('Local + Grupo: combinação sem resultado (casa + antebraço) devolve lista vazia', () => {
  igual(filtrarExercicios(LISTA, { local: 'casa', grupo: 'antebraco' }), []);
});

teste('busca + Local + Grupo juntos: "rosca" + casa + bíceps = só a rosca com mochila', () => {
  igual(ids(filtrarExercicios(LISTA, { busca: 'ROSCA', local: 'casa', grupo: 'biceps' })), ['rosca-mochila']);
});

teste('busca + filtros sem resultado: "supino" + casa devolve lista vazia', () => {
  igual(filtrarExercicios(LISTA, { busca: 'supino', local: 'casa' }), []);
});

// ---------- Ordem e entrada ----------

teste('ordem: resultado em ordem alfabética do nome, ignorando acentos', () => {
  igual(filtrarExercicios(LISTA).map((e) => e.nome), [
    'Agachamento livre', 'Elevação pélvica', 'Flexão no chão', 'Mergulho na cadeira',
    'Rosca bíceps com mochila', 'Rosca direta com barra', 'Supino reto com barra',
  ]);
});

teste('entrada: a lista original não é alterada (nem a ordem)', () => {
  const antes = ids(LISTA);
  filtrarExercicios(LISTA, { busca: 'a', local: 'casa' });
  igual(ids(LISTA), antes);
});

// ---------- Dados reais ----------

teste('dados reais: sem busca nem filtro lista todos os exercícios não descontinuados do catálogo', async () => {
  const c = await carregarCatalogo();
  const listaveis = c.exercicios.filter((e) => !e.descontinuado);
  igual(filtrarExercicios(c.exercicios).length, listaveis.length);
  igual(filtrarExercicios(c.exercicios).length, 165, 'o catálogo atual tem 165 exercícios listáveis');
});

teste('dados reais: Casa + Academia cobrem tudo, e os de ambos aparecem nos dois', async () => {
  const c = await carregarCatalogo();
  const casa = filtrarExercicios(c.exercicios, { local: 'casa' }).length;
  const academia = filtrarExercicios(c.exercicios, { local: 'academia' }).length;
  const ambos = c.exercicios.filter((e) => !e.descontinuado && e.locais.length === 2).length;
  igual(casa + academia - ambos, filtrarExercicios(c.exercicios).length);
});

teste('dados reais: cada combinação Local × Grupo confere com uma contagem direta nos dados', async () => {
  const c = await carregarCatalogo();
  for (const local of ['casa', 'academia']) {
    for (const g of c.grupos) {
      const esperado = c.exercicios.filter((e) => !e.descontinuado && e.locais.includes(local) && e.grupos.includes(g.id)).length;
      igual(filtrarExercicios(c.exercicios, { local, grupo: g.id }).length, esperado, `${local} + ${g.id}`);
    }
  }
});

teste('dados reais: "flexao" e "FLEXÃO" dão o mesmo resultado, e "Flexão no chão" está nele', async () => {
  const c = await carregarCatalogo();
  const semAcento = ids(filtrarExercicios(c.exercicios, { busca: 'flexao' }));
  igual(ids(filtrarExercicios(c.exercicios, { busca: 'FLEXÃO' })), semAcento);
  igual(semAcento.includes('flexao-no-chao'), true);
});
