import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const imap = require('../lib/codigos-imap.js');
const api = require('../api/codigos.js');

const ahora = Date.now();
const mail = (from, subject, text, extra = {}) => ({ from, subject, text, html: extra.html || '', date: new Date(ahora - (extra.min || 1) * 60000), ts: ahora - (extra.min || 1) * 60000, uid: extra.uid || 10, seq: 1 });

test('R77 Netflix inicio de sesión: 4 dígitos (misma regla del bot)', async () => {
  const r = await imap.resolverCodigo([mail('Netflix <info@account.netflix.com>', 'Tu código de inicio de sesión', 'Ingresa este código: 4821. Vence pronto. 2026')], 'cliente@x.com');
  assert.equal(r.tipo, 'codigo'); assert.equal(r.codigo, '4821'); assert.equal(r.plataforma, 'netflix');
});

test('R77 Disney: 6 dígitos, ignora OTP oculto en el HTML y marca si ya se entregó', async () => {
  const html = '<div style="display:none">814644</div><p>Tu código de acceso único es</p><td>3</td><td>7</td><td>1</td><td>2</td><td>9</td><td>0</td>';
  const e = mail('Disney+ <disneyplus@trx.mail2.disneyplus.com>', 'Tu código de acceso único para Disney+', '', { html, uid: 55 });
  const r = await imap.resolverCodigo([e], 'c@x.com');
  assert.equal(r.codigo, '371290'); assert.equal(r.repetido, false);
  const r2 = await imap.resolverCodigo([e], 'c@x.com', { yaEntregadoDisney: () => '55:371290' });
  assert.equal(r2.repetido, true);
  const viejo = mail('Disney+ <disneyplus@x.com>', 'Tu código de acceso único para Disney+', 'código 123456', { min: 45 });
  assert.equal((await imap.resolverCodigo([viejo], 'c@x.com')).tipo, 'sin_codigo', 'Disney de hace 45 min ya no sirve');
});

test('R77 restablecer contraseña devuelve link https, nunca un número', async () => {
  const e = mail('Netflix <info@netflix.com>', 'Restablecimiento de contraseña', 'Abre https://www.netflix.com/password?g=abc123&lkid=URL_PASSWORD 2026');
  const r = await imap.resolverCodigo([e], 'c@x.com');
  assert.equal(r.tipo, 'link'); assert.match(r.link, /^https:\/\/www\.netflix\.com\/password/);
  assert.equal((await imap.resolverLink([e], 'c@x.com')).tipo, 'link');
});

test('R77 Netflix Hogar: /code avisa y el modo hogar lo resuelve', async () => {
  const e = mail('Netflix <info@netflix.com>', 'Actualiza tu Hogar con Netflix', 'Tu código es 5512');
  assert.equal((await imap.resolverCodigo([e], 'c@x.com')).tipo, 'hogar_aviso');
  const h = await imap.resolverHogar([e], 'c@x.com', { scrap: async () => null });
  assert.equal(h.tipo, 'codigo'); assert.equal(h.codigo, '5512');
});

test('R77 sin correos / sin credenciales', async () => {
  assert.equal((await imap.resolverCodigo([], 'c@x.com')).tipo, 'sin_emails');
  const old = { ...process.env }; for (const k of Object.keys(process.env)) if (/IMAP|EMAIL_ADMIN/.test(k)) delete process.env[k];
  await assert.rejects(imap.buscarEmails('c@x.com'), e => e.code === 'IMAP_SIN_CREDENCIALES');
  Object.assign(process.env, old);
});

// ── endpoint ──
function fakeRes() { const r = { code: 0, body: null, headers: {} }; r.setHeader = (k, v) => { r.headers[k] = v; }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; return r; }
function fakeDb() {
  const store = { actividad: [], marcas: {} };
  return { store, db: { collection: name => name === 'actividad_usuarios'
    ? { add: async d => { store.actividad.push(d); } }
    : { doc: id => ({ get: async () => ({ exists: !!store.marcas[id], data: () => store.marcas[id] }), set: async d => { store.marcas[id] = d; } }) } } };
}
const deps = (claims, resultado, db) => ({
  auth: () => ({ verifyIdToken: async t => { if (t !== 'ok') throw new Error('x'); return claims; } }),
  db: () => db, imap: { ...imap, consultar: async (correo, modo, o) => ({ ...resultado, yaMarca: await o.yaEntregadoDisney(correo) }), estadoImap: () => ({ cuentas: 1 }) },
});
const req = (body, tok = 'ok') => ({ method: 'POST', headers: { authorization: `Bearer ${tok}` }, body });

