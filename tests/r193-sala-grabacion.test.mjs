// R193 · Grabación COMPLETA en el servidor (LiveKit Egress + plantilla 3D propia). Datos y claves ficticias.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const G = require('../api/_sala-grabacion.js');
const handler = require('../api/sala-juntas.js');
const { crearFakeDb } = require('./helpers/fake-firestore.cjs');

const SECRETO = 'secreto-de-prueba-no-real-0123456789';
const CRED = JSON.stringify({ project_id: 'demo', client_email: 'grabador@demo.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nFICTICIA\n-----END PRIVATE KEY-----\n' });
const ENV = { LIVEKIT_URL: 'wss://prueba.livekit.cloud', LIVEKIT_API_KEY: 'APIprueba', LIVEKIT_API_SECRET: SECRETO, SALA_GRAB_BUCKET: 'sala-grabaciones-demo', SALA_GRAB_GCP_CREDENTIALS: CRED, SALA_PUBLIC_BASE: 'https://sublichat.ejemplo.lat' };
let AHORA = Date.UTC(2026, 10, 5, 17, 0);
let llamadas = []; let respuestaEgress = { egressId: 'EG_demo1', status: 'EGRESS_STARTING' };
const fakeFetch = async (url, op) => { llamadas.push({ url, op, body: JSON.parse(op.body || '{}') }); return { ok: true, status: 200, json: async () => (/ListEgress/.test(url) ? { items: [respuestaEgress] } : respuestaEgress) }; };
const firmas = [];
function llamar(db, usuario, body, env = ENV, sinSesion = false) {
  return new Promise((resolve) => {
    const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    handler({ method: 'POST', headers: sinSesion ? {} : { authorization: 'Bearer t' }, body }, res,
      { auth: () => ({ verifyIdToken: async () => ({ uid: 'a-' + usuario, usuario, role: 'admin' }) }), db: () => db, env, ahora: () => AHORA, fetch: fakeFetch,
        firmar: async (_env, key, o) => { firmas.push({ key, o }); return `https://storage.googleapis.com/${ENV.SALA_GRAB_BUCKET}/${key}?X-Goog-Signature=ficticia`; } });
  });
}
async function reunionEnCurso(db) {
  AHORA = Date.UTC(2026, 10, 5, 17, 0);
  const r = await llamar(db, 'naara', { accion: 'crear', titulo: 'Junta semanal', fecha: '2026-11-05', hora: '12:00', agenda: 'x', participantes: ['naara', 'libni'], duracionMin: 60 });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  AHORA = Date.UTC(2026, 10, 5, 18, 5); // 12:05 HN
  assert.equal((await llamar(db, 'naara', { accion: 'token_tiempo_real', id: r.body.id })).code, 200); // la anfitriona abre la sala
  return r.body.id;
}

