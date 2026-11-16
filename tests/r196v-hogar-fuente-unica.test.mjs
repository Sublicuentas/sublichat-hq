// R196v · Netflix Hogar: una sola fuente para Web, APK y Telegram (PDF «Netflix Hogar y HBO Standard/Platinum» · 01/02/06).
// Firestore en memoria, datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
const require = createRequire(import.meta.url);
const H = require('../api/_netflix-hogar.js');
const T = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const madre = (extra = {}) => ({ plataforma: 'netflix', correo: 'madre.demo@ejemplo.com', clave: 'NoSale1', capacidad: 5,
  clientes: [{ clienteId: 'A', compraId: 'cA', nombre: 'Cliente A', slot: 1, pin: '1111' }, { clienteId: 'B', compraId: 'cB', nombre: 'Cliente B', slot: 2, pin: '2222' }], ...extra });

test('01 · la consulta común devuelve el titular y el perfil guardados por ID (lo mismo que leen Web, APK y Telegram)', async () => {
  const db = fakeFirestore({ inventario: { m1: madre() } });
  await H.asignarHogar(db, { inventarioId: 'm1', clienteId: 'B', compraId: 'cB', usuario: 'sublicuentas', origen: 'telegram' });
  const r = await H.consultaHogar(db, { inventarioId: 'm1' });
  assert.equal(r.hogar.texto, 'Hogar: Cliente B · Perfil 2'); assert.equal(r.incidencia, ''); assert.deepEqual(r.copias, []);
  assert.deepEqual([r.hogarDoc.clienteId, r.hogarDoc.compraId, r.hogarDoc.slot], ['B', 'cB', 2]);
  assert.doesNotMatch(JSON.stringify(r), /NoSale1|1111|2222/, 'sin clave ni PIN');
});

test('01 · causa probable: la MISMA madre en dos documentos → la copia sin Hogar avisa la incidencia y no copia nada', async () => {
  const bot = madre({ hogar: { clienteId: 'B', compraId: 'cB', slot: 2, nombre: 'Cliente B' } });
  const web = madre({ correo: 'Madre.Demo@ejemplo.com ' });
  const db = fakeFirestore({ inventario: { 'netflix__madre_demo@ejemplo_com': bot, webRandomId: web } });
  const r = await H.consultaHogar(db, { inventarioId: 'webRandomId' });
  assert.equal(r.hogar.texto, 'Hogar sin asignar', 'muestra honestamente lo que tiene ESA copia');
  assert.match(r.incidencia, /está 2 veces en Bodega/); assert.match(r.incidencia, /El Hogar está registrado en la otra copia \(Hogar: Cliente B · Perfil 2\)/);
  assert.equal(db._data.get('inventario/webRandomId').data.hogar, undefined, 'no infiere ni copia el Hogar');
  const d = await H.diagnosticoHogar(db);
  assert.equal(d.duplicadas.length, 1); assert.equal(d.duplicadas[0].copias.length, 2); assert.equal(d.conHogar, 1);
});

test('02 · cambiar Hogar por el flujo autorizado: todos leen el cambio y nunca hay dos Hogares', async () => {
  const db = fakeFirestore({ inventario: { m1: madre() } });
  await H.asignarHogar(db, { inventarioId: 'm1', clienteId: 'A', compraId: 'cA' });
  await assert.rejects(H.asignarHogar(db, { inventarioId: 'm1', clienteId: 'B', compraId: 'cB' }), (e) => e.code === 'requiere_confirmacion');
  await H.asignarHogar(db, { inventarioId: 'm1', clienteId: 'B', compraId: 'cB', confirmarReemplazo: true });
  const r = await H.consultaHogar(db, { inventarioId: 'm1' });
  assert.equal(r.hogar.texto, 'Hogar: Cliente B · Perfil 2'); assert.equal(r.perfiles.filter((p) => p.hogar).length, 1);
  assert.equal(db._data.get('inventario/m1').data.historialHogar.length, 2, 'auditoría conservada');
});

test('03 · dar de baja el perfil con Hogar: queda PENDIENTE, no se reubica solo; quitar otro perfil no lo borra', async () => {
  const db = fakeFirestore({ inventario: { m1: madre({ hogar: { clienteId: 'B', compraId: 'cB', slot: 2, nombre: 'Cliente B' } }) } });
  const d = db._data.get('inventario/m1').data; d.clientes = d.clientes.filter((c) => c.clienteId !== 'A');
  assert.equal((await H.consultaHogar(db, { inventarioId: 'm1' })).hogar.texto, 'Hogar: Cliente B · Perfil 2', 'quitar a A no toca el Hogar de B');
  d.clientes = [];
  const r = await H.consultaHogar(db, { inventarioId: 'm1' });
  assert.equal(r.hogar.estado, 'pendiente'); assert.equal(r.perfiles.some((p) => p.hogar), false);
  assert.equal((await H.diagnosticoHogar(db)).pendientes.length, 1);
});

test('APK y Telegram usan la misma consulta en vivo; Web la muestra con la incidencia; diagnóstico solo para Sublicuentas', () => {
  const mc = T('api/mobile-core.js');
  assert.match(mc, /if \(action === 'hogar'\) return hogarAccion\(req, res\);/);
  assert.match(mc, /if \(!canRead\('inventario', user\)\) return res\.status\(403\)/);
  assert.doesNotMatch(mc.split('async function hogarAccion')[1].split('// R69')[0], /nombre|texto:/, 'el log no guarda nombres de clientes');
  const inv = T('api/inventario.js');
  assert.match(inv, /if \(accion === "hogarVer"\) return res\.status\(200\)\.json\(\{ \.\.\.\(await netflixHogar\.consultaHogar\(db, \{ inventarioId: docId \}\)\), puedeEditar: adminHogar \}\);/);
  assert.match(inv, /if \(accion === "hogarDiagnostico"\) \{ if \(!adminHogar\) return res\.status\(403\)/);
  assert.match(T('bodega-vip-web.js'), /if \(r\.incidencia\) html \+= '<p class="hg-incidencia">⚠️ '/);
  assert.doesNotMatch(T('control-maestro.js'), /hogar/i, 'Control Maestro sin flujos nuevos');
});
