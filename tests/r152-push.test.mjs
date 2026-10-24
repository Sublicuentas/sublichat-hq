// R152 · Fase 2 · Notificaciones push (api/_push.js): tokens por teléfono, envío, limpieza y sin datos sensibles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = require('../api/_push.js');

function fakeDb() {
  const data = new Map();
  const col = (n) => { if (!data.has(n)) data.set(n, new Map()); return data.get(n); };
  const ref = (n, id) => ({ id, get: async () => ({ id, exists: col(n).has(id), data: () => ({ ...col(n).get(id) }) }), set: async (v, o) => col(n).set(id, o && o.merge ? { ...(col(n).get(id) || {}), ...v } : { ...v }), delete: async () => col(n).delete(id) });
  return { _col: col, collection: (n) => ({ doc: (id) => ref(n, id), get: async () => { const docs = [...col(n).keys()].map((id) => ({ id, data: () => ({ ...col(n).get(id) }) })); return { docs, forEach: (fn) => docs.forEach(fn) }; } }) };
}
const TOK = (s) => `tok_${s}_` + 'x'.repeat(40);

test('registrar: un teléfono = un documento; si entra otro usuario, el teléfono pasa a ese usuario', async () => {
  const db = fakeDb();
  await P.registrarToken(db, { token: TOK('a'), usuario: 'Relojes', grupo: 'relojes' });
  await P.registrarToken(db, { token: TOK('a'), usuario: 'sublicuentas', grupo: 'sublicuentas' });
  const docs = [...db._col('push_tokens').values()];
  assert.equal(docs.length, 1);
  assert.equal(docs[0].usuario, 'sublicuentas');
  await assert.rejects(P.registrarToken(db, { token: 'corto', usuario: 'x' }), /Token push inválido/);
});

test('enviar: solo a los destinatarios, sin el que hizo el cambio, y borra tokens muertos', async () => {
  const db = fakeDb();
  await P.registrarToken(db, { token: TOK('s'), usuario: 'sublicuentas', grupo: 'sublicuentas' });
  await P.registrarToken(db, { token: TOK('r'), usuario: 'relojes', grupo: 'relojes' });
  await P.registrarToken(db, { token: TOK('g'), usuario: 'geisell', grupo: 'geisell' });
  let enviado = null;
  const admin = { messaging: () => ({ sendEachForMulticast: async (m) => { enviado = m; return { successCount: m.tokens.length - 1, failureCount: 1, responses: m.tokens.map((t) => (t === TOK('g') ? { success: false, error: { code: 'messaging/registration-token-not-registered' } } : { success: true })) }; } }) };
  const r = await P.enviarPush(db, admin, { usuarios: ['relojes', 'geisell', 'sublicuentas'], excluir: 'sublicuentas', titulo: '🎫 Nuevo ticket #12', cuerpo: 'Relojes: revisar cuenta', data: { tipo: 'ticket', ir: 'tickets', correo: 'x@y.com' } });
  assert.deepEqual(enviado.tokens.sort(), [TOK('g'), TOK('r')].sort(), 'no se manda al que creó el ticket');
  assert.equal(enviado.android.notification.channelId, 'sublichat_avisos');
  assert.equal(enviado.data.correo, undefined, 'solo pasan tipo, ir, tab e id');
  assert.equal(r.borrados, 1);
  assert.equal(db._col('push_tokens').size, 2, 'el token muerto se borró');
});

test('el aviso nunca lleva correos, claves, PIN ni números largos', async () => {
  assert.throws(() => P.textoSeguro('Nueva cuenta a@b.com', 180), /no puede llevar/);
  assert.throws(() => P.textoSeguro('clave: 1234', 180), /no puede llevar/);
  assert.throws(() => P.textoSeguro('PIN=4455', 180), /no puede llevar/);
  assert.equal(P.textoSeguro('Cambió la clave · 4 ficha(s) ya actualizadas.', 180), 'Cambió la clave · 4 ficha(s) ya actualizadas.');
  const db = fakeDb();
  await P.registrarToken(db, { token: TOK('r'), usuario: 'relojes', grupo: 'relojes' });
  let cuerpo = '';
  const admin = { messaging: () => ({ sendEachForMulticast: async (m) => { cuerpo = m.notification.body; return { successCount: 1, failureCount: 0, responses: [{ success: true }] }; } }) };
  await P.avisar(db, admin, { usuarios: ['relojes'], titulo: '💬 Respuesta', cuerpo: 'Sublicuentas: la clave: Netflix2026' });
  assert.equal(cuerpo, 'Abra Sublichat para verlo.', 'ticket con datos sensibles → aviso genérico');
});

test('baja: solo el dueño actual del teléfono lo da de baja', async () => {
  const db = fakeDb();
  await P.registrarToken(db, { token: TOK('b'), usuario: 'relojes' });
  await P.bajaToken(db, { token: TOK('b'), usuario: 'geisell' });
  assert.equal(db._col('push_tokens').size, 1);
  await P.bajaToken(db, { token: TOK('b'), usuario: 'relojes' });
  assert.equal(db._col('push_tokens').size, 0);
});

test('Web: tickets, avisos, respuestas y cambio de correo/clave avisan por push; mobile-core registra/baja/prueba', () => {
  const t = fs.readFileSync(path.join(root, 'api/tickets.js'), 'utf8');
  assert.equal((t.match(/push\.avisar\(db, admin,/g) || []).length, 2);
  const inv = fs.readFileSync(path.join(root, 'api/inventario.js'), 'utf8');
  assert.match(inv, /push\.avisar\(db, admin, \{ todos: true, excluir: usuarioAccion/);
  const mc = fs.readFileSync(path.join(root, 'api/mobile-core.js'), 'utf8');
  assert.match(mc, /if \(action === 'push'\) return pushAccion\(req, res\);/);
  for (const op of ['registrar', 'baja', 'probar']) assert.match(mc, new RegExp(`op === '${op}'`));
});

test('el bot usa el mismo archivo de push', () => {
  const bot = path.resolve(root, '..', 'bot', 'lib_push.js');
  if (!fs.existsSync(bot)) return;
  const sinCab = (x) => x.split('\n').slice(1).join('\n');
  assert.equal(sinCab(fs.readFileSync(bot, 'utf8')), sinCab(fs.readFileSync(path.join(root, 'api/_push.js'), 'utf8')));
});
