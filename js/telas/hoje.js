// hoje.js: tela Hoje (#/). Etapa 12 (PROJETO.md, seção 5 e seção 8 "Telas aprovadas"): Hoje básico.
// - Calendário da semana (seg–dom): só os dias com treino concluído de verdade, lidos da store sessoes.
//   Sem sessões, nenhum dia fica marcado. Dois treinos no mesmo dia marcam o dia uma vez só.
// - Rotina atual (meta.rotinaAtualId) com "Trocar": modal com as 12 rotinas, primeiro as de casa,
//   depois as de academia, agrupadas por objetivo. A escolha é gravada no banco e persiste ao recarregar.
// Etapa 13: com um treino em andamento, o card mostra esse treino e o botão vira "Continuar treino".
// Começar um segundo treino é impedido: se outra aba já começou um, o modal oferece continuar.
// Etapa 15b: o card do treino do dia usa o nível escolhido em Ajustes (store trilhas, lido a cada desenho).
// Etapa 16b (Hoje novo, identidade Brasa): data grande no topo ("Terça, 20 de outubro") e o calendário da
// semana; depois, uma de três situações (js/logica/hoje.js, situacaoDoHoje):
// 1. Dia de treino (a data sugerida é hoje ou já passou): card do treino do dia com "Começar treino".
// 2. Já treinou hoje: card compacto com "CONCLUÍDO" pequeno, "Parabéns, campeão" grande, a frase do treino
//    (sessao.frase) em cinza, foguinho e o botão ↻ (pergunta "Refazer o treino <letra> do zero?"; Sim refaz
//    o mesmo treino do zero: nova sessão com os mesmos itens). Abaixo, a linha compacta "Próximo treino ·
//    <letra · nome> · <data>" com ›; tocar abre o card completo do próximo treino (Começar pergunta antes).
// 3. Dia de descanso (a data sugerida é depois de hoje): "Hoje é dia de descanso" e o card "Próximo
//    treino · <data>"; o "Começar treino" fica preso acima da barra de abas (visível sem rolar) e pergunta
//    "Tem certeza que quer fazer esse treino hoje?" (Não em laranja, Sim em preto; sem "Fechar").
// O cartão da rotina fica no fim. Próximo nível, recorde da semana e aviso de backup entram na etapa 23;
// Treino livre na 16c.
// render aceita um 3º parâmetro opcional { db, catalogo, agora } (só os testes, como Trilhas e Evolução).
import { h, limpar } from '../ui/dom.js';
import { abrirModal } from '../ui/componentes.js';
import { calendarioSemana } from '../ui/semana.js';
import { foguinho } from '../ui/icones.js';
import { obterCatalogo } from '../catalogo.js';
import { lerMeta, gravarMeta } from '../db/meta.js';
import { listarSessoes, iniciarSessao } from '../db/sessoes.js';
import { listarSeriesDaSessao } from '../db/series.js';
import { lerProgressoTrilhas } from '../db/trilhas.js';
import { diasTreinadosNaSemana, textoDataLonga } from '../logica/datas.js';
import { situacaoDoHoje, fraseDaSessao } from '../logica/hoje.js';
import { nomeRotina, rotinasParaEscolha, treinoDoDia, textoAlvo, textoTrilhaDoItem } from '../logica/rotina.js';

export const ROTULO_CONCLUIDO = 'Concluído';
export const TITULO_CONCLUIDO = 'Parabéns, campeão';
export const TEXTO_DESCANSO = 'Hoje é dia de descanso';
export const PERGUNTA_HOJE = 'Tem certeza que quer fazer esse treino hoje?';
// Pergunta do ↻: "Refazer o treino A do zero?" (a letra vem do nome do dia, "A · Empurrar").
export const perguntaRefazer = (sessao) => `Refazer o treino ${letraDoTreino(sessao)} do zero?`;

function letraDoTreino(sessao) {
  const nome = String((sessao && sessao.nome) || '');
  const letra = nome.includes(' · ') ? nome.split(' · ')[0].trim() : '';
  return letra || String((sessao && sessao.diaId) || '').toUpperCase() || nome;
}

