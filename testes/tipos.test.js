// tipos.test.js: testes de js/logica/tipos.js (PROJETO.md, seção 4.2, "Regras por tipo de exercício").

import { teste, igual } from './mini-teste.js';
import {
  TIPOS, CAMPOS,
  parseCarga, parseReps, parseTempo, parseSerie,
  validarSerie,
  formatarCarga, formatarTempo, formatarSerie,
  PASSOS, aplicarPasso, parseCampo, formatarCampo,
} from '../js/logica/tipos.js';

// O parse aceitou e devolveu exatamente este valor.
function aceita(resultado, esperado) {
  igual(resultado.ok, true, `deveria aceitar (erro: ${resultado.erro})`);
  igual(resultado.valor, esperado);
}

// O parse/validação recusou, com uma mensagem de erro.
function recusa(resultado) {
  igual(resultado.ok, false, `deveria recusar (veio ${JSON.stringify(resultado.valor)})`);
  igual(typeof resultado.erro === 'string' && resultado.erro.length > 0, true, 'deveria trazer mensagem de erro');
}

// ---------- Tipos e campos ----------
teste('tipos: existem exatamente carga, corpo e tempo', () => {
  igual(TIPOS, ['carga', 'corpo', 'tempo']);
});
teste('tipos: campos de cada tipo (carga+reps, reps, segundos)', () => {
  igual(CAMPOS, { carga: ['carga', 'reps'], corpo: ['reps'], tempo: ['segundos'] });
});

// ---------- Carga: parse ----------
teste("carga: '62,5' com vírgula vira 62.5", () => aceita(parseCarga('62,5'), 62.5));
teste("carga: '62.5' com ponto vira 62.5", () => aceita(parseCarga('62.5'), 62.5));
teste("carga: '60' inteiro vira 60", () => aceita(parseCarga('60'), 60));
teste("carga: '62,25' com 2 casas é aceita", () => aceita(parseCarga('62,25'), 62.25));
teste("carga: ' 40 ' com espaços nas pontas vira 40", () => aceita(parseCarga(' 40 '), 40));
teste("carga: '0,5' (menor valor comum) é aceita", () => aceita(parseCarga('0,5'), 0.5));
teste("carga: '1000' (limite máximo) é aceita", () => aceita(parseCarga('1000'), 1000));
teste("carga: '1000,01' (acima do máximo) é recusada", () => recusa(parseCarga('1000,01')));
teste("carga: '0' é recusada (precisa ser maior que 0)", () => recusa(parseCarga('0')));
teste("carga: '0,00' é recusada (precisa ser maior que 0)", () => recusa(parseCarga('0,00')));
teste("carga: '62,555' com 3 casas é recusada", () => recusa(parseCarga('62,555')));
teste("carga: campo vazio '' é recusado", () => recusa(parseCarga('')));
teste("carga: só espaços '   ' é recusado", () => recusa(parseCarga('   ')));
teste("carga: letras 'abc' são recusadas", () => recusa(parseCarga('abc')));
teste("carga: '60kg' com letras é recusada", () => recusa(parseCarga('60kg')));
teste("carga: negativo '-5' é recusado", () => recusa(parseCarga('-5')));
teste("carga: '62,5,0' com duas vírgulas é recusada", () => recusa(parseCarga('62,5,0')));
teste("carga: '1e2' (notação científica) é recusada", () => recusa(parseCarga('1e2')));
teste('carga: valor que não é texto (undefined) é recusado', () => recusa(parseCarga(undefined)));

// ---------- Reps: parse ----------
teste("reps (carga): '10' vira 10", () => aceita(parseReps('10', 'carga'), 10));
teste("reps (carga): '1' (mínimo) é aceito", () => aceita(parseReps('1', 'carga'), 1));
teste("reps (carga): '100' (máximo) é aceito", () => aceita(parseReps('100', 'carga'), 100));
teste("reps (carga): '101' (acima do máximo) é recusado", () => recusa(parseReps('101', 'carga')));
teste("reps (carga): '0' é recusado", () => recusa(parseReps('0', 'carga')));
teste("reps (corpo): '0' é recusado", () => recusa(parseReps('0', 'corpo')));
teste("reps (corpo): '500' (máximo) é aceito", () => aceita(parseReps('500', 'corpo'), 500));
teste("reps (corpo): '501' (acima do máximo) é recusado", () => recusa(parseReps('501', 'corpo')));
teste("reps: '8,5' com vírgula é recusado (só inteiro)", () => recusa(parseReps('8,5', 'carga')));
teste("reps: '8.5' com ponto é recusado (só inteiro)", () => recusa(parseReps('8.5', 'corpo')));
teste("reps: campo vazio '' é recusado", () => recusa(parseReps('', 'corpo')));
teste("reps: letras 'dez' são recusadas", () => recusa(parseReps('dez', 'corpo')));
teste("reps: negativo '-3' é recusado", () => recusa(parseReps('-3', 'carga')));

