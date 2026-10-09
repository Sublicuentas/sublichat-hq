import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { handleEmpresa } from '../api/_finanzas-empresa.js';
import { correrCosteo, unidadesDeVenta, productoDeServicio, ventasACostear } from '../api/_finanzas-costeo.js';
import { movementYmd, movementKind, money, cycleTotals, bankBalances } from '../api/_finanzas-libro.js';
import { normPlataformaKey } from '../api/_catalogo-categorias.js';
import { libroDiario, balanzaComprobacion } from '../api/_contabilidad.js';

function fakeDb() {
  const store = new Map(); let n = 0;
  const ref = (c, id) => ({ id, _k: `${c}/${id}`, async set(d, o) { store.set(`${c}/${id}`, o?.merge ? { ...(store.get(`${c}/${id}`) || {}), ...d } : d); }, async get() { const d = store.get(`${c}/${id}`); return { id, exists: !!d, data: () => d }; } });
  const docsDe = (c) => [...store.entries()].filter(([k]) => k.startsWith(`${c}/`)).map(([k, d]) => ({ id: k.slice(c.length + 1), data: () => d }));
  return { store,
    collection: (c) => ({ doc: (id) => ref(c, id || `auto${++n}`), get: async () => ({ docs: docsDe(c) }), where: (f, op, v) => ({ get: async () => ({ docs: docsDe(c).filter((x) => x.data()[f] === v) }) }) }),
    async runTransaction(fn) { const buf = []; const tx = { get: (r) => r.get(), set: (r, d, o) => buf.push([r._k, d, o]) }; const out = await fn(tx); for (const [k, d, o] of buf) store.set(k, o?.merge ? { ...(store.get(k) || {}), ...d } : d); return out; } };
}
const methods = [{ id: 'bac', nombre: 'BAC Credomatic' }];
const libro = { bases: { bac: { saldo: 50000, desde: '2026-10-01' } } };
const movs = (db) => [...db.store.entries()].filter(([k]) => k.startsWith('finanzas_movimientos/')).map(([k, d]) => ({ id: k.split('/')[1], ...d }));
let HOY = '2026-10-08';
const costeoDeps = (db) => ({ R: { movementYmd, movementKind, money }, normPlataformaKey, leerMovimientos: async (desde) => movs(db).filter((m) => (movementYmd(m) || '') >= desde) });
const deps = (db) => ({ canUseLibro: () => true, hoyYmdHN: () => HOY, auditar: (tx, _d, i, ev) => tx.set(db.collection('auditoria_eventos').doc(), ev), loadMethods: async () => methods,
  libroOpDocId: (p, b, u) => (b.operationId ? `${p}_${u}_${b.operationId}` : ''), estadoLibro: async () => ({ saldos: bankBalances(movs(db), libro, methods) }),
  baseMov: () => ({ registradoPor: 'sublicuentas', createdAt: '2026-10-08T20:00:00Z' }), canonicalFinanceDate: (f) => { const [y, m, d] = f.split('-'); return { fecha: `${d}/${m}/${y}`, fechaPago: f, mesKey: `${y}-${m}` }; }, costeoDeps });
