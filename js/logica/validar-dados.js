// validar-dados.js: regras dos 3 JSON do catálogo (PROJETO.md, seção 4.1, "Regras de validação",
// mais a regra de local pelo equipamento da seção 9, com as exceções por id).
// Função pura: sem DOM, sem fetch. Recebe os 3 objetos já lidos e devolve
// { ok: true, erros: [] } ou { ok: false, erros: [...] } (mensagens em pt-BR, uma por problema).

export const REGEX_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const REGEX_ALVO = /^\d{1,3}(-\d{1,3})?$/;

// Vocabulário fixo de grupos musculares, nesta ordem de exibição (seção 4.1).
export const GRUPOS = [
  { id: 'peito', nome: 'Peito' },
  { id: 'costas', nome: 'Costas' },
  { id: 'ombros', nome: 'Ombros' },
  { id: 'biceps', nome: 'Bíceps' },
  { id: 'triceps', nome: 'Tríceps' },
  { id: 'antebraco', nome: 'Antebraço' },
  { id: 'core', nome: 'Core' },
  { id: 'lombar', nome: 'Lombar' },
  { id: 'quadriceps', nome: 'Quadríceps' },
  { id: 'posterior', nome: 'Posterior de coxa' },
  { id: 'gluteos', nome: 'Glúteos' },
  { id: 'adutores', nome: 'Adutores' },
  { id: 'panturrilha', nome: 'Panturrilha' },
];

// Os 3 objetivos (seção 4.1, rotinas.json).
export const OBJETIVOS = [
  { id: 'massa', nome: 'Ganhar massa' },
  { id: 'forca', nome: 'Força e habilidades' },
  { id: 'condicionamento', nome: 'Condicionamento geral' },
];

export const TIPOS = ['carga', 'corpo', 'tempo'];
export const LOCAIS = ['casa', 'academia'];
export const DIAS_POR_SEMANA = [3, 4];
export const IDS_DIA = ['a', 'b', 'c', 'd'];

// Faixas das tabelas da seção 4.1 (decisão menor 17).
export const FAIXAS = {
  nivel: [1, 5],
  metaSeries: [1, 5],
  metaReps: [1, 50],
  metaSegundos: [5, 300],
  rotinaDescanso: [30, 300],
  itemSeries: [1, 6],
  itemDescanso: [15, 300],
};

// Regra de local pelo equipamento (seções 4.1 e 9). Cada texto de equipamento é classificado
// por palavras-chave: qualquer palavra de academia → academia (mesmo misturado com objeto de casa);
// senão, objeto de casa → casa; senão, parede/chão → conta como sem equipamento.
// Equipamento que não casa com nenhuma lista é recusado: precisa ser classificado aqui.
export const EQUIPAMENTO_ACADEMIA = [
  'barra', 'paralelas', 'gráviton', 'halter', 'kettlebell', 'anilha', 'máquina', 'polia', 'smith', 'banco',
  // acessórios de academia que aparecem no catálogo
  'rack', 'alça', 'corda', 'pegada triângulo', 'caneleira', 'roda abdominal',
];
export const EQUIPAMENTO_CASA = [
  'cadeira', 'sofá', 'mesa', 'mochila', 'sacola', 'toalha', 'garrafa', 'almofada', 'colchonete', 'degrau', 'step',
  'apoio firme', 'batente', 'móvel',
];
export const EQUIPAMENTO_NEUTRO = ['parede', 'chão'];

// Exceções à regra de local decididas pelo usuário (seção 9). Só estes ids escapam da regra.
export const EXCECOES_LOCAL = {
  'flexao-parada-de-mao-parede': ['casa', 'academia'],
};