// Botões "Não" (laranja, destaque, fecha) e "Sim" (preto) dos diálogos de confirmação do Hoje.
function botoesNaoSim(aoNao, aoSim) {
  return h('div', { class: 'hoje-confirmar-botoes' },
    h('button', { type: 'button', class: 'botao botao-destaque', onclick: aoNao }, 'Não'),
    h('button', { type: 'button', class: 'botao botao-escuro', onclick: aoSim }, 'Sim'));
}

export async function render(container, params, { db, catalogo: catalogoDeTeste, agora: agoraDeTeste } = {}) {
  let fecharModal = null;
  const tela = h('div', { class: 'hoje' });
  container.append(tela);

  const fechar = () => {
    if (fecharModal) fecharModal();
    fecharModal = null;
  };

  async function desenhar() {
    const catalogo = catalogoDeTeste || obterCatalogo();
    const agora = agoraDeTeste !== undefined ? agoraDeTeste : Date.now();
    let rotinaId;
    let sessoes = [];
    let progresso = new Map();
    let bancoOk = true;
    try {
      [rotinaId, sessoes, progresso] = await Promise.all([
        lerMeta('rotinaAtualId', db),
        listarSessoes(db),
        lerProgressoTrilhas(db),
      ]);
    } catch (erro) {
      console.error('Hoje: banco indisponível:', erro);
      bancoOk = false;
    }
    const rotina = rotinaId ? catalogo.rotinaPorId.get(rotinaId) : undefined;
    const emAndamento = sessoes
      .filter((s) => s.status === 'andamento')
      .reduce((a, b) => (!a || b.inicio > a.inicio ? b : a), null);
    let seriesFeitas = 0;
    if (emAndamento) {
      try {
        seriesFeitas = (await listarSeriesDaSessao(emAndamento.id, db)).length;
      } catch (erro) {
        console.error('Hoje: não foi possível contar as séries:', erro);
      }
    }

    // Cria a sessão e abre a tela Treino. dados = { rotinaId, diaId, nome, local, itens }.
    // Se já existe uma em andamento (ex.: começada em outra aba), não cria outra e oferece continuar.
    const comecar = async (botao, dados, erroEl) => {
      if (botao) botao.disabled = true;
      erroEl.textContent = '';
      try {
        const { sessao, jaExistia } = await iniciarSessao({ ...dados, versaoDados: catalogo.versaoDados }, {}, db);
        if (jaExistia) {
          if (botao) botao.disabled = false;
          fecharModal = abrirModal({ titulo: 'Treino em andamento', conteudo: avisoJaExiste(sessao) });
          await desenhar();
          return;
        }
        location.hash = `#/treino/${encodeURIComponent(sessao.id)}`;
      } catch (erro) {
        console.error('Hoje: não foi possível começar o treino:', erro);
        erroEl.textContent = 'Não foi possível começar o treino (banco indisponível).';
        if (botao) botao.disabled = false;
      }
    };
    const dadosDoTreino = (treino) => ({
      rotinaId: rotina.id, diaId: treino.dia.id, nome: treino.dia.nome, local: rotina.local, itens: treino.itens,
    });

    // Fora do dia sugerido (descanso, ou o próximo treino depois de já ter treinado hoje): pergunta antes
    // de começar. "Não" (destaque) fecha; "Sim" começa. Sem o botão "Fechar" (o "Não" já fecha).
    const confirmarHoje = (botao, treino, erroEl, proxima) => {
      fecharModal = abrirModal({
        titulo: PERGUNTA_HOJE,
        semFechar: true,
        conteudo: [
          h('p', { class: 'hoje-aviso' }, `Pela sua rotina, o próximo treino é ${textoDataLonga(proxima).toLowerCase()}.`),
          botoesNaoSim(fechar, () => {
            fechar();
            comecar(botao, dadosDoTreino(treino), erroEl);
          }),
        ],
      });
    };

    // ↻: pergunta "Refazer o treino <letra> do zero?"; "Sim" começa o mesmo treino concluído, do zero
    // (nova sessão com os mesmos itens).
    const refazer = (botao, sessao, erroEl) => {
      fecharModal = abrirModal({
        titulo: perguntaRefazer(sessao),
        semFechar: true,
        conteudo: [
          h('p', { class: 'hoje-aviso' }, 'O treino feito continua salvo. Começa um novo, com os mesmos exercícios.'),
          botoesNaoSim(fechar, () => {
            fechar();
            comecar(botao, {
              rotinaId: sessao.rotinaId, diaId: sessao.diaId, nome: sessao.nome, local: sessao.local, itens: sessao.itens,
            }, erroEl);
          }),
        ],
      });
    };

    const escolher = () => {
      fecharModal = abrirModal({
        titulo: 'Escolher rotina',
        conteudo: listaDeRotinas(catalogo, rotina ? rotina.id : null, async (id) => {
          try {
            await gravarMeta('rotinaAtualId', id, db);
          } catch (erro) {
            console.error('Hoje: não foi possível gravar a rotina:', erro);
          }
          fechar();
          await desenhar();
        }),
      });
    };

    limpar(tela);
    delete tela.dataset.situacao;
    tela.append(
      h('p', { class: 'hoje-data' }, textoDataLonga(agora)),
      calendarioSemana(diasTreinadosNaSemana(sessoes, agora), agora),
    );
    if (emAndamento) {
      tela.dataset.situacao = 'andamento';
      tela.append(cartaoEmAndamento(catalogo, emAndamento, seriesFeitas));
    } else if (rotina) {
      const { situacao, proxima, concluida } = situacaoDoHoje({ sessoes, diasPorSemana: rotina.diasPorSemana, agora });
      const treino = treinoDoDia(rotina, sessoes, catalogo, progresso);
      tela.dataset.situacao = situacao;
      if (situacao === 'treino') {
        tela.append(cartaoTreinoDoDia(catalogo, treino, {
          rotulo: 'Treino do dia',
          aoComecar: (botao, erroEl) => comecar(botao, dadosDoTreino(treino), erroEl),
        }));
      } else if (situacao === 'concluido') {
        tela.append(
          cartaoConcluido(concluida, refazer),
          cartaoProximo(catalogo, treino, proxima,
            (botao, erroEl) => confirmarHoje(botao, treino, erroEl, proxima)));
      } else {
        tela.append(
          h('h2', { class: 'hoje-descanso' }, TEXTO_DESCANSO),
          cartaoTreinoDoDia(catalogo, treino, {
            rotulo: `Próximo treino · ${textoDataLonga(proxima)}`,
            descanso: true,
            aoComecar: (botao, erroEl) => confirmarHoje(botao, treino, erroEl, proxima),
          }));
      }
    }
    tela.append(cartaoRotina(catalogo, rotina, bancoOk, escolher));
  }

  await desenhar();
  return fechar;
}

