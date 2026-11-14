// R196o · PDF «Spotify Familiar · corrección estricta» (12/11/2026). Firestore en memoria con transacciones; datos ficticios.
// Lógica común (la misma que usan Web, APK y bot) + el endpoint REAL /api/inventario con firebase-admin simulado (permisos T11).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import admin from 'firebase-admin';
import { createRequire } from 'node:module';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
const require = createRequire(import.meta.url);
const S = require('../api/_spotify-familias.js');
const R = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

const semilla = () => ({ clientes: {
  jony: { nombre: 'Jony Prueba', servicios: [{ compraId: 'sp-jony', plataforma: 'spotify', correo: 'invitado1@ejemplo.test', fechaRenovacion: '20/12/2026', precio: 90 }, { compraId: 'nf-jony', plataforma: 'netflix', correo: 'nf@ejemplo.test', precio: 150 }] },
  olvin: { nombre: 'Olvin Prueba', servicios: [{ compraId: 'sp-olvin', plataforma: 'spotify', correo: 'invitado2@ejemplo.test', fechaRenovacion: '20/12/2026', precio: 90 }, { compraId: 'dp-olvin', plataforma: 'disney', correo: 'dp@ejemplo.test', precio: 120 }] },
  karla: { nombre: 'Karla Prueba', servicios: [{ compraId: 'sp-karla', plataforma: 'spotify', correo: 'invitado3@ejemplo.test', fechaRenovacion: '20/12/2026' }] },
  dereck: { nombre: 'Dereck Prueba', servicios: [{ compraId: 'sp-dereck', plataforma: 'spotify', correo: 'invitado4@ejemplo.test', fechaRenovacion: '20/12/2026' }] },
  caro: { nombre: 'Caro Prueba', servicios: [{ compraId: 'sp-caro', plataforma: 'spotify', correo: 'doble@ejemplo.test' }] },
  dani: { nombre: 'Dani Prueba', servicios: [{ compraId: 'sp-dani', plataforma: 'spotify', correo: 'doble@ejemplo.test' }] },
} });
async function con4(db) { // SP-001 con 4/5 invitados reales
  const f = await S.crearFamilia(db, { madreCorreo: 'madre1@ejemplo.test', usuario: 'sublicuentas' });
  for (const [id, n] of [['jony', 1], ['olvin', 2], ['karla', 3], ['dereck', 4]]) await S.vincularInvitado(db, { familiaId: f.id, correo: `invitado${n}@ejemplo.test`, clienteId: id, compraId: `sp-${id}` });
  return f;
}

test('T01 · una madre con 4/5 conserva sus 4 correos y fichas (no se reinicia nada)', async () => {
  const db = fakeFirestore(semilla()); const f = await con4(db);
  const antes = JSON.stringify((await db.collection('spotify_familias').doc(f.id).get()).data().miembros);
  const [p] = await S.panelFamilias(db, { hoy: '2026-11-12' });
  assert.deepEqual([p.ocupados, p.libres], [4, 1]);
  assert.deepEqual(p.espacios.slice(0, 4).map((e) => [e.correo, e.cliente]), [['invitado1@ejemplo.test', 'Jony Prueba'], ['invitado2@ejemplo.test', 'Olvin Prueba'], ['invitado3@ejemplo.test', 'Karla Prueba'], ['invitado4@ejemplo.test', 'Dereck Prueba']]);
  await S.sincronizarTodo(db); await S.panelFamilias(db, {}); await S.listarFamilias(db);
  assert.equal(JSON.stringify((await db.collection('spotify_familias').doc(f.id).get()).data().miembros), antes, 'leer y sincronizar no cambia membresías');
});