// ---------- Tempo: parse ----------
teste("tempo: '1:30' (m:ss) vira 90 s", () => aceita(parseTempo('1:30'), 90));
teste("tempo: '0:45' (m:ss) vira 45 s", () => aceita(parseTempo('0:45'), 45));
teste("tempo: '90' sem dois-pontos é lido como segundos: 90 s", () => aceita(parseTempo('90'), 90));
teste("tempo: '50' sem dois-pontos vira 50 s", () => aceita(parseTempo('50'), 50));
teste("tempo: '2:05' vira 125 s", () => aceita(parseTempo('2:05'), 125));
teste("tempo: '1' (mínimo, 1 s) é aceito", () => aceita(parseTempo('1'), 1));
teste("tempo: '120:00' (máximo, 7200 s) é aceito", () => aceita(parseTempo('120:00'), 7200));
teste("tempo: '7201' (acima do máximo) é recusado", () => recusa(parseTempo('7201')));
teste("tempo: '120:01' (acima do máximo) é recusado", () => recusa(parseTempo('120:01')));
teste("tempo: '0' é recusado (mínimo 1 s)", () => recusa(parseTempo('0')));
teste("tempo: '0:00' é recusado (mínimo 1 s)", () => recusa(parseTempo('0:00')));
teste("tempo: '1:60' é recusado (segundos de 00 a 59)", () => recusa(parseTempo('1:60')));
teste("tempo: '1:5' é recusado (segundos com 2 dígitos)", () => recusa(parseTempo('1:5')));
teste("tempo: '1:30:00' é recusado (só ss ou m:ss)", () => recusa(parseTempo('1:30:00')));
teste("tempo: '1,5' com vírgula é recusado (só inteiro)", () => recusa(parseTempo('1,5')));
teste("tempo: campo vazio '' é recusado", () => recusa(parseTempo('')));
teste("tempo: letras 'um minuto' são recusadas", () => recusa(parseTempo('um minuto')));
teste("tempo: negativo '-30' é recusado", () => recusa(parseTempo('-30')));

// ---------- parseSerie: textos digitados → campos da série ----------
teste("série carga: { carga: '62,5', reps: '10' } vira { carga: 62.5, reps: 10 }", () => {
  aceita(parseSerie('carga', { carga: '62,5', reps: '10' }), { carga: 62.5, reps: 10 });
});
teste("série corpo: { reps: '15' } vira { reps: 15 }", () => {
  aceita(parseSerie('corpo', { reps: '15' }), { reps: 15 });
});
teste("série tempo: { segundos: '1:30' } vira { segundos: 90 }", () => {
  aceita(parseSerie('tempo', { segundos: '1:30' }), { segundos: 90 });
});
teste('série carga: reps 0 é recusada', () => recusa(parseSerie('carga', { carga: '60', reps: '0' })));
teste('série carga: sem reps é recusada', () => recusa(parseSerie('carga', { carga: '60' })));
teste('série corpo: campo de outro tipo (carga) é recusado', () => {
  recusa(parseSerie('corpo', { reps: '15', carga: '10' }));
});
teste('série tempo: campo de outro tipo (reps) é recusado', () => {
  recusa(parseSerie('tempo', { segundos: '30', reps: '5' }));
});
teste('série: tipo desconhecido é recusado', () => recusa(parseSerie('cardio', { reps: '10' })));

