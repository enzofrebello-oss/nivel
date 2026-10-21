// ajustes.js: tela Ajustes (#/ajustes), aberta pela engrenagem do Hoje.
// Etapa 11: cartão Backup. "Exportar backup" gera nivel-backup-AAAA-MM-DD.json (compartilhar ou baixar)
// e grava meta.ultimoBackup; "Importar backup" lê o arquivo, valida, mostra a prévia e só substitui
// tudo depois da confirmação. Mostra a data do último backup. O título fica só no topo (roteador).
// O resto da tela (armazenamento, versões, "Procurar atualização") entra na etapa 23.
// Etapa 15b: cartão "Nível de cada trilha": as 15 trilhas (as de casa primeiro) com o nível atual de cada
// uma; tocar abre a lista dos níveis (exercício e meta) e escolher um grava o nível atual na store trilhas
// (db/trilhas.js, definirNivelAtual). Dá para trocar a qualquer hora, inclusive para um nível mais fácil.
// render aceita um 3º parâmetro opcional { db, catalogo } (só os testes, como a tela Treino).
import { h, limpar } from '../ui/dom.js';
import { abrirModal, toast } from '../ui/componentes.js';
import { obterCatalogo } from '../catalogo.js';
import { lerMeta, gravarMeta } from '../db/meta.js';
import { conciliarVersaoDados, lerProgressoTrilhas, definirNivelAtual } from '../db/trilhas.js';
import { sessaoEmAndamento } from '../db/sessoes.js';
import { trilhasParaAjuste, textoNivel, textoMeta } from '../logica/rotina.js';
import {
  exportarBackup, backupParaTexto, nomeArquivoBackup, entregarBackup,
  lerBackup, importarBackup, textoResumo, mensagemDownload,
} from '../db/backup.js';

const formatoData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export async function render(container, params, { db, catalogo: catalogoDeTeste } = {}) {
  const ctx = { db, catalogo: () => catalogoDeTeste || obterCatalogo(), fecharModal: null };
  const cartao = h('section', { class: 'cartao backup', 'aria-labelledby': 'backup-titulo' });
  const cartaoTrilhas = h('section', { class: 'cartao niveis', 'aria-labelledby': 'niveis-titulo' });
  container.append(cartao, cartaoTrilhas);
  await Promise.all([desenharBackup(ctx, cartao), desenharTrilhas(ctx, cartaoTrilhas)]);
  return () => {
    if (ctx.fecharModal) ctx.fecharModal();
  };
}

