import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { __pruebas } from '../api/finanzas.js';
import { handleEmpresa, SEMILLA, aplicarRecarga, aplicarSalida, aplicarAjuste, planNuevoPrecio, precioVigente, agregarTermino, varianteIdDe } from '../api/_finanzas-empresa.js';
import { cycleTotals, bankBalances, movementKind } from '../api/_finanzas-libro.js';
import { libroDiario, balanzaComprobacion } from '../api/_contabilidad.js';

// Firestore falso con transacciones, where(==) y get() de colección.
function fakeDb(inicial = {}) {
  const store = new Map(Object.entries(inicial));
  let n = 0;
  const ref = (c, id) => ({ id, _k: `${c}/${id}`, async get() { const d = store.get(`${c}/${id}`); return { id, exists: !!d, data: () => d }; } });
  const docsDe = (c) => [...store.entries()].filter(([k]) => k.startsWith(`${c}/`) && !k.slice(c.length + 1).includes('/')).map(([k, d]) => ({ id: k.slice(c.length + 1), data: () => d }));
  const db = {
    store,
    collection: (c) => ({
      doc: (id) => ref(c, id || `auto${++n}`),
      get: async () => ({ docs: docsDe(c) }),
      where: (f, op, v) => ({ get: async () => ({ docs: docsDe(c).filter((x) => (op === '==' ? x.data()[f] === v : true)) }), limit: () => ({ get: async () => ({ docs: docsDe(c) }) }) }),
    }),
    async runTransaction(fn) { const buf = []; const tx = { get: (r) => r.get(), set: (r, d, o) => buf.push([r._k, d, o]), update: (r, d) => buf.push([r._k, d, { merge: true }]) }; const out = await fn(tx); for (const [k, d, o] of buf) store.set(k, o?.merge ? { ...(store.get(k) || {}), ...d } : d); return out; },
  };
  return db;
}
const methods = [{ id: 'bac', nombre: 'BAC Credomatic', logoKey: 'bac', activo: true }, { id: 'ficohsa', nombre: 'Ficohsa', logoKey: 'ficohsa', activo: true }];
const sub = { usuario: 'sublicuentas', role: 'sublicuentas' };
const resp = () => { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
const deps = (db) => ({
  canUseLibro: (i) => ['sublicuentas', 'relojes'].includes(i.role), hoyYmdHN: () => '2026-10-08',
  auditar: (tx, _db, identity, ev) => tx.set(db.collection('auditoria_eventos').doc(), { actor: identity.usuario, ...ev }),
  loadMethods: async () => methods, libroOpDocId: (p, b, uid) => (b.operationId ? `${p}_op_${uid}_${b.operationId}` : ''),
  estadoLibro: async () => ({ saldos: bankBalances([...db.store.entries()].filter(([k]) => k.startsWith('finanzas_movimientos/')).map(([k, d]) => ({ id: k, ...d })), { bases: { bac: { saldo: 5000, desde: '2026-10-01' } } }, methods) }),
  baseMov: (i) => ({ registradoPor: i.usuario, origenCanal: 'web', createdAt: '2026-10-08T20:00:00Z' }),
  canonicalFinanceDate: (f) => { const [y, m, d] = f.split('-'); return { fecha: `${d}/${m}/${y}`, fechaPago: f, mesKey: `${y}-${m}` }; },
});
const llamar = async (db, accion, body = {}) => { const r = resp(); await handleEmpresa(db, accion, body, sub, { uid: 'u1' }, r, deps(db)); return r.body; };
const movs = (db) => [...db.store.entries()].filter(([k]) => k.startsWith('finanzas_movimientos/')).map(([k, d]) => ({ id: k.split('/')[1], ...d }));

test('Prueba A: comprar 100 USDT desde BAC por L2,820 → BAC −2,820 · Binance +100 · gasto L0 · tasa 28.20', async () => {
  const db = fakeDb();
  const r = await llamar(db, 'fin_binance_recargar', { bancoId: 'bac', hnl: 2820, usdt: 100, fecha: '2026-10-08', referencia: 'P2P-1', operationId: 'op-recarga-0001' });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.tasa, 28.2);
  assert.equal(r.billetera.saldo, 100); assert.equal(r.billetera.valorHnl, 2820); assert.equal(r.billetera.costoPromedio, 28.2);
  const m = movs(db);
  const bac = bankBalances(m, { bases: { bac: { saldo: 5000, desde: '2026-10-01' } } }, methods).bancos.find((b) => b.id === 'bac');
  assert.equal(bac.saldo, 5000 - 2820, 'BAC baja L2,820');
  const t = cycleTotals(m, '2026-10-01', '');
  assert.equal(t.egresosOperativos, 0, 'gasto = L0'); assert.equal(t.ingresos, 0); assert.equal(t.resultado, 0);
  assert.equal(m.find((x) => x.tipo === 'billetera').montoUsdt, 100); assert.equal(movementKind(m.find((x) => x.tipo === 'billetera')), 'billetera');
  // Partida doble: BAC al Haber, Binance al Debe, tránsito en 0, balanza cuadra.
  const bz = balanzaComprobacion(libroDiario(m, {}, methods, '2026-10-01', '2026-10-31'));
  assert.ok(bz.cuadra); assert.equal(bz.cuentas.find((c) => c.cuenta === '1150-binance').saldo, 2820); assert.equal(bz.cuentas.find((c) => c.cuenta === '1190').saldo, 0);
  // Mismo operationId = no duplica.
  const r2 = await llamar(db, 'fin_binance_recargar', { bancoId: 'bac', hnl: 2820, usdt: 100, operationId: 'op-recarga-0001' });
  assert.equal(r2.duplicado, true); assert.equal(movs(db).length, 2);
});

