import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Firestore simulado en memoria (tests/../node_modules/firebase-admin, solo para pruebas — no se entrega en el zip).
const req = createRequire(import.meta.url);
process.env.FIREBASE_PROJECT_ID = 'x'; process.env.FIREBASE_CLIENT_EMAIL = 'a'; process.env.FIREBASE_PRIVATE_KEY = 'k';
const handler = req('../api/juegos.js');
const admin = req('firebase-admin');
const { FORMULAS, sanitizeMetrics, badgeFor, computeStreak, hnWeekStartStr } = handler.__internal;

const call = async (body, token = '{"usuario":"naara"}') => {
  const r = { code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {}, end() {} };
  await handler({ method: 'POST', headers: { authorization: `Bearer ${token}` }, body }, r);
  return r;
};
const METRICS = {
  HANGMAN: { solvedWords: 5, totalWrongLetters: 0, hintsUsed: 0, timeLimitSec: 180, timeRemainingSec: 180 },
  MEMORY_PAIRS: { pairsFound: 12, moves: 12, maxCombo: 5, timeLimitSec: 120, timeRemainingSec: 120 },
  WORD_SEARCH: { foundWords: 12, wrongSelections: 0, hintsUsed: 0, maxCombo: 12, timeLimitSec: 240, timeRemainingSec: 240 },
  BASKETBALL: { made: 5, swish: 5, bestStreak: 5, avgAccuracy: 100 },
  DARTS: { finished: true, dartsUsed: 9, avgAccuracy: 100, bonusHits: 10 },
  COLOR_CHALLENGE: { completed: true, precisionPct: 100, wrongChanges: 0, finePremium: true },
};

test('Fórmulas: un juego perfecto de cada uno de los 6 llega exactamente a 1000 SP (según el PDF)', () => {
  for (const [code, m] of Object.entries(METRICS)) assert.equal(FORMULAS[code](m).awardedPoints, 1000, code);
  assert.equal(FORMULAS.WORD_SEARCH({ ...METRICS.WORD_SEARCH, foundWords: 0, timeRemainingSec: 0, maxCombo: 0 }).awardedPoints, 0);
  assert.equal(FORMULAS.COLOR_CHALLENGE({ completed: true, precisionPct: 65, wrongChanges: 0, finePremium: false }).awardedPoints, 0, 'menos de 70% de precisión = 0 SP (Modo Reto)');
  assert.ok(FORMULAS.HANGMAN({ ...METRICS.HANGMAN, hintsUsed: 2 }).awardedPoints < 1000, 'las pistas restan puntos');
});

test('sanitizeMetrics: nunca copia awardedPoints/rawScore del cliente y acota valores imposibles', () => {
  const c = sanitizeMetrics('WORD_SEARCH', { foundWords: 999, awardedPoints: 999999, rawScore: 999999, wrongSelections: -5, hintsUsed: 2, maxCombo: 999, timeLimitSec: 240, timeRemainingSec: 240 });
  assert.equal(c.awardedPoints, undefined); assert.equal(c.rawScore, undefined);
  assert.ok(FORMULAS.WORD_SEARCH(c).awardedPoints <= 1000);
  assert.equal(sanitizeMetrics('NO_EXISTE', {}), null);
});

test('registrar: idempotente por roundId (repetir la misma partida no acredita dos veces ni pierde el saldo)', async () => {
  admin.__reset();
  let r = await call({ accion: 'registrar', gameCode: 'MEMORY_PAIRS', roundId: 'r1', metrics: METRICS.MEMORY_PAIRS });
  assert.equal(r.body.awardedPoints, 1000); assert.equal(r.body.totalPoints, 1000); assert.equal(r.body.repetido, false);
  r = await call({ accion: 'registrar', gameCode: 'MEMORY_PAIRS', roundId: 'r1', metrics: { pairsFound: 1 } });
  assert.equal(r.body.awardedPoints, 1000, 'no se recalcula con las métricas nuevas: se ignoran');
  assert.equal(r.body.totalPoints, 1000, 'el saldo sigue siendo el correcto, no se pierde ni se duplica');
  assert.equal(r.body.repetido, true);
});

