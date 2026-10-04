import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepararPago, leerPago, escribirPago } from '../api/_finanzas-operacion.js';

function fakeDb() {
  const store = new Map();
  const ref = (c, id) => ({ id, _k: `${c}/${id}`, async get() { const d = store.get(`${c}/${id}`); return { exists: !!d, data: () => d }; } });
  let n = 0;
  const db = { store, collection: (c) => ({ doc: (id) => ref(c, id || `a${++n}`) }),
    // Transacción con ROLLBACK: las escrituras solo se aplican si la función termina sin error.
    async runTransaction(fn) { const buf = []; const tx = { get: (r) => r.get(), set: (r, d) => buf.push([r._k, d]) }; const out = await fn(tx); for (const [k, d] of buf) store.set(k, d); return out; } };
  return db;
}
const user = { uid: 'uRel', role: 'relojes', usuario: 'libni' };
const metodos = { metodos: [{ id: 'bac', nombre: 'BAC', logoKey: 'bac', activo: true }] };

test('pago válido: venta + ingreso + cuenta por cobrar en la MISMA transacción que la ficha; repetir no duplica', async () => {
  const db = fakeDb(); db.store.set('portal_cliente/configuracion', metodos);
  const pago = { montoTotal: 220, recibido: 100, bancoId: 'bac', responsable: 'cliente', operationId: 'op-juan-0001', origen: 'web' };
  const correr = async () => { const prep = await prepararPago(db, pago, user, 'renovacion'); return db.runTransaction(async (tx) => { const l = await leerPago(tx, db, prep); tx.set({ _k: 'clientes/juan' }, { fecha: '03/11/2026' }); return escribirPago(tx, db, prep, l, { clienteId: 'juan', clienteNombre: 'Juan', compraId: 'k1', plataforma: 'Netflix' }); }); };
  const r1 = await correr(); assert.equal(r1.estado, 'parcial'); assert.equal(r1.saldo, 120);
  const keys = [...db.store.keys()];
  assert.ok(keys.includes('finanzas_movimientos/oper_op_uRel_op-juan-0001_venta'));
  assert.ok(keys.includes('finanzas_movimientos/oper_op_uRel_op-juan-0001_cobro'));
  assert.ok(keys.includes('cuentas_por_cobrar/oper_op_uRel_op-juan-0001'));
  const r2 = await correr(); assert.equal(r2.duplicado, true, 'mismo operationId: no duplica');
});

test('si algo falla a la mitad, NO queda ni la fecha ni el pago', async () => {
  const db = fakeDb(); db.store.set('portal_cliente/configuracion', metodos);
  const prep = await prepararPago(db, { montoTotal: 220, recibido: 220, bancoId: 'bac', operationId: 'op-falla-0001' }, user, 'renovacion');
  await assert.rejects(db.runTransaction(async (tx) => { const l = await leerPago(tx, db, prep); tx.set({ _k: 'clientes/juan' }, { fecha: '03/11/2026' }); escribirPago(tx, db, prep, l, { clienteId: 'juan' }); throw new Error('falla simulada (red/servidor)'); }));
  assert.equal(db.store.has('clientes/juan'), false); assert.equal([...db.store.keys()].some((k) => k.startsWith('finanzas_movimientos/')), false);
});

test('validaciones: solo Sublicuentas/Relojes, total > 0, banco si recibió, vendedor si lo debe un vendedor', async () => {
  const db = fakeDb(); db.store.set('portal_cliente/configuracion', metodos);
  await assert.rejects(prepararPago(db, { montoTotal: 100, recibido: 0, operationId: 'op-xxxx-0001' }, { uid: 'v', role: 'vendedor', usuario: 'heber' }, 'compra'), /solo lo registran/);
  await assert.rejects(prepararPago(db, { montoTotal: 0, recibido: 0, operationId: 'op-xxxx-0002' }, user, 'compra'), /monto total/);
  await assert.rejects(prepararPago(db, { montoTotal: 100, recibido: 50, operationId: 'op-xxxx-0003' }, user, 'compra'), /banco/);
  await assert.rejects(prepararPago(db, { montoTotal: 100, recibido: 0, responsable: 'vendedor', operationId: 'op-xxxx-0004' }, user, 'compra'), /vendedor/);
  assert.equal(await prepararPago(db, null, user, 'compra'), null, 'sin pago: flujo normal sin cambios');
});

test('renovar.js usa el pago dentro de sus transacciones (renovar y ficha_upsert)', () => {
  const src = fs.readFileSync(new URL('../api/renovar.js', import.meta.url), 'utf8');
  assert.match(src, /const lecturaPagoFicha = await leerPago\(transaction, db, prepPagoFicha\);/);
  assert.match(src, /const pagoOperacion = escribirPago\(transaction, db, prepPagoFicha/);
  assert.match(src, /const lecturaPagoRenov = await leerPago\(transaction, db, prepPagoRenov\);/);
  assert.match(src, /escribirPago\(transaction, db, prepPagoRenov, lecturaPagoRenov/);
});
