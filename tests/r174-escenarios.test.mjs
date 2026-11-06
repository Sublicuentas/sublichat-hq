// R174 · Fase 6: catálogo de escenarios igual en navegador y servidor; presets con nombre; oficial solo Naara; convocatoria con escenario.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../api/_sala-juntas.js');
const handler = require('../api/sala-juntas.js');
const { crearFakeDb } = require('./helpers/fake-firestore.cjs');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let AHORA = Date.UTC(2026, 10, 5, 17, 0);
const llamar = (db, usuario, body) => new Promise((ok) => { const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { ok({ code: this.code, body: b }); } };
  handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body }, res, { auth: () => ({ verifyIdToken: async () => ({ usuario }) }), db: () => db, env: {}, ahora: () => AHORA }); });

test('catálogo: 5 escenarios con 4 paredes, 4 asientos, 5 paletas y 4 luces; navegador = servidor', () => {
  const src = fs.readFileSync(path.join(ROOT, 'escenarios.js'), 'utf8');
  const m = src.match(/export const ESCENARIOS = (\{[\s\S]*?\n\});/); assert.ok(m);
  const CLI = Function('return ' + m[1])();
  assert.deepEqual(Object.keys(CLI), ['sala-c', 'socios', 'aula', 'live', 'cinema']);
  for (const [id, E] of Object.entries(CLI)) {
    assert.equal(E.paredes.length, 4, id); assert.equal(E.asientos.length, 4, id); assert.equal(E.paleta.length, 5, id); assert.equal(E.luz.length, 4, id);
    for (const k of ['paredes', 'asientos', 'paleta', 'luz']) assert.deepEqual(E[k].map((x) => x[0]), S.ESCENARIOS[id][k], `${id}.${k}`);
    assert.deepEqual(E.base, S.ESCENARIOS[id].base);
    for (const k of ['paredes', 'asientos', 'paleta', 'luz']) assert.ok(E[k].some((x) => x[0] === E.base[k]));
  }
  // cada paleta y luz usada existe en las tablas del motor
  const tabla = (n) => Object.keys(Function('return ' + src.match(new RegExp(`const ${n} = (\\{[\\s\\S]*?\\n\\});`))[1])());
  const pal = tabla('PALETAS'), luz = tabla('LUCES');
  for (const E of Object.values(CLI)) { E.paleta.forEach(([v]) => assert.ok(pal.includes(v), 'paleta ' + v)); E.luz.forEach(([v]) => assert.ok(luz.includes(v), 'luz ' + v)); }
});

test('presets: guardar con nombre, editar solo quien lo creó o Naara, oficial solo Naara, borrar', async () => {
  const db = crearFakeDb();
  let r = await llamar(db, 'libni', { accion: 'preset_guardar', escenario: 'aula', nombre: 'Clase onboarding', estilo: { paredes: 'blanco', asientos: 'mesas', paleta: 'blanco-gris', luz: 'led', extra: 'x' } });
  assert.equal(r.code, 200, JSON.stringify(r.body)); const p = r.body.presets[0];
  assert.deepEqual(p.estilo, { paredes: 'blanco', asientos: 'mesas', paleta: 'blanco-gris', luz: 'led' }); assert.equal(p.creadoPor, 'libni');
  r = await llamar(db, 'libni', { accion: 'preset_guardar', escenario: 'aula', nombre: 'Raro', estilo: { paredes: 'no-existe' } });
  assert.equal(r.body.presets[1].estilo.paredes, 'madera', 'valor fuera de catálogo → base');
  assert.equal((await llamar(db, 'libni', { accion: 'preset_guardar', escenario: 'aula', nombre: 'clase ONBOARDING' })).code, 409, 'nombre repetido');
  assert.equal((await llamar(db, 'geisell', { accion: 'preset_guardar', escenario: 'aula', presetId: p.id, nombre: 'Mío' })).code, 403);
  assert.equal((await llamar(db, 'naara', { accion: 'preset_guardar', escenario: 'aula', presetId: p.id, nombre: 'Clase onboarding v2', estilo: p.estilo })).code, 200);
  assert.equal((await llamar(db, 'libni', { accion: 'preset_oficial', escenario: 'aula', presetId: p.id })).code, 403);
  r = await llamar(db, 'naara', { accion: 'preset_oficial', escenario: 'aula', presetId: p.id }); assert.equal(r.body.predeterminado, p.id);
  assert.equal((await llamar(db, 'naara', { accion: 'preset_guardar', escenario: 'otro', nombre: 'x' })).code, 400);
  assert.equal((await llamar(db, 'magdiel', { accion: 'escenarios' })).code, 403);
  r = await llamar(db, 'geisell', { accion: 'escenarios' }); assert.equal(r.body.escenarios.aula.presets.length, 2); assert.equal(r.body.escenarios.aula.predeterminado, p.id);
  r = await llamar(db, 'libni', { accion: 'preset_borrar', escenario: 'aula', presetId: p.id }); assert.equal(r.code, 200); assert.equal(r.body.predeterminado, '', 'al borrar el oficial se quita');
  assert.ok(db.todos('auditoria_eventos').some((x) => x.accion === 'preset_oficial'));
});

test('convocatoria guarda escenario y estilo; valores raros → Sala C', async () => {
  const db = crearFakeDb();
  let r = await llamar(db, 'naara', { accion: 'crear', titulo: 'Lanzamiento promo', fecha: '2026-11-20', hora: '15:00', agenda: 'Anuncio', participantes: ['naara', 'geisell'], escenario: 'live', presetId: 'abc123' });
  assert.equal(r.code, 200); let reu = db.todos('sala_reuniones')[0]; assert.equal(reu.escenario, 'live'); assert.equal(reu.presetId, 'abc123');
  r = await llamar(db, 'naara', { accion: 'crear', titulo: 'Junta', fecha: '2026-11-21', hora: '15:00', agenda: 'x', participantes: ['naara', 'libni'], escenario: '../hack', presetId: '<x>' });
  reu = db.todos('sala_reuniones').find((x) => x.titulo === 'Junta'); assert.equal(reu.escenario, 'sala-c'); assert.equal(reu.presetId, '');
  const p = await llamar(db, 'libni', { accion: 'panel' }); assert.equal(p.body.reuniones.find((x) => x.titulo === 'Junta').escenario, 'sala-c');
});