// ---------- validarSerie: série gravada ----------
teste('validar: série carga { carga: 60, reps: 10 } é válida', () => {
  igual(validarSerie({ tipo: 'carga', carga: 60, reps: 10 }).ok, true);
});
teste('validar: série corpo { reps: 15 } é válida', () => {
  igual(validarSerie({ tipo: 'corpo', reps: 15 }).ok, true);
});
teste('validar: série tempo { segundos: 50 } é válida', () => {
  igual(validarSerie({ tipo: 'tempo', segundos: 50 }).ok, true);
});
teste('validar: campos que não são de medida (id, feitaEm...) não atrapalham', () => {
  const serie = { id: 'e3', sessaoId: 's7', exercicioId: 'supino-reto-barra', tipo: 'carga',
    grupos: ['peito'], carga: 62.5, reps: 10, feitaEm: 1760791200000 };
  igual(validarSerie(serie).ok, true);
});
teste('validar: reps 0 é recusado (carga)', () => recusa(validarSerie({ tipo: 'carga', carga: 60, reps: 0 })));
teste('validar: reps 0 é recusado (corpo)', () => recusa(validarSerie({ tipo: 'corpo', reps: 0 })));
teste('validar: reps 8.5 (não inteiro) é recusado', () => recusa(validarSerie({ tipo: 'corpo', reps: 8.5 })));
teste('validar: reps 101 em carga é recusado (máx. 100)', () => recusa(validarSerie({ tipo: 'carga', carga: 60, reps: 101 })));
teste('validar: reps 300 em corpo é aceito (máx. 500)', () => igual(validarSerie({ tipo: 'corpo', reps: 300 }).ok, true));
teste('validar: carga 0 é recusada', () => recusa(validarSerie({ tipo: 'carga', carga: 0, reps: 10 })));
teste('validar: carga negativa é recusada', () => recusa(validarSerie({ tipo: 'carga', carga: -10, reps: 10 })));
teste('validar: carga 1001 é recusada (máx. 1000)', () => recusa(validarSerie({ tipo: 'carga', carga: 1001, reps: 10 })));
teste('validar: carga 62.555 é recusada (até 2 casas)', () => recusa(validarSerie({ tipo: 'carga', carga: 62.555, reps: 10 })));
teste("validar: carga em texto '60' é recusada (precisa ser número)", () => recusa(validarSerie({ tipo: 'carga', carga: '60', reps: 10 })));
teste('validar: segundos 0 é recusado', () => recusa(validarSerie({ tipo: 'tempo', segundos: 0 })));
teste('validar: segundos 7201 é recusado (máx. 7200)', () => recusa(validarSerie({ tipo: 'tempo', segundos: 7201 })));
teste('validar: segundos 30.5 (não inteiro) é recusado', () => recusa(validarSerie({ tipo: 'tempo', segundos: 30.5 })));
teste('validar: falta o campo do tipo (carga sem reps) é recusado', () => recusa(validarSerie({ tipo: 'carga', carga: 60 })));
teste('validar: campo de outro tipo é recusado (corpo com carga)', () => {
  recusa(validarSerie({ tipo: 'corpo', reps: 15, carga: 10 }));
});
teste('validar: campo de outro tipo é recusado (tempo com reps)', () => {
  recusa(validarSerie({ tipo: 'tempo', segundos: 50, reps: 5 }));
});
teste('validar: campo de outro tipo é recusado mesmo valendo 0 (carga com segundos: 0)', () => {
  recusa(validarSerie({ tipo: 'carga', carga: 60, reps: 10, segundos: 0 }));
});
teste('validar: tipo desconhecido é recusado', () => recusa(validarSerie({ tipo: 'cardio', reps: 10 })));
teste('validar: série nula é recusada', () => recusa(validarSerie(null)));

