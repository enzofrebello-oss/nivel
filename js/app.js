// app.js: ponto de entrada do app (ES module).
// Etapa 4: carrega o catálogo (dados/*.json, validado e congelado) e, se ele estiver certo,
// inicia o roteador hash, que desenha as telas dentro de <main id="app">.
// Se o catálogo falhar, mostra "Dados do app inválidos" e não abre nenhuma tela (nada é gravado).
// Banco e service worker entram nas etapas seguintes (PROJETO.md, seção 6).

import { iniciar } from './roteador.js';
import { iniciarCatalogo } from './catalogo.js';
import { h, limpar } from './ui/dom.js';

const app = document.getElementById('app');

try {
  await iniciarCatalogo();
  iniciar(app);
} catch (erro) {
  console.error('Dados do app inválidos:', erro && erro.erros ? erro.erros : erro);
  mostrarDadosInvalidos(erro);
}

// Tela de erro fatal: sem abas nem engrenagem, porque nenhuma tela funciona sem o catálogo.
function mostrarDadosInvalidos(erro) {
  document.title = 'Dados do app inválidos · Nível';
  const titulo = document.querySelector('.topo-titulo');
  if (titulo) titulo.textContent = 'Nível';
  const engrenagem = document.querySelector('.topo a[href="#/ajustes"]');
  if (engrenagem) engrenagem.hidden = true;
  const abas = document.querySelector('.abas');
  if (abas) abas.hidden = true;

  const erros = erro && Array.isArray(erro.erros) ? erro.erros : [String(erro && erro.message ? erro.message : erro)];
  limpar(app);
  app.append(
    h('section', { class: 'aviso-erro', role: 'alert' },
      h('h2', null, 'Dados do app inválidos'),
      h('p', null, 'O catálogo de exercícios não passou na conferência. O app não abre para não gravar nada errado. Atualize o app ou avise o desenvolvedor.'),
      h('p', { class: 'aviso-erro-detalhe' },
        erros[0],
        erros.length > 1 ? ` (e mais ${erros.length - 1}; lista completa no console)` : null),
    ),
  );
}
