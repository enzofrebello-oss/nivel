// hoje.js: tela Hoje (#/). Etapa 12 (PROJETO.md, seção 5 e seção 8 "Telas aprovadas"): Hoje básico.
// - Calendário da semana (seg–dom): só os dias com treino concluído de verdade, lidos da store sessoes.
//   Sem sessões, nenhum dia fica marcado.
// - Rotina atual (meta.rotinaAtualId) com "Trocar": modal com as 12 rotinas, primeiro as de casa,
//   depois as de academia, agrupadas por objetivo. A escolha é gravada no banco e persiste ao recarregar.
// - Card do treino do dia (js/logica/rotina.js) com o botão grande "Começar treino". Até a etapa 13 ele só
//   abre a tela Treino provisória (não cria sessão).
// O título "Hoje" fica só no topo (roteador). Próximo nível, recorde da semana, aviso de backup e
// Treino livre entram nas etapas 16 e 23; "Continuar treino", na etapa 13.
import { h, limpar } from '../ui/dom.js';
import { abrirModal } from '../ui/componentes.js';
import { calendarioSemana } from '../ui/semana.js';
import { obterCatalogo } from '../catalogo.js';
import { lerMeta, gravarMeta } from '../db/meta.js';
import { listarSessoes } from '../db/sessoes.js';
import { lerProgressoTrilhas } from '../db/trilhas.js';
import { diasTreinadosNaSemana } from '../logica/datas.js';
import { nomeRotina, rotinasParaEscolha, treinoDoDia, textoAlvo } from '../logica/rotina.js';

export async function render(container) {
  let fecharModal = null;
  const tela = h('div', { class: 'hoje' });
  container.append(tela);

  async function desenhar() {
    const catalogo = obterCatalogo();
    let rotinaId;
    let sessoes = [];
    let progresso = new Map();
    let bancoOk = true;
    try {
      [rotinaId, sessoes, progresso] = await Promise.all([
        lerMeta('rotinaAtualId'),
        listarSessoes(),
        lerProgressoTrilhas(),
      ]);
    } catch (erro) {
      console.error('Hoje: banco indisponível:', erro);
      bancoOk = false;
    }
    const rotina = rotinaId ? catalogo.rotinaPorId.get(rotinaId) : undefined;

    const escolher = () => {
      fecharModal = abrirModal({
        titulo: 'Escolher rotina',
        conteudo: listaDeRotinas(catalogo, rotina ? rotina.id : null, async (id) => {
          try {
            await gravarMeta('rotinaAtualId', id);
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
    if (rotina) tela.append(cartaoTreinoDoDia(catalogo, treinoDoDia(rotina, sessoes, catalogo, progresso)));
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

// Card do treino do dia: nome do dia, exercícios com séries × alvo e o botão grande "Começar treino".
function cartaoTreinoDoDia(catalogo, { dia, itens }) {
  return h('section', { class: 'cartao hoje-treino', 'aria-labelledby': 'hoje-treino-titulo' },
    h('p', { class: 'hoje-rotulo' }, 'Treino do dia'),
    h('h2', { class: 'hoje-treino-nome', id: 'hoje-treino-titulo' }, dia.nome),
    h('ol', { class: 'hoje-itens' },
      itens.map((item) => {
        const exercicio = catalogo.exercicioPorId.get(item.exercicioId);
        const trilha = item.trilhaId ? catalogo.trilhaPorId.get(item.trilhaId) : null;
        return h('li', { class: 'hoje-item' },
          h('span', { class: 'hoje-item-texto' },
            h('span', { class: 'hoje-item-nome' }, exercicio ? exercicio.nome : item.exercicioId),
            trilha ? h('span', { class: 'hoje-item-trilha' }, `Trilha ${trilha.nome}`) : null),
          h('span', { class: 'hoje-item-alvo' }, textoAlvo(item, exercicio ? exercicio.tipo : null)));
      })),
    // Etapa 12: só abre a tela Treino provisória; a etapa 13 cria a sessão aqui.
    h('a', { class: 'botao botao-destaque botao-grande', href: '#/treino/novo' }, 'Começar treino'),
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
