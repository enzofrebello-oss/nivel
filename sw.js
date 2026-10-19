// sw.js: service worker do app (PROJETO.md, seção 2, "Service worker e versionamento de cache").
// Etapa 7: precache de todos os arquivos do app no cache nivel-${VERSAO}, cache-first
// para GET do próprio domínio e limpeza dos caches antigos (nivel-* e treino-*) no activate.
// Regra de ouro: todo deploy incrementa VERSAO, e todo arquivo novo entra em ARQUIVOS.
// pesquisa/ e testes/ ficam fora.
// Etapa 8: sem skipWaiting automático. O SW novo fica em "waiting" até o app mandar
// postMessage('SKIP_WAITING') (toque em "Atualizar" no banner "Nova versão disponível").

const VERSAO = 'v4';
const CACHE = `nivel-${VERSAO}`;

// Caminhos relativos ao sw.js (raiz do app), para funcionar também numa subpasta do GitHub Pages.
// testes/sw.test.js lê este array direto do texto do sw.js: manter o formato (um caminho entre aspas simples por item).
const ARQUIVOS = [
  'index.html',
  'manifest.webmanifest',

  'css/base.css',
  'css/componentes.css',

  'js/app.js',
  'js/roteador.js',
  'js/catalogo.js',
  'js/logica/busca.js',
  'js/logica/tipos.js',
  'js/logica/validar-dados.js',
  'js/ui/dom.js',
  'js/ui/componentes.js',
  'js/telas/hoje.js',
  'js/telas/trilhas.js',
  'js/telas/treino.js',
  'js/telas/evolucao.js',
  'js/telas/sessao-detalhe.js',
  'js/telas/exercicio-evolucao.js',
  'js/telas/biblioteca.js',
  'js/telas/exercicio-detalhe.js',
  'js/telas/ajustes.js',

  'dados/exercicios.json',
  'dados/progressoes.json',
  'dados/rotinas.json',

  'fonts/barlow-condensed-600.woff2',
  'fonts/barlow-condensed-700.woff2',
  'fonts/manrope-400.woff2',
  'fonts/manrope-700.woff2',

  'icones/icone.svg',
  'icones/icone-192.png',
  'icones/icone-512.png',
  'icones/icone-maskable-512.png',
  'icones/apple-touch-icon.png',
];

// install: baixa tudo de novo (cache: 'reload' pula o cache HTTP) e grava no cache da versão.
// Se um arquivo falhar, a instalação inteira falha e o SW antigo continua valendo.
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(ARQUIVOS.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

// activate: apaga os caches nivel-* de outras versões e os treino-* do nome antigo (treino-v1).
// Trocar VERSAO substitui tudo de uma vez.
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) => Promise.all(
      nomes
        .filter((nome) => (nome.startsWith('nivel-') || nome.startsWith('treino-')) && nome !== CACHE)
        .map((nome) => caches.delete(nome)),
    )),
  );
});

// message: a única forma de o SW novo assumir. Só o toque em "Atualizar" manda SKIP_WAITING;
// o app recarrega no controllerchange (js/app.js).
self.addEventListener('message', (evento) => {
  if (evento.data === 'SKIP_WAITING') self.skipWaiting();
});

// fetch: cache-first só para GET do próprio domínio; o resto segue direto para a rede.
// Navegações (hash na URL, start_url "./") recebem sempre o index.html do cache.
self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  if (new URL(pedido.url).origin !== self.location.origin) return;

  if (pedido.mode === 'navigate') {
    const indice = new URL('index.html', self.registration.scope).href;
    evento.respondWith(
      caches.match(indice, { cacheName: CACHE }).then((resposta) => resposta || fetch(pedido)),
    );
    return;
  }

  evento.respondWith(
    caches.match(pedido, { cacheName: CACHE }).then((resposta) => resposta || fetch(pedido)),
  );
});