// Rotina atual + "Trocar" (ou "Escolher rotina" quando ainda não há nenhuma).
function cartaoRotina(catalogo, rotina, bancoOk, aoEscolher) {
  if (!bancoOk) {
    return h('section', { class: 'cartao hoje-rotina' },
      h('p', { class: 'hoje-rotulo' }, 'Rotina'),
      h('p', { class: 'hoje-aviso' }, 'Banco indisponível: não dá para ler nem escolher a rotina agora.'));
  }
  if (!rotina) {
    return h('section', { class: 'cartao hoje-rotina' },
      h('p', { class: 'hoje-rotulo' }, 'Rotina'),
      h('p', { class: 'hoje-aviso' }, 'Nenhuma rotina escolhida ainda. Escolha uma das 12 rotinas prontas para ver o treino do dia.'),
      h('button', { type: 'button', class: 'botao botao-destaque hoje-escolher', onclick: aoEscolher }, 'Escolher rotina'));
  }
  return h('section', { class: 'cartao hoje-rotina hoje-rotina-atual' },
    h('div', { class: 'hoje-rotina-texto' },
      h('p', { class: 'hoje-rotulo' }, 'Rotina atual'),
      h('p', { class: 'hoje-rotina-nome' }, nomeRotina(rotina, catalogo))),
    h('button', { type: 'button', class: 'botao', 'aria-label': 'Trocar rotina', onclick: aoEscolher }, 'Trocar'));
}

