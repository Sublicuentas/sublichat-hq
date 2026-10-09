import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { handleEmpresa, costearCompra, consumirPEPS, resumenInventario, aplicarRecarga, varianteIdDe } from '../api/_finanzas-empresa.js';
import { cycleTotals, bankBalances, movementKind } from '../api/_finanzas-libro.js';
import { libroDiario, balanzaComprobacion, estadosFinancieros } from '../api/_contabilidad.js';

function fakeDb() {
  const store = new Map(); let n = 0;
  const ref = (c, id) => ({ id, _k: `${c}/${id}`, async get() { const d = store.get(`${c}/${id}`); return { id, exists: !!d, data: () => d }; } });
  const docsDe = (c) => [...store.entries()].filter(([k]) => k.startsWith(`${c}/`)).map(([k, d]) => ({ id: k.slice(c.length + 1), data: () => d }));
  return { store,
    collection: (c) => ({ doc: (id) => ref(c, id || `auto${++n}`), get: async () => ({ docs: docsDe(c) }), where: (f, op, v) => ({ get: async () => ({ docs: docsDe(c).filter((x) => x.data()[f] === v) }) }) }),
    async runTransaction(fn) { const buf = []; const tx = { get: (r) => r.get(), set: (r, d, o) => buf.push([r._k, d, o]) }; const out = await fn(tx); for (const [k, d, o] of buf) store.set(k, o?.merge ? { ...(store.get(k) || {}), ...d } : d); return out; } };
}
const methods = [{ id: 'bac', nombre: 'BAC Credomatic' }, { id: 'ficohsa', nombre: 'Ficohsa' }];
const libro = { bases: { bac: { saldo: 20000, desde: '2026-10-01' } } };
const movs = (db) => [...db.store.entries()].filter(([k]) => k.startsWith('finanzas_movimientos/')).map(([k, d]) => ({ id: k.split('/')[1], ...d }));
const deps = (db) => ({ canUseLibro: () => true, hoyYmdHN: () => '2026-10-08', auditar: (tx, _d, i, ev) => tx.set(db.collection('auditoria_eventos').doc(), ev), loadMethods: async () => methods,
  libroOpDocId: (p, b, u) => (b.operationId ? `${p}_${u}_${b.operationId}` : ''), estadoLibro: async () => ({ saldos: bankBalances(movs(db), libro, methods) }),
  baseMov: () => ({ registradoPor: 'sublicuentas', createdAt: '2026-10-08T20:00:00Z' }), canonicalFinanceDate: (f) => { const [y, m, d] = f.split('-'); return { fecha: `${d}/${m}/${y}`, fechaPago: f }; } });
const llamar = async (db, accion, body = {}) => { let out; const res = { status: () => ({ json: (b) => { out = b; return b; } }) }; await handleEmpresa(db, accion, body, { usuario: 'sublicuentas', role: 'sublicuentas' }, { uid: 'u1' }, res, deps(db)); return out; };
async function base() { const db = fakeDb(); await llamar(db, 'fin_sembrar_catalogo'); await llamar(db, 'fin_binance_recargar', { bancoId: 'bac', hnl: 2820, usdt: 100, operationId: 'rec-0000001' }); return db; }

