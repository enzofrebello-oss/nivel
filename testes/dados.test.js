// dados.test.js: testes de js/logica/validar-dados.js e js/catalogo.js
// (PROJETO.md, seção 4.1, "Regras de validação", e seção 9, "Regra de local" e exceções por id).
// Os JSON reais de dados/ precisam passar; cada regra tem pelo menos um caso quebrado
// com dados fixos, que o validador recusa com uma mensagem que identifica o problema.

import { teste, igual, lanca } from './mini-teste.js';
import { validarDados, classificarEquipamento } from '../js/logica/validar-dados.js';
import { montarCatalogo, carregarCatalogo, ErroDadosInvalidos, congelar } from '../js/catalogo.js';

// ---------- Dados fixos: o menor catálogo válido ----------

const GRUPOS = [
  ['peito', 'Peito'], ['costas', 'Costas'], ['ombros', 'Ombros'], ['biceps', 'Bíceps'], ['triceps', 'Tríceps'],
  ['antebraco', 'Antebraço'], ['core', 'Core'], ['lombar', 'Lombar'], ['quadriceps', 'Quadríceps'],
  ['posterior', 'Posterior de coxa'], ['gluteos', 'Glúteos'], ['adutores', 'Adutores'], ['panturrilha', 'Panturrilha'],
].map(([id, nome]) => ({ id, nome }));

function exercicio(id, tipo, locais, equipamento, extra = {}) {
  return {
    id, nome: `Exercício ${id}`, tipo, locais, nivel: 2, equipamento,
    musculos: ['peitoral', 'tríceps'], grupos: ['peito', 'triceps'],
    passos: ['Primeiro passo.', 'Segundo passo.', 'Terceiro passo.'],
    erroComum: 'Deixar o quadril cair.', imagem: null, ...extra,
  };
}

// Devolve um catálogo novo a cada chamada (os testes podem estragá-lo à vontade).
function valido() {
  const exercicios = [
    exercicio('flexao-na-parede', 'corpo', ['casa', 'academia'], ['parede']),
    exercicio('flexao-no-chao', 'corpo', ['casa', 'academia'], []),
    exercicio('prancha', 'tempo', ['casa', 'academia'], []),
    exercicio('prancha-alta', 'tempo', ['casa', 'academia'], ['chão']),
    exercicio('remada-mochila', 'carga', ['casa'], ['mochila com livros']),
    exercicio('rosca-halteres', 'carga', ['academia'], ['halteres', 'banco']),
    exercicio('remada-halter-cadeira', 'carga', ['academia'], ['halter', 'cadeira']),
    // exceção de local decidida pelo usuário (seção 9): parede + almofada → casa e academia
    exercicio('flexao-parada-de-mao-parede', 'corpo', ['casa', 'academia'], ['parede', 'almofada ou colchonete']),
    // descontinuado: continua no arquivo, mas fora de trilhas e rotinas
    exercicio('agachamento-antigo', 'corpo', ['casa', 'academia'], [], { descontinuado: true }),
  ];
  const trilhas = [
    { id: 'flexoes', nome: 'Flexões', niveis: [
      { exercicio: 'flexao-na-parede', meta: { series: 3, reps: 15 } },
      { exercicio: 'flexao-no-chao', meta: { series: 3, reps: 12 } }] },
    { id: 'core-prancha', nome: 'Core e prancha', niveis: [
      { exercicio: 'prancha', meta: { series: 3, segundos: 45 } },
      { exercicio: 'prancha-alta', meta: { series: 3, segundos: 45 } }] },
    // trilha mista (um nível só de casa, outro só de academia): não pode entrar em rotina nenhuma
    { id: 'bracos', nome: 'Braços', niveis: [
      { exercicio: 'remada-mochila', meta: { series: 3, reps: 10 } },
      { exercicio: 'rosca-halteres', meta: { series: 3, reps: 10 } }] },
  ];
  const rotinas = [];
  for (const objetivo of ['massa', 'forca', 'condicionamento']) {
    for (const diasPorSemana of [3, 4]) {
      for (const local of ['casa', 'academia']) {
        rotinas.push({
          id: `${objetivo}-${diasPorSemana}-${local}`, objetivo, diasPorSemana, local, descanso: 90,
          dias: ['a', 'b', 'c', 'd'].slice(0, diasPorSemana).map((id) => ({
            id, nome: `${id.toUpperCase()} · Corpo inteiro`,
            itens: [
              { trilha: 'flexoes', series: 4 },
              { exercicio: local === 'casa' ? 'remada-mochila' : 'rosca-halteres', series: 3, alvo: '8-12' },
              { trilha: 'core-prancha', descanso: 45 },
            ],
          })),
        });
      }
    }
  }
  return {
    exercicios: { versaoDados: 1, grupos: GRUPOS.map((g) => ({ ...g })), exercicios },
    progressoes: { versaoDados: 1, trilhas },
    rotinas: {
      versaoDados: 1,
      objetivos: [
        { id: 'massa', nome: 'Ganhar massa' },
        { id: 'forca', nome: 'Força e habilidades' },
        { id: 'condicionamento', nome: 'Condicionamento geral' },
      ],
      rotinas,
    },
  };
}