test('registrar: respeta el tope diario GLOBAL (6000) y el tope POR JUEGO (1500)', async () => {
  admin.__reset();
  let i = 0; for (const [code, m] of Object.entries(METRICS)) await call({ accion: 'registrar', gameCode: code, roundId: `g${i++}`, metrics: m });
  let r = await call({ accion: 'resumen' });
  assert.equal(r.body.totalPoints, 6000, '6 juegos distintos de 1000 SP llegan justo al tope global');
  r = await call({ accion: 'registrar', gameCode: 'HANGMAN', roundId: 'extra', metrics: METRICS.HANGMAN });
  assert.equal(r.body.awardedPoints, 0); assert.equal(r.body.totalPoints, 6000);

  admin.__reset();
  await call({ accion: 'registrar', gameCode: 'MEMORY_PAIRS', roundId: 'p1', metrics: METRICS.MEMORY_PAIRS });
  r = await call({ accion: 'registrar', gameCode: 'MEMORY_PAIRS', roundId: 'p2', metrics: METRICS.MEMORY_PAIRS });
  assert.equal(r.body.awardedPoints, 500, 'segunda ronda del mismo juego: solo queda espacio para 500 antes del tope de 1500');
  r = await call({ accion: 'registrar', gameCode: 'MEMORY_PAIRS', roundId: 'p3', metrics: METRICS.MEMORY_PAIRS });
  assert.equal(r.body.awardedPoints, 0); assert.equal(r.body.totalPoints, 1500);
});

test('resumen: refleja puntos, racha e insignia; racha sube una vez por día válido', () => {
  assert.deepEqual(computeStreak({}, '2026-09-21'), { current: 1, best: 1, lastActiveDate: '2026-09-21' });
  assert.deepEqual(computeStreak({ current: 3, best: 5, lastActiveDate: '2026-09-20' }, '2026-09-21'), { current: 4, best: 5, lastActiveDate: '2026-09-21' });
  assert.deepEqual(computeStreak({ current: 3, best: 5, lastActiveDate: '2026-09-21' }, '2026-09-21'), { current: 3, best: 5 });
  assert.deepEqual(computeStreak({ current: 3, best: 5, lastActiveDate: '2026-09-10' }, '2026-09-21'), { current: 1, best: 5, lastActiveDate: '2026-09-21' });
  assert.equal(badgeFor(0).code, 'EXPLORADOR'); assert.equal(badgeFor(2500).code, 'AVANZADO'); assert.equal(badgeFor(7500).code, 'EXPERTO'); assert.equal(badgeFor(15000).code, 'MAESTRO'); assert.equal(badgeFor(30000).code, 'LEYENDA');
});

test('ranking: general (lifetime), semanal (mejor por juego y por día) y por juego, entre jugadores reales', async () => {
  admin.__reset();
  await call({ accion: 'registrar', gameCode: 'HANGMAN', roundId: 'a1', metrics: METRICS.HANGMAN }, '{"usuario":"naara"}');
  await call({ accion: 'registrar', gameCode: 'HANGMAN', roundId: 'b1', metrics: { ...METRICS.HANGMAN, solvedWords: 1 } }, '{"usuario":"libni"}');
  let r = await call({ accion: 'ranking', scope: 'general' });
  assert.equal(r.body.entries[0].userId, 'sublicuentas'); assert.ok(r.body.entries[0].score > r.body.entries[1].score);
  assert.equal(r.body.entries[0].displayName, 'Sublicuentas', 'R58: nombre del acceso, nunca el nombre personal');
  assert.equal(r.body.entries[1].displayName, 'Relojes');

  admin.__reset();
  await call({ accion: 'registrar', gameCode: 'MEMORY_PAIRS', roundId: 'w1', metrics: METRICS.MEMORY_PAIRS }, '{"usuario":"naara"}');
  await call({ accion: 'registrar', gameCode: 'HANGMAN', roundId: 'w2', metrics: { ...METRICS.HANGMAN, totalWrongLetters: 5, timeRemainingSec: 60 } }, '{"usuario":"naara"}');
  r = await call({ accion: 'ranking', scope: 'semanal' });
  assert.equal(r.body.period.from, hnWeekStartStr());
  assert.equal(r.body.entries[0].userId, 'sublicuentas'); assert.ok(r.body.entries[0].score > 1000, 'suma el mejor resultado de CADA juego, no solo el más alto');
  r = await call({ accion: 'ranking', scope: 'porJuego', gameCode: 'MEMORY_PAIRS' });
  assert.equal(r.body.entries[0].score, 1000);
  r = await call({ accion: 'ranking', scope: 'porJuego', gameCode: 'NOPE' });
  assert.equal(r.code, 400);
});

test('seguridad: sin token o token inválido no entrega ni acredita nada', async () => {
  let r = await call({ accion: 'resumen' }, 'bad'); assert.equal(r.code, 401);
  r = await call({}, ''); assert.equal(r.code, 401);
  r = await call({ accion: 'registrar', gameCode: 'BOGUS', roundId: 'x', metrics: {} });
  assert.equal(r.code, 400);
});
