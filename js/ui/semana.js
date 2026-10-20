// semana.js: calendário da semana (PROJETO.md, seção 5 e seção 8: dias treinados em laranja).
// Segunda a domingo da semana atual; o dia de hoje tem contorno; dias com treino concluído ficam em laranja.
// diasTreinados = Set de chaves "AAAA-MM-DD" (js/logica/datas.js, diasTreinadosNaSemana), lidas do banco.

import { h } from './dom.js';
import { diasDaSemana } from '../logica/datas.js';

const formatoDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

export function calendarioSemana(diasTreinados, agora = Date.now()) {
  const dias = diasDaSemana(agora);
  const quantos = dias.filter((d) => diasTreinados.has(d.chave)).length;
  return h('section', { class: 'semana', 'aria-label': `Semana atual: ${quantos === 1 ? '1 dia treinado' : `${quantos} dias treinados`}` },
    h('ol', { class: 'semana-dias' },
      dias.map((dia) => {
        const treinado = diasTreinados.has(dia.chave);
        const classes = ['semana-dia', treinado ? 'treinado' : '', dia.hoje ? 'hoje' : ''].filter(Boolean).join(' ');
        const descricao = `${formatoDia.format(dia.inicio)}${dia.hoje ? ', hoje' : ''}${treinado ? ', treinou' : ''}`;
        return h('li', { class: classes, 'aria-label': descricao, 'aria-current': dia.hoje ? 'date' : null },
          h('span', { class: 'semana-rotulo', 'aria-hidden': 'true' }, dia.rotulo),
          h('span', { class: 'semana-numero', 'aria-hidden': 'true' }, String(dia.numero)));
      })),
  );
}
