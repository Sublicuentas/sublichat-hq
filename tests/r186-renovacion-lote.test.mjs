// R186 · Motor único de fechas + renovación de varios servicios con UN pago (datos ficticios, Firestore en memoria).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sumarPeriodo, sigueVencida, aCentavos } from '../api/_renovacion-motor.js';
import { fakeFirestore } from './helpers/fake-firestore.mjs';

const vectores = JSON.parse(fs.readFileSync(new URL('../api/_renovacion-vectores.json', import.meta.url), 'utf8'));

test('motor: todos los vectores compartidos con el bot (R01–R03, fin de mes, ancla, bisiesto)', () => {
  for (const c of vectores.casos) {
    const r = sumarPeriodo(c.fecha, c.periodo);
    assert.equal(r.fechaNueva, c.esperado, c.id);
    if (c.regla) assert.equal(r.regla, c.regla, `${c.id} regla`);
    if (c.diaAncla) assert.equal(r.diaAncla, c.diaAncla, `${c.id} ancla`);
  }
});

test('motor: entradas inválidas y centavos exactos', () => {
  assert.throws(() => sumarPeriodo('31/02/2026', { unidad: 'meses', cantidad: 3 }), /inválida/);
  assert.throws(() => sumarPeriodo('04/11/2026', { unidad: 'meses', cantidad: 0 }), /1 a 24/);
  assert.throws(() => sumarPeriodo('04/11/2026', { unidad: 'dias', cantidad: 999 }), /1 a 730/);
  assert.equal(aCentavos('150.10') + aCentavos('110.20') + aCentavos('89.70'), 35000);
  assert.equal(aCentavos(0.1) + aCentavos(0.2), aCentavos(0.3));
  assert.equal(sigueVencida('01/10/2026', '07/11/2026'), true); assert.equal(sigueVencida('04/02/2027', '07/11/2026'), false);
});

