// sw.js: service worker do app (PROJETO.md, seção 2, "Service worker e versionamento de cache").
// Etapa 7: precache de todos os arquivos do app no cache nivel-${VERSAO}, cache-first
// para GET do próprio domínio e limpeza dos caches antigos (nivel-* e treino-*) no activate.
// Regra de ouro: todo deploy incrementa VERSAO, e todo arquivo novo entra em ARQUIVOS.
// pesquisa/ e testes/ ficam fora.
// Etapa 8: sem skipWaiting automático. O SW novo fica em "waiting" até o app mandar
// postMessage('SKIP_WAITING') (toque em "Atualizar" no banner "Nova versão disponível").
// Etapa 9: js/db/* e vendor/idb/index.js no precache (LICENSE e README.txt do vendor ficam fora,
// como as licenças das fontes: o app não os carrega). v6: banco renomeado para 'nivel' e aviso de
// falha do banco em js/app.js. v7: o fetch só responde pelo app (raiz/index.html e ARQUIVOS); testes/ e
// pesquisa/ vão direto para a rede (antes /testes/ recebia o index.html do app).
// Etapa 11 (v8 a v10): js/db/backup.js no precache; ajustes.js, backup.js e componentes.css alterados (backup em Ajustes).
// Etapa 12 (v11): js/db/sessoes.js, js/logica/datas.js, js/logica/rotina.js e js/ui/semana.js no precache;
// hoje.js, db/trilhas.js, ui/componentes.js e componentes.css alterados (Hoje básico).
// Etapa 13 (v12): js/db/series.js no precache; treino.js, hoje.js, db/sessoes.js, logica/tipos.js,
// ui/componentes.js e componentes.css alterados (registrar séries).
// Etapa 13b (v13): js/logica/fluxo-treino.js e js/logica/cronometro.js no precache; treino.js, roteador.js,
// ui/componentes.js e componentes.css alterados (fluxo do treino).
// Etapa 14 (v14): js/logica/comparacao.js no precache; treino.js, db/series.js e componentes.css alterados
// (antes / hoje / +1 e pré-preenchimento pela última vez).
// Etapa 14, ajuste (v15): carga sem histórico começa vazia; treino.js, ui/componentes.js,
// logica/comparacao.js e componentes.css alterados (lista do precache igual).
// Etapa 14, ajuste do SW para os testes (v16): pedido feito a partir de uma página dentro de testes/
// (event.clientId, ou event.resultingClientId / a própria URL na navegação) vai sempre para a rede,
// sem ler nem gravar cache. Antes, /testes/ vinha da rede, mas os js/*.js que ela importa estão em
// ARQUIVOS e saíam do cache da versão ativa (código velho nos testes). Lista do precache igual.
// Etapa 15 (v17): js/logica/descanso.js e js/ui/anel.js no precache; treino.js, db/sessoes.js,
// logica/cronometro.js e componentes.css alterados (modo Descanso).
// Etapa 15, ajuste (v18): treino.js sem o toast "Próximo" durante o descanso (lista do precache igual).
// Etapa 15b (v19): nível de cada trilha em Ajustes; ajustes.js, hoje.js, treino.js, db/trilhas.js,
// logica/rotina.js e componentes.css alterados (lista do precache igual).
// Etapa 15b, ajuste (v20): voltar de nível não apaga os concluídos de cima e ✓ nos níveis concluídos;
// db/trilhas.js, logica/rotina.js, ajustes.js e componentes.css alterados (lista do precache igual).
// Etapa 15b, rótulo (v21): "nível N de M" sem quebra de linha no meio (logica/rotina.js; lista do precache igual).
// Etapa 16 (v22): finalizar, descartar e resumo; treino.js, hoje.js, sessao-detalhe.js, db/sessoes.js,
// db/series.js, logica/datas.js, logica/fluxo-treino.js, logica/comparacao.js e componentes.css alterados
// (lista do precache igual).
// Etapa 16, ajuste (v23): "kg" nas séries com carga do resumo (sessao-detalhe.js; lista do precache igual).

const VERSAO = 'v23';
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
  'js/db/conexao.js',
  'js/db/migracoes.js',
  'js/db/meta.js',
  'js/db/trilhas.js',
  'js/db/backup.js',
  'js/db/sessoes.js',
  'js/db/series.js',
  'js/logica/busca.js',
  'js/logica/comparacao.js',
  'js/logica/cronometro.js',
  'js/logica/datas.js',
  'js/logica/descanso.js',
  'js/logica/fluxo-treino.js',
  'js/logica/rotina.js',
  'js/logica/tipos.js',
  'js/logica/validar-dados.js',
  'js/ui/dom.js',
  'js/ui/componentes.js',
  'js/ui/anel.js',
  'js/ui/semana.js',
  'js/telas/hoje.js',
  'js/telas/trilhas.js',
  'js/telas/treino.js',
  'js/telas/evolucao.js',
  'js/telas/sessao-detalhe.js',
  'js/telas/exercicio-evolucao.js',
  'js/telas/biblioteca.js',
  'js/telas/exercicio-detalhe.js',
  'js/telas/ajustes.js',

  'vendor/idb/index.js',

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

// fetch: o SW só responde pelo app. Navegação para a raiz do escopo ou index.html recebe o
// index.html do cache (hash na URL, start_url "./"); GET de um arquivo de ARQUIVOS é cache-first.
// Todo o resto (testes/, pesquisa/, sw.js, outros domínios, não-GET) segue direto para a rede, sem
// respondWith. Exceção: pedido feito pela página de testes/ (mesmo de um arquivo de ARQUIVOS) vai
// sempre para a rede (fetch direto, sem ler nem gravar cache), para os testes rodarem o código do disco
// e não o da versão em cache. URLs montadas a partir de registration.scope: funciona também numa
// subpasta do GitHub Pages.
const ESCOPO = self.registration.scope;
const INDICE = new URL('index.html', ESCOPO).href;
const TESTES = new URL('testes/', ESCOPO).href;
const DO_APP = new Set(ARQUIVOS.map((arquivo) => new URL(arquivo, ESCOPO).href));

const dentroDeTestes = (href) => {
  const url = new URL(href);
  return (url.origin + url.pathname).startsWith(TESTES);
};

// De qual página veio o pedido: o client de event.clientId (subrecursos). Sem client
// (ou já fechado), não é dos testes.
async function doClienteDeTestes(clientId) {
  if (!clientId) return false;
  const cliente = await self.clients.get(clientId);
  return Boolean(cliente) && dentroDeTestes(cliente.url);
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  const endereco = url.origin + url.pathname; // sem ?query e #hash

  if (pedido.mode === 'navigate') {
    // Navegação: o client de destino (resultingClientId) é a própria URL do pedido.
    // Para testes/ (ou qualquer página fora do app), rede direta.
    if (dentroDeTestes(pedido.url)) return;
    if (endereco !== ESCOPO && endereco !== INDICE) return;
    evento.respondWith(
      caches.match(INDICE, { cacheName: CACHE }).then((resposta) => resposta || fetch(pedido)),
    );
    return;
  }

  if (!DO_APP.has(endereco)) return;
  evento.respondWith((async () => {
    if (await doClienteDeTestes(evento.clientId || evento.resultingClientId)) return fetch(pedido);
    const resposta = await caches.match(pedido, { cacheName: CACHE });
    return resposta || fetch(pedido);
  })());
});
