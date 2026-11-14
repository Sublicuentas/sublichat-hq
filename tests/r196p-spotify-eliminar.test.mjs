// R196p · PDF «Spotify · eliminar correos y Control Maestro» (13/11/2026). Firestore en memoria (con reintentos de
// transacción como Firestore real); datos ficticios. Lógica común + endpoint REAL /api/inventario con firebase-admin simulado.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import admin from 'firebase-admin';
import { createRequire } from 'node:module';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
const require = createRequire(import.meta.url);
const S = require('../api/_spotify-familias.js');
const R = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

const semilla = () => ({ clientes: Object.fromEntries([1, 2, 3, 4, 5].map((n) => [`c${n}`, { nombre: `Cliente ${n}`, historial: [{ tipo: 'venta', monto: 90 }],
  servicios: [{ compraId: `sp-c${n}`, plataforma: 'spotify', correo: `invitado${n}@ejemplo.test`, precio: 90, fechaRenovacion: '20/12/2026' }, { compraId: `dp-c${n}`, plataforma: 'disney', correo: 'dp@ejemplo.test', precio: 120, fechaRenovacion: '20/12/2026' }] }])) });
async function llena(db) {
  const f = await S.crearFamilia(db, { madreCorreo: 'madre1@ejemplo.test', usuario: 'sublicuentas' });
  for (let n = 1; n <= 5; n++) await S.vincularInvitado(db, { familiaId: f.id, correo: `invitado${n}@ejemplo.test`, clienteId: `c${n}`, compraId: `sp-c${n}` });
  return f;
}
const finanzas = (db) => [...db._data.keys()].filter((k) => /^(fin_|ventas\/|compras\/|movimientos)/.test(k));

test('T03/T04 · eliminar el 5 de 5 → 4/5; Control Maestro (spotifyPanel) muestra madre, 4 correos y «Espacio libre»', async () => {
  const db = fakeFirestore(semilla()); const f = await llena(db);
  const r = await S.eliminarCorreo(db, { familiaId: f.id, correo: 'invitado5@ejemplo.test', usuario: 'tg:sublicuentas' });
  assert.deepEqual([r.codigo, r.ocupados, r.capacidad, r.retiroExternoPendiente], ['SP-001', 4, 5, true]);
  const [p] = await S.panelFamilias(db, { hoy: '2026-11-13' });
  assert.equal(p.madreCorreo, 'madre1@ejemplo.test');
  assert.deepEqual(p.espacios.map((e) => [e.posicion, e.correo || null, e.estado === 'disponible']), [[1, 'invitado1@ejemplo.test', false], [2, 'invitado2@ejemplo.test', false], [3, 'invitado3@ejemplo.test', false], [4, 'invitado4@ejemplo.test', false], [5, null, true]]);
  // en una familia con menos de 5, baja exactamente uno y no mueve a los demás
  const r2 = await S.eliminarCorreo(db, { familiaId: f.id, correo: 'invitado2@ejemplo.test' });
  assert.equal(r2.ocupados, 3);
  const [p2] = await S.panelFamilias(db, {});
  assert.deepEqual(p2.espacios.map((e) => e.correo || '—'), ['invitado1@ejemplo.test', '—', 'invitado3@ejemplo.test', 'invitado4@ejemplo.test', '—']);
  assert.equal((await db.collection('inventario').doc(S.idBodega(f.id)).get()).data().ocupados, 3, 'Bodega/Telegram leen lo mismo');
});

