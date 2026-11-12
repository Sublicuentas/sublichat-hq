// R196n · PDF «Correcciones puntuales» Fase 2: HBO Max con tarjeta bancaria hondureña + activación USDT (H-01 a H-03).
// Firestore en memoria; cuentas, tarjetas y montos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
import { handlePanel } from '../api/_finanzas-panel.js';
import { handleEmpresa } from '../api/_finanzas-empresa.js';
import { bankBalances } from '../api/_finanzas-libro.js';

const methods = [{ id: 'bac', nombre: 'BAC Credomatic', logoKey: 'bac', activo: true }];
const ident = { usuario: 'sublicuentas', role: 'sublicuentas', admin: true };
const semilla = () => ({
  inventario: { 'hbo-1': { plataforma: 'hbomax', correo: 'hbo.tarjeta@ejemplo.test', capacidad: 4 }, 'hbo-2': { plataforma: 'hbomax', correo: 'hbo.binance@ejemplo.test', capacidad: 4 }, 'nf-1': { plataforma: 'netflix', correo: 'nf@ejemplo.test' } },
  fin_productos: { 'HBO-PLAT': { nombre: 'HBO Platinum', categoria: 'perfiles', modelo: 'cuenta_madre', unidad: 'cuenta', plataformaKey: 'hbomax', capacidad: 4, duracionDias: 365, activo: true },
                   'HBO-LINK': { nombre: 'HBO links', categoria: 'perfiles', modelo: 'link', unidad: 'link', plataformaKey: 'hbomax', capacidad: 1, duracionDias: 0, activo: true } },
});
const res = () => { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
const deps = (db) => ({ hoyYmdHN: () => '2026-11-12', canUseLibro: () => true, loadMethods: async () => methods, libroOpDocId: (p, b, uid) => (b.operationId ? `${p}_op_${uid}_${b.operationId}` : ''),
  auditar: (tx, _db, i, ev) => tx.set(db.collection('auditoria_eventos').doc(), { actor: i.usuario, ...ev }),
  estadoLibro: async () => ({ saldos: bankBalances([...db._data.entries()].filter(([k]) => k.startsWith('finanzas_movimientos/')).map(([k, v]) => ({ id: k, ...v.data })), { bases: { bac: { saldo: 50000, desde: '2026-10-01' } } }, methods) }),
  baseMov: (i) => ({ registradoPor: i.usuario, origenCanal: 'web', createdAt: '2026-11-12T20:00:00Z' }),
  canonicalFinanceDate: (f) => { const [y, m, d] = f.split('-'); return { fecha: `${d}/${m}/${y}`, fechaPago: f, mesKey: `${y}-${m}` }; } });
const panel = async (db, accion, body) => { const r = res(); await handlePanel(db, accion, body, ident, { uid: 'u1' }, r, deps(db)); return r.body; };
const empresa = async (db, accion, body) => { const r = res(); await handleEmpresa(db, accion, body, ident, { uid: 'u1' }, r, deps(db)); return r.body; };
const lotes = (db) => [...db._data.entries()].filter(([k]) => k.startsWith('fin_lotes/')).map(([k, v]) => ({ id: k.split('/')[1], ...v.data }));
// Mismo orden que la pantalla: comprobar repetido → UNA compra real → anotar el cargo en la cuenta.
async function cargoTarjeta(db, cuentaId, cargo, prox = '') {
  const v = await panel(db, 'finp_hbo_guardar', { cuentaId, cargo }); if (!v.ok) return v;
  const c = await empresa(db, 'fin_compra_registrar', { operationId: cargo.operationId, compra: { productoId: 'HBO-PLAT', fecha: cargo.fecha, cantidad: 1, costoTotal: cargo.monto, moneda: cargo.moneda, cargoHnl: cargo.moneda === 'HNL' ? 0 : cargo.cargoHnl, pago: 'banco', bancoId: 'bac', duracionDias: 30, cuentaInventarioId: cuentaId } });
  if (!c.ok) return c;
  return panel(db, 'finp_hbo_guardar', { cuentaId, cargo: { ...cargo, loteId: c.loteId }, proximoCobro: prox });
}

test('H-01 · HBO pagado con tarjeta de banco hondureño: banco, titular, últimos 4, monto real, fecha; costo correcto', async () => {
  const db = fakeFirestore(semilla());
  let r = await panel(db, 'finp_hbo_guardar', { cuentaId: 'hbo-1', modalidad: 'tarjeta', tarjetaNueva: { banco: 'BAC', titular: 'Titular Prueba', ultimos4: '4321' }, periodicidad: 'mensual', proximoCobro: '2026-12-12' });
  assert.equal(r.ok, true, JSON.stringify(r));
  r = await cargoTarjeta(db, 'hbo-1', { fecha: '2026-11-12', moneda: 'USD', monto: 16.99, cargoHnl: 449.2, operationId: 'hbo-cargo-0001' }, '2026-12-12');
  assert.equal(r.ok, true, JSON.stringify(r));
  const l = lotes(db); assert.equal(l.length, 1);
  assert.deepEqual([l[0].moneda, l[0].costoTotalMoneda, l[0].costoTotalHnl, l[0].cuentaInventarioId, l[0].pago], ['USD', 16.99, 449.2, 'hbo-1', 'banco']);
  const lista = await panel(db, 'finp_hbo_lista', {});
  const f = lista.filas.find((x) => x.cuentaId === 'hbo-1');
  assert.deepEqual([f.modalidad, f.tarjeta.banco, f.tarjeta.titular, f.tarjeta.ultimos4, f.periodicidad, f.proximoCobro], ['tarjeta', 'BAC', 'Titular Prueba', '4321', 'mensual', '2026-12-12']);
  assert.deepEqual([f.cargos[0].cargoHnl, f.cargos[0].fecha, f.cargos[0].loteId], [449.2, '2026-11-12', l[0].id]);
  assert.equal(lista.filas.some((x) => x.cuentaId === 'nf-1'), false, 'solo cuentas HBO Max de Control Maestro');
  // Nunca el número completo; la misma tarjeta puede pagar otra cuenta sin duplicarse
  const mal = await panel(db, 'finp_hbo_guardar', { cuentaId: 'hbo-2', modalidad: 'tarjeta', tarjetaNueva: { banco: 'BAC', titular: 'Titular Prueba', ultimos4: '4111111111114321' } });
  assert.match(mal.error, /SOLO los últimos 4/);
  assert.equal(JSON.stringify([...db._data.values()]).includes('4111111111114321'), false, 'no se guardó el número completo');
});

test('H-01 · el mismo cargo no se suma dos veces (doble clic o desde otra pantalla)', async () => {
  const db = fakeFirestore(semilla());
  await panel(db, 'finp_hbo_guardar', { cuentaId: 'hbo-1', modalidad: 'tarjeta', tarjetaNueva: { banco: 'Ficohsa', titular: 'Titular Prueba', ultimos4: '9876' } });
  const cargo = { fecha: '2026-11-10', moneda: 'HNL', monto: 420, cargoHnl: 420, operationId: 'hbo-cargo-0002' };
  await cargoTarjeta(db, 'hbo-1', cargo);
  const rep = await cargoTarjeta(db, 'hbo-1', cargo); // mismo operationId
  assert.equal(rep.ok, true); assert.equal(lotes(db).length, 1);
  const otro = await cargoTarjeta(db, 'hbo-1', { ...cargo, operationId: 'hbo-cargo-0003' }); // mismo cargo, otra operación
  assert.match(otro.error, /ya está registrado/); assert.equal(lotes(db).length, 1, 'una sola compra');
});

test('H-02 · HBO por activación USDT: sigue el modelo de siempre (sin tarjeta ni mensualidad forzada)', async () => {
  const db = fakeFirestore(semilla());
  const lista = await panel(db, 'finp_hbo_lista', {});
  const f = lista.filas.find((x) => x.cuentaId === 'hbo-2');
  assert.deepEqual([f.modalidad, f.tarjeta, f.periodicidad], ['activacion', null, '']);
  await empresa(db, 'fin_binance_recargar', { bancoId: 'bac', hnl: 2650, usdt: 100, fecha: '2026-11-12', operationId: 'op-recarga-hbo1' });
  const c = await empresa(db, 'fin_compra_registrar', { operationId: 'hbo-act-0001', compra: { productoId: 'HBO-LINK', fecha: '2026-11-12', cantidad: 1, costoTotal: 3.5, moneda: 'USDT', pago: 'binance', cuentaInventarioId: 'hbo-2' } });
  assert.equal(c.ok, true, JSON.stringify(c));
  const l = lotes(db).find((x) => x.id === c.loteId);
  assert.deepEqual([l.moneda, l.costoTotalMoneda, l.tasa, l.costoTotalHnl, l.vigenciaHasta], ['USDT', 3.5, 26.5, 92.75, ''], 'costo real por activación, tasa efectiva de Binance, sin vencimiento mensual');
  const g = await panel(db, 'finp_hbo_guardar', { cuentaId: 'hbo-2', modalidad: 'tarjeta' });
  assert.match(g.error, /tarjeta/, 'no se puede pasar a tarjeta sin tarjeta');
});

test('H-03 · histórico: editar la tarjeta o el próximo importe no cambia los costos ya registrados', async () => {
  const db = fakeFirestore(semilla());
  await panel(db, 'finp_hbo_guardar', { cuentaId: 'hbo-1', modalidad: 'tarjeta', tarjetaNueva: { banco: 'BAC', titular: 'Titular Prueba', ultimos4: '4321' } });
  await cargoTarjeta(db, 'hbo-1', { fecha: '2026-10-12', moneda: 'USD', monto: 16.99, cargoHnl: 440.1, operationId: 'hbo-cargo-0101' });
  const antes = JSON.stringify(lotes(db));
  await panel(db, 'finp_hbo_guardar', { cuentaId: 'hbo-1', modalidad: 'tarjeta', tarjetaNueva: { banco: 'Banpaís', titular: 'Otra Titular', ultimos4: '1111' }, periodicidad: 'puntual' });
  await cargoTarjeta(db, 'hbo-1', { fecha: '2026-11-12', moneda: 'USD', monto: 18.99, cargoHnl: 503.4, operationId: 'hbo-cargo-0102' });
  const l = lotes(db);
  assert.equal(JSON.stringify(l.filter((x) => x.fecha === '2026-10-12')), antes, 'octubre intacto');
  assert.deepEqual(l.map((x) => x.costoTotalHnl).sort(), [440.1, 503.4]);
  const f = (await panel(db, 'finp_hbo_lista', {})).filas.find((x) => x.cuentaId === 'hbo-1');
  assert.deepEqual(f.cargos.map((c) => [c.fecha, c.tarjetaId.includes('1111') || c.tarjetaId.includes('4321') ? 'ok' : 'x']), [['2026-11-12', 'ok'], ['2026-10-12', 'ok']]);
  const web = fs.readFileSync(new URL('../finanzas-web.js', import.meta.url), 'utf8');
  assert.match(web, /\['hbo', 'HBO Max'\]/); assert.match(web, /Nunca escriba el número completo, el CVV ni claves/);
});
