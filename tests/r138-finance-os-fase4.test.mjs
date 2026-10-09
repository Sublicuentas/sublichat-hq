import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { __pruebas } from '../api/finanzas.js';
import { handleEmpresa } from '../api/_finanzas-empresa.js';
import { correrCosteo } from '../api/_finanzas-costeo.js';
import { movementYmd, movementKind, money, cycleTotals, bankBalances } from '../api/_finanzas-libro.js';
import { normPlataformaKey } from '../api/_catalogo-categorias.js';
import { libroDiario, balanzaComprobacion, estadosFinancieros } from '../api/_contabilidad.js';

function fakeDb() {
  const store = new Map(); let n = 0;
  const ref = (c, id) => ({ id, _k: `${c}/${id}`, async set(d, o) { store.set(`${c}/${id}`, o?.merge ? { ...(store.get(`${c}/${id}`) || {}), ...d } : d); }, async get() { const d = store.get(`${c}/${id}`); return { id, exists: !!d, data: () => d }; } });
  const docsDe = (c) => [...store.entries()].filter(([k]) => k.startsWith(`${c}/`) && !k.slice(c.length + 1).includes('/')).map(([k, d]) => ({ id: k.slice(c.length + 1), data: () => d }));
  const q = (c, filt = () => true) => ({ get: async () => ({ docs: docsDe(c).filter(filt) }), limit: () => q(c, filt), orderBy: () => q(c, filt), where: (f, op, v) => q(c, (x) => filt(x) && (op === '==' ? x.data()[f] === v : true)) });
  return { store,
    collection: (c) => ({ doc: (id) => ref(c, id || `auto${++n}`), ...q(c) }),
    async runTransaction(fn) { const buf = []; const tx = { get: (r) => r.get(), set: (r, d, o) => buf.push([r._k, d, o]), update: (r, d) => buf.push([r._k, d, { merge: true }]) }; const out = await fn(tx); for (const [k, d, o] of buf) store.set(k, o?.merge ? { ...(store.get(k) || {}), ...d } : d); return out; } };
}
const methods = [{ id: 'bac', nombre: 'BAC Credomatic', logoKey: 'bac', activo: true }];
const libro = { bases: { bac: { saldo: 20000, desde: '2026-10-01' } } };
const movs = (db) => [...db.store.entries()].filter(([k]) => k.startsWith('finanzas_movimientos/')).map(([k, d]) => ({ id: k.split('/')[1], ...d }));
const HOY = '2026-10-08';
const costeoDeps = (db) => ({ R: { movementYmd, movementKind, money }, normPlataformaKey, leerMovimientos: async (desde) => movs(db).filter((m) => (movementYmd(m) || '') >= desde) });
const deps = (db) => ({ canUseLibro: () => true, hoyYmdHN: () => HOY, auditar: (tx, _d, i, ev) => tx.set(db.collection('auditoria_eventos').doc(), ev), loadMethods: async () => methods,
  libroOpDocId: (p, b, u) => (b.operationId ? `${p}_${u}_${b.operationId}` : ''), estadoLibro: async () => ({ saldos: bankBalances(movs(db), libro, methods) }),
  baseMov: () => ({ registradoPor: 'sublicuentas', createdAt: '2026-10-08T20:00:00Z' }), canonicalFinanceDate: (f) => { const [y, m, d] = f.split('-'); return { fecha: `${d}/${m}/${y}`, fechaPago: f, mesKey: `${y}-${m}` }; }, costeoDeps });
const emp = async (db, accion, body = {}) => { let out; const res = { status: () => ({ json: (b) => { out = b; return b; } }) }; await handleEmpresa(db, accion, body, { usuario: 'sublicuentas', role: 'sublicuentas' }, { uid: 'u1' }, res, deps(db)); return out; };
const centro = async (db, accion, body = {}) => { let out; const res = { status: () => ({ json: (b) => { out = b; return b; } }) }; await __pruebas.handleCentro(db, accion, { accion, ...body }, { usuario: 'relojes', role: 'relojes' }, { uid: 'u1' }, res); return out; };
const saldoBac = (db) => bankBalances(movs(db), libro, methods).bancos.find((b) => b.id === 'bac').saldo;
async function base() {
  const db = fakeDb();
  db.store.set('portal_cliente/configuracion', { metodos: methods });
  db.store.set('finanzas_config/libro_mayor', libro);
  await emp(db, 'fin_sembrar_catalogo');
  await emp(db, 'fin_binance_recargar', { bancoId: 'bac', hnl: 2820, usdt: 100, operationId: 'rec-0000001' });
  return db;
}

