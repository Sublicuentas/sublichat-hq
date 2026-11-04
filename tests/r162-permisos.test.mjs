// R162 · Módulos por usuario: Sublicuentas activa o desactiva módulos de los demás. Sin Firebase real (db falsa).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../api/_permisos.js');

function dbFalsa(inicial = {}) {
  const docs = new Map([['config/sublichat_permisos', inicial]]); const escritos = [];
  const ref = (col, id) => ({ col, id: id || 'auto' + escritos.length, path: `${col}/${id}` });
  return {
    docs, escritos,
    collection: (col) => ({ doc: (id) => ({ ...ref(col, id), get: async () => { const d = docs.get(`${col}/${id}`); return { exists: !!d, data: () => d }; } }) }),
    runTransaction: async (fn) => fn({
      get: async (r) => { const d = docs.get(r.path); return { exists: !!d, data: () => d }; },
      set: (r, data) => { escritos.push([r.col, data]); if (r.col === 'config') docs.set(r.path, data); },
    }),
  };
}
const ENV = { AUTH_USERS_JSON: JSON.stringify({ naara: { role: 'admin', hash: 'x' }, relojes: { role: 'asesor', hash: 'y' }, magdiel: { role: 'asesor' }, nuevo: { role: 'asesor' } }), GEISELL_PASSWORD_HASH: 'z' };
function llamar(handler, { usuario, body, db }) {
  return new Promise((resolve) => {
    const res = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body }, res, { auth: () => ({ verifyIdToken: async () => ({ uid: 'asesor-' + usuario, usuario, role: 'asesor' }) }), db: () => db, env: ENV });
  });
}

test('sin cambios cada usuario conserva exactamente lo de hoy', () => {
  const pv = (u) => P.pantallasVisibles({ usuario: u, role: 'asesor' }, {});
  assert.ok(P.esSupervisor({ usuario: 'naara' }) && P.esSupervisor({ usuario: 'sublicuentas' }));
  assert.equal(P.MODULOS.filter((m) => P.porDefecto({ usuario: 'naara' })[m.id]).length, P.MODULOS.length);
  assert.deepEqual(pv('geisell').sort(), ['clientes', 'control-cuentas', 'inicio', 'perfil', 'tickets']);
  const rel = pv('relojes');
  for (const s of ['sorteos', 'portal-cliente', 'catalogo-relojes', 'importar', 'agenda']) assert.ok(rel.includes(s), s);
  for (const s of ['control-cuentas', 'revendedores', 'inventario', 'actividad']) assert.ok(!rel.includes(s), s);
  const nuevo = P.porDefecto({ usuario: 'nuevo', role: 'asesor' });
  assert.equal(nuevo['control-maestro'], false); assert.equal(nuevo.finanzas, false); assert.equal(nuevo.sorteos, false);
});

test('Sublicuentas manda: activar da acceso, desactivar lo quita; supervisor nunca pierde', () => {
  const cfg = { usuarios: { relojes: { modulos: { sorteos: false, 'control-maestro': true, inicio: false } }, naara: { modulos: { clientes: false } } } };
  const rel = { usuario: 'relojes', role: 'asesor' };
  const pv = P.pantallasVisibles(rel, cfg);
  assert.ok(!pv.includes('sorteos')); assert.ok(pv.includes('control-cuentas')); assert.ok(pv.includes('inicio'), 'Inicio es fijo');
  const ctx = { clave: 'relojes', supervisor: false, overrides: P.overridesDe(cfg, 'relojes') };
  assert.equal(P.aplicar(ctx, 'sorteos', true), false);
  assert.equal(P.aplicar(ctx, 'control-maestro', false), true);
  assert.equal(P.aplicar(ctx, 'bodega', false), false, 'sin cambio: regla de hoy');
  assert.equal(P.aplicar({ supervisor: true, overrides: { clientes: false } }, 'clientes', true), true);
  assert.ok(P.pantallasVisibles({ usuario: 'naara' }, cfg).includes('clientes'));
  assert.deepEqual(P.limpiarCambios({ inicio: false, sorteos: null, x: true, bodega: 'si', finanzas: true }), { sorteos: null, finanzas: true });
});

