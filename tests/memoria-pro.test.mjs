import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
process.env.FIREBASE_PROJECT_ID ||= 'x'; process.env.FIREBASE_CLIENT_EMAIL ||= 'a'; process.env.FIREBASE_PRIVATE_KEY ||= 'k';
const { FORMULAS, sanitizeMetrics } = req('../api/juegos.js').__internal;
const pts = m => FORMULAS.MEMORY_PAIRS(sanitizeMetrics('MEMORY_PAIRS', { pro: true, ...m })).awardedPoints;

test('Memoria servidor: pares + completar + bono de tiempo según el modo (pack oficial)', () => {
  assert.equal(pts({ mode: 'EASY', pairsFound: 6, completed: true, secondsRemaining: 30, elapsedMs: 45000 }), 6 * 10 + 30 + 15);
  assert.equal(pts({ mode: 'MEDIUM', pairsFound: 8, completed: true, secondsRemaining: 55, elapsedMs: 20000 }), 8 * 15 + 50 + Math.min(30, Math.floor(35 / 2)), 'el tiempo restante no puede superar el real');
  assert.equal(pts({ mode: 'HARD', pairsFound: 10, completed: true, secondsRemaining: 30, elapsedMs: 10000 }), 200 + 80 + 15);
});
test('Memoria servidor: por tiempo agotado conserva los pares, sin bonos; trampas no suman', () => {
  assert.equal(pts({ mode: 'EASY', pairsFound: 3, completed: false, secondsRemaining: 0, elapsedMs: 75000 }), 30);
  assert.equal(pts({ mode: 'EASY', pairsFound: 99, completed: true, secondsRemaining: 70, elapsedMs: 70000 }), 6 * 10 + 30 + 2, 'no más pares que el modo');
  assert.equal(pts({ mode: 'HARD', pairsFound: 10, completed: true, secondsRemaining: 40, elapsedMs: 100 }), 0, 'imposible para un humano');
});
