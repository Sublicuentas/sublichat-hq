// R210 · Pagos masivos con fecha real, conciliación y regla del 50 % de Geisell (vista previa). Datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planPago, vistaPrevia, previaGeisell, periodoOrigen, claveVendedor, fechaHistoricaValida } from '../api/_obligaciones.js';

const oct = { id: 'a', deudorTipo: 'vendedor', deudorId: 'geissel', deudorNombre: 'Geisell', clienteNombre: 'Cliente Uno', plataforma: 'netflix', montoTotalOperacion: 300, montoRecibidoInicial: 0, montoOriginalPendiente: 300, montoRecibidoPosterior: 0, saldoPendiente: 300, estado: 'pendiente', createdAt: '2026-10-05T15:00:00Z' };
const oct2 = { ...oct, id: 'b', saldoPendiente: 200, montoTotalOperacion: 200, montoOriginalPendiente: 200, createdAt: '2026-10-20T15:00:00Z' };
const nov = { ...oct, id: 'c', saldoPendiente: 150, montoTotalOperacion: 150, montoOriginalPendiente: 150, createdAt: '2026-11-03T15:00:00Z' };

test('período de origen = mes en que nació la obligación (no el del pago)', () => {
  assert.equal(periodoOrigen(oct), '2026-10'); assert.equal(periodoOrigen({ fecha: '05/10/2026' }), '2026-10'); assert.equal(periodoOrigen({}), '');
  assert.equal(claveVendedor('Geissel'), 'geisell');
});

test('pago total del lote de octubre: cierra esas obligaciones; noviembre queda intacto', () => {
  const p = planPago([nov, oct2, oct], 500);
  assert.equal(p.ok, true); assert.equal(p.parcial, true, 'el lote incluye noviembre');
  const solo = planPago([oct, oct2], 500); assert.equal(solo.parcial, false);
  assert.deepEqual(solo.detalle.map((d) => [d.cuentaId, d.aplica, d.queda, d.estado]), [['a', 300, 0, 'pagado'], ['b', 200, 0, 'pagado']]);
});

test('pago parcial: aplica solo lo recibido, de lo más antiguo a lo más nuevo, y conserva el saldo', () => {
  const p = planPago([nov, oct2, oct], 400);
  assert.deepEqual(p.detalle.map((d) => [d.cuentaId, d.aplica, d.queda]), [['a', 300, 0], ['b', 100, 100], ['c', 0, 150]]);
  assert.equal(planPago([oct], 301).ok, false, 'no se acepta más que lo seleccionado');
  assert.equal(planPago([oct], 0).ok, false);
});

test('vista previa: agrupa por deudor y período y señala pagos ya contabilizados SIN vincular (no se vuelven a sumar)', () => {
  const movs = [
    { id: 'm1', tipo: 'ingreso', monto: 500, descripcion: 'Liquidación Geissel octubre', fecha: '2026-10-31', banco: 'BAC' },
    { id: 'm2', tipo: 'ingreso', monto: 500, descripcion: 'Liquidación Geisell', cuentaId: 'x' },          // ya vinculado
    { id: 'm3', tipo: 'ingreso', monto: 80, descripcion: 'Otra persona' },
    { id: 'm4', tipo: 'ingreso', monto: 500, descripcion: 'Geisell', anulado: true },
  ];
  const v = vistaPrevia([oct, oct2, nov, { ...oct, id: 'z', estado: 'pagado', saldoPendiente: 0 }], movs, { deudor: 'geisell' });
  assert.equal(v.grupos.length, 1); const g = v.grupos[0];
  assert.deepEqual(g.periodos.map((p) => [p.periodo, p.total]), [['2026-10', 500], ['2026-11', 150]]);
  assert.deepEqual(g.posiblesPagos.map((m) => m.movimientoId), ['m1']);
  assert.equal(v.total, 650);
});

test('Geisell 50 %: bruto L1,000 → obligación L500; pago L300 → pendiente L200; un neto no se vuelve a dividir; sin negativos', () => {
  const bruto = { ...oct, id: 'g1', montoTotalOperacion: 1000, montoOriginalPendiente: 1000, montoRecibidoInicial: 0, montoRecibidoPosterior: 300, saldoPendiente: 700, estado: 'parcial' };
  const r = previaGeisell([bruto]).filas[0];
  assert.equal(r.obligacion, 500); assert.equal(r.pagado, 300); assert.equal(r.saldoPropuesto, 200); assert.equal(r.diferencia, -500);
  const neto = { ...bruto, id: 'g2', montoOriginalPendiente: 500, montoRecibidoPosterior: 0, saldoPendiente: 500 };
  const n = previaGeisell([neto]).filas[0]; assert.equal(n.yaNeto, true); assert.equal(n.obligacion, 500); assert.equal(n.saldoPropuesto, 500);
  const sobra = previaGeisell([{ ...bruto, montoRecibidoPosterior: 900 }]).filas[0]; assert.equal(sobra.saldoPropuesto, 0); assert.equal(sobra.excedente, 400);
  const otro = { ...bruto, id: 'v1', deudorId: 'heber', deudorNombre: 'Heber' };
  assert.equal(previaGeisell([otro]).filas.length, 0, 'otro vendedor conserva su lógica');
  assert.ok(previaGeisell([]).preguntas.length >= 2);
});

test('fecha histórica autorizada: real, no futura, máximo 180 días', () => {
  assert.equal(fechaHistoricaValida('2026-10-15', '2026-11-28'), '');
  assert.match(fechaHistoricaValida('2026-12-01', '2026-11-28'), /futura/);
  assert.match(fechaHistoricaValida('2026-02-30', '2026-11-28'), /no es válida/);
  assert.match(fechaHistoricaValida('', '2026-11-28'), /fecha real/);
  assert.match(fechaHistoricaValida('2026-01-01', '2026-11-28'), /180/);
});

test('servidor: transacción, idempotencia por operationId, vincular sin ingreso nuevo, permisos y auditoría; la vista previa no escribe', () => {
  const s = fs.readFileSync(new URL('../api/finanzas.js', import.meta.url), 'utf8');
  const i = s.indexOf('if (accion === "registrar_pago_masivo")'), j = s.indexOf('// ---- abono / cobro posterior');
  const blk = s.slice(i, j);
  assert.match(blk, /libroOpDocId\("pagomasivo", body, authUser\.uid\)/);
  assert.match(blk, /if \(ya\.exists\) return \{ duplicado: true/);
  assert.match(blk, /run\(async \(tx\) =>/);
  assert.match(blk, /tipo: "conciliacion", subtipo: "pago_masivo_vinculado", monto: 0/);
  assert.match(blk, /sinEfectoBancario: true/);
  assert.match(blk, /Ese pago ya está vinculado a otra obligación/);
  assert.match(blk, /Solo administración registra pagos masivos/);
  assert.match(blk, /fechaPagoEfectiva: fechaPago, registradoAt: registro/);
  assert.match(blk, /auditar\(tx, db, identity/);
  const pv = s.slice(s.indexOf('if (accion === "listar_obligaciones_previa")'), i);
  assert.doesNotMatch(pv, /\.set\(|\.update\(|run\(/, 'la vista previa es solo lectura');
});
