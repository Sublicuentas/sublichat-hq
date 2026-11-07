// R188 · Fase 3: dispositivo POR SERVICIO, URL personalizada desde el servicio confirmado, avisos centrales y modalidad de acceso.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../api/_entrega-plataforma.js');
const { __r188: R } = await import('../api/renovar.js');
const { __r188: A } = await import('../api/acceso.js');

const cliente = { nombre: 'Ana López', nombrePerfil: 'Ana López' };

test('D01: Android TV elegido para Oleada → la URL dice Android TV; sin elegir → «Pendiente de seleccionar» (no inventa)', () => {
  const s = R.buildServicio({ plataforma: 'oleadatv1', correo: 'ana01', clave: 'x1', fechaRenovacion: '04/12/2026', equipoTv: 'android_tv' }, '', {}, 'Ana López');
  assert.equal(s.equipoTv, 'android_tv');
  assert.equal(A.servicioPublico(cliente, s).dispositivoRegistrado, 'Android TV / TV Box');
  const sin = R.buildServicio({ plataforma: 'oleadatv1', correo: 'ana01', clave: 'x1', fechaRenovacion: '04/12/2026' }, '', {}, 'Ana López');
  assert.equal(A.servicioPublico(cliente, sin).dispositivoRegistrado, 'Pendiente de seleccionar');
  assert.throws(() => R.buildServicio({ plataforma: 'stellatv1', correo: 'a', clave: 'b', fechaRenovacion: '04/12/2026', equipoTv: 'iphone' }, '', {}, 'Ana'), /no está disponible/);
  assert.throws(() => R.buildServicio({ plataforma: 'oleadatv1', correo: 'a', clave: 'b', fechaRenovacion: '04/12/2026', equipoTv: 'nevera' }, '', {}, 'Ana'), /no está disponible/);
});

test('D02: cambiar el dispositivo de un servicio manda sobre el viejo del perfil; los demás servicios no cambian', () => {
  const anterior = R.buildServicio({ plataforma: 'netflix', correo: 'a@x.hn', clave: 'k', pinPerfil: '1234', fechaRenovacion: '04/12/2026', perfiles: [{ nombre: 'Ana', correo: 'a@x.hn', clave: 'k', pinPerfil: '1234', dispositivo: 'cel' }] }, '', {}, 'Ana');
  assert.equal(anterior.dispositivo, 'cel');
  // La APK / el bot mandan solo el dispositivo del servicio (sin lista de perfiles): antes ganaba «cel» guardado.
  const editado = R.buildServicio({ plataforma: 'netflix', dispositivo: 'tv', esRoku: false, fechaRenovacion: '04/12/2026' }, '', anterior, 'Ana');
  assert.equal(editado.dispositivo, 'tv'); assert.equal(editado.perfiles[0].dispositivo, 'tv');
  assert.equal(A.servicioPublico(cliente, editado).dispositivoRegistrado, 'TV');
  const otro = R.buildServicio({ plataforma: 'disneyp', correo: 'd@x.hn', clave: 'k', pinPerfil: '1', fechaRenovacion: '04/12/2026', perfiles: [{ nombre: 'Ana', correo: 'd@x.hn', clave: 'k', pinPerfil: '1', dispositivo: 'cel' }] }, '', {}, 'Ana');
  assert.equal(A.servicioPublico(cliente, otro).dispositivoRegistrado, 'Celular', 'el otro servicio conserva su propio dispositivo');
  assert.ok(editado.fichaVersion > anterior.fichaVersion, 'cada guardado sube la versión de la ficha');
});

