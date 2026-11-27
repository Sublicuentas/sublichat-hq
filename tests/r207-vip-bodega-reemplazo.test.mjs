// R207 · Netflix VIP: «sin unidad en Bodega» → Bodega ya asignado a su cliente; reemplazar A por un correo NUEVO B
// (A desaparece, la ficha pasa a B, B entra a Finanzas). Datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
import { handlePanel, docIdVipCorreo } from '../api/_finanzas-panel.js';
const require = createRequire(import.meta.url);
const bodega = require('../api/_bodega-vip.js');

function mkRes() { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; }
const deps = { hoyYmdHN: () => '2026-11-27', auditar: (tx, db, identity, ev) => tx.set(db.collection('auditoria_eventos').doc(), { ...ev, actor: identity.usuario }) };
const ident = { usuario: 'sublicuentas', role: 'sublicuentas', admin: true };
async function call(db, accion, body) { const res = mkRes(); await handlePanel(db, accion, body, ident, {}, res, deps); return res.body; }
const get = async (db, c, id) => { const s = await db.collection(c).doc(id).get(); return s.exists ? s.data() : null; };
const idA = docIdVipCorreo('ana.extra@prueba.test');
function semilla() {
  return {
    inventario: {},
    clientes: {
      'cli-ana': { nombre: 'Ana Prueba', servicios: [{ plataforma: 'vipnetflix', correo: 'ana.extra@prueba.test', clave: 'vieja', compraId: 'cp1', precio: 150, fechaRenovacion: '2026-12-09' }] },
      'cli-dos': { nombre: 'Uno', servicios: [{ plataforma: 'vipnetflix', correo: 'doble@prueba.test' }] },
      'cli-tres': { nombre: 'Dos', servicios: [{ plataforma: 'vipnetflix', correo: 'doble@prueba.test' }] },
    },
    fin_vip_extras: {
      [idA]: { correo: 'ana.extra@prueba.test', proveedorId: 'deku-peru', proveedor: 'Deku peruano', grupo: 'deku', costoMensualUsdt: 2.5, tasa: 28, costoMensualHnl: 70, proximoPagoProveedor: '2026-12-09', estadoSeguimiento: 'activo', sinInventario: true, sinAsignacionComercial: false, asignacionesTelegram: [{ clienteId: 'cli-ana', nombre: 'Ana Prueba' }] },
      [docIdVipCorreo('doble@prueba.test')]: { correo: 'doble@prueba.test', proveedor: 'Deku peruano', estadoSeguimiento: 'activo', sinInventario: true },
      [docIdVipCorreo('solo@prueba.test')]: { correo: 'solo@prueba.test', proveedor: 'Trap colombiano', estadoSeguimiento: 'activo', sinInventario: true },
    },
    fin_proveedores: {},
  };
}

test('vista previa: listo / varios clientes / sin cliente', async () => {
  const db = fakeFirestore(semilla());
  const r = await call(db, 'finp_vip_bodega_preview', {});
  assert.equal(r.ok, true); assert.deepEqual([r.conteo.listo, r.conteo.varios_clientes, r.conteo.sin_cliente], [1, 1, 1]);
});

test('pasar: la unidad entra ASIGNADA a su cliente, ligada a Finanzas y sin tocar la ficha', async () => {
  const db = fakeFirestore(semilla()); const ficha = JSON.stringify(await get(db, 'clientes', 'cli-ana'));
  const r = await call(db, 'finp_vip_bodega_pasar', { ids: [idA, docIdVipCorreo('doble@prueba.test')] });
  assert.equal(r.pasados, 1); assert.equal(r.saltados[0].motivo, 'varios_clientes');
  const u = await get(db, 'inventario', idA);
  assert.equal(u.estadoBodega, 'asignado'); assert.equal(u.ocupados, 1); assert.equal(u.clientes[0].clienteId, 'cli-ana'); assert.equal(u.claveFaltante, true);
  assert.equal(bodega.estadoUnidad(u), 'asignado');
  const f = await get(db, 'fin_vip_extras', idA); assert.equal(f.sinInventario, false); assert.equal(f.cmId, idA); assert.equal(f.costoMensualUsdt, 2.5);
  assert.equal(JSON.stringify(await get(db, 'clientes', 'cli-ana')), ficha);
  // la clave se completa con la carga masiva de Bodega VIP (solo la clave)
  const pv = await bodega.previsualizar(db, 'ana.extra@prueba.test | claveNueva1');
  assert.equal(pv.completarClave.length, 1); assert.equal(pv.nuevas.length, 0);
  const im = await bodega.importar(db, { texto: 'ana.extra@prueba.test | claveNueva1', proveedor: 'Deku peruano' });
  assert.equal(im.clavesCompletadas, 1);
  const u2 = await get(db, 'inventario', idA); assert.equal(u2.clave, 'claveNueva1'); assert.equal(u2.claveFaltante, false); assert.equal(u2.clientes[0].clienteId, 'cli-ana');
});

