// R167 · SubliStudio 3D · Sala de Juntas (Fase 1): ACL de 3 fundadoras, solo Naara convoca, RSVP propio, avisos idempotentes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../api/_sala-juntas.js');
const handler = require('../api/sala-juntas.js');
const { crearFakeDb } = require('./helpers/fake-firestore.cjs');

const AHORA = Date.UTC(2026, 10, 5, 17, 0); // 05/11/2026 11:00 a. m. Honduras
function llamar(db, usuario, body) {
  return new Promise((resolve) => {
    const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    handler({ method: 'POST', headers: { authorization: usuario ? 'Bearer t' : '' }, body }, res,
      { auth: () => ({ verifyIdToken: async () => ({ uid: 'asesor-' + usuario, usuario, role: 'admin' }) }), db: () => db, env: {}, ahora: () => AHORA });
  });
}
const conv = (extra = {}) => ({ accion: 'crear', titulo: 'Revisión mensual', fecha: '2026-11-09', hora: '19:00', agenda: 'Resultados de octubre\nCampañas de noviembre', participantes: ['naara', 'libni', 'geisell'], ...extra });

test('identidad: solo las 3 fundadoras, por usuario y no por rol', () => {
  assert.equal(S.identidad({ usuario: 'sublicuentas' }).id, 'naara');
  assert.equal(S.identidad({ usuario: 'naara' }).id, 'naara');
  assert.equal(S.identidad({ usuario: 'relojes' }).id, 'libni');
  assert.equal(S.identidad({ usuario: 'Geissel' }).id, 'geisell');
  assert.equal(S.identidad({ usuario: 'magdiel', role: 'admin' }), null);
  assert.equal(S.identidad({ usuario: 'daniela' }), null);
});

test('hora de Honduras (UTC-6) sin conversiones raras', () => {
  const ms = S.aUTC('2026-11-09', '19:00');
  assert.equal(new Date(ms).toISOString(), '2026-11-10T01:00:00.000Z');
  assert.deepEqual(S.partesHN(ms), { fecha: '2026-11-09', hora: '19:00' });
  assert.ok(Number.isNaN(S.aUTC('2026-02-31', '10:00')));
});

test('acceso: otro admin o sin sesión no entra; Libni/Geisell no convocan', async () => {
  const db = crearFakeDb();
  assert.equal((await llamar(db, '', { accion: 'panel' })).code, 401);
  assert.equal((await llamar(db, 'magdiel', { accion: 'panel' })).code, 403);
  assert.equal((await llamar(db, 'libni', conv())).code, 403);
  assert.equal((await llamar(db, 'geisell', conv())).code, 403);
  assert.equal((await llamar(db, 'libni', { accion: 'panel' })).code, 200);
});

test('Naara programa: invitaciones + avisos 24h/1h/10min/inicio, idempotentes; validación de fecha pasada', async () => {
  const db = crearFakeDb();
  let r = await llamar(db, 'naara', conv({ fecha: '2026-11-05', hora: '10:00' }));
  assert.equal(r.code, 400); assert.match(r.body.error, /ya pasaron/);
  r = await llamar(db, 'sublicuentas', conv());
  assert.equal(r.code, 200); const id = r.body.id;
  const invs = db.todos('sala_invitaciones');
  assert.deepEqual(invs.map((x) => `${x.usuario}:${x.estado}`).sort(), ['geisell:pendiente', 'libni:pendiente', 'naara:aceptada']);
  const av = db.todos('sala_avisos');
  assert.equal(av.filter((x) => x.usuario === 'libni').map((x) => x.tipo).sort().join(','), 'h1,h24,inicio,invitacion,m10');
  assert.ok(!av.some((x) => x.usuario === 'naara' && x.tipo === 'invitacion'));
  assert.ok(av.every((x) => x.estado === 'pendiente'));
  // reprogramar: los avisos anteriores se anulan y se generan nuevos (versión 2); RSVP vuelve a pendiente si cambia la hora
  await llamar(db, 'libni', { accion: 'rsvp', id, respuesta: 'aceptada' });
  r = await llamar(db, 'naara', { ...conv({ hora: '20:00' }), accion: 'editar', id });
  assert.equal(r.code, 200); assert.equal(r.body.version, 2);
  const av2 = db.todos('sala_avisos');
  assert.ok(av2.filter((x) => x.version === 1).every((x) => x.estado === 'anulado'));
  assert.equal(av2.filter((x) => x.version === 2 && x.estado === 'pendiente' && x.usuario === 'libni').length, 5);
  assert.equal(db.todos('sala_invitaciones').find((x) => x.usuario === 'libni').estado, 'pendiente');
});