// Lista de exercícios do card (nome, trilha com o nível, séries × alvo).
function listaDeItens(catalogo, itens) {
  return h('ol', { class: 'hoje-itens' },
    itens.map((item) => {
      const exercicio = catalogo.exercicioPorId.get(item.exercicioId);
      const trilha = textoTrilhaDoItem(item, catalogo);
      return h('li', { class: 'hoje-item' },
        h('span', { class: 'hoje-item-texto' },
          h('span', { class: 'hoje-item-nome' }, exercicio ? exercicio.nome : item.exercicioId),
          trilha ? h('span', { class: 'hoje-item-trilha' }, trilha) : null),
        h('span', { class: 'hoje-item-alvo' }, textoAlvo(item, exercicio ? exercicio.tipo : null)));
    }));
}

// Card do treino em andamento: o que foi começado (mesmo que a rotina tenha mudado) e "Continuar treino".
function cartaoEmAndamento(catalogo, sessao, seriesFeitas) {
  return h('section', { class: 'cartao hoje-treino', 'aria-labelledby': 'hoje-treino-titulo' },
    h('p', { class: 'hoje-rotulo' }, 'Treino em andamento'),
    h('h2', { class: 'hoje-treino-nome', id: 'hoje-treino-titulo' }, sessao.nome),
    h('p', { class: 'hoje-aviso' }, `${seriesFeitas} ${seriesFeitas === 1 ? 'série registrada' : 'séries registradas'}. Termine este treino antes de começar outro.`),
    listaDeItens(catalogo, sessao.itens),
    h('a', { class: 'botao botao-destaque botao-grande', href: `#/treino/${encodeURIComponent(sessao.id)}` }, 'Continuar treino'));
}

// Conteúdo do modal quando já existe um treino em andamento.
function avisoJaExiste(sessao) {
  return [
    h('p', { class: 'hoje-aviso' }, `Já existe um treino em andamento (${sessao.nome}). Só dá para ter um por vez: continue esse treino.`),
    h('a', { class: 'botao botao-destaque botao-grande', href: `#/treino/${encodeURIComponent(sessao.id)}` }, 'Continuar treino'),
  ];
}

// Card do treino do dia: rótulo, nome do dia, exercícios com séries × alvo e o botão grande "Começar treino".
// Situação 1: rótulo "Treino do dia", botão laranja. Situação 3 (descanso = true): rótulo "Próximo treino ·
// <data>", card e botão sem laranja; o botão fica preso acima da barra de abas enquanto o card aparece
// (.hoje-comecar-fixo); o toque pergunta antes de começar (aoComecar decide).
function cartaoTreinoDoDia(catalogo, treino, { rotulo, descanso = false, aoComecar }) {
  const { dia, itens } = treino;
  const erroEl = h('p', { class: 'hoje-aviso hoje-erro', role: 'alert' });
  const botao = h('button', {
    type: 'button',
    class: `botao botao-grande ${descanso ? 'botao-escuro hoje-comecar-fixo' : 'botao-destaque'}`,
    onclick: () => aoComecar(botao, erroEl),
  }, 'Começar treino');
  return h('section', { class: `cartao hoje-treino${descanso ? ' hoje-treino-descanso' : ''}`, 'aria-labelledby': 'hoje-treino-titulo' },
    h('p', { class: 'hoje-rotulo' }, rotulo),
    h('h2', { class: 'hoje-treino-nome', id: 'hoje-treino-titulo' }, dia.nome),
    listaDeItens(catalogo, itens),
    botao,
    erroEl,
  );
}