// Atalhos para achar partes do catálogo fixo.
const ex = (d, id) => d.exercicios.exercicios.find((e) => e.id === id);
const tr = (d, id) => d.progressoes.trilhas.find((t) => t.id === id);
const ro = (d, id) => d.rotinas.rotinas.find((r) => r.id === id);
const diaA = (d, id = 'massa-3-casa') => ro(d, id).dias[0];

// O validador recusa o catálogo depois de mudar(d), com uma mensagem que contém todos os trechos.
function recusa(mudar, ...trechos) {
  const d = valido();
  mudar(d);
  const r = validarDados(d);
  igual(r.ok, false, 'deveria recusar');
  const achou = r.erros.some((e) => trechos.every((t) => e.includes(t)));
  if (!achou) throw new Error(`nenhuma mensagem com ${JSON.stringify(trechos)}; veio: ${r.erros.join(' | ')}`);
}

// O validador aceita o catálogo depois de mudar(d).
function aceita(mudar) {
  const d = valido();
  mudar(d);
  const r = validarDados(d);
  igual(r.erros, [], 'não deveria ter erros');
  igual(r.ok, true);
}

async function rejeita(promessa, Classe) {
  try {
    await promessa;
  } catch (erro) {
    if (!(erro instanceof Classe)) throw new Error(`esperava ${Classe.name}, veio ${erro && erro.name}: ${erro && erro.message}`);
    return erro;
  }
  throw new Error('esperava que rejeitasse, mas resolveu');
}

// fetch falso: devolve o texto dado para cada arquivo (pelo fim da URL).
function fetchFalso(textos, status = 200) {
  return async (url) => {
    const nome = Object.keys(textos).find((n) => String(url).endsWith(`/${n}.json`));
    return { ok: status === 200, status, json: async () => JSON.parse(textos[nome]) };
  };
}

function textosValidos() {
  const d = valido();
  return { exercicios: JSON.stringify(d.exercicios), progressoes: JSON.stringify(d.progressoes), rotinas: JSON.stringify(d.rotinas) };
}

// ---------- JSON reais ----------

async function lerReal(nome) {
  const resposta = await fetch(new URL(`../dados/${nome}.json`, import.meta.url));
  if (!resposta.ok) throw new Error(`${nome}.json: HTTP ${resposta.status}`);
  return resposta.json();
}

teste('JSON reais: os 3 arquivos de dados/ passam em todas as regras sem erro', async () => {
  const dados = { exercicios: await lerReal('exercicios'), progressoes: await lerReal('progressoes'), rotinas: await lerReal('rotinas') };
  const r = validarDados(dados);
  if (!r.ok) throw new Error(`${r.erros.length} erro(s): ${r.erros.slice(0, 5).join(' | ')}`);
});

teste('JSON reais: carregarCatalogo monta os mapas por id (exercício, trilha, trilha do exercício, rotina)', async () => {
  const c = await carregarCatalogo();
  igual(c.exercicioPorId.size, c.exercicios.length, 'um exercício por id');
  igual(c.trilhaPorId.size, c.trilhas.length, 'uma trilha por id');
  igual(c.rotinaPorId.size, 12, '12 rotinas');
  igual(c.exercicioPorId.get('flexao-na-parede').tipo, 'corpo');
  const t = c.trilhaDoExercicio.get('flexao-na-parede');
  igual([t.trilha.id, t.posicao], ['flexoes', 1], 'flexão na parede é o nível 1 de Flexões');
  igual(c.rotinaPorId.get('massa-3-casa').diasPorSemana, 3);
  igual(c.versaoDados >= 1, true);
});

teste('JSON reais: o catálogo carregado fica congelado (mudar objeto ou mapa lança erro)', async () => {
  const c = await carregarCatalogo();
  lanca(() => { c.exercicioPorId.get('flexao-na-parede').nome = 'outro'; }, 'exercício deveria estar congelado');
  lanca(() => { c.exercicios.push({}); }, 'lista de exercícios deveria estar congelada');
  lanca(() => { c.trilhas[0].niveis[0].meta.reps = 99; }, 'meta deveria estar congelada');
  lanca(() => { c.exercicioPorId.set('novo', {}); }, 'mapa deveria recusar set');
  lanca(() => { c.rotinaPorId.delete('massa-3-casa'); }, 'mapa deveria recusar delete');
});

// ---------- Caso válido mínimo ----------

teste('caso válido mínimo (dados fixos) passa sem erro: o validador não recusa tudo', () => aceita(() => {}));
teste('caso válido: imagem com caminho img/exercicios/<id>.webp é aceita', () => aceita((d) => {
  ex(d, 'prancha').imagem = 'img/exercicios/prancha.webp';
}));
teste('caso válido: exercício descontinuado fora de trilhas e rotinas é aceito', () => aceita((d) => {
  ex(d, 'flexao-no-chao').descontinuado = false;
}));
teste('caso válido: item com trilha sem series e com descanso próprio é aceito', () => aceita((d) => {
  diaA(d).itens[0] = { trilha: 'flexoes', descanso: 60 };
}));

// ---------- Catálogo: carregar, validar, congelar ----------

