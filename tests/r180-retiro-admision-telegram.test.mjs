// R180 retiro de usuario · R181 admisión tardía · R182 Telegram para todos (servidor). Datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../api/_permisos.js');
const sala = require('../api/sala-juntas.js');
const permisos = require('../api/permisos.js');
const { crearFakeDb } = require('./helpers/fake-firestore.cjs');
const ENV = { LIVEKIT_URL: 'wss://prueba.livekit.cloud', LIVEKIT_API_KEY: 'APIprueba', LIVEKIT_API_SECRET: 'secreto-de-prueba-no-real-0123456789', TELEGRAM_CHAT_ID_SUBLICUENTAS: '100', TELEGRAM_CHAT_ID_RELOJES: '200', TELEGRAM_BOT_USERNAME: 'SublicuentasPruebaBot',
  AUTH_USERS_JSON: JSON.stringify({ sublicuentas: { role: 'admin' }, relojes: { role: 'asesor' }, geisell: { role: 'geisell_admin' }, daniela: { role: 'asesor', uid: 'uid-real-daniela' }, jimena: { role: 'asesor' } }) };
let AHORA = Date.UTC(2026, 10, 6, 20, 0);
const firebase = { revocados: [], deshab: [] };
const fakeAuth = (usuario) => () => ({ verifyIdToken: async () => ({ usuario }), revokeRefreshTokens: async (uid) => firebase.revocados.push(uid), updateUser: async (uid, o) => firebase.deshab.push([uid, o.disabled]) });
const llamar = (h, db, usuario, body) => new Promise((ok) => { const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { ok({ code: this.code, body: b }); } };
  h({ method: 'POST', headers: { authorization: 'Bearer t' }, body }, res, { auth: fakeAuth(usuario), db: () => db, env: ENV, ahora: () => AHORA, fetch: async () => ({ ok: true, status: 200 }) }); });
const S_ = (db, u, b) => { P.invalidar(); return llamar(sala, db, u, b); };
const PM = (db, u, b) => { P.invalidar(); return llamar(permisos, db, u, b); };

test('R182 · Telegram para todos: sin vínculo = sin_vinculo (no "enviado"); enlace de un solo uso al bot; Naara ve el estado', async () => {
  const db = crearFakeDb(); await db.collection('config').doc('sublichat_permisos').set({ usuarios: { daniela: { modulos: { 'sala-juntas': true } } } });
  let r = await S_(db, 'naara', { accion: 'crear', titulo: 'Junta con Daniela', fecha: '2026-11-09', hora: '10:00', agenda: 'x', participantes: ['libni', 'geisell', 'daniela'] });
  assert.equal(r.code, 200, JSON.stringify(r.body)); assert.deepEqual(r.body.envioIncompleto.sort(), ['daniela', 'geisell']);
  const av = db.todos('sala_avisos').filter((x) => x.tipo === 'invitacion');
  assert.equal(av.find((x) => x.usuario === 'libni').estado, 'pendiente'); assert.equal(av.find((x) => x.usuario === 'daniela').estado, 'sin_vinculo');
  r = await S_(db, 'daniela', { accion: 'telegram_vincular' });
  assert.match(r.body.url, /^https:\/\/t\.me\/SublicuentasPruebaBot\?start=sj_[A-Za-z0-9_-]{20,}$/);
  assert.equal(db.todos('sala_tg_tokens').length, 1); await S_(db, 'daniela', { accion: 'telegram_vincular' }); assert.equal(db.todos('sala_tg_tokens').length, 1, 'un enlace vivo por persona');
  r = await S_(db, 'naara', { accion: 'panel' });
  assert.equal(r.body.telegram.libni.estado, 'listo'); assert.equal(r.body.telegram.daniela.estado, 'pendiente'); assert.equal(r.body.telegram.geisell.estado, 'sin_vincular');
  const reu = r.body.reuniones[0]; assert.equal(reu.avisos.porUsuario.daniela.estado, 'sin_vinculo');
  // el bot la vinculó → reintentar reactiva
  await db.collection('sala_telegram').doc('daniela').set({ usuario: 'daniela', chatId: '555', estado: 'listo' });
  r = await S_(db, 'naara', { accion: 'reintentar_avisos', id: reu.id }); assert.equal(r.body.reactivados >= 1, true); assert.deepEqual(r.body.faltan, ['geisell']);
});

