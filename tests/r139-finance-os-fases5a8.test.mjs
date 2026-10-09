import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { __pruebas } from '../api/finanzas.js';
import { handleEmpresa } from '../api/_finanzas-empresa.js';
import { utilidadRepartible, resultadosRango } from '../api/_finanzas-reportes.js';
import { ventasACostear } from '../api/_finanzas-costeo.js';
import * as R from '../api/_finanzas-libro.js';
import { normPlataformaKey } from '../api/_catalogo-categorias.js';

function fakeDb() {
  const store = new Map(); let n = 0;
  const ref = (c, id) => ({ id, _k: `${c}/${id}`, async set(d, o) { store.set(`${c}/${id}`, o?.merge ? { ...(store.get(`${c}/${id}`) || {}), ...d } : d); }, async get() { const d = store.get(`${c}/${id}`); return { id, exists: !!d, data: () => d }; } });
  const docsDe = (c) => [...store.entries()].filter(([k]) => k.startsWith(`${c}/`) && !k.slice(c.length + 1).includes('/')).map(([k, d]) => ({ id: k.slice(c.length + 1), data: () => d }));
  const q = (c, filt = () => true) => ({ get: async () => ({ docs: docsDe(c).filter(filt) }), limit: () => q(c, filt), orderBy: () => q(c, filt), where: (f, op, v) => q(c, (x) => filt(x) && (op === '==' ? x.data()[f] === v : true)) });
  return { store, collection: (c) => ({ doc: (id) => ref(c, id || `auto${++n}`), ...q(c) }),
    async runTransaction(fn) { const buf = []; const tx = { get: (r) => r.get(), set: (r, d, o) => buf.push([r._k, d, o]), update: (r, d) => buf.push([r._k, d, { merge: true }]) }; const out = await fn(tx); for (const [k, d, o] of buf) store.set(k, o?.merge ? { ...(store.get(k) || {}), ...d } : d); return out; } };
}
const methods = [{ id: 'bac', nombre: 'BAC Credomatic', logoKey: 'bac', activo: true }, { id: 'ficohsa', nombre: 'Ficohsa', logoKey: 'ficohsa', activo: true }];
const libro = { bases: { bac: { saldo: 20000, desde: '2026-10-01' } } };
const movs = (db) => [...db.store.entries()].filter(([k]) => k.startsWith('finanzas_movimientos/')).map(([k, d]) => ({ id: k.split('/')[1], ...d }));
const HOY = new Date(Date.now() - 6 * 3600000).toISOString().slice(0, 10); // handleCentro usa la fecha real de Honduras
const costeoDeps = (db) => ({ R: { movementYmd: R.movementYmd, movementKind: R.movementKind, money: R.money, anuladoOReversa: R.anuladoOReversa, bankBalances: R.bankBalances }, normPlataformaKey, leerMovimientos: async (desde) => movs(db).filter((m) => (R.movementYmd(m) || '') >= desde) });
const deps = (db) => ({ canUseLibro: () => true, hoyYmdHN: () => HOY, auditar: (tx, _d, i, ev) => tx.set(db.collection('auditoria_eventos').doc(), ev), loadMethods: async () => methods,
  libroOpDocId: (p, b, u) => (b.operationId ? `${p}_${u}_${b.operationId}` : ''), estadoLibro: async () => ({ saldos: R.bankBalances(movs(db), libro, methods) }),
  baseMov: () => ({ registradoPor: 'sublicuentas', createdAt: '2026-10-08T20:00:00Z' }), canonicalFinanceDate: (f) => { const [y, m, d] = f.split('-'); return { fecha: `${d}/${m}/${y}`, fechaPago: f, mesKey: `${y}-${m}` }; }, costeoDeps });
const emp = async (db, accion, body = {}) => { let out; const res = { status: () => ({ json: (b) => { out = b; return b; } }) }; await handleEmpresa(db, accion, body, { usuario: 'sublicuentas', role: 'sublicuentas' }, { uid: 'u1' }, res, deps(db)); return out; };
const centro = async (db, accion, body = {}) => { let out; const res = { status: () => ({ json: (b) => { out = b; return b; } }) }; await __pruebas.handleCentro(db, accion, { accion, ...body }, { usuario: 'relojes', role: 'relojes' }, { uid: 'u1' }, res); return out; };
const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); return r; };