test('reemplazo A → B: A desaparece, la ficha pasa a B y B entra a Finanzas', async () => {
  const db = fakeFirestore(semilla());
  await call(db, 'finp_vip_bodega_pasar', { ids: [idA] });
  const r = await call(db, 'finp_vip_reemplazo_nuevo', { de: idA, correo: 'Nuevo.Extra@prueba.test', clave: 'claveB1', proveedor: 'Trap colombiano', costoUsdt: '2.7', tasa: '26.5', proximoPagoProveedor: '2026-12-27', motivo: 'Sin membresía' });
  assert.equal(r.ok, true); const idB = docIdVipCorreo('nuevo.extra@prueba.test');
  assert.equal(await get(db, 'inventario', idA), null);
  assert.equal((await get(db, 'inventario_bajas', idA)).reemplazadoPor, idB);
  const b = await get(db, 'inventario', idB); assert.equal(b.clientes[0].clienteId, 'cli-ana'); assert.equal(b.clave, 'claveB1'); assert.equal(b.estadoBodega, 'asignado');
  const sv = (await get(db, 'clientes', 'cli-ana')).servicios[0];
  assert.equal(sv.correo, 'nuevo.extra@prueba.test'); assert.equal(sv.clave, 'claveB1'); assert.equal(sv.precio, 150); assert.equal(sv.fechaRenovacion, '2026-12-09'); assert.equal(sv.historialCorreo.length, 1);
  assert.equal((await get(db, 'fin_vip_extras', idA)).estadoSeguimiento, 'reemplazado');
  const fb = await get(db, 'fin_vip_extras', idB); assert.equal(fb.costoMensualUsdt, 2.7); assert.equal(fb.costoMensualHnl, 71.55); assert.equal(fb.grupo, 'trap'); assert.equal(fb.estadoSeguimiento, 'activo');
  const lista = await call(db, 'finp_vip_lista', { tab: 'todos' });
  assert.deepEqual(lista.filas.map((x) => x.correo), ['nuevo.extra@prueba.test', 'doble@prueba.test', 'solo@prueba.test'].filter((c) => lista.filas.some((x) => x.correo === c)));
  assert.ok(!lista.filas.some((x) => x.correo === 'ana.extra@prueba.test'));
});

test('reemplazo: correo B ya asignado a otro cliente → no cambia nada', async () => {
  const s = semilla(); s.inventario[docIdVipCorreo('ocupado@prueba.test')] = { plataforma: 'vipnetflix', correo: 'ocupado@prueba.test', capacidad: 1, ocupados: 1, clientes: [{ clienteId: 'x' }] };
  const db = fakeFirestore(s);
  const res = mkRes(); await handlePanel(db, 'finp_vip_reemplazo_nuevo', { de: idA, correo: 'ocupado@prueba.test', proveedor: 'Deku', costoUsdt: 2.5, tasa: 28, proximoPagoProveedor: '2026-12-27' }, ident, {}, res, deps).catch((e) => { res.body = { ok: false, error: e.message }; });
  assert.notEqual(res.body && res.body.ok, true);
  assert.equal((await get(db, 'fin_vip_extras', idA)).estadoSeguimiento, 'activo');
});
