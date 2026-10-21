// sessao-detalhe.js: detalhe/resumo de um treino (#/evolucao/treino/:id). PROJETO.md, seção 5.
// Etapa 16: modo leitura, que é também o resumo ao finalizar o treino.
// - Nome, data, horário de início e fim, duração e local.
// - Cada exercício do treino (na ordem dos itens; exercício com séries fora dos itens vem depois, pela
//   primeira série) com séries feitas / pedidas, as séries em bolinhas e o +1 de cada uma em relação ao
//   último treino concluído que começou ANTES deste (db/series.js, seriesAntesDaSessao).
// - Total de séries e "Voltar para o Hoje". Treino ainda em andamento: aviso com "Continuar treino".
// Editar/apagar séries e apagar a sessão entram na etapa 19; "Novo nível" na 18.
// render aceita um 3º parâmetro opcional { db, catalogo } (só os testes, como as telas Hoje e Treino).
import { h } from '../ui/dom.js';
import { obterCatalogo } from '../catalogo.js';
import { obterSessao } from '../db/sessoes.js';
import { listarSeriesDaSessao, seriesAntesDaSessao } from '../db/series.js';
import { textoDuracao } from '../logica/datas.js';
import { textoAlvo, textoTrilhaDoItem, NOME_LOCAL } from '../logica/rotina.js';
import { formatarSerie } from '../logica/tipos.js';
import { compararSeries, textoAntes } from '../logica/comparacao.js';
import { textoBolinha } from '../logica/fluxo-treino.js';

const formatoData = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const formatoHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export async function render(container, params, { db, catalogo: catalogoDeTeste } = {}) {
  const tela = h('div', { class: 'resumo' });
  container.append(tela);
  const catalogo = catalogoDeTeste || obterCatalogo();

  let sessao;
  let series = [];
  try {
    [sessao, series] = await Promise.all([obterSessao(params.id, db), listarSeriesDaSessao(params.id, db)]);
  } catch (erro) {
    console.error('Detalhe da sessão: banco indisponível:', erro);
    tela.append(aviso('Banco indisponível: não dá para abrir o treino agora.'));
    return;
  }
  if (!sessao) {
    tela.append(aviso('Treino não encontrado.'));
    return;
  }

  const grupos = agruparPorExercicio(sessao.itens, series);
  // "Antes" de cada exercício (se uma leitura falhar, aquele exercício fica sem +1).
  const antes = await Promise.all(grupos.map(async (g) => {
    try {
      return await seriesAntesDaSessao(g.exercicioId, sessao, db);
    } catch (erro) {
      console.error('Detalhe da sessão: não foi possível ler a última vez:', erro);
      return [];
    }
  }));

  const andamento = sessao.status !== 'concluida';
  const horario = andamento
    ? `Começou às ${formatoHora.format(sessao.inicio)}`
    : `${formatoHora.format(sessao.inicio)} – ${formatoHora.format(sessao.fim)}`;

  tela.append(...[
    h('header', { class: 'resumo-cabecalho' },
      h('p', { class: 'hoje-rotulo' }, andamento ? 'Treino em andamento' : 'Treino concluído'),
      h('h2', { class: 'resumo-nome' }, sessao.nome),
      h('p', { class: 'resumo-data' }, primeiraMaiuscula(formatoData.format(sessao.inicio)))),
    h('dl', { class: 'cartao resumo-numeros' },
      numero('Duração', andamento ? '—' : textoDuracao(sessao.fim - sessao.inicio), 'resumo-duracao'),
      numero('Horário', horario, 'resumo-horario'),
      numero('Exercícios', String(grupos.filter((g) => g.series.length).length), 'resumo-exercicios'),
      numero('Séries', String(series.length), 'resumo-series'),
      numero('Local', NOME_LOCAL[sessao.local] || sessao.local, 'resumo-local')),
    andamento
      ? h('section', { class: 'cartao' },
        h('p', { class: 'hoje-aviso' }, 'Este treino ainda não foi finalizado.'),
        h('a', { class: 'botao botao-destaque botao-grande', href: `#/treino/${encodeURIComponent(sessao.id)}` }, 'Continuar treino'))
      : null,
    h('ol', { class: 'resumo-lista', 'aria-label': 'Exercícios do treino' },
      grupos.map((g, i) => cartaoExercicio(catalogo, g, antes[i]))),
    h('a', { class: 'botao botao-grande resumo-voltar', href: '#/' }, 'Voltar para o Hoje'),
  ].filter(Boolean)); // o append nativo escreveria "null"

}