teste('catálogo: montarCatalogo com dados fixos válidos monta os mapas e congela', () => {
  const c = montarCatalogo(valido());
  igual(c.exercicioPorId.get('prancha').tipo, 'tempo');
  igual(c.trilhaDoExercicio.get('prancha-alta').posicao, 2);
  igual(c.trilhaDoExercicio.has('agachamento-antigo'), false, 'exercício fora de trilha não tem trilha');
  igual(c.trilhaPorId.get('core-prancha').niveis.length, 2);
  igual(Object.isFrozen(c.rotinaPorId.get('forca-4-academia').dias[3].itens[0]), true);
});
teste('catálogo: montarCatalogo com dados quebrados lança ErroDadosInvalidos com a lista de erros', () => {
  const d = valido();
  diaA(d).itens[1].exercicio = 'nao-existe';
  let erro = null;
  try {
    montarCatalogo(d);
  } catch (e) {
    erro = e;
  }
  igual(erro instanceof ErroDadosInvalidos, true, 'deveria lançar ErroDadosInvalidos');
  igual(erro.erros.some((m) => m.includes('"nao-existe" não existe')), true, 'lista de erros cita o exercício');
  igual(erro.message.startsWith('Dados do app inválidos'), true);
});
teste('catálogo: carregarCatalogo com fetch falso de dados válidos funciona', async () => {
  const c = await carregarCatalogo(fetchFalso(textosValidos()));
  igual(c.rotinaPorId.size, 12);
});
teste('catálogo: JSON quebrado (texto que não é JSON) vira ErroDadosInvalidos', async () => {
  const textos = textosValidos();
  textos.rotinas = textos.rotinas.slice(0, -10); // arquivo cortado no meio
  const erro = await rejeita(carregarCatalogo(fetchFalso(textos)), ErroDadosInvalidos);
  igual(erro.erros.some((m) => m.startsWith('rotinas.json')), true, 'o erro aponta rotinas.json');
});
teste('catálogo: JSON válido mas fora das regras vira ErroDadosInvalidos', async () => {
  const textos = textosValidos();
  textos.progressoes = textos.progressoes.replace('"versaoDados":1', '"versaoDados":2');
  const erro = await rejeita(carregarCatalogo(fetchFalso(textos)), ErroDadosInvalidos);
  igual(erro.erros.some((m) => m.includes('versaoDados diferente')), true);
});
teste('catálogo: arquivo que não carrega (HTTP 404) vira ErroDadosInvalidos', async () => {
  await rejeita(carregarCatalogo(fetchFalso(textosValidos(), 404)), ErroDadosInvalidos);
});
teste('catálogo: congelar congela objetos aninhados', () => {
  const o = congelar({ a: { b: [1, { c: 2 }] } });
  igual(Object.isFrozen(o.a.b[1]), true);
});

// ---------- Estrutura básica ----------

teste('estrutura: sem nenhum dado é recusado sem travar', () => {
  const r = validarDados(undefined);
  igual(r.ok, false);
  igual(r.erros.length >= 3, true, 'um erro por arquivo');
});
teste('estrutura: arquivo que é lista em vez de objeto é recusado', () => recusa((d) => { d.progressoes = []; }, 'progressoes.json', 'precisa ser um objeto JSON'));
teste('estrutura: "exercicios" que não é lista é recusado', () => recusa((d) => { d.exercicios.exercicios = {}; }, '"exercicios" precisa ser uma lista'));
teste('estrutura: "trilhas" que não é lista é recusado', () => recusa((d) => { d.progressoes.trilhas = null; }, '"trilhas" precisa ser uma lista'));
teste('estrutura: "rotinas" que não é lista é recusado', () => recusa((d) => { d.rotinas.rotinas = 'x'; }, '"rotinas" precisa ser uma lista'));

// ---------- Regra 1: versaoDados ----------

teste('regra 1: versaoDados diferente entre os 3 arquivos é recusado', () => recusa((d) => { d.rotinas.versaoDados = 2; }, 'versaoDados diferente'));
teste('regra 1: versaoDados 0 é recusado (inteiro ≥ 1)', () => recusa((d) => {
  d.exercicios.versaoDados = 0; d.progressoes.versaoDados = 0; d.rotinas.versaoDados = 0;
}, 'exercicios.json', 'versaoDados precisa ser inteiro ≥ 1'));
teste("regra 1: versaoDados em texto ('1') é recusado", () => recusa((d) => { d.progressoes.versaoDados = '1'; }, 'progressoes.json', 'versaoDados precisa ser inteiro'));
teste('regra 1: versaoDados ausente é recusado', () => recusa((d) => { delete d.rotinas.versaoDados; }, 'rotinas.json', 'falta o campo obrigatório "versaoDados"'));

// ---------- Regra 2: ids ----------

