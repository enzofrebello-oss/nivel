// roteador.js: roteamento por hash (#/biblioteca/flexao-no-chao).
// Tabela rota → módulo de tela; extrai :id; chama a limpeza da tela anterior; marca a aba ativa.
// Contrato de tela (PROJETO.md, seção 3): export async function render(container, params),
// que pode devolver uma função de limpeza.

import { limpar } from './ui/dom.js';
import * as hoje from './telas/hoje.js';
import * as trilhas from './telas/trilhas.js';
import * as treino from './telas/treino.js';
import * as evolucao from './telas/evolucao.js';
import * as sessaoDetalhe from './telas/sessao-detalhe.js';
import * as exercicioEvolucao from './telas/exercicio-evolucao.js';
import * as biblioteca from './telas/biblioteca.js';
import * as exercicioDetalhe from './telas/exercicio-detalhe.js';
import * as ajustes from './telas/ajustes.js';

// aba: href da aba que fica marcada. Treino e Ajustes saem do Hoje, então marcam o Hoje.
// engrenagem: a engrenagem de Ajustes só aparece no topo do Hoje (seção 5).
// titulo: null = topo sem título; a própria tela mostra o título no conteúdo e define document.title.
// semAbas: a barra de abas some nessa rota (tela de treino, etapa 13b, como no design aprovado).
const ROTAS = [
  { padrao: '/', tela: hoje, titulo: 'Hoje', aba: '#/', engrenagem: true },
  { padrao: '/trilhas', tela: trilhas, titulo: 'Trilhas', aba: '#/trilhas' },
  { padrao: '/trilhas/:id', tela: trilhas, titulo: 'Trilhas', aba: '#/trilhas' },
  { padrao: '/treino/:id', tela: treino, titulo: 'Treino em andamento', aba: '#/', semAbas: true },
  { padrao: '/evolucao', tela: evolucao, titulo: 'Evolução', aba: '#/evolucao' },
  { padrao: '/evolucao/treino/:id', tela: sessaoDetalhe, titulo: 'Detalhe da sessão', aba: '#/evolucao' },
  { padrao: '/evolucao/exercicio/:id', tela: exercicioEvolucao, titulo: 'Evolução do exercício', aba: '#/evolucao' },
  { padrao: '/biblioteca', tela: biblioteca, titulo: 'Biblioteca', aba: '#/biblioteca' },
  { padrao: '/biblioteca/:id', tela: exercicioDetalhe, titulo: null, aba: '#/biblioteca' },
  { padrao: '/ajustes', tela: ajustes, titulo: 'Ajustes', aba: '#/' },
];

let container;
let limpezaAtual = null;
let navegacao = 0; // descarta renders antigos se a rota mudar no meio de um render assíncrono

export function iniciar(elemento) {
  container = elemento;
  window.addEventListener('hashchange', navegar);
  navegar();
}

// Separa o caminho do hash em segmentos: "#/biblioteca/abc/" → ["biblioteca", "abc"].
function segmentos(caminho) {
  return caminho.split('/').filter(Boolean);
}

// Procura a rota do caminho; devolve { rota, params } ou null.
function encontrar(caminho) {
  const partes = segmentos(caminho);
  for (const rota of ROTAS) {
    const padrao = segmentos(rota.padrao);
    if (padrao.length !== partes.length) continue;
    const params = {};
    const confere = padrao.every((p, i) => {
      if (p.startsWith(':')) {
        params[p.slice(1)] = decodificar(partes[i]);
        return true;
      }
      return p === partes[i];
    });
    if (confere) return { rota, params };
  }
  return null;
}

function decodificar(texto) {
  try {
    return decodeURIComponent(texto);
  } catch {
    return texto;
  }
}

async function navegar() {
  const hash = location.hash;
  const caminho = hash.startsWith('#') ? hash.slice(1) : hash;
  const achado = encontrar(caminho);

  if (!achado) {
    // Rota inexistente: vai para o Hoje substituindo a entrada do histórico,
    // para o voltar não cair de novo na rota inválida. O replace dispara hashchange.
    location.replace('#/');
    return;
  }

  const { rota, params } = achado;
  const minha = ++navegacao;

  if (limpezaAtual) {
    try {
      limpezaAtual();
    } catch (erro) {
      console.error('Erro na limpeza da tela anterior:', erro);
    }
    limpezaAtual = null;
  }

  atualizarCasca(rota);
  limpar(container);
  window.scrollTo(0, 0);

  try {
    const limpeza = await rota.tela.render(container, params);
    if (minha !== navegacao) {
      // A rota mudou durante o render: esta tela já não está na frente.
      if (typeof limpeza === 'function') limpeza();
      return;
    }
    limpezaAtual = typeof limpeza === 'function' ? limpeza : null;
  } catch (erro) {
    console.error('Erro ao abrir a tela:', erro);
  }
}

// Topo (título e engrenagem) e aba ativa, conforme a rota.
function atualizarCasca(rota) {
  const titulo = document.querySelector('.topo-titulo');
  if (titulo) {
    titulo.textContent = rota.titulo || '';
    titulo.hidden = !rota.titulo;
  }
  document.title = !rota.titulo || rota.titulo === 'Hoje' ? 'Nível' : `${rota.titulo} · Nível`;

  const engrenagem = document.querySelector('.topo a[href="#/ajustes"]');
  if (engrenagem) engrenagem.hidden = !rota.engrenagem;

  // Sem título e sem engrenagem, o topo inteiro some (não ocupa espaço);
  // o conteúdo assume a área segura do topo (componentes.css, .topo[hidden] + #app).
  const topo = document.querySelector('.topo');
  if (topo) topo.hidden = !rota.titulo && !rota.engrenagem;

  // Barra de abas: escondida nas rotas semAbas; a classe no body tira o espaço reservado para ela.
  const abas = document.querySelector('.abas');
  if (abas) abas.hidden = Boolean(rota.semAbas);
  document.body.classList.toggle('sem-abas', Boolean(rota.semAbas));

  for (const aba of document.querySelectorAll('.abas .aba')) {
    if (aba.getAttribute('href') === rota.aba) {
      aba.setAttribute('aria-current', 'page');
    } else {
      aba.removeAttribute('aria-current');
    }
  }
}