test('T03/T04/T05 · un correo una vez → 5/5; 6.º y duplicado en otra madre se rechazan sin escrituras parciales; varias fichas → sin lista', async () => {
  const db = fakeFirestore(semilla()); const f = await con4(db);
  const g = await S.crearFamilia(db, { madreCorreo: 'madre2@ejemplo.test' });
  const amb = await S.agregarPorCorreo(db, { familiaId: f.id, correo: ' Doble@Ejemplo.test ' });
  assert.equal(amb.requiereElegir, undefined, 'ya no pide elegir de una lista');
  assert.deepEqual([amb.familia.ocupados, amb.pendienteVincular, amb.varias], [5, true, 2]);
  assert.match(amb.aviso, /Hay 2 fichas con ese correo: se vincula sola/);
  const snap = async () => JSON.stringify([...db._data.entries()].filter(([k]) => /^spotify_/.test(k) || /^clientes\//.test(k)));
  const antes = await snap();
  await assert.rejects(S.agregarPorCorreo(db, { familiaId: f.id, correo: 'sexto@ejemplo.test' }), /SP-001 está llena \(5 de 5\): no se agregó nada/);
  await assert.rejects(S.agregarPorCorreo(db, { familiaId: g.id, correo: 'invitado1@ejemplo.test' }), /Ese correo ya está como invitado en SP-001\. Un correo solo puede estar en una cuenta\./);
  await assert.rejects(S.agregarPorCorreo(db, { familiaId: g.id, correo: 'madre1@ejemplo.test' }), /correo madre de SP-001/);
  await assert.rejects(S.agregarPorCorreo(db, { familiaId: g.id, correo: 'no-es-correo' }), /correo válido/);
  await assert.rejects(S.crearFamilia(db, { madreCorreo: 'madre1@ejemplo.test' }), /ya es madre/);
  assert.equal(await snap(), antes, 'nada cambió');
  // la ficha correcta se vincula sola al guardarse/renovarse
  await S.asignarServicio(db, { correo: 'doble@ejemplo.test', clienteId: 'dani', compraId: 'sp-dani' });
  const m = (await S.leerFamilia(db, f.id)).miembros.find((x) => x.correo === 'doble@ejemplo.test');
  assert.deepEqual([m.clienteId, m.compraId], ['dani', 'sp-dani']);
});

test('T06 · «No renovó» libera SOLO ese correo (5/5 → 4/5), cierra la relación y deja «Falta quitar en Spotify»; historial intacto', async () => {
  const db = fakeFirestore(semilla()); const f = await con4(db);
  await S.agregarPorCorreo(db, { familiaId: f.id, correo: 'quinto@ejemplo.test' });
  const r = await S.retirarPorBaja(db, { correo: 'INVITADO2@ejemplo.test', clienteId: 'olvin', compraId: 'sp-olvin', motivo: 'no_renovo', usuario: 'sublicuentas' });
  assert.deepEqual([r.estado, r.codigo, r.ocupados, r.capacidad, r.retiroExternoPendiente], ['liberado', 'SP-001', 4, 5, true]);
  const [p] = await S.panelFamilias(db, { hoy: '2026-11-12' });
  assert.deepEqual([p.ocupados, p.libres, p.espacios[1].estado], [4, 1, 'disponible']);
  assert.deepEqual(p.espacios.filter((e) => e.correo).map((e) => e.correo), ['invitado1@ejemplo.test', 'invitado3@ejemplo.test', 'invitado4@ejemplo.test', 'quinto@ejemplo.test'], 'los demás no se mueven');
  assert.deepEqual(p.pendientesSpotify.map((x) => [x.correo, x.motivo]), [['invitado2@ejemplo.test', 'no_renovo']]);
  assert.equal(await S.resolverCorreo(db, 'invitado2@ejemplo.test'), null);
  const raw = (await db.collection('spotify_familias').doc(f.id).get()).data();
  assert.equal(raw.miembros.filter((m) => m.correo === 'invitado2@ejemplo.test')[0].desvinculadoMotivo, 'no_renovo', 'queda en el historial');
  assert.equal((await db.collection('inventario').doc(S.idBodega(f.id)).get()).data().ocupados, 4, 'Bodega con el mismo número');
  assert.ok((await db.collection('auditoria_eventos').get()).docs.some((d) => d.data().accion === 'liberado_por_baja'));
  assert.ok((await db.collection('clientes').doc('olvin').get()).exists, 'el cliente no se borra');
  // idempotente, no toca otra ficha, y confirmar en Spotify solo borra la nota
  assert.equal((await S.retirarPorBaja(db, { correo: 'invitado2@ejemplo.test', clienteId: 'olvin', compraId: 'sp-olvin' })).yaEstaba, true);
  assert.equal((await S.retirarPorBaja(db, { correo: 'invitado3@ejemplo.test', clienteId: 'otra', compraId: 'x' })).omitido, 'otra_ficha');
  await S.confirmarRetiroExterno(db, { familiaId: f.id, correo: 'invitado2@ejemplo.test', usuario: 'sublicuentas' });
  const f2 = await S.leerFamilia(db, f.id);
  assert.deepEqual([f2.pendientesSpotify.length, f2.ocupados], [0, 4]);
  // la madre no se borra; el espacio libre se reutiliza con el alta simple
  await S.agregarPorCorreo(db, { familiaId: f.id, correo: 'nuevo@ejemplo.test' });
  assert.equal((await S.leerFamilia(db, f.id)).ocupados, 5);
});

test('T07 · renovar no pide madre, no mueve ni duplica; T08 · la ficha queda con su madre real', async () => {
  const db = fakeFirestore(semilla()); const f = await con4(db);
  const antes = (await S.leerFamilia(db, f.id)).miembros.find((m) => m.correo === 'invitado1@ejemplo.test');
  for (let i = 0; i < 2; i++) await S.asignarServicio(db, { correo: 'invitado1@ejemplo.test', clienteId: 'jony', compraId: 'sp-jony' });
  const fam = await S.leerFamilia(db, f.id);
  assert.equal(fam.miembros.filter((m) => m.correo === 'invitado1@ejemplo.test').length, 1);
  assert.equal(fam.miembros.find((m) => m.correo === 'invitado1@ejemplo.test').posicion, antes.posicion);
  assert.equal(fam.ocupados, 4);
  const sv = (await db.collection('clientes').doc('jony').get()).data().servicios[0];
  assert.deepEqual([sv.spotifyFamiliaCodigo, sv.spotifyMadreCorreo, sv.fechaRenovacion, sv.precio], ['SP-001', 'madre1@ejemplo.test', '20/12/2026', 90]);
  const r = await S.resolverCorreo(db, 'invitado1@ejemplo.test');
  assert.deepEqual([r.codigo, r.madreCorreo], ['SP-001', 'madre1@ejemplo.test']);
  // correo que no está en ninguna madre: no se inventa una
  assert.deepEqual(await S.asignarServicio(db, { correo: 'suelto@ejemplo.test', clienteId: 'x', compraId: 'y' }), { familia: null, requiereSeleccion: true });
  // las 3 pantallas de cliente muestran la madre leída del servidor
  assert.match(R('sublichat-app.js'), /Familia <b>\$\{clienteEsc\(f\.codigo\)\}<\/b> · Madre: <b>\$\{clienteEsc\(f\.madreCorreo\)\}/);
});

test('T09/T10 · sin Mover, Desvincular ni listas de fichas en Web y Control Maestro; todo pasa por las mismas acciones del servidor', () => {
  const cm = R('control-maestro-spotify.js'), app = R('sublichat-app.js');
  // R196p · Control Maestro pasó a SOLO CONSULTA (sin acciones): ver r196p-spotify-cm-consulta. Aquí solo la web operativa.
  assert.doesNotMatch(cm, /spotifyMover|spotifyDesvincular|data-sp-acc|spotifyAgregarCorreo/);
  for (const [n, s] of [['sublichat-app.js (Spotify)', app.slice(app.indexOf('async function invSpotifyFamilias'), app.indexOf('async function invCargarPlanesTv'))]]) {
    assert.doesNotMatch(s, /spotifyMover|spotifyDesvincular|Mover a|>Desvincular<|data-spd=|data-sp-elegir|requiereElegir|elegirFicha|spotifyBuscar/, n);
    assert.match(s, /spotifyAgregarCorreo/, n);
  }
  assert.match(app, /\$\{j\.puedeAdministrar\?`<div class="iv-row"/);
  assert.match(app, /espacio liberado \(\$\{r\.ocupados\}\/\$\{r\.capacidad\|\|5\}\)/);
  const html = R('index.html');
  assert.match(html, /control-maestro-spotify\.js\?v=20261113-r196p/); assert.match(html, /sublichat-app\.js\?v=20261113-r196p/);
  // la baja sigue usando la misma función del servidor en Web/APK (renovar.js) y en el bot (copia fiel)
  assert.match(R('api/renovar.js'), /spotifyFam\.retirarPorBaja\(db, \{ correo: correoBaja/);
  const bot = new URL('../../bot-gh/lib_spotify_familias.js', import.meta.url);
  if (fs.existsSync(bot)) assert.equal(fs.readFileSync(bot, 'utf8').split('\n').slice(1).join('\n'), R('api/_spotify-familias.js').split('\n').slice(1).join('\n'));
});

// ---------------------------------------------------------------- T11 · endpoint real con firebase-admin simulado
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

test('T11 · solo Sublicuentas crea madre aunque se llame al endpoint; Mover/Desvincular cerrados para todos', async () => {
  const no = await llamar(REL, { accion: 'spotifyCrear', madreCorreo: 'intruso@ejemplo.test' });
  assert.equal(no.code, 403); assert.match(no.error, /Solo Sublicuentas puede crear cuentas madre/);
  assert.equal((await S.listarFamilias(db)).length, 0, 'no se creó nada');
  const si = await llamar(SUB, { accion: 'spotifyCrear', madreCorreo: 'madre1@ejemplo.test' });
  assert.equal(si.ok, true, JSON.stringify(si)); assert.equal(si.familia.codigo, 'SP-001');
  const pRel = await llamar(REL, { accion: 'spotifyPanel' }), pSub = await llamar(SUB, { accion: 'spotifyPanel' });
  assert.deepEqual([pRel.ok, pRel.puedeAdministrar, pSub.puedeAdministrar], [true, false, true]);
  // Relojes sí agrega correos dentro de la madre
  const a = await llamar(REL, { accion: 'spotifyAgregarCorreo', familiaId: si.familia.id, correo: 'invitado1@ejemplo.test' });
  assert.equal(a.ok, true, JSON.stringify(a)); assert.equal(a.familia.ocupados, 1);
  for (const acc of ['spotifyMover', 'spotifyDesvincular']) for (const u of [SUB, REL]) {
    const r = await llamar(u, { accion: acc, correo: 'invitado1@ejemplo.test', destinoId: 'x' });
    assert.equal(r.code, 410); assert.match(r.error, /Ya no se usa/);
  }
  // marca manual de retiro + liberar (= desvincular a mano) tampoco
  await llamar(SUB, { accion: 'spotifyMarcar', correo: 'invitado1@ejemplo.test', retiroPendiente: true });
  const lib = await llamar(SUB, { accion: 'spotifyLiberar', correo: 'invitado1@ejemplo.test', confirmoRetiro: true });
  assert.equal(lib.ok, false); assert.match(lib.error, /se liberan solos con «No renovó»/);
  assert.equal((await S.leerFamilia(db, si.familia.id)).ocupados, 1);
  // un usuario sin el módulo no entra
  const nadie = await llamar({ uid: 'u3', role: 'vendedor', usuario: 'cualquiera' }, { accion: 'spotifyPanel' });
  assert.equal(nadie.code, 403);
});

test('T12 · regresión: Netflix y Disney de la misma ficha intactos tras alta y «No renovó» de Spotify', async () => {
  const d2 = fakeFirestore(semilla()); const f = await con4(d2);
  await S.retirarPorBaja(d2, { correo: 'invitado2@ejemplo.test', clienteId: 'olvin', compraId: 'sp-olvin', motivo: 'no_renovo' });
  const s0 = semilla().clientes;
  assert.deepEqual((await d2.collection('clientes').doc('olvin').get()).data().servicios.find((s) => s.plataforma === 'disney'), s0.olvin.servicios[1]);
  assert.deepEqual((await d2.collection('clientes').doc('jony').get()).data().servicios.find((s) => s.plataforma === 'netflix'), s0.jony.servicios[1]);
  assert.equal((await d2.collection('inventario').get()).docs.filter((x) => x.data().plataforma !== 'spotifyfamiliar').length, 0, 'no toca otras plataformas en Bodega');
  assert.equal((await S.leerFamilia(d2, f.id)).ocupados, 3);
});
