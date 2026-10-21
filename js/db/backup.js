// backup.js: backup dos dados do usuário (PROJETO.md, seção 2, "Backup (exportar/importar JSON)", e seção 4.2).
// Etapa 11: exportar todas as stores num objeto JSON; validar um backup (cada registro pelas regras da
// seção 4.2 e todo exercicioId/trilhaId no catálogo); importar substituindo tudo numa única transação;
// nome do arquivo com a data local; entregar o arquivo (navigator.share com arquivo quando der,
// senão download por <a download>).
// db é opcional: sem ele usa a conexão do app (os testes passam um banco separado).

import { obterBanco } from './conexao.js';
import { DB_VERSAO } from './migracoes.js';
import { validarSerie, tipoValido } from '../logica/tipos.js';

export const APP_BACKUP = 'nivel';
export const FORMATO_BACKUP = 1;
// Stores que entram no backup, na ordem do arquivo. Store nova (migração 2+) entra aqui e no formato.
export const STORES_BACKUP = Object.freeze(['sessoes', 'series', 'trilhas', 'meta']);
const CHAVE = { sessoes: 'id', series: 'id', trilhas: 'trilhaId', meta: 'chave' };

const MAX_ERROS = 20; // a lista de erros para aqui (um arquivo muito quebrado não gera milhares)

// ---------- Nome do arquivo ----------

// nivel-backup-AAAA-MM-DD.json com a data LOCAL do aparelho (não a UTC: às 22h no Brasil ainda é hoje).
export function nomeArquivoBackup(data = new Date()) {
  const dois = (n) => String(n).padStart(2, '0');
  return `nivel-backup-${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}.json`;
}

// ---------- Exportar ----------

// Lê todas as stores numa transação só (retrato consistente) e monta o objeto do backup.
// versaoDados = versão do catálogo em uso (catalogo.versaoDados).
export async function exportarBackup({ versaoDados, agora = Date.now() } = {}, db) {
  const banco = db || await obterBanco();
  const tx = banco.transaction([...STORES_BACKUP], 'readonly');
  const listas = await Promise.all(STORES_BACKUP.map((store) => tx.objectStore(store).getAll()));
  await tx.done;
  const dados = {};
  STORES_BACKUP.forEach((store, i) => {
    dados[store] = listas[i];
  });
  return {
    app: APP_BACKUP,
    formato: FORMATO_BACKUP,
    versaoDb: banco.version,
    versaoDados,
    exportadoEm: agora,
    dados,
  };
}

// Texto do arquivo (JSON com 1 espaço de recuo: legível e ainda pequeno).
export function backupParaTexto(backup) {
  return JSON.stringify(backup, null, 1);
}

// ---------- Ler e validar ----------

// Converte o texto do arquivo em objeto e valida. Devolve { ok: true, backup, resumo } ou { ok: false, erros }.
export function lerBackup(texto, catalogo) {
  let objeto;
  try {
    objeto = JSON.parse(texto);
  } catch {
    return { ok: false, erros: ['O arquivo não é um JSON válido. Escolha um backup do Nível (nivel-backup-….json).'] };
  }
  return validarBackup(objeto, catalogo);
}

const ehTexto = (v) => typeof v === 'string' && v.length > 0;
const ehNumero = (v) => typeof v === 'number' && Number.isFinite(v);
const ehInteiro = (v, min) => Number.isInteger(v) && v >= min;
const ehObjeto = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