const llamar = async (db, accion, body = {}) => { let out; const res = { status: () => ({ json: (b) => { out = b; return b; } }) }; await handleEmpresa(db, accion, body, { usuario: 'sublicuentas', role: 'sublicuentas' }, { uid: 'u1' }, res, deps(db)); return out; };
const correr = (db) => correrCosteo(db, { ...costeoDeps(db), hoy: HOY, actor: 'test' });
// Una venta como la registra HOY la APK/web/bot (venta + cobro con el mismo opId). No se toca esa lógica.
function venta(db, op, { plataforma, monto, fecha = '2026-10-08', cliente = 'Cliente' }) {
  const [y, m, d] = fecha.split('-'); const f = { fecha: `${d}/${m}/${y}`, fechaPago: fecha, mesKey: `${y}-${m}` };
  db.store.set(`finanzas_movimientos/${op}_venta`, { tipo: 'venta', subtipo: 'renovacion', monto, montoRecibido: monto, saldoPendiente: 0, plataforma, clienteNombre: cliente, operacionId: op, ...f });
  db.store.set(`finanzas_movimientos/${op}_cobro`, { tipo: 'ingreso', subtipo: 'cobro_renovacion', monto, bancoId: 'bac', banco: 'BAC Credomatic', plataforma, clienteNombre: cliente, operacionId: op, ...f });
}
async function base() {
  HOY = '2026-10-08';
  const db = fakeDb(); await llamar(db, 'fin_sembrar_catalogo');
  await llamar(db, 'fin_binance_recargar', { bancoId: 'bac', hnl: 2820, usdt: 100, operationId: 'rec-0000001' });
  return db;
}

test('Sin activar no costea nada (las ventas viejas no se tocan)', async () => {
  const db = await base(); venta(db, 'op1', { plataforma: 'Stella TV', monto: 200 });
  assert.equal((await correr(db)).activo, false);
  assert.equal([...db.store.keys()].filter((k) => k.startsWith('fin_consumos/')).length, 0);
});

test('Prueba C completa: venta de Stella 3 dispositivos descuenta 1 crédito y guarda su costo; una sola vez', async () => {
  const db = await base();
  await llamar(db, 'fin_compra_registrar', { operationId: 'compra-stella01', compra: { productoId: 'STELLA', cantidad: 15, costoTotal: 37.5, moneda: 'USDT', pago: 'binance' } });
  await llamar(db, 'fin_costeo_config', { desde: '2026-10-08' });
  venta(db, 'op1', { plataforma: 'Stella TV 3 dispositivos', monto: 200, cliente: 'Ana' });
  const r = await correr(db); assert.equal(r.costeadas, 1); assert.equal(r.costoHnl, 70.5);
  const c = db.store.get('fin_consumos/op1_venta');
  assert.equal(c.estado, 'completo'); assert.equal(c.lineas[0].producto, 'Stella TV'); assert.equal(c.lineas[0].consumos[0].cantidad, 1); assert.equal(c.utilidadBrutaHnl, 129.5);
  const lote = [...db.store.entries()].find(([k, v]) => k.startsWith('fin_lotes/') && v.productoId === 'STELLA')[1];
  assert.equal(lote.disponible, 14); assert.equal(lote.consumido, 1);
  const r2 = await correr(db); assert.equal(r2.costeadas, 0, 'no se costea dos veces');
  assert.equal(lote.disponible, 14);
  const m = movs(db);
  assert.equal(m.filter((x) => x.tipo === 'costo_venta').length, 1);
  assert.equal(cycleTotals(m, '2026-10-01', '').ingresos, 200, 'no crea otra venta ni otro ingreso');
  assert.ok(balanzaComprobacion(libroDiario(m, {}, methods, '2026-10-01', '2026-10-31')).cuadra);
  assert.equal(m.filter((x) => movementKind(x) === 'ingreso').length, 1);
});

