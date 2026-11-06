// R170 · SubliStudio Fase 4: token de LiveKit firmado en el servidor, solo para invitadas, en su ventana de tiempo; moderación vía API.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../api/_sala-juntas.js');
const handler = require('../api/sala-juntas.js');
const { crearFakeDb } = require('./helpers/fake-firestore.cjs');

const SECRETO = 'secreto-de-prueba-no-real-0123456789';
const ENV = { LIVEKIT_URL: 'wss://prueba.livekit.cloud', LIVEKIT_API_KEY: 'APIprueba', LIVEKIT_API_SECRET: SECRETO };
let AHORA = Date.UTC(2026, 10, 5, 17, 0);
const llamadas = [];
const fakeFetch = async (url, op) => { llamadas.push({ url, op }); return { ok: true, status: 200, json: async () => ({}) }; };
function llamar(db, usuario, body, env = ENV) {
  return new Promise((resolve) => {
    const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body }, res,
      { auth: () => ({ verifyIdToken: async () => ({ uid: 'a-' + usuario, usuario, role: 'admin' }) }), db: () => db, env, ahora: () => AHORA, fetch: fakeFetch });
  });
}
function verificar(jwt, secreto = SECRETO) {
  const [h, p, f] = jwt.split('.');
  const esperada = crypto.createHmac('sha256', secreto).update(`${h}.${p}`).digest('base64url');
  assert.equal(f, esperada, 'firma HS256 válida');
  return JSON.parse(Buffer.from(p, 'base64url').toString());
}
async function reunion(db, participantes = ['naara', 'libni']) {
  const r = await llamar(db, 'naara', { accion: 'crear', titulo: 'Junta', fecha: '2026-11-05', hora: '12:00', agenda: 'x', participantes, duracionMin: 60 });
  assert.equal(r.code, 200, JSON.stringify(r.body)); return r.body.id;
}

test('JWT HS256: firma, emisor, sala, identidad y permisos mínimos', () => {
  const t = S.tokenParticipante({ apiKey: 'K', apiSecret: SECRETO, identidad: 'libni', nombre: 'Libni', sala: 'sj_abc', ttlSeg: 600, anfitriona: false, ahora: AHORA });
  const c = verificar(t);
  assert.equal(c.iss, 'K'); assert.equal(c.sub, 'libni'); assert.equal(c.video.room, 'sj_abc');
  assert.equal(c.video.roomJoin, true); assert.equal(c.video.roomAdmin, false); assert.equal(c.video.roomCreate, undefined);
  assert.equal(c.exp - c.iat, 600);
  assert.equal(verificar(S.tokenParticipante({ apiKey: 'K', apiSecret: SECRETO, identidad: 'naara', nombre: 'Naara', sala: 's', ttlSeg: 60, anfitriona: true, ahora: AHORA })).video.roomAdmin, true);
  assert.equal(S.httpDeLiveKit('wss://x.livekit.cloud/'), 'https://x.livekit.cloud');
});

test('token: sin LiveKit configurado → 503; no invitada → 403; antes de tiempo → 409', async () => {
  AHORA = Date.UTC(2026, 10, 5, 17, 0); // 11:00 HN, la junta es 12:00
  const db = crearFakeDb(); const id = await reunion(db);
  assert.equal((await llamar(db, 'libni', { accion: 'token_tiempo_real', id }, {})).code, 503);
  assert.equal((await llamar(db, 'geisell', { accion: 'token_tiempo_real', id })).code, 403);
  assert.equal((await llamar(db, 'prueba', { accion: 'token_tiempo_real', id })).code, 403);
  const r = await llamar(db, 'libni', { accion: 'token_tiempo_real', id });
  assert.equal(r.code, 409); assert.match(r.body.error, /30 minutos/);
});

test('token: Libni espera a la anfitriona; Naara entra y abre; luego Libni recibe su token', async () => {
  AHORA = Date.UTC(2026, 10, 5, 17, 0); const db = crearFakeDb(); const id = await reunion(db);
  AHORA = Date.UTC(2026, 10, 5, 17, 50); // 11:50 HN
  let r = await llamar(db, 'libni', { accion: 'token_tiempo_real', id });
  assert.equal(r.code, 409); assert.match(r.body.error, /anfitriona/);
  r = await llamar(db, 'naara', { accion: 'token_tiempo_real', id });
  assert.equal(r.code, 200); assert.equal(r.body.url, ENV.LIVEKIT_URL);
  const cn = verificar(r.body.token); assert.equal(cn.sub, 'naara'); assert.equal(cn.video.roomAdmin, true);
  assert.ok(!JSON.stringify(r.body).includes(SECRETO), 'el secreto nunca sale');
  r = await llamar(db, 'libni', { accion: 'token_tiempo_real', id });
  assert.equal(r.code, 200);
  const c = verificar(r.body.token); assert.equal(c.sub, 'libni'); assert.equal(c.video.roomAdmin, false);
  assert.equal(c.video.room, cn.video.room); assert.match(c.video.room, /^sj_/);
  assert.ok(c.exp - c.iat <= 2 * 3600);
  assert.ok(db.todos('auditoria_eventos').some((x) => x.accion === 'entrar_sala' && x.actorUsuario === 'libni'));
});

test('token: cancelada o fuera de tiempo → 409', async () => {
  AHORA = Date.UTC(2026, 10, 5, 17, 0); const db = crearFakeDb(); const id = await reunion(db);
  AHORA = Date.UTC(2026, 10, 5, 20, 30); // 14:30 HN: 1h30 después del final previsto
  assert.equal((await llamar(db, 'naara', { accion: 'token_tiempo_real', id })).code, 409);
  AHORA = Date.UTC(2026, 10, 5, 17, 0); const id2 = await reunion(db);
  await llamar(db, 'naara', { accion: 'cancelar', id: id2 });
  assert.equal((await llamar(db, 'naara', { accion: 'token_tiempo_real', id: id2 })).code, 409);
});

test('moderar: solo Naara expulsa; cerrar la sala termina la llamada en LiveKit', async () => {
  AHORA = Date.UTC(2026, 10, 5, 17, 0); const db = crearFakeDb(); const id = await reunion(db);
  AHORA = Date.UTC(2026, 10, 5, 18, 5);
  await llamar(db, 'naara', { accion: 'token_tiempo_real', id });
  assert.equal((await llamar(db, 'libni', { accion: 'expulsar', id, usuario: 'naara' })).code, 403);
  llamadas.length = 0;
  assert.equal((await llamar(db, 'naara', { accion: 'expulsar', id, usuario: 'libni' })).code, 200);
  assert.match(llamadas[0].url, /^https:\/\/prueba\.livekit\.cloud\/twirp\/livekit\.RoomService\/RemoveParticipant$/);
  const cab = llamadas[0].op.headers.Authorization.slice(7); const c = verificar(cab);
  assert.equal(c.video.roomAdmin, true); assert.ok(c.exp - c.iat <= 120);
  assert.deepEqual(JSON.parse(llamadas[0].op.body).identity, 'libni');
  llamadas.length = 0;
  assert.equal((await llamar(db, 'naara', { accion: 'cerrar_sala', id })).code, 200);
  assert.match(llamadas[0].url, /DeleteRoom$/);
});
