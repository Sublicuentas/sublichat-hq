// R193 · Finanzas por PRODUCTO canónico (PDF «Corrección urgente Sala 3D y Finanzas APK», F01–F12). Datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { periodoHN, resumenMes, atribuirPago } from '../api/_finanzas-mes.js';
import { resolverProducto, PRODUCTOS, PENDIENTE } from '../api/_productos-canonicos.js';

const NOV = periodoHN(new Date(), '2026-11');
const mov = (id, tipo, monto, f, extra = {}) => ({ id, tipo, monto, fechaPago: f, ...extra });
const ing = (op, monto, plataforma, extra = {}) => mov(`${op}_cobro`, 'ingreso', monto, extra.f || '2026-11-05', { operacionId: op, plataforma, ...extra });
const fila = (r, nombre) => r.cobrosPorProducto.filter((x) => x.plataforma === nombre);

test('F01: noviembre en hora de Honduras: solo pagos del 01 al 30', () => {
  const r = resumenMes([ing('oct', 999, 'netflix', { f: '2026-10-31' }), ing('nov', 130, 'netflix'), ing('dic', 50, 'netflix', { f: '2026-12-01' })], NOV);
  assert.equal(r.ingresos, 130);
  assert.equal(periodoHN(new Date('2026-12-01T05:59:00Z')).periodo, '2026-11');
});

test('F02/F03: Netflix Premium y Netflix VIP con fila única cada uno; alias del mismo producto se consolidan sin perder pagos', () => {
  const r = resumenMes([ing('a', 130, 'netflix'), ing('b', 130, 'Netflix Premium'), ing('c', 90, 'Netflix'), ing('d', 150, 'vipnetflix'), ing('e', 150, 'netflixvip')], NOV);
  assert.equal(fila(r, 'Netflix Premium').length, 1); assert.equal(fila(r, 'Netflix Premium')[0].monto, 350); assert.equal(fila(r, 'Netflix Premium')[0].pagos, 3);
  assert.equal(fila(r, 'Netflix VIP').length, 1); assert.equal(fila(r, 'Netflix VIP')[0].monto, 300);
  assert.notEqual(PRODUCTOS.netflix, PRODUCTOS.vipnetflix, 'productos distintos');
  assert.equal(new Set(r.cobrosPorProducto.map((x) => x.plataforma)).size, r.cobrosPorProducto.length, 'sin nombres repetidos');
});

test('F04: «Netflix Premium VIP» (texto) es ambiguo → revisión; con la ficha del servicio o un alias confirmado se resuelve', () => {
  assert.equal(resolverProducto('⭐ Netflix Premium VIP').ambiguo, true);
  assert.equal(resolverProducto('Netflix Premium VIP').id, PENDIENTE);
  const movs = [ing('x', 150, 'Netflix Premium VIP', { clienteId: 'c1', compraId: 'k1' })];
  assert.equal(resumenMes(movs, NOV).pendienteClasificar.monto, 150);
  const conFicha = resumenMes(movs, NOV, { evidencia: (c, k) => (c === 'c1' && k === 'k1' ? 'vipnetflix' : '') });
  assert.equal(fila(conFicha, 'Netflix VIP')[0].monto, 150); assert.equal(conFicha.pendienteClasificar.centavos, 0);
  const conAlias = resumenMes(movs, NOV, { confirmados: { netflixpremiumvip: 'netflix' } });
  assert.equal(fila(conAlias, 'Netflix Premium')[0].monto, 150);
});

test('F05: Disney Premium una sola fila con L980 + L901.95 exactos', () => {
  const r = resumenMes([ing('d1', 980, 'disneyp'), ing('d2', 901.95, 'Disney Premium')], NOV);
  assert.equal(fila(r, 'Disney Premium').length, 1); assert.equal(fila(r, 'Disney Premium')[0].centavos, 188195);
});

