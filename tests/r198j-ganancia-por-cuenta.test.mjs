// R198j · GANANCIA POR CUENTA (regla del dueño 20/11/2026): lo que pagué por la cuenta vs. lo que pagan sus clientes.
// Ejemplo real (con datos FICTICIOS): cuenta activada el 28/08 por 2 USDT (L56), 5 perfiles 70+80+70+60+60 = L340 al mes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
import { handlePanel } from '../api/_finanzas-panel.js';
import { movementYmd, movementKind, anuladoOReversa, money } from '../api/_finanzas-libro.js';

const fTS = (f) => { const [y, m, d] = f.split('-'); return { fecha: `${d}/${m}/${y}`, fechaPago: f, mesKey: `${y}-${m}` }; };
let n = 0;
function op(f, { subtipo = 'renovacion', compraId, clienteId, total, plataforma = 'hbomax' }) {
  const id = `oper_op_g_${String(++n).padStart(4, '0')}`, r = { clienteId, compraId, plataforma, vendedor: 'Vendedor A', registradoPor: 'sublicuentas', origenCanal: 'web' };
  return { [`${id}_venta`]: { ...fTS(f), tipo: 'venta', subtipo, monto: total, montoRecibido: total, saldoPendiente: 0, estadoPago: 'pagado', ...r }, [`${id}_cobro`]: { ...fTS(f), tipo: 'ingreso', subtipo: subtipo === 'compra_nueva' ? 'cobro_compra' : 'cobro_renovacion', monto: total, bancoId: 'bac', ...r } };
}
const sv = (compraId, precio, venc, plataforma = 'hbomax') => ({ compraId, plataforma, planHbo: plataforma === 'hbomax' ? 'standard' : undefined, precio, fechaRenovacion: venc, vendedor: 'Vendedor A' });
function semilla() {
  n = 0;
  const P = [['k1', 70, '01/12/2026'], ['k2', 80, '10/12/2026'], ['k3', 70, '15/12/2026'], ['k4', 60, '16/12/2026'], ['k5', 60, '16/12/2026']];
  const clientes = {}; P.forEach(([k, p, v], i) => { clientes[`c${i}`] = { nombre: `Cliente ${i + 1}`, servicios: [sv(k, p, v)] }; });
  clientes.c9 = { nombre: 'Cliente Nuevo', servicios: [sv('k9', 80, '05/12/2026')] };       // entró DESPUÉS de la activación (alta 05/11)
  clientes.cs = { nombre: 'Cliente Sin Compra', servicios: [sv('ks', 160, '30/11/2026')] };   // cuenta completa sin pago registrado
  clientes.cn = { nombre: 'Cliente Netflix', servicios: [sv('kn', 150, '10/12/2026', 'netflix')] };
  return {
    finanzas_movimientos: { ...op('2026-11-05', { subtipo: 'compra_nueva', compraId: 'k9', clienteId: 'c9', total: 80 }) },
    clientes,
    inventario: {
      v6: { plataforma: 'hbomax', planHbo: 'standard', correo: 'venta6@prueba.test', capacidad: 5, clientes: P.map(([k], i) => ({ compraId: k, clienteId: `c${i}`, slot: i + 1 })) },
      nv: { plataforma: 'hbomax', planHbo: 'standard', correo: 'nueva@prueba.test', capacidad: 3, clientes: [{ compraId: 'k9', clienteId: 'c9', slot: 1 }] },
      sc: { plataforma: 'hbomax', planHbo: 'standard', correo: 'completa@prueba.test', capacidad: 3, modalidadVenta: 'cuenta_completa', exclusivaCompraId: 'ks', clientes: [{ compraId: 'ks', clienteId: 'cs', slot: 1, cuentaCompleta: true }] },
      va: { plataforma: 'hbomax', planHbo: 'standard', correo: 'vacia@prueba.test', capacidad: 3, clientes: [] },
      nf: { plataforma: 'netflix', correo: 'netflix@prueba.test', capacidad: 5, clientes: [{ compraId: 'kn', clienteId: 'cn', slot: 1 }] },
    },
    fin_productos: { LINK: { nombre: 'HBO links', modelo: 'link', plataformaKey: 'hbomax', duracionDias: 0 }, NFX: { nombre: 'Netflix Premium', modelo: 'cuenta_madre', plataformaKey: 'netflix', duracionDias: 30 } },
    fin_lotes: {
      a6: { fecha: '2026-08-28', estado: 'activo', productoId: 'LINK', producto: 'HBO links', modelo: 'link', duracionDias: 0, moneda: 'USDT', tasa: 28, costoTotalMoneda: 2, costoTotalHnl: 56, cuentaInventarioId: 'v6' },
      an: { fecha: '2026-10-20', estado: 'activo', productoId: 'LINK', producto: 'HBO links', modelo: 'link', duracionDias: 0, moneda: 'USDT', tasa: 28, costoTotalMoneda: 1.45, costoTotalHnl: 40.6, cuentaInventarioId: 'nv' },
      av: { fecha: '2026-02-03', estado: 'activo', productoId: 'LINK', producto: 'HBO links', modelo: 'link', duracionDias: 0, moneda: 'USDT', tasa: 28, costoTotalMoneda: 2, costoTotalHnl: 56, cuentaInventarioId: 'va' },
      nfx: { fecha: '2026-11-10', estado: 'activo', productoId: 'NFX', producto: 'Netflix Premium', modelo: 'cuenta_madre', duracionDias: 30, moneda: 'HNL', tasa: 1, costoTotalMoneda: 300, costoTotalHnl: 300, cuentaInventarioId: 'nf' },
    },
  };
}
const R = { movementYmd, movementKind, anuladoOReversa, money };
const res = () => { const r = { body: null, status() { return r; }, json(b) { r.body = b; return r; } }; return r; };
const deps = (db) => ({ hoyYmdHN: () => '2026-11-20', R, leerMovimientos: async (desde) => [...db._data.entries()].filter(([k]) => k.startsWith('finanzas_movimientos/')).map(([k, v]) => ({ id: k.split('/')[1], ...v.data })).filter((m) => movementYmd(m) >= desde), auditar: () => {} });
const call = async (db, accion, body = {}) => { const r = res(); try { await handlePanel(db, accion, body, { usuario: 'sublicuentas', role: 'sublicuentas', admin: true }, {}, r, deps(db)); } catch (e) { return { ok: false, error: e.message }; } return r.body; };
const cta = (x, correo) => x.cuentas.find((c) => c.correo === correo);

