// R200a · Finanzas → Compras registradas → «Eliminar compra». Nunca se borra en silencio: borrador sin pago se elimina
// (con copia en fin_anulaciones); compra contabilizada se ANULA con reversa; ventas costeadas pasan a «pendiente de costo»
// con el costo reversado en el mes de cada venta. Doble clic / reintento = una sola anulación. Datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { handleEmpresa, lineasSinLote, revertirSalidaBinance } from '../api/_finanzas-empresa.js';
import { cycleTotals, bankBalances, movementKind } from '../api/_finanzas-libro.js';

function fakeDb() {
  const store = new Map(); let n = 0;
  const ref = (c, id) => ({ id, _k: `${c}/${id}`, async get() { const d = store.get(`${c}/${id}`); return { id, exists: !!d, data: () => d }; } });
  const docsDe = (c) => [...store.entries()].filter(([k]) => k.startsWith(`${c}/`)).map(([k, d]) => ({ id: k.slice(c.length + 1), data: () => d }));
  return { store,
    collection: (c) => ({ doc: (id) => ref(c, id || `auto${++n}`), get: async () => ({ docs: docsDe(c) }), where: (f, op, v) => ({ get: async () => ({ docs: docsDe(c).filter((x) => x.data()[f] === v) }) }) }),
    async runTransaction(fn) { const buf = []; const tx = { get: (r) => r.get(), set: (r, d, o) => buf.push([r._k, d, o]), delete: (r) => buf.push([r._k, null, { borrar: true }]) }; const out = await fn(tx); for (const [k, d, o] of buf) if (o && o.borrar) store.delete(k); else store.set(k, o?.merge ? { ...(store.get(k) || {}), ...d } : d); return out; } };
}
const methods = [{ id: 'bac', nombre: 'BAC Credomatic' }, { id: 'ficohsa', nombre: 'Ficohsa' }];
const libro = { bases: { bac: { saldo: 20000, desde: '2026-10-01' } } };
const movs = (db) => [...db.store.entries()].filter(([k]) => k.startsWith('finanzas_movimientos/')).map(([k, d]) => ({ id: k.split('/')[1], ...d }));
const deps = (db) => ({ canUseLibro: () => true, hoyYmdHN: () => '2026-10-08', auditar: (tx, _d, i, ev) => tx.set(db.collection('auditoria_eventos').doc(), ev), loadMethods: async () => methods,
  libroOpDocId: (p, b, u) => (b.operationId ? `${p}_${u}_${b.operationId}` : ''), estadoLibro: async () => ({ saldos: bankBalances(movs(db), libro, methods) }),
  baseMov: () => ({ registradoPor: 'sublicuentas', createdAt: '2026-10-08T20:00:00Z' }), canonicalFinanceDate: (f) => { const [y, m, d] = f.split('-'); return { fecha: `${d}/${m}/${y}`, fechaPago: f }; } });
const llamar = async (db, accion, body = {}) => { let out; const res = { status: () => ({ json: (b) => { out = b; return b; } }) }; await handleEmpresa(db, accion, body, { usuario: 'sublicuentas', role: 'sublicuentas' }, { uid: 'u1' }, res, deps(db)); return out; };
async function base() { const db = fakeDb(); await llamar(db, 'fin_sembrar_catalogo'); await llamar(db, 'fin_binance_recargar', { bancoId: 'bac', hnl: 2820, usdt: 100, operationId: 'rec-0000001' }); return db; }

const comprarBanco = (db, op, costo = 377) => llamar(db, 'fin_compra_registrar', { operationId: op, compra: { productoId: 'NFX-PREM', cantidad: 1, costoTotal: costo, moneda: 'HNL', pago: 'banco', bancoId: 'bac' } });
const saldoBac = (db) => bankBalances(movs(db), libro, methods).bancos.find((b) => b.id === 'bac').saldo;