teste('regra 2: id de exercício fora do kebab-case (maiúscula e _) é recusado', () => recusa((d) => { ex(d, 'prancha').id = 'Prancha_Alta2'; }, '"Prancha_Alta2"', 'kebab-case'));
teste('regra 2: id de exercício com acento é recusado', () => recusa((d) => { ex(d, 'remada-mochila').id = 'remada-mochíla'; }, 'kebab-case'));
teste('regra 2: id de exercício com hífen no fim é recusado', () => recusa((d) => { ex(d, 'agachamento-antigo').id = 'agachamento-'; }, 'kebab-case'));
teste('regra 2: id de exercício repetido é recusado', () => recusa((d) => { ex(d, 'flexao-no-chao').id = 'flexao-na-parede'; }, 'id "flexao-na-parede" repetido'));
teste('regra 2: id de trilha fora do kebab-case é recusado', () => recusa((d) => { tr(d, 'bracos').id = 'braços'; }, 'trilha', 'kebab-case'));
teste('regra 2: id de trilha repetido é recusado', () => recusa((d) => { tr(d, 'bracos').id = 'flexoes'; }, 'id "flexoes" repetido'));
teste('regra 2: id de rotina repetido é recusado', () => recusa((d) => {
  d.rotinas.rotinas[1] = JSON.parse(JSON.stringify(d.rotinas.rotinas[0]));
}, 'id "massa-3-casa" repetido'));
teste('regra 2: id de dia repetido dentro da rotina é recusado', () => recusa((d) => { ro(d, 'massa-3-casa').dias[1].id = 'a'; }, 'massa-3-casa', 'id de dia repetido'));
teste('regra 2: grupo fora do vocabulário (id "peitoral") é recusado', () => recusa((d) => { d.exercicios.grupos[0].id = 'peitoral'; }, 'grupos[0]', '"peitoral" fora do vocabulário'));
teste('regra 2: vocabulário de grupos faltando um (12 itens) é recusado', () => recusa((d) => { d.exercicios.grupos.pop(); }, 'grupos', 'exatamente 13 itens'));
teste('regra 2: vocabulário de grupos fora da ordem é recusado', () => recusa((d) => { d.exercicios.grupos.reverse(); }, 'grupos[0]', 'fora do vocabulário'));
teste('regra 2: nome de grupo diferente do vocabulário é recusado', () => recusa((d) => { d.exercicios.grupos[3].nome = 'Biceps'; }, 'nome de "biceps" precisa ser "Bíceps"'));
teste('regra 2: objetivos com 4 itens é recusado', () => recusa((d) => { d.rotinas.objetivos.push({ id: 'emagrecer', nome: 'Emagrecer' }); }, 'objetivos', 'exatamente 3 itens'));
teste('regra 2: objetivo com id fora da lista é recusado', () => recusa((d) => { d.rotinas.objetivos[1].id = 'forca-total'; }, 'objetivos[1]', '"forca-total" fora do vocabulário'));

// ---------- Regra 3: tipos, valores, faixas, obrigatórios, campos desconhecidos ----------