// Campos permitidos de cada objeto (campos fora das tabelas são proibidos).
const CAMPOS = {
  raizExercicios: ['versaoDados', 'grupos', 'exercicios'],
  raizProgressoes: ['versaoDados', 'trilhas'],
  raizRotinas: ['versaoDados', 'objetivos', 'rotinas'],
  grupo: ['id', 'nome'],
  objetivo: ['id', 'nome'],
  exercicio: ['id', 'nome', 'tipo', 'locais', 'nivel', 'equipamento', 'musculos', 'grupos', 'passos', 'erroComum', 'imagem', 'descontinuado'],
  trilha: ['id', 'nome', 'niveis'],
  nivel: ['exercicio', 'meta'],
  meta: ['series', 'reps', 'segundos'],
  rotina: ['id', 'objetivo', 'diasPorSemana', 'local', 'descanso', 'dias'],
  dia: ['id', 'nome', 'itens'],
  item: ['exercicio', 'trilha', 'series', 'alvo', 'descanso'],
};

// ---------- Auxiliares ----------

function ehObjeto(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function ehInteiro(v) {
  return Number.isInteger(v);
}

function ehTexto(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function tem(obj, campo) {
  return Object.prototype.hasOwnProperty.call(obj, campo);
}

function mostrar(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// Classifica um texto de equipamento: 'academia', 'casa', 'neutro' ou null (desconhecido).
export function classificarEquipamento(texto) {
  const t = String(texto).toLowerCase();
  if (EQUIPAMENTO_ACADEMIA.some((p) => t.includes(p))) return 'academia';
  if (EQUIPAMENTO_CASA.some((p) => t.includes(p))) return 'casa';
  if (EQUIPAMENTO_NEUTRO.some((p) => t.includes(p))) return 'neutro';
  return null;
}

// Locais esperados pela regra do equipamento (sem as exceções). null se houver equipamento desconhecido.
export function locaisPeloEquipamento(equipamento) {
  const classes = equipamento.map(classificarEquipamento);
  if (classes.includes(null)) return null;
  if (classes.includes('academia')) return ['academia'];
  if (classes.includes('casa')) return ['casa'];
  return ['casa', 'academia'];
}

function mesmosItens(a, b) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

// ---------- Validador ----------

// dados = { exercicios, progressoes, rotinas }: o conteúdo dos 3 arquivos de dados/.
export function validarDados(dados) {
  const erros = [];
  const erro = (msg) => erros.push(msg);

  const d = ehObjeto(dados) ? dados : {};
  const arqE = d.exercicios;
  const arqP = d.progressoes;
  const arqR = d.rotinas;

  // Campos: obrigatórios presentes e nenhum desconhecido.
  function conferirCampos(obj, permitidos, obrigatorios, onde) {
    for (const campo of Object.keys(obj)) {
      if (!permitidos.includes(campo)) erro(`${onde}: campo desconhecido "${campo}"`);
    }
    for (const campo of obrigatorios) {
      if (!tem(obj, campo)) erro(`${onde}: falta o campo obrigatório "${campo}"`);
    }
  }

  function conferirTexto(v, onde) {
    if (!ehTexto(v)) erro(`${onde}: precisa ser texto não vazio (veio ${mostrar(v)})`);
  }

  function conferirInteiro(v, [min, max], onde) {
    if (!ehInteiro(v) || v < min || v > max) erro(`${onde}: precisa ser inteiro de ${min} a ${max} (veio ${mostrar(v)})`);
  }

  // id em kebab-case e único no conjunto.
  function conferirId(id, vistos, onde) {
    if (typeof id !== 'string' || !REGEX_ID.test(id)) {
      erro(`${onde}: id ${mostrar(id)} não está em kebab-case sem acento`);
      return;
    }
    if (vistos.has(id)) erro(`${onde}: id "${id}" repetido`);
    vistos.add(id);
  }

  // Lista fixa de { id, nome } (grupos e objetivos): exatamente estes itens, nesta ordem.
  function conferirVocabulario(lista, esperado, onde) {
    if (!Array.isArray(lista)) {
      erro(`${onde}: precisa ser uma lista`);
      return;
    }
    if (lista.length !== esperado.length) {
      erro(`${onde}: precisa ter exatamente ${esperado.length} itens (veio ${lista.length})`);
    }
    lista.forEach((item, i) => {
      const ondeItem = `${onde}[${i}]`;
      if (!ehObjeto(item)) {
        erro(`${ondeItem}: precisa ser um objeto`);
        return;
      }
      conferirCampos(item, CAMPOS.grupo, CAMPOS.grupo, ondeItem);
      const ref = esperado[i];
      if (!ref) return;
      if (item.id !== ref.id) erro(`${ondeItem}: id ${mostrar(item.id)} fora do vocabulário (esperado "${ref.id}" nesta posição)`);
      else if (item.nome !== ref.nome) erro(`${ondeItem}: nome de "${ref.id}" precisa ser "${ref.nome}" (veio ${mostrar(item.nome)})`);
    });
  }

  function conferirRaiz(arq, nome, campos) {
    if (!ehObjeto(arq)) {
      erro(`${nome}: precisa ser um objeto JSON`);
      return false;
    }
    conferirCampos(arq, campos, campos, nome);
    if (!ehInteiro(arq.versaoDados) || arq.versaoDados < 1) {
      erro(`${nome}: versaoDados precisa ser inteiro ≥ 1 (veio ${mostrar(arq.versaoDados)})`);
    }
    return true;
  }

  const okE = conferirRaiz(arqE, 'exercicios.json', CAMPOS.raizExercicios);
  const okP = conferirRaiz(arqP, 'progressoes.json', CAMPOS.raizProgressoes);
  const okR = conferirRaiz(arqR, 'rotinas.json', CAMPOS.raizRotinas);

  // Regra 1: versaoDados igual nos 3 arquivos.
  if (okE && okP && okR) {
    const versoes = [arqE.versaoDados, arqP.versaoDados, arqR.versaoDados];
    if (!versoes.every((v) => v === versoes[0])) {
      erro(`versaoDados diferente nos 3 arquivos (exercicios ${mostrar(versoes[0])}, progressoes ${mostrar(versoes[1])}, rotinas ${mostrar(versoes[2])})`);
    }
  }

  // ---------- exercicios.json ----------
  const exercicios = new Map(); // id → exercício (só os com id válido)
  if (okE) {
    conferirVocabulario(arqE.grupos, GRUPOS, 'exercicios.json: grupos');
    const idsGrupo = GRUPOS.map((g) => g.id);

    if (!Array.isArray(arqE.exercicios)) {
      erro('exercicios.json: "exercicios" precisa ser uma lista');
    } else {
      const vistos = new Set();
      arqE.exercicios.forEach((ex, i) => {
        if (!ehObjeto(ex)) {
          erro(`exercicios.json: exercício [${i}] precisa ser um objeto`);
          return;
        }
        const onde = `exercicios.json: exercício "${typeof ex.id === 'string' ? ex.id : `[${i}]`}"`;
        conferirCampos(ex, CAMPOS.exercicio, CAMPOS.exercicio.filter((c) => c !== 'descontinuado'), onde);
        conferirId(ex.id, vistos, onde);
        if (typeof ex.id === 'string' && !exercicios.has(ex.id)) exercicios.set(ex.id, ex);

        conferirTexto(ex.nome, `${onde}, nome`);

        if (!TIPOS.includes(ex.tipo)) erro(`${onde}: tipo ${mostrar(ex.tipo)} inválido (use carga, corpo ou tempo)`);

        // locais: 1 ou 2 itens entre casa/academia, sem repetir.
        let locaisOk = false;
        if (!Array.isArray(ex.locais) || ex.locais.length < 1 || ex.locais.length > 2) {
          erro(`${onde}: locais precisa ser lista com 1 ou 2 itens (veio ${mostrar(ex.locais)})`);
        } else if (!ex.locais.every((l) => LOCAIS.includes(l))) {
          erro(`${onde}: locais só aceita "casa" e "academia" (veio ${mostrar(ex.locais)})`);
        } else if (new Set(ex.locais).size !== ex.locais.length) {
          erro(`${onde}: locais repetido (veio ${mostrar(ex.locais)})`);
        } else {
          locaisOk = true;
        }

        conferirInteiro(ex.nivel, FAIXAS.nivel, `${onde}, nivel`);

        // equipamento: lista de textos (pode ser vazia: "nenhum" → []).
        let equipOk = false;
        if (!Array.isArray(ex.equipamento)) {
          erro(`${onde}: equipamento precisa ser uma lista`);
        } else {
          equipOk = true;
          ex.equipamento.forEach((q, j) => {
            if (!ehTexto(q)) {
              erro(`${onde}, equipamento[${j}]: precisa ser texto não vazio (veio ${mostrar(q)})`);
              equipOk = false;
            } else if (classificarEquipamento(q) === null) {
              erro(`${onde}: equipamento "${q}" sem classificação de local (casa, academia ou sem equipamento)`);
              equipOk = false;
            }
          });
        }

        // Regra de local pelo equipamento (seção 9), com as exceções por id.
        if (locaisOk && equipOk) {
          const esperado = tem(EXCECOES_LOCAL, ex.id) ? EXCECOES_LOCAL[ex.id] : locaisPeloEquipamento(ex.equipamento);
          if (!mesmosItens(ex.locais, esperado)) {
            erro(`${onde}: locais ${mostrar(ex.locais)} não seguem a regra do equipamento ${mostrar(ex.equipamento)} (esperado ${mostrar(esperado)})`);
          }
        }

        // musculos: lista de textos, principal primeiro.
        if (!Array.isArray(ex.musculos) || ex.musculos.length < 1) {
          erro(`${onde}: musculos precisa ser lista com pelo menos 1 item`);
        } else {
          ex.musculos.forEach((m, j) => conferirTexto(m, `${onde}, musculos[${j}]`));
        }

        // grupos: ≥ 1, sem repetir, todos no vocabulário (regra 4).
        if (!Array.isArray(ex.grupos) || ex.grupos.length < 1) {
          erro(`${onde}: grupos precisa ser lista com pelo menos 1 item`);
        } else {
          if (new Set(ex.grupos).size !== ex.grupos.length) erro(`${onde}: grupos repetido (veio ${mostrar(ex.grupos)})`);
          for (const g of ex.grupos) {
            if (!idsGrupo.includes(g)) erro(`${onde}: grupo ${mostrar(g)} não existe no vocabulário`);
          }
        }

        // passos: exatamente 3 textos.
        if (!Array.isArray(ex.passos) || ex.passos.length !== 3) {
          erro(`${onde}: passos precisa ter exatamente 3 itens (veio ${Array.isArray(ex.passos) ? ex.passos.length : mostrar(ex.passos)})`);
        } else {
          ex.passos.forEach((p, j) => conferirTexto(p, `${onde}, passos[${j}]`));
        }

        // erroComum: texto com a primeira letra maiúscula.
        if (!ehTexto(ex.erroComum)) {
          conferirTexto(ex.erroComum, `${onde}, erroComum`);
        } else {
          const primeira = ex.erroComum.trim()[0];
          if (primeira !== primeira.toLocaleUpperCase('pt-BR') || primeira === primeira.toLocaleLowerCase('pt-BR')) {
            erro(`${onde}: erroComum precisa começar com letra maiúscula`);
          }
        }

        // imagem: null (v1) ou caminho relativo img/exercicios/<id>.<ext> (seção 3).
        if (tem(ex, 'imagem') && ex.imagem !== null) {
          const ext = /^img\/exercicios\/(.+)\.[a-z0-9]+$/.exec(typeof ex.imagem === 'string' ? ex.imagem : '');
          if (!ext || ext[1] !== ex.id) {
            erro(`${onde}: imagem precisa ser null ou "img/exercicios/${ex.id}.<ext>" (veio ${mostrar(ex.imagem)})`);
          }
        }

        if (tem(ex, 'descontinuado') && typeof ex.descontinuado !== 'boolean') {
          erro(`${onde}: descontinuado precisa ser true ou false (veio ${mostrar(ex.descontinuado)})`);
        }
      });
    }
  }

  const descontinuado = (id) => exercicios.get(id)?.descontinuado === true;

  // Referência a um exercício: existe e não é descontinuado.
  function conferirRefExercicio(id, onde) {
    if (!exercicios.has(id)) {
      erro(`${onde}: exercício ${mostrar(id)} não existe`);
      return false;
    }
    if (descontinuado(id)) {
      erro(`${onde}: exercício "${id}" está descontinuado`);
      return false;
    }
    return true;
  }

  // ---------- progressoes.json ----------
  const trilhas = new Map(); // id → trilha
  if (okP) {
    if (!Array.isArray(arqP.trilhas)) {
      erro('progressoes.json: "trilhas" precisa ser uma lista');
    } else {
      const vistos = new Set();
      const trilhaDoExercicio = new Map(); // regra 5: no máximo uma trilha por exercício, uma vez
      arqP.trilhas.forEach((tr, i) => {
        if (!ehObjeto(tr)) {
          erro(`progressoes.json: trilha [${i}] precisa ser um objeto`);
          return;
        }
        const onde = `progressoes.json: trilha "${typeof tr.id === 'string' ? tr.id : `[${i}]`}"`;
        conferirCampos(tr, CAMPOS.trilha, CAMPOS.trilha, onde);
        conferirId(tr.id, vistos, onde);
        if (typeof tr.id === 'string' && !trilhas.has(tr.id)) trilhas.set(tr.id, tr);
        conferirTexto(tr.nome, `${onde}, nome`);

        if (!Array.isArray(tr.niveis) || tr.niveis.length < 2) {
          erro(`${onde}: niveis precisa ser lista com pelo menos 2 níveis`);
          return;
        }
        tr.niveis.forEach((nv, j) => {
          const ondeNv = `${onde}, nível ${j + 1}`;
          if (!ehObjeto(nv)) {
            erro(`${ondeNv}: precisa ser um objeto`);
            return;
          }
          conferirCampos(nv, CAMPOS.nivel, CAMPOS.nivel, ondeNv);
          const refOk = conferirRefExercicio(nv.exercicio, ondeNv);

          if (typeof nv.exercicio === 'string') {
            const anterior = trilhaDoExercicio.get(nv.exercicio);
            if (anterior) {
              erro(`${ondeNv}: exercício "${nv.exercicio}" já aparece em ${anterior} (cada exercício fica em no máximo uma trilha, uma vez)`);
            } else {
              trilhaDoExercicio.set(nv.exercicio, `trilha "${tr.id}", nível ${j + 1}`);
            }
          }

          if (!ehObjeto(nv.meta)) {
            erro(`${ondeNv}: meta precisa ser um objeto`);
            return;
          }
          const ondeMeta = `${ondeNv}, meta`;
          conferirCampos(nv.meta, CAMPOS.meta, ['series'], ondeMeta);
          conferirInteiro(nv.meta.series, FAIXAS.metaSeries, `${ondeMeta}.series`);
          const temReps = tem(nv.meta, 'reps');
          const temSeg = tem(nv.meta, 'segundos');
          if (temReps === temSeg) {
            erro(`${ondeMeta}: precisa ter exatamente um entre reps e segundos`);
            return;
          }
          if (temReps) conferirInteiro(nv.meta.reps, FAIXAS.metaReps, `${ondeMeta}.reps`);
          if (temSeg) conferirInteiro(nv.meta.segundos, FAIXAS.metaSegundos, `${ondeMeta}.segundos`);
          if (refOk) {
            const tipo = exercicios.get(nv.exercicio).tipo;
            if (tipo === 'tempo' && !temSeg) erro(`${ondeMeta}: exercício "${nv.exercicio}" é de tempo, a meta precisa usar segundos`);
            if ((tipo === 'carga' || tipo === 'corpo') && !temReps) erro(`${ondeMeta}: exercício "${nv.exercicio}" é de ${tipo}, a meta precisa usar reps`);
          }
        });
      });
    }
  }

  // ---------- rotinas.json ----------
  if (okR) {
    conferirVocabulario(arqR.objetivos, OBJETIVOS, 'rotinas.json: objetivos');
    const idsObjetivo = OBJETIVOS.map((o) => o.id);

    if (!Array.isArray(arqR.rotinas)) {
      erro('rotinas.json: "rotinas" precisa ser uma lista');
    } else {
      // Regra 6: exatamente 12, uma por combinação objetivo × dias × local.
      const esperadas = [];
      for (const o of idsObjetivo) for (const n of DIAS_POR_SEMANA) for (const l of LOCAIS) esperadas.push(`${o}-${n}-${l}`);
      if (arqR.rotinas.length !== esperadas.length) {
        erro(`rotinas.json: precisa ter exatamente ${esperadas.length} rotinas (veio ${arqR.rotinas.length})`);
      }

      const vistos = new Set();
      arqR.rotinas.forEach((ro, i) => {
        if (!ehObjeto(ro)) {
          erro(`rotinas.json: rotina [${i}] precisa ser um objeto`);
          return;
        }
        const onde = `rotinas.json: rotina "${typeof ro.id === 'string' ? ro.id : `[${i}]`}"`;
        conferirCampos(ro, CAMPOS.rotina, CAMPOS.rotina, onde);
        conferirId(ro.id, vistos, onde);

        if (!idsObjetivo.includes(ro.objetivo)) erro(`${onde}: objetivo ${mostrar(ro.objetivo)} não existe`);
        if (!DIAS_POR_SEMANA.includes(ro.diasPorSemana)) erro(`${onde}: diasPorSemana precisa ser 3 ou 4 (veio ${mostrar(ro.diasPorSemana)})`);
        const localOk = LOCAIS.includes(ro.local);
        if (!localOk) erro(`${onde}: local precisa ser "casa" ou "academia" (veio ${mostrar(ro.local)})`);
        const combinacao = `${ro.objetivo}-${ro.diasPorSemana}-${ro.local}`;
        if (ro.id !== combinacao) erro(`${onde}: id precisa ser a combinação "${combinacao}"`);
        conferirInteiro(ro.descanso, FAIXAS.rotinaDescanso, `${onde}, descanso`);

        if (!Array.isArray(ro.dias)) {
          erro(`${onde}: dias precisa ser uma lista`);
          return;
        }
        if (ro.dias.length !== ro.diasPorSemana) {
          erro(`${onde}: tem ${ro.dias.length} dias, mas diasPorSemana é ${mostrar(ro.diasPorSemana)}`);
        }

        const idsDia = new Set();
        ro.dias.forEach((dia, j) => {
          if (!ehObjeto(dia)) {
            erro(`${onde}, dia [${j}]: precisa ser um objeto`);
            return;
          }
          const ondeDia = `${onde}, dia "${typeof dia.id === 'string' ? dia.id : `[${j}]`}"`;
          conferirCampos(dia, CAMPOS.dia, CAMPOS.dia, ondeDia);
          if (idsDia.has(dia.id)) erro(`${ondeDia}: id de dia repetido`);
          idsDia.add(dia.id);
          if (dia.id !== IDS_DIA[j]) erro(`${ondeDia}: dias em ordem e sem pular; esperado "${IDS_DIA[j] ?? '(nenhum)'}" na posição ${j + 1}`);
          conferirTexto(dia.nome, `${ondeDia}, nome`);

          if (!Array.isArray(dia.itens) || dia.itens.length < 1) {
            erro(`${ondeDia}: itens precisa ser lista com pelo menos 1 item`);
            return;
          }
          const usados = new Set(); // exercício ou trilha não se repete no mesmo dia
          dia.itens.forEach((it, k) => {
            const ondeIt = `${ondeDia}, item ${k + 1}`;
            if (!ehObjeto(it)) {
              erro(`${ondeIt}: precisa ser um objeto`);
              return;
            }
            conferirCampos(it, CAMPOS.item, [], ondeIt);
            const temEx = tem(it, 'exercicio');
            const temTr = tem(it, 'trilha');
            if (temEx === temTr) {
              erro(`${ondeIt}: precisa ter exatamente um entre exercicio e trilha`);
              return;
            }
            if (tem(it, 'descanso')) conferirInteiro(it.descanso, FAIXAS.itemDescanso, `${ondeIt}, descanso`);

            if (temEx) {
              if (!tem(it, 'series')) erro(`${ondeIt}: item com exercicio precisa de series`);
              else conferirInteiro(it.series, FAIXAS.itemSeries, `${ondeIt}, series`);
              if (!tem(it, 'alvo')) {
                erro(`${ondeIt}: item com exercicio precisa de alvo`);
              } else if (typeof it.alvo !== 'string' || !REGEX_ALVO.test(it.alvo)) {
                erro(`${ondeIt}: alvo ${mostrar(it.alvo)} fora do formato "10" ou "8-12"`);
              } else {
                const [min, max = min] = it.alvo.split('-').map(Number);
                if (min < 1) erro(`${ondeIt}: alvo "${it.alvo}" precisa ser pelo menos 1`);
                if (min > max) erro(`${ondeIt}: alvo "${it.alvo}" tem mínimo maior que o máximo`);
              }
              if (usados.has(`e:${it.exercicio}`)) erro(`${ondeIt}: exercício "${it.exercicio}" repetido no mesmo dia`);
              usados.add(`e:${it.exercicio}`);
              if (conferirRefExercicio(it.exercicio, ondeIt) && localOk) {
                const ex = exercicios.get(it.exercicio);
                if (Array.isArray(ex.locais) && !ex.locais.includes(ro.local)) {
                  erro(`${ondeIt}: exercício "${it.exercicio}" não serve em ${ro.local} (locais ${mostrar(ex.locais)})`);
                }
              }
            } else {
              if (tem(it, 'series')) conferirInteiro(it.series, FAIXAS.itemSeries, `${ondeIt}, series`);
              if (tem(it, 'alvo')) erro(`${ondeIt}: item com trilha não pode ter alvo (o alvo é a meta do nível)`);
              if (usados.has(`t:${it.trilha}`)) erro(`${ondeIt}: trilha "${it.trilha}" repetida no mesmo dia`);
              usados.add(`t:${it.trilha}`);
              const tr = trilhas.get(it.trilha);
              if (!tr) {
                erro(`${ondeIt}: trilha ${mostrar(it.trilha)} não existe`);
              } else if (localOk && Array.isArray(tr.niveis)) {
                tr.niveis.forEach((nv, n) => {
                  const ex = ehObjeto(nv) ? exercicios.get(nv.exercicio) : undefined;
                  if (ex && Array.isArray(ex.locais) && !ex.locais.includes(ro.local)) {
                    erro(`${ondeIt}: trilha "${it.trilha}" não serve em ${ro.local}: o nível ${n + 1} ("${nv.exercicio}") tem locais ${mostrar(ex.locais)}`);
                  }
                });
              }
            }
          });
        });
      });

      for (const id of esperadas) {
        if (!vistos.has(id)) erro(`rotinas.json: falta a rotina "${id}"`);
      }
    }
  }

  return { ok: erros.length === 0, erros };
}
