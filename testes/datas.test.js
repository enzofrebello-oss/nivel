// datas.test.js: testes de js/logica/datas.js (PROJETO.md, seção 2 "Datas" e etapa 12).
// Semana de segunda a domingo em hora local e os dias treinados do calendário do Hoje,
// que vêm só das sessões concluídas (sem sessões, nenhum dia marcado).

import { teste, igual } from './mini-teste.js';
import {
  ROTULOS_DIA, inicioDoDia, inicioDaSemana, chaveDoDia, diasDaSemana, diasTreinadosNaSemana,
} from '../js/logica/datas.js';

// Datas locais fixas: 19/10/2026 é segunda-feira, 25/10/2026 é domingo.
const local = (dia, hora = 12, minuto = 0) => new Date(2026, 9, dia, hora, minuto).getTime();
const QUARTA = local(21, 15, 30);

function sessao(inicio, status = 'concluida') {
  return { id: `s-${inicio}`, inicio, status };
}

// ---------- Dia e semana ----------

teste('inicioDoDia: meia-noite local do mesmo dia', () => {
  igual(inicioDoDia(local(21, 23, 59)), new Date(2026, 9, 21).getTime());
});

teste('chaveDoDia: data local AAAA-MM-DD, com zeros (não UTC)', () => {
  igual(chaveDoDia(new Date(2026, 0, 5, 0, 0)), '2026-01-05');
  igual(chaveDoDia(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

teste('inicioDaSemana: segunda-feira, inclusive no domingo e na própria segunda', () => {
  const segunda = new Date(2026, 9, 19).getTime();
  igual(inicioDaSemana(QUARTA), segunda);
  igual(inicioDaSemana(local(25, 23, 59)), segunda, 'domingo é o fim da semana, não o começo');
  igual(inicioDaSemana(local(19, 0, 0)), segunda);
  igual(inicioDaSemana(local(26, 0, 0)), new Date(2026, 9, 26).getTime(), 'segunda seguinte começa outra semana');
});

teste('diasDaSemana: 7 dias de segunda a domingo, com rótulos e números', () => {
  const dias = diasDaSemana(QUARTA);
  igual(dias.map((d) => d.rotulo), ROTULOS_DIA);
  igual(dias.map((d) => d.numero), [19, 20, 21, 22, 23, 24, 25]);
  igual(dias.map((d) => d.chave)[0], '2026-10-19');
});

teste('diasDaSemana: só o dia de hoje fica marcado como hoje', () => {
  igual(diasDaSemana(QUARTA).filter((d) => d.hoje).map((d) => d.chave), ['2026-10-21']);
});

teste('diasDaSemana: semana que vira o mês', () => {
  igual(diasDaSemana(new Date(2026, 9, 31, 12).getTime()).map((d) => d.numero), [26, 27, 28, 29, 30, 31, 1]);
});

// ---------- Dias treinados ----------

teste('dias treinados: sem sessões, nenhum dia marcado', () => {
  igual([...diasTreinadosNaSemana([], QUARTA)], []);
  igual([...diasTreinadosNaSemana(undefined, QUARTA)], [], 'lista ausente');
});

teste('dias treinados: sessões concluídas desta semana marcam o dia (duas no mesmo dia contam uma vez)', () => {
  const sessoes = [sessao(local(19, 7)), sessao(local(21, 8)), sessao(local(21, 19))];
  igual([...diasTreinadosNaSemana(sessoes, QUARTA)].sort(), ['2026-10-19', '2026-10-21']);
});

teste('dias treinados: sessões de outras semanas não aparecem', () => {
  const sessoes = [sessao(local(18, 23, 59)), sessao(local(26, 0, 0)), sessao(local(25, 23, 59))];
  igual([...diasTreinadosNaSemana(sessoes, QUARTA)], ['2026-10-25'], 'domingo anterior e segunda seguinte ficam fora');
});

teste('dias treinados: treino em andamento não marca o dia', () => {
  igual([...diasTreinadosNaSemana([sessao(local(21, 9), 'andamento')], QUARTA)], []);
});