test('T07/T08/T09/T12 · «No renovó» retira solo; ficha/venta/historial intactos; repetir no descuenta dos veces; sin movimientos de Finanzas', async () => {
  const db = fakeFirestore(semilla()); const f = await llena(db);
  const antesFin = finanzas(db);
  assert.equal((await S.retirarPorBaja(db, { correo: 'invitado1@ejemplo.test', clienteId: 'c1', compraId: 'sp-c1', motivo: 'no_renovo' })).ocupados, 4);
  await S.eliminarCorreo(db, { familiaId: f.id, correo: 'invitado3@ejemplo.test', usuario: 'sublicuentas' });
  for (const c of ['invitado3@ejemplo.test', 'INVITADO1@ejemplo.test', 'nadie@ejemplo.test']) {
    const x = await S.eliminarCorreo(db, { familiaId: f.id, correo: c });
    assert.equal(x.yaEstaba, true); assert.equal(x.ocupados, 3);
  }
  assert.equal((await S.leerFamilia(db, f.id)).ocupados, 3);
  const c3 = (await db.collection('clientes').doc('c3').get()).data(), s0 = semilla().clientes.c3;
  assert.equal(c3.nombre, s0.nombre); assert.deepEqual(c3.historial, s0.historial);
  assert.deepEqual(c3.servicios[1], s0.servicios[1], 'Disney intacto');
  assert.deepEqual([c3.servicios[0].compraId, c3.servicios[0].precio, c3.servicios[0].fechaRenovacion], ['sp-c3', 90, '20/12/2026']);
  assert.deepEqual(finanzas(db), antesFin, 'no se crean compras ni ventas');
  const aud = (await db.collection('auditoria_eventos').get()).docs.map((d) => d.data()).filter((a) => a.accion === 'eliminar_correo');
  assert.equal(aud.length, 1); assert.deepEqual([aud[0].usuario, aud[0].codigo, aud[0].correo, aud[0].motivo], ['sublicuentas', 'SP-001', 'invitado3@ejemplo.test', 'manual']);
});

test('T11 · nunca 6: dos altas a la vez en el último espacio → entra una; la madre no consume cupo', async () => {
  const db = fakeFirestore(semilla()); const f = await llena(db);
  await S.eliminarCorreo(db, { familiaId: f.id, correo: 'invitado1@ejemplo.test' });
  const rs = await Promise.allSettled([S.agregarPorCorreo(db, { familiaId: f.id, correo: 'a@ejemplo.test' }), S.agregarPorCorreo(db, { familiaId: f.id, correo: 'b@ejemplo.test' })]);
  assert.equal(rs.filter((x) => x.status === 'fulfilled').length, 1);
  const fam = await S.leerFamilia(db, f.id);
  assert.deepEqual([fam.ocupados, fam.capacidad], [5, 5]); assert.ok(!fam.miembros.some((m) => m.estado === 'activo' && m.correo === 'madre1@ejemplo.test'));
  // eliminar y agregar a la vez: el contador termina correcto
  await Promise.allSettled([S.eliminarCorreo(db, { familiaId: f.id, correo: 'invitado2@ejemplo.test' }), S.eliminarCorreo(db, { familiaId: f.id, correo: 'invitado2@ejemplo.test' })]);
  const f2 = await S.leerFamilia(db, f.id);
  assert.equal(f2.ocupados, 4); assert.equal(f2.miembros.filter((m) => m.estado === 'activo').length, 4);
});

