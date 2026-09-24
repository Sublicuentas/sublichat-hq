import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
process.env.FIREBASE_PROJECT_ID ||= 'x'; process.env.FIREBASE_CLIENT_EMAIL ||= 'a'; process.env.FIREBASE_PRIVATE_KEY ||= 'k';
const { FORMULAS, sanitizeMetrics } = req('../api/juegos.js').__internal;
const grid = ['CHBAZO', 'QTLLIU', 'KHAUDI', 'CJQVIG', 'TGHAAM', 'RIPDRP'];
const base = { levelId: 'atencion', grid, words: ['BAZO', 'AUDI', 'UVA'], hintsUsed: 0, elapsedMs: 30000 };
// UVA vertical en columna 5? no: se usa una que sí existe → reemplazo por palabras del tablero
const g2 = ['CHBAZO', 'QTLLIU', 'KHAUDI', 'CJQVIG', 'TGHAAM', 'RIPDRP'];
const words = ['BAZO', 'AUDI', 'OUI'];
const pts = sel => FORMULAS.WORD_SEARCH(sanitizeMetrics('WORD_SEARCH', { ...base, grid: g2, words, selections: sel })).awardedPoints;
const BAZO = { r1: 0, c1: 2, r2: 0, c2: 5 }, AUDI = { r1: 2, c1: 2, r2: 2, c2: 5 }, OUI = { r1: 0, c1: 5, r2: 2, c2: 5 };

test('Sopa PRO servidor: ronda completa = 20×palabras + 30 + sin pistas 15 + rapidez', () => {
  assert.equal(pts([BAZO, AUDI, OUI]), 3 * 20 + 30 + 15 + Math.round(25 * (1 - 30000 / 60000)));
});
test('Sopa PRO servidor: palabra al revés vale; incompleta, repetida, torcida o fuera del grid no acredita', () => {
  assert.ok(pts([{ r1: 0, c1: 5, r2: 0, c2: 2 }, AUDI, OUI]) > 0, 'BAZO seleccionada al revés');
  assert.equal(pts([BAZO, AUDI]), 0, 'incompleta = 0');
  assert.equal(pts([BAZO, BAZO, AUDI]), 0, 'la misma palabra dos veces no cuenta doble');
  assert.equal(pts([BAZO, AUDI, { r1: 0, c1: 5, r2: 2, c2: 4 }]), 0, 'trazo no alineado');
  assert.equal(pts([BAZO, AUDI, { r1: 0, c1: 5, r2: 9, c2: 5 }]), 0, 'fuera del grid');
  const conPista = FORMULAS.WORD_SEARCH(sanitizeMetrics('WORD_SEARCH', { ...base, grid: g2, words, hintsUsed: 2, elapsedMs: 90000, selections: [BAZO, AUDI, OUI] })).awardedPoints;
  assert.equal(conPista, 60 + 30 - 20);
});
