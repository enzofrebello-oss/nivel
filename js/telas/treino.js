// treino.js: treino em andamento (#/treino/:id). Etapa 13 (PROJETO.md, seção 5 e seção 8 "Telas aprovadas"):
// registrar séries.
// - Calendário da semana e barra de progresso dos exercícios (feito = séries registradas ≥ previstas);
//   tocar num trecho da barra, ou em Anterior/Próximo, troca o exercício.
// - Card do exercício: nome, alvo ("4 × 8-12"), trilha, botão "Como fazer" (componente da Biblioteca num modal),
//   séries já registradas (tocar edita ou apaga), contador grande com − e + e o botão grande "Registrar série".
// - Contadores por tipo (ui/componentes.js, contador): carga = carga + reps; corpo = reps; tempo = segundos.
//   Passos: reps 1, tempo 5 s, carga 1 kg; nada abaixo do mínimo válido. Tocar no número abre o teclado.
// - Cada série é gravada no banco na hora (db/series.js); a tela relê o banco a cada mudança.
// Valor inicial do contador: o último usado neste exercício nesta tela; senão a última série dele nesta
// sessão; senão o mínimo do alvo (carga: 10 kg). A tabela antes / hoje / +1 e o pré-preenchimento pela
// última vez entram na etapa 14; o Descanso, na 15; Finalizar/Descartar e "+ Exercício", na 16.
import { h, limpar } from '../ui/dom.js';
import { abrirModal, comoFazer, contador } from '../ui/componentes.js';
import { calendarioSemana } from '../ui/semana.js';
import { obterCatalogo } from '../catalogo.js';
import { obterSessao, listarSessoes } from '../db/sessoes.js';
import { adicionarSerie, editarSerie, apagarSerie, listarSeriesDaSessao } from '../db/series.js';
import { diasTreinadosNaSemana } from '../logica/datas.js';
import { textoAlvo } from '../logica/rotina.js';
import { CAMPOS, LIMITES, formatarSerie } from '../logica/tipos.js';

