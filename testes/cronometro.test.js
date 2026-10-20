// cronometro.test.js: testes de js/logica/cronometro.js (PROJETO.md, etapa 13b).
// Contagem regressiva pelo relógio (sem esperar de verdade: os instantes são números fixos),
// pausar e continuar, zerar, arredondamento e tempo inválido.

import { teste, igual, lanca } from './mini-teste.js';
import {
  novoCronometro, rodando, restanteMs, segundosRestantes, zerou, iniciar, pausar,
} from '../js/logica/cronometro.js';

teste('cronômetro: novo começa parado com o tempo inteiro', () => {
  const c = novoCronometro(45);
  igual(rodando(c), false);
  igual(segundosRestantes(c, 999999), 45, 'parado não desconta');
  igual(zerou(c, 0), false);
});

teste('cronômetro: tempo inválido é recusado', () => {
  lanca(() => novoCronometro(0));
  lanca(() => novoCronometro(-5));
  lanca(() => novoCronometro(2.5));
  lanca(() => novoCronometro('30'));
});

teste('cronômetro: conta para baixo pelo relógio', () => {
  const c = iniciar(novoCronometro(30), 1000);
  igual(rodando(c), true);
  igual(segundosRestantes(c, 1000), 30);
  igual(segundosRestantes(c, 11000), 20);
  igual(restanteMs(c, 11500), 19500);
});

teste('cronômetro: arredonda para cima (0,2 s restante mostra 1)', () => {
  const c = iniciar(novoCronometro(10), 0);
  igual(segundosRestantes(c, 9800), 1);
  igual(zerou(c, 9800), false);
});

teste('cronômetro: zera no fim e não fica negativo', () => {
  const c = iniciar(novoCronometro(10), 0);
  igual(zerou(c, 10000), true);
  igual(segundosRestantes(c, 10000), 0);
  igual(restanteMs(c, 60000), 0, 'muito depois (tela bloqueada)');
});

teste('cronômetro: pausar congela o tempo e continuar retoma de onde parou', () => {
  let c = iniciar(novoCronometro(60), 0);
  c = pausar(c, 15000);
  igual(rodando(c), false);
  igual(segundosRestantes(c, 15000), 45);
  igual(segundosRestantes(c, 100000), 45, 'pausado não desconta');
  c = iniciar(c, 100000);
  igual(segundosRestantes(c, 110000), 35);
  igual(zerou(c, 145000), true);
});

teste('cronômetro: iniciar rodando e pausar parado não mudam nada', () => {
  const c = iniciar(novoCronometro(20), 0);
  igual(iniciar(c, 5000), c);
  const p = novoCronometro(20);
  igual(pausar(p, 5000), p);
});

teste('cronômetro: zerado não reinicia', () => {
  let c = pausar(iniciar(novoCronometro(5), 0), 9000);
  igual(zerou(c, 9000), true);
  igual(rodando(iniciar(c, 9000)), false);
});

teste('cronômetro: o total fica guardado (valor da série registrada)', () => {
  const c = pausar(iniciar(novoCronometro(40), 0), 10000);
  igual(c.total, 40);
});
