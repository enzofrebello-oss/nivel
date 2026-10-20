// ajustes.js: tela Ajustes (#/ajustes), aberta pela engrenagem do Hoje.
// Etapa 11: cartão Backup. "Exportar backup" gera nivel-backup-AAAA-MM-DD.json (compartilhar ou baixar)
// e grava meta.ultimoBackup; "Importar backup" lê o arquivo, valida, mostra a prévia e só substitui
// tudo depois da confirmação. Mostra a data do último backup. O título fica só no topo (roteador).
// O resto da tela (armazenamento, versões, "Procurar atualização") entra na etapa 23.
import { h, limpar } from '../ui/dom.js';
import { obterCatalogo } from '../catalogo.js';
import { lerMeta, gravarMeta } from '../db/meta.js';
import { conciliarVersaoDados } from '../db/trilhas.js';
import {
  exportarBackup, backupParaTexto, nomeArquivoBackup, entregarBackup,
  lerBackup, importarBackup, textoResumo, mensagemDownload,
} from '../db/backup.js';

const formatoData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export async function render(container) {
  const cartao = h('section', { class: 'cartao backup', 'aria-labelledby': 'backup-titulo' });
  container.append(cartao);
  await desenharBackup(cartao);
}

async function desenharBackup(cartao, aviso = null) {
  let ultimo;
  let bancoOk = true;
  try {
    ultimo = await lerMeta('ultimoBackup');
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
        const backup = await exportarBackup({ versaoDados: obterCatalogo().versaoDados });
        const nome = nomeArquivoBackup();
        const como = await entregarBackup(backupParaTexto(backup), nome);
        if (como === 'cancelado') {
          mostrar('Backup cancelado.');
        } else {
          await gravarMeta('ultimoBackup', Date.now());
          await redesenhar(cartao, {
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
    const catalogo = obterCatalogo();
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
          const resumo = await importarBackup(lido.backup, catalogo);
          await conciliarVersaoDados(catalogo); // o backup pode ser de outra versão dos dados
          await redesenhar(cartao, { texto: `Backup restaurado: ${textoResumo(resumo)}.`, tipo: 'ok' });
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

async function redesenhar(cartao, aviso) {
  limpar(cartao);
  await desenharBackup(cartao, aviso);
}