// Un mes completo de operación: el escenario H del PDF.
async function mesCompleto() {
  const db = fakeDb();
  db.store.set('portal_cliente/configuracion', { metodos: methods });
  db.store.set('finanzas_config/libro_mayor', libro);
  ok(await emp(db, 'fin_sembrar_catalogo'));
  ok(await emp(db, 'fin_binance_recargar', { bancoId: 'bac', hnl: 2820, usdt: 100, operationId: 'rec-0000001' }));                                  // A
  ok(await emp(db, 'fin_compra_registrar', { operationId: 'compra-vip00001', compra: { productoId: 'NFX-VIP', proveedorId: 'trap-colombia', cantidad: 25, costoTotal: 62.5, moneda: 'USDT', pago: 'binance' } })); // B
  ok(await emp(db, 'fin_compra_registrar', { operationId: 'compra-stel0001', compra: { productoId: 'STELLA', cantidad: 15, costoTotal: 37.5, moneda: 'USDT', pago: 'binance' } }));                    // C
  ok(await emp(db, 'fin_compra_registrar', { operationId: 'compra-nfx00001', compra: { productoId: 'NFX-PREM', cantidad: 1, costoTotal: 377, moneda: 'HNL', pago: 'banco', bancoId: 'bac' } }));
  ok(await emp(db, 'fin_compra_registrar', { operationId: 'compra-lion0001', compra: { productoId: 'LION', proveedorId: 'pago-directo-tarjeta', cantidad: 100, costoTotal: 7500, moneda: 'HNL', pago: 'credito', vencePago: '2026-10-30' } }));
  ok(await emp(db, 'fin_compra_registrar', { operationId: 'compra-ini00001', compra: { productoId: 'OLEADA-1', cantidad: 10, costoTotal: 300, moneda: 'HNL', pago: 'inicial' } }));
  ok(await emp(db, 'fin_costeo_config', { desde: '2026-10-01' }));
  // Ventas como se registran hoy (APK/web): pagadas y una pendiente del vendedor (D)
  for (const [op, plat, total, rec, resp] of [['op-stella-0001', 'Stella TV 3 dispositivos', 200, 200, 'cliente'], ['op-netflx-0001', 'Netflix', 130, 130, 'cliente'], ['op-vipnf-0001', 'Netflix VIP', 120, 120, 'cliente'], ['op-lion00-0001', 'Lion TV', 250, 250, 'cliente'], ['op-oleada-0001', 'Oleada', 90, 0, 'vendedor'], ['op-vix000-0001', 'Vix', 300, 100, 'cliente']])
    ok(await centro(db, 'registrar_operacion_pago', { tipoOrigen: 'renovacion', montoTotal: total, recibido: rec, bancoId: rec ? 'bac' : '', responsable: resp, vendedorNombre: 'Jimena', clienteNombre: `Cliente ${op}`, plataforma: plat, operationId: op }));
  const cxc = [...db.store.keys()].find((k) => k.startsWith('cuentas_por_cobrar/') && k.includes('op-oleada')).split('/')[1];
  ok(await centro(db, 'registrar_abono', { cuentaId: cxc, monto: 40, bancoId: 'bac', operationId: 'abono-00000001' }));
  db.store.set('finanzas_movimientos/egr1', { tipo: 'egreso', subtipo: 'egreso_operativo', monto: 150, bancoId: 'bac', banco: 'BAC Credomatic', motivo: 'Meta Ads', fecha: '08/10/2026', fechaPago: '2026-10-08', mesKey: '2026-10' });
  ok(await emp(db, 'fin_cxp_pagar', { cxpId: 'compra_u1_compra-lion0001', monto: 2500, pago: 'banco', bancoId: 'bac', operationId: 'pagcxp-000001' }));
  ok(await emp(db, 'fin_retiro_registrar', { bancoId: 'bac', monto: 500, beneficiario: 'Dueño', motivo: 'Utilidades', operationId: 'ret-000000001' }));
  ok(await emp(db, 'fin_costear'));
  return db;
}

