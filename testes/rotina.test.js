// rotina.test.js: testes de js/logica/rotina.js (PROJETO.md, seção 5 "Treino do dia" e etapa 12).
// Ciclo A → B → C → A (e A → B → C → D → A), rotina sem sessões começa no A, item de trilha sem registro
// usa o nível 1, trilha concluída usa o último nível, resolução de séries/alvo/descanso, nome da rotina,
// ordem da escolha (casa primeiro, nenhuma escondida) e texto do alvo. O catálogo é o real (dados/).

import { teste, igual } from './mini-teste.js';
import { carregarCatalogo } from '../js/catalogo.js';
import {
  nomeRotina, rotinasParaEscolha, diaDoTreino, nivelAtualDaTrilha, resolverItem, treinoDoDia, textoAlvo,
} from '../js/logica/rotina.js';

let catalogo = null;
async function cat() {
  if (!catalogo) catalogo = await carregarCatalogo();
  return catalogo;
}

// Sessão mínima (só os campos que a lógica do treino do dia lê).
function sessao(rotinaId, diaId, inicio, status = 'concluida') {
  return { id: `s-${rotinaId}-${diaId}-${inicio}`, rotinaId, diaId, inicio, status };
}

// ---------- Treino do dia: ciclo ----------

teste('treino do dia: rotina sem sessões começa no dia A', async () => {
  const rotina = (await cat()).rotinaPorId.get('massa-3-casa');
  igual(diaDoTreino(rotina, []).id, 'a');
  igual(diaDoTreino(rotina, undefined).id, 'a', 'sessões ausentes');
});

teste('treino do dia: ciclo A → B → C → A (3 dias)', async () => {
  const rotina = (await cat()).rotinaPorId.get('massa-3-casa');
  igual(diaDoTreino(rotina, [sessao('massa-3-casa', 'a', 1)]).id, 'b');
  igual(diaDoTreino(rotina, [sessao('massa-3-casa', 'b', 1)]).id, 'c');
  igual(diaDoTreino(rotina, [sessao('massa-3-casa', 'c', 1)]).id, 'a', 'depois do C volta ao A');
});

teste('treino do dia: ciclo A → B → C → D → A (4 dias)', async () => {
  const rotina = (await cat()).rotinaPorId.get('massa-4-casa');
  igual(['a', 'b', 'c', 'd'].map((d) => diaDoTreino(rotina, [sessao('massa-4-casa', d, 1)]).id), ['b', 'c', 'd', 'a']);
});

teste('treino do dia: vale a última sessão concluída (maior início), em qualquer ordem na lista', async () => {
  const rotina = (await cat()).rotinaPorId.get('massa-3-casa');
  const sessoes = [sessao('massa-3-casa', 'b', 300), sessao('massa-3-casa', 'a', 100), sessao('massa-3-casa', 'c', 200)];
  igual(diaDoTreino(rotina, sessoes).id, 'c', 'última = B (início 300)');
});

teste('treino do dia: ignora sessões de outra rotina, treino livre e treino em andamento', async () => {
  const rotina = (await cat()).rotinaPorId.get('massa-3-casa');
  const sessoes = [
    sessao('massa-3-casa', 'a', 100),
    sessao('forca-3-casa', 'b', 200),
    sessao(null, null, 300),
    sessao('massa-3-casa', 'b', 400, 'andamento'),
  ];
  igual(diaDoTreino(rotina, sessoes).id, 'b', 'só a concluída de massa-3-casa (dia A) conta');
});

teste('treino do dia: diaId que não existe na rotina volta ao dia A', async () => {
  const rotina = (await cat()).rotinaPorId.get('massa-3-casa');
  igual(diaDoTreino(rotina, [sessao('massa-3-casa', 'd', 1)]).id, 'a');
});

