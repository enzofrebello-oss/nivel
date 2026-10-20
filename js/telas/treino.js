// treino.js: treino em andamento (#/treino/:id). Etapa 13 (PROJETO.md, seção 5 e seção 8 "Telas aprovadas"):
// registrar séries.
// - Calendário da semana e barra de progresso dos exercícios (feito = séries registradas ≥ previstas);
//   tocar num trecho da barra, ou em Anterior/Próximo, troca o exercício.
// - Card do exercício: nome, alvo ("4 × 8-12"), trilha, botão "Como fazer" (componente da Biblioteca num modal),
//   séries já registradas (tocar edita ou apaga), contador grande com − e + e o botão grande "Registrar série".
// - Contadores por tipo (ui/componentes.js, contador): carga = carga + reps; corpo = reps; tempo = segundos.
//   Passos: reps 1, tempo 5 s, carga 1 kg; nada abaixo do mínimo válido. Tocar no número abre o teclado.
// - Cada série é gravada no banco na hora (db/series.js); a tela relê o banco a cada mudança.
// Valor inicial do contador: etapa 14 (abaixo). O Descanso entra na 15; Finalizar/Descartar e
// "+ Exercício", na 16.
// Etapa 13b (fluxo do treino; regras puras em logica/fluxo-treino.js e logica/cronometro.js):
// - Registrar a última série pedida avança sozinho para o próximo exercício pendente, com o toast
//   "Próximo: <nome>". Séries extras (voltando com Anterior) não avançam.
// - Séries feitas viram bolinhas compactas (tocar abre editar/apagar); as que faltam aparecem vazias.
// - Exercício de tempo: play embaixo do número. Contagem regressiva com a tela acesa (Wake Lock; sem
//   suporte, segue sem); ao zerar, vibra e registra a série sozinha com o tempo escolhido. Pausar,
//   continuar e parar (parar volta ao número). Trocar de exercício ou sair da tela cancela a contagem.
// - No último exercício concluído: só "Anterior" e "Sair" (volta ao Hoje; o treino segue em andamento).
// - A barra de abas some nesta rota (roteador.js, semAbas).
// Etapa 14 (antes / hoje / +1; regras puras em logica/comparacao.js):
// - "Antes" = séries deste exercício no último treino CONCLUÍDO (db/series.js, seriesDaUltimaVez); nunca
//   o treino atual nem um em andamento. Linha pequena e cinza em cima das bolinhas: "ANTES 20 · 20 · 18".
// - Embaixo de cada bolinha de hoje, o +1 da série de mesma posição: ganho em laranja ("+2"), "=" se
//   igual, cinza se piorou ou se a carga mudou para um lado e as reps para o outro; nada se não há antes.
// - O contador da série n começa com o valor da série n de antes; sem ela, com a meta da rotina (mínimo
//   do alvo; carga: última de hoje, senão última de antes). Sem nenhuma carga, o campo de carga começa
//   vazio ("Digite a carga (kg)") e "Registrar série" fica desabilitado até a carga ser válida.
//   Mexer no contador guarda um rascunho só daquela série (exercício + número da série), que some ao registrar.
// - render aceita um 3º parâmetro opcional { db, catalogo } (só os testes usam: banco e catálogo de teste).
import { h, limpar } from '../ui/dom.js';
import { abrirModal, comoFazer, contador, toast } from '../ui/componentes.js';
import { calendarioSemana } from '../ui/semana.js';
import { obterCatalogo } from '../catalogo.js';
import { obterSessao, listarSessoes } from '../db/sessoes.js';
import {
  adicionarSerie, editarSerie, apagarSerie, listarSeriesDaSessao, seriesDaUltimaVez,
} from '../db/series.js';
import { diasTreinadosNaSemana } from '../logica/datas.js';
import { textoAlvo } from '../logica/rotina.js';
import { CAMPOS, formatarSerie, formatarTempo } from '../logica/tipos.js';
import { compararSeries, textoAntes, valoresIniciais } from '../logica/comparacao.js';
import { indiceInicial, aposRegistrar, modoFinal, textoBolinha } from '../logica/fluxo-treino.js';
import {
  novoCronometro, rodando, segundosRestantes, zerou, iniciar, pausar,
} from '../logica/cronometro.js';

const formatoHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export async function render(container, params, { db, catalogo: catalogoDeTeste } = {}) {
  const tela = h('div', { class: 'treino' });
  container.append(tela);

  let indice = null; // exercício aberto (posição em sessao.itens)
  let mensagem = ''; // "Série 2 registrada: 15 reps"
  let fecharModal = null;
  let rodada = 0;
  const rascunhos = new Map(); // "exercicioId#n" (n = séries já feitas) → { carga?, reps?, segundos? }
  const chaveRascunho = (exercicioId, n) => `${exercicioId}#${n}`;
  let conferirAvanco = false; // true logo depois de registrar: o próximo desenho decide se avança
  let cron = null; // { exercicio, estado } da contagem do exercício de tempo; null = sem contagem
  let intervalo = null;
  let visor = null; // <p> com o tempo restante (atualizado a cada tique, sem redesenhar a tela)
  let travaTela = null; // WakeLockSentinel enquanto a contagem roda
  let saiu = false;

  const fechar = () => {
    if (fecharModal) fecharModal();
    fecharModal = null;
  };

  // ---------- Tela acesa (Screen Wake Lock); sem suporte ou recusado = segue sem, calado ----------
  async function manterTelaAcesa() {
    if (travaTela || !('wakeLock' in navigator)) return;
    try {
      const trava = await navigator.wakeLock.request('screen');
      if (saiu || !cron || !rodando(cron.estado) || travaTela) {
        trava.release().catch(() => {});
        return;
      }
      travaTela = trava;
      trava.addEventListener('release', () => {
        if (travaTela === trava) travaTela = null;
      });
    } catch {
      // Sem permissão (ex.: aba em segundo plano) ou sem suporte: a contagem continua igual.
    }
  }

  function liberarTela() {
    if (travaTela) travaTela.release().catch(() => {});
    travaTela = null;
  }

  // O navegador solta a trava quando a aba fica oculta: ao voltar, pede de novo e confere se zerou.
  function aoMudarVisibilidade() {
    if (document.visibilityState !== 'visible' || !cron) return;
    if (rodando(cron.estado)) manterTelaAcesa();
    tique();
  }
  document.addEventListener('visibilitychange', aoMudarVisibilidade);

  // ---------- Cronômetro do exercício de tempo ----------
  function pararCronometro() {
    if (intervalo) clearInterval(intervalo);
    intervalo = null;
    cron = null;
    visor = null;
    liberarTela();
  }

  function tique() {
    if (!cron || !rodando(cron.estado)) return;
    const agora = Date.now();
    if (zerou(cron.estado, agora)) {
      const { exercicio, estado } = cron;
      pararCronometro();
      if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
      registrar(exercicio, { segundos: estado.total });
      return;
    }
    if (visor) visor.textContent = formatarTempo(segundosRestantes(cron.estado, agora));
  }

  function comecarContagem(exercicio, segundos) {
    pararCronometro();
    cron = { exercicio, estado: iniciar(novoCronometro(segundos), Date.now()) };
    intervalo = setInterval(tique, 250);
    manterTelaAcesa();
    desenhar();
  }

  function pausarContagem() {
    if (!cron) return;
    cron = { ...cron, estado: pausar(cron.estado, Date.now()) };
    liberarTela();
    desenhar();
  }

  function continuarContagem() {
    if (!cron) return;
    cron = { ...cron, estado: iniciar(cron.estado, Date.now()) };
    manterTelaAcesa();
    desenhar();
  }

  // Grava a série (botão "Registrar série" ou fim da contagem) e redesenha; o desenho decide se avança.
  async function registrar(exercicio, medidas) {
    try {
      const serie = await adicionarSerie({ sessaoId: params.id, exercicio, medidas }, undefined, db);
      const series = await listarSeriesDaSessao(params.id, db);
      const n = series.filter((s) => s.exercicioId === exercicio.id).length;
      rascunhos.delete(chaveRascunho(exercicio.id, n - 1)); // a série n já foi feita
      mensagem = `Série ${n} registrada: ${formatarSerie(serie)}`;
      conferirAvanco = true;
    } catch (erro) {
      console.error('Treino: não foi possível registrar a série:', erro);
      mensagem = `Não foi possível salvar a série: ${erro.message}`;
    }
    if (!saiu) await desenhar();
  }

  async function desenhar() {
    const minha = ++rodada;
    const catalogo = catalogoDeTeste || obterCatalogo();
    let sessao;
    let series = [];
    let sessoes = [];
    try {
      [sessao, series, sessoes] = await Promise.all([
        obterSessao(params.id, db),
        listarSeriesDaSessao(params.id, db),
        listarSessoes(db),
      ]);
    } catch (erro) {
      console.error('Treino: banco indisponível:', erro);
      if (minha !== rodada) return;
      limpar(tela);
      tela.append(aviso('Banco indisponível: não dá para abrir o treino agora.'));
      return;
    }
    if (minha !== rodada) return;

    if (!sessao) {
      limpar(tela);
      tela.append(aviso('Treino não encontrado.'));
      return;
    }
    if (sessao.status !== 'andamento') {
      limpar(tela);
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
    const contagens = itens.map(feitas);

    if (indice === null || indice >= itens.length) {
      // Ao abrir (ou reabrir o app): o primeiro exercício que ainda não foi feito; tudo feito = o último.
      indice = indiceInicial(itens, contagens);
    }
    if (conferirAvanco) {
      // Acabou de registrar: se foi a última série pedida, vai para o próximo exercício pendente.
      conferirAvanco = false;
      const destino = aposRegistrar(itens, contagens, indice);
      if (destino !== null) {
        indice = destino;
        mensagem = '';
        const proximo = catalogo.exercicioPorId.get(itens[destino].exercicioId);
        toast(`Próximo: ${proximo ? proximo.nome : itens[destino].exercicioId}`);
      }
    }
    const item = itens[indice];
    const exercicio = catalogo.exercicioPorId.get(item.exercicioId);
    const final = modoFinal(itens, contagens, indice);

    // "Antes" do exercício aberto: último treino concluído (se a leitura falhar, segue sem antes).
    let antes = [];
    try {
      antes = await seriesDaUltimaVez(item.exercicioId, sessao.id, db);
    } catch (erro) {
      console.error('Treino: não foi possível ler a última vez:', erro);
    }
    if (minha !== rodada) return;
    limpar(tela); // só agora, com tudo lido: a tela não pisca vazia entre as leituras

    const irPara = (i) => {
      pararCronometro(); // trocar de exercício cancela a contagem
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
        final
          // Sair: volta ao Hoje; o treino continua em andamento (Finalizar entra na etapa 16).
          ? h('button', { type: 'button', class: 'botao botao-destaque', onclick: () => { location.hash = '#/'; } }, 'Sair')
          : h('button', { type: 'button', class: 'botao', disabled: indice === itens.length - 1, onclick: () => irPara(indice + 1) }, 'Próximo ›')),
    );

    function cartaoExercicio({ item: it, exercicio: ex, seriesFeitas }) {
      const trilha = it.trilhaId ? catalogo.trilhaPorId.get(it.trilhaId) : null;
      const status = h('p', { class: 'treino-status', role: 'status' }, mensagem);
      const topo = h('div', { class: 'treino-exercicio-topo' },
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
        }, 'Como fazer'));
      const bolinhas = bolinhasDeSeries(seriesFeitas, antes, it.series, (serie, n) => editar(ex, serie, n));
      const secao = (...filhos) => h('section', { class: 'cartao treino-exercicio', 'aria-labelledby': 'treino-exercicio-nome' }, ...filhos);

      // Último exercício concluído: sem contador nem registrar (séries extras: voltar com Anterior).
      if (final) {
        return secao(topo, bolinhas, h('p', { class: 'treino-final' }, 'Último exercício concluído.'), status);
      }

      // Contagem em curso (ou pausada) deste exercício: o visor ocupa o lugar do contador.
      if (cron && cron.exercicio.id === ex.id) {
        const correndo = rodando(cron.estado);
        visor = h('p', { class: 'cronometro-numero', role: 'timer' },
          formatarTempo(segundosRestantes(cron.estado, Date.now())));
        return secao(topo, bolinhas,
          h('div', { class: 'cronometro' },
            h('p', { class: 'contador-rotulo' }, correndo ? 'Contando' : 'Pausado'),
            visor,
            h('div', { class: 'cronometro-botoes' },
              correndo
                ? h('button', { type: 'button', class: 'botao botao-grande', onclick: pausarContagem }, '❚❚ Pausar')
                : h('button', { type: 'button', class: 'botao botao-destaque botao-grande', onclick: continuarContagem }, '▶ Continuar'),
              correndo
                ? null
                : h('button', { type: 'button', class: 'botao', onclick: () => { pararCronometro(); desenhar(); } }, 'Parar'))),
          status);
      }

      const chave = chaveRascunho(ex.id, seriesFeitas.length);
      const valores = rascunhos.get(chave) || valoresIniciais(ex.tipo, it.alvo, antes, seriesFeitas);
      let registrarBotao = null;
      // Carga sem nenhum histórico começa vazia: "Registrar série" só libera com todos os campos válidos.
      const liberarRegistrar = () => {
        if (registrarBotao) registrarBotao.disabled = !contadores.every((c) => c.preenchido());
      };
      const contadores = CAMPOS[ex.tipo].map((campo) => contador({
        campo,
        tipo: ex.tipo,
        valor: valores[campo],
        grande: campo !== 'carga',
        placeholder: campo === 'carga' ? 'Digite a carga (kg)' : undefined,
        aoMudar: (v) => {
          rascunhos.set(chave, { ...(rascunhos.get(chave) || valores), [campo]: v });
        },
        aoValidar: liberarRegistrar,
      }));

      registrarBotao = h('button', {
        type: 'button',
        class: 'botao botao-destaque botao-grande',
        onclick: async () => {
          if (!contadores.every((c) => c.confirmar())) return;
          const medidas = {};
          CAMPOS[ex.tipo].forEach((campo, i) => { medidas[campo] = contadores[i].valor(); });
          registrarBotao.disabled = true;
          await registrar(ex, medidas);
        },
      }, `Registrar série ${seriesFeitas.length + 1}`);
      liberarRegistrar();

      // Tempo: play embaixo do número; conta para baixo a partir do valor do contador.
      const play = ex.tipo === 'tempo'
        ? h('button', {
          type: 'button',
          class: 'botao cronometro-play',
          'aria-label': 'Iniciar contagem regressiva',
          onclick: () => {
            if (!contadores[0].confirmar()) return;
            const segundos = contadores[0].valor();
            rascunhos.set(chave, { segundos });
            comecarContagem(ex, segundos);
          },
        }, '▶ Iniciar')
        : null;

      return secao(topo, bolinhas,
        h('div', { class: 'treino-contadores' }, contadores.map((c) => c.elemento), play),
        registrarBotao,
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
                const nova = await editarSerie(serie.id, medidas, db);
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
                await apagarSerie(serie.id, db);
                mensagem = `Série ${n} apagada.`;
                // As posições das séries mudaram: os rascunhos deste exercício deixam de valer.
                for (const k of [...rascunhos.keys()]) if (k.startsWith(`${exercicio.id}#`)) rascunhos.delete(k);
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
  return () => {
    saiu = true;
    fechar();
    pararCronometro();
    document.removeEventListener('visibilitychange', aoMudarVisibilidade);
  };
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

// Séries deste exercício nesta sessão como bolinhas compactas (20 · 22 · 20); tocar numa abre a edição.
// As que ainda faltam para o pedido aparecem vazias (só visual). Em cima, a linha "ANTES 20 · 20 · 18"
// (só se houver antes); embaixo de cada bolinha, o +1 da série de mesma posição (nada sem antes).
function bolinhasDeSeries(series, antes, previstas, aoTocar) {
  const faltam = Math.max(0, previstas - series.length);
  const comparacoes = compararSeries(antes, series);
  const linhaAntes = antes.length
    ? h('p', { class: 'treino-antes' },
      h('span', { class: 'treino-antes-rotulo' }, 'Antes'), ` ${textoAntes(antes)}`)
    : null;
  return h('section', { class: 'treino-series', 'aria-label': 'Séries registradas' },
    h('p', { class: 'hoje-rotulo' }, `Séries: ${series.length} de ${previstas}`),
    linhaAntes,
    h('ol', { class: 'treino-bolinhas' },
      series.map((serie, i) => {
        const c = comparacoes[i];
        return h('li', { class: 'treino-bolinha-item' },
          h('button', {
            type: 'button',
            class: 'treino-bolinha',
            'aria-label': `Série ${i + 1}: ${formatarSerie(serie)}${c ? ` (${c.texto} em relação a antes)` : ''}. Tocar para editar ou apagar`,
            onclick: () => aoTocar(serie, i + 1),
          }, textoBolinha(serie)),
          c ? h('span', { class: `treino-mais treino-mais-${c.resultado}`, 'aria-hidden': 'true' }, c.texto) : null);
      }),
      Array.from({ length: faltam }, () => h('li', { class: 'treino-bolinha-item', 'aria-hidden': 'true' },
        h('span', { class: 'treino-bolinha treino-bolinha-vazia' })))));
}
