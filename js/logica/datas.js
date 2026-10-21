// datas.js: datas em hora local (PROJETO.md, seção 2, "Datas": epoch em ms, semana de segunda a domingo).
// Etapa 12: só o que o calendário da semana do Hoje usa. Etapa 16: duração do treino (resumo e Hoje).
// Agrupamento por mês entra na etapa que o usa. Funções puras: recebem o "agora" como parâmetro (os testes passam datas fixas).

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

// Etapa 16. Duração de um treino em texto, em minutos arredondados: "menos de 1 min", "52 min",
// "1 h", "1 h 05 min". ms negativo ou inválido = "menos de 1 min".
export function textoDuracao(ms) {
  const minutos = Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60000) : 0;
  if (minutos < 1) return 'menos de 1 min';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${String(resto).padStart(2, '0')} min` : `${horas} h`;
}

// Etapa 16. A sessão concluída mais recente que começou no dia de `agora` (o Hoje mostra o treino
// concluído), ou null. Mesma regra do calendário: conta o dia do início.
export function concluidaHoje(sessoes, agora = Date.now()) {
  const hoje = chaveDoDia(agora);
  let ultima = null;
  for (const sessao of sessoes || []) {
    if (sessao.status !== 'concluida' || !Number.isFinite(sessao.inicio)) continue;
    if (chaveDoDia(sessao.inicio) !== hoje) continue;
    if (!ultima || sessao.inicio > ultima.inicio) ultima = sessao;
  }
  return ultima;
}
