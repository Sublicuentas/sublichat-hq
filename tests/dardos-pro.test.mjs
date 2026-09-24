import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'x'; process.env.FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || 'a'; process.env.FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY || 'k';
const { dartScore, dartsReplay, FORMULAS, sanitizeMetrics } = req('../api/juegos.js').__internal;
const T20 = { nx: 0, ny: -0.6 }, BULL = { nx: 0, ny: 0 };
const ONE = { nx: Math.sin(Math.PI / 10) * 0.4, ny: -Math.cos(Math.PI / 10) * 0.4 };

test('Dardos PRO servidor: centro 50, bull exterior 25, triple 20 = 60, doble 20 = 40, fuera 0', () => {
  assert.equal(dartScore(0, 0).score, 50); assert.equal(dartScore(0.05, 0).score, 25);
  assert.equal(dartScore(0, -0.6).score, 60); assert.equal(dartScore(0, -0.97).score, 40); assert.equal(dartScore(1.1, 0).score, 0);
});
test('Dardos PRO servidor: 301, bust restaura el turno, 0 exacto gana; recalcula sin confiar en el APK', () => {
  const won = dartsReplay([T20, T20, T20, T20, T20, ONE], 12);
  assert.equal(won.won, true); assert.equal(won.dartsUsed, 6); assert.equal(won.triple20s, 5);
  const bust = dartsReplay([T20, T20, T20, T20, BULL, BULL, BULL], 12);
  assert.equal(bust.remaining, 71); assert.equal(bust.won, false);
  const cheat = sanitizeMetrics('DARTS', { throws: [T20], finished: true, dartsUsed: 1, avgAccuracy: 100, bonusHits: 10 });
  assert.equal(FORMULAS.DARTS(cheat).awardedPoints, 0, 'mandar "finished" sin las coordenadas no da SP');
  const pts = FORMULAS.DARTS(sanitizeMetrics('DARTS', { throws: [T20, T20, T20, T20, T20, ONE] })).awardedPoints;
  assert.ok(pts > 800 && pts <= 1000, 'misma economía que los otros juegos (máx 1000 por partida)');
});

test('Dardos PRO servidor: si se acabó el tiempo no cuenta como ganada', () => {
  const ok = FORMULAS.DARTS(sanitizeMetrics('DARTS', { throws: [T20, T20, T20, T20, T20, ONE], elapsedMs: 60000, timeLimitMs: 120000 })).awardedPoints;
  const tarde = FORMULAS.DARTS(sanitizeMetrics('DARTS', { throws: [T20, T20, T20, T20, T20, ONE], elapsedMs: 200000, timeLimitMs: 120000 })).awardedPoints;
  assert.ok(ok > tarde, 'fuera de tiempo pierde el bono de ganar');
});
