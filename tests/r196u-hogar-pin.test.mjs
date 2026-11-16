// R196u Fase 2 · Hogar Netflix Premium (PDF 03) y PIN opcional VIP (PDF 04). Firestore en memoria, datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
const require = createRequire(import.meta.url);
const H = require('../api/_netflix-hogar.js');
const V = require('../api/_bodega-vip.js');
const R = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const madre = () => ({ plataforma: 'netflix', correo: 'premium01@ejemplo.com', capacidad: 5, clientes: [
  { clienteId: 'A', compraId: 'cA', perfilId: 'pA', nombre: 'Cliente A', slot: 1 }, { clienteId: 'B', compraId: 'cB', nombre: 'Cliente B', slot: 2 },
  { clienteId: 'C', compraId: 'cC', nombre: 'Cliente C', slot: 3 }, { clienteId: 'D', compraId: 'cD', nombre: 'Cliente D', slot: 4 }] });
const doc = (db, id) => db._data.get(`inventario/${id}`).data;

test('HOG-01 · asignar Hogar a un perfil: la madre muestra «Hogar: Cliente A · Perfil 1» y los 5 perfiles con el destacado', async () => {
  const db = fakeFirestore({ inventario: { m1: madre() } });
  assert.equal(H.estadoHogar(doc(db, 'm1')).texto, 'Hogar sin asignar');
  const r = await H.asignarHogar(db, { inventarioId: 'm1', clienteId: 'A', compraId: 'cA', usuario: 'sublicuentas' });
  assert.equal(r.texto, 'Hogar: Cliente A · Perfil 1');
  const p = H.perfilesConHogar(doc(db, 'm1'));
  assert.deepEqual(p.map((x) => [x.perfil, x.cliente, x.hogar]), [[1, 'Cliente A', true], [2, 'Cliente B', false], [3, 'Cliente C', false], [4, 'Cliente D', false], [5, 'Disponible', false]]);
  assert.equal(H.esHogar(doc(db, 'm1'), { clienteId: 'A', compraId: 'cA' }), true);
  assert.equal(H.esHogar(doc(db, 'm1'), { clienteId: 'B', compraId: 'cB' }), false);
  assert.equal(doc(db, 'm1').historialHogar.length, 1);
});

test('HOG-02 · un segundo Hogar se bloquea; solo con confirmación se reemplaza; nunca dos activos', async () => {
  const db = fakeFirestore({ inventario: { m1: madre() } });
  await H.asignarHogar(db, { inventarioId: 'm1', clienteId: 'A', compraId: 'cA' });
  await assert.rejects(H.asignarHogar(db, { inventarioId: 'm1', clienteId: 'B', compraId: 'cB' }), (e) => e.code === 'requiere_confirmacion' && /Cliente A/.test(e.message));
  assert.equal(H.estadoHogar(doc(db, 'm1')).clienteId, 'A', 'sigue el primero');
  await H.asignarHogar(db, { inventarioId: 'm1', clienteId: 'B', compraId: 'cB', confirmarReemplazo: true });
  assert.equal(H.perfilesConHogar(doc(db, 'm1')).filter((x) => x.hogar).length, 1);
  assert.equal(H.estadoHogar(doc(db, 'm1')).texto, 'Hogar: Cliente B · Perfil 2');
  assert.deepEqual(doc(db, 'm1').historialHogar.map((h) => h.tipo), ['asignado', 'reemplazado']);
});

test('HOG · reglas: solo perfiles de esa madre, solo Netflix Premium; si el cliente sale queda «pendiente» (no se reasigna solo)', async () => {
  const db = fakeFirestore({ inventario: { m1: madre(), v1: { plataforma: 'vipnetflix', correo: 'v@ejemplo.com', clientes: [{ clienteId: 'A' }] } } });
  await assert.rejects(H.asignarHogar(db, { inventarioId: 'm1', clienteId: 'Z' }), /no está en esta cuenta/);
  await assert.rejects(H.asignarHogar(db, { inventarioId: 'v1', clienteId: 'A' }), /solo aplica a cuentas madre de Netflix Premium/);
  await H.asignarHogar(db, { inventarioId: 'm1', clienteId: 'C', compraId: 'cC' });
  const d = doc(db, 'm1'); d.clientes = d.clientes.filter((c) => c.clienteId !== 'C'); // «No renovó» saca a C de la cuenta
  assert.match(H.estadoHogar(d).texto, /^Hogar pendiente: Cliente C ya no está en esta cuenta$/);
  assert.equal((await H.hogaresPendientes(db)).length, 1);
  await assert.rejects(H.asignarHogar(db, { inventarioId: 'm1', clienteId: 'D', compraId: 'cD' }), (e) => e.code === 'requiere_confirmacion');
});