const user = { uid: 'uRel', role: 'relojes', usuario: 'libni' };
function semilla() {
  return {
    portal_cliente: { configuracion: { metodos: [{ id: 'bac', nombre: 'BAC', logoKey: 'bac', activo: true }] } },
    finanzas_config: { libro_mayor: { cicloId: 'ciclo_2026-11-01', cicloInicio: '2026-11-01' } },
    clientes: {
      ana: { nombre: 'Ana López', nombrePerfil: 'Ana López', telefono: '98765432', servicios: [
        { compraId: 'c-nfx', plataforma: 'netflix', correo: 'a@x.hn', fechaRenovacion: '04/11/2026', precio: 150 },
        { compraId: 'c-dsn', plataforma: 'disneyp', correo: 'b@x.hn', fechaRenovacion: '04/11/2026', precio: 110 },
        { compraId: 'c-prm', plataforma: 'primevideo', correo: 'c@x.hn', fechaRenovacion: '04/11/2026', precio: 90 },
      ] },
    },
  };
}
const res = () => { const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
const lineas3 = (dur = { unidad: 'meses', cantidad: 3 }) => [
  { compraId: 'c-nfx', plataforma: 'netflix', duracion: dur, monto: 150 },
  { compraId: 'c-dsn', plataforma: 'disneyp', duracion: dur, monto: 110 },
  { compraId: 'c-prm', plataforma: 'primevideo', duracion: dur, monto: 90 },
];
const pago = (op, total = 350) => ({ montoTotal: total, recibido: total, bancoId: 'bac', operationId: op, origen: 'web', fechaPago: '' });
const movs = (db) => [...db._data.entries()].filter(([k]) => k.startsWith('finanzas_movimientos/')).map(([k, v]) => ({ id: k.split('/')[1], ...v.data }));

test('R01/R04: vence 04/11, paga hoy, 3 meses → los 3 servicios a 04/02/2027; 1 venta + 1 cobro de L350 con 3 asignaciones', async () => {
  const { __r186 } = await import('../api/renovar.js');
  const db = fakeFirestore(semilla());
  const r = res();
  await __r186.renovarLote(db, user, { accion: 'renovar_lote', clienteId: 'ana', lineas: lineas3(), pago: pago('op-lote-0001'), origen: 'web', confirmarAtraso: true }, r);
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const servs = db._data.get('clientes/ana').data.servicios;
  assert.deepEqual(servs.map((s) => s.fechaRenovacion), ['04/02/2027', '04/02/2027', '04/02/2027']);
  assert.ok(servs.every((s) => s.ultimaRenovacion.fechaAnterior === '04/11/2026' && s.ultimaRenovacion.regla === 'meses_calendario'));
  const m = movs(db);
  const ventas = m.filter((x) => x.tipo === 'venta'), cobros = m.filter((x) => x.tipo === 'ingreso');
  assert.equal(ventas.length, 1); assert.equal(cobros.length, 1, 'un solo ingreso, no uno por servicio');
  assert.equal(cobros[0].monto, 350); assert.equal(ventas[0].asignaciones.length, 3);
  assert.equal(ventas[0].asignaciones.reduce((a, x) => a + x.montoCentavos, 0), 35000, 'asignaciones = total exacto');
  assert.deepEqual(ventas[0].asignaciones.map((a) => a.fechaNueva), ['04/02/2027', '04/02/2027', '04/02/2027']);
});

test('R05: el mismo cobro reenviado (APK/bot/web) devuelve la misma operación: no renueva ni cobra otra vez', async () => {
  const { __r186 } = await import('../api/renovar.js');
  const db = fakeFirestore(semilla());
  const body = { accion: 'renovar_lote', clienteId: 'ana', lineas: lineas3(), pago: pago('op-lote-0002'), origen: 'android', confirmarAtraso: true };
  await __r186.renovarLote(db, user, body, res());
  const r2 = res(); await __r186.renovarLote(db, user, structuredClone(body), r2);
  assert.equal(r2.body.duplicado, true);
  assert.deepEqual(db._data.get('clientes/ana').data.servicios.map((s) => s.fechaRenovacion), ['04/02/2027', '04/02/2027', '04/02/2027'], 'no se sumaron 3 meses más');
  assert.equal(movs(db).filter((x) => x.tipo === 'ingreso').length, 1);
});

test('R06: si un servicio no existe, NO se renueva ninguno y NO hay pago', async () => {
  const { __r186 } = await import('../api/renovar.js');
  const db = fakeFirestore(semilla());
  const l = lineas3(); l[2] = { compraId: 'c-no-existe', plataforma: 'hbomax', duracion: { unidad: 'meses', cantidad: 3 }, monto: 90 };
  const r = res();
  await __r186.renovarLote(db, user, { accion: 'renovar_lote', clienteId: 'ana', lineas: l, pago: pago('op-lote-0003'), confirmarAtraso: true }, r);
  assert.equal(r.body.ok, false); assert.match(r.body.error, /No encontré[\s\S]*No se renovó nada/);
  assert.deepEqual(db._data.get('clientes/ana').data.servicios.map((s) => s.fechaRenovacion), ['04/11/2026', '04/11/2026', '04/11/2026']);
  assert.equal(movs(db).length, 0);
});

test('suma por servicio ≠ total del pago → se rechaza; servicio repetido → se rechaza', async () => {
  const { __r186 } = await import('../api/renovar.js');
  const db = fakeFirestore(semilla());
  const r = res(); await __r186.renovarLote(db, user, { clienteId: 'ana', lineas: lineas3(), pago: pago('op-lote-0004', 400) }, r);
  assert.match(r.body.error, /no coincide/);
  const l = lineas3(); l[1] = { ...l[0] };
  const r2 = res(); await __r186.renovarLote(db, user, { clienteId: 'ana', lineas: l, pago: pago('op-lote-0005', 390), confirmarAtraso: true }, r2);
  assert.match(r2.body.error, /repetido/); assert.equal(movs(db).length, 0);
});

test('atraso: si sigue vencido después de renovar, pide confirmar periodos y no escribe; 30 y 31 días exactos', async () => {
  const { __r186 } = await import('../api/renovar.js');
  const s = semilla(); s.clientes.ana.servicios.forEach((x) => { x.fechaRenovacion = '01/01/2026'; });
  const db = fakeFirestore(s);
  const r = res(); await __r186.renovarLote(db, user, { clienteId: 'ana', lineas: lineas3({ unidad: 'dias', cantidad: 30 }), pago: pago('op-lote-0006') }, r);
  assert.equal(r.body.requiereConfirmacion, true); assert.equal(r.body.lineas[0].fechaNueva, '31/01/2026', 'nunca adelanta al día del pago');
  assert.equal(movs(db).length, 0);
  const v = res(); await __r186.renovarLote(db, user, { clienteId: 'ana', soloVista: true, lineas: [{ compraId: 'c-nfx', plataforma: 'netflix', duracion: { unidad: 'dias', cantidad: 31 }, periodos: 11, monto: 0 }] }, v);
  assert.equal(v.body.vista, true); assert.equal(v.body.lineas[0].periodos, 11);
});

test('cableado: Web y APK usan renovar_lote; acción con un solo servicio no se repite si el pago ya existe', () => {
  const src = fs.readFileSync(new URL('../api/renovar.js', import.meta.url), 'utf8');
  assert.match(src, /if \(acc === "renovar_lote"\) return await renovarLote/);
  assert.match(src, /lecturaPagoRenov\?\.yaExiste && !lecturaPagoRenov\.socio\) return \{ duplicadoPago: true \}/);
  const web = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(web, /accion:"renovar_lote"/);
});

test('APK instalada: si manda duracionElegida, el servidor recalcula con el motor (no confía en la fecha del teléfono)', () => {
  const src = fs.readFileSync(new URL('../api/renovar.js', import.meta.url), 'utf8');
  assert.match(src, /const desdeDuracionApk = !!\(de && \["dias", "meses"\]\.includes/);
  assert.match(src, /const usarFechaExacta = !!fechaExacta && !desdeDuracionApk;/);
});

test('vendedor sin Finanzas renueva en lote sin pago; Sublicuentas/Relojes deben registrar pago o ajuste', async () => {
  const { __r186 } = await import('../api/renovar.js');
  const db = fakeFirestore(semilla());
  const r = res(); await __r186.renovarLote(db, user, { clienteId: 'ana', lineas: lineas3(), confirmarAtraso: true }, r);
  assert.match(r.body.error, /Falta el pago/);
  const v = res(); await __r186.renovarLote(db, { uid: 'uHeb', role: 'vendedor', usuario: 'heber' }, { clienteId: 'ana', lineas: lineas3(), confirmarAtraso: true }, v);
  assert.equal(v.body.ok, true); assert.equal(movs(db).length, 0, 'sin Finanzas no crea movimientos');
  const a = res(); await __r186.renovarLote(db, user, { clienteId: 'ana', lineas: lineas3({ unidad: 'dias', cantidad: 31 }), ajusteAdministrativo: true, motivoAjuste: 'garantía caída', confirmarAtraso: true }, a);
  assert.equal(a.body.ok, true); assert.equal(movs(db).length, 0, 'ajuste: mueve fecha sin ingreso');
});
