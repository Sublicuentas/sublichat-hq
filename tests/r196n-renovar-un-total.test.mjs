// R196n · PDF «Correcciones puntuales» Fase 1 (servidor): UN pago por operación; desglose por precio REGISTRADO;
// descuento/cortesía como ajuste proporcional con motivo; renovación parcial. Firestore en memoria, datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeFirestore } from './helpers/fake-firestore.mjs';

const user = { uid: 'uSub', role: 'sublicuentas', usuario: 'sublicuentas' };
const semilla = () => ({
  portal_cliente: { configuracion: { metodos: [{ id: 'bac', nombre: 'BAC', logoKey: 'bac', activo: true }] } },
  finanzas_config: { libro_mayor: { cicloId: 'ciclo_2026-11-01', cicloInicio: '2026-11-01' } },
  clientes: {
    ana: { nombre: 'Ana Prueba', servicios: [
      { compraId: 'c-nfx', plataforma: 'Netflix VIP', correo: 'a@x.test', fechaRenovacion: '20/11/2026', precio: 150, mesesContratados: 1 },
      { compraId: 'c-dsn', plataforma: 'Disney+ Premium', correo: 'b@x.test', fechaRenovacion: '22/11/2026', precio: 100, mesesContratados: 1 } ] },
    beto: { nombre: 'Beto Prueba', servicios: [
      { compraId: 'b-nfx', plataforma: 'Netflix VIP', correo: 'c@x.test', fechaRenovacion: '20/11/2026', precio: 140, mesesContratados: 1 },
      { compraId: 'b-dsn', plataforma: 'Disney+ Premium', correo: 'd@x.test', fechaRenovacion: '22/11/2026', precio: 90, mesesContratados: 1 } ] },
  },
});
const res = () => { const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
const mes = { unidad: 'meses', cantidad: 1 };
const L = (id, plat, monto) => ({ compraId: id, plataforma: plat, duracion: mes, monto, montoEsperado: monto });
const movs = (db) => [...db._data.entries()].filter(([k]) => k.startsWith('finanzas_movimientos/')).map(([k, v]) => ({ id: k.split('/')[1], ...v.data }));
const cxc = (db) => [...db._data.keys()].filter((k) => k.startsWith('cuentas_por_cobrar/'));
const pago = (op, total, recibido = total, extra = {}) => ({ montoTotal: total, recibido, bancoId: 'bac', operationId: op, origen: 'apk', ...extra });
const { __r186 } = await import('../api/renovar.js');
const lote = async (db, cliente, lineas, p, extra = {}) => { const r = res(); await __r186.renovarLote(db, user, { accion: 'renovar_lote', clienteId: cliente, lineas, pago: p, origen: 'apk', confirmarAtraso: true, operationId: p?.operationId, ...extra }, r); return r.body; };

test('vista previa devuelve el precio REGISTRADO de cada servicio (no el de lista)', async () => {
  const db = fakeFirestore(semilla()); const r = res();
  await __r186.renovarLote(db, user, { accion: 'renovar_lote', soloVista: true, clienteId: 'beto', lineas: [L('b-nfx', 'Netflix VIP', 0), L('b-dsn', 'Disney+ Premium', 0)] }, r);
  assert.deepEqual(r.body.lineas.map((x) => x.precioRegistrado), [140, 90]);
  const r3 = res(); // 3 meses sobre un precio de 1 mes: no se inventa → null (el operador lo escribe)
  await __r186.renovarLote(db, user, { accion: 'renovar_lote', soloVista: true, clienteId: 'beto', lineas: [{ ...L('b-nfx', 'Netflix VIP', 0), duracion: { unidad: 'meses', cantidad: 3 } }] }, r3);
  assert.equal(r3.body.lineas[0].precioRegistrado, null);
});

test('R-01 · Netflix VIP L150 + Disney L100 cobrados con L250: 1 venta + 1 cobro; desglose interno 150/100', async () => {
  const db = fakeFirestore(semilla());
  const b = await lote(db, 'ana', [L('c-nfx', 'Netflix VIP', 150), L('c-dsn', 'Disney+ Premium', 100)], pago('op-r01-00001', 250));
  assert.equal(b.ok, true, JSON.stringify(b));
  const m = movs(db), venta = m.filter((x) => x.tipo === 'venta'), cobro = m.filter((x) => x.tipo === 'ingreso');
  assert.deepEqual([venta.length, cobro.length, venta[0].monto, cobro[0].monto], [1, 1, 250, 250]);
  assert.deepEqual(venta[0].asignaciones.map((a) => [a.plataforma, a.monto]), [['Netflix VIP', 150], ['Disney+ Premium', 100]]);
  // reintento con el MISMO operationId → no duplica
  const b2 = await lote(db, 'ana', [L('c-nfx', 'Netflix VIP', 150), L('c-dsn', 'Disney+ Premium', 100)], pago('op-r01-00001', 250));
  assert.equal(b2.duplicado, true); assert.equal(movs(db).filter((x) => x.tipo === 'venta').length, 1);
});

test('R-02 · precios propios del cliente y renovación PARCIAL: solo Netflix; Disney ni cambia de fecha ni recibe pago', async () => {
  const db = fakeFirestore(semilla());
  const b = await lote(db, 'beto', [L('b-nfx', 'Netflix VIP', 140)], pago('op-r02-00001', 140));
  assert.equal(b.ok, true, JSON.stringify(b));
  const s = db._data.get('clientes/beto').data.servicios;
  assert.deepEqual(s.map((x) => x.fechaRenovacion), ['20/12/2026', '22/11/2026']);
  const v = movs(db).find((x) => x.tipo === 'venta');
  assert.deepEqual(v.asignaciones.map((a) => [a.compraId, a.monto]), [['b-nfx', 140]]);
});

test('R-03 · descuento: esperado L250, cobrado L220 → ingreso L220, ajuste L30 con motivo, reparto proporcional 132/88, sin pendiente', async () => {
  const db = fakeFirestore(semilla());
  const b = await lote(db, 'ana', [L('c-nfx', 'Netflix VIP', 150), L('c-dsn', 'Disney+ Premium', 100)], pago('op-r03-00001', 250, 220, { ajuste: { tipo: 'descuento', motivo: 'Cliente frecuente' } }));
  assert.equal(b.ok, true, JSON.stringify(b));
  const m = movs(db), v = m.find((x) => x.tipo === 'venta'), c = m.filter((x) => x.tipo === 'ingreso');
  assert.deepEqual([v.monto, v.montoEsperado, v.descuento, v.saldoPendiente], [220, 250, 30, 0]);
  assert.deepEqual(v.ajusteCobro, { tipo: 'descuento', motivo: 'Cliente frecuente', montoEsperado: 250, monto: 30, regla: 'proporcional_precio_registrado' });
  assert.deepEqual(v.asignaciones.map((a) => [a.monto, a.montoEsperado, a.descuento]), [[132, 150, 18], [88, 100, 12]]);
  assert.deepEqual([c.length, c[0].monto], [1, 220]);
  assert.equal(cxc(db).length, 0, 'un descuento no es una cuenta por cobrar');
  // el cliente intenta mandar otros montos: manda el precio registrado (el servidor recalcula)
  const db2 = fakeFirestore(semilla());
  await lote(db2, 'ana', [L('c-nfx', 'Netflix VIP', 1), L('c-dsn', 'Disney+ Premium', 249)], pago('op-r03-00002', 250, 220, { ajuste: { tipo: 'cortesia', motivo: '' } }));
  assert.deepEqual(movs(db2).find((x) => x.tipo === 'venta').asignaciones.map((a) => a.monto), [132, 88]);
});

test('R-03 · cortesía completa: con L0 no hay venta (se usa «Ajuste sin pago»); «otro ajuste» exige motivo; cobrar de más se rechaza', async () => {
  const db = fakeFirestore(semilla());
  const l2 = [L('c-nfx', 'Netflix VIP', 150), L('c-dsn', 'Disney+ Premium', 100)];
  assert.match((await lote(db, 'ana', l2, pago('op-r03-00003', 250, 0, { ajuste: { tipo: 'cortesia' } }))).error, /Ajuste sin pago/);
  assert.match((await lote(db, 'ana', l2, pago('op-r03-00004', 250, 200, { ajuste: { tipo: 'otro', motivo: '' } }))).error, /motivo/);
  assert.match((await lote(db, 'ana', l2, pago('op-r03-00005', 250, 260, { ajuste: { tipo: 'descuento' } }))).error, /MENOS/);
  assert.equal(movs(db).length, 0, 'nada escrito');
  const r = res();
  await __r186.renovarLote(db, user, { accion: 'renovar_lote', clienteId: 'ana', lineas: l2, ajusteAdministrativo: true, motivoAjuste: 'Cortesía por falla', origen: 'apk', confirmarAtraso: true, operationId: 'op-r03-00006' }, r);
  assert.equal(r.body.ok, true); assert.equal(movs(db).filter((x) => x.tipo === 'venta').length, 0, 'la cortesía no es venta pagada');
});