const CARGA_INICIAL = 10; // kg, quando ainda não há série do exercício nesta sessão
const formatoHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export async function render(container, params) {
  const tela = h('div', { class: 'treino' });
  container.append(tela);

  let indice = null; // exercício aberto (posição em sessao.itens)
  let mensagem = ''; // "Série 2 registrada: 15 reps"
  let fecharModal = null;
  let rodada = 0;
  const rascunhos = new Map(); // exercicioId → { carga?, reps?, segundos? } (valores dos contadores)

  const fechar = () => {
    if (fecharModal) fecharModal();
    fecharModal = null;
  };

  async function desenhar() {
    const minha = ++rodada;
    const catalogo = obterCatalogo();
    let sessao;
    let series = [];
    let sessoes = [];
    try {
      [sessao, series, sessoes] = await Promise.all([
        obterSessao(params.id),
        listarSeriesDaSessao(params.id),
        listarSessoes(),
      ]);
    } catch (erro) {
      console.error('Treino: banco indisponível:', erro);
      if (minha !== rodada) return;
      limpar(tela);
      tela.append(aviso('Banco indisponível: não dá para abrir o treino agora.'));
      return;
    }
    if (minha !== rodada) return;
    limpar(tela);

    if (!sessao) {
      tela.append(aviso('Treino não encontrado.'));
      return;
    }
    if (sessao.status !== 'andamento') {
      tela.append(aviso('Este treino já foi finalizado.'));
      return;
    }

    const porExercicio = new Map();
    for (const serie of series) {
      if (!porExercicio.has(serie.exercicioId)) porExercicio.set(serie.exercicioId, []);
      porExercicio.get(serie.exercicioId).push(serie);
    }
    const feitas = (item) => (porExercicio.get(item.exercicioId) || []).length;
    const itens = sessao.itens;

    if (indice === null || indice >= itens.length) {
      // Ao abrir (ou reabrir o app): o primeiro exercício que ainda não foi feito; tudo feito = o último.
      indice = itens.findIndex((item) => feitas(item) < item.series);
      if (indice === -1) indice = itens.length - 1;
    }
    const item = itens[indice];
    const exercicio = catalogo.exercicioPorId.get(item.exercicioId);

    const irPara = (i) => {
      indice = i;
      mensagem = '';
      desenhar();
    };

    tela.append(
      calendarioSemana(diasTreinadosNaSemana(sessoes)),
      h('header', { class: 'treino-cabecalho' },
        h('h2', { class: 'treino-nome' }, sessao.nome),
        h('p', { class: 'treino-inicio' }, `Começou às ${formatoHora.format(sessao.inicio)}`)),
      barraDeProgresso(catalogo, itens, indice, feitas, irPara),
      exercicio
        ? cartaoExercicio({ item, exercicio, seriesFeitas: porExercicio.get(item.exercicioId) || [] })
        : aviso(`Exercício "${item.exercicioId}" não está no catálogo.`),
      h('nav', { class: 'treino-navegacao', 'aria-label': 'Trocar de exercício' },
        h('button', { type: 'button', class: 'botao', disabled: indice === 0, onclick: () => irPara(indice - 1) }, '‹ Anterior'),
        h('button', { type: 'button', class: 'botao', disabled: indice === itens.length - 1, onclick: () => irPara(indice + 1) }, 'Próximo ›')),
    );

    function cartaoExercicio({ item: it, exercicio: ex, seriesFeitas }) {
      const trilha = it.trilhaId ? catalogo.trilhaPorId.get(it.trilhaId) : null;
      const valores = valoresIniciais(ex, it, seriesFeitas, rascunhos.get(ex.id));
      const contadores = CAMPOS[ex.tipo].map((campo) => contador({
        campo,
        tipo: ex.tipo,
        valor: valores[campo],
        grande: campo !== 'carga',
        aoMudar: (v) => {
          rascunhos.set(ex.id, { ...(rascunhos.get(ex.id) || valores), [campo]: v });
        },
      }));

      const status = h('p', { class: 'treino-status', role: 'status' }, mensagem);
      const registrar = h('button', {
        type: 'button',
        class: 'botao botao-destaque botao-grande',
        onclick: async () => {
          if (!contadores.every((c) => c.confirmar())) return;
          const medidas = {};
          CAMPOS[ex.tipo].forEach((campo, i) => { medidas[campo] = contadores[i].valor(); });
          rascunhos.set(ex.id, { ...medidas });
          registrar.disabled = true;
          try {
            const serie = await adicionarSerie({ sessaoId: sessao.id, exercicio: ex, medidas });
            mensagem = `Série ${seriesFeitas.length + 1} registrada: ${formatarSerie(serie)}`;
          } catch (erro) {
            console.error('Treino: não foi possível registrar a série:', erro);
            mensagem = `Não foi possível salvar a série: ${erro.message}`;
          }
          await desenhar();
        },
      }, `Registrar série ${seriesFeitas.length + 1}`);

      return h('section', { class: 'cartao treino-exercicio', 'aria-labelledby': 'treino-exercicio-nome' },
        h('div', { class: 'treino-exercicio-topo' },
          h('div', { class: 'treino-exercicio-texto' },
            h('h3', { class: 'treino-exercicio-nome', id: 'treino-exercicio-nome' }, ex.nome),
            h('p', { class: 'treino-exercicio-alvo' }, textoAlvo(it, ex.tipo)),
            trilha ? h('p', { class: 'treino-exercicio-trilha' }, `Trilha ${trilha.nome}`) : null),
          h('button', {
            type: 'button',
            class: 'botao',
            onclick: () => {
              fechar();
              fecharModal = abrirModal({ titulo: ex.nome, conteudo: comoFazer(ex) });
            },
          }, 'Como fazer')),
        listaDeSeries(seriesFeitas, it.series, (serie, n) => editar(ex, serie, n)),
        h('div', { class: 'treino-contadores' }, contadores.map((c) => c.elemento)),
        registrar,
        status);
    }
  }

  // Modal da série feita: mudar os valores (mesmos contadores) ou apagar (com confirmação).
  function editar(exercicio, serie, n) {
    fechar();
    const corpo = h('div', { class: 'editar-serie' });
    const contadores = CAMPOS[serie.tipo].map((campo) => contador({
      campo, tipo: serie.tipo, valor: serie[campo], grande: campo !== 'carga',
    }));
    const erro = h('p', { class: 'contador-erro', 'aria-live': 'polite' });

    const formulario = () => {
      limpar(corpo);
      corpo.append(
        h('p', { class: 'editar-serie-atual' }, `Agora: ${formatarSerie(serie)}`),
        h('div', { class: 'treino-contadores' }, contadores.map((c) => c.elemento)),
        erro,
        h('div', { class: 'editar-serie-botoes' },
          h('button', {
            type: 'button',
            class: 'botao botao-destaque',
            onclick: async (ev) => {
              if (!contadores.every((c) => c.confirmar())) return;
              const medidas = {};
              CAMPOS[serie.tipo].forEach((campo, i) => { medidas[campo] = contadores[i].valor(); });
              ev.currentTarget.disabled = true;
              try {
                const nova = await editarSerie(serie.id, medidas);
                mensagem = `Série ${n} alterada: ${formatarSerie(nova)}`;
                fechar();
                await desenhar();
              } catch (e) {
                console.error('Treino: não foi possível editar a série:', e);
                erro.textContent = `Não foi possível salvar: ${e.message}`;
                ev.currentTarget.disabled = false;
              }
            },
          }, 'Salvar'),
          h('button', { type: 'button', class: 'botao botao-perigo', onclick: confirmarApagar }, 'Apagar série')),
      );
    };

    function confirmarApagar() {
      limpar(corpo);
      corpo.append(
        h('p', null, `Apagar a série ${n} (${formatarSerie(serie)})? Não dá para desfazer.`),
        erro,
        h('div', { class: 'editar-serie-botoes' },
          h('button', {
            type: 'button',
            class: 'botao botao-perigo',
            onclick: async (ev) => {
              ev.currentTarget.disabled = true;
              try {
                await apagarSerie(serie.id);
                mensagem = `Série ${n} apagada.`;
                rascunhos.delete(exercicio.id);
                fechar();
                await desenhar();
              } catch (e) {
                console.error('Treino: não foi possível apagar a série:', e);
                erro.textContent = `Não foi possível apagar: ${e.message}`;
                ev.currentTarget.disabled = false;
              }
            },
          }, 'Apagar'),
          h('button', { type: 'button', class: 'botao', onclick: formulario }, 'Cancelar')),
      );
    }

    formulario();
    fecharModal = abrirModal({ titulo: `${exercicio.nome} · série ${n}`, conteudo: corpo });
  }

  await desenhar();
  return fechar;
}

