import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { __pruebas } from '../api/finanzas.js';
import { estadosFinancieros, libroDiario, balanzaComprobacion } from '../api/_contabilidad.js';
import { cycleTotals, bankBalances } from '../api/_finanzas-libro.js';

class Ts { constructor(ms) { this.ms = ms; } toMillis() { return this.ms; } }
const methods = [{ id: 'bac', nombre: 'BAC Credomatic', logoKey: 'bac', activo: true }, { id: 'ficohsa', nombre: 'Ficohsa', logoKey: 'ficohsa', activo: true }];
const docs = [
  { id: 'i1', tipo: 'ingreso', subtipo: 'cobro_compra', monto: 240, bancoId: 'bac', plataforma: 'Netflix + Disney', fecha: '02/10/2026', fechaPago: '2026-10-02', fechaTS: new Ts(Date.UTC(2026, 9, 2, 12)) },
  { id: 'i2', tipo: 'ingreso', subtipo: 'cobro_renovacion', monto: 100, bancoId: 'ficohsa', plataforma: 'Spotify', fecha: '03/10/2026', fechaPago: '2026-10-03', fechaTS: new Ts(Date.UTC(2026, 9, 3, 12)) },
  { id: 'e1', tipo: 'egreso', subtipo: 'egreso_operativo', monto: 40, bancoId: 'bac', motivo: 'Internet', fecha: '04/10/2026', fechaPago: '2026-10-04', fechaTS: new Ts(Date.UTC(2026, 9, 4, 12)) },
  { id: 'a1', tipo: 'ingreso', monto: 75, bancoId: 'bac', plataforma: 'Netflix', fecha: '02/10/2026', fechaTS: new Ts(Date.UTC(2026, 9, 2, 12)), estadoFinanciero: 'anulado' },
  { id: 'a1_rev', tipo: 'ingreso', monto: -75, bancoId: 'bac', plataforma: 'Netflix', fecha: '05/10/2026', fechaTS: new Ts(Date.UTC(2026, 9, 5, 12)), reversaDe: 'a1' },
];
const db = {
  collection: (c) => ({
    doc: (id) => ({ get: async () => (c === 'portal_cliente' ? { exists: true, data: () => ({ metodos: methods }) } : { exists: false, data: () => ({}) }) }),
    where: () => ({ get: async () => ({ docs: c === 'finanzas_movimientos' ? docs.map(({ id, ...d }) => ({ id, data: () => d })) : [] }), limit: () => ({ get: async () => ({ docs: [] }) }) }),
  }),
};
const resp = () => { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };

test('R134: /api/finanzas estados_financieros devuelve resultados, flujo, diario y balanza que cuadran', async () => {
  const r = resp();
  await __pruebas.handleLibro(db, 'estados_financieros', { mes: '2026-10' }, { usuario: 'sublicuentas', role: 'sublicuentas' }, { uid: 'u' }, r);
  assert.equal(r.code, 200); assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const b = r.body;
  assert.equal(b.nombre, 'Octubre 2026');
  assert.equal(b.resultados.ingresos.total, 340); assert.equal(b.resultados.utilidadNeta, 300);
  assert.equal(b.resultados.utilidadNeta, cycleTotals(docs, '2026-10-01', '2026-10-31').resultado, 'igual que cierres');
  assert.ok(b.balanza.cuadra); assert.equal(b.diario.length, 3);
  assert.ok(b.flujo.cuadra); assert.equal(b.flujo.saldoFinal, 300);
  assert.equal(b.flujo.bancos.find((x) => x.id === 'bac').saldoFinal, bankBalances(docs, { bases: {} }, methods).bancos.find((x) => x.id === 'bac').saldo);
});

test('R134: la web tiene "Estados financieros" y llama a la misma acción', () => {
  const app = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(app, /accion: ?"estados_financieros"/);
  assert.match(app, /data-fin-estados/);
});