teste('treino do dia: não depende do dia da semana (mesma sessão, outra data, mesmo resultado)', async () => {
  const rotina = (await cat()).rotinaPorId.get('massa-3-casa');
  const segunda = new Date(2026, 9, 19, 9).getTime();
  const sabado = new Date(2026, 9, 24, 9).getTime();
  igual(diaDoTreino(rotina, [sessao('massa-3-casa', 'a', segunda)]).id, diaDoTreino(rotina, [sessao('massa-3-casa', 'a', sabado)]).id);
});

// ---------- Nível atual da trilha ----------

teste('trilha: sem registro usa o nível 1', async () => {
  const trilha = (await cat()).trilhaPorId.get('flexoes');
  igual(nivelAtualDaTrilha(trilha, undefined), { exercicioId: 'flexao-na-parede', meta: { series: 3, reps: 20 }, posicao: 1 });
});

teste('trilha: concluída (exercicioAtualId null) usa o último nível', async () => {
  const trilha = (await cat()).trilhaPorId.get('flexoes');
  const nivel = nivelAtualDaTrilha(trilha, { trilhaId: 'flexoes', exercicioAtualId: null, concluidos: [], atualizadoEm: 1 });
  igual(nivel, { exercicioId: 'flexao-arqueiro', meta: { series: 3, reps: 8 }, posicao: 6 });
});

teste('trilha: com registro usa o exercício atual', async () => {
  const trilha = (await cat()).trilhaPorId.get('flexoes');
  const nivel = nivelAtualDaTrilha(trilha, { trilhaId: 'flexoes', exercicioAtualId: 'flexao-no-chao', concluidos: [], atualizadoEm: 1 });
  igual(nivel.exercicioId, 'flexao-no-chao');
  igual(nivel.posicao, 3);
});

teste('trilha: exercício atual fora da trilha usa o primeiro nível não concluído', async () => {
  const trilha = (await cat()).trilhaPorId.get('flexoes');
  const registro = {
    trilhaId: 'flexoes', exercicioAtualId: 'nao-existe',
    concluidos: [{ exercicioId: 'flexao-na-parede', em: 1, como: 'manual' }], atualizadoEm: 1,
  };
  igual(nivelAtualDaTrilha(trilha, registro).exercicioId, 'flexao-inclinada-mesa');
});

// ---------- Resolver itens ----------

teste('resolver: item de trilha sem registro vira o nível 1, com as séries do item e o alvo da meta', async () => {
  const c = await cat();
  const rotina = c.rotinaPorId.get('massa-3-casa');
  const item = rotina.dias[0].itens[0]; // { trilha: 'flexoes', series: 4 }
  igual(resolverItem(item, rotina, c, new Map()), {
    exercicioId: 'flexao-na-parede', trilhaId: 'flexoes', series: 4, alvo: '20', descanso: 90,
  });
});

teste('resolver: item de trilha sem series usa meta.series; descanso do item substitui o da rotina; meta em segundos', async () => {
  const c = await cat();
  const rotina = c.rotinaPorId.get('massa-3-casa');
  const item = rotina.dias[0].itens[4]; // { trilha: 'core-prancha', descanso: 45 }
  const nivel1 = c.trilhaPorId.get('core-prancha').niveis[0];
  igual(resolverItem(item, rotina, c), {
    exercicioId: nivel1.exercicio, trilhaId: 'core-prancha', series: 3, alvo: '60', descanso: 45,
  });
});

teste('resolver: item de trilha concluída usa o último nível', async () => {
  const c = await cat();
  const rotina = c.rotinaPorId.get('massa-3-casa');
  const progresso = new Map([['flexoes', { trilhaId: 'flexoes', exercicioAtualId: null, concluidos: [], atualizadoEm: 1 }]]);
  const resolvido = resolverItem(rotina.dias[0].itens[0], rotina, c, progresso);
  igual(resolvido.exercicioId, 'flexao-arqueiro');
  igual(resolvido.alvo, '8');
  igual(resolvido.series, 4, 'series do item continua valendo');
});

