// R177 · servidor: nombre visible, ambiente del escenario, tipo de sesión y copia del estilo usado.
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
const AHORA = Date.UTC(2026, 10, 5, 17, 0);
const llamar = (db, usuario, body) => new Promise((ok) => { const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { ok({ code: this.code, body: b }); } };
  handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body }, res, { auth: () => ({ verifyIdToken: async () => ({ usuario }) }), db: () => db, env: {}, ahora: () => AHORA }); });

test('nombre visible: texto simple, 24 caracteres, sin etiquetas; vacío = nombre de usuaria', () => {
  assert.equal(S.limpiarNombreVisible('  <b>Licda.</b>   Naara  '), 'bLicda./b Naara');
  assert.equal(S.limpiarNombreVisible('x'.repeat(40)).length, 24);
  assert.equal(S.limpiarAvatar({}).nombre, '');
  assert.equal(S.limpiarAvatar({ nombre: 'Lic. Naara' }).nombre, 'Lic. Naara');
});

test('ambiente: piso, brillo y decoración validados; navegador = servidor', () => {
  const e = S.estiloEscenario('socios', { piso: 'claro', brillo: 'brillante', deco: { plantas: false, cuadros: true, raro: true, logos: 'si' } });
  assert.equal(e.piso, 'claro'); assert.equal(e.brillo, 'brillante');
  assert.deepEqual(e.deco, { plantas: false, cuadros: true, lamparas: false, mesas: false, paneles: true, logos: false, utileria: true });
  assert.equal(S.estiloEscenario('aula', { piso: 'marmol' }).piso, 'madera');
  const src = fs.readFileSync(path.join(ROOT, 'escenarios.js'), 'utf8');
  const AM = Function('return ' + src.match(/export const AMBIENTE = (\{[\s\S]*?\n\});/)[1])();
  assert.deepEqual(AM.piso.map((x) => x[0]), S.AMBIENTE.piso); assert.deepEqual(AM.brillo.map((x) => x[0]), S.AMBIENTE.brillo);
  assert.deepEqual([...AM.deco, ...AM.marca].map((x) => x[0]).sort(), [...S.AMBIENTE.deco].sort());
  const SUG = Function('return ' + src.match(/export const SUGERIDOS = (\[[\s\S]*?\]);/)[1])();
  assert.deepEqual(SUG.map((x) => x[0]), S.SUGERIDOS);
});

test('convocatoria: tipo de sesión, estilo sugerido y copia del preset elegido', async () => {
  const db = crearFakeDb();
  let r = await llamar(db, 'naara', { accion: 'preset_guardar', escenario: 'live', nombre: 'Anuncio', estilo: { piso: 'oscuro', deco: { plantas: false } } });
  const pid = r.body.presets[0].id;
  r = await llamar(db, 'naara', { accion: 'crear', titulo: 'Grabación promo', fecha: '2026-11-06', hora: '10:00', agenda: 'Guion', participantes: ['naara', 'libni'], duracionMin: 15, tipo: 'grabacion', escenario: 'live', presetId: pid });
  assert.equal(r.code, 200, JSON.stringify(r.body));
  let reu = db.todos('sala_reuniones')[0];
  assert.equal(reu.tipo, 'grabacion'); assert.equal(reu.duracionMin, 15); assert.equal(reu.estiloUsado.piso, 'oscuro'); assert.equal(reu.sugerido, '', 'con preset no guarda sugerido');
  r = await llamar(db, 'naara', { accion: 'crear', titulo: 'Junta sobria', fecha: '2026-11-07', hora: '10:00', agenda: 'Temas', participantes: ['naara', 'geisell'], tipo: 'inventado', sugerido: 'sobria' });
  reu = db.todos('sala_reuniones').find((x) => x.titulo === 'Junta sobria');
  assert.equal(reu.tipo, 'junta', 'tipo fuera de lista → junta'); assert.equal(reu.sugerido, 'sobria'); assert.equal(reu.estiloUsado, null);
  r = await llamar(db, 'naara', { accion: 'panel' });
  const pub = r.body.reuniones.find((x) => x.titulo === 'Grabación promo');
  assert.equal(pub.tipo, 'grabacion'); assert.equal(pub.estiloUsado.piso, 'oscuro');
});