teste('regra 3: campo desconhecido no exercício (erro de digitação "nomee") é recusado', () => recusa((d) => { ex(d, 'prancha').nomee = 'x'; }, '"prancha"', 'campo desconhecido "nomee"'));
teste('regra 3: campo desconhecido na raiz do arquivo é recusado', () => recusa((d) => { d.rotinas.extra = 1; }, 'rotinas.json', 'campo desconhecido "extra"'));
teste('regra 3: campo desconhecido no grupo é recusado', () => recusa((d) => { d.exercicios.grupos[0].cor = 'red'; }, 'campo desconhecido "cor"'));
teste('regra 3: campo desconhecido na trilha é recusado', () => recusa((d) => { tr(d, 'flexoes').ordem = 1; }, '"flexoes"', 'campo desconhecido "ordem"'));
teste('regra 3: campo desconhecido no nível da trilha é recusado', () => recusa((d) => { tr(d, 'flexoes').niveis[0].nota = 'x'; }, 'nível 1', 'campo desconhecido "nota"'));
teste('regra 3: campo desconhecido na meta é recusado', () => recusa((d) => { tr(d, 'flexoes').niveis[0].meta.carga = 10; }, 'meta', 'campo desconhecido "carga"'));
teste('regra 3: campo desconhecido na rotina é recusado', () => recusa((d) => { ro(d, 'forca-3-casa').nome = 'x'; }, '"forca-3-casa"', 'campo desconhecido "nome"'));
teste('regra 3: campo desconhecido no dia é recusado', () => recusa((d) => { diaA(d).foco = 'x'; }, 'dia "a"', 'campo desconhecido "foco"'));
teste('regra 3: campo desconhecido no item da rotina é recusado', () => recusa((d) => { diaA(d).itens[1].reps = 10; }, 'item 2', 'campo desconhecido "reps"'));
teste('regra 3: campo desconhecido no objetivo é recusado', () => recusa((d) => { d.rotinas.objetivos[0].icone = 'x'; }, 'campo desconhecido "icone"'));
teste('regra 3: exercício sem campo obrigatório (erroComum) é recusado', () => recusa((d) => { delete ex(d, 'prancha').erroComum; }, '"prancha"', 'falta o campo obrigatório "erroComum"'));
teste('regra 3: exercício sem imagem (obrigatório, mesmo null) é recusado', () => recusa((d) => { delete ex(d, 'prancha').imagem; }, 'falta o campo obrigatório "imagem"'));
teste('regra 3: nome de exercício vazio (só espaços) é recusado', () => recusa((d) => { ex(d, 'prancha').nome = '   '; }, '"prancha", nome', 'texto não vazio'));
teste('regra 3: nome de trilha vazio é recusado', () => recusa((d) => { tr(d, 'flexoes').nome = ''; }, '"flexoes", nome', 'texto não vazio'));
teste('regra 3: tipo de exercício inválido ("peso") é recusado', () => recusa((d) => { ex(d, 'prancha').tipo = 'peso'; }, 'tipo "peso" inválido'));
teste('regra 3: locais vazio é recusado', () => recusa((d) => { ex(d, 'prancha').locais = []; }, 'locais precisa ser lista com 1 ou 2 itens'));
teste('regra 3: locais com 3 itens é recusado', () => recusa((d) => { ex(d, 'prancha').locais = ['casa', 'academia', 'casa']; }, 'locais precisa ser lista com 1 ou 2 itens'));
teste('regra 3: locais com valor fora da lista ("rua") é recusado', () => recusa((d) => { ex(d, 'prancha').locais = ['rua']; }, 'locais só aceita'));
teste('regra 3: locais repetido (["casa", "casa"]) é recusado', () => recusa((d) => { ex(d, 'remada-mochila').locais = ['casa', 'casa']; }, 'locais repetido'));
teste('regra 3: nivel 0 é recusado (1 a 5)', () => recusa((d) => { ex(d, 'prancha').nivel = 0; }, 'nivel', 'inteiro de 1 a 5'));
teste('regra 3: nivel 6 é recusado (1 a 5)', () => recusa((d) => { ex(d, 'prancha').nivel = 6; }, 'nivel', 'inteiro de 1 a 5'));
teste('regra 3: nivel 2.5 é recusado (precisa ser inteiro)', () => recusa((d) => { ex(d, 'prancha').nivel = 2.5; }, 'nivel', 'inteiro de 1 a 5'));
teste('regra 3: equipamento que não é lista ("nenhum") é recusado', () => recusa((d) => { ex(d, 'prancha').equipamento = 'nenhum'; }, 'equipamento precisa ser uma lista'));
teste('regra 3: equipamento com texto vazio é recusado', () => recusa((d) => { ex(d, 'prancha').equipamento = ['']; }, 'equipamento[0]', 'texto não vazio'));
teste('regra 3: musculos vazio é recusado', () => recusa((d) => { ex(d, 'prancha').musculos = []; }, 'musculos precisa ser lista com pelo menos 1 item'));
teste('regra 3: músculo com texto vazio é recusado', () => recusa((d) => { ex(d, 'prancha').musculos = ['core', ' ']; }, 'musculos[1]', 'texto não vazio'));
teste('regra 3: passos com 2 itens é recusado (exatamente 3)', () => recusa((d) => { ex(d, 'prancha').passos.pop(); }, 'passos precisa ter exatamente 3 itens (veio 2)'));
teste('regra 3: passos com 4 itens é recusado (exatamente 3)', () => recusa((d) => { ex(d, 'prancha').passos.push('Quarto.'); }, 'passos precisa ter exatamente 3 itens (veio 4)'));
teste('regra 3: passo com texto vazio é recusado', () => recusa((d) => { ex(d, 'prancha').passos[2] = ''; }, 'passos[2]', 'texto não vazio'));
teste('regra 3: erroComum vazio é recusado', () => recusa((d) => { ex(d, 'prancha').erroComum = ''; }, 'erroComum', 'texto não vazio'));
teste('regra 3: erroComum começando com minúscula é recusado', () => recusa((d) => { ex(d, 'prancha').erroComum = 'deixar o quadril cair.'; }, 'erroComum precisa começar com letra maiúscula'));
teste('regra 3: imagem com caminho fora de img/exercicios/<id> é recusada', () => recusa((d) => { ex(d, 'prancha').imagem = '/fotos/prancha.png'; }, 'imagem precisa ser null'));
teste('regra 3: imagem com id de outro exercício é recusada', () => recusa((d) => { ex(d, 'prancha').imagem = 'img/exercicios/flexao-no-chao.webp'; }, 'imagem precisa ser null'));
teste('regra 3: descontinuado que não é boolean ("sim") é recusado', () => recusa((d) => { ex(d, 'agachamento-antigo').descontinuado = 'sim'; }, 'descontinuado precisa ser true ou false'));
teste('regra 3: trilha com 1 nível só é recusada (≥ 2)', () => recusa((d) => { tr(d, 'bracos').niveis.pop(); }, '"bracos"', 'pelo menos 2 níveis'));
teste('regra 3: meta.series 0 é recusada (1 a 5)', () => recusa((d) => { tr(d, 'flexoes').niveis[0].meta.series = 0; }, 'meta.series', 'inteiro de 1 a 5'));
teste('regra 3: meta.series 6 é recusada (1 a 5)', () => recusa((d) => { tr(d, 'flexoes').niveis[0].meta.series = 6; }, 'meta.series', 'inteiro de 1 a 5'));
teste('regra 3: meta sem series é recusada', () => recusa((d) => { delete tr(d, 'flexoes').niveis[0].meta.series; }, 'meta', 'falta o campo obrigatório "series"'));
teste('regra 3: meta.reps 51 é recusada (1 a 50)', () => recusa((d) => { tr(d, 'flexoes').niveis[1].meta.reps = 51; }, 'meta.reps', 'inteiro de 1 a 50'));
teste('regra 3: meta.reps 0 é recusada (1 a 50)', () => recusa((d) => { tr(d, 'flexoes').niveis[1].meta.reps = 0; }, 'meta.reps', 'inteiro de 1 a 50'));
teste('regra 3: meta.segundos 4 é recusada (5 a 300)', () => recusa((d) => { tr(d, 'core-prancha').niveis[0].meta.segundos = 4; }, 'meta.segundos', 'inteiro de 5 a 300'));
teste('regra 3: meta.segundos 301 é recusada (5 a 300)', () => recusa((d) => { tr(d, 'core-prancha').niveis[0].meta.segundos = 301; }, 'meta.segundos', 'inteiro de 5 a 300'));
teste('regra 3: meta com reps e segundos juntos é recusada', () => recusa((d) => { tr(d, 'flexoes').niveis[0].meta.segundos = 30; }, 'exatamente um entre reps e segundos'));
teste('regra 3: meta só com series (sem reps nem segundos) é recusada', () => recusa((d) => { delete tr(d, 'flexoes').niveis[0].meta.reps; }, 'exatamente um entre reps e segundos'));
teste('regra 3: nível sem meta é recusado', () => recusa((d) => { delete tr(d, 'flexoes').niveis[0].meta; }, 'meta precisa ser um objeto'));
teste('regra 3: descanso da rotina 29 é recusado (30 a 300)', () => recusa((d) => { ro(d, 'massa-3-casa').descanso = 29; }, 'descanso', 'inteiro de 30 a 300'));
teste('regra 3: descanso da rotina 301 é recusado (30 a 300)', () => recusa((d) => { ro(d, 'massa-3-casa').descanso = 301; }, 'descanso', 'inteiro de 30 a 300'));
teste('regra 3: diasPorSemana 5 é recusado (3 ou 4)', () => recusa((d) => { ro(d, 'massa-3-casa').diasPorSemana = 5; }, 'diasPorSemana precisa ser 3 ou 4'));
teste('regra 3: local da rotina "parque" é recusado', () => recusa((d) => { ro(d, 'massa-3-casa').local = 'parque'; }, 'local precisa ser "casa" ou "academia"'));
teste('regra 3: objetivo da rotina inexistente é recusado', () => recusa((d) => { ro(d, 'massa-3-casa').objetivo = 'hipertrofia'; }, 'objetivo "hipertrofia" não existe'));
teste('regra 3: dias pulando um id (a, b, d) é recusado', () => recusa((d) => { ro(d, 'massa-3-casa').dias[2].id = 'd'; }, 'dia "d"', 'em ordem e sem pular'));
teste('regra 3: dias fora de ordem (b, a, c) é recusado', () => recusa((d) => {
  const r = ro(d, 'massa-3-casa');
  r.dias[0].id = 'b'; r.dias[1].id = 'a';
}, 'em ordem e sem pular'));
teste('regra 3: nome do dia vazio é recusado', () => recusa((d) => { diaA(d).nome = ''; }, 'dia "a", nome', 'texto não vazio'));
teste('regra 3: dia sem itens é recusado (≥ 1)', () => recusa((d) => { diaA(d).itens = []; }, 'itens precisa ser lista com pelo menos 1 item'));
teste('regra 3: item com exercicio sem series é recusado', () => recusa((d) => { delete diaA(d).itens[1].series; }, 'item 2', 'item com exercicio precisa de series'));
teste('regra 3: item com series 7 é recusado (1 a 6)', () => recusa((d) => { diaA(d).itens[1].series = 7; }, 'item 2, series', 'inteiro de 1 a 6'));
teste('regra 3: item de trilha com series 0 é recusado (1 a 6)', () => recusa((d) => { diaA(d).itens[0].series = 0; }, 'item 1, series', 'inteiro de 1 a 6'));
teste('regra 3: item com exercicio sem alvo é recusado', () => recusa((d) => { delete diaA(d).itens[1].alvo; }, 'item com exercicio precisa de alvo'));
teste('regra 3: alvo "8 a 12" fora do formato é recusado', () => recusa((d) => { diaA(d).itens[1].alvo = '8 a 12'; }, 'alvo "8 a 12" fora do formato'));
teste('regra 3: alvo numérico (12 sem aspas) é recusado', () => recusa((d) => { diaA(d).itens[1].alvo = 12; }, 'alvo 12 fora do formato'));
teste('regra 3: alvo "1000" (mais de 3 dígitos) é recusado', () => recusa((d) => { diaA(d).itens[1].alvo = '1000'; }, 'fora do formato'));
teste('regra 3: alvo "12-8" com mínimo maior que o máximo é recusado', () => recusa((d) => { diaA(d).itens[1].alvo = '12-8'; }, 'mínimo maior que o máximo'));
teste('regra 3: alvo "0" é recusado (precisa ser pelo menos 1)', () => recusa((d) => { diaA(d).itens[1].alvo = '0'; }, 'precisa ser pelo menos 1'));
teste('regra 3: descanso do item 14 é recusado (15 a 300)', () => recusa((d) => { diaA(d).itens[2].descanso = 14; }, 'item 3, descanso', 'inteiro de 15 a 300'));
teste('regra 3: descanso do item 301 é recusado (15 a 300)', () => recusa((d) => { diaA(d).itens[2].descanso = 301; }, 'item 3, descanso', 'inteiro de 15 a 300'));

