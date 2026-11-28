// R210 · Meta comercial global: editar, permisos, histórico y cálculo de faltantes (Firestore simulado).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
import { handleComercial, _reiniciarCache, conAvance, metaDelMes } from '../api/comercial.js';
import * as G from '../api/_comercial.js';
const U = { sub: { usuario: 'sublicuentas', uid: 'admin-sublicuentas' }, rel: { usuario: 'relojes', uid: 'asesor-relojes' }, gei: { usuario: 'geisell', uid: 'asesor-geisell' } };
async function call(db, user, body) { const r = { code: 200, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; await handleComercial(db, user, body, r); return r.body; }
const MES = G.hoyHN().slice(0, 7);

test('administración cambia 800 → 850: Web y APK (dos usuarios) leen la misma meta; faltan = meta − vigentes', async () => {
  _reiniciarCache(); const db = fakeFirestore({ clientes: {} });
  const r = await call(db, U.sub, { accion: 'meta_guardar', mes: MES, objetivo: 850, referencia: 672 });
  assert.ok(r.ok, JSON.stringify(r)); assert.equal(r.meta.objetivo, 850);
  const a = await call(db, U.sub, { accion: 'panel', fresco: true }), b = await call(db, U.gei, { accion: 'panel', origen: 'android' });
  assert.equal(a.meta.objetivo, 850); assert.equal(b.meta.objetivo, 850);
  assert.equal(a.meta.faltan, 850 - a.meta.actual);
  assert.deepEqual(conAvance({ objetivo: 850 }, 672), { objetivo: 850, actual: 672, faltan: 178, pct: 79.1 });
  assert.equal(conAvance({ objetivo: 500 }, 672).faltan, 0, 'nunca negativo');
});

test('sin permiso no se edita ni por API; valores inválidos se rechazan y no cambian nada', async () => {
  _reiniciarCache(); const db = fakeFirestore({ clientes: {} });
  await call(db, U.sub, { accion: 'meta_guardar', mes: MES, objetivo: 800 });
  for (const u of [U.rel, U.gei]) { const r = await call(db, u, { accion: 'meta_guardar', mes: MES, objetivo: 1 }); assert.ok(!r.ok); }
  for (const malo of [{ objetivo: 0 }, { objetivo: -5 }, { objetivo: 12.5 }, { objetivo: 'abc' }, { objetivo: 900, mes: '2026-13' }, { objetivo: 900, mes: '' }, { objetivo: 900, referencia: -1 }]) {
    const r = await call(db, U.sub, { accion: 'meta_guardar', mes: MES, ...malo }); assert.ok(!r.ok, JSON.stringify(malo));
  }
  const h = await call(db, U.rel, { accion: 'meta_historial' });
  assert.equal(h.meta.objetivo, 800); assert.equal(h.puedeEditar, false); assert.equal(h.historial.length, 1);
});

test('histórico/auditoría: quién, cuándo, antes y después; metas por mes', async () => {
  _reiniciarCache(); const db = fakeFirestore({ clientes: {} });
  await call(db, U.sub, { accion: 'meta_guardar', mes: MES, objetivo: 800 });
  await call(db, U.sub, { accion: 'meta_guardar', mes: MES, objetivo: 850, referencia: 672 });
  const h = await call(db, U.sub, { accion: 'meta_historial' });
  assert.equal(h.historial[0].despues.objetivo, 850); assert.equal(h.historial[0].antes.objetivo, 800); assert.equal(h.historial[0].por, 'sublicuentas'); assert.ok(h.historial[0].at);
  assert.equal(h.puedeEditar, true);
  // la meta de otro mes no reemplaza la del mes en curso
  await call(db, U.sub, { accion: 'meta_guardar', mes: '2030-01', objetivo: 2000 });
  const p = await call(db, U.sub, { accion: 'panel', fresco: true });
  assert.equal(metaDelMes({ metas: { [MES]: { objetivo: 850, mes: MES } }, meta: { objetivo: 2000, mes: '2030-01' } }, G.hoyHN()).objetivo, 850);
  assert.equal(p.meta.objetivo, 850);
});

test('pantalla: formulario con mes/año, Guardar y Cancelar, error con Reintentar; modal encima de la capa de la APK', () => {
  const js = fs.readFileSync(new URL('../comercial-web.js', import.meta.url), 'utf8'), css = fs.readFileSync(new URL('../comercial-web.css', import.meta.url), 'utf8');
  for (const t of ['data-m="mes"', 'data-m="anio"', 'data-m-cancel', 'Reintentar', 'Se mantiene la meta anterior', 'Historial de cambios', "api('meta_historial')"]) assert.ok(js.includes(t), t);
  assert.match(css, /\.gc-modal-w\{z-index:9500\}/); assert.match(css, /\.gc-toast\{z-index:9600\}/);
});

test('conteos: pestañas, tarjetas y lista salen de la misma foto (159 vs 158); la lista filtrada lo indica', async () => {
  const { conteosCategorias } = await import('../api/comercial.js');
  const f = [{ categorias: ['vencidos'] }, { categorias: ['vencidos', 'fidelizar'] }, { categorias: ['potenciales'], estadoOportunidad: 'abierta' }, { categorias: ['potenciales'], estadoOportunidad: 'cerrada' }];
  assert.deepEqual(conteosCategorias(f), { vencidos: 2, fidelizar: 1, potenciales: 1 });
  const js = fs.readFileSync(new URL('../comercial-web.js', import.meta.url), 'utf8'), css = fs.readFileSync(new URL('../comercial-web.css', import.meta.url), 'utf8');
  assert.match(js, /st\.panel\.conteos = Object\.assign\(\{\}, st\.panel\.conteos, st\.lista\.conteosCat\)/);
  assert.match(js, /la pestaña cuenta toda la categoría/);
  assert.match(css, /\.gc-tabs\{display:grid!important/);
  assert.match(css, /\.gc-pie\{position:fixed!important/);
  assert.match(css, /\.gc-cuerpo:has\(\.gc-pie\)\{padding-bottom:/);
});
