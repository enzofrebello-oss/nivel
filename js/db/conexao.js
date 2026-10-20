// conexao.js: conexão com o IndexedDB (PROJETO.md, seção 2, "Migrações do schema", e seção 4.2).
// openDB do idb (vendorizado) na versão DB_VERSAO. No upgrade roda as migrações de
// versaoAntiga + 1 até versaoNova, em ordem, na mesma transação de upgrade.
// blocked (outra aba com versão antiga impede o upgrade): chama aoBloqueado ("Feche outras abas do app").
// blocking (esta conexão impede o upgrade aberto em outra aba): fecha a conexão e chama aoBloqueando
// ("Recarregue o app").
// Só js/db/* usa este arquivo; as telas passam pelas funções de js/db/*.

import { openDB } from '../../vendor/idb/index.js';
import { migracoes, DB_VERSAO } from './migracoes.js';

export const NOME_BANCO = 'nivel';

// Abre (e cria ou atualiza) um banco. nome muda só nos testes (ex.: 'nivel-teste-db'),
// assim a lógica de abertura e migração é a mesma do app.
export async function abrirBanco({ nome = NOME_BANCO, aoBloqueado, aoBloqueando } = {}) {
  return openDB(nome, DB_VERSAO, {
    upgrade(db, versaoAntiga, versaoNova, tx) {
      for (let v = versaoAntiga + 1; v <= versaoNova; v++) {
        const migracao = migracoes[v];
        if (!migracao) throw new Error(`Migração ${v} não existe`);
        migracao(db, tx);
      }
    },
    blocked() {
      if (aoBloqueado) aoBloqueado();
    },
    blocking(_versaoAtual, _versaoPedida, evento) {
      evento.target.close();
      if (aoBloqueando) aoBloqueando();
    },
  });
}

// ---------- Conexão do app (aberta uma vez na inicialização) ----------

let conexao = null;
let opcoesDoApp = {};
let fechadaPorOutraAba = false;

// Abre o banco real 'nivel' com os avisos da interface. Chamado por js/app.js.
export function iniciarBanco({ aoBloqueado, aoBloqueando } = {}) {
  opcoesDoApp = {
    aoBloqueado,
    aoBloqueando() {
      // A conexão foi fechada para a outra aba atualizar o banco; só recarregar abre de novo.
      fechadaPorOutraAba = true;
      conexao = null;
      if (aoBloqueando) aoBloqueando();
    },
  };
  return obterBanco();
}

// Promise da conexão do app. As funções de js/db/* usam esta quando não recebem um banco.
export function obterBanco() {
  if (fechadaPorOutraAba) return Promise.reject(new Error('Banco atualizado em outra aba: recarregue o app'));
  if (!conexao) {
    conexao = abrirBanco(opcoesDoApp);
    conexao.catch(() => {
      conexao = null; // falhou: a próxima chamada tenta de novo
    });
  }
  return conexao;
}