async function desenharBackup(ctx, cartao, aviso = null) {
  const { db } = ctx;
  let ultimo;
  let bancoOk = true;
  try {
    ultimo = await lerMeta('ultimoBackup', db);
  } catch (erro) {
    console.error('Backup: banco indisponível:', erro);
    bancoOk = false;
  }

  const mensagem = h('p', { class: 'backup-mensagem', role: 'status' });
  const mostrar = (texto, tipo = '') => {
    mensagem.textContent = texto;
    mensagem.className = `backup-mensagem ${tipo}`;
  };
  if (aviso) mostrar(aviso.texto, aviso.tipo);

  const entrada = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  const previa = h('div', { class: 'backup-previa' });

  const botaoExportar = h('button', {
    type: 'button',
    class: 'botao botao-destaque',
    disabled: !bancoOk,
    onclick: async () => {
      botaoExportar.disabled = true;
      mostrar('Gerando backup…');
      try {
        const backup = await exportarBackup({ versaoDados: ctx.catalogo().versaoDados }, db);
        const nome = nomeArquivoBackup();
        const como = await entregarBackup(backupParaTexto(backup), nome);
        if (como === 'cancelado') {
          mostrar('Backup cancelado.');
        } else {
          await gravarMeta('ultimoBackup', Date.now(), db);
          await redesenhar(ctx, cartao, {
            texto: como === 'compartilhado' ? `Backup ${nome} compartilhado.` : mensagemDownload(nome),
            tipo: 'ok',
          });
          return;
        }
      } catch (erro) {
        console.error('Exportar backup falhou:', erro);
        mostrar('Não foi possível gerar o backup.', 'erro');
      }
      botaoExportar.disabled = false;
    },
  }, 'Exportar backup');

  const botaoImportar = h('button', {
    type: 'button',
    class: 'botao',
    disabled: !bancoOk,
    onclick: () => entrada.click(),
  }, 'Importar backup');

  entrada.addEventListener('change', async () => {
    const arquivo = entrada.files && entrada.files[0];
    entrada.value = ''; // permite escolher o mesmo arquivo de novo
    limpar(previa);
    if (!arquivo) return;
    let texto;
    try {
      texto = await arquivo.text();
    } catch {
      mostrar('Não foi possível ler o arquivo.', 'erro');
      return;
    }
    const catalogo = ctx.catalogo();
    const lido = lerBackup(texto, catalogo);
    if (!lido.ok) {
      mostrar(`Backup recusado: ${lido.erros[0]}`, 'erro');
      if (lido.erros.length > 1) console.warn('Backup recusado:', lido.erros);
      return;
    }
    mostrar('');
    const exportado = Number.isFinite(lido.backup.exportadoEm) ? ` de ${formatoData.format(lido.backup.exportadoEm)}` : '';
    const confirmar = h('button', {
      type: 'button',
      class: 'botao botao-perigo',
      onclick: async () => {
        confirmar.disabled = true;
        try {
          const resumo = await importarBackup(lido.backup, catalogo, db);
          await conciliarVersaoDados(catalogo, db); // o backup pode ser de outra versão dos dados
          await redesenhar(ctx, cartao, { texto: `Backup restaurado: ${textoResumo(resumo)}.`, tipo: 'ok' });
        } catch (erro) {
          console.error('Importar backup falhou:', erro);
          limpar(previa);
          mostrar(`Nada foi alterado: ${erro && erro.message ? erro.message : erro}`, 'erro');
        }
      },
    }, 'Substituir tudo');
    previa.append(
      h('p', { class: 'backup-previa-texto' }, `Backup${exportado}: ${textoResumo(lido.resumo)}.`),
      h('p', { class: 'backup-previa-aviso' }, 'Importar apaga todos os dados atuais deste aparelho e coloca os do backup no lugar.'),
      h('div', { class: 'backup-botoes' },
        confirmar,
        h('button', { type: 'button', class: 'botao', onclick: () => limpar(previa) }, 'Cancelar')),
    );
  });

  cartao.append(
    h('h3', { class: 'cartao-titulo', id: 'backup-titulo' }, 'Backup'),
    h('p', { class: 'backup-texto' }, 'Seus treinos ficam só neste aparelho. Exporte um backup de vez em quando e guarde o arquivo fora do celular.'),
    h('p', { class: 'backup-ultimo' },
      'Último backup: ',
      h('strong', null, !bancoOk ? 'banco indisponível' : (ultimo ? formatoData.format(ultimo) : 'nunca'))),
    h('div', { class: 'backup-botoes' }, botaoExportar, botaoImportar),
    entrada,
    previa,
    mensagem,
  );
}

async function redesenhar(ctx, cartao, aviso) {
  limpar(cartao);
  await desenharBackup(ctx, cartao, aviso);
  // Importar um backup troca também o nível das trilhas: o outro cartão é redesenhado.
  const trilhas = cartao.parentNode && cartao.parentNode.querySelector('.niveis');
  if (trilhas) {
    limpar(trilhas);
    await desenharTrilhas(ctx, trilhas);
  }
}

// ---------- Nível de cada trilha (etapa 15b) ----------

