// R187 · Fase 2: ICOMPLAY (20 tarifas, nombre oficial), Baúl de APKs y URLs de TV Digital. Firestore en memoria, datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
const require = createRequire(import.meta.url);
const planes = require('../api/_planes-tv.js');
const baul = require('../api/_baul-apks.js');
const tv = require('../api/_tv-digital.js');

test('I01/I02: ICOMPLAY = 20 variantes exactas (1,2,3,5,7 pantallas × 1,3,6,12 meses); 2 pantallas · 3 meses = L599', async () => {
  const v = planes.variantes('icomplay');
  assert.equal(v.length, 20);
  assert.deepEqual([...new Set(v.map((x) => x.pantallas))], [1, 2, 3, 5, 7]);
  const t = Object.fromEntries(v.map((x) => [`${x.pantallas}x${x.meses}`, x.precio]));
  assert.deepEqual(t, { '1x1': 179, '1x3': 499, '1x6': 949, '1x12': 1799, '2x1': 219, '2x3': 599, '2x6': 1149, '2x12': 2149, '3x1': 249, '3x3': 699, '3x6': 1349, '3x12': 2499, '5x1': 329, '5x3': 929, '5x6': 1799, '5x12': 3399, '7x1': 399, '7x3': 1129, '7x6': 2199, '7x12': 4199 });
  assert.ok(v.every((x) => x.nombre === 'ICOMPLAY' && !/max/i.test(x.etiqueta)), 'sin «Icomplay Max»');
  const db = fakeFirestore();
  const P = await planes.leerPlanesTv(db, { fresco: true });
  assert.equal(planes.precioPlan(P, 'icomplay', 2, 3), 599);
  assert.throws(() => planes.precioPlan(P, 'icomplay', 4, 3), /pantallas permitidas 1, 2, 3, 5, 7/);
  assert.throws(() => planes.precioPlan(P, 'icomplay', 2, 2), /meses permitidos/);
  assert.throws(() => planes.precioPlan(P, 'liontv', 1, 1), /sin catálogo/, 'no se mezcla con otro IPTV');
});

test('cambiar una tarifa: solo ventas futuras, la anterior queda archivada con fecha y usuario + auditoría', async () => {
  const db = fakeFirestore(); planes._limpiarCache();
  const r = await planes.guardarPrecioPlan(db, { plataforma: 'icomplay', pantallas: 2, meses: 3, precio: 649, usuario: 'naara' });
  assert.deepEqual([r.precioAnterior, r.precioNuevo], [599, 649]);
  const P = await planes.leerPlanesTv(db, { fresco: true });
  assert.equal(P.icomplay.precios[2][3], 649); assert.equal(P.historial.at(-1).precioAnterior, 599); assert.equal(P.historial.at(-1).por, 'naara');
  await assert.rejects(planes.guardarPrecioPlan(db, { pantallas: 4, meses: 3, precio: 100 }), /no existe/);
  await assert.rejects(planes.guardarPrecioPlan(db, { pantallas: 2, meses: 3, precio: 0 }), /inválido/);
  assert.ok([...db._data.keys()].some((k) => k.startsWith('auditoria_eventos/')));
});