test('1 · el ejemplo del dueño: pagué L56 el 28/08; me pagan L340 al mes; ganancia neta al mes L340; desde la activación 3 meses × L340 − L56 = L964', async () => {
  const x = await call(fakeFirestore(semilla()), 'finp_rentabilidad', { plataforma: 'hbomax' });
  assert.equal(x.ok, true, JSON.stringify(x).slice(0, 300));
  const c = cta(x, 'venta6@prueba.test');
  assert.deepEqual([c.compra.fecha, c.compra.costoHnl, c.compra.montoMoneda, c.compra.tipo], ['2026-08-28', 56, 2, 'activacion']);
  assert.equal(c.meMensualHnl, 340); assert.equal(c.gananciaMesHnl, 340, 'la activación ya se pagó: no se resta cada mes');
  // R200k · control desde 01/10/2026: solo los meses pagados desde octubre; la activación de agosto no se vuelve a restar
  assert.deepEqual(c.perfiles.map((p) => p.mesesPagados), [2, 2, 2, 2, 2]);
  assert.equal(c.estimadoDesdeCompraHnl, 680); assert.equal(c.costoPeriodoHnl, 0); assert.equal(c.activacionAntesDelControl, true); assert.equal(c.gananciaDesdeCompraHnl, 680); assert.equal(c.estado, 'ganando');
});

test('2 · cliente que entró después de la activación: cuenta desde su alta, no desde la activación', async () => {
  const c = cta(await call(fakeFirestore(semilla()), 'finp_rentabilidad', { plataforma: 'hbomax' }), 'nueva@prueba.test');
  assert.equal(c.perfiles[0].inicio, '2026-11-05'); assert.equal(c.perfiles[0].mesesPagados, 1);
  assert.equal(c.gananciaDesdeCompraHnl, 39.4, '1 mes × L80 − L40.60');
});

test('3 · sin compra registrada: no se inventa costo; vacía: activación sin recuperar; cuenta completa: 0 libres', async () => {
  const x = await call(fakeFirestore(semilla()), 'finp_rentabilidad', { plataforma: 'hbomax' });
  const sc = cta(x, 'completa@prueba.test'); assert.equal(sc.estado, 'sin_compra'); assert.equal(sc.compra, null); assert.equal(sc.gananciaMesHnl, null); assert.equal(sc.completa, true); assert.equal(sc.libres, 0);
  const va = cta(x, 'vacia@prueba.test'); assert.equal(va.estado, 'vacia'); assert.equal(va.gananciaDesdeCompraHnl, 0, 'R200k · activación de febrero: fuera del control desde octubre');
});

test('4 · resumen por plataforma (todas las plataformas) y cuenta con vigencia: costo mensual se resta cada mes', async () => {
  const x = await call(fakeFirestore(semilla()), 'finp_rentabilidad', {});
  const h = x.plataformas.find((p) => p.plataforma === 'hbomax');
  assert.deepEqual([h.nombre, h.cuentas, h.perfiles, h.meMensualHnl, h.pagueHnl, h.gananciaMesHnl, h.sinCompra, h.sinCompraMensualHnl, h.vacias], ['HBO Max', 4, 7, 580, 152.6, 420, 1, 160, 1]);
  const nf = x.plataformas.find((p) => p.plataforma === 'netflix');
  assert.equal(nf.gananciaMesHnl, -154.38, 'L150 − L300 × 30.44/30 días');
});

test('5 · solo lectura: consultar no escribe nada; la pantalla nueva está en Ganancias', async () => {
  const db = fakeFirestore(semilla()); const antes = new Map([...db._data.entries()].map(([k, v]) => [k, JSON.stringify(v.data)]));
  await call(db, 'finp_rentabilidad', {}); await call(db, 'finp_rentabilidad', { plataforma: 'hbomax' });
  assert.equal(db._data.size, antes.size); for (const [k, v] of antes) assert.equal(JSON.stringify(db._data.get(k).data), v, k);
  const web = fs.readFileSync(new URL('../finanzas-web.js', import.meta.url), 'utf8');
  assert.match(web, /Ganancia por cuenta/); assert.match(web, /finp_rentabilidad/);
});