async function desenharTrilhas(ctx, cartao, aviso = null) {
  const { db } = ctx;
  const catalogo = ctx.catalogo();
  let progresso = new Map();
  let emAndamento = null;
  let bancoOk = true;
  try {
    [progresso, emAndamento] = await Promise.all([lerProgressoTrilhas(db), sessaoEmAndamento(db)]);
  } catch (erro) {
    console.error('Nível das trilhas: banco indisponível:', erro);
    bancoOk = false;
  }

  const mensagem = h('p', { class: 'niveis-mensagem', role: 'status' });
  if (aviso) {
    mensagem.textContent = aviso.texto;
    mensagem.className = `niveis-mensagem ${aviso.tipo}`;
  }

  const escolher = async (linha, exercicioId) => {
    if (ctx.fecharModal) ctx.fecharModal();
    ctx.fecharModal = null;
    let novoAviso;
    try {
      await definirNivelAtual(linha.trilha, exercicioId, {}, db);
      const nivel = linha.trilha.niveis.findIndex((n) => n.exercicio === exercicioId) + 1;
      const exercicio = catalogo.exercicioPorId.get(exercicioId);
      const texto = `${linha.trilha.nome}: nível ${nivel} (${exercicio ? exercicio.nome : exercicioId}).`;
      toast(texto);
      novoAviso = { texto, tipo: 'ok' };
    } catch (erro) {
      console.error('Nível das trilhas: não foi possível gravar:', erro);
      novoAviso = { texto: 'Não foi possível gravar o nível (banco indisponível).', tipo: 'erro' };
    }
    limpar(cartao);
    await desenharTrilhas(ctx, cartao, novoAviso);
  };

  const abrir = (linha) => {
    ctx.fecharModal = abrirModal({
      titulo: linha.trilha.nome,
      conteudo: listaDeNiveis(catalogo, linha, emAndamento, (id) => escolher(linha, id)),
    });
  };

  const linhas = trilhasParaAjuste(catalogo, progresso);
  const grupo = (titulo, itens) => (itens.length === 0 ? null : h('div', { class: 'niveis-grupo' },
    h('p', { class: 'niveis-grupo-nome' }, titulo),
    h('ul', { class: 'niveis-lista' }, itens.map((linha) => h('li', null,
      h('button', {
        type: 'button',
        class: 'niveis-trilha',
        'data-trilha': linha.trilha.id,
        disabled: !bancoOk,
        'aria-label': `${linha.trilha.nome} · ${textoNivel(linha, catalogo)}. Trocar o nível`,
        onclick: () => abrir(linha),
      },
      h('span', { class: 'niveis-trilha-nome' }, linha.trilha.nome),
      h('span', { class: 'niveis-trilha-nivel' }, textoNivel(linha, catalogo))))))));

  cartao.append(
    h('h3', { class: 'cartao-titulo', id: 'niveis-titulo' }, 'Nível de cada trilha'),
    h('p', { class: 'niveis-texto' }, bancoOk
      ? 'O treino do dia usa o nível atual de cada trilha. Toque numa trilha para escolher em que nível ela está; dá para trocar a qualquer hora.'
      : 'Banco indisponível: não dá para ler nem escolher o nível das trilhas agora.'),
    grupo('Casa', linhas.filter((l) => l.deCasa)),
    grupo('Academia', linhas.filter((l) => !l.deCasa)),
    mensagem,
  );
}

// Conteúdo do modal: os níveis da trilha (posição, exercício e meta), com o atual marcado e um ✓ nos
// já concluídos (inclusive acima do atual, depois de voltar para um nível mais fácil).
function listaDeNiveis(catalogo, linha, emAndamento, aoEscolher) {
  const opcoes = linha.trilha.niveis.map((nivel, i) => {
    const exercicio = catalogo.exercicioPorId.get(nivel.exercicio);
    const nome = exercicio ? exercicio.nome : nivel.exercicio;
    const atual = i + 1 === linha.nivel.posicao;
    const meta = textoMeta(nivel.meta);
    const feito = linha.concluidos.has(nivel.exercicio);
    return h('li', null, h('button', {
      type: 'button',
      class: 'escolha-rotina niveis-opcao',
      'data-exercicio': nivel.exercicio,
      'aria-pressed': atual ? 'true' : 'false',
      'aria-label': `Nível ${i + 1}: ${nome}, meta ${meta}${feito ? ', concluído' : ''}${atual ? ' (atual)' : ''}`,
      onclick: (ev) => {
        ev.currentTarget.disabled = true;
        aoEscolher(nivel.exercicio);
      },
    },
    h('span', { class: 'niveis-opcao-nome' }, `${i + 1}. ${nome}`,
      feito ? h('span', { class: 'niveis-feito', 'aria-hidden': 'true', title: 'Concluído' }, ' ✓') : null),
    h('span', { class: 'niveis-opcao-meta' }, `Meta ${meta}`),
    atual ? h('span', { class: 'escolha-atual' }, 'Atual') : null));
  });
  return [
    h('p', { class: 'niveis-texto' }, 'Escolha o nível atual desta trilha. O treino do dia passa a usar o exercício e a meta dele.'),
    emAndamento
      ? h('p', { class: 'niveis-texto niveis-aviso' }, 'O treino em andamento continua com o nível com que começou; a troca vale a partir do próximo treino.')
      : null,
    h('ol', { class: 'niveis-opcoes' }, opcoes),
  ];
}