test('Binance: costo promedio ponderado; una recarga nueva no cambia lo ya pagado; ajuste con motivo', async () => {
  let e = aplicarRecarga(undefined, { hnl: 2820, usdt: 100 }).estado;
  const pago = aplicarSalida(e, 62.5); // Prueba B (Fase 2): 25 Netflix VIP × 2.50
  assert.equal(pago.costoHnl, 1762.5); e = pago.estado; assert.equal(e.saldo, 37.5); assert.equal(e.costoPromedio, 28.2);
  e = aplicarRecarga(e, { hnl: 2900, usdt: 100 }).estado; // tasa 29.00
  assert.equal(e.saldo, 137.5); assert.equal(e.valorHnl, 3957.5); assert.equal(e.costoPromedio, 28.781818);
  assert.equal(pago.costoHnl, 1762.5, 'la compra vieja conserva su costo');
  const aj = aplicarAjuste(e, 137); assert.equal(aj.delta, -0.5); assert.equal(aj.estado.saldo, 137);
  const db = fakeDb();
  assert.equal((await llamar(db, 'fin_binance_ajustar', { saldoCorrecto: 5, motivo: '', operationId: 'op-aj-0001' })).ok, false, 'pide motivo');
});

test('Prueba E: cambiar precio de Stella L200 → L220: ventas viejas conservan L200; nuevas usan L220', async () => {
  const db = fakeDb();
  const s = await llamar(db, 'fin_sembrar_catalogo');
  assert.equal(s.ok, true, JSON.stringify(s)); assert.equal(s.productos, SEMILLA.productos.length);
  const again = await llamar(db, 'fin_sembrar_catalogo'); assert.equal(again.productos, 0, 'sembrar es idempotente');
  const vid = varianteIdDe('STELLA', '1 mes · 3 dispositivos');
  const r = await llamar(db, 'fin_precio_nuevo', { varianteId: vid, precioHnl: 220, desde: '2026-10-08', motivo: 'Subió el proveedor' });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.cerradas, 1);
  const est = await llamar(db, 'fin_empresa_estado');
  const v = est.productos.find((p) => p.id === 'STELLA').variantes.find((x) => x.id === vid);
  assert.equal(v.precioVigente.precioHnl, 220);
  assert.equal(precioVigente(v.historialPrecios, '2026-10-05').precioHnl, 200, 'una venta del 05/10 sigue a L200');
  assert.equal(v.historialPrecios.find((p) => p.precioHnl === 200).hasta, '2026-10-07');
  assert.throws(() => planNuevoPrecio(v.historialPrecios, { precioHnl: 210, desde: '2026-10-08' }), /Ya hay un precio/);
  assert.equal(est.productos.find((p) => p.id === 'STELLA').modelo, 'creditos');
  assert.equal(est.productos.find((p) => p.id === 'VIX').costoRef.monto, 0);
});

test('Prueba F: cambiar el costo de referencia del proveedor no borra el anterior (queda con fecha hasta)', async () => {
  const t1 = agregarTermino([], { productoId: 'NFX-VIP', costoRef: 2.5, moneda: 'USDT', desde: '2026-10-01' }, '2026-10-08');
  const t2 = agregarTermino(t1, { productoId: 'NFX-VIP', costoRef: 2.7, moneda: 'USDT', desde: '2026-10-08' }, '2026-10-08');
  assert.equal(t2.length, 2); assert.equal(t2[0].costoRef, 2.5); assert.equal(t2[0].hasta, '2026-10-07'); assert.equal(t2[1].costoRef, 2.7); assert.equal(t2[1].hasta, null);
  const db = fakeDb(); await llamar(db, 'fin_sembrar_catalogo');
  const r = await llamar(db, 'fin_proveedor_termino', { proveedorId: 'deku-peru', termino: { productoId: 'NFX-VIP', costoRef: 2.7, moneda: 'USDT' } });
  assert.equal(r.ok, true, JSON.stringify(r));
  const prov = db.store.get('fin_proveedores/deku-peru');
  assert.deepEqual(prov.terminos.map((t) => [t.costoRef, t.hasta]), [[2.5, '2026-10-07'], [2.7, null]]);
});

test('R135: solo Sublicuentas/Relojes; el listado de movimientos de la APK no muestra Binance; web y bot no lo cuentan como ingreso', async () => {
  const r = resp(); await handleEmpresa(fakeDb(), 'fin_empresa_estado', {}, { usuario: 'jimena', role: 'vendedor' }, { uid: 'x' }, r, deps(fakeDb()));
  assert.equal(r.code, 403);
  const api = fs.readFileSync(new URL('../api/finanzas.js', import.meta.url), 'utf8');
  assert.match(api, /!\["ignorar", "venta", "billetera", "costo_venta", "inventario"\]\.includes\(m\.kind\)/);
  const app = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(app, /if\(t==="billetera"\|\|t==="compra"\|\|t==="inventario"\|\|t==="costo_venta"\|\|t==="pago_cxp"\|\|t==="retiro"\|\|t==="transferencia"/);
  assert.match(app, /data-fin-empresa/);
});