test('RSVP solo cambia la invitación propia; no invitada no ve la reunión; cancelar anula avisos', async () => {
  const db = crearFakeDb();
  const id = (await llamar(db, 'naara', conv({ participantes: ['naara', 'libni'] }))).body.id;
  assert.equal((await llamar(db, 'geisell', { accion: 'rsvp', id, respuesta: 'aceptada' })).code, 403);
  assert.equal((await llamar(db, 'geisell', { accion: 'antesala', id })).code, 403);
  const p = await llamar(db, 'geisell', { accion: 'panel' }); assert.equal(p.body.reuniones.length, 0);
  assert.equal((await llamar(db, 'relojes', { accion: 'rsvp', id, respuesta: 'rechazada' })).code, 200);
  assert.equal(db.todos('sala_invitaciones').find((x) => x.usuario === 'libni').estado, 'rechazada');
  assert.equal(db.todos('sala_invitaciones').find((x) => x.usuario === 'naara').estado, 'aceptada');
  assert.equal((await llamar(db, 'libni', { accion: 'cancelar', id })).code, 403);
  assert.equal((await llamar(db, 'naara', { accion: 'cancelar', id })).code, 200);
  const av = db.todos('sala_avisos');
  assert.ok(av.filter((x) => x.tipo !== 'cancelacion').every((x) => x.estado === 'anulado'));
  assert.equal(av.filter((x) => x.tipo === 'cancelacion').length, 1);
  assert.equal((await llamar(db, 'libni', { accion: 'antesala', id })).code, 409);
  assert.ok(db.todos('auditoria_eventos').some((x) => x.accion === 'cancelar' && x.actorUsuario === 'naara'));
});

test('borrador: solo lo ve Naara y no genera avisos; abrir sala solo Naara; panel con KPIs reales', async () => {
  const db = crearFakeDb();
  await llamar(db, 'naara', { accion: 'crear', borrador: true, titulo: 'Idea', participantes: ['libni'] });
  assert.equal(db.todos('sala_avisos').length, 0);
  assert.equal((await llamar(db, 'libni', { accion: 'panel' })).body.reuniones.length, 0);
  const id = (await llamar(db, 'naara', conv())).body.id;
  assert.equal((await llamar(db, 'libni', { accion: 'abrir_sala', id })).code, 403);
  assert.equal((await llamar(db, 'naara', { accion: 'abrir_sala', id })).code, 200);
  const p = (await llamar(db, 'naara', { accion: 'panel' })).body;
  assert.equal(p.kpis.reunionesMes, 1); assert.equal(p.kpis.convocatoriasActivas, 1); assert.equal(p.proxima.id, id);
  assert.equal(p.proxima.salaAbierta, true); assert.equal(p.tiempoReal, false);
  assert.equal((await llamar(db, 'naara', { accion: 'token_tiempo_real', id })).code, 501);
});

test('web: botón Sala de Juntas después de Catálogo y pantalla separada', () => {
  const js = fs.readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
  assert.match(js, /\{ s: 'catalogo-relojes' \}, \{ s: 'sala-juntas' \}/);
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /sala-juntas\.js\?v=/);
  const P = require('../api/_permisos.js');
  assert.ok(P.pantallasVisibles({ usuario: 'relojes' }, {}).includes('sala-juntas'));
  assert.ok(!P.pantallasVisibles({ usuario: 'magdiel' }, {}).includes('sala-juntas'));
});