test('Cuenta madre: Netflix L377 = 7 perfiles-mes a L53.86; al vencer, lo no vendido es "Cupos sin vender"', async () => {
  const db = await base();
  const k = await llamar(db, 'fin_compra_registrar', { operationId: 'compra-nfx00001', compra: { productoId: 'NFX-PREM', cantidad: 1, costoTotal: 377, moneda: 'HNL', pago: 'banco', bancoId: 'bac' } });
  assert.equal(k.unidades, 7); assert.equal(k.costoUnitarioHnl, 53.857143);
  await llamar(db, 'fin_costeo_config', { desde: '2026-10-08' });
  venta(db, 'op2', { plataforma: 'Netflix', monto: 130, cliente: 'Luis' });
  await correr(db);
  assert.equal(db.store.get('fin_consumos/op2_venta').costoHnl, 53.86);
  HOY = '2026-11-10'; // el lote venció el 07/11 con 6 perfiles sin vender
  const r = await correr(db); assert.equal(r.vencimientos, 1);
  const v = movs(db).find((x) => x.tipo === 'inventario' && x.subtipo === 'cupos_sin_vender');
  assert.equal(v.monto, 323.14); assert.match(v.motivo, /Cupos sin vender/);
  const bz = balanzaComprobacion(libroDiario(movs(db), {}, methods, '2026-10-01', '2026-11-30'));
  assert.ok(bz.cuadra); assert.equal(bz.cuentas.find((c) => c.cuenta === '5160').saldo, 323.14); assert.equal(bz.cuentas.find((c) => c.cuenta === '5000').saldo, 53.86);
  assert.equal(Math.abs(bz.cuentas.find((c) => c.cuenta === '1300').saldo), 0, 'el inventario de esa cuenta queda en 0');
});

test('Venta sin inventario queda pendiente y se completa sola al registrar la compra', async () => {
  const db = await base();
  await llamar(db, 'fin_costeo_config', { desde: '2026-10-08' });
  venta(db, 'op3', { plataforma: 'Lion TV', monto: 250 });
  let r = await correr(db); assert.equal(r.pendientes, 1);
  assert.equal(db.store.get('fin_consumos/op3_venta').estado, 'pendiente');
  await llamar(db, 'fin_compra_registrar', { operationId: 'compra-lion0001', compra: { productoId: 'LION', cantidad: 100, costoTotal: 7500, moneda: 'HNL', pago: 'banco', bancoId: 'bac' } });
  r = await correr(db); assert.equal(r.completadas, 1);
  const c = db.store.get('fin_consumos/op3_venta'); assert.equal(c.estado, 'completo'); assert.equal(c.costoHnl, 75);
});

test('Venta anulada: el crédito vuelve al lote y el costo se anula con su reversa', async () => {
  const db = await base();
  await llamar(db, 'fin_compra_registrar', { operationId: 'compra-stella02', compra: { productoId: 'STELLA', cantidad: 15, costoTotal: 37.5, moneda: 'USDT', pago: 'binance' } });
  await llamar(db, 'fin_costeo_config', { desde: '2026-10-08' });
  venta(db, 'op4', { plataforma: 'Stella', monto: 130 });
  await correr(db);
  db.store.set('finanzas_movimientos/op4_cobro', { ...db.store.get('finanzas_movimientos/op4_cobro'), estadoFinanciero: 'anulado' });
  const r = await correr(db); assert.equal(r.revertidas, 1);
  const lote = [...db.store.entries()].find(([k, v]) => k.startsWith('fin_lotes/') && v.productoId === 'STELLA')[1];
  assert.equal(lote.disponible, 15);
  const m = movs(db); const cv = m.find((x) => x.id === 'op4_venta_cv');
  assert.equal(cv.estadoFinanciero, 'anulado'); assert.ok(m.find((x) => x.reversaDe === 'op4_venta_cv'));
  const bz = balanzaComprobacion(libroDiario(m, {}, methods, '2026-10-01', '2026-10-31'));
  assert.ok(!bz.cuentas.find((c) => c.cuenta === '5000'), 'el costo anulado no cuenta');
});