// Confere o backup inteiro. catalogo = catálogo montado (exercicioPorId, trilhaPorId).
// Devolve { ok: true, backup, resumo } ou { ok: false, erros } (mensagens em pt-BR, prontas para a tela).
export function validarBackup(objeto, catalogo) {
  if (!ehObjeto(objeto) || objeto.app !== APP_BACKUP) {
    return { ok: false, erros: ['Este arquivo não é um backup do Nível.'] };
  }
  if (!Number.isInteger(objeto.formato) || objeto.formato < 1) {
    return { ok: false, erros: ['Backup sem formato válido.'] };
  }
  if (objeto.formato > FORMATO_BACKUP) {
    return { ok: false, erros: ['Este backup foi feito por uma versão mais nova do app. Atualize o app e tente de novo.'] };
  }
  if (!ehObjeto(objeto.dados)) return { ok: false, erros: ['Backup sem a parte "dados".'] };
  const faltando = STORES_BACKUP.filter((store) => !Array.isArray(objeto.dados[store]));
  if (faltando.length) {
    return { ok: false, erros: faltando.map((store) => `Backup sem a lista "${store}".`) };
  }
  // Formatos antigos seriam convertidos aqui antes de validar (só existe o formato 1).

  const erros = [];
  const erro = (texto) => {
    if (erros.length < MAX_ERROS) erros.push(texto);
  };
  const { sessoes, series, trilhas, meta } = objeto.dados;
  const exercicioExiste = (id) => catalogo.exercicioPorId.has(id);
  const trilhaExiste = (id) => catalogo.trilhaPorId.has(id);

  // Chaves únicas e preenchidas em cada store.
  for (const store of STORES_BACKUP) {
    const vistas = new Set();
    objeto.dados[store].forEach((registro, i) => {
      const chave = ehObjeto(registro) ? registro[CHAVE[store]] : undefined;
      if (!ehTexto(chave)) erro(`${store}[${i}]: falta "${CHAVE[store]}".`);
      else if (vistas.has(chave)) erro(`${store}[${i}]: "${chave}" aparece repetido.`);
      else vistas.add(chave);
    });
  }

  // sessoes
  let emAndamento = 0;
  const idsSessoes = new Set();
  sessoes.forEach((s, i) => {
    const onde = `sessoes[${i}]`;
    if (!ehObjeto(s)) return;
    idsSessoes.add(s.id);
    if (s.rotinaId !== null && !ehTexto(s.rotinaId)) erro(`${onde}: rotinaId inválido.`);
    if (s.diaId !== null && !['a', 'b', 'c', 'd'].includes(s.diaId)) erro(`${onde}: diaId inválido.`);
    if (!ehTexto(s.nome)) erro(`${onde}: falta o nome.`);
    if (!['casa', 'academia'].includes(s.local)) erro(`${onde}: local inválido.`);
    if (!ehNumero(s.inicio)) erro(`${onde}: início inválido.`);
    if (!['andamento', 'concluida'].includes(s.status)) erro(`${onde}: status inválido.`);
    if (s.status === 'andamento') {
      emAndamento++;
      if (s.fim !== null) erro(`${onde}: treino em andamento não pode ter fim.`);
    }
    if (s.status === 'concluida' && !ehNumero(s.fim)) erro(`${onde}: treino concluído sem fim.`);
    if (s.descanso !== null && !(ehObjeto(s.descanso) && ehNumero(s.descanso.ate) && ehInteiro(s.descanso.duracao, 1))) {
      erro(`${onde}: descanso inválido.`);
    }
    if (!ehInteiro(s.versaoDados, 1)) erro(`${onde}: versaoDados inválida.`);
    // Etapa 16b: frase motivacional do treino concluído (opcional; backups antigos não têm).
    if (s.frase !== undefined && !ehTexto(s.frase)) erro(`${onde}: frase inválida.`);
    if (!Array.isArray(s.itens)) {
      erro(`${onde}: falta a lista de itens.`);
    } else {
      s.itens.forEach((item, j) => {
        const ondeItem = `${onde}.itens[${j}]`;
        if (!ehObjeto(item)) return erro(`${ondeItem}: item inválido.`);
        if (!exercicioExiste(item.exercicioId)) erro(`${ondeItem}: exercício "${item.exercicioId}" não existe no catálogo.`);
        if (item.trilhaId !== null && !trilhaExiste(item.trilhaId)) erro(`${ondeItem}: trilha "${item.trilhaId}" não existe no catálogo.`);
        if (!ehInteiro(item.series, 1)) erro(`${ondeItem}: número de séries inválido.`);
        if (!ehTexto(item.alvo)) erro(`${ondeItem}: alvo inválido.`);
        if (!ehInteiro(item.descanso, 0)) erro(`${ondeItem}: descanso inválido.`);
        return undefined;
      });
    }
  });
  if (emAndamento > 1) erro('sessoes: há mais de um treino em andamento.');

  // series
  series.forEach((s, i) => {
    const onde = `series[${i}]`;
    if (!ehObjeto(s)) return;
    if (!idsSessoes.has(s.sessaoId)) erro(`${onde}: a sessão "${s.sessaoId}" não está no backup.`);
    if (!exercicioExiste(s.exercicioId)) erro(`${onde}: exercício "${s.exercicioId}" não existe no catálogo.`);
    if (!tipoValido(s.tipo)) {
      erro(`${onde}: tipo inválido.`);
    } else {
      const r = validarSerie(s);
      if (!r.ok) erro(`${onde}: ${r.erro}`);
    }
    if (!Array.isArray(s.grupos) || s.grupos.length === 0 || !s.grupos.every(ehTexto)) erro(`${onde}: grupos inválidos.`);
    if (!ehNumero(s.feitaEm)) erro(`${onde}: feitaEm inválido.`);
  });

  // trilhas
  trilhas.forEach((t, i) => {
    const onde = `trilhas[${i}]`;
    if (!ehObjeto(t)) return;
    if (ehTexto(t.trilhaId) && !trilhaExiste(t.trilhaId)) erro(`${onde}: trilha "${t.trilhaId}" não existe no catálogo.`);
    if (t.exercicioAtualId !== null && !exercicioExiste(t.exercicioAtualId)) {
      erro(`${onde}: exercício "${t.exercicioAtualId}" não existe no catálogo.`);
    }
    if (!Array.isArray(t.concluidos)) {
      erro(`${onde}: falta a lista de concluídos.`);
    } else {
      t.concluidos.forEach((c, j) => {
        const ondeC = `${onde}.concluidos[${j}]`;
        if (!ehObjeto(c)) return erro(`${ondeC}: inválido.`);
        if (!exercicioExiste(c.exercicioId)) erro(`${ondeC}: exercício "${c.exercicioId}" não existe no catálogo.`);
        if (!ehNumero(c.em)) erro(`${ondeC}: data inválida.`);
        if (!['meta', 'manual'].includes(c.como)) erro(`${ondeC}: "como" inválido.`);
        return undefined;
      });
    }
    if (!ehNumero(t.atualizadoEm)) erro(`${onde}: atualizadoEm inválido.`);
  });

  // meta: { chave, valor }
  meta.forEach((m, i) => {
    if (ehObjeto(m) && !('valor' in m)) erro(`meta[${i}]: falta "valor".`);
  });

  if (erros.length) return { ok: false, erros };
  return { ok: true, backup: objeto, resumo: resumirBackup(objeto.dados) };
}

