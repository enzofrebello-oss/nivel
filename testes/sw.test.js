// sw.test.js: testes do sw.js (PROJETO.md, seção 2, "Service worker e versionamento de cache", e etapa 7).
// Lê a lista ARQUIVOS direto do texto do sw.js (sem cópia à mão) e confere que cada arquivo
// responde 200, para um arquivo renomeado ou removido não quebrar a instalação do service worker.

import { teste, igual } from './mini-teste.js';

// Busca o sw.js e extrai os caminhos entre aspas simples do array `const ARQUIVOS = [ ... ];`.
async function lerArquivosDoSw() {
  const resposta = await fetch('../sw.js', { cache: 'no-store' });
  if (!resposta.ok) throw new Error(`sw.js respondeu ${resposta.status}`);
  const texto = await resposta.text();
  const bloco = texto.match(/const ARQUIVOS = \[([\s\S]*?)\];/);
  if (!bloco) throw new Error('não achei "const ARQUIVOS = [ ... ];" no sw.js');
  return [...bloco[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

teste('sw.js: a lista ARQUIVOS é lida do sw.js, não está vazia e não tem repetidos', async () => {
  const arquivos = await lerArquivosDoSw();
  if (arquivos.length === 0) throw new Error('ARQUIVOS veio vazia');
  igual(new Set(arquivos).size, arquivos.length, 'caminhos repetidos');
});

teste('sw.js: todos os arquivos de ARQUIVOS respondem 200', async () => {
  const arquivos = await lerArquivosDoSw();
  const falhas = [];
  for (const caminho of arquivos) {
    const resposta = await fetch(`../${caminho}`, { cache: 'no-store' });
    if (resposta.status !== 200) falhas.push(`${caminho} (${resposta.status})`);
  }
  igual(falhas, [], `${falhas.length} de ${arquivos.length} sem 200`);
});
