import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
process.env.FIREBASE_PROJECT_ID ||= 'x'; process.env.FIREBASE_CLIENT_EMAIL ||= 'a'; process.env.FIREBASE_PRIVATE_KEY ||= 'k';
const { FORMULAS, sanitizeMetrics } = req('../api/juegos.js').__internal;
const pts = m => FORMULAS.HANGMAN(sanitizeMetrics('HANGMAN', { pro: true, ...m })).awardedPoints;
const R = (won, secs, hints = 0, wrong = 1, len = 6) => ({ won, secondsRemaining: secs, hints, wrong, len });

test('Ahorcado PRO servidor: 20 por ronda + tiempo (máx 10) + sin pista 5 + racha cada 3 (10) + partida completa 20', () => {
  assert.equal(pts({ rounds: [R(true, 170), R(true, 150), R(true, 120), R(false, 100), R(true, 30)], elapsedMs: 150000 }), 35 + 35 + 45 + 0 + (20 + 6 + 5) + 20);
});
test('Ahorcado PRO servidor: incompleta sin bono; imposible o con trampas no suma', () => {
  assert.equal(pts({ rounds: [R(true, 170)], elapsedMs: 10000 }), 35);
  assert.equal(pts({ rounds: [R(true, 170, 0, 7)], elapsedMs: 10000 }), 0, 'con 7 errores la ronda está perdida');
  assert.equal(pts({ rounds: [R(true, 179), R(true, 179), R(true, 179)], elapsedMs: 200 }), 0, 'demasiado rápido para un humano');
  assert.ok(pts({ rounds: Array(9).fill(R(true, 100)), elapsedMs: 120000 }) <= 5 * 45 + 10 + 20, 'máximo 5 rondas');
});
