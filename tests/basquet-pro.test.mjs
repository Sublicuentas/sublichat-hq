import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
process.env.FIREBASE_PROJECT_ID ||= 'x'; process.env.FIREBASE_CLIENT_EMAIL ||= 'a'; process.env.FIREBASE_PRIVATE_KEY ||= 'k';
const { FORMULAS, sanitizeMetrics, basquetSimulate } = req('../api/juegos.js').__internal;
const pts = m => FORMULAS.BASKETBALL(sanitizeMetrics('BASKETBALL', { pro: true, ...m })).awardedPoints;
// buscar tiros reales que encesten para cada aro
const find = (hx, wantSwish) => { for (let a = 25; a <= 85; a++) for (let p = 10; p <= 100; p++) { const r = basquetSimulate(a, p, hx); if (r.scored && r.swish === wantSwish) return { angle: a, power: p, hoopX: hx }; } };

test('Básquet PRO servidor: simula cada tiro; limpia 3, normal 2 (×10 SP); 5/5 +25; 3 limpias +15', () => {
  const sw = [0.62, 0.70, 0.78, 0.84, 0.66].map(h => find(h, true));
  assert.equal(pts({ shots: sw, elapsedMs: 40000 }), 5 * 3 * 10 + 25 + 15);
  const normal = find(0.7, false);
  assert.equal(pts({ shots: [normal, { angle: 30, power: 10, hoopX: 0.8 }], elapsedMs: 10000 }), 20);
});
test('Básquet PRO servidor: no acepta "encesté" del teléfono ni tiros imposibles de rápidos', () => {
  assert.equal(pts({ shots: [{ angle: 30, power: 10, hoopX: 0.8 }], made: 5, swish: 5, elapsedMs: 10000 }), 0);
  assert.equal(pts({ shots: [find(0.7, true), find(0.7, true)], elapsedMs: 300 }), 0);
  assert.ok(pts({ shots: Array(9).fill(find(0.7, true)), elapsedMs: 60000 }) <= 5 * 30 + 25 + 15, 'máximo 5 tiros');
});
