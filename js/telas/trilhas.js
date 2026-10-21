// trilhas.js: tela Trilhas (#/trilhas e #/trilhas/:id). PROJETO.md, seções 5 e 8 ("Trilhas"), adiantada
// para antes da etapa 16b.
// - Chips no topo com as trilhas (as de casa primeiro, logica/rotina.js trilhasParaAjuste). A última trilha
//   escolhida fica em meta.trilhaEscolhida (mesmo jeito do meta.rotinaAtualId); #/trilhas/:id abre direto
//   aquela trilha (e também vira a escolhida).
// - "Nível N de M · X concluídos" e o caminho vertical, do último nível (em cima) para o primeiro (embaixo):
//   concluídos em laranja com ✓ (inclusive acima do atual: conquista guardada), o atual com o anel de
//   progresso e um cartão com nome, meta e "seu melhor", os bloqueados tracejados.
// - Anel e "seu melhor" = logica/trilhas.js (seuMelhor, fracaoDoAnel), só com séries reais do banco
//   (sessões concluídas). Sem registro: anel vazio e "Sem registro ainda".
// - Tocar num nível abre o "Como fazer" do exercício (ui/componentes.js) num modal.
// Ainda NÃO tem "Treinar este nível" (etapa 16c) nem o avanço automático (etapa 17/18); o nível atual
// é trocado em Ajustes ("Nível de cada trilha").
// render aceita um 3º parâmetro opcional { db, catalogo } (só os testes, como Ajustes e Treino).
import { h, limpar } from '../ui/dom.js';
import { abrirModal, comoFazer } from '../ui/componentes.js';
import { anel } from '../ui/anel.js';
import { obterCatalogo } from '../catalogo.js';
import { lerMeta, gravarMeta } from '../db/meta.js';
import { lerProgressoTrilhas } from '../db/trilhas.js';
import { listarSessoes } from '../db/sessoes.js';
import { listarSeriesDoExercicio } from '../db/series.js';
import { trilhasParaAjuste, textoMeta } from '../logica/rotina.js';
import {
  seuMelhor, fracaoDoAnel, porcentagemDoAnel, textoSeuMelhor, caminhoDaTrilha,
} from '../logica/trilhas.js';

export const CHAVE_TRILHA_ESCOLHIDA = 'trilhaEscolhida';

export async function render(container, params, { db, catalogo: catalogoDeTeste } = {}) {
  const catalogo = catalogoDeTeste || obterCatalogo();
  const ctx = { db, catalogo, fecharModal: null, desenho: 0 };

  let progresso = new Map();
  let escolhidaSalva;
  let bancoOk = true;
  try {
    [progresso, escolhidaSalva] = await Promise.all([
      lerProgressoTrilhas(db),
      lerMeta(CHAVE_TRILHA_ESCOLHIDA, db),
    ]);
  } catch (erro) {
    console.error('Trilhas: banco indisponível:', erro);
    bancoOk = false;
  }
  ctx.progresso = progresso;
  ctx.bancoOk = bancoOk;

  const linhas = trilhasParaAjuste(catalogo, progresso);
  const existe = (id) => Boolean(id) && catalogo.trilhaPorId.has(id);
  let escolhida = existe(params.id) ? params.id : (existe(escolhidaSalva) ? escolhidaSalva : linhas[0].trilha.id);
  if (bancoOk && params.id && existe(params.id) && params.id !== escolhidaSalva) {
    gravarMeta(CHAVE_TRILHA_ESCOLHIDA, params.id, db).catch((erro) => console.error('Trilhas: não gravou a escolha:', erro));
  }

  const conteudo = h('div', { class: 'trilha' });
  const chips = linhas.map((linha) => h('button', {
    type: 'button',
    class: 'chip',
    'data-trilha': linha.trilha.id,
    'aria-pressed': linha.trilha.id === escolhida ? 'true' : 'false',
    onclick: async (ev) => {
      const id = linha.trilha.id;
      if (id === escolhida) return;
      escolhida = id;
      for (const chip of chips) chip.setAttribute('aria-pressed', chip === ev.currentTarget ? 'true' : 'false');
      if (bancoOk) {
        gravarMeta(CHAVE_TRILHA_ESCOLHIDA, id, db).catch((erro) => console.error('Trilhas: não gravou a escolha:', erro));
      }
      await desenharTrilha(ctx, conteudo, catalogo.trilhaPorId.get(id));
    },
  }, linha.trilha.nome));

  const faixa = h('div', { class: 'chips chips-rolaveis trilhas-chips', role: 'group', 'aria-label': 'Escolher a trilha' }, chips);
  container.append(faixa, conteudo);
  await desenharTrilha(ctx, conteudo, catalogo.trilhaPorId.get(escolhida));

  // A trilha escolhida fica visível na faixa de chips (pode estar lá no fim).
  const ativo = chips.find((c) => c.getAttribute('aria-pressed') === 'true');
  if (ativo && faixa.scrollWidth > faixa.clientWidth) {
    faixa.scrollLeft = Math.max(0, ativo.offsetLeft - faixa.offsetLeft - 16);
  }

  return () => {
    if (ctx.fecharModal) ctx.fecharModal();
  };
}

