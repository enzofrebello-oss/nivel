// trilhas.js: progresso das trilhas no banco (PROJETO.md, seção 4.2, "trilhas" e "Versões e migração").
// Etapa 9: conciliação com versaoDados. Etapa 12: lerProgressoTrilhas (o Hoje resolve os itens de trilha
// do treino do dia). Avançar e definir nível entram na etapa 18.

import { obterBanco } from './conexao.js';

// Progresso de todas as trilhas: Map trilhaId → registro da store trilhas.
// Trilha sem registro não aparece (= nível 1 é o atual, seção 4.2).
export async function lerProgressoTrilhas(db) {
  const banco = db || await obterBanco();
  const registros = await banco.getAll('trilhas');
  return new Map(registros.map((r) => [r.trilhaId, r]));
}

// Regra da conciliação para um registro de trilhas (função pura, não grava nada).
// Se exercicioAtualId saiu da trilha do catálogo, passa ao primeiro nível não concluído
// (null se todos estão concluídos). Devolve o registro novo, ou null se não precisa mudar.
// Trilha concluída (exercicioAtualId null) e trilha que não está no catálogo ficam como estão.
export function reposicionarTrilha(registro, trilha, agora = Date.now()) {
  if (!trilha || registro.exercicioAtualId === null) return null;
  const niveis = trilha.niveis.map((nivel) => nivel.exercicio);
  if (niveis.includes(registro.exercicioAtualId)) return null;
  const concluidos = new Set((registro.concluidos || []).map((c) => c.exercicioId));
  const proximo = niveis.find((id) => !concluidos.has(id));
  return { ...registro, exercicioAtualId: proximo === undefined ? null : proximo, atualizadoEm: agora };
}

// Ao abrir o app: se catalogo.versaoDados ≠ meta.versaoDadosVista, reposiciona as trilhas
// e grava a nova versaoDadosVista, tudo numa transação só (trilhas + meta).
// Devolve { mudou, ajustadas } (mudou = a versão vista era outra; ajustadas = trilhas reposicionadas).
export async function conciliarVersaoDados(catalogo, db) {
  const banco = db || await obterBanco();
  const tx = banco.transaction(['trilhas', 'meta'], 'readwrite');
  const meta = tx.objectStore('meta');
  const trilhas = tx.objectStore('trilhas');

  const vista = await meta.get('versaoDadosVista');
  if (vista && vista.valor === catalogo.versaoDados) {
    await tx.done;
    return { mudou: false, ajustadas: 0 };
  }

  const agora = Date.now();
  let ajustadas = 0;
  for (const registro of await trilhas.getAll()) {
    const novo = reposicionarTrilha(registro, catalogo.trilhaPorId.get(registro.trilhaId), agora);
    if (novo) {
      trilhas.put(novo);
      ajustadas++;
    }
  }
  meta.put({ chave: 'versaoDadosVista', valor: catalogo.versaoDados });
  await tx.done;
  return { mudou: true, ajustadas };
}
