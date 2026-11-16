// R196u · Bodega Netflix VIP (PDF v2.0 · 01/02). Firestore en memoria, datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
const require = createRequire(import.meta.url);
const V = require('../api/_bodega-vip.js');
const R = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const lote = (n, desde = 1) => Array.from({ length: n }, (_, i) => `demo.vip${String(desde + i).padStart(2, '0')}@ejemplo.com | Clave${desde + i}xY`).join('\n');
const meta = { proveedor: 'Deku peruano', lote: 'compra del día', costoUsdt: '3.5', usuario: 'sublicuentas' };

test('VIP-01 · lote de 10: vista previa sin claves → importar → 10 disponibles con proveedor/lote/costo', async () => {
  const db = fakeFirestore({});
  const p = await V.previsualizar(db, lote(10));
  assert.equal(p.nuevas.length, 10); assert.equal(p.total, 10);
  assert.doesNotMatch(JSON.stringify(p), /Clave\d/, 'la vista previa no trae claves');
  const r = await V.importar(db, { texto: lote(10), ...meta });
  assert.equal(r.resumen, '10 disponibles / 0 ya existentes / 0 errores');
  const l = await V.listar(db);
  assert.equal(l.conteo.disponible, 10);
  assert.ok(l.unidades.every((u) => u.proveedor === 'Deku peruano' && u.lote === 'compra del día' && u.costoUsdt === 3.5 && u.vencimientoProveedor === 'sin confirmar' && u.tieneClave));
  assert.doesNotMatch(JSON.stringify(l), /Clave\d/, 'el listado no trae claves');
  const d = db._data.get('inventario/vipnetflix__demo_vip01@ejemplo_com').data;
  assert.equal(d.plataforma, 'vipnetflix'); assert.equal(d.capacidad, 1); assert.ok(String(d.clave).startsWith('Clave'), 'la clave sí queda guardada en la unidad');
});

test('VIP-02 · reimportar el mismo lote: 0 duplicados; nada de claves en auditoría', async () => {
  const db = fakeFirestore({});
  await V.importar(db, { texto: lote(10), ...meta });
  const r = await V.importar(db, { texto: lote(10), ...meta });
  assert.equal(r.resumen, '0 disponibles / 10 ya existentes / 0 errores');
  assert.equal((await V.listar(db)).unidades.length, 10);
  const audit = [...db._data.entries()].filter(([k]) => k.startsWith('auditoria_eventos/')).map(([, v]) => JSON.stringify(v.data)).join(' ');
  assert.match(audit, /bodega_vip_lote/); assert.doesNotMatch(audit, /Clave\d/);
});

test('VIP · mezcla: repetidas, inválidas y correos que ya son Netflix Premium no entran; resultado por línea sin claves', async () => {
  const db = fakeFirestore({ inventario: { prem: { plataforma: 'netflix', correo: 'premium01@ejemplo.com', capacidad: 5 } } });
  const texto = ['a@ejemplo.com clave111', 'a@ejemplo.com clave222', 'sin-arroba clave', 'b@ejemplo.com', 'premium01@ejemplo.com | x123', 'C@Ejemplo.com ; clave333'].join('\n');
  const r = await V.importar(db, { texto, ...meta });
  assert.equal(r.disponibles, 2, 'a@ y c@ (normalizado a minúsculas)');
  assert.deepEqual(r.fallas.map((f) => f.motivo).sort(), ['correo inválido', 'ese correo ya es una cuenta Netflix Premium', 'falta la clave', 'repetido en el lote']);
  assert.doesNotMatch(JSON.stringify(r), /clave\d{3}/);
});