// ---------- Regra de local pelo equipamento (seção 4.1, campo locais; seção 9) ----------

teste('local: equipamento de academia (halteres) marcado casa e academia é recusado', () => recusa((d) => { ex(d, 'rosca-halteres').locais = ['casa', 'academia']; }, '"rosca-halteres"', 'não seguem a regra do equipamento', 'esperado ["academia"]'));
teste('local: halter misturado com cadeira marcado casa é recusado (academia ganha)', () => recusa((d) => { ex(d, 'remada-halter-cadeira').locais = ['casa']; }, '"remada-halter-cadeira"', 'esperado ["academia"]'));
teste('local: só objeto de casa (mochila) marcado casa e academia é recusado', () => recusa((d) => { ex(d, 'remada-mochila').locais = ['casa', 'academia']; }, '"remada-mochila"', 'esperado ["casa"]'));
teste('local: sem equipamento marcado só casa é recusado (vale nos dois)', () => recusa((d) => { ex(d, 'flexao-no-chao').locais = ['casa']; }, '"flexao-no-chao"', 'esperado ["casa","academia"]'));
teste('local: só parede marcado só academia é recusado (parede conta como sem equipamento)', () => recusa((d) => { ex(d, 'flexao-na-parede').locais = ['academia']; }, '"flexao-na-parede"', 'esperado ["casa","academia"]'));
teste('local: equipamento sem classificação ("prancha de surf") é recusado', () => recusa((d) => { ex(d, 'prancha').equipamento = ['prancha de surf']; }, 'equipamento "prancha de surf" sem classificação'));
teste('local: exceção por id (flexao-parada-de-mao-parede) só vale para esse id', () => recusa((d) => {
  ex(d, 'flexao-no-chao').equipamento = ['parede', 'almofada ou colchonete'];
}, '"flexao-no-chao"', 'esperado ["casa"]'));
teste('local: a exceção também exige o valor decidido (flexao-parada-de-mao-parede só casa é recusado)', () => recusa((d) => {
  ex(d, 'flexao-parada-de-mao-parede').locais = ['casa'];
}, '"flexao-parada-de-mao-parede"', 'esperado ["casa","academia"]'));
teste('local: classificação dos equipamentos do catálogo (academia, casa, sem equipamento)', () => {
  igual(classificarEquipamento('barras paralelas'), 'academia');
  igual(classificarEquipamento('máquina cadeira extensora'), 'academia', 'máquina ganha de cadeira');
  igual(classificarEquipamento('banco ou step'), 'academia');
  igual(classificarEquipamento('2 cadeiras (ou cadeira e sofá)'), 'casa');
  igual(classificarEquipamento('garrafa com água ou areia'), 'casa');
  igual(classificarEquipamento('parede'), 'neutro');
  igual(classificarEquipamento('bola suíça'), null);
});

