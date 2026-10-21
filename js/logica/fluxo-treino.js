// fluxo-treino.js: regras do fluxo da tela Treino (PROJETO.md, etapa 13b). Funções puras, sem DOM nem banco.
// - Exercício "concluído" = séries registradas ≥ séries pedidas no item.
// - Ao abrir: o primeiro exercício pendente; tudo feito = o último.
// - Ao registrar a série que completa o pedido (exatamente a última pedida), avança para o próximo
//   exercício pendente (em ciclo, depois do atual); sem pendentes, vai para o último exercício.
//   Séries extras (além do pedido) não avançam.
// - Modo final: no último exercício, já concluído, a tela mostra só "Anterior" e "Finalizar treino"
//   (etapa 16; na 13b era "Sair").
// - Etapa 16: pendentes = exercícios que ainda não têm as séries pedidas (a confirmação do Finalizar).
// contagens = séries registradas por item, na mesma ordem de itens.
import { CAMPOS, formatarCampo } from './tipos.js';

export function concluido(item, feitas) {
  return feitas >= item.series;
}

export function indiceInicial(itens, contagens) {
  if (!itens.length) return -1;
  const i = itens.findIndex((item, k) => !concluido(item, contagens[k] || 0));
  return i === -1 ? itens.length - 1 : i;
}

// Próximo exercício pendente depois de `indice`, dando a volta na lista; -1 se não há outro pendente.
export function proximoPendente(itens, contagens, indice) {
  for (let passo = 1; passo < itens.length; passo++) {
    const i = (indice + passo) % itens.length;
    if (!concluido(itens[i], contagens[i] || 0)) return i;
  }
  return -1;
}

// Depois de registrar uma série no item `indice` (contagens já inclui a série nova).
// Devolve o índice para onde ir, ou null se fica no mesmo exercício.
export function aposRegistrar(itens, contagens, indice) {
  const item = itens[indice];
  if (!item || (contagens[indice] || 0) !== item.series) return null;
  const proximo = proximoPendente(itens, contagens, indice);
  if (proximo !== -1) return proximo;
  const ultimo = itens.length - 1;
  return indice === ultimo ? null : ultimo;
}

export function modoFinal(itens, contagens, indice) {
  const ultimo = itens.length - 1;
  return indice === ultimo && ultimo >= 0 && concluido(itens[ultimo], contagens[ultimo] || 0);
}

// Texto curto da bolinha: carga "60×10", corpo "15", tempo "0:50".
export function textoBolinha(serie) {
  const campos = CAMPOS[serie.tipo] || [];
  return campos.map((campo) => formatarCampo(campo, serie[campo])).join('×');
}

// Etapa 16: índices dos itens ainda não concluídos (vazio = treino completo; Finalizar sem confirmação).
export function pendentes(itens, contagens) {
  const lista = [];
  itens.forEach((item, i) => {
    if (!concluido(item, contagens[i] || 0)) lista.push(i);
  });
  return lista;
}