test('PIN-01 · VIP sin PIN: entrega limpia; con PIN: se guarda en la unidad y en el servicio del cliente; quitar vuelve a «Sin PIN»', async () => {
  const db = fakeFirestore({ clientes: { cli1: { nombre: 'Cliente Demo', servicios: [{ compraId: 'c1', plataforma: 'vipnetflix', correo: 'vip1@ejemplo.com', precio: 150, fechaRenovacion: '20/12/2026', sinPinPerfil: true }, { compraId: 'c2', plataforma: 'netflix', pinPerfil: '9999' }] } } });
  await V.importar(db, { texto: 'vip1@ejemplo.com claveVip1', proveedor: 'Propio', usuario: 'sublicuentas' });
  const id = 'vipnetflix__vip1@ejemplo_com';
  await V.asignar(db, { inventarioId: id, clienteId: 'cli1', compraId: 'c1', nombre: 'Cliente Demo' });
  assert.equal((await V.listar(db)).unidades[0].tienePin, false);
  await assert.rejects(V.guardarPin(db, { inventarioId: id, pin: '12a' }), /4 números/);
  const r = await V.guardarPin(db, { inventarioId: id, pin: '4321', usuario: 'sublicuentas' });
  assert.deepEqual([r.etiqueta, r.servicioActualizado], ['PIN configurado', true]);
  const sv = db._data.get('clientes/cli1').data.servicios;
  assert.equal(sv[0].pinPerfil, '4321'); assert.equal(sv[0].sinPinPerfil, undefined); assert.equal(sv[0].precio, 150); assert.equal(sv[0].fechaRenovacion, '20/12/2026');
  assert.equal(sv[1].pinPerfil, '9999', 'no toca el PIN de otro acceso');
  assert.doesNotMatch(JSON.stringify(doc(db, id).historialBodega), /4321/, 'el valor del PIN no va al historial');
  await V.guardarPin(db, { inventarioId: id, pin: '' });
  const sv2 = db._data.get('clientes/cli1').data.servicios[0];
  assert.equal(sv2.pinPerfil, undefined); assert.equal(sv2.sinPinPerfil, true);
  assert.equal((await V.listar(db)).unidades[0].tienePin, false);
});

test('PIN-01 · ficha web VIP: línea de PIN solo si existe; el servidor ya no borra el PIN opcional de VIP', () => {
  const app = R('sublichat-app.js');
  assert.match(app, /const pinVipLine=fichaPinOpcional\(plat\)&&String\(pin\|\|""\)\.trim\(\)\?`\\n\*🔏 PIN de perfil: \$\{String\(pin\)\.trim\(\)\}\*`:"";/);
  assert.match(app, /\*🔑 Contraseña: \{clave\}\*\{pinVipLine\}/);
  assert.match(app, /const fichaPinOpcional=plat=>!fichaEsCuentaCompleta\(\)&&fichaBaseRegla\(plat\)==="vipnetflix";/);
  const ren = R('api/renovar.js');
  assert.match(ren, /servicio\.pinPerfil === null \|\| servicioDescartaPin\(servicio\.plataforma\); \/\/ R196u/);
  assert.match(ren, /function servicioDescartaPin\(plataforma\) \{ return servicioNoUsaPinPerfil\(plataforma\) && !servicioPinOpcional\(plataforma\); \}/);
  assert.doesNotMatch(ren, /!servicioNoUsaPinPerfil\(nuevo\.plataforma\) && !String\(p\.pinPerfil \|\| ""\)\.trim\(\)\) throw[\s\S]{0,40}servicioPinOpcional/, 'VIP sigue sin exigir PIN');
});

test('ALL-02 · API: asignar/quitar Hogar y PIN VIP solo Sublicuentas o permiso explícito', () => {
  const s = R('api/inventario.js');
  assert.match(s, /const adminHogar = spotifyFam\.esAdministradorMadres\(authUser\) \|\| permisosCtx\.overrides\?\.\["hogar-netflix"\] === true;/);
  assert.match(s, /if \(!adminHogar\) return res\.status\(403\)/);
  assert.ok(s.indexOf('if (/^hogar[A-Z]/.test(accion))') > s.indexOf('const puedeInventario'));
});
