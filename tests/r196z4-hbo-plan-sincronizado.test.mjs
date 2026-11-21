// R196z4 · HBO: el plan vive en UN solo dato (inventario.planHbo de la cuenta madre). Antes la Web, después de cambiarlo,
// llamaba a `invCargar()` (no existe): la tarjeta de Inventario y Control Maestro seguían con la copia vieja («plan sin
// definir») mientras el detalle (que se lee en vivo) ya decía Platinum. Ahora todas las vistas toman el dato guardado y las
// ventas ligadas copian el plan de su cuenta. Datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
const require = createRequire(import.meta.url);
const P = require('../api/_hbo-planes.js');
const R = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const cli = (n) => Array.from({ length: n }, (_, i) => ({ clienteId: 'cli' + (i % 2), compraId: 'cmp' + i, nombre: 'Perfil ' + i, slot: i + 1, pin: '10' + i }));
const venta = (i, extra = {}) => ({ compraId: 'cmp' + i, plataforma: 'hbomax', correo: '119@prueba.test', precio: 150, fechaRenovacion: '2026-12-1' + i, pinPerfil: '10' + i, ...extra });
const semilla = () => ({
  inventario: { h119: { plataforma: 'hbomax', correo: '119@prueba.test', capacidad: 5, clientes: cli(3), ocupados: 3 } },
  clientes: { cli0: { nombre: 'Cliente A', servicios: [venta(0, { planHbo: '' }), venta(2), { compraId: 'nf', plataforma: 'netflix', correo: 'otra@prueba.test', precio: 100 }] }, cli1: { nombre: 'Cliente B', servicios: [venta(1, { planHbo: 'standard', inventarioId: 'h119' })] } },
  fin_lotes: { l1: { cuentaInventarioId: 'h119', costoTotalHnl: 93.1 } },
});
const fin = (db) => JSON.stringify([...db._data.entries()].filter(([k]) => /^(fin_|finanzas_)/.test(k)));
// Las 3 maneras de pintar el plan que existen (servidor/Telegram, Web, APK) deben dar lo mismo con el MISMO documento.
function webPlan(doc) { const src = R('sublichat-app.js'); const fn = src.match(/function invPlanHbo\(c\)\{[^\n]*\n?/)[0];
  const invOcupados = (c) => (Array.isArray(c.clientes) ? c.clientes.length : (Number(c.ocupados) || 0)); const invCap = (c) => Number(c.capacidad) || Number(c.total) || invOcupados(c) || 0; // eslint-disable-line no-unused-vars
  return new Function('invOcupados', 'invCap', `${fn}; return invPlanHbo;`)(invOcupados, invCap)(doc); }

test('cuenta de referencia (Platinum · 3/5): servidor, Telegram y Web dicen lo mismo con el dato guardado', async () => {
  const db = fakeFirestore(semilla());
  const r = await P.cambiarPlan(db, { inventarioId: 'h119', plan: 'platinum', usuario: 'sublicuentas' });
  assert.deepEqual([r.plan, r.capacidad, r.ocupados, r.libres, r.etiqueta], ['platinum', 5, 3, 2, 'Platinum · 3/5']);
  const guardado = db._data.get('inventario/h119').data; // = «reiniciar la interfaz»: se vuelve a leer de la base
  assert.deepEqual([guardado.planHbo, guardado.capacidad, guardado.disponibles], ['platinum', 5, 2]);
  assert.equal(P.etiquetaPlan(guardado), 'Platinum · 3/5');
  assert.equal(webPlan(guardado), 'Platinum · 3/5', 'tarjeta de Inventario (Web)');
  assert.match(R('control-maestro.js'), /planHbo:\/hbo\/i\.test\(String\(g\.family\|\|''\)\)\?\(\(g\.inventoryAccounts\|\|\[\]\)\.map\(\(x\)=>String\(x\.planHbo\|\|''\)\)/, 'Control Maestro lee el mismo campo de la cuenta');
  assert.match(R('sublichat-app.js'), /planHbo:c\.planHbo\|\|''/, 'la copia que recibe Control Maestro trae planHbo');
});

test('ventas ligadas copian el plan de su cuenta (solo planHbo); sin tocar precios, fechas, PIN, otras plataformas ni Finanzas', async () => {
  const db = fakeFirestore(semilla()); const f0 = fin(db);
  const c0 = structuredClone(db._data.get('clientes/cli0').data);
  await P.cambiarPlan(db, { inventarioId: 'h119', plan: 'platinum', usuario: 'sublicuentas' });
  const s = await P.sincronizarPlanVentas(db, { inventarioId: 'h119', usuario: 'sublicuentas' });
  assert.equal(s.ventas, 3);
  const a = db._data.get('clientes/cli0').data, b = db._data.get('clientes/cli1').data;
  assert.deepEqual([a.servicios[0].planHbo, a.servicios[1].planHbo, b.servicios[0].planHbo], ['platinum', 'platinum', 'platinum']);
  for (const k of ['precio', 'fechaRenovacion', 'pinPerfil', 'correo', 'compraId']) assert.equal(a.servicios[0][k], c0.servicios[0][k], k);
  assert.deepEqual(a.servicios[2], c0.servicios[2], 'Netflix intacto');
  assert.equal(a.servicios[0].historialPlanHbo[0].a, 'platinum');
  assert.equal((await P.sincronizarPlanVentas(db, { inventarioId: 'h119' })).ventas, 0, 'idempotente');
  assert.equal(fin(db), f0, 'no crea ni borra registros financieros');
  assert.equal(db._data.get('inventario/h119').data.clientes.length, 3, 'perfiles intactos');
});

test('Standard → Platinum → Standard excepcional 4: cada cambio queda guardado y las ventas lo siguen', async () => {
  const db = fakeFirestore({ inventario: { h: { plataforma: 'hbomax', correo: 'h@prueba.test', capacidad: 5, clientes: cli(4), ocupados: 4 } }, clientes: { cli0: { servicios: [venta(0, { correo: 'h@prueba.test' })] }, cli1: { servicios: [venta(1, { correo: 'h@prueba.test' })] } } });
  await P.cambiarPlan(db, { inventarioId: 'h', plan: 'standard', autorizarExcepcion: true, usuario: 'sublicuentas' });
  await P.sincronizarPlanVentas(db, { inventarioId: 'h' });
  let d = db._data.get('inventario/h').data;
  assert.deepEqual([d.planHbo, d.capacidad, P.etiquetaPlan(d), webPlan(d)], ['standard', 4, 'Standard · 4/4 · Capacidad personalizada', 'Standard · 4/4 · Capacidad personalizada']);
  assert.equal(db._data.get('clientes/cli0').data.servicios[0].planHbo, 'standard');
  await P.cambiarPlan(db, { inventarioId: 'h', plan: 'platinum', usuario: 'sublicuentas' }); await P.sincronizarPlanVentas(db, { inventarioId: 'h' });
  d = db._data.get('inventario/h').data;
  assert.deepEqual([d.planHbo, d.capacidad, d.capacidadPersonalizada, webPlan(d)], ['platinum', 5, false, 'Platinum · 4/5']);
  assert.equal(db._data.get('clientes/cli1').data.servicios[0].planHbo, 'platinum');
});

test('cuentas sin plan: se listan para clasificar; nada se asigna solo por capacidad', async () => {
  const db = fakeFirestore({ inventario: { a: { plataforma: 'hbomax', correo: 'a@prueba.test', capacidad: 5, clientes: [] }, b: { plataforma: 'hbomax', correo: 'b@prueba.test', capacidad: 3, clientes: [] } }, clientes: {} });
  const antes = JSON.stringify([...db._data.entries()]);
  const dg = await P.diagnosticoHbo(db);
  assert.deepEqual(dg.sinPlan.map((x) => x.correo).sort(), ['a@prueba.test', 'b@prueba.test']);
  assert.equal(JSON.stringify([...db._data.entries()]), antes, 'solo lectura: no se clasifica nada automáticamente');
  assert.equal((await P.sincronizarPlanVentas(db, { inventarioId: 'a' })).ventas, 0, 'sin plan no se copia nada');
});

test('Web, API y APK: después de guardar se actualiza la copia local, Control Maestro y se relee la base', () => {
  const app = R('sublichat-app.js'), web = R('bodega-vip-web.js'), inv = R('api/inventario.js'), mc = R('api/mobile-core.js');
  assert.doesNotMatch(app, /typeof invCargar==="function"/, 'ya no depende de una función que no existe');
  assert.match(app, /montar\(document\.getElementById\("invHboBox"\),\(r\)=>invHboGuardado\(c,r\)\)/);
  assert.match(app, /function invHboGuardado\(c,r\)\{[\s\S]*bumpControlDataVersion\(\);window\.sublichatControlSyncLoadedData[\s\S]*invFiltrar\(\)[\s\S]*load\(\)/);
  assert.match(app, /accion:"hboCapacidad",capacidad:Number\(v\)/, '«👥 Editar capacidad» de HBO usa la misma regla');
  assert.match(web, /if \(r\.ok && cb\) cb\(r\);/);
  assert.match(inv, /hboPlanes\.sincronizarPlanVentas\(db, \{ inventarioId: docId/); assert.match(mc, /hboPlanes\.sincronizarPlanVentas\(db, \{ inventarioId: id/);
  assert.match(R('index.html'), /bodega-vip-web\.js\?v=20261117-r196z4/); assert.match(R('index.html'), /sublichat-app\.js\?v=202611(17-r196z4|2\d-r(19[7-9]|2\d\d)[a-z])/);
});
