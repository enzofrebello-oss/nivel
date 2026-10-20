// datas.js: datas em hora local (PROJETO.md, seção 2, "Datas": epoch em ms, semana de segunda a domingo).
// Etapa 12: só o que o calendário da semana do Hoje usa. Formatação, duração e agrupamento por mês
// entram nas etapas que os usam. Funções puras: recebem o "agora" como parâmetro (os testes passam datas fixas).

export const ROTULOS_DIA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// Meia-noite local do dia de `momento` (ms ou Date), em ms.
export function inicioDoDia(momento) {
  const d = new Date(momento);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Meia-noite local da segunda-feira da semana de `momento`, em ms.
export function inicioDaSemana(momento) {
  const d = new Date(momento);
  const desdeSegunda = (d.getDay() + 6) % 7; // getDay: 0 = domingo
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - desdeSegunda).getTime();
}

// Chave do dia local "AAAA-MM-DD" (não a data UTC).
export function chaveDoDia(momento) {
  const d = new Date(momento);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Os 7 dias da semana de `agora` (segunda a domingo): { chave, inicio, rotulo, numero, hoje }.
// Montados por new Date(ano, mês, dia + i), assim a troca de horário de verão não pula nem repete um dia.
export function diasDaSemana(agora = Date.now()) {
  const segunda = new Date(inicioDaSemana(agora));
  const chaveHoje = chaveDoDia(agora);
  return ROTULOS_DIA.map((rotulo, i) => {
    const d = new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + i);
    const chave = chaveDoDia(d);
    return { chave, inicio: d.getTime(), rotulo, numero: d.getDate(), hoje: chave === chaveHoje };
  });
}

// Chaves dos dias desta semana com pelo menos um treino concluído (pelo início da sessão).
// Só sessões reais do banco contam: sem sessões, nenhum dia é marcado.
// Treino em andamento não conta (ainda pode ser descartado).
export function diasTreinadosNaSemana(sessoes, agora = Date.now()) {
  const semana = new Set(diasDaSemana(agora).map((d) => d.chave));
  const treinados = new Set();
  for (const sessao of sessoes || []) {
    if (sessao.status !== 'concluida' || !Number.isFinite(sessao.inicio)) continue;
    const chave = chaveDoDia(sessao.inicio);
    if (semana.has(chave)) treinados.add(chave);
  }
  return treinados;
}