// ---------- Regra 4: grupos do exercício ----------

teste('regra 4: grupo do exercício fora do vocabulário ("peitoral") é recusado', () => recusa((d) => { ex(d, 'prancha').grupos = ['core', 'peitoral']; }, '"prancha"', 'grupo "peitoral" não existe no vocabulário'));
teste('regra 4: exercício sem grupo nenhum é recusado (≥ 1)', () => recusa((d) => { ex(d, 'prancha').grupos = []; }, 'grupos precisa ser lista com pelo menos 1 item'));
teste('regra 4: grupo repetido no exercício é recusado', () => recusa((d) => { ex(d, 'prancha').grupos = ['core', 'core']; }, 'grupos repetido'));

// ---------- Regra 5: trilhas ----------

teste('regra 5: nível de trilha com exercício que não existe é recusado', () => recusa((d) => { tr(d, 'flexoes').niveis[1].exercicio = 'flexao-voadora'; }, 'trilha "flexoes", nível 2', 'exercício "flexao-voadora" não existe'));
teste('regra 5: nível de trilha com exercício descontinuado é recusado', () => recusa((d) => { ex(d, 'flexao-no-chao').descontinuado = true; }, 'trilha "flexoes", nível 2', '"flexao-no-chao" está descontinuado'));
teste('regra 5: exercício em duas trilhas é recusado', () => recusa((d) => { tr(d, 'bracos').niveis[0].exercicio = 'prancha'; tr(d, 'bracos').niveis[0].meta = { series: 3, segundos: 30 }; }, '"prancha" já aparece em trilha "core-prancha"'));
teste('regra 5: exercício duas vezes na mesma trilha é recusado', () => recusa((d) => { tr(d, 'flexoes').niveis[1].exercicio = 'flexao-na-parede'; }, '"flexao-na-parede" já aparece em trilha "flexoes", nível 1'));
teste('regra 5: meta com reps em exercício de tempo é recusada', () => recusa((d) => { tr(d, 'core-prancha').niveis[0].meta = { series: 3, reps: 10 }; }, '"prancha" é de tempo, a meta precisa usar segundos'));
teste('regra 5: meta com segundos em exercício de corpo é recusada', () => recusa((d) => { tr(d, 'flexoes').niveis[0].meta = { series: 3, segundos: 30 }; }, '"flexao-na-parede" é de corpo, a meta precisa usar reps'));
teste('regra 5: meta com segundos em exercício de carga é recusada', () => recusa((d) => { tr(d, 'bracos').niveis[0].meta = { series: 3, segundos: 30 }; }, '"remada-mochila" é de carga, a meta precisa usar reps'));