// Um grupo por exercício: primeiro os itens da sessão (na ordem), depois exercícios com séries que não
// estão nos itens (pela ordem da primeira série). Devolve [{ exercicioId, item | null, series }].
function agruparPorExercicio(itens, series) {
  const grupos = itens.map((item) => ({
    exercicioId: item.exercicioId,
    item,
    series: series.filter((s) => s.exercicioId === item.exercicioId),
  }));
  const vistos = new Set(itens.map((item) => item.exercicioId));
  for (const serie of series) {
    if (vistos.has(serie.exercicioId)) continue;
    vistos.add(serie.exercicioId);
    grupos.push({ exercicioId: serie.exercicioId, item: null, series: series.filter((s) => s.exercicioId === serie.exercicioId) });
  }
  return grupos;
}

function cartaoExercicio(catalogo, grupo, antes) {
  const exercicio = catalogo.exercicioPorId.get(grupo.exercicioId);
  const nome = exercicio ? exercicio.nome : grupo.exercicioId;
  const trilha = grupo.item ? textoTrilhaDoItem(grupo.item, catalogo) : null;
  const previstas = grupo.item ? grupo.item.series : grupo.series.length;
  const comparacoes = compararSeries(antes, grupo.series);
  return h('li', { class: 'cartao resumo-exercicio', 'data-exercicio': grupo.exercicioId },
    h('div', { class: 'resumo-exercicio-topo' },
      h('div', { class: 'treino-exercicio-texto' },
        h('h3', { class: 'resumo-exercicio-nome' }, nome),
        grupo.item && exercicio ? h('p', { class: 'treino-exercicio-alvo' }, textoAlvo(grupo.item, exercicio.tipo)) : null,
        trilha ? h('p', { class: 'treino-exercicio-trilha' }, trilha) : null),
      h('p', { class: `resumo-exercicio-feitas${grupo.series.length >= previstas ? ' completo' : ''}` },
        `${grupo.series.length} de ${previstas}`)),
    antes.length
      ? h('p', { class: 'treino-antes' }, h('span', { class: 'treino-antes-rotulo' }, 'Antes'), ` ${textoAntes(antes)}`)
      : null,
    grupo.series.length
      ? h('ol', { class: 'treino-bolinhas', 'aria-label': 'Séries' },
        grupo.series.map((serie, i) => {
          const c = comparacoes[i];
          return h('li', { class: 'treino-bolinha-item' },
            h('span', {
              class: 'treino-bolinha resumo-bolinha',
              'aria-label': `Série ${i + 1}: ${formatarSerie(serie)}${c ? ` (${c.texto} em relação a antes)` : ''}`,
            }, textoSerieResumo(serie)),
            c ? h('span', { class: `treino-mais treino-mais-${c.resultado}`, 'aria-hidden': 'true' }, c.texto) : null);
        }))
      : h('p', { class: 'treino-series-vazio' }, 'Nenhuma série registrada.'));
}

// Texto da bolinha no resumo: carga com a unidade ("2 kg × 10", "1,5 kg × 12"); corpo ("20") e
// tempo ("1:00") iguais à bolinha da tela Treino.
function textoSerieResumo(serie) {
  return serie.tipo === 'carga' ? formatarSerie(serie) : textoBolinha(serie);
}

function numero(rotulo, valor, classe) {
  return h('div', { class: `resumo-numero ${classe}` },
    h('dt', { class: 'hoje-rotulo' }, rotulo),
    h('dd', { class: 'resumo-valor' }, valor));
}

function primeiraMaiuscula(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function aviso(texto) {
  return h('section', { class: 'cartao' },
    h('p', { class: 'hoje-aviso' }, texto),
    h('a', { class: 'link-destaque', href: '#/' }, 'Voltar para o Hoje'));
}