test('R181 · admisión tardía: después del inicio no hay token sin aprobación; solo Sublicuentas aprueba; vence a los 2 min; expulsado no vuelve', async () => {
  const db = crearFakeDb(); AHORA = Date.UTC(2026, 10, 6, 20, 0);
  let r = await S_(db, 'naara', { accion: 'crear', titulo: 'Junta en curso', fecha: '2026-11-06', hora: '14:05', agenda: 'x', participantes: ['libni', 'geisell'] });
  const id = r.body.id;
  AHORA += 3 * 60000; // 14:03, antes de la hora: Geisell espera a tiempo
  r = await S_(db, 'geisell', { accion: 'token_tiempo_real', id }); assert.equal(r.code, 409);
  AHORA += 4 * 60000; // 14:07: Naara abre (ya empezó)
  r = await S_(db, 'naara', { accion: 'token_tiempo_real', id }); assert.ok(r.body.token);
  r = await S_(db, 'geisell', { accion: 'token_tiempo_real', id }); assert.ok(r.body.token, 'esperó a tiempo: entra directo');
  r = await S_(db, 'libni', { accion: 'token_tiempo_real', id }); assert.equal(r.body.espera, true); assert.ok(!r.body.token, 'tarde: sin token');
  r = await S_(db, 'libni', { accion: 'solicitar_ingreso', id }); const req = r.body.solicitud.requestId; assert.ok(req);
  r = await S_(db, 'libni', { accion: 'solicitar_ingreso', id }); assert.equal(r.body.solicitud.requestId, req, 'recargar no duplica');
  assert.ok(db.todos('sala_avisos').some((a) => a.tipo === 'solicitud' && a.usuario === 'naara'), 'aviso a Naara por Telegram');
  r = await S_(db, 'geisell', { accion: 'resolver_solicitud', id, usuario: 'libni', requestId: req, aprobar: true }); assert.equal(r.code, 403, 'otra persona no aprueba');
  r = await S_(db, 'naara', { accion: 'solicitudes', id }); assert.equal(r.body.solicitudes.length, 1);
  r = await S_(db, 'naara', { accion: 'resolver_solicitud', id, usuario: 'libni', requestId: req, aprobar: true }); assert.equal(r.body.estado, 'aprobada');
  r = await S_(db, 'libni', { accion: 'token_tiempo_real', id }); assert.ok(r.body.token, 'aprobada: token');
  r = await S_(db, 'libni', { accion: 'token_tiempo_real', id }); assert.ok(r.body.token, 'reconexión en la misma sesión');
  // expulsar → no vuelve sin nueva aprobación ni puede pedir de nuevo en esta sesión
  r = await S_(db, 'naara', { accion: 'expulsar', id, usuario: 'libni' }); assert.equal(r.code, 200);
  r = await S_(db, 'libni', { accion: 'token_tiempo_real', id }); assert.equal(r.body.espera, true); assert.equal(r.body.solicitud.estado, 'expulsado');
  r = await S_(db, 'libni', { accion: 'solicitar_ingreso', id }); assert.equal(r.code, 403);
  // vencimiento de 2 minutos y rechazo
  await db.collection('sala_solicitudes').doc(`${id}_geisell`).set({ estado: 'expulsado', sesion: 'otra' }, { merge: true });
  r = await S_(db, 'geisell', { accion: 'solicitar_ingreso', id }); const req2 = r.body.solicitud.requestId;
  AHORA += 3 * 60000;
  r = await S_(db, 'geisell', { accion: 'solicitud_estado', id }); assert.equal(r.body.solicitud.estado, 'vencida');
  r = await S_(db, 'naara', { accion: 'resolver_solicitud', id, usuario: 'geisell', requestId: req2, aprobar: true }); assert.equal(r.code, 409);
  r = await S_(db, 'geisell', { accion: 'solicitar_ingreso', id }); const req3 = r.body.solicitud.requestId; assert.notEqual(req3, req2, 'nueva solicitud = nuevo evento');
  r = await S_(db, 'naara', { accion: 'resolver_solicitud', id, usuario: 'geisell', requestId: req3, aprobar: false });
  r = await S_(db, 'geisell', { accion: 'token_tiempo_real', id }); assert.equal(r.body.espera, true); assert.equal(r.body.solicitud.estado, 'rechazada');
});

