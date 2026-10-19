// app.js: ponto de entrada do app (ES module).
// Etapa 4: carrega o catálogo (dados/*.json, validado e congelado) e, se ele estiver certo,
// inicia o roteador hash, que desenha as telas dentro de <main id="app">.
// Se o catálogo falhar, mostra "Dados do app inválidos" e não abre nenhuma tela (nada é gravado).
// Etapa 7: registra o service worker (sw.js na raiz), que deixa o app inteiro offline.
// Etapa 8: fluxo de atualização. SW novo em "waiting" mostra o banner "Nova versão disponível";
// só o toque em "Atualizar" manda SKIP_WAITING, e a página recarrega uma vez no controllerchange.
// Na rota de treino (#/treino e subrotas) o banner fica escondido; ao sair dela, volta se o SW
// ainda estiver em waiting.
// O banco entra nas etapas seguintes (PROJETO.md, seção 6).

import { iniciar } from './roteador.js';
import { iniciarCatalogo } from './catalogo.js';
import { h, limpar } from './ui/dom.js';
import { bannerAtualizacao } from './ui/componentes.js';

const app = document.getElementById('app');

// pediuAtualizacao: o toque em "Atualizar" partiu desta página (outra aba atualizando não recarrega esta).
// recarregando: garante um único reload, mesmo se controllerchange e statechange chegarem juntos.
let pediuAtualizacao = false;
let recarregando = false;
let banner = null;
let swEsperando = null; // SW novo em waiting que ainda não foi aplicado

// Registrado antes do catálogo: mesmo com "Dados do app inválidos", um deploy corrigido chega pelo SW.
if ('serviceWorker' in navigator) {
  registrarServiceWorker();
  // Entrar no treino esconde o banner; sair dele mostra de novo se o SW ainda espera.
  window.addEventListener('hashchange', () => {
    if (pediuAtualizacao) return; // já tocou "Atualizar": a recarga está a caminho
    if (naRotaDeTreino()) {
      esconderBanner();
    } else if (!banner && swEsperando && swEsperando.state === 'installed') {
      mostrarBanner(swEsperando);
    }
  });
}

// #/treino ou qualquer subrota (#/treino/:id). Compara o segmento inteiro (não pega #/trilhas).
function naRotaDeTreino() {
  return location.hash.replace(/^#/, '').split('/').filter(Boolean)[0] === 'treino';
}

// O caminho é relativo ao index.html, então o escopo é a pasta do app (serve numa subpasta do GitHub Pages).
async function registrarServiceWorker() {
  // No primeiro install não há SW antigo nem pedido de atualização: nada recarrega.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (pediuAtualizacao) {
      recarregar();
    } else {
      swEsperando = null;
      esconderBanner(); // outra aba atualizou: o SW em waiting desta página já não existe
    }
  });

  let registro;
  try {
    registro = await navigator.serviceWorker.register('./sw.js');
  } catch (erro) {
    console.error('Service worker não registrado:', erro);
    return;
  }

  // Versão nova que já estava esperando ao abrir o app.
  if (registro.waiting && registro.active) mostrarBanner(registro.waiting);

  // Versão nova encontrada com o app aberto (ou já instalando quando o register terminou).
  // registro.active vazio = primeiro install: sem banner, o SW ativa sozinho e não há o que trocar.
  const acompanhar = (novo) => {
    if (!novo) return;
    novo.addEventListener('statechange', () => {
      if (novo.state === 'installed' && registro.active) mostrarBanner(novo);
    });
  };
  acompanhar(registro.installing);
  registro.addEventListener('updatefound', () => acompanhar(registro.installing));
}

function mostrarBanner(sw) {
  swEsperando = sw;
  esconderBanner();
  if (naRotaDeTreino()) return; // fica guardado; aparece ao sair do treino (hashchange)
  banner = bannerAtualizacao(() => {
    pediuAtualizacao = true;
    // Página sem controller (ex.: recarregada com Shift) não recebe controllerchange: recarrega na ativação.
    sw.addEventListener('statechange', () => {
      if (sw.state === 'activated') recarregar();
    });
    sw.postMessage('SKIP_WAITING');
  });
  document.body.append(banner);
}

function esconderBanner() {
  if (banner) banner.remove();
  banner = null;
}

function recarregar() {
  if (recarregando) return;
  recarregando = true;
  window.location.reload();
}

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