test('VIP-03 · entregar a una venta EXISTENTE: Asignado, sin tocar la ficha del cliente', async () => {
  const cliente = { nombre: 'Cliente Demo', servicios: [{ compraId: 'c1', plataforma: 'vipnetflix', precio: 150, fechaRenovacion: '20/12/2026' }] };
  const db = fakeFirestore({ clientes: { cli1: cliente } });
  await V.importar(db, { texto: lote(1), ...meta });
  const [u] = (await V.listar(db)).unidades;
  const r = await V.asignar(db, { inventarioId: u.id, clienteId: 'cli1', compraId: 'c1', nombre: 'Cliente Demo', usuario: 'sublicuentas' });
  assert.equal(r.estado, 'asignado');
  const l = await V.listar(db); assert.equal(l.unidades[0].estado, 'asignado'); assert.equal(l.unidades[0].cliente, 'Cliente Demo');
  assert.deepEqual(db._data.get('clientes/cli1').data, cliente, 'fecha y precio del cliente intactos');
  assert.equal([...db._data.keys()].filter((k) => /finanzas|ventas/.test(k)).length, 0, 'no crea venta ni ingreso');
});

test('VIP-04 · dos vendedores toman la misma unidad a la vez: una asignación válida, la otra rechazada', async () => {
  const db = fakeFirestore({});
  await V.importar(db, { texto: lote(1), ...meta });
  const [u] = (await V.listar(db)).unidades;
  const rs = await Promise.allSettled([V.asignar(db, { inventarioId: u.id, clienteId: 'A', usuario: 'vend1' }), V.asignar(db, { inventarioId: u.id, clienteId: 'B', usuario: 'vend2' })]);
  assert.equal(rs.filter((x) => x.status === 'fulfilled').length, 1);
  assert.match(String(rs.find((x) => x.status === 'rejected').reason.message), /ya está asignado/);
});

test('VIP · suspender / revisión con historial; una suspendida no se puede asignar', async () => {
  const db = fakeFirestore({});
  await V.importar(db, { texto: lote(1), ...meta });
  const [u] = (await V.listar(db)).unidades;
  await V.marcarEstado(db, { inventarioId: u.id, estado: 'suspendido', nota: 'proveedor la cayó', usuario: 'sublicuentas' });
  await assert.rejects(V.asignar(db, { inventarioId: u.id, clienteId: 'A' }), /suspendido/);
  await V.marcarEstado(db, { inventarioId: u.id, estado: 'disponible', usuario: 'sublicuentas' });
  assert.equal((await V.listar(db)).unidades[0].estado, 'disponible');
});

test('VIP · cuentas VIP que ya existían (sin campos nuevos) se leen bien y no se reescriben', async () => {
  const viejo = { plataforma: 'vipnetflix', correo: 'vieja@ejemplo.com', clave: 'x', capacidad: 1, ocupados: 1, clientes: [{ clienteId: 'z', nombre: 'Cliente Viejo' }] };
  const db = fakeFirestore({ inventario: { viejo } });
  const l = await V.listar(db);
  assert.deepEqual([l.unidades[0].estado, l.unidades[0].proveedor, l.unidades[0].cliente], ['asignado', 'sin proveedor', 'Cliente Viejo']);
  await V.importar(db, { texto: 'vieja@ejemplo.com otraClave', ...meta });
  assert.deepEqual(db._data.get('inventario/viejo').data, viejo, 'nunca sobrescribe clave ni proveedor existentes');
});

test('ALL-02 · API: solo Sublicuentas o permiso explícito carga lotes; las acciones VIP no devuelven claves', () => {
  const s = R('api/inventario.js');
  assert.match(s, /\["vipPrevisualizar", "vipImportar", "vipEstado"\]\.includes\(accion\) && !adminVip\) return res\.status\(403\)/);
  assert.match(s, /const adminVip = spotifyFam\.esAdministradorMadres\(authUser\) \|\| permisosCtx\.overrides\?\.\["bodega-vip"\] === true;/);
  const i = s.indexOf('if (/^vip[A-Z]/.test(accion))'), j = s.indexOf('const puedeInventario');
  assert.ok(j > 0 && i > j, 'el bloque VIP va después del control general de inventario');
});