// ---------- Formatação ----------
teste("formatar carga: 62.5 vira '62,5'", () => igual(formatarCarga(62.5), '62,5'));
teste("formatar carga: 60 vira '60'", () => igual(formatarCarga(60), '60'));
teste("formatar carga: 62.25 vira '62,25'", () => igual(formatarCarga(62.25), '62,25'));
teste("formatar tempo: 90 vira '1:30'", () => igual(formatarTempo(90), '1:30'));
teste("formatar tempo: 50 vira '0:50'", () => igual(formatarTempo(50), '0:50'));
teste("formatar tempo: 5 vira '0:05'", () => igual(formatarTempo(5), '0:05'));
teste("formatar tempo: 7200 vira '120:00'", () => igual(formatarTempo(7200), '120:00'));
teste("formatar série carga: { carga: 60, reps: 10 } vira '60 kg × 10'", () => {
  igual(formatarSerie({ tipo: 'carga', carga: 60, reps: 10 }), '60 kg × 10');
});
teste("formatar série carga: { carga: 62.5, reps: 8 } vira '62,5 kg × 8'", () => {
  igual(formatarSerie({ tipo: 'carga', carga: 62.5, reps: 8 }), '62,5 kg × 8');
});
teste("formatar série corpo: { reps: 15 } vira '15 reps'", () => {
  igual(formatarSerie({ tipo: 'corpo', reps: 15 }), '15 reps');
});
teste("formatar série corpo: { reps: 1 } vira '1 rep' (singular)", () => {
  igual(formatarSerie({ tipo: 'corpo', reps: 1 }), '1 rep');
});
teste("formatar série tempo: { segundos: 50 } vira '0:50'", () => {
  igual(formatarSerie({ tipo: 'tempo', segundos: 50 }), '0:50');
});

// ---------- Ida e volta ----------
teste('ida e volta: formatar e ler de novo devolve o mesmo valor (carga e tempo)', () => {
  for (const kg of [0.5, 2.5, 60, 62.5, 62.25, 1000]) aceita(parseCarga(formatarCarga(kg)), kg);
  for (const s of [1, 45, 90, 125, 3600, 7200]) aceita(parseTempo(formatarTempo(s)), s);
});

// ---------- Botões − e + e digitação no número grande (etapa 13) ----------
teste('passos: reps de 1 em 1, tempo de 5 em 5 s, carga de 1 em 1 kg', () => {
  igual(PASSOS, { carga: 1, reps: 1, segundos: 5 });
  igual(aplicarPasso('reps', 10, +1, 'corpo'), 11);
  igual(aplicarPasso('reps', 10, -1, 'carga'), 9);
  igual(aplicarPasso('segundos', 45, +1, 'tempo'), 50);
  igual(aplicarPasso('segundos', 45, -1, 'tempo'), 40);
  igual(aplicarPasso('carga', 60, +1, 'carga'), 61);
  igual(aplicarPasso('carga', 62.5, -1, 'carga'), 61.5);
  igual(aplicarPasso('carga', 0.1, +1, 'carga'), 1.1, 'sem erro de ponto flutuante');
});

teste('passos: nada abaixo do mínimo válido nem acima do máximo', () => {
  igual(aplicarPasso('reps', 1, -1, 'corpo'), null);
  igual(aplicarPasso('segundos', 5, -1, 'tempo'), null, '5 − 5 = 0 não vale');
  igual(aplicarPasso('segundos', 3, -1, 'tempo'), null);
  igual(aplicarPasso('carga', 1, -1, 'carga'), null, '0 kg não vale');
  igual(aplicarPasso('carga', 0.5, -1, 'carga'), null);
  igual(aplicarPasso('reps', 100, +1, 'carga'), null, 'reps em carga vão até 100');
  igual(aplicarPasso('reps', 100, +1, 'corpo'), 101, 'reps em corpo vão até 500');
  igual(aplicarPasso('reps', 500, +1, 'corpo'), null);
  igual(aplicarPasso('segundos', 7200, +1, 'tempo'), null);
  igual(aplicarPasso('carga', 1000, +1, 'carga'), null);
});

teste('digitação: tempo em segundos (90 → 1:30), m:ss também vale; carga aceita vírgula', () => {
  aceita(parseCampo('segundos', '90', 'tempo'), 90);
  igual(formatarCampo('segundos', 90), '1:30');
  aceita(parseCampo('segundos', '1:30', 'tempo'), 90);
  recusa(parseCampo('segundos', '0', 'tempo'));
  aceita(parseCampo('carga', '62,5', 'carga'), 62.5);
  igual(formatarCampo('carga', 62.5), '62,5');
  aceita(parseCampo('reps', '12', 'corpo'), 12);
  recusa(parseCampo('reps', '0', 'corpo'));
  recusa(parseCampo('reps', '8,5', 'carga'));
  recusa(parseCampo('outro', '1', 'corpo'));
});
