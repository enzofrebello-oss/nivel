// treino.js: treino em andamento (#/treino/:id). Etapa 13 (PROJETO.md, seção 5 e seção 8 "Telas aprovadas"):
// registrar séries.
// - Calendário da semana e barra de progresso dos exercícios (feito = séries registradas ≥ previstas);
//   tocar num trecho da barra, ou em Anterior/Próximo, troca o exercício.
// - Card do exercício: nome, alvo ("4 × 8-12"), trilha com o nível (etapa 15b), botão "Como fazer" (componente da Biblioteca num modal),
//   séries já registradas (tocar edita ou apaga), contador grande com − e + e o botão grande "Registrar série".
// - Contadores por tipo (ui/componentes.js, contador): carga = carga + reps; corpo = reps; tempo = segundos.
//   Passos: reps 1, tempo 5 s, carga 1 kg; nada abaixo do mínimo válido. Tocar no número abre o teclado.
// - Cada série é gravada no banco na hora (db/series.js); a tela relê o banco a cada mudança.
// Valor inicial do contador: etapa 14 (abaixo). Descanso: etapa 15 (abaixo). Finalizar/Descartar: etapa 16
// (abaixo). "+ Exercício": etapa 16c.
// Etapa 13b (fluxo do treino; regras puras em logica/fluxo-treino.js e logica/cronometro.js):
// - Registrar a última série pedida avança sozinho para o próximo exercício pendente, com o toast
//   "Próximo: <nome>" (etapa 15: o toast não aparece durante o descanso, que já mostra "A seguir").
//   Séries extras (voltando com Anterior) não avançam.
// - Séries feitas viram bolinhas compactas (tocar abre editar/apagar); as que faltam aparecem vazias.
// - Exercício de tempo: play embaixo do número. Contagem regressiva com a tela acesa (Wake Lock; sem
//   suporte, segue sem); ao zerar, vibra e registra a série sozinha com o tempo escolhido. Pausar,
//   continuar e parar (parar volta ao número). Trocar de exercício ou sair da tela cancela a contagem.
// - No último exercício concluído: só "Anterior" e o botão grande "Finalizar treino" (etapa 16; era "Sair").
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
// Etapa 15 (Descanso; regras puras em logica/descanso.js, contagem em logica/cronometro.js):
// - Registrar uma série (no botão ou no fim da contagem do tempo) grava sessao.descanso = { ate, duracao }
//   com o descanso do item e abre o modo Descanso: anel com o tempo, −15 s, +15 s, "Pular descanso" e
//   "A seguir: <exercício> · série n de m". Também depois da última série de um exercício (o avanço já
//   aconteceu, o "a seguir" mostra o próximo exercício); depois da última série do treino, não há descanso.
// - O tempo vem do horário de término (ate), não de um contador: minimizar, apagar a tela ou recarregar
//   não muda nada (ao voltar à aba, recalcula). Tela acesa durante o descanso (o mesmo Wake Lock da contagem).
// - Ao zerar: vibra (se houver) e volta sozinho para a série. Pular, −15 s até zero ou tocar na barra de
//   progresso encerram sem vibrar. Ao abrir a tela com um descanso que já acabou, só limpa.
import { h, limpar } from '../ui/dom.js';
// Etapa 16 (Finalizar, descartar e resumo):
// - Menu "⋯" no topo (modal): "Sair e continuar depois" (volta ao Hoje, o treino segue em andamento),
//   "Finalizar agora" e "Descartar treino".
// - Finalizar (menu ou botão do fim): se faltar exercício (séries registradas < pedidas), pede confirmação
//   com os nomes; grava status 'concluida' e fim (db/sessoes.js, finalizarSessao), cancela contagem e
//   descanso, e abre o resumo (#/evolucao/treino/:id, Detalhe da sessão em modo leitura), substituindo a
//   entrada do histórico (voltar não cai no treino já finalizado).
// - Descartar: confirmação com o número de séries; apaga a sessão e as séries dela na mesma transação
//   (descartarSessao) e volta ao Hoje.
import { abrirModal, comoFazer, contador, toast } from '../ui/componentes.js';
import { calendarioSemana } from '../ui/semana.js';
import { obterCatalogo } from '../catalogo.js';
import { anel } from '../ui/anel.js';
import {
  obterSessao, listarSessoes, salvarDescanso, finalizarSessao, descartarSessao,
} from '../db/sessoes.js';
import {
  adicionarSerie, editarSerie, apagarSerie, listarSeriesDaSessao, seriesDaUltimaVez,
} from '../db/series.js';
import { diasTreinadosNaSemana } from '../logica/datas.js';
import { textoAlvo, textoTrilhaDoItem } from '../logica/rotina.js';
import { CAMPOS, formatarSerie, formatarTempo } from '../logica/tipos.js';
import { compararSeries, textoAntes, valoresIniciais } from '../logica/comparacao.js';
import {
  indiceInicial, aposRegistrar, modoFinal, textoBolinha, pendentes,
} from '../logica/fluxo-treino.js';
import {
  novoCronometro, rodando, segundosRestantes, zerou, iniciar, pausar, fracaoRestante,
} from '../logica/cronometro.js';
import {
  duracaoDoItem, deveDescansar, comecarDescanso, ajustarDescanso, paraSalvar, doSalvo, textoASeguir,
} from '../logica/descanso.js';

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
  let descanso = null; // cronômetro do descanso em curso (espelho de sessao.descanso); null = sem descanso
  let intervalo = null; // um só setInterval para a contagem e o descanso (os dois nunca rodam juntos)
  let visor = null; // <p> com o tempo restante da contagem (atualizado a cada tique, sem redesenhar a tela)
  let visorDescanso = null; // idem, no centro do anel do descanso
  let anelDescanso = null; // { elemento, atualizar } do anel do descanso
  let travaTela = null; // WakeLockSentinel enquanto a contagem ou o descanso roda
  let saiu = false;
  let atual = null; // { itens, contagens, totalSeries, catalogo } do último desenho (menu, Finalizar, Descartar)

  const fechar = () => {
    if (fecharModal) fecharModal();
    fecharModal = null;
  };

  // Há relógio correndo (contagem rodando ou descanso)? Só então tique e tela acesa.
  const relogioAtivo = () => Boolean((cron && rodando(cron.estado)) || descanso);

  // ---------- Tela acesa (Screen Wake Lock); sem suporte ou recusado = segue sem, calado ----------
  async function manterTelaAcesa() {
    if (travaTela || !('wakeLock' in navigator)) return;
    try {
      const trava = await navigator.wakeLock.request('screen');
      if (saiu || !relogioAtivo() || travaTela) {
        trava.release().catch(() => {});
        return;
      }
      travaTela = trava;
      trava.addEventListener('release', () => {
        if (travaTela === trava) travaTela = null;
      });
    } catch {
      // Sem permissão (ex.: aba em segundo plano) ou sem suporte: o relógio continua igual.
    }
  }

  function liberarTela() {
    if (travaTela) travaTela.release().catch(() => {});
    travaTela = null;
  }

  // Liga ou desliga o tique e a tela acesa conforme o estado (chamar depois de mudar cron ou descanso).
  function atualizarRelogio() {
    if (relogioAtivo()) {
      if (!intervalo) intervalo = setInterval(tique, 250);
      manterTelaAcesa();
    } else {
      if (intervalo) clearInterval(intervalo);
      intervalo = null;
      liberarTela();
    }
  }

  // O navegador solta a trava quando a aba fica oculta e pode atrasar o setInterval: ao voltar, pede de
  // novo e recalcula pelo relógio (o tempo vem do horário de término, então continua certo).
  function aoMudarVisibilidade() {
    if (document.visibilityState !== 'visible' || !relogioAtivo()) return;
    manterTelaAcesa();
    tique();
  }
  document.addEventListener('visibilitychange', aoMudarVisibilidade);

  function vibrar() {
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  }

  // ---------- Cronômetro do exercício de tempo ----------
  function pararCronometro() {
    cron = null;
    visor = null;
    atualizarRelogio();
  }

  function tique() {
    const agora = Date.now();
    if (cron && rodando(cron.estado)) {
      if (zerou(cron.estado, agora)) {
        const { exercicio, estado } = cron;
        pararCronometro();
        vibrar();
        registrar(exercicio, { segundos: estado.total });
        return;
      }
      if (visor) visor.textContent = formatarTempo(segundosRestantes(cron.estado, agora));
      return;
    }
    if (descanso) {
      if (zerou(descanso, agora)) {
        terminarDescanso({ vibrando: true });
        return;
      }
      mostrarDescanso(agora);
    }
  }

  function comecarContagem(exercicio, segundos) {
    cron = { exercicio, estado: iniciar(novoCronometro(segundos), Date.now()) };
    atualizarRelogio();
    desenhar();
  }

  function pausarContagem() {
    if (!cron) return;
    cron = { ...cron, estado: pausar(cron.estado, Date.now()) };
    atualizarRelogio();
    desenhar();
  }

  function continuarContagem() {
    if (!cron) return;
    cron = { ...cron, estado: iniciar(cron.estado, Date.now()) };
    atualizarRelogio();
    desenhar();
  }

  // ---------- Descanso (estado no banco: sessao.descanso) ----------
  function mostrarDescanso(agora) {
    if (!descanso) return;
    if (visorDescanso) visorDescanso.textContent = formatarTempo(segundosRestantes(descanso, agora));
    if (anelDescanso) anelDescanso.atualizar(fracaoRestante(descanso, agora));
  }

  // Encerra o descanso (zerou, Pular, −15 s até zero ou troca de exercício): limpa no banco e, se
  // redesenhar, volta para a série. Espera a gravação antes de redesenhar (senão a leitura ainda o veria).
  async function terminarDescanso({ vibrando = false, redesenhar = true } = {}) {
    if (!descanso) return;
    descanso = null;
    visorDescanso = null;
    anelDescanso = null;
    atualizarRelogio();
    if (vibrando) vibrar();
    try {
      await salvarDescanso(params.id, null, db);
    } catch (erro) {
      console.error('Treino: não foi possível limpar o descanso:', erro);
    }
    if (redesenhar && !saiu) await desenhar();
  }

  // −15 s (vezes = -1) / +15 s (vezes = 1): muda o horário de término e grava.
  async function ajustarTempo(vezes) {
    if (!descanso) return;
    const agora = Date.now();
    descanso = ajustarDescanso(descanso, vezes, agora);
    if (zerou(descanso, agora)) {
      await terminarDescanso();
      return;
    }
    mostrarDescanso(agora);
    try {
      await salvarDescanso(params.id, paraSalvar(descanso), db);
    } catch (erro) {
      console.error('Treino: não foi possível salvar o descanso:', erro);
    }
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
      await iniciarDescansoSeFaltar(exercicio, series);
    } catch (erro) {
      console.error('Treino: não foi possível registrar a série:', erro);
      mensagem = `Não foi possível salvar a série: ${erro.message}`;
    }
    if (!saiu) await desenhar();
  }

  // Depois de registrar: descansa o tempo do item, a não ser que o treino tenha acabado (sem pendentes).
  // Se gravar falhar, segue sem descanso (a série já está salva).
  async function iniciarDescansoSeFaltar(exercicio, series) {
    try {
      const sessao = await obterSessao(params.id, db);
      if (!sessao) return;
      const itens = sessao.itens;
      const contagens = itens.map((it) => series.filter((s) => s.exercicioId === it.exercicioId).length);
      if (!deveDescansar(itens, contagens)) return;
      const item = itens[indice] && itens[indice].exercicioId === exercicio.id
        ? itens[indice]
        : itens.find((it) => it.exercicioId === exercicio.id);
      await salvarDescanso(params.id, paraSalvar(comecarDescanso(duracaoDoItem(item), Date.now())), db);
    } catch (erro) {
      console.error('Treino: não foi possível começar o descanso:', erro);
    }
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
      tela.append(aviso('Este treino já foi finalizado.',
        h('a', { class: 'botao botao-destaque', href: `#/evolucao/treino/${encodeURIComponent(sessao.id)}` }, 'Ver resumo')));
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
    atual = { itens, contagens, totalSeries: series.length, catalogo };

    if (indice === null || indice >= itens.length) {
      // Ao abrir (ou reabrir o app): o primeiro exercício que ainda não foi feito; tudo feito = o último.
      indice = indiceInicial(itens, contagens);
    }
    let avisoProximo = null; // texto do toast "Próximo: <nome>" (só sai se não houver descanso)
    if (conferirAvanco) {
      // Acabou de registrar: se foi a última série pedida, vai para o próximo exercício pendente.
      conferirAvanco = false;
      const destino = aposRegistrar(itens, contagens, indice);
      if (destino !== null) {
        indice = destino;
        mensagem = '';
        const proximo = catalogo.exercicioPorId.get(itens[destino].exercicioId);
        avisoProximo = `Próximo: ${proximo ? proximo.nome : itens[destino].exercicioId}`;
      }
    }
    const item = itens[indice];
    const exercicio = catalogo.exercicioPorId.get(item.exercicioId);
    const final = modoFinal(itens, contagens, indice);

    const irPara = async (i) => {
      pararCronometro(); // trocar de exercício cancela a contagem
      await terminarDescanso({ redesenhar: false }); // e o descanso
      indice = i;
      mensagem = '';
      desenhar();
    };

    // Descanso gravado na sessão (acabou de registrar, ou o app reabriu no meio dele).
    const agora = Date.now();
    descanso = doSalvo(sessao.descanso, agora);
    if (descanso && zerou(descanso, agora)) {
      // Acabou enquanto o app estava fechado: só limpa e segue para a série.
      descanso = null;
      salvarDescanso(params.id, null, db).catch((erro) => console.error('Treino: não foi possível limpar o descanso:', erro));
    }
    // Durante o descanso a tela já mostra "A seguir"; o toast só aparece sem descanso.
    if (avisoProximo && !descanso) toast(avisoProximo);
    atualizarRelogio();
    if (descanso) {
      limpar(tela);
      tela.append(
        calendarioSemana(diasTreinadosNaSemana(sessoes)),
        cabecalho(sessao, abrirMenu),
        barraDeProgresso(catalogo, itens, indice, feitas, irPara),
        cartaoDescanso(exercicio ? exercicio.nome : item.exercicioId, contagens[indice], item.series),
      );
      return;
    }
    visorDescanso = null;
    anelDescanso = null;

    // "Antes" do exercício aberto: último treino concluído (se a leitura falhar, segue sem antes).
    let antes = [];
    try {
      antes = await seriesDaUltimaVez(item.exercicioId, sessao.id, db);
    } catch (erro) {
      console.error('Treino: não foi possível ler a última vez:', erro);
    }
    if (minha !== rodada) return;
    limpar(tela); // só agora, com tudo lido: a tela não pisca vazia entre as leituras

    tela.append(
      calendarioSemana(diasTreinadosNaSemana(sessoes)),
      cabecalho(sessao, abrirMenu),
      barraDeProgresso(catalogo, itens, indice, feitas, irPara),
      exercicio
        ? cartaoExercicio({ item, exercicio, seriesFeitas: porExercicio.get(item.exercicioId) || [] })
        : aviso(`Exercício "${item.exercicioId}" não está no catálogo.`),
      h('nav', { class: `treino-navegacao${final ? ' treino-navegacao-final' : ''}`, 'aria-label': 'Trocar de exercício' },
        h('button', { type: 'button', class: 'botao', disabled: indice === 0, onclick: () => irPara(indice - 1) }, '‹ Anterior'),
        final
          // Fim do treino: Finalizar (com confirmação se algum exercício ficou faltando).
          ? h('button', { type: 'button', class: 'botao botao-destaque botao-grande treino-finalizar', onclick: () => pedirFinalizar() }, 'Finalizar treino')
          : h('button', { type: 'button', class: 'botao', disabled: indice === itens.length - 1, onclick: () => irPara(indice + 1) }, 'Próximo ›')),
    );

    // Modo Descanso: anel com o tempo, −15 s / +15 s, Pular e o que vem a seguir.
    function cartaoDescanso(nome, feitasNoProximo, previstas) {
      const t = Date.now();
      visorDescanso = h('p', { class: 'descanso-tempo', role: 'timer' }, formatarTempo(segundosRestantes(descanso, t)));
      anelDescanso = anel({ fracao: fracaoRestante(descanso, t), conteudo: visorDescanso });
      return h('section', { class: 'cartao descanso', 'aria-labelledby': 'descanso-titulo' },
        h('h3', { class: 'descanso-titulo', id: 'descanso-titulo' }, 'Descanso'),
        anelDescanso.elemento,
        h('div', { class: 'descanso-ajustes' },
          h('button', { type: 'button', class: 'botao', 'aria-label': 'Menos 15 segundos', onclick: () => ajustarTempo(-1) }, '−15 s'),
          h('button', { type: 'button', class: 'botao', 'aria-label': 'Mais 15 segundos', onclick: () => ajustarTempo(1) }, '+15 s')),
        h('button', { type: 'button', class: 'botao botao-destaque botao-grande', onclick: () => terminarDescanso() }, 'Pular descanso'),
        h('p', { class: 'descanso-seguir' },
          h('span', { class: 'descanso-seguir-rotulo' }, 'A seguir'), ` ${textoASeguir(nome, feitasNoProximo, previstas)}`),
        h('p', { class: 'treino-status', role: 'status' }, mensagem));
    }

    function cartaoExercicio({ item: it, exercicio: ex, seriesFeitas }) {
      const trilha = textoTrilhaDoItem(it, catalogo);
      const status = h('p', { class: 'treino-status', role: 'status' }, mensagem);
      const topo = h('div', { class: 'treino-exercicio-topo' },
        h('div', { class: 'treino-exercicio-texto' },
          h('h3', { class: 'treino-exercicio-nome', id: 'treino-exercicio-nome' }, ex.nome),
          h('p', { class: 'treino-exercicio-alvo' }, textoAlvo(it, ex.tipo)),
          trilha ? h('p', { class: 'treino-exercicio-trilha' }, trilha) : null),
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

  // ---------- Menu "⋯", Finalizar e Descartar (etapa 16) ----------
  // Nomes dos exercícios que ainda não têm as séries pedidas.
  function nomesPendentes() {
    if (!atual) return [];
    return pendentes(atual.itens, atual.contagens).map((i) => {
      const ex = atual.catalogo.exercicioPorId.get(atual.itens[i].exercicioId);
      return ex ? ex.nome : atual.itens[i].exercicioId;
    });
  }

  // Modal cujo corpo troca de conteúdo (menu → confirmação), como o de editar série.
  function abrirCorpo(titulo) {
    fechar();
    const corpo = h('div', { class: 'treino-menu' });
    fecharModal = abrirModal({ titulo, conteudo: corpo });
    return corpo;
  }

  // Para a contagem e o descanso na tela (antes de finalizar ou descartar).
  function pararRelogios() {
    cron = null;
    visor = null;
    descanso = null;
    atualizarRelogio();
  }

  function abrirMenu() {
    const corpo = abrirCorpo('Treino');
    corpo.append(
      h('button', {
        type: 'button',
        class: 'botao treino-menu-opcao',
        onclick: () => { fechar(); location.hash = '#/'; },
      }, 'Sair e continuar depois'),
      h('button', { type: 'button', class: 'botao botao-destaque treino-menu-opcao', onclick: () => pedirFinalizar(corpo) }, 'Finalizar agora'),
      h('button', { type: 'button', class: 'botao botao-perigo treino-menu-opcao', onclick: () => confirmarDescartar(corpo) }, 'Descartar treino'),
    );
  }

  // Finalizar: direto se o treino está completo; senão, confirmação com o que falta.
  function pedirFinalizar(corpoAberto) {
    const faltam = nomesPendentes();
    if (!faltam.length) {
      finalizar();
      return;
    }
    const corpo = corpoAberto || abrirCorpo('Finalizar treino');
    const erro = h('p', { class: 'contador-erro', 'aria-live': 'polite' });
    limpar(corpo);
    corpo.append(
      h('p', { class: 'treino-menu-texto' },
        faltam.length === 1 ? 'Falta 1 exercício:' : `Faltam ${faltam.length} exercícios:`),
      h('ul', { class: 'treino-menu-faltam' }, faltam.map((nome) => h('li', null, nome))),
      h('p', { class: 'treino-menu-texto' }, 'Finalizar mesmo assim? As séries já registradas ficam salvas.'),
      erro,
      h('div', { class: 'editar-serie-botoes' },
        h('button', {
          type: 'button',
          class: 'botao botao-destaque',
          onclick: (ev) => finalizar(ev.currentTarget, erro),
        }, 'Finalizar mesmo assim'),
        h('button', { type: 'button', class: 'botao', onclick: fechar }, 'Voltar ao treino')),
    );
  }

  // Grava a sessão como concluída e abre o resumo (substitui a entrada do histórico).
  async function finalizar(botao, erroEl) {
    if (botao) botao.disabled = true;
    pararRelogios();
    try {
      const feita = await finalizarSessao(params.id, {}, db);
      fechar();
      if (!feita) {
        // Já finalizado (ou descartado) em outra aba: o desenho mostra o aviso.
        if (!saiu) await desenhar();
        return;
      }
      location.replace(`#/evolucao/treino/${encodeURIComponent(params.id)}`);
    } catch (e) {
      console.error('Treino: não foi possível finalizar:', e);
      if (erroEl) {
        erroEl.textContent = `Não foi possível finalizar: ${e.message}`;
        if (botao) botao.disabled = false;
      } else {
        fechar();
        mensagem = `Não foi possível finalizar: ${e.message}`;
        if (!saiu) await desenhar();
      }
    }
  }

  // Descartar: confirmação com o número de séries; apaga a sessão e as séries e volta ao Hoje.
  function confirmarDescartar(corpo) {
    const total = atual ? atual.totalSeries : 0;
    const erro = h('p', { class: 'contador-erro', 'aria-live': 'polite' });
    let texto = 'Descartar este treino? Nenhuma série foi registrada.';
    if (total === 1) texto = 'Descartar este treino? A série registrada será apagada.';
    else if (total > 1) texto = `Descartar este treino? As ${total} séries registradas serão apagadas.`;
    limpar(corpo);
    corpo.append(
      h('p', { class: 'treino-menu-texto' }, `${texto} Não dá para desfazer.`),
      erro,
      h('div', { class: 'editar-serie-botoes' },
        h('button', {
          type: 'button',
          class: 'botao botao-perigo',
          onclick: async (ev) => {
            const botao = ev.currentTarget;
            botao.disabled = true;
            pararRelogios();
            try {
              await descartarSessao(params.id, db);
              fechar();
              toast('Treino descartado.');
              location.replace('#/');
            } catch (e) {
              console.error('Treino: não foi possível descartar:', e);
              erro.textContent = `Não foi possível descartar: ${e.message}`;
              botao.disabled = false;
            }
          },
        }, 'Descartar'),
        h('button', { type: 'button', class: 'botao', onclick: fechar }, 'Cancelar')),
    );
  }

  await desenhar();
  return () => {
    saiu = true;
    fechar();
    // Sair da tela solta o relógio e a tela acesa; o descanso continua gravado (volta certo ao reabrir).
    cron = null;
    descanso = null;
    atualizarRelogio();
    document.removeEventListener('visibilitychange', aoMudarVisibilidade);
  };
}

// Nome e horário do treino, com o menu "⋯" (etapa 16) à direita.
function cabecalho(sessao, aoMenu) {
  return h('header', { class: 'treino-cabecalho' },
    h('div', { class: 'treino-cabecalho-texto' },
      h('h2', { class: 'treino-nome' }, sessao.nome),
      h('p', { class: 'treino-inicio' }, `Começou às ${formatoHora.format(sessao.inicio)}`)),
    h('button', {
      type: 'button',
      class: 'botao treino-menu-botao',
      'aria-label': 'Opções do treino',
      'aria-haspopup': 'dialog',
      onclick: aoMenu,
    }, '⋯'));
}

function aviso(texto, extra = null) {
  return h('section', { class: 'cartao' },
    h('p', { class: 'hoje-aviso' }, texto),
    extra,
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
