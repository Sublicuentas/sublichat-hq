// R197 · Motor único de ganancias (todas las plataformas). Datos 100 % ficticios.
// Verifica: ingresos cobrados vs. pendientes vs. esperados, combos sin duplicar, costos según la forma de compra
// (activación HBO, VIP por acceso, Spotify por familia, Prime trimestral, Crunchyroll anual, IPTV por consumo),
// detalle por cuenta con sus clientes y precios, solo lectura (no crea ni cambia nada) y meses ago–nov 2026.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
import { handlePanel } from '../api/_finanzas-panel.js';
import { movementYmd, movementKind, anuladoOReversa, money } from '../api/_finanzas-libro.js';
import { reglaCosto, familia } from '../api/_finanzas-ganancias.js';

const fTS = (f) => { const [y, m, d] = f.split('-'); return { fecha: `${d}/${m}/${y}`, fechaPago: f, mesKey: `${y}-${m}` }; };
let n = 0;
function venta(f, { compraId, compraIds, clienteId, plataforma, total, recibido = total, asignaciones, anulada = false }) {
  const id = `oper_op_u_${String(++n).padStart(4, '0')}`;
  const r = { clienteId, compraId: compraId || '', plataforma, ...(compraIds ? { compraIds } : {}), ...(asignaciones ? { asignaciones } : {}), vendedor: 'Vendedor Prueba' };
  const out = { [`${id}_venta`]: { ...fTS(f), tipo: 'venta', subtipo: 'renovacion', monto: total, montoRecibido: recibido, saldoPendiente: total - recibido, ...(anulada ? { estadoFinanciero: 'anulado' } : {}), ...r } };
  if (recibido > 0) out[`${id}_cobro`] = { ...fTS(f), tipo: 'ingreso', subtipo: 'cobro_renovacion', monto: recibido, bancoId: 'bac', ...(anulada ? { estadoFinanciero: 'anulado' } : {}), ...r };
  return out;
}
const sv = (compraId, plataforma, precio, fechaRenovacion, extra = {}) => ({ compraId, plataforma, precio, fechaRenovacion, vendedor: 'Vendedor Prueba', ...extra });
function semilla() {
  n = 0;
  const movs = {
    ...venta('2026-11-05', { compraId: 'c1', clienteId: 'k1', plataforma: 'hbomax', total: 90 }), ...venta('2026-11-05', { compraId: 'c2', clienteId: 'k2', plataforma: 'hbomax', total: 90 }),
    ...venta('2026-11-06', { compraId: 'c3', clienteId: 'k3', plataforma: 'hbomax', total: 80 }), ...venta('2026-11-07', { compraId: 'c4', clienteId: 'k4', plataforma: 'hbomax', total: 100 }),
    ...venta('2026-11-08', { compraId: 'v1', clienteId: 'kv', plataforma: 'vipnetflix', total: 130 }),
    ...venta('2026-11-09', { compraId: 's1', clienteId: 'ks1', plataforma: 'spotify', total: 60 }), ...venta('2026-11-09', { compraId: 's2', clienteId: 'ks2', plataforma: 'spotify', total: 60 }),
    ...venta('2026-11-10', { compraId: 'p1', clienteId: 'kp1', plataforma: 'primevideo', total: 120 }), ...venta('2026-11-10', { compraId: 'p2', clienteId: 'kp2', plataforma: 'primevideo', total: 120, recibido: 60 }),
    ...venta('2026-11-12', { compraIds: ['x1', 'x2'], clienteId: 'kx', plataforma: 'crunchyroll + stellatv', total: 250 }),
    ...venta('2026-10-15', { compraId: 'c1', clienteId: 'k1', plataforma: 'hbomax', total: 90 }),
    ...venta('2026-11-13', { compraId: 'c2', clienteId: 'k2', plataforma: 'hbomax', total: 90, anulada: true }),
  };
  return {
    finanzas_movimientos: movs,
    clientes: {
      k1: { nombre: 'Titular Uno', servicios: [sv('c1', 'hbomax', 90, '05/12/2026', { planHbo: 'platinum', beneficiarioNombre: 'Beneficiaria Uno' })] },
      k2: { nombre: 'Titular Dos', servicios: [sv('c2', 'hbomax', 90, '05/12/2026', { planHbo: 'platinum' })] },
      k3: { nombre: 'Titular Tres', servicios: [sv('c3', 'hbomax', 80, '06/12/2026', { planHbo: 'platinum' })] },
      k4: { nombre: 'Titular Cuatro', servicios: [sv('c4', 'hbomax', 100, '07/12/2026', { planHbo: 'platinum' })] },
      kv: { nombre: 'Cliente VIP', servicios: [sv('v1', 'vipnetflix', 130, '08/12/2026')] },
      ks1: { nombre: 'Invitado 1', servicios: [sv('s1', 'spotify', 60, '09/12/2026')] }, ks2: { nombre: 'Invitado 2', servicios: [sv('s2', 'spotify', 60, '09/12/2026')] },
      ks3: { nombre: 'Invitado 3', servicios: [sv('s3', 'spotify', 60, '25/11/2026')] },
      kp1: { nombre: 'Prime Uno', servicios: [sv('p1', 'primevideo', 120, '10/12/2026')] }, kp2: { nombre: 'Prime Dos', servicios: [sv('p2', 'primevideo', 120, '10/12/2026')] },
      kx: { nombre: 'Cliente Combo', servicios: [sv('x1', 'crunchyroll', 100, '12/12/2026'), sv('x2', 'stellatv', 150, '12/12/2026')] },
    },
    inventario: {
      'hbo-1': { plataforma: 'hbomax', planHbo: 'platinum', correo: 'hbo1@prueba.test', capacidad: 5, clientes: [1, 2, 3, 4].map((i) => ({ compraId: 'c' + i, clienteId: 'k' + i, nombre: 'Perfil ' + i, slot: i })) },
      'vip-1': { plataforma: 'vipnetflix', correo: 'vip1@prueba.test', capacidad: 1, clientes: [{ compraId: 'v1', clienteId: 'kv', nombre: 'Cliente VIP' }] },
      'spf-1': { plataforma: 'spotify', correo: 'madre@prueba.test', capacidad: 6, clientes: [1, 2, 3].map((i) => ({ compraId: 's' + i, clienteId: 'ks' + i, nombre: 'Invitado ' + i, slot: i })) },
      'pv-1': { plataforma: 'primevideo', correo: 'prime@prueba.test', capacidad: 5, clientes: [{ compraId: 'p1', clienteId: 'kp1', slot: 1 }, { compraId: 'p2', clienteId: 'kp2', slot: 2 }] },
      'cr-1': { plataforma: 'crunchyroll', correo: 'crunchy@prueba.test', capacidad: 4, clientes: [{ compraId: 'x1', clienteId: 'kx', slot: 1 }] },
    },
    fin_productos: {
      'HBO-PLAT': { nombre: 'HBO Platinum', modelo: 'cuenta_madre', plataformaKey: 'hbomax', duracionDias: 0 },
      PRIME: { nombre: 'Prime Video', modelo: 'gift_card', plataformaKey: 'primevideo', duracionDias: 90 },
      CRUNCHY: { nombre: 'Crunchyroll', modelo: 'cuenta_madre', plataformaKey: 'crunchyroll', duracionDias: 365 },
      STELLA: { nombre: 'Stella TV', modelo: 'creditos', plataformaKey: 'stellatv', duracionDias: 30 },
      SPF: { nombre: 'Spotify Familiar', modelo: 'cuenta_madre', plataformaKey: 'spotify', duracionDias: 30 },
    },
    fin_lotes: {
      act: { productoId: 'HBO-PLAT', producto: 'HBO Platinum', fecha: '2026-11-03', fechaActivacion: '2026-11-05', modelo: 'cuenta_madre', duracionDias: 0, costoTotalHnl: 93.1, costoTotalMoneda: 3.5, moneda: 'USDT', tasa: 26.6, cuentaInventarioId: 'hbo-1' },
      pv: { productoId: 'PRIME', producto: 'Prime Video', fecha: '2026-11-02', modelo: 'gift_card', duracionDias: 90, costoTotalHnl: 341.85, costoTotalMoneda: 12.9, moneda: 'USD', tasa: 26.5, cuentaInventarioId: 'pv-1' },
      cr: { productoId: 'CRUNCHY', producto: 'Crunchyroll', fecha: '2026-11-01', modelo: 'cuenta_madre', duracionDias: 365, costoTotalHnl: 812.4, costoTotalMoneda: 1800, moneda: 'PHP', tasa: 0.4513, cuentaInventarioId: 'cr-1' },
      st: { productoId: 'STELLA', producto: 'Stella TV', fecha: '2026-10-01', modelo: 'creditos', duracionDias: 30, costoTotalHnl: 990, costoTotalMoneda: 37.5, moneda: 'USDT', tasa: 26.4 },
      spf: { productoId: 'SPF', producto: 'Spotify Familiar', fecha: '2026-11-01', modelo: 'cuenta_madre', duracionDias: 30, costoTotalHnl: 120, moneda: 'HNL' },
    },
    fin_consumos: { cons1: { ventaId: 'x', fecha: '2026-11-12', mesKey: '2026-11', estado: 'completo', lineas: [{ productoId: 'STELLA', costoHnl: 66 }, { productoId: 'STELLA', costoHnl: 66 }] } },
    fin_vip_extras: { 'vip-1': { cmId: 'vip-1', correo: 'vip1@prueba.test', proveedor: 'Proveedor Prueba', costoMensualUsdt: 2.5, tasa: 26.6, costoMensualHnl: 66.5, estadoSeguimiento: 'activo', creadoAt: '2026-08-01T00:00:00Z' } },
    fin_spotify_cuentas: { fam1: { madreCorreo: 'madre@prueba.test', costoMensualHnl: 120, creadoAt: '2026-08-01T00:00:00Z' } },
    finanzas_config: { costeo: { desde: '2026-08-01' } },
  };
}
const R = { movementYmd, movementKind, anuladoOReversa, money };
const res = () => { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
const deps = (db) => ({ hoyYmdHN: () => '2026-11-17', R, leerMovimientos: async (desde) => [...db._data.entries()].filter(([k]) => k.startsWith('finanzas_movimientos/')).map(([k, v]) => ({ id: k.split('/')[1], ...v.data })).filter((m) => movementYmd(m) >= desde), auditar: () => {} });
const call = async (db, accion, body = {}) => { const r = res(); await handlePanel(db, accion, body, { usuario: 'sublicuentas', role: 'sublicuentas', admin: true }, {}, r, deps(db)); return r.body; };

test('noviembre: cobrado, pendiente y esperado por separado; combo repartido una vez; ventas anuladas fuera', async () => {
  const db = fakeFirestore(semilla()); const antes = JSON.stringify([...db._data.entries()]);
  const g = await call(db, 'finp_ganancias', { desde: '2026-11-01', hasta: '2026-11-30' });
  assert.equal(g.ok, true, JSON.stringify(g).slice(0, 300));
  const r = g.resumen;
  assert.deepEqual([r.cobradoHnl, r.pendienteHnl, r.esperadoHnl, r.esperados, r.ventas], [1040, 60, 60, 1, 10], 'la renovación programada de L60 NO cuenta como cobrada');
  assert.equal(r.cobradoCajaHnl, 1040, 'caja = cobros registrados');
  const hbo = g.porPlataforma.find((p) => p.plataforma === 'hbomax_platinum');
  assert.deepEqual([hbo.cobradoHnl, hbo.costoHnl, hbo.resultadoHnl, hbo.cuentas], [360, 93.1, 266.9, 1], 'HBO: L90+L90+L80+L100 = L360; activación L93.10 una sola vez');
  const combo = (await call(db, 'finp_ganancias_excel', { desde: '2026-11-01', hasta: '2026-11-30' })).filas.filter((f) => f['Titular de ficha'] === 'Cliente Combo');
  assert.deepEqual(combo.map((f) => [f.Plataforma, f['Ingreso cobrado']]), [['Crunchyroll', 100], ['Stella TV', 150]], 'combo L250 repartido por precio de ficha');
  assert.equal(JSON.stringify([...db._data.entries()]), antes, 'solo lectura: no crea ni cambia nada');
});

test('costos según la forma de compra, sin duplicar; tasa y moneda históricas', async () => {
  const db = fakeFirestore(semilla());
  const g = await call(db, 'finp_ganancias', { desde: '2026-11-01', hasta: '2026-11-30' });
  const por = (p) => g.porPlataforma.find((x) => x.plataforma === p) || {};
  assert.equal(por('vipnetflix').costoHnl, 66.5, 'VIP: costo mensual del acceso');
  assert.equal(por('spotify').costoHnl, 120, 'Spotify: UN costo por familia, aunque haya 3 invitados (y su compra no se suma encima)');
  assert.equal(por('primevideo').costoHnl, 110.15, 'Prime: 29 de 90 días de su pago trimestral');
  assert.equal(por('crunchyroll').costoHnl, 66.77, 'Crunchyroll anual: 30 de 365 días');
  assert.equal(por('stellatv').costoHnl, 132, 'IPTV: créditos realmente usados (no el lote de octubre)');
  assert.equal(g.resumen.costoHnl, 588.52); assert.equal(g.resumen.resultadoHnl, 451.48);
  const act = g.costos.find((c) => c.loteId === 'act');
  assert.deepEqual([act.regla, act.moneda, act.montoMoneda, act.tasa], ['activacion', 'USDT', 3.5, 26.6]);
  assert.equal(g.desembolsos.reduce((a, c) => a + c.costoHnl, 0).toFixed(2), '1367.35', 'caja de noviembre: compras reales del mes (aparte del costo reconocido)');
  assert.deepEqual([reglaCosto({ modelo: 'creditos' }), reglaCosto({ modelo: 'link', duracionDias: 0 }), reglaCosto({ modelo: 'cuenta_madre', duracionDias: 30 }), reglaCosto({}, { reglaCosto: 'consumo' })], ['consumo', 'activacion', 'cobertura', 'consumo']);
});

test('detalle de la cuenta HBO: 4 clientes con su precio, cobros, compra vinculada y resultado', async () => {
  const db = fakeFirestore(semilla());
  const c = (await call(db, 'finp_ganancias_cuenta', { cuentaId: 'hbo-1', desde: '2026-11-01', hasta: '2026-11-30' })).cuenta;
  assert.deepEqual([c.correo, c.plan, c.capacidad, c.ocupados, c.disponibles], ['hbo1@prueba.test', 'platinum', 5, 4, 1]);
  assert.deepEqual(c.perfiles.map((p) => [p.perfil, p.precio, p.cobradoHnl]), [['Perfil 1', 90, 90], ['Perfil 2', 90, 90], ['Perfil 3', 80, 80], ['Perfil 4', 100, 100]]);
  assert.equal(c.perfiles[0].beneficiario, 'Beneficiaria Uno', 'beneficiario real, no el titular'); assert.equal(c.perfiles[0].titular, 'Titular Uno');
  assert.deepEqual([c.cobradoHnl, c.costoPeriodoHnl, c.resultadoPeriodoHnl, c.compras.length, c.compras[0].fechaActivacion], [360, 93.1, 266.9, 1, '2026-11-05']);
});

test('oct–nov 2026 (R200k: control desde octubre), renovación de octubre en su mes y bandeja de conciliación', async () => {
  const db = fakeFirestore(semilla());
  const g = await call(db, 'finp_ganancias', { desde: '2026-11-01', hasta: '2026-11-30' });
  assert.deepEqual(g.meses.map((m) => m.mes), ['2026-10', '2026-11']);
  assert.equal(g.meses[0].cobradoHnl, 90); assert.equal(g.anterior.mes, '2026-10');
  assert.equal(g.bandejaConteo.ingreso_sin_confirmar, 1); assert.equal(g.bandejaConteo.pago_pendiente, 1);
  assert.equal(g.costeo.activo, true);
  // repetir no cambia nada (idempotente)
  const g2 = await call(db, 'finp_ganancias', { desde: '2026-11-01', hasta: '2026-11-30' });
  const sinHora = (x) => { const { calculadoAt, ...r } = x; return r; };
  assert.deepEqual(sinHora(g2.resumen), sinHora(g.resumen));
  // R200k · pedir junio (antes del control) no lee meses pasados: se calcula desde octubre
  const junio = await call(db, 'finp_ganancias', { desde: '2026-06-01', hasta: '2026-06-30' });
  assert.equal(junio.ok, true); assert.ok(!(junio.meses || []).some((m) => m.mes < '2026-10'));
});

test('familias de plataforma', () => {
  assert.deepEqual(['HBO Max', 'Netflix VIP', 'Prime Video', 'Free Fire diamantes', 'Steam'].map((p) => familia(p)), ['hbomax', 'vipnetflix', 'primevideo', 'freefire', 'steam']);
  assert.equal(familia('hbomax', 'standard'), 'hbomax_standard');
  assert.match(fs.readFileSync(new URL('../api/finanzas.js', import.meta.url), 'utf8'), /R: cd\.R, leerMovimientos: cd\.leerMovimientos/);
});