// Situação 2: card compacto do treino concluído hoje. Foguinho, "CONCLUÍDO" pequeno, "Parabéns, campeão"
// grande e a frase do treino em cinza (tocar abre o resumo); à direita, ↻ refaz o mesmo treino do zero.
function cartaoConcluido(sessao, aoRefazer) {
  const frase = fraseDaSessao(sessao);
  const erroEl = h('p', { class: 'hoje-aviso hoje-erro', role: 'alert' });
  const botao = h('button', {
    type: 'button',
    class: 'hoje-refazer',
    'aria-label': `Refazer o treino ${sessao.nome} do zero`,
    title: 'Refazer este treino do zero',
    onclick: () => aoRefazer(botao, sessao, erroEl),
  }, '↻');
  return h('section', { class: 'cartao hoje-concluido', 'data-sessao': sessao.id },
    h('div', { class: 'hoje-concluido-linha' },
      h('span', { class: 'hoje-fogo', 'aria-hidden': 'true' }, foguinho()),
      h('a', {
        class: 'hoje-concluido-texto',
        href: `#/evolucao/treino/${encodeURIComponent(sessao.id)}`,
        'aria-label': `${ROTULO_CONCLUIDO}. ${TITULO_CONCLUIDO}. ${frase} Ver o resumo de ${sessao.nome}.`,
      },
        h('span', { class: 'hoje-concluido-rotulo' }, ROTULO_CONCLUIDO),
        h('span', { class: 'hoje-concluido-titulo' }, TITULO_CONCLUIDO),
        h('span', { class: 'hoje-concluido-frase' }, frase)),
      botao),
    erroEl);
}

// Situação 2: linha compacta "Próximo treino · B · Puxar · Sexta, 23 de outubro" com › à direita. Tocar abre
// (e fecha) o card completo do próximo treino logo abaixo: exercícios e "Começar treino" (sem laranja; o
// toque pergunta antes de começar, aoComecar decide).
function cartaoProximo(catalogo, treino, proxima, aoComecar) {
  const { dia, itens } = treino;
  const erroEl = h('p', { class: 'hoje-aviso hoje-erro', role: 'alert' });
  const comecar = h('button', {
    type: 'button',
    class: 'botao botao-grande botao-escuro hoje-comecar-fixo',
    onclick: () => aoComecar(comecar, erroEl),
  }, 'Começar treino');
  const corpo = h('div', { class: 'hoje-proximo-corpo', id: 'hoje-proximo-corpo' },
    listaDeItens(catalogo, itens),
    comecar,
    erroEl);
  corpo.hidden = true;
  const secao = h('section', { class: 'cartao hoje-proximo' });
  const linha = h('button', {
    type: 'button',
    class: 'hoje-proximo-linha',
    'aria-expanded': 'false',
    'aria-controls': 'hoje-proximo-corpo',
    onclick: () => {
      const abrir = corpo.hidden;
      corpo.hidden = !abrir;
      linha.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      secao.classList.toggle('aberto', abrir);
    },
  },
    h('span', { class: 'hoje-proximo-texto' },
      h('span', { class: 'hoje-proximo-rotulo' }, 'Próximo treino'), ' · ',
      h('span', { class: 'hoje-proximo-nome' }, dia.nome), ' · ',
      h('span', { class: 'hoje-proximo-data' }, textoDataLonga(proxima))),
    h('span', { class: 'hoje-proximo-seta', 'aria-hidden': 'true' }, '›'));
  secao.append(linha, corpo);
  return secao;
}

// Lista do modal: seções Casa (primeiro) e Academia, cada uma agrupada por objetivo.
function listaDeRotinas(catalogo, atualId, aoEscolher) {
  const opcao = (rotina) => {
    const atual = rotina.id === atualId;
    return h('button', {
      type: 'button',
      class: 'escolha-rotina',
      'aria-pressed': atual ? 'true' : 'false',
      'aria-label': atual ? `${nomeRotina(rotina, catalogo)} (atual)` : nomeRotina(rotina, catalogo),
      onclick: (ev) => {
        ev.currentTarget.disabled = true;
        aoEscolher(rotina.id);
      },
    }, `${rotina.diasPorSemana} dias por semana`, atual ? h('span', { class: 'escolha-atual' }, 'Atual') : null);
  };

  return rotinasParaEscolha(catalogo).map((secao) =>
    h('section', { class: 'escolha-local', 'aria-label': secao.nome },
      h('h3', { class: 'escolha-local-nome' }, secao.nome),
      secao.objetivos.map(({ objetivo, rotinas }) =>
        h('div', { class: 'escolha-objetivo' },
          h('p', { class: 'escolha-objetivo-nome' }, objetivo.nome),
          h('div', { class: 'escolha-opcoes' }, rotinas.map(opcao))))));
}
