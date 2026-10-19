// app.js: ponto de entrada do app (ES module).
// Etapa 2: inicia o roteador hash, que desenha as telas dentro de <main id="app">.
// Catálogo, banco e service worker entram nas etapas seguintes (PROJETO.md, seção 6).

import { iniciar } from './roteador.js';

iniciar(document.getElementById('app'));
