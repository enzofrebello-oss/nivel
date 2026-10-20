// meta.js: chave-valor da store meta (PROJETO.md, seção 4.2, "meta").
// Registro: { chave, valor }. Chaves da v1: ultimoBackup, rotinaAtualId, versaoDadosVista, persistenciaPedida.
// db é opcional: sem ele usa a conexão do app (os testes passam um banco separado).

import { obterBanco } from './conexao.js';

// Valor da chave, ou undefined se não existe.
export async function lerMeta(chave, db) {
  const banco = db || await obterBanco();
  const registro = await banco.get('meta', chave);
  return registro ? registro.valor : undefined;
}

// Grava (cria ou substitui) o valor da chave.
export async function gravarMeta(chave, valor, db) {
  const banco = db || await obterBanco();
  await banco.put('meta', { chave, valor });
}