test('1 · anular compra pagada con banco: lote «anulado» con motivo, pago con reversa y el banco vuelve exacto', async () => {
  const db = await base();
  const antes = saldoBac(db);
  const c = await comprarBanco(db, 'cmp-banco-01');
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.equal(saldoBac(db), antes - 377);
  const dep = await llamar(db, 'fin_compra_dependencias', { loteId: c.loteId });
  assert.equal(dep.ok, true); assert.equal(dep.modo, 'anular'); assert.equal(dep.dependencias.pagoContabilizado, true); assert.equal(dep.compra.costoTotalHnl, 377);
  assert.equal((await llamar(db, 'fin_compra_anular', { loteId: c.loteId, motivo: 'corto', operationId: 'anul-01' })).ok, false, 'motivo obligatorio');
  const r = await llamar(db, 'fin_compra_anular', { loteId: c.loteId, motivo: 'Registrada dos veces por error', operationId: 'anul-01' });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.modo, 'anular');
  const l = db.store.get(`fin_lotes/${c.loteId}`);
  assert.equal(l.estado, 'anulado'); assert.equal(l.motivoAnulacion, 'Registrada dos veces por error'); assert.equal(l.costoTotalHnl, 377, 'el costo original se conserva'); assert.equal(l.disponible, 0);
  const pago = movs(db).find((m) => m.id === `${c.loteId}_pago`);
  assert.equal(pago.estadoFinanciero, 'anulado'); assert.ok(movs(db).some((m) => m.reversaDe === pago.id && m.monto === -377));
  assert.equal(saldoBac(db), antes, 'el banco vuelve exacto');
  assert.ok([...db.store.keys()].some((k) => k.startsWith('fin_anulaciones/')), 'queda registro de auditoría de la anulación');
  assert.ok([...db.store.values()].some((v) => v && v.accion === 'compra_anulada'), 'evento de auditoría');
});

test('2 · doble clic / reintento con el mismo operationId: una sola anulación y una sola reversa', async () => {
  const db = await base();
  const c = await comprarBanco(db, 'cmp-banco-02');
  const a = await llamar(db, 'fin_compra_anular', { loteId: c.loteId, motivo: 'Monto equivocado en el voucher', operationId: 'anul-02' });
  const b = await llamar(db, 'fin_compra_anular', { loteId: c.loteId, motivo: 'Monto equivocado en el voucher', operationId: 'anul-02' });
  const x = await llamar(db, 'fin_compra_anular', { loteId: c.loteId, motivo: 'Monto equivocado en el voucher', operationId: 'anul-03' });
  assert.equal(a.modo, 'anular'); assert.ok(b.duplicado || b.yaAnulada); assert.ok(x.yaAnulada);
  assert.equal(movs(db).filter((m) => m.reversaDe).length, 1);
});

