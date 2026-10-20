// migracoes.js: migrações numeradas do banco (PROJETO.md, seção 2, "Migrações do schema", e seção 4.2).
// Cada migração recebe (db, tx) dentro da transação de upgrade do idb.
// Migrações publicadas NUNCA são editadas, só acrescentadas (2, 3, ...).
// DB_VERSAO = maior chave.

export const migracoes = Object.freeze({
  // 1: cria as 4 stores e seus índices.
  1(db) {
    const sessoes = db.createObjectStore('sessoes', { keyPath: 'id' });
    sessoes.createIndex('por_inicio', 'inicio');
    sessoes.createIndex('por_status', 'status');

    const series = db.createObjectStore('series', { keyPath: 'id' });
    series.createIndex('por_sessao', 'sessaoId');
    series.createIndex('por_exercicio', ['exercicioId', 'feitaEm']);

    db.createObjectStore('trilhas', { keyPath: 'trilhaId' });

    db.createObjectStore('meta', { keyPath: 'chave' });
  },
});

export const DB_VERSAO = Math.max(...Object.keys(migracoes).map(Number));