test('configuración: dice QUÉ variable falta (nunca valores); panel avisa si la grabación en servidor está lista', async () => {
  assert.deepEqual(G.configGrabacion({}).faltan.slice(0, 3), ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET']);
  assert.equal(G.configGrabacion(ENV).ok, true);
  assert.match(G.configGrabacion({ ...ENV, SALA_GRAB_GCP_CREDENTIALS: '{x' }).faltan.join(), /JSON inválido/);
  assert.match(G.configGrabacion({ ...ENV, SALA_PUBLIC_BASE: 'http://x' }).faltan.join(), /https/);
  const db = crearFakeDb(); await reunionEnCurso(db);
  const p = await llamar(db, 'libni', { accion: 'panel' });
  assert.equal(p.body.grabacionServidor, true);
  assert.doesNotMatch(JSON.stringify(p.body), /FICTICIA|grabador@|sala-grabaciones-demo/);
  const sin = await llamar(db, 'libni', { accion: 'panel' }, { ...ENV, SALA_GRAB_BUCKET: '' });
  assert.equal(sin.body.grabacionServidor, false);
});

test('J08: solo la anfitriona inicia; exige aviso aceptado; Egress compone la sala 3D (plantilla propia) a MP4 privado', async () => {
  const db = crearFakeDb(); const id = await reunionEnCurso(db); llamadas = [];
  assert.equal((await llamar(db, 'libni', { accion: 'grabacion_servidor', op: 'iniciar', id, consentimiento: true })).code, 403);
  assert.equal((await llamar(db, 'naara', { accion: 'grabacion_servidor', op: 'iniciar', id })).code, 400, 'sin aviso no graba');
  const sinCfg = await llamar(db, 'naara', { accion: 'grabacion_servidor', op: 'iniciar', id, consentimiento: true }, { ...ENV, SALA_GRAB_BUCKET: '' });
  assert.equal(sinCfg.code, 503); assert.match(sinCfg.body.error, /SALA_GRAB_BUCKET/);
  const r = await llamar(db, 'naara', { accion: 'grabacion_servidor', op: 'iniciar', id, consentimiento: true, presentes: ['naara', 'libni', 'intrusa'] });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  const gid = r.body.grabacion.id; assert.ok(G.idValido(gid));
  assert.deepEqual(r.body.grabacion.presentes, ['naara', 'libni']);
  const c = llamadas.find((x) => /StartRoomCompositeEgress/.test(x.url));
  assert.equal(c.url, 'https://prueba.livekit.cloud/twirp/livekit.Egress/StartRoomCompositeEgress');
  assert.equal(c.body.customBaseUrl, 'https://sublichat.ejemplo.lat/sala-grabacion.html');
  assert.equal(c.body.layout, gid); assert.equal(c.body.fileOutputs[0].fileType, 'MP4');
  assert.equal(c.body.fileOutputs[0].gcp.bucket, 'sala-grabaciones-demo');
  assert.equal(c.body.fileOutputs[0].filepath, `sala-juntas/${id}/${gid}.mp4`);
  const [, p] = c.op.headers.Authorization.slice(7).split('.'); const claims = JSON.parse(Buffer.from(p, 'base64url'));
  assert.equal(claims.video.roomRecord, true); assert.equal(claims.video.room, c.body.roomName); assert.match(c.body.roomName, /^sj_/); assert.ok(claims.exp - claims.iat <= 120);
  assert.doesNotMatch(JSON.stringify(r.body), /FICTICIA|private_key|EG_demo1/);
  assert.equal((await llamar(db, 'naara', { accion: 'grabacion_servidor', op: 'iniciar', id, consentimiento: true })).code, 409, 'una a la vez');
  const aud = db._dump ? JSON.stringify(db._dump()) : '';
  if (aud) assert.match(aud, /grabacion_servidor_inicio/);
});

test('plantilla: la escena se entrega SOLO durante una grabación activa y sin datos sensibles', async () => {
  const db = crearFakeDb(); const id = await reunionEnCurso(db);
  const r = await llamar(db, 'naara', { accion: 'grabacion_servidor', op: 'iniciar', id, consentimiento: true });
  const gid = r.body.grabacion.id;
  const e = await llamar(db, '', { accion: 'grabacion_escena', grabacionId: gid }, ENV, true);
  assert.equal(e.code, 200, JSON.stringify(e.body));
  assert.deepEqual(e.body.escena.participantes.map((p) => p.id), ['naara', 'libni']);
  assert.ok(e.body.escena.avatares.naara?.config); assert.equal(e.body.escena.escenario, 'sala-c');
  assert.doesNotMatch(JSON.stringify(e.body), /miniatura|correo|telefono|token|FICTICIA/i);
  assert.equal((await llamar(db, '', { accion: 'grabacion_escena', grabacionId: 'g' + '0'.repeat(24) }, ENV, true)).code, 404);
  assert.equal((await llamar(db, '', { accion: 'grabacion_escena', grabacionId: '../x' }, ENV, true)).code, 400);
  assert.equal((await llamar(db, '', { accion: 'panel' }, ENV, true)).code, 401, 'lo demás sigue exigiendo sesión');
  respuestaEgress = { egressId: 'EG_demo1', status: 'EGRESS_ENDING' };
  await llamar(db, 'naara', { accion: 'grabacion_servidor', op: 'detener', id, grabacionId: gid });
  assert.equal((await llamar(db, '', { accion: 'grabacion_escena', grabacionId: gid }, ENV, true)).code, 404, 'al detener ya no hay escena');
});

test('J09: detener → procesando → lista; participantes reproducen/descargan con enlace firmado de 15 min; ajenas no', async () => {
  const db = crearFakeDb(); const id = await reunionEnCurso(db);
  respuestaEgress = { egressId: 'EG_demo2', status: 'EGRESS_ACTIVE' };
  const gid = (await llamar(db, 'naara', { accion: 'grabacion_servidor', op: 'iniciar', id, consentimiento: true })).body.grabacion.id;
  assert.equal((await llamar(db, 'libni', { accion: 'grabacion_servidor', op: 'detener', id })).code, 403);
  respuestaEgress = { egressId: 'EG_demo2', status: 'EGRESS_ENDING' };
  const d = await llamar(db, 'naara', { accion: 'grabacion_servidor', op: 'detener', id, grabacionId: gid });
  assert.equal(d.body.grabacion.estado, 'procesando');
  assert.equal((await llamar(db, 'libni', { accion: 'grabacion_ver', id, grabacionId: gid })).code, 409, 'todavía no está lista');
  respuestaEgress = { egressId: 'EG_demo2', status: 'EGRESS_COMPLETE', startedAt: String(AHORA * 1e6), endedAt: String((AHORA + 754000) * 1e6), fileResults: [{ filename: `sala-juntas/${id}/${gid}.mp4`, duration: String(754 * 1e9), size: '52428800' }] };
  const l = await llamar(db, 'libni', { accion: 'grabaciones', id });
  assert.equal(l.code, 200); const g = l.body.grabaciones[0];
  assert.deepEqual([g.estado, g.duracionSeg, g.bytes, g.reproducible], ['lista', 754, 52428800, true]);
  assert.doesNotMatch(JSON.stringify(l.body), /storageKey|sala-grabaciones-demo|EG_demo2/);
  const v = await llamar(db, 'libni', { accion: 'grabacion_ver', id, grabacionId: gid });
  assert.equal(v.code, 200); assert.match(v.body.url, /X-Goog-Signature/); assert.equal(v.body.expiraMs - AHORA, 15 * 60000);
  await llamar(db, 'libni', { accion: 'grabacion_ver', id, grabacionId: gid, descargar: true });
  assert.equal(firmas.at(-1).o.descargar, true);
  assert.equal((await llamar(db, 'geisell', { accion: 'grabacion_ver', id, grabacionId: gid })).code, 403, 'no invitada');
});

test('estado de LiveKit → estado propio; fallas visibles; plantilla avisa START/END_RECORDING y no publica audio', () => {
  assert.equal(G.estadoDeEgress({ status: 'EGRESS_FAILED', error: 'sin WebGL' }).estado, 'fallida');
  assert.equal(G.estadoDeEgress({ status: 'EGRESS_LIMIT_REACHED' }).estado, 'lista_parcial');
  assert.equal(G.publicaGrabacion('g1', { estado: 'fallida', error: 'sin WebGL' }).error, 'sin WebGL');
  const t = fs.readFileSync('sala-grabacion.js', 'utf8');
  assert.match(t, /console\.log\('START_RECORDING'\)/); assert.match(t, /console\.log\('END_RECORDING'\)/);
  assert.doesNotMatch(t, /setMicrophoneEnabled|publishTrack|getUserMedia/);
  assert.match(t, /import\('\/sala-3d\.js/);
  const w = fs.readFileSync('sala-juntas.js', 'utf8');
  assert.match(w, /accion: 'grabacion_servidor', op: 'iniciar', id: V\.id, consentimiento: true/);
  // R196j: la APK graba en el teléfono (CFG.guardarGrabacion); solo una APK vieja sin esa función ve el aviso.
  assert.match(w, /if \(CFG\.embebida && !guardarApk\) return toast\('Esta versión de la APK no puede grabar/);
});
