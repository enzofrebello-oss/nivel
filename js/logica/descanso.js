// descanso.js: regras do modo Descanso da tela Treino (PROJETO.md, etapa 15, seção 5 e seção 8 "Descanso").
// Funções puras, sem DOM nem banco. A contagem é o mesmo cronômetro do exercício de tempo
// (logica/cronometro.js); aqui ficam só as regras do descanso e a conversão para o formato gravado.
// - Depois de registrar uma série, descansa o tempo do item (sessao.itens[i].descanso), inclusive depois
//   da última série de um exercício (o descanso vem antes do próximo exercício).
// - Depois da última série do treino (nenhum exercício pendente), NÃO há descanso.
// - No banco fica sessao.descanso = { ate, duracao }: ate = horário de término (ms), duracao = total (s).
//   O tempo é sempre "ate − agora": continua certo se a aba for minimizada, a tela apagar ou o app recarregar.
import { concluido } from './fluxo-treino.js';
import {
  novoCronometro, iniciar, ajustar, fimEm, retomar,
} from './cronometro.js';

// Só se o item não tiver um descanso válido (dado antigo): o padrão das rotinas.
export const DESCANSO_PADRAO = 90;
export const PASSO_AJUSTE = 15; // segundos do −15 s / +15 s

// Segundos de descanso do item.
export function duracaoDoItem(item) {
  const d = item && item.descanso;
  return Number.isInteger(d) && d >= 1 ? d : DESCANSO_PADRAO;
}

// Depois de registrar (contagens já com a série nova): descansa se ainda falta algum exercício.
export function deveDescansar(itens, contagens) {
  return itens.some((item, k) => !concluido(item, contagens[k] || 0));
}

// Começa um descanso de `segundos` agora (cronômetro rodando).
export function comecarDescanso(segundos, agora) {
  return iniciar(novoCronometro(segundos), agora);
}

// −15 s / +15 s (vezes = -1 ou 1).
export function ajustarDescanso(c, vezes, agora) {
  return ajustar(c, vezes * PASSO_AJUSTE, agora);
}

// Formato gravado em sessao.descanso.
export function paraSalvar(c) {
  return { ate: fimEm(c), duracao: c.total };
}

// Cronômetro a partir do que está gravado; null se não há descanso (ou se o dado é inválido).
export function doSalvo(salvo, agora) {
  if (!salvo || !Number.isFinite(salvo.ate) || !Number.isInteger(salvo.duracao) || salvo.duracao < 1) return null;
  return retomar(salvo.duracao, salvo.ate, agora);
}

// "A seguir" do descanso: nome do exercício e a série que vem (feitas = séries já registradas nele).
// Ex.: "Flexão · série 3 de 4"; além do pedido: "Flexão · série extra 5".
export function textoASeguir(nome, feitas, previstas) {
  const n = feitas + 1;
  return n <= previstas ? `${nome} · série ${n} de ${previstas}` : `${nome} · série extra ${n}`;
}
