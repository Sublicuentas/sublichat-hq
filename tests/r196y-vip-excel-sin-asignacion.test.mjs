// R196y · Finanzas · Excel Netflix VIP de 4 columnas: ya no exige que la cuenta exista en Control Maestro.
// Busca por correo en Control Maestro, Bodega Netflix VIP y asignaciones de Telegram; si no hay, guarda SOLO el dato
// financiero («Sin asignación comercial»). Nunca crea ventas, clientes ni entradas en Control Maestro. Datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
import { handlePanel, PLANTILLAS_SIMPLES, previsualizarSimple, normCorreoVip, docIdVipCorreo } from '../api/_finanzas-panel.js';
const require = createRequire(import.meta.url);
const bodega = require('../api/_bodega-vip.js');

function mkRes() { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; }
const deps = { hoyYmdHN: () => '2026-11-16', auditar: (tx, db, identity, ev) => tx.set(db.collection('auditoria_eventos').doc(), { ...ev, actor: identity.usuario }) };
const ident = { usuario: 'sublicuentas', role: 'sublicuentas', admin: true };
async function call(db, accion, body) { const res = mkRes(); await handlePanel(db, accion, body, ident, {}, res, deps); return res.body; }
const enc = PLANTILLAS_SIMPLES.vip;
const intocable = (db) => JSON.stringify([...db._data.entries()].filter(([k]) => /^(inventario|clientes|ventas|cobros)\//.test(k)));

function semilla() {
  return {
    inventario: {
      'cm-1': { plataforma: 'vipnetflix', correo: 'cm1@prueba.test', capacidad: 1, clientes: [{ nombre: 'Cliente CM' }] },
      'cm-legado': { plataforma: 'netflixvip', correo: 'legado@prueba.test', capacidad: 1, clientes: [{ nombre: 'Cliente Legado' }] },
      'vipnetflix__bodega1@prueba_test': { plataforma: 'vipnetflix', correo: 'bodega1@prueba.test', capacidad: 1, ocupados: 0, clientes: [], estadoBodega: 'disponible', historialBodega: [] },
      'nf-premium': { plataforma: 'netflix', correo: 'premium@prueba.test', capacidad: 5 },
    },
    clientes: { 'cli-tg': { nombre: 'Cliente Telegram', servicios: [{ plataforma: 'vipnetflix', correo: 'Telegram1@Prueba.test', fechaRenovacion: '2026-12-01' }, { plataforma: 'netflix', correo: 'otro@prueba.test' }] } },
    fin_proveedores: {},
  };
}
const filas = [
  { _fila: 2, v: ['cm1@prueba.test', 'Trap colombiano', '2026-12-01', 2.5] },
  { _fila: 3, v: ['legado@prueba.test', 'Deku peruano', '2026-12-02', 2.5] },
  { _fila: 4, v: ['bodega1@prueba.test', 'Deku peruano', '2026-12-03', 2.5] },
  { _fila: 5, v: ['telegram1@prueba.test', 'Trap colombiano', '2026-12-04', 2.7] },
  { _fila: 6, v: ['​mailto:Nueva1@Prueba.test ', 'Trap colombiano', '2026-12-05', 2.5] },
  { _fila: 7, v: ['nueva1@prueba.test', 'Trap colombiano', '2026-12-05', 2.5] },
  { _fila: 8, v: ['mal-correo', 'Trap colombiano', '2026-12-05', 2.5] },
];

test('diagnóstico: antes, toda fila cuyo correo no estuviera en inventario «vipnetflix» quedaba «Sin coincidencia»; ahora se registra sin asignación', () => {
  const pv = previsualizarSimple('vip', [{ _fila: 2, v: ['x@prueba.test', 'Trap colombiano', '2026-12-01', 2.5] }], { cuentas: [], tasa: 26 });
  assert.equal(pv.filas[0].estado, 'nuevo'); assert.equal(pv.filas[0].vinculo, 'sin_asignacion'); assert.equal(pv.resumen.sinCoincidencia, 0);
  assert.equal(pv.filas[0].docId, docIdVipCorreo('x@prueba.test')); assert.equal(docIdVipCorreo('x@prueba.test'), bodega.docIdVip('x@prueba.test'), 'mismo id que Bodega');
  assert.equal(normCorreoVip(' mailto:A@B.test '), 'a@b.test');
  // Premium (6 col.) no cambia: sigue exigiendo la cuenta en Control Maestro
  const pp = previsualizarSimple('premium', [{ _fila: 2, v: ['z@prueba.test', 'BAC', 'Titular', 1234, '2026-12-01', 9.99] }], { cuentas: [] });
  assert.equal(pp.filas[0].estado, 'sin_coincidencia');
});

test('vista previa: Control Maestro, plataforma antigua, Bodega, Telegram y sin asignación; duplicados y errores; nada comercial', async () => {
  const db = fakeFirestore(semilla()); const antes = intocable(db);
  const pv = await call(db, 'finp_simple_preview', { encabezados: enc, filas, tasa: 26.5 });
  const por = Object.fromEntries(pv.filas.map((x) => [x.fila, x]));
  assert.deepEqual([por[2].vinculo, por[3].vinculo, por[4].vinculo, por[5].vinculo, por[6].vinculo], ['control_maestro', 'control_maestro', 'bodega', 'telegram', 'sin_asignacion']);
  assert.equal(por[4].bodega, 'Disponible'); assert.equal(por[4].docId, 'vipnetflix__bodega1@prueba_test');
  assert.equal(por[5].cliente, 'Cliente Telegram'); assert.equal(por[5].datos.sinInventario, true); assert.equal(por[5].datos.sinAsignacionComercial, false);
  assert.equal(por[6].correo, 'nueva1@prueba.test'); assert.equal(por[7].estado, 'duplicado'); assert.equal(por[8].estado, 'error');
  assert.deepEqual([pv.resumen.enControlMaestro, pv.resumen.enBodega, pv.resumen.enTelegram, pv.resumen.sinAsignacion, pv.resumen.sinCoincidencia, pv.resumen.ventasNuevas, pv.resumen.clientesNuevos], [2, 1, 1, 1, 0, 0, 0]);
  assert.equal(JSON.stringify(pv).includes('clave'), false, 'sin contraseñas');
  assert.equal(intocable(db), antes);
});

test('confirmar: exige confirmación y hash; guarda solo Finanzas; re-importar no duplica; deshacer restaura', async () => {
  const db = fakeFirestore(semilla()); const antes = intocable(db);
  const pv = await call(db, 'finp_simple_preview', { encabezados: enc, filas, tasa: 26.5 });
  assert.equal((await call(db, 'finp_simple_confirmar', { encabezados: enc, filas, tasa: 26.5, hash: pv.hash })).ok, false, 'sin confirmación no guarda');
  const c = await call(db, 'finp_simple_confirmar', { encabezados: enc, filas, tasa: 26.5, hash: pv.hash, confirmo: true });
  assert.equal(c.ok, true); assert.deepEqual([c.aplicados, c.vinculadas, c.sinAsignacion], [5, 3, 2]);
  const sa = db._data.get(`fin_vip_extras/${docIdVipCorreo('nueva1@prueba.test')}`).data;
  assert.deepEqual([sa.cmId, sa.sinInventario, sa.sinAsignacionComercial, sa.costoMensualUsdt, sa.proximoPagoProveedor], ['', true, true, 2.5, '2026-12-05']);
  assert.equal(db._data.get('fin_vip_extras/cm-legado').data.cmId, 'cm-legado');
  assert.equal(intocable(db), antes, 'Control Maestro, Bodega, clientes y ventas intactos');
  const pv2 = await call(db, 'finp_simple_preview', { encabezados: enc, filas, tasa: 26.5 });
  assert.equal(pv2.resumen.sinCambios, 5); assert.equal(pv2.resumen.nuevos, 0);
  const lista = await call(db, 'finp_vip_lista', {});
  const fila = lista.filas.find((f) => f.correo === 'nueva1@prueba.test');
  assert.equal(fila.estadoCM, 'sin_asignacion'); assert.equal(fila.sinInventario, true);
  assert.equal(lista.filas.filter((f) => f.correo === 'bodega1@prueba.test').length, 1, 'Bodega no se duplica en la lista');
  const ed = await call(db, 'finp_vip_editar', { cmId: docIdVipCorreo('nueva1@prueba.test'), cambios: { costoMensualUsdt: 2.4 } });
  assert.equal(ed.ok, true); assert.equal(db._data.get(`fin_vip_extras/${docIdVipCorreo('nueva1@prueba.test')}`).data.costoMensualUsdt, 2.4);
  const db2 = fakeFirestore(semilla()); const pvb = await call(db2, 'finp_simple_preview', { encabezados: enc, filas, tasa: 26.5 });
  const cb = await call(db2, 'finp_simple_confirmar', { encabezados: enc, filas, tasa: 26.5, hash: pvb.hash, confirmo: true });
  const d = await call(db2, 'finp_vip_deshacer', { jobId: cb.jobId });
  assert.equal(d.ok, true); assert.equal([...db2._data.keys()].some((k) => k.startsWith('fin_vip_extras/')), false);
});

test('Bodega: cargar después y entregar enlaza automáticamente el costo ya registrado (sin venta nueva)', async () => {
  const db = fakeFirestore(semilla());
  const f1 = [{ _fila: 2, v: ['futura@prueba.test', 'Deku peruano', '2026-12-09', 2.5] }];
  const pv = await call(db, 'finp_simple_preview', { encabezados: enc, filas: f1, tasa: 26 });
  await call(db, 'finp_simple_confirmar', { encabezados: enc, filas: f1, tasa: 26, hash: pv.hash, confirmo: true });
  const im = await bodega.importar(db, { texto: 'futura@prueba.test | ClaveFicticia1', proveedor: 'Deku peruano', usuario: 'prueba' });
  assert.equal(im.disponibles, 1);
  const id = bodega.docIdVip('futura@prueba.test');
  const lista = await call(db, 'finp_vip_lista', {});
  assert.equal(lista.filas.filter((f) => f.correo === 'futura@prueba.test').length, 1, 'al cargarla a Bodega se ve una sola vez, ya con su costo');
  const r = await bodega.asignar(db, { inventarioId: id, clienteId: 'cli-tg', compraId: 'compra-prueba', nombre: 'Cliente Telegram', usuario: 'prueba' });
  assert.deepEqual(r.costoFinanzas, { costoMensualUsdt: 2.5, proveedor: 'Deku peruano' });
  const fin = db._data.get(`fin_vip_extras/${id}`).data;
  assert.deepEqual([fin.cmId, fin.sinInventario, fin.sinAsignacionComercial, fin.vinculoComercial.clienteId, fin.costoMensualUsdt], [id, false, false, 'cli-tg', 2.5]);
  assert.equal([...db._data.keys()].some((k) => k.startsWith('ventas/')), false, 'no crea venta');
});

test('Bodega: si el registro financiero quedó con otro id (unidad antigua), se enlaza sin duplicar', async () => {
  const db = fakeFirestore({ inventario: { 'legacy-9': { plataforma: 'vipnetflix', correo: 'nueve@prueba.test', capacidad: 1, ocupados: 0, clientes: [] } }, fin_vip_extras: { [docIdVipCorreo('nueve@prueba.test')]: { correo: 'nueve@prueba.test', cmId: '', sinInventario: true, sinAsignacionComercial: true, costoMensualUsdt: 2.7, proveedor: 'Trap colombiano', estadoSeguimiento: 'activo' } } });
  const r = await bodega.asignar(db, { inventarioId: 'legacy-9', clienteId: 'c9', usuario: 'prueba' });
  assert.equal(r.costoFinanzas.costoMensualUsdt, 2.7);
  assert.equal(db._data.get('fin_vip_extras/legacy-9').data.cmId, 'legacy-9');
  assert.equal(db._data.get(`fin_vip_extras/${docIdVipCorreo('nueve@prueba.test')}`).data.estadoSeguimiento, 'vinculado');
  const lista = await call(db, 'finp_vip_lista', {});
  assert.equal(lista.filas.filter((f) => f.correo === 'nueve@prueba.test').length, 1);
});

test('Web: vista previa muestra el vínculo y la confirmación aclara que no se crean ventas ni cuentas', () => {
  const w = fs.readFileSync(new URL('../finanzas-web.js', import.meta.url), 'utf8');
  assert.match(w, /Sin asignación comercial/); assert.match(w, /Vínculo \/ cliente/); assert.match(w, /No se crean clientes, ventas ni cuentas en Control Maestro/);
  assert.match(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /finanzas-web\.js\?v=2026\d{4}-r(19(6[y-z]|[7-9])|2\d\d)/);
});
