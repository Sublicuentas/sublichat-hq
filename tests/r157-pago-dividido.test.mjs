// Oct-2026 · Pago dividido (renovación/compra web y APK): un ingreso por banco en la MISMA transacción.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
import { repartoPagos } from '../api/_finanzas-libro.js';
import { prepararPago, leerPago, escribirPago } from '../api/_finanzas-operacion.js';

const metodos = [{ id: 'bac', nombre: 'BAC', activo: true }, { id: 'tigo', nombre: 'Tigo Money', activo: true }, { id: 'viejo', nombre: 'Viejo', activo: false }];
const user = { usuario: 'sublicuentas', role: 'sublicuentas', uid: 'u1' };

test('repartoPagos: valida suma, bancos activos, sin repetir, máx. 4', () => {
  assert.equal(repartoPagos([{ bancoId: 'bac', monto: 100 }, { bancoId: 'viejo', monto: 120 }], 220, metodos).ok, false, 'método inactivo');
  assert.equal(repartoPagos(Array.from({ length: 5 }, (_, i) => ({ bancoId: 'bac' + i, monto: 1 })), 5, metodos).ok, false);
  assert.deepEqual(repartoPagos([{ bancoId: 'bac', monto: 120.5 }, { bancoId: 'tigo', monto: 99.5 }], 220, metodos).pagos.map((p) => p.monto), [120.5, 99.5]);
});

test('Renovar con BAC L120 + Tigo L100: venta L220, dos ingresos (cada banco lo suyo), auditoría con ambos', async () => {
  const db = fakeFirestore({ portal_cliente: { configuracion: { metodos } }, finanzas_config: { libro_mayor: { cicloId: 'ciclo_2026-10-01' } } });
  const prep = await prepararPago(db, { montoTotal: 220, recibido: 220, bancoId: 'bac', pagos: [{ bancoId: 'bac', monto: 120 }, { bancoId: 'tigo', monto: 100 }], operationId: 'op-dividido-0001', origen: 'web' }, user, 'renovacion');
  await db.runTransaction(async (tx) => { const l = await leerPago(tx, db, prep); escribirPago(tx, db, prep, l, { clienteId: 'c1', clienteNombre: 'Ana', compraId: 'k1', plataforma: 'netflix' }); });
  const movs = [...db._data.entries()].filter(([p]) => p.startsWith('finanzas_movimientos/')).map(([p, r]) => [p.split('/')[1], r.data]);
  const ing = movs.filter(([, m]) => m.tipo === 'ingreso').sort();
  assert.equal(ing.length, 2);
  assert.match(ing[0][0], /_cobro$/); assert.match(ing[1][0], /_cobro_2$/);
  assert.deepEqual(ing.map(([, m]) => [m.bancoId, m.monto]), [['bac', 120], ['tigo', 100]]);
  const venta = movs.find(([, m]) => m.tipo === 'venta')[1];
  assert.equal(venta.monto, 220); assert.equal(venta.pagoDividido, true); assert.equal(venta.pagosDetalle.length, 2);
  const aud = [...db._data.entries()].find(([p, r]) => p.startsWith('auditoria_eventos/') && r.data.accion === 'renovacion_pago')[1].data;
  assert.match(aud.detalle, /BAC 120 \+ Tigo Money 100/);
});

test('Errores claros: no cuadra o banco repetido → no se guarda nada', async () => {
  const db = fakeFirestore({ portal_cliente: { configuracion: { metodos } } });
  await assert.rejects(prepararPago(db, { montoTotal: 220, recibido: 220, pagos: [{ bancoId: 'bac', monto: 120 }, { bancoId: 'tigo', monto: 90 }], operationId: 'op-dividido-0002' }, user, 'renovacion'), /deben coincidir/);
  await assert.rejects(prepararPago(db, { montoTotal: 220, recibido: 220, pagos: [{ bancoId: 'bac', monto: 120 }, { bancoId: 'bac', monto: 100 }], operationId: 'op-dividido-0003' }, user, 'renovacion'), /repetido/);
});

test('Web: hoja de pago con “Pagó en 2 bancos” y /api/finanzas acepta pagos[]', () => {
  const web = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(web, /＋ Pagó en 2 bancos o métodos/); assert.match(web, /function pagoOpValidarPartes/); assert.match(web, /\.\.\.\(pp&&pp\.length>1\?\{pagos:pp\}:\{\}\)/);
  const api = fs.readFileSync(new URL('../api/finanzas.js', import.meta.url), 'utf8');
  assert.match(api, /repartoPagos\(body\.pagos, ep\.recibido, methods, cleanText\(body\.bancoId\)\)/); assert.match(api, /_cobro_\$\{i \+ 1\}/);
});
