// R196t · ESPN responde HTTP 400 al rango «dates=A-B&limit=300» (log de Vercel 15/11). La consulta de un día sí responde.
// Simula ESPN así y comprueba que NBA, MLB, UFC, Tenis, F1 y las ligas de fútbol vuelven a traer partidos.
import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/partidos.js';

const urls = [];
function espnFalso({ caido = false } = {}) {
  globalThis.__partidosCache?.clear?.();
  urls.length = 0;
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    const u = new URL(url); const dates = u.searchParams.get('dates') || '';
    if (caido || dates.includes('-') || u.searchParams.has('limit')) return { ok: false, status: 400, json: async () => ({}) };
    const y = +dates.slice(0, 4), m = +dates.slice(4, 6) - 1, d = +dates.slice(6, 8);
    const iso = new Date(Date.UTC(y, m, d, 23, 0)).toISOString();
    const comp = (a, b) => ({ competitors: [{ homeAway: 'home', team: { displayName: a } }, { homeAway: 'away', team: { displayName: b } }] });
    return { ok: true, status: 200, json: async () => ({ events: [{ id: `${u.pathname}-${dates}`, name: `Partido ${dates}`, shortName: 'P', date: iso, status: { type: { state: 'pre' } }, competitions: [{ ...comp('Local ' + dates, 'Visita'), date: iso, venue: {} }] }] }) };
  };
}
const llamar = (body) => new Promise((ok) => { const res = { h: {}, setHeader() {}, status() { return this; }, json: (j) => ok(j), end: () => ok(null) }; handler({ method: 'POST', body }, res); });

for (const modo of ['nba', 'mlb', 'ufc', 'tenis', 'f1']) {
  test(`${modo}: ya no pide el rango con limit=300 y trae partidos por día`, async () => {
    espnFalso();
    const r = await llamar({ modo });
    assert.equal(r.error, undefined, JSON.stringify(r));
    assert.ok(Array.isArray(r.partidos) && r.partidos.length > 0, JSON.stringify(r).slice(0, 200));
    assert.ok(urls.every((x) => !/limit=300|dates=\d{8}-\d{8}/.test(x)), 'solo consultas de un día');
  });
}
test('fútbol · Copa Centroamericana (futliga) vuelve a cargar', async () => {
  espnFalso();
  const r = await llamar({ modo: 'futliga', liga: 'concacaf.central.american.cup' });
  assert.ok(r.partidos?.length > 0, JSON.stringify(r).slice(0, 200));
});
test('sin duplicados: un evento que aparece en dos días se cuenta una vez', async () => {
  espnFalso();
  const base = globalThis.fetch;
  globalThis.fetch = async (url) => { const r = await base(url); if (!r.ok) return r; return { ok: true, status: 200, json: async () => ({ events: [{ id: 'mismo', name: 'X', date: new Date(Date.now() + 864e5).toISOString(), status: { type: { state: 'pre' } }, competitions: [{ competitors: [{ homeAway: 'home', team: { displayName: 'A' } }, { homeAway: 'away', team: { displayName: 'B' } }] }] }] }) }; };
  const r = await llamar({ modo: 'nba' });
  assert.equal(r.partidos.length, 1);
});
test('si ESPN no responde ningún día: error claro con UN solo motivo (no 11 repetidos)', async () => {
  espnFalso({ caido: true });
  const r = await llamar({ modo: 'mlb' });
  assert.match(r.error, /No pude cargar el calendario/);
  assert.deepEqual(r.detalle, ['baseball/mlb HTTP 400']);
});