test('R180 · retiro: por UID, sin acceso en Sala/Permisos/menú, sale de convocatorias futuras, sin avisos ni Telegram; historial intacto', async () => {
  const db = crearFakeDb(); AHORA = Date.UTC(2026, 10, 6, 20, 0); firebase.revocados = []; firebase.deshab = [];
  await db.collection('config').doc('sublichat_permisos').set({ usuarios: { daniela: { modulos: { 'sala-juntas': true } } } });
  await db.collection('ventas').doc('v1').set({ vendedor: 'daniela', monto: 300 }); // dato de negocio: no se toca
  let r = await S_(db, 'naara', { accion: 'crear', titulo: 'Futura', fecha: '2026-11-09', hora: '10:00', agenda: 'x', participantes: ['libni', 'daniela'] }); const fut = r.body.id;
  await db.collection('sala_reuniones').doc('pasada1').set({ titulo: 'Pasada', estado: 'finalizada', participantes: ['naara', 'daniela'], inicioMs: AHORA - 86400000, duracionMin: 30 });
  await db.collection('sala_telegram').doc('daniela').set({ usuario: 'daniela', chatId: '555', estado: 'listo' });
  r = await PM(db, 'relojes', { accion: 'retirar', usuario: 'daniela', confirmar: 'daniela' }); assert.equal(r.code, 403, 'solo Sublicuentas');
  r = await PM(db, 'sublicuentas', { accion: 'retirar', usuario: 'daniela', confirmar: 'otra' }); assert.equal(r.code, 400, 'confirmación exacta');
  r = await PM(db, 'sublicuentas', { accion: 'retirar', usuario: 'sublicuentas', confirmar: 'sublicuentas' }); assert.equal(r.code, 400);
  r = await PM(db, 'sublicuentas', { accion: 'retirar', usuario: 'daniela', confirmar: 'daniela' });
  assert.equal(r.code, 200, JSON.stringify(r.body)); assert.equal(r.body.informe.uid, 'uid-real-daniela'); assert.deepEqual(firebase.revocados, ['uid-real-daniela']); assert.deepEqual(firebase.deshab, [['uid-real-daniela', true]]);
  assert.equal(r.body.informe.sala.reuniones, 1);
  const f = db.todos('sala_reuniones').find((x) => x.titulo === 'Futura'); assert.deepEqual(f.participantes, ['naara', 'libni']);
  assert.deepEqual(db.todos('sala_reuniones').find((x) => x.titulo === 'Pasada').participantes, ['naara', 'daniela'], 'historial intacto');
  assert.ok(db.todos('sala_avisos').filter((a) => a.usuario === 'daniela').every((a) => a.estado === 'anulado'));
  assert.equal(db.todos('sala_telegram').length, 0); assert.equal(db.todos('ventas').length, 1, 'ventas intactas');
  assert.equal((await S_(db, 'daniela', { accion: 'panel' })).code, 403);
  r = await S_(db, 'naara', { accion: 'panel' }); assert.ok(!r.body.fundadoras.some((x) => x.id === 'daniela'), 'no aparece en el selector');
  r = await PM(db, 'daniela', { accion: 'mis_permisos' }); assert.equal(r.body.retirado, true); assert.deepEqual(r.body.pantallas, []);
  r = await PM(db, 'sublicuentas', { accion: 'listar' }); assert.ok(!r.body.usuarios.some((u) => u.usuario === 'daniela')); assert.equal(r.body.retirados[0].usuario, 'daniela');
  r = await PM(db, 'sublicuentas', { accion: 'guardar', usuario: 'jimena', modulos: { 'sala-juntas': true } }); assert.equal(r.code, 200);
  const cfg = db.todos('config').find((x) => x.retirados); assert.ok(cfg.retirados.daniela, 'guardar no borra la lista de retirados');
  r = await S_(db, 'naara', { accion: 'crear', titulo: 'Otra', fecha: '2026-11-10', hora: '10:00', agenda: 'x', participantes: ['libni', 'daniela'] });
  assert.deepEqual(db.todos('sala_reuniones').find((x) => x.titulo === 'Otra').participantes, ['naara', 'libni'], 'no se puede volver a invitar');
  r = await PM(db, 'sublicuentas', { accion: 'reactivar', usuario: 'daniela' }); assert.equal(r.code, 200);
  r = await PM(db, 'daniela', { accion: 'mis_permisos' }); assert.equal(r.body.retirado, false);
});
