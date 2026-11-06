// R173 · Acta y acuerdos: solo Naara redacta; asistentes y duración salen del registro real; la responsable marca su acuerdo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const handler = require('../api/sala-juntas.js');
const S = require('../api/_sala-juntas.js');
const { crearFakeDb } = require('./helpers/fake-firestore.cjs');
const ENV = { LIVEKIT_URL: 'wss://prueba.livekit.cloud', LIVEKIT_API_KEY: 'APIprueba', LIVEKIT_API_SECRET: 'secreto-de-prueba-no-real-0123456789' };
let AHORA = Date.UTC(2026, 10, 5, 17, 0);
const llamar = (db, usuario, body) => new Promise((ok) => { const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { ok({ code: this.code, body: b }); } };
  handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body }, res, { auth: () => ({ verifyIdToken: async () => ({ usuario }) }), db: () => db, env: ENV, ahora: () => AHORA, fetch: async () => ({ ok: true }) }); });

async function reunionTerminada(db, parts = ['naara', 'libni', 'geisell']) {
  AHORA = Date.UTC(2026, 10, 5, 17, 0);
  const r = await llamar(db, 'naara', { accion: 'crear', titulo: 'Junta mensual de prueba', fecha: '2026-11-05', hora: '12:00', agenda: 'x', participantes: parts, duracionMin: 60 }); const id = r.body.id;
  AHORA = Date.UTC(2026, 10, 5, 18, 0); await llamar(db, 'naara', { accion: 'token_tiempo_real', id });
  AHORA = Date.UTC(2026, 10, 5, 18, 2); // R181: llega tarde → solicita y Naara la admite
  const sol = await llamar(db, 'libni', { accion: 'solicitar_ingreso', id });
  await llamar(db, 'naara', { accion: 'resolver_solicitud', id, usuario: 'libni', requestId: sol.body.solicitud.requestId, aprobar: true });
  await llamar(db, 'libni', { accion: 'token_tiempo_real', id });
  AHORA = Date.UTC(2026, 10, 5, 18, 47); await llamar(db, 'naara', { accion: 'cerrar_sala', id });
  return id;
}
const ACTA = { resumen: 'Revisamos ventas de octubre.', decisiones: ['Netflix a L300 desde diciembre', '', 'Campaña de Disney+'], acuerdos: [{ texto: 'Actualizar catálogo', responsable: 'libni', fecha: '2026-11-12' }, { texto: 'Diseñar promo', responsable: 'geisell' }] };

test('Naara escribe el acta; asistentes y duración vienen del registro (no se pueden inventar)', async () => {
  const db = crearFakeDb(); const id = await reunionTerminada(db);
  assert.equal((await llamar(db, 'libni', { accion: 'acta_guardar', id, ...ACTA })).code, 403);
  const r = await llamar(db, 'naara', { accion: 'acta_guardar', id, version: 0, ...ACTA, asistentes: ['geisell'], duracionMin: 999 });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  const a = r.body.acta;
  assert.deepEqual(a.asistentes.sort(), ['libni', 'naara']); assert.equal(a.duracionMin, 47);
  assert.deepEqual(a.decisiones, ['Netflix a L300 desde diciembre', 'Campaña de Disney+']);
  assert.equal(a.acuerdos.length, 2); assert.equal(a.acuerdos[0].estado, 'pendiente'); assert.equal(a.version, 1);
  const g = await llamar(db, 'geisell', { accion: 'acta', id });
  assert.equal(g.code, 200); assert.equal(g.body.acta.resumen, 'Revisamos ventas de octubre.');
  assert.equal((await llamar(db, 'prueba', { accion: 'acta', id })).code, 403);
});

test('acta: validaciones y edición con control de versión', async () => {
  const db = crearFakeDb(); const id = await reunionTerminada(db);
  assert.equal((await llamar(db, 'naara', { accion: 'acta_guardar', id, version: 0 })).code, 400, 'vacía');
  assert.equal((await llamar(db, 'naara', { accion: 'acta_guardar', id, version: 0, acuerdos: [{ texto: 'Sin responsable' }] })).code, 400);
  assert.equal((await llamar(db, 'naara', { accion: 'acta_guardar', id, version: 0, ...ACTA })).code, 200);
  assert.equal((await llamar(db, 'naara', { accion: 'acta_guardar', id, version: 0, ...ACTA })).code, 409, 'versión vieja');
  const r = await llamar(db, 'naara', { accion: 'acta_guardar', id, version: 1, ...ACTA, resumen: 'Corregido' });
  assert.equal(r.code, 200); assert.equal(r.body.acta.version, 2); assert.equal(r.body.acta.creadoPor, 'naara');
  // programada (no empezó): todavía no hay acta
  AHORA = Date.UTC(2026, 10, 6, 15, 0);
  const otra = await llamar(db, 'naara', { accion: 'crear', titulo: 'Futura', fecha: '2026-11-20', hora: '12:00', agenda: 'x', participantes: ['naara', 'libni'], duracionMin: 60 });
  assert.equal((await llamar(db, 'naara', { accion: 'acta_guardar', id: otra.body.id, version: 0, ...ACTA })).code, 409);
  assert.equal(S.validarActa({ resumen: 'a'.repeat(9000) }).resumen.length, 4000);
});

test('acuerdos: la responsable marca el suyo; otra fundadora no; Naara sí', async () => {
  const db = crearFakeDb(); const id = await reunionTerminada(db);
  await llamar(db, 'naara', { accion: 'acta_guardar', id, version: 0, ...ACTA });
  assert.equal((await llamar(db, 'geisell', { accion: 'acuerdo_estado', id, acuerdo: 'a1', estado: 'cumplido' })).code, 403);
  const r = await llamar(db, 'libni', { accion: 'acuerdo_estado', id, acuerdo: 'a1', estado: 'cumplido' });
  assert.equal(r.code, 200); assert.equal(r.body.acuerdos[0].estado, 'cumplido'); assert.equal(r.body.acuerdos[0].cambiadoPor, 'libni');
  assert.equal((await llamar(db, 'naara', { accion: 'acuerdo_estado', id, acuerdo: 'a2', estado: 'cumplido' })).code, 200);
  const l = await llamar(db, 'geisell', { accion: 'actas' });
  assert.equal(l.body.actas.length, 1); assert.equal(l.body.actas[0].pendientes, 0);
  const lg = await llamar(db, 'libni', { accion: 'actas' }); assert.equal(lg.body.actas[0].misPendientes, 0);
  assert.ok(db.todos('auditoria_eventos').some((x) => x.accion === 'acuerdo_cumplido' && x.actorUsuario === 'libni'));
});