test('Prueba H: tablero del mes — todo concilia con el libro (bancos, Binance, inventario, cuentas por pagar y por cobrar)', async () => {
  const db = await mesCompleto();
  const t = ok(await emp(db, 'fin_tablero', { mes: HOY.slice(0, 7) }));
  for (const f of t.conciliacion.filas) assert.ok(f.ok, `${f.nombre}: sistema ${f.sistema} vs libro ${f.libro}`);
  assert.equal(t.conciliacion.todoCuadra, true);
  const r = t.resultados;
  assert.equal(r.ventas, 1090, 'ventas por venta (incluye las pendientes de cobro)');
  assert.equal(r.costoVentas, 70.5 + 53.86 + 70.5 + 75 + 30, 'Stella + Netflix + VIP + Lion + Oleada');
  assert.equal(r.utilidadBruta, Math.round((1090 - r.costoVentas) * 100) / 100);
  assert.equal(r.ventasPendientesCobro, 250, 'Oleada 90−40 + Vix 300−100 (sale de las cuentas por cobrar)'); assert.equal(r.retiros, 500); assert.equal(r.gastosOperativos, 150);
  assert.equal(r.utilidadNeta, Math.round((r.utilidadBruta - r.gastosOperativos - r.planilla - r.cuposSinVender - r.mermas - r.diferencialCambiario) * 100) / 100, 'el retiro NO resta utilidad');
  const b = t.balance;
  assert.equal(b.cuentasPorCobrar, 250); assert.equal(b.cuentasPorPagar, 5000); assert.equal(b.binanceUsdt, 0);
  assert.equal(b.patrimonio, Math.round((b.activos - b.pasivos) * 100) / 100);
  const stella = t.rentabilidad.productos.find((p) => p.nombre === 'Stella TV'); assert.equal(stella.utilidadBrutaHnl, 129.5);
  assert.ok(t.rentabilidad.vendedores.length >= 1); assert.ok(t.rentabilidad.proveedores.find((p) => p.nombre === 'Trap Colombia'));
  assert.ok(t.costosProveedor.find((c) => c.producto === 'Netflix VIP' && c.proveedor === 'Trap Colombia' && c.promedioHnl === 70.5));
});

test('Fase 6: retiro de dueños baja el banco pero no la utilidad; utilidad repartible = lo menor entre utilidad y caja', async () => {
  const db = await mesCompleto();
  const m = movs(db), ret = m.find((x) => x.tipo === 'retiro');
  assert.equal(R.movementKind(ret), 'retiro'); assert.equal(R.cycleTotals(m, '2026-10-01', '').egresosOperativos, R.cycleTotals(m.filter((x) => x !== ret), '2026-10-01', '').egresosOperativos);
  const u = utilidadRepartible({ acumulado: { utilidadNeta: 1000, retiros: 200 }, balance: { bancos: 3000, binanceHnl: 0, cuentasPorPagar: 1000 }, config: { reservaPct: 10, capitalTrabajoMin: 1500 } });
  assert.deepEqual([u.reserva, u.porUtilidad, u.porCaja, u.repartible, u.limitaPor], [100, 700, 500, 500, 'caja']);
  assert.equal(ok(await emp(db, 'fin_finance_os_config', { reservaPct: 20, capitalTrabajoMin: 3000 })).reservaPct, 20);
  const t = ok(await emp(db, 'fin_tablero', {})); assert.equal(t.repartible.reservaPct, 20); assert.equal(t.repartible.capitalTrabajo, 3000);
  assert.equal((await emp(db, 'fin_retiro_registrar', { bancoId: 'bac', monto: 10, beneficiario: '', operationId: 'ret-000000002' })).ok, false);
});

test('Alertas: margen bajo, stock bajo, deuda vencida y cuenta madre sin ganancia', async () => {
  const db = await mesCompleto();
  const t = ok(await emp(db, 'fin_tablero', { mes: HOY.slice(0, 7) }));
  const txt = t.alertas.map((a) => a.texto).join(' | ');
  assert.doesNotMatch(txt, /margen de/, 'con estos precios ningún producto baja de 30%');
  // Provocamos las alertas: venta barata, stock bajo, deuda vencida.
  ok(await centro(db, 'registrar_operacion_pago', { tipoOrigen: 'renovacion', montoTotal: 75, recibido: 75, bancoId: 'bac', responsable: 'cliente', clienteNombre: 'Barato', plataforma: 'Netflix VIP', operationId: 'op-barato-0001' }));
  const stella = [...db.store.entries()].find(([k, v]) => k.startsWith('fin_lotes/') && v.productoId === 'STELLA')[0].split('/')[1];
  ok(await emp(db, 'fin_lote_ajustar', { loteId: stella, disponibleCorrecto: 1, motivo: 'Conteo físico', operationId: 'aju-000000001' }));
  ok(await emp(db, 'fin_compra_registrar', { operationId: 'compra-venc0001', compra: { productoId: 'GEMINI', proveedorId: 'deku-peru', cantidad: 10, costoTotal: 140, moneda: 'HNL', pago: 'credito', vencePago: '2026-10-05' } }));
  const t2 = ok(await emp(db, 'fin_tablero', { mes: HOY.slice(0, 7) }));
  const txt2 = t2.alertas.map((a) => a.texto).join(' | ');
  assert.match(txt2, /Netflix VIP: margen de \d/); assert.match(txt2, /Stella TV: quedan 1/); assert.match(txt2, /deuda\(s\) con proveedores vencida/);
  assert.equal(t2.alertas[0].nivel, 'alta');
  assert.ok(t2.conciliacion.todoCuadra, JSON.stringify(t2.conciliacion.filas.filter((f) => !f.ok)));
});

