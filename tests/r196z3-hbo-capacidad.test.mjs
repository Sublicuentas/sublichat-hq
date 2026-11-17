// R196z3 · HBO Standard 3 / Platinum 5 como PREDETERMINADO y capacidad editable por cuenta madre (excepción confirmada).
// Nunca se elimina, traslada ni desactiva un perfil vendido. Firestore en memoria; datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
const require = createRequire(import.meta.url);
const P = require('../api/_hbo-planes.js');
const R = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const cli = (n) => Array.from({ length: n }, (_, i) => ({ clienteId: 'c' + i, nombre: 'Cliente ' + i, slot: i + 1, precio: 150 + i, fechaRenovacion: '2026-12-0' + (i + 1), pin: '12' + i }));
const doc = (db, id) => db._data.get(`inventario/${id}`).data;
const intactos = (d) => JSON.stringify([d.clientes, d.correo, d.clave, d.pin]);

test('Standard nueva: 0/3 · Platinum normal: 5', async () => {
  const db = fakeFirestore({ inventario: { s: { plataforma: 'hbomax', correo: 's@prueba.test', capacidad: 3, clientes: [] }, p: { plataforma: 'hbomax', correo: 'p@prueba.test', capacidad: 5, clientes: [] } } });
  const a = await P.cambiarPlan(db, { inventarioId: 's', plan: 'standard', usuario: 'sublicuentas' });
  const b = await P.cambiarPlan(db, { inventarioId: 'p', plan: 'platinum', usuario: 'sublicuentas' });
  assert.deepEqual([a.etiqueta, a.capacidad, a.libres, a.personalizada], ['Standard · 0/3', 3, 3, false]);
  assert.deepEqual([b.etiqueta, b.capacidad, b.personalizada], ['Platinum · 0/5', 5, false]);
  assert.equal(P.PLANES.standard.capacidad, 3); assert.equal(P.PLANES.platinum.capacidad, 5); // límite general sin cambios
});

test('Standard excepcional 4/4 sin eliminar clientes (confirmación del administrador)', async () => {
  const db = fakeFirestore({ inventario: { h: { plataforma: 'hbomax', correo: 'h@prueba.test', clave: 'ClaveFicticia', capacidad: 5, clientes: cli(4), ocupados: 4 } } });
  const antes = intactos(doc(db, 'h'));
  await assert.rejects(P.cambiarPlan(db, { inventarioId: 'h', plan: 'standard' }), (e) => e.code === 'requiere_excepcion' && e.capacidadSugerida === 4);
  const r = await P.cambiarPlan(db, { inventarioId: 'h', plan: 'standard', autorizarExcepcion: true, motivo: 'Perfiles ya vendidos', usuario: 'sublicuentas', origen: 'tg' });
  assert.deepEqual([r.etiqueta, r.capacidad, r.ocupados, r.libres, r.personalizada, r.capacidadPlan], ['Standard · 4/4 · Capacidad personalizada', 4, 4, 0, true, 3]);
  const d = doc(db, 'h');
  assert.deepEqual([d.planHbo, d.capacidad, d.disponibles, d.capacidadPersonalizada, d.capacidadExcepcion.capacidad, d.capacidadExcepcion.por, d.capacidadExcepcion.motivo], ['standard', 4, 0, true, 4, 'sublicuentas', 'Perfiles ya vendidos']);
  assert.equal(intactos(d), antes, 'clientes, precios, fechas, clave y PIN intactos');
  assert.equal(P.cuposVendibles(d), 0); assert.match(P.validarAsignacion(d, { plan: 'standard' }), /llena \(4\/4\)/, 'no se vende un 5.º perfil');
});

test('Cambio de Platinum a Standard excepcional: conserva los 4 ocupados', async () => {
  const db = fakeFirestore({ inventario: { h: { plataforma: 'hbomax', correo: 'h@prueba.test', capacidad: 5, planHbo: 'platinum', clientes: cli(4), ocupados: 4 } } });
  const antes = intactos(doc(db, 'h'));
  const r = await P.cambiarPlan(db, { inventarioId: 'h', plan: 'standard', autorizarExcepcion: true, usuario: 'sublicuentas' });
  assert.deepEqual([r.plan, r.capacidad, r.ocupados], ['standard', 4, 4]);
  assert.equal(doc(db, 'h').clientes.length, 4); assert.equal(intactos(doc(db, 'h')), antes);
  assert.deepEqual([doc(db, 'h').historialPlan.at(-1).de, doc(db, 'h').historialPlan.at(-1).a, doc(db, 'h').historialPlan.at(-1).excepcion], ['platinum', 'standard', true]);
});