test('D03: Prime Video lleva «solo aplicación Prime Video» en la URL (destacado) y en la ficha Web; HBO ≠ Netflix; Crunchyroll sin «solo para Honduras»', () => {
  const prime = A.servicioPublico(cliente, { plataforma: 'primevideo', fechaRenovacion: '04/12/2030', correo: 'p@x.hn', clave: 'k', dispositivo: 'tv' });
  assert.equal(prime.avisos[0].texto, 'Solo disponible para la aplicación Prime Video. Prohibido ingresar en Amazon.'); assert.equal(prime.avisos[0].destacado, true);
  const hbo = E.avisosPara('hbomax'), nf = E.avisosPara('netflix');
  assert.match(hbo[0].texto, /en cualquier momento, incluso apenas/); assert.match(nf[0].texto, /15 días/);
  assert.notEqual(hbo[0].id, nf[0].id); assert.deepEqual(E.avisosPara('vipnetflix'), [], 'no se hereda a Netflix VIP'); assert.deepEqual(E.avisosPara('disneyp'), []);
  assert.deepEqual(E.avisosPara('crunchyroll'), []);
  const cr = A.servicioPublico(cliente, { plataforma: 'crunchyroll', fechaRenovacion: '04/12/2030', correo: 'c@x.hn', clave: 'k' });
  assert.ok(cr.terminos.every((t) => !/honduras/i.test(t)), 'Crunchyroll sin «solo para Honduras»');
  const web = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.ok(web.includes(E.AVISOS.primevideo[0].texto) && web.includes(E.AVISOS.hbomax[0].texto), 'la ficha Web usa el texto central exacto');
  const html = fs.readFileSync(new URL('../acceso.html', import.meta.url), 'utf8');
  assert.match(html, /Dispositivo registrado/); assert.match(html, /Array\.isArray\(d\.avisos\)/);
});

test('D04: Gemini / Duolingo con correo del cliente → no se pide, no se guarda y no se muestra contraseña', () => {
  const g = R.buildServicio({ plataforma: 'gemini', correo: 'cliente@gmail.com', clave: 'NOSEGUARDA', fechaRenovacion: '04/12/2026', modalidadAcceso: 'correo_cliente' }, '', {}, 'Ana');
  assert.equal(g.clave, ''); assert.equal(g.perfiles[0].clave, ''); assert.equal(g.modalidadAcceso, 'correo_cliente');
  const pub = A.servicioPublico(cliente, { ...g, fechaRenovacion: '04/12/2030' });
  assert.equal(pub.clave, ''); assert.equal(pub.modalidadAcceso, 'correo_cliente');
  const d = R.buildServicio({ plataforma: 'duolingo', correo: 'c@x.hn', fechaRenovacion: '04/12/2026' }, '', {}, 'Ana');
  assert.equal(d.modalidadAcceso, 'correo_cliente', 'registros sin modalidad = correo del cliente (como hasta hoy)');
  const gp = R.buildServicio({ plataforma: 'gemini', correo: 'cuenta@subli.hn', clave: 'Prov#1', fechaRenovacion: '04/12/2026', modalidadAcceso: 'proveedor' }, '', {}, 'Ana');
  assert.equal(gp.clave, 'Prov#1');
  // pasar de cuenta entregada a correo propio borra la contraseña guardada
  const vuelta = R.buildServicio({ plataforma: 'gemini', modalidadAcceso: 'correo_cliente', fechaRenovacion: '04/12/2026' }, '', gp, 'Ana');
  assert.equal(vuelta.clave, ''); assert.equal(vuelta.perfiles[0].clave, '');
});

test('D05: ChatGPT entregado → correo y contraseña; la URL los muestra al cliente autorizado (no hay contraseña en la URL ni en logs)', () => {
  const c = R.buildServicio({ plataforma: 'chatgpt', correo: 'gpt@subli.hn', clave: 'Gpt#2026', fechaRenovacion: '04/12/2026' }, '', {}, 'Ana');
  assert.equal(c.clave, 'Gpt#2026'); assert.equal(c.modalidadAcceso, 'proveedor');
  const pub = A.servicioPublico(cliente, { ...c, fechaRenovacion: '04/12/2030' });
  assert.equal(pub.correo, 'gpt@subli.hn'); assert.equal(pub.clave, 'Gpt#2026');
  const src = fs.readFileSync(new URL('../api/acceso.js', import.meta.url), 'utf8');
  assert.match(src, /Cache-Control", "private, no-store/); assert.doesNotMatch(src, /console\.log\([^)]*clave/);
});
