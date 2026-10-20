// fluxo-treino.test.js: testes de js/logica/fluxo-treino.js (PROJETO.md, etapa 13b).
// Avançar sozinho ao registrar a última série pedida, séries extras não avançam, exercício inicial,
// modo final (só "Anterior" e "Sair") e texto das bolinhas. Dados fixos.

import { teste, igual } from './mini-teste.js';
import {
  concluido, indiceInicial, proximoPendente, aposRegistrar, modoFinal, textoBolinha,
} from '../js/logica/fluxo-treino.js';

const itens = [
  { exercicioId: 'a', series: 3 },
  { exercicioId: 'b', series: 2 },
  { exercicioId: 'c', series: 4 },
];

teste('fluxo: concluído = séries feitas ≥ pedidas', () => {
  igual(concluido(itens[0], 2), false);
  igual(concluido(itens[0], 3), true);
  igual(concluido(itens[0], 5), true, 'séries extras');
});

teste('fluxo: exercício inicial = primeiro pendente; tudo feito = o último', () => {
  igual(indiceInicial(itens, [0, 0, 0]), 0);
  igual(indiceInicial(itens, [3, 1, 0]), 1);
  igual(indiceInicial(itens, [3, 2, 0]), 2);
  igual(indiceInicial(itens, [3, 2, 4]), 2, 'tudo feito');
  igual(indiceInicial(itens, []), 0, 'contagens vazias');
  igual(indiceInicial([], []), -1, 'sem itens');
});

teste('fluxo: registrar a última série pedida avança para o próximo', () => {
  igual(aposRegistrar(itens, [3, 0, 0], 0), 1);
  igual(aposRegistrar(itens, [3, 2, 0], 1), 2);
});

teste('fluxo: série que não completa o pedido fica no mesmo exercício', () => {
  igual(aposRegistrar(itens, [1, 0, 0], 0), null);
  igual(aposRegistrar(itens, [2, 0, 0], 0), null);
});

teste('fluxo: série extra (além do pedido) não avança', () => {
  igual(aposRegistrar(itens, [4, 0, 0], 0), null, 'voltou com Anterior e registrou mais uma');
  igual(aposRegistrar(itens, [3, 2, 5], 2), null);
});

teste('fluxo: avança para o próximo pendente, pulando os já feitos', () => {
  igual(aposRegistrar(itens, [3, 2, 0], 0), 2, 'B já feito');
});

teste('fluxo: no fim da lista, dá a volta para um pendente anterior', () => {
  igual(aposRegistrar(itens, [3, 1, 4], 2), 1);
  igual(proximoPendente(itens, [0, 2, 4], 2), 0);
});

teste('fluxo: sem pendentes vai para o último exercício (ou fica nele)', () => {
  igual(aposRegistrar(itens, [3, 2, 4], 2), null, 'já está no último');
  igual(aposRegistrar(itens, [3, 2, 4], 1), 2, 'completou o B com tudo feito: vai para o último');
  igual(proximoPendente(itens, [3, 2, 4], 0), -1);
});

teste('fluxo: treino com um exercício só', () => {
  const um = [{ exercicioId: 'a', series: 2 }];
  igual(aposRegistrar(um, [2], 0), null);
  igual(modoFinal(um, [2], 0), true);
  igual(modoFinal(um, [1], 0), false);
});

teste('fluxo: modo final só no último exercício concluído', () => {
  igual(modoFinal(itens, [3, 2, 4], 2), true);
  igual(modoFinal(itens, [0, 0, 4], 2), true, 'vale mesmo com outros pendentes');
  igual(modoFinal(itens, [3, 2, 3], 2), false, 'último ainda pendente');
  igual(modoFinal(itens, [3, 2, 4], 1), false, 'não está no último');
  igual(modoFinal([], [], 0), false);
});

teste('fluxo: texto das bolinhas por tipo', () => {
  igual(textoBolinha({ tipo: 'corpo', reps: 20 }), '20');
  igual(textoBolinha({ tipo: 'carga', carga: 62.5, reps: 10 }), '62,5×10');
  igual(textoBolinha({ tipo: 'tempo', segundos: 50 }), '0:50');
  igual(textoBolinha({ tipo: 'tempo', segundos: 90 }), '1:30');
});