test('API: mis_permisos, listar y guardar (solo Sublicuentas) con auditoría', async () => {
  const handler = require('../api/permisos.js');
  const db = dbFalsa({});
  P.invalidar();
  let r = await llamar(handler, { usuario: 'relojes', db, body: { accion: 'mis_permisos' } });
  assert.equal(r.code, 200); assert.equal(r.body.supervisor, false); assert.ok(r.body.pantallas.includes('sorteos'));
  r = await llamar(handler, { usuario: 'relojes', db, body: { accion: 'guardar', usuario: 'geisell', modulos: { bodega: true } } });
  assert.equal(r.code, 403);
  r = await llamar(handler, { usuario: 'relojes', db, body: { accion: 'listar' } });
  assert.equal(r.code, 403);
  r = await llamar(handler, { usuario: 'naara', db, body: { accion: 'listar' } });
  assert.equal(r.code, 200);
  const usuarios = r.body.usuarios.map((u) => u.usuario);
  assert.deepEqual(usuarios.slice(0, 1), ['naara']); for (const u of ['geisell', 'magdiel', 'nuevo', 'relojes']) assert.ok(usuarios.includes(u), u);
  assert.ok(!JSON.stringify(r.body).includes('"hash"'), 'no se devuelven hashes');
  r = await llamar(handler, { usuario: 'naara', db, body: { accion: 'guardar', usuario: 'naara', modulos: { clientes: false } } });
  assert.equal(r.code, 400, 'a Sublicuentas no se le quita nada');
  r = await llamar(handler, { usuario: 'naara', db, body: { accion: 'guardar', usuario: 'noexiste', modulos: { bodega: true } } });
  assert.equal(r.code, 400);
  r = await llamar(handler, { usuario: 'sublicuentas', db, body: { accion: 'guardar', usuario: 'relojes', modulos: { sorteos: false, 'control-maestro': true } } });
  assert.equal(r.code, 200); assert.deepEqual(r.body.cambios, { sorteos: false, 'control-maestro': true });
  const audit = db.escritos.find(([c]) => c === 'auditoria_eventos');
  assert.ok(audit && audit[1].tipo === 'permisos_modulos' && audit[1].objetivo === 'relojes' && audit[1].actorUsuario === 'sublicuentas');
  r = await llamar(handler, { usuario: 'relojes', db, body: { accion: 'mis_permisos' } });
  assert.ok(!r.body.pantallas.includes('sorteos')); assert.ok(r.body.pantallas.includes('control-cuentas'));
  r = await llamar(handler, { usuario: 'naara', db, body: { accion: 'guardar', usuario: 'relojes', modulos: { sorteos: null } } });
  assert.deepEqual(r.body.cambios, { 'control-maestro': true }, 'null = volver a lo de siempre');
});

test('las APIs de los módulos consultan los permisos', () => {
  const usa = { 'importar.js': 'control-maestro', 'inventario.js': 'bodega', 'codigos.js': 'codigos', 'finanzas.js': 'finanzas', 'sorteos.js': 'sorteos', 'portal-cliente.js': 'portal-cliente', 'catalogo-relojes.js': 'catalogo', 'revendedores-admin.js': 'panel-socios', 'auditoria.js': 'actividad' };
  for (const [f, m] of Object.entries(usa)) {
    const src = fs.readFileSync(new URL('../api/' + f, import.meta.url), 'utf8');
    assert.match(src, /_permisos\.js/, f);
    assert.ok(src.includes(`"${m}"`) || src.includes(`'${m}'`) || src.includes(`.${m} `), `${f} → ${m}`);
  }
});

test('diseño nuevo: apagado por defecto, sin Activar TV, assets livianos', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const js = fs.readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
  assert.match(html, /ui-v2\.css\?v=/); assert.match(html, /ui-v2\.js\?v=/); assert.match(html, /permisos-admin\.js\?v=/);
  assert.match(js, /if \(!activo\) return;/);
  assert.ok(!/activar\s*tv/i.test(js));
  for (const a of ['sublirobot-96.webp', 'sublirobot-240.webp', 'sublicuentas-logo-claro-ui.webp']) {
    assert.ok(fs.statSync(new URL('../assets/' + a, import.meta.url)).size < 40000, a);
  }
});
