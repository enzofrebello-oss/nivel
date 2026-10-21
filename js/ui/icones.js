// icones.js: ícones SVG inline compartilhados (PROJETO.md, seção 3). Etapa 16b: o foguinho saiu da tela
// Evolução (cartão de constância) para ser usado também no card de treino concluído do Hoje.

const SVG = 'http://www.w3.org/2000/svg';

// Foguinho (chama), preenchido com a cor do texto (currentColor).
export function foguinho() {
  const desenho = document.createElementNS(SVG, 'svg');
  desenho.setAttribute('viewBox', '0 0 24 24');
  desenho.setAttribute('focusable', 'false');
  const caminho = document.createElementNS(SVG, 'path');
  caminho.setAttribute('d', 'M12 2c1 3.5-1.5 5-1.5 7.5 0 1.2.8 2 1.7 2 1.4 0 2-1.3 1.8-3 2.4 1.6 4 4.2 4 7a6 6 0 0 1-12 0c0-3.6 2.4-6.2 4.3-8.4C11.5 5.6 12.4 4 12 2z');
  caminho.setAttribute('fill', 'currentColor');
  desenho.append(caminho);
  return desenho;
}