test('Prueba D: venta pendiente de vendedor → CxC sin subir banco; abono parcial baja CxC y sube banco; el abono NO crea otra venta', async () => {
  const db = await base();
  const antes = saldoBac(db);
  const r = await centro(db, 'registrar_operacion_pago', { tipoOrigen: 'renovacion', montoTotal: 300, recibido: 0, responsable: 'vendedor', vendedorNombre: 'Jimena', clienteNombre: 'Cliente X', plataforma: 'Stella TV', operationId: 'opD-00000001' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const cxc = [...db.store.entries()].find(([k]) => k.startsWith('cuentas_por_cobrar/'));
  assert.ok(cxc, 'nace la cuenta por cobrar'); assert.equal(cxc[1].saldoPendiente, 300); assert.equal(cxc[1].deudorTipo, 'vendedor');
  assert.equal(saldoBac(db), antes, 'el banco NO sube');
  assert.equal(movs(db).filter((m) => m.tipo === 'venta').length, 1);
  const a = await centro(db, 'registrar_abono', { cuentaId: cxc[0].split('/')[1], monto: 100, bancoId: 'bac', operationId: 'abD-00000001' });
  assert.equal(a.ok, true, JSON.stringify(a)); assert.equal(a.saldoPendiente, 200); assert.equal(a.estado, 'parcial');
  assert.equal(saldoBac(db), antes + 100, 'el abono sí entra al banco');
  assert.equal(movs(db).filter((m) => m.tipo === 'venta').length, 1, 'el abono NO crea otra venta');
  // El costo de ventas tampoco lo cuenta como otra venta.
  await emp(db, 'fin_compra_registrar', { operationId: 'compra-stella01', compra: { productoId: 'STELLA', cantidad: 15, costoTotal: 37.5, moneda: 'USDT', pago: 'binance' } });
  await emp(db, 'fin_costeo_config', { desde: '2026-10-01' });
  const c = await correrCosteo(db, { ...costeoDeps(db), hoy: HOY, actor: 't' });
  assert.equal(c.costeadas, 1, 'una venta = un costo, aunque tenga abonos');
  const est = await emp(db, 'fin_empresa_estado');
  assert.equal(est.cxc.vendedoresHnl, 200); assert.equal(est.cxc.deudores[0].deudor, 'Jimena');
});

test('Compra a crédito: sube inventario y nace la cuenta por pagar; ni banco ni Binance se mueven', async () => {
  const db = await base();
  const b0 = saldoBac(db), bin0 = db.store.get('fin_billeteras/binance').saldo;
  const r = await emp(db, 'fin_compra_registrar', { operationId: 'compra-cred0001', compra: { productoId: 'LION', proveedorId: 'pago-directo-tarjeta', cantidad: 100, costoTotal: 7500, moneda: 'HNL', pago: 'credito', vencePago: '2026-10-20' } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(saldoBac(db), b0); assert.equal(db.store.get('fin_billeteras/binance').saldo, bin0);
  const cxp = db.store.get(`fin_cxp/${r.loteId}`); assert.equal(cxp.saldo, 7500); assert.equal(cxp.vence, '2026-10-20'); assert.equal(cxp.estado, 'pendiente');
  assert.equal(cycleTotals(movs(db), '2026-10-01', '').resultado, 0, 'no es gasto');
  const sinProv = await emp(db, 'fin_compra_registrar', { operationId: 'compra-cred0002', compra: { productoId: 'LION', cantidad: 1, costoTotal: 75, moneda: 'HNL', pago: 'credito' } });
  assert.equal(sinProv.ok, false); assert.match(sinProv.error, /proveedor/);
  // Pago parcial con banco
  const p1 = await emp(db, 'fin_cxp_pagar', { cxpId: r.loteId, monto: 3000, pago: 'banco', bancoId: 'bac', operationId: 'pag-00000001' });
  assert.equal(p1.ok, true, JSON.stringify(p1)); assert.equal(p1.estado, 'parcial'); assert.equal(p1.diferencialHnl, 0);
  assert.equal(saldoBac(db), b0 - 3000);
  const dup = await emp(db, 'fin_cxp_pagar', { cxpId: r.loteId, monto: 3000, pago: 'banco', bancoId: 'bac', operationId: 'pag-00000001' }); assert.equal(dup.duplicado, true);
  assert.equal((await emp(db, 'fin_cxp_pagar', { cxpId: r.loteId, monto: 9000, pago: 'banco', bancoId: 'bac', operationId: 'pag-00000002' })).ok, false, 'no se paga de más');
  const p2 = await emp(db, 'fin_cxp_pagar', { cxpId: r.loteId, monto: 4500, pago: 'banco', bancoId: 'bac', operationId: 'pag-00000003' });
  assert.equal(p2.estado, 'pagado');
  const ef = estadosFinancieros({ movimientos: movs(db), libro, methods, mes: '2026-10', hoy: HOY });
  assert.ok(ef.balanza.cuadra); assert.ok(ef.flujo.cuadra);
  assert.equal(ef.balanza.cuentas.find((c) => c.cuenta === '2100').saldo, 0, 'deuda saldada');
  assert.equal(ef.resultados.utilidadNeta, 0, 'pagar al proveedor no es gasto');
});

test('Deuda en USDT pagada con Binance a otra tasa: la diferencia sale como diferencial cambiario', async () => {
  const db = await base();
  const r = await emp(db, 'fin_compra_registrar', { operationId: 'compra-cred0003', compra: { productoId: 'STELLA', proveedorId: 'deku-peru', cantidad: 15, costoTotal: 37.5, moneda: 'USDT', pago: 'credito' } });
  assert.equal(r.costoTotalHnl, 1057.5); // estimado a la tasa de Binance de ese día (28.20)
  await emp(db, 'fin_binance_recargar', { bancoId: 'bac', hnl: 2900, usdt: 100, operationId: 'rec-0000002' }); // promedio 28.60
  const p = await emp(db, 'fin_cxp_pagar', { cxpId: r.loteId, monto: 37.5, pago: 'binance', operationId: 'pag-usdt0001' });
  assert.equal(p.ok, true, JSON.stringify(p)); assert.equal(p.pagadoHnl, 1072.5); assert.equal(p.diferencialHnl, 15); assert.equal(p.estado, 'pagado');
  assert.equal(db.store.get('fin_billeteras/binance').saldo, 162.5);
  const bz = balanzaComprobacion(libroDiario(movs(db), {}, methods, '2026-10-01', '2026-10-31'));
  assert.ok(bz.cuadra); assert.equal(bz.cuentas.find((c) => c.cuenta === '2100').saldo, 0); assert.equal(bz.cuentas.find((c) => c.cuenta === '5900').saldo, 15);
  assert.equal((await emp(db, 'fin_compra_registrar', { operationId: 'compra-cred0004', compra: { productoId: 'LION', proveedorId: 'deku-peru', cantidad: 1, costoTotal: 75, moneda: 'HNL', pago: 'credito' } })).ok, true);
  const est = await emp(db, 'fin_empresa_estado');
  assert.equal(est.cxp.cuentas.length, 1); assert.equal(est.cxp.totalHnl, 75);
  const hl = await emp(db, 'fin_cxp_pagar', { cxpId: est.cxp.cuentas[0].id, monto: 75, pago: 'binance', operationId: 'pag-usdt0002' });
  assert.equal(hl.ok, false); assert.match(hl.error, /USDT/);
});

test('Web: pestaña Cobrar / Pagar con abonos y pagos; compra a crédito', () => {
  const app = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(app, /\["cxccxp","Cobrar \/ Pagar"\]/); assert.match(app, /api\("registrar_abono"/); assert.match(app, /api\("fin_cxp_pagar"/); assert.match(app, /\{v:"credito",t:"A crédito/);
});