test('Prueba B: 25 Netflix VIP a 2.50 USDT → Binance −62.50 · inventario +25 · costo desde el costo contable USDT · sin egreso', async () => {
  const db = await base();
  const r = await llamar(db, 'fin_compra_registrar', { operationId: 'compra-0000001', compra: { productoId: 'NFX-VIP', proveedorId: 'trap-colombia', cantidad: 25, costoTotal: 62.5, moneda: 'USDT', pago: 'binance' } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.costoTotalHnl, 1762.5); assert.equal(r.costoUnitarioHnl, 70.5);
  assert.equal(db.store.get('fin_billeteras/binance').saldo, 37.5, 'Binance baja 62.50');
  const lote = db.store.get(`fin_lotes/${r.loteId}`); assert.equal(lote.disponible, 25); assert.equal(lote.costoUnitarioMoneda, 2.5); assert.equal(lote.proveedor, 'Trap Colombia');
  const m = movs(db); const t = cycleTotals(m, '2026-10-01', '');
  assert.equal(t.egresosOperativos, 0, 'no crea egreso operativo'); assert.equal(t.resultado, 0);
  const bz = balanzaComprobacion(libroDiario(m, {}, methods, '2026-10-01', '2026-10-31'));
  assert.ok(bz.cuadra); assert.equal(bz.cuentas.find((c) => c.cuenta === '1300').saldo, 1762.5); assert.equal(bz.cuentas.find((c) => c.cuenta === '1150-binance').saldo, 2820 - 1762.5);
  assert.equal((await llamar(db, 'fin_compra_registrar', { operationId: 'compra-0000001', compra: { productoId: 'NFX-VIP', cantidad: 25, costoTotal: 62.5, moneda: 'USDT', pago: 'binance' } })).duplicado, true);
  assert.equal(db.store.get('fin_billeteras/binance').saldo, 37.5, 'el reintento no cobra dos veces');
  const nueva = aplicarRecarga(db.store.get('fin_billeteras/binance'), { hnl: 2950, usdt: 100 });
  assert.equal(lote.costoTotalHnl, 1762.5, 'una recarga nueva no recalcula el lote'); assert.ok(nueva.estado.costoPromedio > 28.2);
});

test('Prueba C: Stella 15 créditos por 37.50 USDT; vender plan de 3 dispositivos consume exactamente 1 crédito', async () => {
  const db = await base();
  const r = await llamar(db, 'fin_compra_registrar', { operationId: 'compra-stella01', compra: { productoId: 'STELLA', cantidad: 15, costoTotal: 37.5, moneda: 'USDT', pago: 'binance' } });
  assert.equal(r.costoUnitarioHnl, 70.5); // 2.50 USDT × 28.20
  const variante = db.store.get(`fin_variantes/${varianteIdDe('STELLA', '1 mes · 3 dispositivos')}`);
  assert.equal(variante.consumo, 1); assert.equal(variante.dispositivos, 3);
  const lote = { id: r.loteId, ...db.store.get(`fin_lotes/${r.loteId}`) };
  const c = consumirPEPS([lote], variante.consumo, '2026-10-08');
  assert.equal(c.consumos[0].cantidad, 1, 'consume 1 crédito, no 3'); assert.equal(c.costoHnl, 70.5);
  assert.equal(200 - c.costoHnl, 129.5, 'utilidad bruta de la venta a L200');
});

test('PEPS: usa el lote más viejo, salta vencidos y avisa si falta', () => {
  const lotes = [{ id: 'b', fecha: '2026-10-05', disponible: 10, costoUnitarioHnl: 80 }, { id: 'a', fecha: '2026-10-01', disponible: 2, costoUnitarioHnl: 70 }, { id: 'v', fecha: '2026-09-01', disponible: 5, costoUnitarioHnl: 60, vigenciaHasta: '2026-10-01' }];
  const c = consumirPEPS(lotes, 3, '2026-10-08');
  assert.deepEqual(c.consumos.map((x) => [x.loteId, x.cantidad]), [['a', 2], ['b', 1]]); assert.equal(c.costoHnl, 220); assert.equal(c.faltante, 0);
  assert.equal(consumirPEPS(lotes, 20, '2026-10-08').faltante, 8);
});

test('Compra con banco en Lempiras baja el banco, no es gasto; USD exige cargo real; inventario inicial no toca bancos', async () => {
  const db = await base();
  const r = await llamar(db, 'fin_compra_registrar', { operationId: 'compra-lion0001', compra: { productoId: 'LION', cantidad: 100, costoTotal: 7500, moneda: 'HNL', pago: 'banco', bancoId: 'bac' } });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.costoUnitarioHnl, 75);
  const m = movs(db); assert.equal(movementKind(m.find((x) => x.tipo === 'compra')), 'compra');
  const bac = bankBalances(m, libro, methods).bancos.find((b) => b.id === 'bac');
  assert.equal(bac.saldo, 20000 - 2820 - 7500); assert.equal(bac.compras, 7500);
  assert.equal(cycleTotals(m, '2026-10-01', '').egresosOperativos, 0);
  const sinCargo = await llamar(db, 'fin_compra_registrar', { operationId: 'compra-prime001', compra: { productoId: 'PRIME', cantidad: 1, costoTotal: 12.9, moneda: 'USD', pago: 'banco', bancoId: 'bac' } });
  assert.equal(sinCargo.ok, false); assert.match(sinCargo.error, /cargo real/);
  const prime = await llamar(db, 'fin_compra_registrar', { operationId: 'compra-prime002', compra: { productoId: 'PRIME', cantidad: 5, costoTotal: 12.9, moneda: 'USD', pago: 'banco', bancoId: 'bac', cargoHnl: 340 } });
  assert.equal(prime.costoTotalHnl, 340); assert.equal(prime.costoUnitarioHnl, 68);
  const ini = await llamar(db, 'fin_compra_registrar', { operationId: 'compra-ini00001', compra: { productoId: 'OLEADA-1', cantidad: 12, costoTotal: 10.8, moneda: 'USDT', pago: 'inicial' } });
  assert.equal(ini.ok, true, JSON.stringify(ini)); assert.equal(ini.costoTotalHnl, 304.56); // 10.8 × costo promedio 28.20
  const bac2 = bankBalances(movs(db), libro, methods).bancos.find((b) => b.id === 'bac');
  assert.equal(bac2.saldo, 20000 - 2820 - 7500 - 340, 'inventario inicial no toca bancos');
  const ef = estadosFinancieros({ movimientos: movs(db), libro, methods, mes: '2026-10', hoy: '2026-10-08' });
  assert.ok(ef.balanza.cuadra); assert.ok(ef.flujo.cuadra); assert.equal(ef.flujo.compras, 7840);
  assert.equal(ef.balanza.cuentas.find((c) => c.cuenta === '1300').saldo, 7500 + 340 + 304.56);
  assert.equal(ef.resultados.utilidadNeta, 0, 'comprar no es gasto');
});

