// R179 · Sala de Juntas como módulo seleccionable en Permisos; invitados con el módulo; fundadora sin módulo = sin acceso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../api/_permisos.js');
const handler = require('../api/sala-juntas.js');
const { crearFakeDb } = require('./helpers/fake-firestore.cjs');
const ENV = { AUTH_USERS_JSON: JSON.stringify({ sublicuentas: { role: 'admin' }, relojes: { role: 'asesor' }, prueba: { role: 'auditor' }, daniela: { role: 'asesor' } }) };
const llamar = (db, usuario, body) => new Promise((ok) => { const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { ok({ code: this.code, body: b }); } };
  handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body }, res, { auth: () => ({ verifyIdToken: async () => ({ usuario }) }), db: () => db, env: ENV, ahora: () => Date.UTC(2026, 10, 5, 17) }); });

test('catálogo: "Sala de Juntas" es un módulo; fundadoras por defecto, los demás apagado', () => {
  assert.ok(P.MODULOS.some((m) => m.id === 'sala-juntas' && m.servidor && !m.fijo));
  for (const u of ['relojes', 'geisell']) assert.equal(P.porDefecto({ usuario: u, role: 'asesor' })['sala-juntas'], true, u);
  for (const u of ['prueba', 'daniela']) assert.equal(P.porDefecto({ usuario: u, role: 'asesor' })['sala-juntas'], false, u);
  assert.ok(P.pantallasVisibles({ usuario: 'prueba', role: 'asesor' }, { usuarios: { prueba: { modulos: { 'sala-juntas': true } } } }).includes('sala-juntas'));
  assert.ok(!P.pantallasVisibles({ usuario: 'relojes', role: 'asesor' }, { usuarios: { relojes: { modulos: { 'sala-juntas': false } } } }).includes('sala-juntas'));
});

test('API: invitado con módulo entra y aparece en la lista; sin módulo 403; fundadora apagada 403', async () => {
  const db = crearFakeDb(); P.invalidar();
  await db.collection('config').doc('sublichat_permisos').set({ usuarios: { prueba: { modulos: { 'sala-juntas': true } }, relojes: { modulos: { 'sala-juntas': false } } } });
  let r = await llamar(db, 'naara', { accion: 'panel' });
  assert.equal(r.code, 200); assert.deepEqual(r.body.fundadoras.map((f) => f.id), ['naara', 'geisell', 'prueba']);
  assert.equal(r.body.fundadoras[2].invitado, true); assert.equal(r.body.avatares.prueba.config.genero, 'hombre');
  P.invalidar(); assert.equal((await llamar(db, 'prueba', { accion: 'panel' })).code, 200);
  P.invalidar(); assert.equal((await llamar(db, 'daniela', { accion: 'panel' })).code, 403);
  P.invalidar(); assert.equal((await llamar(db, 'relojes', { accion: 'panel' })).code, 403, 'Sublicuentas le quitó el módulo');
  P.invalidar(); r = await llamar(db, 'naara', { accion: 'crear', titulo: 'Con invitado', fecha: '2026-11-06', hora: '10:00', agenda: 'x', participantes: ['prueba', 'daniela', 'libni'] });
  assert.equal(r.code, 200, JSON.stringify(r.body)); assert.deepEqual(db.todos('sala_reuniones')[0].participantes, ['naara', 'prueba'], 'solo miembros válidos');
  assert.ok(db.todos('sala_avisos').filter((a) => a.usuario === 'prueba').every((a) => a.estado === 'sin_vinculo'), 'R182: invitado sin Telegram vinculado = sin_vinculo (no enviado)');
});