test('A01–A04, A06: directorio oficial exacto (apps compartidas, Latv-Gt aparte, Oleada Fire TV 1290332, Stella sin iPhone/PC, SmartOne L85)', () => {
  const b = { ...baul.SEMILLA, apps: baul.SEMILLA.apps, enlaces: baul.SEMILLA.enlaces };
  const lion = baul.vistaPlataforma(b, 'liontv'), nano = baul.vistaPlataforma(b, 'evoutouch');
  const subliLion = lion.dispositivos.find((d) => d.id === 'android_tv').enlaces.find((e) => e.appId === 'sublicuentas');
  const subliNano = nano.dispositivos.find((d) => d.id === 'android_tv').enlaces.find((e) => e.appId === 'sublicuentas');
  assert.equal(subliLion.id, subliNano.id, 'A01: el mismo recurso, no duplicado'); assert.equal(subliLion.url, 'http://aftv.news/298863'); assert.equal(subliLion.codigo, '298863');
  const latin = baul.vistaPlataforma(b, 'latintv').dispositivos.find((d) => d.id === 'android_tv').enlaces;
  assert.deepEqual(latin.map((e) => e.app).sort(), ['Latv-Gt', 'Sublicuentas'], 'A02: dos apps distintas');
  assert.equal(latin.find((e) => e.appId === 'latvgt').codigo, '', 'el 298863 no se asigna a Latv-Gt');
  const fire = baul.vistaPlataforma(b, 'oleada').dispositivos.find((d) => d.id === 'fire_tv').enlaces[0];
  assert.deepEqual([fire.url, fire.codigo], ['https://dldsrvs.com/apks/firestick/mgs_pro.apk', '1290332'], 'A03');
  const mov = baul.vistaPlataforma(b, 'oleada').dispositivos.find((d) => d.id === 'android_movil').enlaces.find((e) => e.url === 'http://aftv.news/4221609');
  assert.equal(mov.codigo, '', '4221609 no confirmado: no se da como código'); assert.equal(mov.codigoPendiente, '4221609');
  const stella = baul.vistaPlataforma(b, 'stellatv').dispositivos.map((d) => d.id);
  assert.deepEqual(stella, ['android_tv', 'android_movil'], 'A04: Stella sin iPhone ni PC');
  const smart = lion.dispositivos.find((d) => d.id === 'smart_tv').enlaces;
  assert.deepEqual(smart.map((e) => e.app).sort(), ['Max Player', 'SmartOne']);
  assert.ok(smart.every((e) => e.url === '' && e.metodo === 'tv_store'), 'sin URL inventada de la tienda del TV');
  assert.match(smart.find((e) => e.appId === 'smartone').costoExterno.texto, /L85 para activar 12 meses POR DISPOSITIVO/, 'A06');
  assert.equal(baul.SEMILLA.enlaces.find((e) => e.id === 'purple-ios').url, 'https://apps.apple.com/hn/app/purple-lite-iptv-player/id6749171817');
});

test('Baúl: alta/edición validadas, mismo código no se reutiliza en otra app, desactivar antes de eliminar, auditoría', async () => {
  const db = fakeFirestore(); baul._limpiarCache();
  await assert.rejects(baul.guardarEnlace(db, { plataformas: ['stellatv'], dispositivo: 'iphone', metodo: 'web', url: 'https://x.hn', appId: 'stellatv' }, 'naara'), /Stella TV no se ofrece/);
  await assert.rejects(baul.guardarEnlace(db, { plataformas: ['liontv'], dispositivo: 'android_tv', metodo: 'apk', url: 'javascript:alert(1)', appId: 'sublicuentas' }, 'naara'), /URL inválida/);
  await assert.rejects(baul.guardarEnlace(db, { plataformas: ['liontv'], dispositivo: 'android_tv', metodo: 'downloader', url: 'http://aftv.news/1', codigo: '298863', appNombre: 'Otra App' }, 'naara'), /ya pertenece a otra aplicación/);
  await assert.rejects(baul.guardarEnlace(db, { plataformas: ['liontv'], dispositivo: 'android_tv', metodo: 'apk', url: '', appId: 'sublicuentas' }, 'naara'), /Falta la URL/);
  const r = await baul.guardarEnlace(db, { id: 'subli-atv', plataformas: ['liontv', 'icomplay', 'latintv', 'evoutouch'], dispositivo: 'android_tv', metodo: 'downloader', url: 'http://aftv.news/298863', codigo: '298863', appId: 'sublicuentas', nota: 'Probado' }, 'naara');
  assert.equal(r.despues.revision, 2); assert.equal(r.antes.revision, 1);
  await assert.rejects(baul.eliminarEnlace(db, 'subli-atv', 'naara'), /Primero desactívelo/);
  await baul.activarEnlace(db, 'subli-atv', false, 'naara');
  const b = await baul.leerBaul(db, { fresco: true });
  assert.equal(baul.vistaPlataforma(b, 'liontv').dispositivos.find((d) => d.id === 'android_tv'), undefined, 'desactivado: no se ofrece');
  await baul.eliminarEnlace(db, 'subli-atv', 'naara');
  assert.equal((await baul.leerBaul(db, { fresco: true })).enlaces.some((e) => e.id === 'subli-atv'), false);
  assert.equal([...db._data.keys()].filter((k) => k.startsWith('auditoria_eventos/')).length, 3, 'editar + desactivar + eliminar');
});

