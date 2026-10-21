// grafico.js: gráfico de linha compacto em SVG (tela Evolução; PROJETO.md, seção 2, "Gráfico").
// graficoCompacto(pontos, { rotulo }) devolve o <svg>: grade discreta (3 linhas), linha laranja e pontos.
// As coordenadas vêm de logica/evolucao.js (coordenadasDoGrafico): x proporcional à data, y ao valor.
// Cores pelas variáveis do tema (componentes.css, .grafico-*).
import { coordenadasDoGrafico } from '../logica/evolucao.js';

const SVG = 'http://www.w3.org/2000/svg';
const LARGURA = 300;
const ALTURA = 120;
const MARGEM = 12;

function svg(tag, attrs) {
  const el = document.createElementNS(SVG, tag);
  for (const [chave, valor] of Object.entries(attrs)) el.setAttribute(chave, String(valor));
  return el;
}

export function graficoCompacto(pontos, { rotulo = 'Gráfico de evolução' } = {}) {
  const desenho = svg('svg', {
    class: 'grafico-svg',
    viewBox: `0 0 ${LARGURA} ${ALTURA}`,
    role: 'img',
    'aria-label': rotulo,
  });
  for (const y of [MARGEM, ALTURA / 2, ALTURA - MARGEM]) {
    desenho.append(svg('line', { class: 'grafico-grade', x1: 0, x2: LARGURA, y1: y, y2: y }));
  }
  const coords = coordenadasDoGrafico(pontos, { largura: LARGURA, altura: ALTURA, margem: MARGEM });
  if (coords.length > 1) {
    desenho.append(svg('polyline', {
      class: 'grafico-linha',
      points: coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '),
    }));
  }
  for (const c of coords) {
    desenho.append(svg('circle', { class: 'grafico-ponto', cx: c.x.toFixed(1), cy: c.y.toFixed(1), r: 4 }));
  }
  return desenho;
}
