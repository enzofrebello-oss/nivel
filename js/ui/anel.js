// anel.js: anel de progresso em SVG (PROJETO.md, seção 3; etapa 15 usa no Descanso, as Trilhas usarão depois).
// anel({ fracao, conteudo }) devolve { elemento, atualizar(fracao) }. fracao de 0 (vazio) a 1 (cheio).
// O traço laranja começa no topo e anda no sentido horário; o conteúdo (ex.: o tempo) fica no centro.
// Cores pelas variáveis do tema (componentes.css, .anel).
import { h } from './dom.js';

const SVG = 'http://www.w3.org/2000/svg';
const RAIO = 54;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

function svg(tag, attrs) {
  const el = document.createElementNS(SVG, tag);
  for (const [chave, valor] of Object.entries(attrs)) el.setAttribute(chave, String(valor));
  return el;
}

export function anel({ fracao = 1, conteudo } = {}) {
  const desenho = svg('svg', { class: 'anel-svg', viewBox: '0 0 120 120', 'aria-hidden': 'true', focusable: 'false' });
  desenho.append(
    svg('circle', { class: 'anel-fundo', cx: 60, cy: 60, r: RAIO }),
  );
  const traco = svg('circle', {
    class: 'anel-traco',
    cx: 60,
    cy: 60,
    r: RAIO,
    'stroke-dasharray': CIRCUNFERENCIA.toFixed(2),
    transform: 'rotate(-90 60 60)',
  });
  desenho.append(traco);

  const elemento = h('div', { class: 'anel' }, // o desenho é só visual; o conteúdo do centro é o que se lê
    desenho,
    h('div', { class: 'anel-centro' }, conteudo));

  function atualizar(f) {
    const limitada = Math.min(1, Math.max(0, Number(f) || 0));
    traco.setAttribute('stroke-dashoffset', (CIRCUNFERENCIA * (1 - limitada)).toFixed(2));
  }
  atualizar(fracao);
  return { elemento, atualizar };
}