test('Qué cuenta como venta: no duplica cobros, abonos ni correcciones; el ingreso manual sí se costea', () => {
  const f = { fecha: '08/10/2026', fechaPago: '2026-10-08' };
  const ms = [
    { id: 'a_venta', tipo: 'venta', monto: 100, plataforma: 'Spotify', ...f }, { id: 'a_cobro', tipo: 'ingreso', monto: 100, plataforma: 'Spotify', operacionId: 'a', ...f },
    { id: 'ab1', tipo: 'ingreso', subtipo: 'cobro_pendiente_cliente', cuentaId: 'x', monto: 50, plataforma: 'Spotify', ...f },
    { id: 'man1', tipo: 'ingreso', monto: 110, plataforma: 'Spotify', detalle: 'María', ...f },
    { id: 'man1_c1', tipo: 'ingreso', monto: 110, plataforma: 'Spotify', sustituyeA: 'man1', ...f },
    { id: 'viejo', tipo: 'ingreso', monto: 80, plataforma: 'Netflix', fecha: '01/10/2026', fechaPago: '2026-10-01' },
  ];
  const v = ventasACostear(ms, '2026-10-08', { movementYmd, movementKind, money });
  assert.deepEqual(v.map((x) => x.id), ['a_venta', 'man1']);
  assert.deepEqual(unidadesDeVenta({ plataforma: 'Netflix + Disney', monto: 210 }).map((u) => [u.servicio, u.ingresoHnl]), [['Netflix', 105], ['Disney', 105]]);
  assert.deepEqual(unidadesDeVenta({ productosSocio: [{ servicio: 'Stella', cantidad: 3 }], monto: 390 }).map((u) => [u.servicio, u.cantidad]), [['Stella', 3]]);
  const prods = [{ id: 'OLEADA-1', sku: 'OLEADA-1', plataformaKey: 'oleada', nombre: 'Oleada 1' }, { id: 'OLEADA-3', sku: 'OLEADA-3', plataformaKey: 'oleada', nombre: 'Oleada 3' }, { id: 'HBO-PLAT', sku: 'HBO-PLAT', plataformaKey: 'hbomax', nombre: 'HBO Platinum', modelo: 'cuenta_madre' }, { id: 'HBO-LINK', sku: 'HBO-LINK', plataformaKey: 'hbomax', nombre: 'HBO links', modelo: 'link' }];
  assert.equal(productoDeServicio('Oleada', prods, [], normPlataformaKey).id, 'OLEADA-1');
  assert.equal(productoDeServicio('Oleada 3 dispositivos', prods, [], normPlataformaKey).id, 'OLEADA-3');
  assert.equal(productoDeServicio('HBO Max link', prods, [], normPlataformaKey).id, 'HBO-LINK');
  assert.equal(productoDeServicio('HBO Max', prods, [{ productoId: 'HBO-LINK', disponible: 3 }], normPlataformaKey).id, 'HBO-LINK', 'sin pista: el que tenga inventario');
});

test('Servicio que no está en el catálogo queda "sin producto" para corregir; el resumen del mes lo muestra', async () => {
  const db = await base();
  await llamar(db, 'fin_costeo_config', { desde: '2026-10-08' });
  venta(db, 'op5', { plataforma: 'Deezer', monto: 90, cliente: 'Pedro' });
  const est = await llamar(db, 'fin_empresa_estado'); // abrir 🏢 Empresa costea solo
  assert.equal(est.costeo.corrida.sinProducto, 1);
  assert.equal(est.costeo.pendientes[0].faltan[0].sinProducto, true);
  assert.equal(est.costeo.config.desde, '2026-10-08');
});

test('Web y bot: pestaña Costo de ventas; el bot costea cada 10 min con el MISMO motor', () => {
  const app = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(app, /\["costeo","Costo de ventas"\]/); assert.match(app, /fin_costeo_config/);
  const bot = new URL('../../../bot/sublicuentas-tg-bot-main/lib_finanzas_costeo.js', import.meta.url);
  if (fs.existsSync(bot)) { const cuerpo = (t) => t.split('\n').filter((l) => !/^(\/\/ (api\/_finanzas-costeo|lib_finanzas_costeo)|export \{|module\.exports)/.test(l)).join('\n'); assert.equal(cuerpo(fs.readFileSync(bot, 'utf8')), cuerpo(fs.readFileSync(new URL('../api/_finanzas-costeo.js', import.meta.url), 'utf8'))); }
});