test('URLs de conexión: desactivar no rompe entregas; eliminar solo agregadas, desactivadas y sin clientes; historial', async () => {
  const db = fakeFirestore({ clientes: { c1: { servicios: [{ plataforma: 'icomplay2', iptvProveedor: 'icomplay' }] }, c2: { servicios: [{ plataforma: 'netflix' }] } } });
  await tv.guardarUrlTv(db, { proveedor: 'latintv3', nombre: 'LatinTV 3', url: 'http://nuevo.latin.hn:8080', usuario: 'naara' });
  await tv.activarUrlTv(db, { proveedor: 'icomplay', activo: false, usuario: 'naara' });
  const urls = await tv.leerUrlsTv(db, { fresco: true });
  assert.equal(urls.icomplay.activo, false); assert.equal(urls.icomplay.nombre, 'ICOMPLAY');
  assert.equal(tv.urlTvPara({ plataforma: 'icomplay2' }, urls), 'http://latinostream.xyz:80', 'el cliente que ya la tiene la sigue viendo');
  await assert.rejects(tv.eliminarUrlTv(db, { proveedor: 'icomplay' }), /proveedor base/);
  await assert.rejects(tv.eliminarUrlTv(db, { proveedor: 'latintv3' }), /Primero desactívela/);
  await tv.activarUrlTv(db, { proveedor: 'latintv3', activo: false, usuario: 'naara' });
  await tv.eliminarUrlTv(db, { proveedor: 'latintv3', usuario: 'naara' });
  assert.equal((await tv.leerUrlsTv(db, { fresco: true })).latintv3, undefined);
  assert.equal(await tv.clientesConProveedor(db, 'icomplay'), 1);
  const h = await tv.historialUrlsTv(db);
  assert.deepEqual(h.map((x) => x.accion), ['eliminar', 'desactivar', 'desactivar', 'agregar']);
});

test('cableado: Web, servidor y permisos (editores Sublicuentas/Relojes; Baúl por módulo)', () => {
  const inv = fs.readFileSync(new URL('../api/inventario.js', import.meta.url), 'utf8');
  for (const a of ['planesTv', 'guardarPrecioPlanTv', 'baulApks', 'baulGuardarEnlace', 'baulActivarEnlace', 'baulEliminarEnlace', 'activarTvUrl', 'eliminarTvUrl']) assert.match(inv, new RegExp(`"${a}"`));
  assert.match(inv, /PERMISOS\.aplicar\(permisosCtx, "baul-apks"/);
  const per = fs.readFileSync(new URL('../api/_permisos.js', import.meta.url), 'utf8');
  assert.match(per, /id: 'baul-apks'/);
  const web = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(web, /2:\{1:219,3:599,6:1149,12:2149\}/); assert.match(web, /icomplay2:"ICOMPLAY \(2 pantallas\)"/); assert.doesNotMatch(web, /"ICOMPLAY MAX/);
  assert.match(web, /async function invBaulApks\(\)/);
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="invBaulBtn"/);
  const mc = fs.readFileSync(new URL('../api/mobile-core.js', import.meta.url), 'utf8');
  assert.match(mc, /config\.planesTv = \{ icomplay: pl\.icomplay\.precios/);
});