test('T05 · Control Maestro solo consulta: sin formulario, +, ⋮, Agregar, Mover, Desvincular, Eliminar ni «Relación con Sublichat»', () => {
  const cm = R('control-maestro-spotify.js').replace(/\/\*[\s\S]*?\*\//g, ''); // sin el comentario de cabecera
  assert.doesNotMatch(cm, /<form|<button|<select|data-sp-acc|data-sp-menu|data-sp-slot|data-sp-alta|Relación con Sublichat|Correo del invitado|spotifyAgregarCorreo|spotifyEliminarCorreo|spotifyCrear|spotifyMover|spotifyDesvincular|spotifyMarcar|spotifyLiberar|prompt\(|confirm\(/);
  assert.match(cm, /accion: 'spotifyPanel'/); assert.match(cm, /Cuenta madre: /); assert.match(cm, /'Espacio libre'/);
  assert.doesNotMatch(R('control-maestro-spotify.css'), /gradient/);
  // la web operativa (Bodega › Spotify) sí tiene «Eliminar correo», solo con permiso
  const app = R('sublichat-app.js');
  assert.match(app, /\$\{j\.puedeAdministrar\?`<button class="cobro-btn" data-spf-elim=/);
  assert.match(app, /invPost\(\{accion:"spotifyEliminarCorreo",familiaId:fam\.id,correo:c\}\)/);
  assert.match(R('index.html'), /control-maestro-spotify\.css\?v=20261113-r196p/);
  const bot = new URL('../../bot-gh/lib_spotify_familias.js', import.meta.url);
  if (fs.existsSync(bot)) assert.equal(fs.readFileSync(bot, 'utf8').split('\n').slice(1).join('\n'), R('api/_spotify-familias.js').split('\n').slice(1).join('\n'), 'bot = copia fiel');
});

// ---------------------------------------------------------------- T06/T10 · endpoint real con firebase-admin simulado
const db = fakeFirestore(semilla());
Object.defineProperty(admin, 'apps', { get: () => [1], configurable: true });
Object.defineProperty(admin, 'app', { value: () => ({ firestore: () => db }), configurable: true, writable: true });
Object.defineProperty(admin, 'firestore', { value: Object.assign(() => db, { FieldValue: { serverTimestamp: () => new Date().toISOString(), increment: (n) => n, delete: () => undefined, arrayUnion: (...a) => a } }), configurable: true, writable: true });
let usuario = null;
Object.defineProperty(admin, 'auth', { value: () => ({ verifyIdToken: async () => usuario }), configurable: true, writable: true });
const { default: handler } = await import('../api/inventario.js');
async function llamar(u, body) {
  usuario = u; let code = 200, out = null;
  const res = { setHeader() {}, status(c) { code = c; return this; }, json(x) { out = x; return this; }, end() { return this; } };
  await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body }, res);
  return { code, ...(out || {}) };
}
const SUB = { uid: 'u1', role: 'sublicuentas', usuario: 'sublicuentas' }, REL = { uid: 'u2', role: 'relojes', usuario: 'relojes' };

test('T06/T10 · web: Sublicuentas elimina por el servidor (lo mismo que ve Telegram); Relojes y un usuario sin módulo no pueden', async () => {
  const f = await llena(db);
  const no = await llamar(REL, { accion: 'spotifyEliminarCorreo', familiaId: f.id, correo: 'invitado1@ejemplo.test' });
  assert.equal(no.code, 403); assert.match(no.error, /Solo Sublicuentas puede eliminar correos/);
  const nadie = await llamar({ uid: 'u3', role: 'vendedor', usuario: 'cualquiera' }, { accion: 'spotifyEliminarCorreo', familiaId: f.id, correo: 'invitado1@ejemplo.test' });
  assert.equal(nadie.code, 403);
  assert.equal((await S.leerFamilia(db, f.id)).ocupados, 5, 'nada cambió');
  const si = await llamar(SUB, { accion: 'spotifyEliminarCorreo', familiaId: f.id, correo: 'invitado1@ejemplo.test' });
  assert.equal(si.ok, true, JSON.stringify(si)); assert.deepEqual([si.codigo, si.ocupados], ['SP-001', 4]);
  const otra = await llamar(SUB, { accion: 'spotifyEliminarCorreo', familiaId: f.id, correo: 'invitado1@ejemplo.test' });
  assert.equal(otra.ok, true); assert.equal(otra.yaEstaba, true); assert.equal(otra.ocupados, 4);
  // lo que lee Telegram (lista del bot = listarFamilias) y Control Maestro (spotifyPanel) da lo mismo
  const [l] = await S.listarFamilias(db); const pan = await llamar(REL, { accion: 'spotifyPanel' });
  assert.deepEqual([l.ocupados, pan.familias[0].ocupados], [4, 4]);
  assert.equal(pan.familias[0].espacios.find((e) => e.posicion === 1).estado, 'disponible');
});