test('Ajuste de inventario (vencido) con motivo: baja el lote y queda como merma; el lote no se borra', async () => {
  const db = await base();
  const r = await llamar(db, 'fin_compra_registrar', { operationId: 'compra-gem00001', compra: { productoId: 'GEMINI', cantidad: 10, costoTotal: 14, moneda: 'USDT', pago: 'binance' } });
  assert.equal((await llamar(db, 'fin_lote_ajustar', { loteId: r.loteId, disponibleCorrecto: 8, motivo: '', operationId: 'aju-00000001' })).ok, false);
  const a = await llamar(db, 'fin_lote_ajustar', { loteId: r.loteId, disponibleCorrecto: 8, motivo: '2 links no funcionaron', operationId: 'aju-00000001' });
  assert.equal(a.ok, true, JSON.stringify(a)); assert.equal(a.delta, -2); assert.equal(a.montoHnl, 78.96);
  assert.equal(db.store.get(`fin_lotes/${r.loteId}`).disponible, 8);
  const bz = balanzaComprobacion(libroDiario(movs(db), {}, methods, '2026-10-01', '2026-10-31'));
  assert.ok(bz.cuadra); assert.equal(bz.cuentas.find((c) => c.cuenta === '5150').saldo, 78.96);
  const est = await llamar(db, 'fin_empresa_estado');
  const g = est.inventario.find((x) => x.productoId === 'GEMINI'); assert.equal(g.disponible, 8); assert.equal(g.valorHnl, 315.84);
});

test('Resumen de inventario: stock bajo y vencido sin usar', () => {
  const r = resumenInventario([{ id: 'S', nombre: 'Stella', modelo: 'creditos', unidad: 'crédito' }], [
    { id: 'l1', productoId: 'S', fecha: '2026-09-01', cantidad: 15, consumido: 13, disponible: 2, costoUnitarioHnl: 70, vigenciaHasta: '' },
    { id: 'l0', productoId: 'S', fecha: '2026-08-01', cantidad: 5, consumido: 2, disponible: 3, costoUnitarioHnl: 60, vigenciaHasta: '2026-09-30' }], '2026-10-08')[0];
  assert.equal(r.disponible, 2); assert.equal(r.stockBajo, true); assert.deepEqual(r.vencidoSinUsar, { cantidad: 3, valorHnl: 180 });
});

test('Costeo: Binance solo en USDT; costo cero permitido', () => {
  assert.throws(() => costearCompra({ producto: {}, cantidad: 1, costoTotal: 100, moneda: 'HNL', pago: { tipo: 'binance' } }), /USDT/);
  assert.equal(costearCompra({ producto: { modelo: 'costo_cero' }, cantidad: 4, costoTotal: 0, moneda: 'HNL', pago: { tipo: 'inicial' } }).costoTotalHnl, 0);
});

test('Web: pestañas Compras e Inventario y flujo con columna Compras', () => {
  const app = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(app, /\["compras","Compras"\],\["inventario","Inventario"\]/); assert.match(app, /fin_compra_registrar/); assert.match(app, /fin_lote_ajustar/);
  assert.match(app, /<th>Compras<\/th>/);
});

test('Vencimiento del lote: créditos no vencen solos; cuenta madre sí (duración del producto)', async () => {
  const db = await base();
  const a = await llamar(db, 'fin_compra_registrar', { operationId: 'compra-vig00001', compra: { productoId: 'STELLA', cantidad: 15, costoTotal: 37.5, moneda: 'USDT', pago: 'binance' } });
  assert.equal(db.store.get(`fin_lotes/${a.loteId}`).vigenciaHasta, '');
  const b = await llamar(db, 'fin_compra_registrar', { operationId: 'compra-vig00002', compra: { productoId: 'PARAMOUNT', cantidad: 4, costoTotal: 150, moneda: 'HNL', pago: 'banco', bancoId: 'bac' } });
  assert.equal(db.store.get(`fin_lotes/${b.loteId}`).vigenciaHasta, '2026-11-07');
});