test('Editar capacidad: reducción por debajo de ocupados se impide y ofrece conservarlos; volver al predeterminado quita la excepción', async () => {
  const db = fakeFirestore({ inventario: { h: { plataforma: 'hbomax', correo: 'h@prueba.test', capacidad: 5, planHbo: 'platinum', clientes: cli(4), ocupados: 4 } } });
  await assert.rejects(P.editarCapacidad(db, { inventarioId: 'h', capacidad: 3, autorizarExcepcion: true }), (e) => e.code === 'sobreocupacion' && e.capacidadSugerida === 4);
  assert.equal(doc(db, 'h').capacidad, 5, 'no se guardó nada');
  await assert.rejects(P.editarCapacidad(db, { inventarioId: 'h', capacidad: 6 }), (e) => e.code === 'requiere_excepcion' && e.capacidadSugerida === 6);
  const r6 = await P.editarCapacidad(db, { inventarioId: 'h', capacidad: 6, autorizarExcepcion: true, usuario: 'sublicuentas' });
  assert.equal(r6.etiqueta, 'Platinum · 4/6 · Capacidad personalizada');
  const r5 = await P.editarCapacidad(db, { inventarioId: 'h', capacidad: 5, usuario: 'sublicuentas' });
  assert.deepEqual([r5.etiqueta, r5.personalizada, doc(db, 'h').capacidadExcepcion], ['Platinum · 4/5', false, null]);
  await assert.rejects(P.editarCapacidad(db, { inventarioId: 'h', capacidad: 0 }), /Capacidad inválida/);
  await assert.rejects(P.editarCapacidad(fakeFirestore({ inventario: { s: { plataforma: 'hbomax', capacidad: 5 } } }), { inventarioId: 's', capacidad: 4 }), /Defina primero el plan/);
  await assert.rejects(P.editarCapacidad(fakeFirestore({ inventario: { n: { plataforma: 'netflix', capacidad: 5 } } }), { inventarioId: 'n', capacidad: 4 }), /solo aplica a cuentas HBO/, 'otras plataformas no cambian');
});

test('929329 (caso): Platinum guardada con capacidad 4 → todos muestran 4/4 y el diagnóstico la señala; nada se cambia solo', async () => {
  const caso = { plataforma: 'hbomax', correo: 'caso@prueba.test', planHbo: 'platinum', capacidad: 4, clientes: cli(4), ocupados: 4 };
  const db = fakeFirestore({ inventario: { c: caso }, clientes: {} });
  assert.equal(P.resumenCuenta(caso).capacidad, 4, 'antes Telegram decía 5 (del plan) y la Web 4 (de la cuenta)');
  assert.equal(P.etiquetaPlan(caso), 'Platinum · 4/4 · Capacidad personalizada');
  assert.equal(P.cuposVendibles(caso), 0, 'Telegram ya no ofrece un 5.º perfil');
  const dg = await P.diagnosticoHbo(db);
  assert.deepEqual(dg.capacidadDistinta.map((x) => [x.correo, x.plan, x.capacidadGuardada, x.capacidadPlan, x.ocupados]), [['caso@prueba.test', 'Platinum', 4, 5, 4]]);
  assert.deepEqual(doc(db, 'c'), caso, 'el diagnóstico es solo lectura');
});

test('Web, APK y Telegram usan la misma regla y ofrecen «Editar capacidad»', () => {
  const inv = R('api/inventario.js'), mc = R('api/mobile-core.js'), web = R('bodega-vip-web.js'), app = R('sublichat-app.js');
  assert.match(inv, /accion === "hboPlan" \|\| accion === "hboCapacidad"/); assert.match(inv, /autorizarExcepcion: req\.body\.autorizarExcepcion === true/);
  assert.match(mc, /if \(action === 'hboPlan'\) return hboPlanAccion/); assert.match(mc, /accessFor\(user\)\.sublicuentas\) return res\.status\(403\)/);
  assert.match(web, /data-hbo-cap="1">Editar capacidad/); assert.match(web, /capacidad excepcional de/);
  assert.match(app, /k!==p\[1\]\?" · Capacidad personalizada"/);
  assert.match(R('index.html'), /bodega-vip-web\.js\?v=20261117-r196z3/);
});