// ---------- Regra 6: rotinas ----------

teste('regra 6: rotina apontando para um exercício que não existe é recusada', () => recusa((d) => { diaA(d).itens[1].exercicio = 'supino-imaginario'; }, 'rotina "massa-3-casa", dia "a", item 2', 'exercício "supino-imaginario" não existe'));
teste('regra 6: rotina apontando para uma trilha que não existe é recusada', () => recusa((d) => { diaA(d).itens[0].trilha = 'trilha-fantasma'; }, 'item 1', 'trilha "trilha-fantasma" não existe'));
teste('regra 6: rotina com exercício descontinuado é recusada', () => recusa((d) => { diaA(d).itens[1].exercicio = 'agachamento-antigo'; }, 'item 2', '"agachamento-antigo" está descontinuado'));
teste('regra 6: 11 rotinas em vez de 12 é recusado', () => recusa((d) => { d.rotinas.rotinas.pop(); }, 'exatamente 12 rotinas (veio 11)'));
teste('regra 6: combinação faltando é recusada (aponta qual)', () => recusa((d) => { d.rotinas.rotinas.pop(); }, 'falta a rotina "condicionamento-4-academia"'));
teste('regra 6: 13 rotinas é recusado', () => recusa((d) => {
  const extra = JSON.parse(JSON.stringify(ro(d, 'massa-3-casa')));
  extra.id = 'massa-5-casa'; extra.diasPorSemana = 5;
  d.rotinas.rotinas.push(extra);
}, 'exatamente 12 rotinas (veio 13)'));
teste('regra 6: id da rotina diferente da combinação é recusado', () => recusa((d) => { ro(d, 'massa-3-casa').local = 'academia'; }, 'rotina "massa-3-casa"', 'id precisa ser a combinação "massa-3-academia"'));
teste('regra 6: número de dias diferente de diasPorSemana é recusado', () => recusa((d) => { ro(d, 'massa-4-casa').dias.pop(); }, 'rotina "massa-4-casa"', 'tem 3 dias, mas diasPorSemana é 4'));
teste('regra 6: item com exercicio e trilha ao mesmo tempo é recusado', () => recusa((d) => { diaA(d).itens[0].exercicio = 'flexao-no-chao'; }, 'item 1', 'exatamente um entre exercicio e trilha'));
teste('regra 6: item sem exercicio nem trilha é recusado', () => recusa((d) => { diaA(d).itens[2] = { series: 3 }; }, 'item 3', 'exatamente um entre exercicio e trilha'));
teste('regra 6: item com trilha e alvo é recusado (alvo é a meta do nível)', () => recusa((d) => { diaA(d).itens[0].alvo = '10'; }, 'item 1', 'item com trilha não pode ter alvo'));
teste('regra 6: exercício só de academia numa rotina de casa é recusado', () => recusa((d) => { diaA(d).itens[1].exercicio = 'rosca-halteres'; }, 'rotina "massa-3-casa"', '"rosca-halteres" não serve em casa'));
teste('regra 6: exercício só de casa numa rotina de academia é recusado', () => recusa((d) => { diaA(d, 'forca-4-academia').itens[1].exercicio = 'remada-mochila'; }, 'rotina "forca-4-academia"', '"remada-mochila" não serve em academia'));
teste('regra 6: trilha com um nível que não serve em casa numa rotina de casa é recusada', () => recusa((d) => { diaA(d).itens[0].trilha = 'bracos'; }, 'trilha "bracos" não serve em casa', 'nível 2 ("rosca-halteres")'));
teste('regra 6: trilha com um nível que não serve na academia numa rotina de academia é recusada', () => recusa((d) => { diaA(d, 'massa-3-academia').itens[0].trilha = 'bracos'; }, 'trilha "bracos" não serve em academia', 'nível 1 ("remada-mochila")'));
teste('regra 6: mesmo exercício repetido no mesmo dia é recusado', () => recusa((d) => {
  diaA(d).itens.push({ exercicio: 'remada-mochila', series: 2, alvo: '15' });
}, 'item 4', '"remada-mochila" repetido no mesmo dia'));
teste('regra 6: mesma trilha repetida no mesmo dia é recusada', () => recusa((d) => {
  diaA(d).itens.push({ trilha: 'flexoes' });
}, 'item 4', 'trilha "flexoes" repetida no mesmo dia'));
teste('regra 6: o mesmo exercício em dias diferentes é aceito (a repetição só vale no mesmo dia)', () => aceita((d) => {
  ro(d, 'massa-3-casa').dias[1].itens.push({ exercicio: 'flexao-no-chao', series: 2, alvo: '10' });
  ro(d, 'massa-3-casa').dias[2].itens.push({ exercicio: 'flexao-no-chao', series: 2, alvo: '10' });
}));