test('3 · Binance: los USDT vuelven a la billetera al mismo valor en Lempiras con que salieron', async () => {
  const db = await base();
  const w0 = { ...db.store.get('fin_billeteras/binance') };
  const c = await llamar(db, 'fin_compra_registrar', { operationId: 'cmp-bin-01', compra: { productoId: 'NFX-VIP', cantidad: 4, costoTotal: 10, moneda: 'USDT', pago: 'binance' } });
  assert.equal(db.store.get('fin_billeteras/binance').saldo, w0.saldo - 10);
  const r = await llamar(db, 'fin_compra_anular', { loteId: c.loteId, motivo: 'Proveedor devolvió el pago', operationId: 'anul-bin' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const w1 = db.store.get('fin_billeteras/binance');
  assert.equal(w1.saldo, w0.saldo); assert.equal(Math.round(w1.valorHnl * 100), Math.round(w0.valorHnl * 100));
  assert.deepEqual(revertirSalidaBinance({ saldo: 90, valorHnl: 2538 }, 10, 282), { saldo: 100, valorHnl: 2820, costoPromedio: 28.2 });
});

test('4 · compra con ventas costeadas: pide confirmación; al confirmar reversa el costo en el mes de cada venta y la venta queda pendiente', async () => {
  const db = await base();
  const c = await comprarBanco(db, 'cmp-banco-04', 377);
  const lid = c.loteId;
  db.store.set(`fin_lotes/${lid}`, { ...db.store.get(`fin_lotes/${lid}`), disponible: 0, consumido: 1 });
  db.store.set('fin_consumos/venta-x1', { ventaId: 'venta-x1', fecha: '2026-09-20', mesKey: '2026-09', clienteNombre: 'Cliente Prueba', plataforma: 'Netflix', ventaHnl: 120, costoHnl: 53.86, estado: 'completo', movimientos: ['venta-x1_cv'],
    lineas: [{ servicio: 'Netflix', cantidad: 1, productoId: 'NFX-PREM', consumos: [{ loteId: lid, cantidad: 1, costoUnitarioHnl: 53.86, costoHnl: 53.86 }], costoHnl: 53.86, faltante: 0, pendiente: false }] });
  const dep = await llamar(db, 'fin_compra_dependencias', { loteId: lid });
  assert.equal(dep.dependencias.ventasCosteadas.length, 1); assert.equal(dep.dependencias.costoVentasHnl, 53.86);
  const sin = await llamar(db, 'fin_compra_anular', { loteId: lid, motivo: 'La compra fue de otro mes', operationId: 'anul-04' });
  assert.equal(sin.ok, false); assert.equal(sin.requiereConfirmacion, true);
  assert.notEqual(db.store.get(`fin_lotes/${lid}`).estado, 'anulado', 'sin confirmar no se toca nada');
  const r = await llamar(db, 'fin_compra_anular', { loteId: lid, motivo: 'La compra fue de otro mes', operationId: 'anul-04b', confirmarDependencias: true });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.ventasPendientes, 1); assert.equal(r.costoReversadoHnl, 53.86);
  const cons = db.store.get('fin_consumos/venta-x1');
  assert.equal(cons.estado, 'pendiente'); assert.equal(cons.costoHnl, 0); assert.equal(cons.lineas[0].faltante, 1); assert.equal(cons.lineas[0].consumos.length, 0);
  const rev = movs(db).find((m) => m.subtipo === 'reversa_compra_anulada');
  assert.equal(rev.monto, -53.86); assert.equal(rev.mesKey, '2026-09', 'el costo se reversa en el mes de la venta, no hoy');
  assert.equal(movementKind(rev), 'costo_venta');
});

test('5 · borrador sin pago contabilizado ni dependencias → se elimina, con copia completa en la auditoría', async () => {
  const db = await base();
  const c = await llamar(db, 'fin_compra_registrar', { operationId: 'cmp-ini-01', compra: { productoId: 'NFX-VIP', cantidad: 2, costoTotal: 140, moneda: 'HNL', pago: 'inicial' } });
  db.store.set(`finanzas_movimientos/${db.store.get(`fin_lotes/${c.loteId}`).movimientoId}`, undefined); db.store.delete(`finanzas_movimientos/${db.store.get(`fin_lotes/${c.loteId}`).movimientoId}`); // borrador: aún sin asiento
  assert.equal(c.ok, true, JSON.stringify(c));
  const dep = await llamar(db, 'fin_compra_dependencias', { loteId: c.loteId });
  assert.equal(dep.modo, 'eliminar');
  const r = await llamar(db, 'fin_compra_anular', { loteId: c.loteId, motivo: 'Prueba registrada por error', operationId: 'anul-05' });
  assert.equal(r.modo, 'eliminar');
  assert.equal(db.store.get(`fin_lotes/${c.loteId}`), undefined);
  const marca = [...db.store.entries()].find(([k]) => k.startsWith('fin_anulaciones/'))[1];
  assert.equal(marca.tipo, 'eliminar_borrador'); assert.equal(marca.copia.producto, db.store.get('fin_productos/NFX-VIP').nombre);
});

test('6 · permisos: solo Sublicuentas (o admin) anula; vendedor recibe 403', async () => {
  const db = await base(); const c = await comprarBanco(db, 'cmp-banco-06');
  let code = 0, body = null; const res = { status: (s) => { code = s; return { json: (b) => { body = b; return b; } }; } };
  await handleEmpresa(db, 'fin_compra_anular', { loteId: c.loteId, motivo: 'intento sin permiso', operationId: 'x' }, { usuario: 'relojes', role: 'relojes' }, { uid: 'u2' }, res, deps(db));
  assert.equal(code, 403); assert.equal(db.store.get(`fin_lotes/${c.loteId}`).estado, 'activo');
});

test('7 · lineasSinLote (pura): saca solo el consumo de ese lote y lo deja como faltante', () => {
  const q = lineasSinLote([{ consumos: [{ loteId: 'a', cantidad: 1, costoHnl: 50 }, { loteId: 'b', cantidad: 2, costoHnl: 80 }], costoHnl: 130, faltante: 0 }], 'b');
  assert.equal(q.quitadoHnl, 80); assert.equal(q.quitadoUnidades, 2); assert.equal(q.lineas[0].costoHnl, 50); assert.equal(q.lineas[0].faltante, 2); assert.equal(q.lineas[0].consumos.length, 1);
});

test('8 · Web: menú por fila con «Ver detalle» y «Eliminar compra», motivo obligatorio y doble confirmación', () => {
  const w = fs.readFileSync(new URL('../finanzas-web.js', import.meta.url), 'utf8');
  assert.match(w, /data-fz-compra="eliminar"/); assert.match(w, /data-fz-compra="ver"/);
  assert.match(w, /api\('fin_compra_dependencias'/); assert.match(w, /api\('fin_compra_anular'/);
  assert.match(w, /name="confirmarDep"/); assert.match(w, /var opid = opId\(\);\n    var m = modal\(accion/);
});
