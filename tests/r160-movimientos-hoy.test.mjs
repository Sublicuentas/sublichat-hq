// R160 · Movimientos: con muchos documentos en el ciclo, los de HOY deben salir (antes se cortaban al pasar de 1 500).
import test from 'node:test';
import assert from 'node:assert/strict';
import { __pruebas } from '../api/finanzas.js';

class Ts { constructor(ms) { this.ms = ms; } toMillis() { return this.ms; } valueOf() { return this.ms; } }
const methods = [{ id: 'bac', nombre: 'BAC Credomatic', logoKey: 'bac', activo: true }];
function fakeDb(docs) {
  const query = (c, f = [], ord = null, lim = Infinity) => ({
    where: (campo, op, v) => query(c, [...f, [campo, op, v]], ord, lim),
    orderBy: (campo, dir = 'asc') => query(c, f, [campo, dir], lim),
    limit: (n) => query(c, f, ord, n),
    get: async () => {
      if (c !== 'finanzas_movimientos') return { docs: [] };
      let rows = docs.filter((d) => f.every(([k, op, v]) => { const a = Number(d[k]?.ms ?? d[k]), b = Number(v?.toMillis ? v.toMillis() : v); return op === '>=' ? a >= b : op === '<' ? a < b : op === '<=' ? a <= b : true; }));
      rows.sort((a, b) => Number(a.fechaTS.ms) - Number(b.fechaTS.ms)); // Firestore: ascendente si no se pide otro orden
      if (ord && ord[1] === 'desc') rows.reverse();
      return { docs: rows.slice(0, lim).map(({ id, ...d }) => ({ id, data: () => d })) };
    },
  });
  return { collection: (c) => ({ ...query(c), doc: () => ({ get: async () => (c === 'portal_cliente' ? { exists: true, data: () => ({ metodos: methods }) } : { exists: false, data: () => ({}) }) }) }) };
}
const resp = () => { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
const dia = (d, i) => ({ id: `m${d}_${i}`, tipo: 'ingreso', subtipo: 'cobro_renovacion', monto: 100, bancoId: 'bac', cliente: `Cliente ${i}`, fechaPago: `2026-10-${String(d).padStart(2, '0')}`, fecha: `${String(d).padStart(2, '0')}/10/2026`, fechaTS: new Ts(Date.UTC(2026, 9, d)), createdAt: `2026-10-${String(d).padStart(2, '0')}T15:00:00Z` });

test('R160: Movimientos muestra los de hoy aunque el ciclo tenga más de 1 500 documentos', async () => {
  const docs = [];
  for (let d = 1; d <= 30; d++) for (let i = 0; i < 70; i++) docs.push(dia(d, i)); // 2 100 documentos del 1 al 30
  docs.push({ ...dia(31, 1), cliente: 'Cliente de hoy' });
  const r = resp();
  await __pruebas.handleLibro(fakeDb(docs), 'finanzas_movimientos', {}, { usuario: 'relojes', role: 'relojes' }, { uid: 'u' }, r);
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  assert.equal(r.body.movimientos[0].id, 'm31_1', 'el de hoy va primero');
  assert.equal(r.body.movimientos[0].fecha, '2026-10-31');
});

test('R160: con rango Desde/Hasta solo trae ese rango', async () => {
  const docs = [dia(29, 1), dia(30, 1), dia(31, 1)];
  const r = resp();
  await __pruebas.handleLibro(fakeDb(docs), 'finanzas_movimientos', { desde: '2026-10-30', hasta: '2026-10-30' }, { usuario: 'relojes', role: 'relojes' }, { uid: 'u' }, r);
  assert.deepEqual(r.body.movimientos.map((m) => m.fecha), ['2026-10-30']);
});