test('Fase 8: pausa general, respaldo descargable y Excel/tablero en la web', async () => {
  const db = await mesCompleto();
  const bk = ok(await emp(db, 'fin_respaldo'));
  assert.equal(bk.conteo.fin_productos, 21); assert.ok(bk.conteo.fin_lotes >= 5); assert.ok(bk.config.costeo.desde);
  ok(await emp(db, 'fin_finance_os_config', { activo: false }));
  const r = ok(await emp(db, 'fin_costear')); assert.equal(r.activo, false);
  const app = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(app, /\["tablero","Tablero"\]/); assert.match(app, /fin_retiro_registrar/); assert.match(app, /fin_respaldo/);
});

test('Revisión: retrasos no bloquean ventas nuevas; precio sin pisarse; lote vencido no se ajusta; venta movida de fecha lleva su costo', async () => {
  const { correrCosteo } = await import('../api/_finanzas-costeo.js');
  const db = await mesCompleto();
  // 5 ventas viejas de algo que no está en el catálogo + límite 3: las nuevas igual se costean.
  for (let i = 0; i < 5; i++) ok(await centro(db, 'registrar_operacion_pago', { tipoOrigen: 'renovacion', montoTotal: 90, recibido: 90, bancoId: 'bac', responsable: 'cliente', clienteNombre: `D${i}`, plataforma: 'Deezer', operationId: `op-deezer-000${i}` }));
  await correrCosteo(db, { ...costeoDeps(db), hoy: HOY, actor: 't', limite: 50 });
  ok(await centro(db, 'registrar_operacion_pago', { tipoOrigen: 'renovacion', montoTotal: 130, recibido: 130, bancoId: 'bac', responsable: 'cliente', clienteNombre: 'Nueva', plataforma: 'Stella', operationId: 'op-nueva-00001' }));
  const r = await correrCosteo(db, { ...costeoDeps(db), hoy: HOY, actor: 't', limite: 3 });
  assert.equal(r.costeadas, 1, 'la venta nueva se costea aunque haya 5 atascadas');
  // Venta movida de fecha: el costo se va con ella.
  const vid = [...db.store.keys()].find((k) => k.includes('op-nueva-00001') && k.endsWith('_venta')).split('/')[1];
  db.store.set(`finanzas_movimientos/${vid}`, { ...db.store.get(`finanzas_movimientos/${vid}`), fecha: '07/10/2026', fechaPago: '2026-10-07' });
  await correrCosteo(db, { ...costeoDeps(db), hoy: HOY, actor: 't' });
  assert.equal(db.store.get(`fin_consumos/${vid}`).fecha, '2026-10-07'); assert.equal(db.store.get(`finanzas_movimientos/${vid}_cv`).fechaPago, '2026-10-07');
  const t = ok(await emp(db, 'fin_tablero', { mes: HOY.slice(0, 7) })); assert.ok(t.conciliacion.todoCuadra, JSON.stringify(t.conciliacion.filas.filter((f) => !f.ok)));
  const vipVar = 'NFX-VIP__1-mes-1-persona';
  ok(await emp(db, 'fin_precio_nuevo', { varianteId: vipVar, precioHnl: 120, desde: '2026-10-08' }));
  assert.equal((await emp(db, 'fin_precio_nuevo', { varianteId: vipVar, precioHnl: 125, desde: '2026-10-08' })).ok, false, 'la segunda del mismo día no pisa a la primera');
  const lote = [...db.store.entries()].find(([k, v]) => k.startsWith('fin_lotes/') && v.productoId === 'NFX-PREM')[0].split('/')[1];
  db.store.set(`fin_lotes/${lote}`, { ...db.store.get(`fin_lotes/${lote}`), estado: 'vencido' });
  assert.equal((await emp(db, 'fin_lote_ajustar', { loteId: lote, disponibleCorrecto: 1, motivo: 'prueba', operationId: 'aju-vencido01' })).ok, false);
});