async function desenharTrilha(ctx, conteudo, trilha) {
  const { db, catalogo } = ctx;
  const meu = ++ctx.desenho;
  const caminho = caminhoDaTrilha(trilha, ctx.progresso.get(trilha.id));
  const atual = caminho.niveis.find((n) => n.estado === 'atual') || null;

  // Seu melhor do nível atual: séries reais do exercício + sessões (para saber quais estão concluídas).
  let melhor = null;
  let leituraOk = ctx.bancoOk;
  if (atual && ctx.bancoOk) {
    try {
      const [series, sessoes] = await Promise.all([listarSeriesDoExercicio(atual.exercicioId, db), listarSessoes(db)]);
      melhor = seuMelhor({ exercicioId: atual.exercicioId, meta: atual.meta, series, sessoes });
    } catch (erro) {
      console.error('Trilhas: não leu as séries:', erro);
      leituraOk = false;
    }
  }
  if (meu !== ctx.desenho) return; // outra trilha foi escolhida no meio da leitura

  const nomeDe = (id) => {
    const exercicio = catalogo.exercicioPorId.get(id);
    return exercicio ? exercicio.nome : id;
  };

  const abrir = (nivel) => {
    const exercicio = catalogo.exercicioPorId.get(nivel.exercicioId);
    if (!exercicio) return;
    if (ctx.fecharModal) ctx.fecharModal();
    ctx.fecharModal = abrirModal({
      titulo: exercicio.nome,
      conteudo: [
        h('p', { class: 'trilha-modal-meta' }, `Nível ${nivel.posicao} de ${caminho.total} · Meta ${textoMeta(nivel.meta)}`),
        comoFazer(exercicio),
        h('a', { class: 'link-destaque trilha-modal-link', href: `#/biblioteca/${encodeURIComponent(exercicio.id)}` }, 'Ver na Biblioteca'),
      ],
    });
  };

  const itens = [...caminho.niveis].reverse().map((nivel) => {
    const nome = nomeDe(nivel.exercicioId);
    const meta = textoMeta(nivel.meta);
    if (nivel.estado === 'atual') {
      const pct = porcentagemDoAnel(melhor);
      const desenhoAnel = anel({
        fracao: fracaoDoAnel(melhor),
        conteudo: h('span', { class: 'trilha-anel-texto' }, melhor ? `${pct}%` : '—'),
      });
      desenhoAnel.elemento.classList.add('trilha-anel');
      return h('li', { class: 'trilha-nivel atual', 'data-exercicio': nivel.exercicioId },
        h('button', {
          type: 'button',
          class: 'trilha-nivel-botao',
          'aria-label': `Nível ${nivel.posicao}, atual: ${nome}. Meta ${meta}. Seu melhor: ${textoSeuMelhor(melhor, nivel.meta)}${melhor ? ` (${pct}%)` : ''}. Abrir como fazer`,
          onclick: () => abrir(nivel),
        },
        h('span', { class: 'trilha-marca' }, desenhoAnel.elemento),
        h('span', { class: 'cartao trilha-cartao' },
          h('span', { class: 'trilha-cartao-rotulo' }, `Nível ${nivel.posicao} · atual`),
          h('span', { class: 'trilha-cartao-nome' }, nome),
          h('span', { class: 'trilha-cartao-linha' }, h('span', { class: 'trilha-cartao-chave' }, 'Meta'), h('strong', null, meta)),
          h('span', { class: 'trilha-cartao-linha' }, h('span', { class: 'trilha-cartao-chave' }, 'Seu melhor'),
            h('strong', { class: melhor ? 'trilha-melhor' : 'trilha-melhor vazio' },
              leituraOk ? textoSeuMelhor(melhor, nivel.meta) : 'Banco indisponível')))));
    }
    const feito = nivel.estado === 'concluido';
    return h('li', { class: `trilha-nivel ${nivel.estado}`, 'data-exercicio': nivel.exercicioId },
      h('button', {
        type: 'button',
        class: 'trilha-nivel-botao',
        'aria-label': `Nível ${nivel.posicao}, ${feito ? 'concluído' : 'bloqueado'}: ${nome}. Meta ${meta}. Abrir como fazer`,
        onclick: () => abrir(nivel),
      },
      h('span', { class: 'trilha-marca' },
        h('span', { class: 'trilha-bolinha', 'aria-hidden': 'true' }, feito ? '✓' : String(nivel.posicao))),
      h('span', { class: 'trilha-texto' },
        h('span', { class: 'trilha-nome' }, nome),
        h('span', { class: 'trilha-detalhe' }, `Nível ${nivel.posicao} · Meta ${meta}${feito ? ' · concluído' : ''}`))));
  });

  const resumo = caminho.concluida
    ? `Trilha concluída · ${caminho.concluidos} de ${caminho.total} níveis`
    : `Nível ${caminho.atual} de ${caminho.total} · ${caminho.concluidos} ${caminho.concluidos === 1 ? 'concluído' : 'concluídos'}`;

  limpar(conteudo);
  // append() escreveria "null" no lugar do aviso que não existe; por isso o filter.
  conteudo.append(...[
    h('h2', { class: 'trilha-titulo' }, trilha.nome),
    h('p', { class: 'trilha-resumo' }, resumo),
    ctx.bancoOk ? null : h('p', { class: 'trilha-aviso' }, 'Banco indisponível: o progresso não pôde ser lido.'),
    h('ol', { class: 'trilha-caminho', 'aria-label': `Níveis da trilha ${trilha.nome}, do último para o primeiro` }, itens),
  ].filter(Boolean));
}