test('F06: un pago de 10 plataformas cuenta UNA vez y se desglosa en 10 asignaciones', () => {
  const plats = ['netflix', 'vipnetflix', 'disneyp', 'hbomax', 'primevideo', 'spotify', 'youtube', 'crunchyroll', 'paramount', 'vix'];
  const asignaciones = plats.map((p) => ({ plataforma: p, montoCentavos: 10000 }));
  const r = resumenMes([ing('diez', 1000, plats.join(' + ').slice(0, 40), { asignaciones }), mov('diez_venta', 'venta', 1000, '2026-11-05', { operacionId: 'diez', asignaciones })], NOV);
  assert.equal(r.ingresos, 1000); assert.equal(r.pagosUnicos, 1);
  assert.equal(r.cobrosPorProducto.length, 10); assert.equal(r.cobrosPorProducto.reduce((a, x) => a + x.centavos, 0), 100000);
});

test('F07/F08: pago combinado sin desglose y sin plataforma → pendiente de clasificar, dentro del total', () => {
  const r = resumenMes([ing('pc', 3698.05, 'Netflix + Disney Premium'), ing('sp', 650, ''), ing('n', 100, 'netflix')], NOV);
  assert.ok(!r.cobrosPorProducto.some((x) => /combinado|sin plataforma/i.test(x.plataforma)));
  assert.equal(r.pendienteClasificar.centavos, 369805 + 65000);
  assert.deepEqual(r.pendienteClasificar.detalle.map((d) => d.motivo).sort(), ['pago_combinado_sin_desglose', 'sin_plataforma']);
  assert.equal(r.conciliacion.productosMasPendienteIgualIngresos, true);
});

test('invariante: asignaciones menores al pago → diferencia pendiente; mayores (abono parcial) de varios productos → pendiente', () => {
  const p = { id: 'p', centavos: 30000, plataforma: '' };
  const menos = atribuirPago(p, [{ asignaciones: [{ plataforma: 'netflix', montoCentavos: 20000 }] }]);
  assert.deepEqual(menos.map((l) => [l.id, l.centavos]), [['netflix', 20000], [PENDIENTE, 10000]]);
  const mas = atribuirPago(p, [{ asignaciones: [{ plataforma: 'netflix', montoCentavos: 20000 }, { plataforma: 'disneyp', montoCentavos: 20000 }] }]);
  assert.deepEqual(mas.map((l) => [l.id, l.centavos]), [[PENDIENTE, 30000]]);
  const uno = atribuirPago(p, [{ asignaciones: [{ plataforma: 'netflix', montoCentavos: 40000 }] }]);
  assert.deepEqual(uno.map((l) => [l.id, l.centavos]), [['netflix', 30000]]);
});

test('F10/F11/F12: anulado no suma; pago en 2 bancos = 1 pago; centavos exactos sin redondear antes', () => {
  const r = resumenMes([
    ing('an', 500, 'netflix', { estadoFinanciero: 'anulado' }), mov('an_rev', 'ingreso', -500, '2026-11-05', { reversaDe: 'an_cobro' }),
    ing('div', 100.1, 'spotify'), mov('div_cobro_2', 'ingreso', 0.2, '2026-11-05', { operacionId: 'div', plataforma: 'spotify' }),
  ], NOV);
  assert.equal(r.ingresosCentavos, 10030); assert.equal(r.pagosUnicos, 1); assert.equal(fila(r, 'Spotify')[0].centavos, 10030);
  assert.equal(r.anulados, 2);
});

test('servidor: finanzas_mes usa alias confirmados + ficha; conciliación antes/después solo lectura; alias auditado con motivo', () => {
  const s = fs.readFileSync('api/finanzas.js', 'utf8');
  assert.match(s, /accion === "finanzas_mes" \|\| accion === "finanzas_conciliacion_mes"/);
  assert.match(s, /contextoProductosR193\(db, all\)/);
  assert.match(s, /accion === "finanzas_alias_confirmar"/);
  assert.match(s, /Escriba el motivo o la evidencia \(obligatorio\)/);
  assert.match(s, /auditar\(tx, db, identity, \{ origen: body\.origen, accion: "alias_producto"/);
  const bloque = s.slice(s.indexOf('accion === "finanzas_alias_confirmar"'), s.indexOf('accion === "diagnostico_duplicados"'));
  assert.doesNotMatch(bloque, /finanzas_movimientos/, 'confirmar un alias no toca movimientos');
});
