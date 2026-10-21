// hoje.js (lógica): o que a tela Hoje mostra (etapa 16b, "Hoje novo"). Funções puras: recebem as
// sessões, os dias da rotina e o "agora" como parâmetros (não tocam DOM, banco nem fetch).
// - Data sugerida do próximo treino = dia do último treino concluído + intervalo, nunca antes de hoje
//   (se cair antes, vira hoje). Sem treino concluído, o próximo é hoje. Intervalo: rotina de 3 dias = 2;
//   rotina de 4 dias alterna 1 e 2 (treina, treina, descansa); outras = Math.round(7 ÷ dias).
// - Três situações: 'treino' (hoje é a data sugerida ou ela já passou), 'concluido' (já treinou hoje)
//   e 'descanso' (a data sugerida é depois de hoje).
// - Frases motivacionais: uma sorteada ao finalizar e gravada na sessão (sessao.frase). Treinos
//   concluídos antes da 16b, sem frase, recebem uma fixa pelo id (não muda ao recarregar).
// O "dia" de um treino é o do início (mesma regra do calendário da semana).

import { inicioDoDia, somarDias, concluidaHoje } from './datas.js';

export const FRASES = Object.freeze([
  'Mais um treino na conta.',
  'Constância vale mais que intensidade.',
  'Hoje você fez a sua parte.',
  'Um treino de cada vez.',
  'Pequenos passos, toda semana.',
  'Feito é melhor que perfeito.',
  'Você apareceu, e isso conta muito.',
  'A evolução vem da repetição.',
  'Bom trabalho. Agora é recuperar.',
  'Cada série te deixa um pouco mais forte.',
  'Seu eu de amanhã agradece.',
  'Treino feito, cabeça leve.',
  'Devagar e sempre.',
  'Um pouco melhor que da última vez.',
  'O progresso mora nos detalhes.',
  'Hoje valeu a pena.',
  'Quem treina com calma treina por anos.',
  'Agora é beber água e descansar bem.',
  'Disciplina é lembrar do que você quer.',
  'O difícil era começar, e você começou.',
]);

// Intervalo em dias entre o último treino concluído e o próximo.
// - Rotina de 4 dias: alterna 1 e 2 (treina, treina, descansa). Se o dia treinado anterior ao do último
//   treino é o dia imediatamente antes dele, o intervalo é 2; senão (ou com um treino só) é 1.
// - Outras rotinas: Math.round(7 ÷ dias), no mínimo 1 (3 dias → 2). Dias inválidos (sem rotina) = 1.
// ultimoTreino e penultimoTreino = momentos (ms); penultimoTreino é o último treino concluído num dia
// ANTERIOR ao do último (dois treinos no mesmo dia, como o ↻, contam como um dia só).
export function intervaloEntreTreinos(diasPorSemana, ultimoTreino, penultimoTreino) {
  if (!Number.isFinite(diasPorSemana) || diasPorSemana <= 0) return 1;
  if (diasPorSemana === 4) {
    if (!Number.isFinite(ultimoTreino) || !Number.isFinite(penultimoTreino)) return 1;
    return inicioDoDia(penultimoTreino) === somarDias(ultimoTreino, -1) ? 2 : 1;
  }
  return Math.max(1, Math.round(7 / diasPorSemana));
}

// Data sugerida do próximo treino (meia-noite local, em ms).
// ultimoTreino = momento (ms) do último treino concluído, ou null/undefined se nunca treinou.
// penultimoTreino = momento (ms) do último treino concluído num dia anterior ao do último, ou null.
// hoje = o "agora" (ms). Nunca devolve antes do dia de hoje.
export function proximaDataTreino(ultimoTreino, diasPorSemana, hoje, penultimoTreino = null) {
  const diaDeHoje = inicioDoDia(hoje);
  if (!Number.isFinite(ultimoTreino)) return diaDeHoje;
  const sugerida = somarDias(ultimoTreino, intervaloEntreTreinos(diasPorSemana, ultimoTreino, penultimoTreino));
  return Math.max(sugerida, diaDeHoje);
}

// Último treino concluído (maior início), de qualquer rotina, ou null.
export function ultimaConcluida(sessoes) {
  let ultima = null;
  for (const sessao of sessoes || []) {
    if (sessao.status !== 'concluida' || !Number.isFinite(sessao.inicio)) continue;
    if (!ultima || sessao.inicio > ultima.inicio) ultima = sessao;
  }
  return ultima;
}

// Último treino concluído (maior início) num dia anterior ao dia de `momento`, ou null.
export function concluidaAntesDoDia(sessoes, momento) {
  if (!Number.isFinite(momento)) return null;
  const dia = inicioDoDia(momento);
  return ultimaConcluida((sessoes || []).filter((s) => Number.isFinite(s.inicio) && s.inicio < dia));
}

// Situação do Hoje. Devolve { situacao, proxima, concluida }:
// situacao = 'concluido' (há treino concluído que começou hoje), 'treino' (data sugerida ≤ hoje) ou
// 'descanso' (data sugerida depois de hoje); proxima = data sugerida (ms, meia-noite local);
// concluida = o treino concluído de hoje (o mais recente), ou null.
// Treino em andamento não entra aqui: a tela mostra "Continuar treino" antes de tudo.
export function situacaoDoHoje({ sessoes, diasPorSemana, agora }) {
  const ultima = ultimaConcluida(sessoes);
  const anterior = ultima ? concluidaAntesDoDia(sessoes, ultima.inicio) : null;
  const proxima = proximaDataTreino(ultima ? ultima.inicio : null, diasPorSemana, agora, anterior ? anterior.inicio : null);
  const concluida = concluidaHoje(sessoes, agora);
  if (concluida) return { situacao: 'concluido', proxima, concluida };
  return { situacao: proxima <= inicioDoDia(agora) ? 'treino' : 'descanso', proxima, concluida: null };
}

// Sorteia uma frase (ao finalizar o treino). aleatorio = função que devolve [0, 1) (os testes fixam).
export function sortearFrase(aleatorio = Math.random) {
  const i = Math.floor(aleatorio() * FRASES.length);
  return FRASES[Math.min(Math.max(i, 0), FRASES.length - 1)];
}

// Frase de um treino concluído: a gravada na sessão; sem ela (treino de antes da 16b), uma escolhida
// pelo id da sessão, sempre a mesma para aquele treino.
export function fraseDaSessao(sessao) {
  if (sessao && typeof sessao.frase === 'string' && sessao.frase.trim()) return sessao.frase;
  const id = String((sessao && sessao.id) || '');
  let soma = 0;
  for (let i = 0; i < id.length; i++) soma = (soma * 31 + id.charCodeAt(i)) >>> 0;
  return FRASES[soma % FRASES.length];
}
