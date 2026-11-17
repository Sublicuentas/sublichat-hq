// R196z2 · Compras históricas pagadas en Binance (USDT): ya se pagaron fuera de Sublichat, así que NO exigen ni descuentan
// saldo de la billetera interna. Se guarda USDT, fecha de pago, fecha de activación, tasa y Lempiras UNA sola vez.
// Aplica a toda compra en USDT (HBO, Netflix gift card, VIP, créditos…) y a pagos de cuentas por pagar. Datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
import { handlePanel } from '../api/_finanzas-panel.js';
import { handleEmpresa, costearCompra } from '../api/_finanzas-empresa.js';
import { bankBalances } from '../api/_finanzas-libro.js';
import { libroDiario, balanzaComprobacion } from '../api/_contabilidad.js';
const require = createRequire(import.meta.url);
const hbo = require('../api/_hbo-planes.js');

const methods = [{ id: 'bac', nombre: 'BAC Credomatic', logoKey: 'bac', activo: true }, { id: 'binance', nombre: 'Binance', logoKey: 'binance', activo: true }];
const ident = { usuario: 'sublicuentas', role: 'sublicuentas', admin: true };
const semilla = () => ({
  inventario: { 'hbo-p': { plataforma: 'hbomax', correo: 'hbo.plat@prueba.test', capacidad: 5, planHbo: 'platinum', clientes: [{ nombre: 'A' }] }, 'hbo-s': { plataforma: 'hbomax', correo: 'hbo.std@prueba.test', capacidad: 3, planHbo: 'standard', clientes: [] }, 'nf-g': { plataforma: 'netflix', correo: 'nf.gift@prueba.test', capacidad: 5 } },
  clientes: { c1: { nombre: 'Cliente Prueba', servicios: [{ plataforma: 'hbomax', correo: 'hbo.plat@prueba.test' }] } },
  fin_productos: { 'HBO-PLAT': { nombre: 'HBO Platinum', categoria: 'perfiles', modelo: 'cuenta_madre', unidad: 'cuenta', plataformaKey: 'hbomax', capacidad: 5, duracionDias: 0, activo: true },
                   'NFX-PREM': { nombre: 'Netflix Premium propio', categoria: 'perfiles', modelo: 'cuenta_madre', unidad: 'cuenta', plataformaKey: 'netflix', capacidad: 7, duracionDias: 30, activo: true },
                   STELLA: { nombre: 'Stella TV', categoria: 'tv_digital', modelo: 'creditos', unidad: 'crédito', plataformaKey: 'stellatv', capacidad: 1, duracionDias: 30, activo: true } },
  fin_proveedores: { trap: { alias: 'Proveedor Prueba', activo: true } },
});
const res = () => { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
const deps = (db) => ({ hoyYmdHN: () => '2026-11-17', canUseLibro: () => true, loadMethods: async () => methods, libroOpDocId: (p, b, uid) => (b.operationId ? `${p}_op_${uid}_${b.operationId}` : ''),
  auditar: (tx, _db, i, ev) => tx.set(db.collection('auditoria_eventos').doc(), { actor: i.usuario, ...ev }),
  estadoLibro: async () => ({ saldos: bankBalances(movs(db), { bases: { bac: { saldo: 1000, desde: '2026-10-01' }, binance: { saldo: 0, desde: '2026-10-01' } } }, methods) }),
  baseMov: (i) => ({ registradoPor: i.usuario, origenCanal: 'web', createdAt: '2026-11-17T15:00:00Z' }),
  canonicalFinanceDate: (f) => { const [y, m, d] = f.split('-'); return { fecha: `${d}/${m}/${y}`, fechaPago: f, mesKey: `${y}-${m}` }; } });
const panel = async (db, a, b) => { const r = res(); await handlePanel(db, a, b, ident, { uid: 'u1' }, r, deps(db)); return r.body; };
const empresa = async (db, a, b) => { const r = res(); await handleEmpresa(db, a, b, ident, { uid: 'u1' }, r, deps(db)); return r.body; };
const col = (db, c) => [...db._data.entries()].filter(([k]) => k.startsWith(c + '/')).map(([k, v]) => ({ id: k.split('/')[1], ...v.data }));
function movs(db) { return col(db, 'finanzas_movimientos'); }
const intocable = (db) => JSON.stringify([...db._data.entries()].filter(([k]) => /^(inventario|clientes|ventas)\//.test(k)));
const actHbo = { productoId: 'HBO-PLAT', fecha: '2026-11-03', fechaActivacion: '2026-11-05', cantidad: 1, costoTotal: 3.5, moneda: 'USDT', pago: 'binance', binanceHistorico: true, tasa: 26.6, duracionDias: 0, cuentaInventarioId: 'hbo-p' };

test('diagnóstico: antes, toda compra en Binance exigía saldo en la billetera interna («tiene 0 USDT»)', () => {
  assert.throws(() => costearCompra({ producto: { modelo: 'cuenta_madre' }, cantidad: 1, costoTotal: 3.5, moneda: 'USDT', pago: { tipo: 'binance' } }), /Saldo insuficiente en Binance: tiene 0 USDT/);
  const k = costearCompra({ producto: { modelo: 'cuenta_madre' }, cantidad: 1, costoTotal: 3.5, moneda: 'USDT', pago: { tipo: 'binance', historico: true, tasa: 26.6 } });
  assert.deepEqual([k.costoTotalMoneda, k.tasa, k.costoTotalHnl, k.salidaBinance], [3.5, 26.6, 93.1, null]);
  assert.throws(() => costearCompra({ producto: {}, cantidad: 1, costoTotal: 3.5, moneda: 'USDT', pago: { tipo: 'binance', historico: true } }), /tasa HNL\/USDT/);
});

test('HBO · activación histórica 3.50 USDT con billetera en 0: se guarda una vez, con fechas separadas, sin tocar saldos', async () => {
  const db = fakeFirestore(semilla()); const antes = intocable(db);
  const bancosAntes = JSON.stringify((await deps(db).estadoLibro()).saldos.bancos.map((b) => [b.id, b.saldo]));
  const c = await empresa(db, 'fin_compra_registrar', { operationId: 'act-hist-0001', compra: actHbo });
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.deepEqual([c.costoTotalMoneda, c.moneda, c.tasa, c.costoTotalHnl, c.historico], [3.5, 'USDT', 26.6, 93.1, true]);
  const lote = col(db, 'fin_lotes')[0];
  assert.deepEqual([lote.fecha, lote.fechaPago, lote.fechaActivacion, lote.cuentaInventarioId, lote.cuentaPagoNombre, lote.binanceHistorico], ['2026-11-03', '2026-11-03', '2026-11-05', 'hbo-p', 'Binance · pago histórico', true]);
  assert.equal(col(db, 'fin_billeteras').length, 0, 'sin descuento ficticio de la billetera');
  assert.equal(JSON.stringify((await deps(db).estadoLibro()).saldos.bancos.map((b) => [b.id, b.saldo])), bancosAntes, 'ningún banco (ni «Binance») baja');
  // doble clic y reintento desde otra pantalla: no se duplica
  assert.equal((await empresa(db, 'fin_compra_registrar', { operationId: 'act-hist-0001', compra: actHbo })).duplicado, true);
  const otra = await empresa(db, 'fin_compra_registrar', { operationId: 'act-hist-0002', compra: actHbo });
  assert.equal(otra.ok, false); assert.match(otra.error, /ya está registrado/);
  assert.equal(col(db, 'fin_lotes').length, 1); assert.equal(movs(db).length, 1);
  // queda en la cuenta madre (Control Maestro sin cambios)
  const g = await panel(db, 'finp_hbo_guardar', { cuentaId: 'hbo-p', cargo: { fecha: '2026-11-03', fechaActivacion: '2026-11-05', moneda: 'USDT', monto: 3.5, cargoHnl: c.costoTotalHnl, tasa: c.tasa, loteId: c.loteId, operationId: c.loteId, activacion: true } });
  assert.equal(g.ok, true, JSON.stringify(g));
  const f = (await panel(db, 'finp_hbo_lista', {})).filas.find((x) => x.cuentaId === 'hbo-p');
  assert.deepEqual([f.cargos.length, f.cargos[0].fecha, f.cargos[0].fechaActivacion, f.cargos[0].tasa, f.cargos[0].cargoHnl], [1, '2026-11-03', '2026-11-05', 26.6, 93.1]);
  assert.equal(intocable(db), antes, 'Control Maestro y clientes intactos');
});

test('el gasto aparece UNA sola vez en Compras, Reportes y en el libro diario (cuadrado, sin banco)', async () => {
  const db = fakeFirestore(semilla());
  const c = await empresa(db, 'fin_compra_registrar', { operationId: 'act-hist-0003', compra: actHbo });
  assert.equal(c.ok, true);
  const rep = await panel(db, 'finp_reporte', { desde: '2026-11', hasta: '2026-11' });
  assert.equal(rep.ok, true, JSON.stringify(rep));
  const filas = rep.compras.filter((x) => x.producto === 'HBO Platinum');
  assert.equal(filas.length, 1); assert.deepEqual([filas[0].montoMoneda, filas[0].moneda, filas[0].tasa, filas[0].costoHnl], [3.5, 'USDT', 26.6, 93.1]);
  const cuentas = await panel(db, 'finp_cuentas_lista', { plataforma: 'hbomax' });
  const hp = cuentas.filas.find((x) => x.cuentaId === 'hbo-p');
  assert.deepEqual([hp.estadoCosto, hp.compras, hp.costo.costoHnl], ['con_costo', 1, 93.1]);
  const diario = libroDiario(movs(db), {}, methods);
  assert.equal(diario.length, 1);
  assert.deepEqual(diario[0].lineas.map((l) => [l.cuenta, l.debe, l.haber]), [['1300', 93.1, 0], ['3100', 0, 93.1]]);
  assert.ok(balanzaComprobacion(diario));
  const debe = diario[0].lineas.reduce((a, l) => a + l.debe, 0), haber = diario[0].lineas.reduce((a, l) => a + l.haber, 0);
  assert.equal(debe, haber);
});

test('misma corrección para TODA compra en USDT (Netflix gift card, créditos) y para pagar cuentas por pagar', async () => {
  const db = fakeFirestore(semilla());
  const g = await empresa(db, 'fin_compra_registrar', { operationId: 'nf-gift-0001', compra: { productoId: 'NFX-PREM', fecha: '2026-11-10', cantidad: 1, costoTotal: 25, moneda: 'USDT', pago: 'binance', binanceHistorico: true, tasa: 26.5, cuentaInventarioId: 'nf-g' } });
  assert.equal(g.ok, true, JSON.stringify(g)); assert.equal(g.costoTotalHnl, 662.5);
  const s = await empresa(db, 'fin_compra_registrar', { operationId: 'stella-0001', compra: { productoId: 'STELLA', fecha: '2026-11-11', cantidad: 15, costoTotal: 37.5, moneda: 'USDT', pago: 'binance', binanceHistorico: true, tasa: 26.4 } });
  assert.equal(s.ok, true, JSON.stringify(s)); assert.equal(s.costoTotalHnl, 990);
  // sin la marca de histórico, la billetera interna sigue mandando (no se cambia esa regla)
  const sinMarca = await empresa(db, 'fin_compra_registrar', { operationId: 'stella-0002', compra: { productoId: 'STELLA', fecha: '2026-11-11', cantidad: 5, costoTotal: 12.5, moneda: 'USDT', pago: 'binance' } });
  assert.match(sinMarca.error, /Saldo insuficiente en Binance/);
  // cuenta por pagar en USDT pagada antes en Binance
  const cr = await empresa(db, 'fin_compra_registrar', { operationId: 'cred-0001', compra: { productoId: 'STELLA', proveedorId: 'trap', fecha: '2026-11-12', cantidad: 10, costoTotal: 25, moneda: 'USDT', pago: 'credito', tasa: 26.5, cargoHnl: 662.5 } });
  assert.equal(cr.ok, true, JSON.stringify(cr));
  const cxp = col(db, 'fin_cxp')[0];
  const p = await empresa(db, 'fin_cxp_pagar', { cxpId: cxp.id, monto: 25, pago: 'binance', historico: true, tasa: 26.5, fecha: '2026-11-13', operationId: 'pagocxp-0001' });
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.equal(col(db, 'fin_cxp')[0].estado, 'pagado');
  assert.equal(col(db, 'fin_billeteras').length, 0, 'ninguna billetera tocada');
  const dup = await empresa(db, 'fin_cxp_pagar', { cxpId: cxp.id, monto: 25, pago: 'binance', historico: true, tasa: 26.5, fecha: '2026-11-13', operationId: 'pagocxp-0001' });
  assert.equal(dup.duplicado, true);
  const diario = libroDiario(movs(db), {}, methods);
  for (const a of diario) assert.equal(a.lineas.reduce((x, l) => x + l.debe - l.haber, 0).toFixed(2), '0.00', a.descripcion);
  assert.equal(diario.some((a) => a.lineas.some((l) => /1150/.test(l.cuenta))), false, 'sin movimientos de la billetera Binance');
});

test('HBO Platinum = 5 perfiles y Standard = 3 (configuración aprobada)', () => {
  assert.equal(hbo.PLANES.platinum.capacidad, 5); assert.equal(hbo.PLANES.standard.capacidad, 3);
  assert.equal(hbo.resumenCuenta({ plataforma: 'hbomax', planHbo: 'platinum', capacidad: 5 }).capacidad, 5);
  assert.equal(hbo.resumenCuenta({ plataforma: 'hbomax', planHbo: 'standard', capacidad: 3 }).capacidad, 3);
});

test('pantallas: opción «Binance · ya pagado (histórico)» con tasa, equivalente en Lempiras y fecha de activación', () => {
  const w = fs.readFileSync(new URL('../finanzas-web.js', import.meta.url), 'utf8');
  assert.match(w, /binance_hist', 'Binance USDT · ya pagado \(histórico\)'/); assert.match(w, /name="tasa"/); assert.match(w, /data-equiv/); assert.match(w, /name="fechaActivacion"/);
  assert.match(w, /pago: 'binance_hist', moneda: 'USDT', frecuencia: 'puntual'/, 'HBO abre en histórico por defecto');
  const a = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(a, /binanceHistorico:hist/); assert.match(a, /historico:hist,tasa:hist/);
});