// Números da prévia: treinos (sessões), séries e trilhas em andamento (com nível atual).
export function resumirBackup(dados) {
  return {
    treinos: dados.sessoes.length,
    series: dados.series.length,
    trilhas: dados.trilhas.filter((t) => t.exercicioAtualId !== null).length,
  };
}

// "80 treinos, 1.900 séries, 5 trilhas em andamento".
export function textoResumo({ treinos, series, trilhas }) {
  const n = (v) => v.toLocaleString('pt-BR');
  return `${n(treinos)} ${treinos === 1 ? 'treino' : 'treinos'}, `
    + `${n(series)} ${series === 1 ? 'série' : 'séries'}, `
    + `${n(trilhas)} ${trilhas === 1 ? 'trilha' : 'trilhas'} em andamento`;
}

// ---------- Importar ----------

// Valida e SUBSTITUI tudo: apaga as 4 stores e grava o conteúdo do backup numa única transação
// (atômico: se algo falhar, a transação aborta e nada muda). Lança Error com a 1ª mensagem se o backup
// for inválido. Devolve o resumo do que foi gravado.
export async function importarBackup(objeto, catalogo, db) {
  const validacao = validarBackup(objeto, catalogo);
  if (!validacao.ok) {
    const e = new Error(validacao.erros[0]);
    e.erros = validacao.erros;
    throw e;
  }
  const banco = db || await obterBanco();
  if (banco.version > DB_VERSAO) throw new Error('Banco mais novo que o app: atualize o app.');
  const tx = banco.transaction([...STORES_BACKUP], 'readwrite');
  const feito = tx.done;
  const pedidos = [];
  try {
    for (const store of STORES_BACKUP) {
      const os = tx.objectStore(store);
      pedidos.push(os.clear());
      // put pode lançar na hora (ex.: valor que não se clona); o catch aborta e o clear acima é desfeito.
      for (const registro of objeto.dados[store]) pedidos.push(os.put(registro));
    }
    await Promise.all([...pedidos, feito]);
  } catch (erro) {
    try { tx.abort(); } catch { /* já abortada */ }
    feito.catch(() => {});
    pedidos.forEach((p) => p.catch(() => {}));
    throw erro;
  }
  return validacao.resumo;
}

// ---------- Entregar o arquivo ----------

// Download por <a download>: o link entra no DOM antes do click() (alguns navegadores ignoram
// link solto) e o URL do Blob só é liberado depois de um tempo (o download pode começar depois do click).
export function baixarArquivo(blob, nome) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Mensagem da tela quando o backup cai no download (sem compartilhar).
export function mensagemDownload(nome) {
  return `Backup pronto: ${nome}. Se o navegador pedir, escolha onde salvar; normalmente ele vai para a pasta Downloads.`;
}

// Entrega o backup: navigator.share({ files }) quando o navegador aceita compartilhar o arquivo;
// senão (ou se o share falhar com erro que não seja AbortError) baixa por <a download>.
// AbortError = o usuário fechou a folha de compartilhar: não baixa nada.
// Devolve 'compartilhado', 'baixado' ou 'cancelado'. nav e baixar são trocados nos testes.
export async function entregarBackup(texto, nome, { nav = globalThis.navigator, baixar = baixarArquivo } = {}) {
  const blob = new Blob([texto], { type: 'application/json' });
  let arquivo = null;
  try {
    arquivo = new File([blob], nome, { type: 'application/json' });
  } catch {
    arquivo = null; // navegador sem construtor File
  }
  const podeCompartilhar = arquivo && nav && typeof nav.share === 'function'
    && typeof nav.canShare === 'function' && nav.canShare({ files: [arquivo] });
  if (podeCompartilhar) {
    try {
      await nav.share({ files: [arquivo], title: nome });
      return 'compartilhado';
    } catch (erro) {
      if (erro && erro.name === 'AbortError') return 'cancelado';
      console.warn('Compartilhar falhou; baixando o arquivo:', erro);
    }
  }
  baixar(blob, nome);
  return 'baixado';
}
