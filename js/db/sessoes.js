// sessoes.js: treinos na store sessoes (PROJETO.md, seção 4.2, "sessoes").
// Etapa 12: só a leitura (o Hoje usa para o calendário da semana e o treino do dia).
// Iniciar, em andamento, descanso, finalizar e descartar entram na etapa 13 e seguintes.
// db é opcional: sem ele usa a conexão do app (os testes passam um banco separado).

import { obterBanco } from './conexao.js';

// Todas as sessões, em ordem de início (índice por_inicio).
export async function listarSessoes(db) {
  const banco = db || await obterBanco();
  return banco.getAllFromIndex('sessoes', 'por_inicio');
}