function aviso(texto) {
  return h('section', { class: 'cartao' },
    h('p', { class: 'hoje-aviso' }, texto),
    h('a', { class: 'link-destaque', href: '#/' }, 'Voltar para o Hoje'));
}

// Barra de progresso: um trecho por exercício (feito em laranja, atual com contorno). Tocar troca o exercício.
function barraDeProgresso(catalogo, itens, atual, feitas, irPara) {
  const quantosFeitos = itens.filter((item) => feitas(item) >= item.series).length;
  return h('section', { class: 'treino-progresso', 'aria-label': 'Progresso do treino' },
    h('p', { class: 'treino-progresso-texto' },
      `Exercício ${atual + 1} de ${itens.length} · ${quantosFeitos} ${quantosFeitos === 1 ? 'feito' : 'feitos'}`),
    h('ol', { class: 'treino-progresso-barra' },
      itens.map((item, i) => {
        const exercicio = catalogo.exercicioPorId.get(item.exercicioId);
        const feito = feitas(item) >= item.series;
        const classes = ['treino-progresso-trecho', feito ? 'feito' : '', i === atual ? 'atual' : ''].filter(Boolean).join(' ');
        return h('li', null,
          h('button', {
            type: 'button',
            class: classes,
            'aria-current': i === atual ? 'step' : null,
            'aria-label': `${i + 1}. ${exercicio ? exercicio.nome : item.exercicioId}: ${feitas(item)} de ${item.series} séries${feito ? ', feito' : ''}`,
            onclick: () => irPara(i),
          }));
      })));
}

// Séries já registradas deste exercício nesta sessão. Tocar numa abre a edição.
function listaDeSeries(series, previstas, aoTocar) {
  return h('section', { class: 'treino-series', 'aria-label': 'Séries registradas' },
    h('p', { class: 'hoje-rotulo' }, `Séries: ${series.length} de ${previstas}`),
    series.length
      ? h('ol', { class: 'treino-series-lista' },
        series.map((serie, i) => h('li', null,
          h('button', {
            type: 'button',
            class: 'treino-serie',
            'aria-label': `Série ${i + 1}: ${formatarSerie(serie)}. Tocar para editar ou apagar`,
            onclick: () => aoTocar(serie, i + 1),
          },
          h('span', { class: 'treino-serie-numero' }, `Série ${i + 1}`),
          h('span', { class: 'treino-serie-valor' }, formatarSerie(serie)),
          h('span', { class: 'treino-serie-editar', 'aria-hidden': 'true' }, 'Editar')))))
      : h('p', { class: 'treino-series-vazio' }, 'Nenhuma série registrada ainda.'));
}

// Valores iniciais dos contadores: rascunho desta tela; senão a última série; senão o mínimo do alvo.
function valoresIniciais(exercicio, item, seriesFeitas, rascunho) {
  if (rascunho) return { ...rascunho };
  const ultima = seriesFeitas[seriesFeitas.length - 1];
  const valores = {};
  for (const campo of CAMPOS[exercicio.tipo]) {
    if (ultima && ultima[campo] !== undefined) {
      valores[campo] = ultima[campo];
    } else if (campo === 'carga') {
      valores[campo] = CARGA_INICIAL;
    } else {
      valores[campo] = minimoDoAlvo(item.alvo, campo, exercicio.tipo);
    }
  }
  return valores;
}

// "8-12" → 8; "45" → 45. Fora da faixa válida do campo, fica no limite.
function minimoDoAlvo(alvo, campo, tipo) {
  const n = parseInt(String(alvo).split('-')[0], 10);
  const limites = campo === 'segundos' ? LIMITES.segundos : tipo === 'corpo' ? LIMITES.repsCorpo : LIMITES.repsCarga;
  if (!Number.isInteger(n)) return limites.min;
  return Math.min(Math.max(n, limites.min), limites.max);
}