teste('resolver: item de exercício fixo copia series e alvo, com o descanso da rotina', async () => {
  const c = await cat();
  const rotina = c.rotinaPorId.get('massa-3-casa');
  igual(resolverItem(rotina.dias[0].itens[2], rotina, c), {
    exercicioId: 'desenvolvimento-garrafas', trilhaId: null, series: 3, alvo: '10-15', descanso: 90,
  });
});

teste('treinoDoDia: devolve o dia e todos os itens resolvidos, na ordem da rotina', async () => {
  const c = await cat();
  const rotina = c.rotinaPorId.get('massa-3-casa');
  const { dia, itens } = treinoDoDia(rotina, [sessao('massa-3-casa', 'a', 1)], c);
  igual(dia.id, 'b');
  igual(itens.length, dia.itens.length);
  igual(itens[0].trilhaId, 'costas-casa');
  igual(itens[0].exercicioId, c.trilhaPorId.get('costas-casa').niveis[0].exercicio);
  igual(itens[1].exercicioId, 'remada-curvada-mochila');
});

teste('treinoDoDia: todos os itens das 12 rotinas reais resolvem para exercícios do catálogo', async () => {
  const c = await cat();
  for (const rotina of c.rotinas) {
    for (const dia of rotina.dias) {
      for (const item of dia.itens.map((i) => resolverItem(i, rotina, c))) {
        if (!c.exercicioPorId.has(item.exercicioId)) throw new Error(`${rotina.id}/${dia.id}: ${item.exercicioId} fora do catálogo`);
        if (!/^\d{1,3}(-\d{1,3})?$/.test(item.alvo)) throw new Error(`${rotina.id}/${dia.id}: alvo "${item.alvo}"`);
        if (!(item.series >= 1)) throw new Error(`${rotina.id}/${dia.id}: series ${item.series}`);
      }
    }
  }
});

// ---------- Nome e escolha da rotina ----------

teste('nomeRotina: "Objetivo · N dias · Local"', async () => {
  const c = await cat();
  igual(nomeRotina(c.rotinaPorId.get('massa-3-casa'), c), 'Ganhar massa · 3 dias · Casa');
  igual(nomeRotina(c.rotinaPorId.get('forca-4-academia'), c), 'Força e habilidades · 4 dias · Academia');
});

teste('escolha: casa vem primeiro, academia depois, e as 12 rotinas aparecem uma vez', async () => {
  const c = await cat();
  const secoes = rotinasParaEscolha(c);
  igual(secoes.map((s) => s.local), ['casa', 'academia']);
  const ids = secoes.flatMap((s) => s.objetivos.flatMap((g) => g.rotinas.map((r) => r.id)));
  igual(ids.length, 12);
  igual(new Set(ids).size, 12);
  igual(ids.slice(0, 6).every((id) => id.endsWith('-casa')), true, 'as 6 primeiras são de casa');
  igual(ids.slice(6).every((id) => id.endsWith('-academia')), true, 'as 6 últimas são de academia');
});

teste('escolha: dentro do local, agrupadas por objetivo (ordem do catálogo) e por dias', async () => {
  const c = await cat();
  const casa = rotinasParaEscolha(c)[0];
  igual(casa.objetivos.map((g) => g.objetivo.id), ['massa', 'forca', 'condicionamento']);
  igual(casa.objetivos[0].rotinas.map((r) => r.id), ['massa-3-casa', 'massa-4-casa']);
});

// ---------- Texto do alvo ----------

teste('textoAlvo: reps e faixa de reps', () => {
  igual(textoAlvo({ series: 4, alvo: '12' }, 'corpo'), '4 × 12');
  igual(textoAlvo({ series: 3, alvo: '10-15' }, 'carga'), '3 × 10-15');
});

teste('textoAlvo: tipo tempo em m:ss (valor e faixa)', () => {
  igual(textoAlvo({ series: 3, alvo: '45' }, 'tempo'), '3 × 0:45');
  igual(textoAlvo({ series: 3, alvo: '30-90' }, 'tempo'), '3 × 0:30-1:30');
});