test('R79 endpoint: Sublicuentas, Relojes y Geisell sí; otros vendedores no', async () => {
  const { db } = fakeDb();
  const g = fakeRes(); await api.handler(req({ correo: 'c@x.com' }), g, deps({ uid: 'g', usuario: 'geisell', role: 'geisell_admin' }, { tipo: 'sin_codigo' }, db));
  assert.equal(g.code, 200);
  const res = fakeRes(); await api.handler(req({ correo: 'c@x.com' }), res, deps({ uid: 'h', usuario: 'heber', role: 'asesor' }, {}, db));
  assert.equal(res.code, 403);
  const res2 = fakeRes(); await api.handler(req({ correo: 'c@x.com' }, 'mal'), res2, deps({}, {}, db));
  assert.equal(res2.code, 401);
});

test('R77 endpoint: valida correo, consulta y deja bitácora SIN el código', async () => {
  const { db, store } = fakeDb();
  const bad = fakeRes(); await api.handler(req({ correo: 'no-es-correo' }), bad, deps({ uid: 'n', usuario: 'naara' }, {}, db));
  assert.equal(bad.code, 400);
  const res = fakeRes();
  await api.handler(req({ accion: 'buscar', correo: ' Cliente@X.com ', modo: 'codigo' }), res, deps({ uid: 'l', usuario: 'libni' }, { tipo: 'codigo', codigo: '482193', plataforma: 'disney', plataformaNombre: 'Disney+', repetido: false, marcador: '9:482193' }, db));
  assert.equal(res.code, 200); assert.equal(res.body.resultado.codigo, '482193'); assert.equal(res.body.resultado.marcador, undefined);
  assert.equal(store.actividad.length, 1);
  assert.equal(store.actividad[0].actorLabel, 'Relojes'); assert.equal(store.actividad[0].detalle.cuenta, 'cliente@x.com');
  assert.doesNotMatch(JSON.stringify(store.actividad[0]), /482193/, 'el código nunca va a la bitácora');
  assert.equal(store.marcas['cliente@x.com'].marcador, '9:482193');
});

test('R77 endpoint: máximo 12 consultas por minuto', async () => {
  const { db } = fakeDb(); let last;
  for (let i = 0; i < 13; i += 1) { last = fakeRes(); await api.handler(req({ correo: 'c@x.com' }), last, deps({ uid: 'z', usuario: 'zeta', role: 'admin' }, { tipo: 'sin_codigo' }, db)); }
  assert.equal(last.code, 429);
});

test('R79 si falta imapflow en el deploy responde un mensaje claro (no se cae)', async () => {
  const { db } = fakeDb();
  const res = fakeRes();
  await api.handler(req({ correo: 'c@x.com' }), res, { ...deps({ uid: 'n', usuario: 'naara' }, {}, db), imap: { ...imap, consultar: async () => { const e = new Error('IMAP_DEPENDENCIA'); e.code = 'IMAP_DEPENDENCIA'; e.dep = 'imapflow'; throw e; } } });
  assert.equal(res.code, 503); assert.equal(typeof res.body.error, 'string'); assert.match(res.body.error, /imapflow/);
});

test('R79 diagnóstico sin contraseñas', async () => {
  process.env.EMAIL_ADMIN_USER = 'admin@sublicuentas.com'; process.env.EMAIL_ADMIN_PASS = 'secreto123'; process.env.EMAIL_IMAP_HOST = 'mail.x.com';
  const st = imap.estadoImap();
  assert.ok(st.cuentas >= 1); assert.equal(st.dependencias.ok, true);
  assert.doesNotMatch(JSON.stringify(st), /secreto123/); assert.match(JSON.stringify(st), /ad\*\*\*@sublicuentas\.com/);
});
