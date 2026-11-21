// R200d · Fútbol del día completo (hora de Honduras). ESPN simulado, datos ficticios.
// Todas las competiciones del día, horario HN (incluye partidos de 11 p. m. que en EE. UU. ya son otro día),
// estados (por jugar, en vivo, final, aplazado, suspendido, cancelado), canal sin inventar y aviso honesto si falla una fuente.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import handler from '../api/partidos.js';
import { estadoFutbol, LIGAS_FUTBOL_DIA, CANAL_SIN_CONFIRMAR, diaHN } from '../api/_futbol-dia.js';

const FECHA = diaHN(Date.now());
const urls = [];
const ev = (id, isoUtc, a, b, type, extra = {}) => ({ id, date: isoUtc, status: { type, ...(extra.status || {}) }, competitions: [{ date: isoUtc, venue: { fullName: 'Estadio Prueba' }, competitors: [{ homeAway: 'home', team: { shortDisplayName: a, logo: 'https://x/a.png' }, score: '2' }, { homeAway: 'away', team: { shortDisplayName: b }, score: '1' }] }] });
const utc = (ymd, hh, mm = 0) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, hh, mm)).toISOString(); };
const sig = (ymd) => new Date(Date.parse(ymd + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10);
const ant = (ymd) => new Date(Date.parse(ymd + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);

function espn({ caidas = [] } = {}) {
  globalThis.__partidosCache?.clear?.(); urls.length = 0;
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    const u = new URL(url); const slug = u.pathname.split('/soccer/')[1]?.split('/')[0]; const dates = u.searchParams.get('dates');
    const ymd = `${dates.slice(0, 4)}-${dates.slice(4, 6)}-${dates.slice(6, 8)}`;
    if (caidas.includes(slug)) return { ok: false, status: 503, json: async () => ({}) };
    const L = (name, events) => ({ ok: true, status: 200, json: async () => ({ leagues: [{ name }], events }) });
    if (slug === 'hon.1' && ymd === FECHA) return L('Honduran Liga Nacional', [
      ev('h1', utc(FECHA, 1), 'Olimpia', 'Motagua', { state: 'post', name: 'STATUS_FULL_TIME', completed: true }), // 7 p. m. HN del día ANTERIOR → fuera
      ev('h2', utc(FECHA, 20), 'Real España', 'Marathón', { state: 'pre', name: 'STATUS_SCHEDULED' }), // 2 p. m. HN
      ev('h3', utc(FECHA, 23), 'Olimpia', 'Victoria', { state: 'in', name: 'STATUS_IN_PROGRESS' }, { status: { displayClock: "67'" } }),
    ]);
    if (slug === 'hon.1' && ymd === sig(FECHA)) return L('Honduran Liga Nacional', [
      ev('h4', utc(sig(FECHA), 5), 'Génesis', 'Lobos', { state: 'pre', name: 'STATUS_SCHEDULED' }), // 11 p. m. HN del día → DENTRO
      ev('h3', utc(FECHA, 23), 'Olimpia', 'Victoria', { state: 'in', name: 'STATUS_IN_PROGRESS' }), // repetido
    ]);
    if (slug === 'eng.1' && ymd === FECHA) return L('English Premier League', [
      ev('e1', utc(FECHA, 15), 'Arsenal', 'Chelsea', { state: 'post', name: 'STATUS_FINAL_PEN', completed: true }),
      ev('e2', utc(FECHA, 17), 'Everton', 'Fulham', { state: 'post', name: 'STATUS_POSTPONED' }),
      ev('e3', utc(FECHA, 12), 'Leeds', 'Wolves', { state: 'in', name: 'STATUS_SUSPENDED' }),
      ev('e4', utc(FECHA, 19), 'Spurs', 'Villa', { state: 'post', name: 'STATUS_CANCELED' }),
    ]);
    if (slug === 'concacaf.central.american.cup' && ymd === FECHA) return L('Concacaf Central American Cup', [ev('c1', utc(FECHA, 18), 'Honduras', 'Panamá', { state: 'pre', name: 'STATUS_SCHEDULED' })]);
    if (slug === 'zzz.inexistente') return { ok: false, status: 404, json: async () => ({}) };
    return L('', []);
  };
}
const llamar = (body) => new Promise((ok) => { const res = { setHeader() {}, status() { return this; }, json: (j) => ok(j), end: () => ok(null) }; handler({ method: 'POST', body }, res); });

test('1 · trae TODAS las competiciones del día en hora de Honduras, sin repetidos y con nombre de liga de ESPN', async () => {
  espn();
  const r = await llamar({ modo: 'futbol_dia', fecha: FECHA });
  assert.equal(r.error, undefined, JSON.stringify(r).slice(0, 300));
  const ids = r.partidos.map((p) => p.id).sort();
  assert.deepEqual(ids, ['c1', 'e1', 'e2', 'e3', 'e4', 'h2', 'h3', 'h4'], 'h1 es de ayer en Honduras; h4 (11 p. m. HN) sí entra; h3 una vez');
  assert.ok(r.partidos.every((p) => p.dia === FECHA));
  assert.equal(r.partidos.find((p) => p.id === 'h4').horaHN.replace(/\s| /g, ''), '11:00p.m.');
  assert.equal(r.partidos.find((p) => p.id === 'h2').liga, 'Honduran Liga Nacional');
  assert.ok(LIGAS_FUTBOL_DIA.length >= 70, 'competiciones consultadas: ' + LIGAS_FUTBOL_DIA.length);
  assert.equal(r.cobertura.consultadas, LIGAS_FUTBOL_DIA.length);
  assert.equal(r.verificado, true); assert.equal(r.total, 8);
  assert.deepEqual(r.competiciones.map((c) => c.nombre), ['English Premier League', 'Honduran Liga Nacional', 'Concacaf Central American Cup']);
  const ts = r.partidos.map((p) => p.ts); assert.deepEqual(ts, ts.slice().sort((a, b) => a - b), 'ordenados por hora');
  // ligas de América: también se consulta el día siguiente; Europa solo el día
  assert.ok(urls.some((u) => u.includes('/hon.1/') && u.includes(sig(FECHA).replace(/-/g, ''))));
  assert.ok(!urls.some((u) => u.includes('/eng.1/') && u.includes(sig(FECHA).replace(/-/g, ''))));
});

test('2 · estados: en vivo solo con state=in; aplazado, suspendido, cancelado, final (penales); marcador solo si se jugó', async () => {
  espn();
  const r = await llamar({ modo: 'futbol_dia', fecha: FECHA });
  const P = Object.fromEntries(r.partidos.map((p) => [p.id, p]));
  assert.equal(P.h3.estado, 'LIVE'); assert.equal(P.h3.estadoTxt, "67'"); assert.equal(P.h3.golesLocal, 2);
  assert.equal(P.h2.estado, 'NS'); assert.equal(P.h2.golesLocal, null, 'sin marcador antes de jugar');
  assert.equal(P.e1.estado, 'FT'); assert.equal(P.e1.estadoTxt, 'Final (penales)');
  assert.equal(P.e2.estado, 'POSP'); assert.equal(P.e2.golesLocal, null);
  assert.equal(P.e3.estado, 'SUSP', 'suspendido aunque ESPN diga state=in');
  assert.equal(P.e4.estado, 'CANC');
  assert.deepEqual(r.conteo, { NS: 3, LIVE: 1, FT: 1, POSP: 1, SUSP: 1, CANC: 1 });
  assert.equal(estadoFutbol({ status: { type: { state: 'in', name: 'STATUS_HALFTIME' } } }).texto, 'Medio tiempo');
});

test('3 · canal: nunca inventado → «Canal sin confirmar», salvo la Copa Centroamericana (canal confirmado)', async () => {
  espn();
  const r = await llamar({ modo: 'futbol_dia', fecha: FECHA });
  for (const p of r.partidos) {
    if (p.ligaSlug === 'concacaf.central.american.cup') { assert.match(p.canal, /ESPN/); assert.equal(p.canalConfirmado, true); }
    else { assert.equal(p.canal, CANAL_SIN_CONFIRMAR); assert.equal(p.canalConfirmado, false); assert.doesNotMatch(p.canal, /aprox/); }
  }
});

test('4 · una fuente caída: se muestran las demás y se AVISA; nunca «no hay partidos» sin verificar', async () => {
  espn({ caidas: ['eng.1'] });
  const r = await llamar({ modo: 'futbol_dia', fecha: FECHA });
  assert.equal(r.verificado, false);
  assert.match(r.aviso, /puede haber más partidos/);
  assert.ok(r.cobertura.fallidas.some((f) => /eng\.1|Premier/.test(f.nombre + f.motivo)));
  assert.ok(r.partidos.length >= 4);
  // día sin partidos y TODO caído → no afirma que no hay
  globalThis.__partidosCache?.clear?.();
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  const r2 = await llamar({ modo: 'futbol_dia', fecha: FECHA });
  assert.equal(r2.total, 0); assert.equal(r2.verificado, false);
  assert.match(r2.aviso, /No se pudo verificar/); assert.doesNotMatch(r2.aviso, /no tienen partidos/);
  // día sin partidos con todo respondiendo → sí se puede decir
  espn(); globalThis.fetch = async (u) => ({ ok: true, status: 200, json: async () => ({ leagues: [{ name: 'X' }], events: [] }) });
  const r3 = await llamar({ modo: 'futbol_dia', fecha: ant(FECHA) });
  assert.equal(r3.verificado, true); assert.match(r3.aviso, /no tienen partidos este día/);
});

test('5 · fecha fuera de ±7 días se rechaza; NBA, MLB, UFC, Tenis y F1 siguen con su modo propio', async () => {
  espn();
  const r = await llamar({ modo: 'futbol_dia', fecha: '2020-01-01' });
  assert.match(r.error, /7 días/);
  const src = fs.readFileSync(new URL('../api/partidos.js', import.meta.url), 'utf8');
  for (const m of ['nba', 'mlb', 'ufc', 'tenis', 'f1']) assert.match(src, new RegExp(`modo === "${m}"`));
});

test('6 · Web: «Todas las competiciones» por defecto en Fútbol, navegador de fecha, filtros, conteo, agrupado y «Mostrar más»', () => {
  const h = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const js = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(h, /data-futdia="1"[^>]*>Todas las competiciones/);
  assert.match(js, /modo:\s*"futbol_dia"/);
  for (const k of ['fdComp', 'fdPais', 'fdEstado', 'fdEquipo']) assert.match(js, new RegExp(k));
  assert.match(js, /Mostrar más/); assert.match(js, /Canal sin confirmar|canalConfirmado/);
  assert.match(js, /function escP\(/, 'textos de ESPN escapados');
});
