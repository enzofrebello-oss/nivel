// hoje.js: tela Hoje (#/). Etapa 12 (PROJETO.md, seção 5 e seção 8 "Telas aprovadas"): Hoje básico.
// - Calendário da semana (seg–dom): só os dias com treino concluído de verdade, lidos da store sessoes.
//   Sem sessões, nenhum dia fica marcado.
// - Rotina atual (meta.rotinaAtualId) com "Trocar": modal com as 12 rotinas, primeiro as de casa,
//   depois as de academia, agrupadas por objetivo. A escolha é gravada no banco e persiste ao recarregar.
// - Card do treino do dia (js/logica/rotina.js) com o botão grande "Começar treino", que cria a sessão
//   (db/sessoes.js, iniciarSessao) e abre a tela Treino.
// Etapa 13: com um treino em andamento, o card mostra esse treino e o botão vira "Continuar treino".
// Começar um segundo treino é impedido: se outra aba já começou um, o modal oferece continuar.
// O título "Hoje" fica só no topo (roteador). Próximo nível, recorde da semana e aviso de backup entram
// na etapa 23; Treino livre na 16c.
// Etapa 15b: o card do treino do dia usa o nível escolhido em Ajustes (store trilhas, lido a cada desenho).
// render aceita um 3º parâmetro opcional { db, catalogo } (só os testes, como a tela Treino).
// Etapa 16 (forma simples; o visual novo é da 16b): com um treino concluído hoje (pelo início, como o
// calendário), aparece o card "Treino concluído" (nome, duração, séries e "Ver resumo") e, abaixo, o
// próximo dia da rotina como "Próximo treino", com "Começar treino".
import { h, limpar } from '../ui/dom.js';
import { abrirModal } from '../ui/componentes.js';
import { calendarioSemana } from '../ui/semana.js';
import { obterCatalogo } from '../catalogo.js';
import { lerMeta, gravarMeta } from '../db/meta.js';
import { listarSessoes, iniciarSessao } from '../db/sessoes.js';
import { listarSeriesDaSessao } from '../db/series.js';
import { lerProgressoTrilhas } from '../db/trilhas.js';
import { diasTreinadosNaSemana, concluidaHoje, textoDuracao } from '../logica/datas.js';
import { nomeRotina, rotinasParaEscolha, treinoDoDia, textoAlvo, textoTrilhaDoItem } from '../logica/rotina.js';

export async function render(container, params, { db, catalogo: catalogoDeTeste } = {}) {
  let fecharModal = null;
  const tela = h('div', { class: 'hoje' });
  container.append(tela);

  async function desenhar() {
    const catalogo = catalogoDeTeste || obterCatalogo();
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
    const feitaHoje = emAndamento ? null : concluidaHoje(sessoes);
    let seriesFeitas = 0;
    if (emAndamento || feitaHoje) {
      try {
        seriesFeitas = (await listarSeriesDaSessao((emAndamento || feitaHoje).id, db)).length;
      } catch (erro) {
        console.error('Hoje: não foi possível contar as séries:', erro);
      }
    }

    // "Começar treino": cria a sessão com os itens do treino do dia. Se já existe uma em andamento
    // (ex.: começada em outra aba), não cria outra e oferece continuar.
    const comecar = async (botao, treino, erroEl) => {
      botao.disabled = true;
      erroEl.textContent = '';
      try {
        const { sessao, jaExistia } = await iniciarSessao({
          rotinaId: rotina.id,
          diaId: treino.dia.id,
          nome: treino.dia.nome,
          local: rotina.local,
          itens: treino.itens,
          versaoDados: catalogo.versaoDados,
        }, {}, db);
        if (jaExistia) {
          botao.disabled = false;
          fecharModal = abrirModal({ titulo: 'Treino em andamento', conteudo: avisoJaExiste(sessao) });
          await desenhar();
          return;
        }
        location.hash = `#/treino/${encodeURIComponent(sessao.id)}`;
      } catch (erro) {
        console.error('Hoje: não foi possível começar o treino:', erro);
        erroEl.textContent = 'Não foi possível começar o treino (banco indisponível).';
        botao.disabled = false;
      }
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
          if (fecharModal) fecharModal();
          fecharModal = null;
          await desenhar();
        }),
      });
    };

    limpar(tela);
    tela.append(
      calendarioSemana(diasTreinadosNaSemana(sessoes)),
      cartaoRotina(catalogo, rotina, bancoOk, escolher),
    );
    if (emAndamento) tela.append(cartaoEmAndamento(catalogo, emAndamento, seriesFeitas));
    else {
      if (feitaHoje) tela.append(cartaoConcluido(feitaHoje, seriesFeitas));
      if (rotina) {
        tela.append(cartaoTreinoDoDia(catalogo, treinoDoDia(rotina, sessoes, catalogo, progresso), comecar,
          feitaHoje ? 'Próximo treino' : 'Treino do dia'));
      }
    }
  }

  await desenhar();
  return () => {
    if (fecharModal) fecharModal();
  };
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

// Etapa 16: card simples do treino concluído hoje (nome, duração, séries) com o link para o resumo.
function cartaoConcluido(sessao, seriesFeitas) {
  return h('section', { class: 'cartao hoje-concluido', 'aria-labelledby': 'hoje-concluido-titulo' },
    h('p', { class: 'hoje-rotulo' }, 'Treino concluído hoje'),
    h('h2', { class: 'hoje-concluido-nome', id: 'hoje-concluido-titulo' }, sessao.nome),
    h('p', { class: 'hoje-aviso hoje-concluido-texto' },
      `${textoDuracao(sessao.fim - sessao.inicio)} · ${seriesFeitas} ${seriesFeitas === 1 ? 'série' : 'séries'}`),
    h('a', { class: 'link-destaque', href: `#/evolucao/treino/${encodeURIComponent(sessao.id)}` }, 'Ver resumo'));
}

// Conteúdo do modal quando já existe um treino em andamento.
function avisoJaExiste(sessao) {
  return [
    h('p', { class: 'hoje-aviso' }, `Já existe um treino em andamento (${sessao.nome}). Só dá para ter um por vez: continue esse treino.`),
    h('a', { class: 'botao botao-destaque botao-grande', href: `#/treino/${encodeURIComponent(sessao.id)}` }, 'Continuar treino'),
  ];
}

// Card do treino do dia: nome do dia, exercícios com séries × alvo e o botão grande "Começar treino".
// rotulo = "Treino do dia", ou "Próximo treino" depois de um treino concluído hoje (etapa 16).
function cartaoTreinoDoDia(catalogo, treino, aoComecar, rotulo = 'Treino do dia') {
  const { dia, itens } = treino;
  const erroEl = h('p', { class: 'hoje-aviso hoje-erro', role: 'alert' });
  const botao = h('button', {
    type: 'button',
    class: 'botao botao-destaque botao-grande',
    onclick: () => aoComecar(botao, treino, erroEl),
  }, 'Começar treino');
  return h('section', { class: 'cartao hoje-treino', 'aria-labelledby': 'hoje-treino-titulo' },
    h('p', { class: 'hoje-rotulo' }, rotulo),
    h('h2', { class: 'hoje-treino-nome', id: 'hoje-treino-titulo' }, dia.nome),
    listaDeItens(catalogo, itens),
    botao,
    erroEl,
  );
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
