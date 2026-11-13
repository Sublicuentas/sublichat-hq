// R188 · Fase 4: Spotify Familiar (PDF casos S01–S05). Firestore en memoria con transacciones; correos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
const require = createRequire(import.meta.url);
const S = require('../api/_spotify-familias.js');

const semilla = () => ({ clientes: {
  ana: { nombre: 'Ana López', servicios: [{ compraId: 'c-sp-ana', plataforma: 'spotify', correo: 'cuenta02@ejemplo.com', fechaRenovacion: '04/12/2026' }] },
  beto: { nombre: 'Beto Ruiz', servicios: [{ compraId: 'c-nf', plataforma: 'netflix', correo: 'x@x.hn' }] },
} });
const n = (db, pre) => [...db._data.keys()].filter((k) => k.startsWith(pre)).length;

test('S01: madre + 5 invitados = 6 registros lógicos, capacidad 5, ningún invitado duplicado; madre duplicada se rechaza', async () => {
  const db = fakeFirestore(semilla());
  const f = await S.crearFamilia(db, { madreCorreo: 'Principal@Ejemplo.com ', usuario: 'naara' });
  assert.equal(f.codigo, 'SP-001'); assert.equal(f.madreCorreo, 'principal@ejemplo.com'); assert.equal(f.capacidad, 5);
  for (let i = 1; i <= 5; i++) await S.vincularInvitado(db, { familiaId: f.id, correo: `cuenta0${i}@ejemplo.com`, usuario: 'naara' });
  const l = await S.leerFamilia(db, f.id);
  assert.equal(l.ocupados, 5); assert.equal(new Set(l.miembros.map((m) => m.correo)).size, 5);
  assert.equal(n(db, 'spotify_indice/'), 6, '1 madre + 5 invitados');
  await assert.rejects(S.crearFamilia(db, { madreCorreo: 'principal@ejemplo.com' }), /ya es madre/);
  await assert.rejects(S.vincularInvitado(db, { familiaId: f.id, correo: 'principal@ejemplo.com' }), /ya|madre/);
  const g = await S.crearFamilia(db, { madreCorreo: 'otra@ejemplo.com' });
  assert.equal(g.codigo, 'SP-002');
  await assert.rejects(S.vincularInvitado(db, { familiaId: g.id, correo: 'cuenta01@ejemplo.com' }), /ya está como invitado en SP-001\. Un correo solo puede estar en una cuenta/, 'exclusividad: un invitado activo en 1 sola familia');
  const menos = await S.crearFamilia(db, { madreCorreo: 'tres@ejemplo.com' });
  assert.equal(menos.ocupados, 0, 'una familia con menos de cinco se puede guardar');
});

test('S02: sexto invitado se bloquea en el servidor y no altera cupos', async () => {
  const db = fakeFirestore(semilla());
  const f = await S.crearFamilia(db, { madreCorreo: 'm@ejemplo.com' });
  for (let i = 1; i <= 5; i++) await S.vincularInvitado(db, { familiaId: f.id, correo: `i${i}@ejemplo.com` });
  const antes = JSON.stringify(db._data.get(`spotify_familias/${f.id}`).data);
  await assert.rejects(S.vincularInvitado(db, { familiaId: f.id, correo: 'sexto@ejemplo.com' }), /llena \(5 de 5\): no se agregó nada/);
  assert.equal(JSON.stringify(db._data.get(`spotify_familias/${f.id}`).data), antes);
  assert.equal(db._data.has('spotify_indice/sexto@ejemplo.com'), false);
  // carrera: dos altas a la vez con 1 espacio libre → solo una entra
  const g = await S.crearFamilia(db, { madreCorreo: 'g@ejemplo.com' });
  for (let i = 1; i <= 4; i++) await S.vincularInvitado(db, { familiaId: g.id, correo: `g${i}@ejemplo.com` });
  const r = await Promise.allSettled([S.vincularInvitado(db, { familiaId: g.id, correo: 'a@ejemplo.com' }), S.vincularInvitado(db, { familiaId: g.id, correo: 'b@ejemplo.com' })]);
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1); assert.equal((await S.leerFamilia(db, g.id)).ocupados, 5);
});

test('S03: vincular un correo antiguo → mismo cliente, misma ficha e historial; el servicio queda con su familia', async () => {
  const db = fakeFirestore(semilla());
  const f = await S.crearFamilia(db, { madreCorreo: 'principal@ejemplo.com' });
  const encontrados = await S.buscarServiciosSpotify(db, 'cuenta02');
  assert.deepEqual(encontrados.map((x) => [x.clienteId, x.compraId]), [['ana', 'c-sp-ana']]);
  await S.vincularInvitado(db, { familiaId: f.id, correo: 'cuenta02@ejemplo.com', clienteId: 'ana', compraId: 'c-sp-ana', usuario: 'libni' });
  const ana = db._data.get('clientes/ana').data;
  assert.equal(ana.servicios.length, 1, 'no se duplicó el servicio');
  assert.deepEqual([ana.servicios[0].compraId, ana.servicios[0].fechaRenovacion, ana.servicios[0].spotifyFamiliaCodigo, ana.servicios[0].spotifyMadreCorreo], ['c-sp-ana', '04/12/2026', 'SP-001', 'principal@ejemplo.com']);
  assert.equal(n(db, 'clientes/'), 2, 'no se creó otro cliente');
});

test('S04: registrar por bot/Web/APK un correo ya vinculado → la familia se resuelve sola y la ficha queda marcada', async () => {
  const db = fakeFirestore(semilla());
  const f = await S.crearFamilia(db, { madreCorreo: 'principal@ejemplo.com' });
  await S.vincularInvitado(db, { familiaId: f.id, correo: 'nuevo@ejemplo.com' });
  db._data.set('clientes/caro', { v: 1, data: { nombre: 'Caro', servicios: [{ compraId: 'c-sp-caro', plataforma: 'spotify', correo: 'nuevo@ejemplo.com' }] } });
  const r = await S.resolverCorreo(db, 'NUEVO@ejemplo.com');
  assert.deepEqual([r.tipo, r.codigo, r.madreCorreo, r.posicion, r.capacidad], ['invitado', 'SP-001', 'principal@ejemplo.com', 1, 5]);
  const a = await S.asignarServicio(db, { correo: 'nuevo@ejemplo.com', clienteId: 'caro', compraId: 'c-sp-caro' });
  assert.equal(a.familia.codigo, 'SP-001');
  assert.equal(db._data.get('clientes/caro').data.servicios[0].spotifyFamiliaId, f.id);
  assert.equal((await S.leerFamilia(db, f.id)).miembros[0].clienteId, 'caro');
  assert.deepEqual(await S.asignarServicio(db, { correo: 'suelto@ejemplo.com', clienteId: 'caro', compraId: 'x' }), { familia: null, requiereSeleccion: true }, 'sin familia: no crea nada');
});

test('S05: mover de SP-001 a SP-002 → cupo viejo libre, nuevo ocupado, auditoría; desvincular nunca borra al cliente', async () => {
  const db = fakeFirestore(semilla());
  const a = await S.crearFamilia(db, { madreCorreo: 'm1@ejemplo.com' }), b = await S.crearFamilia(db, { madreCorreo: 'm2@ejemplo.com' });
  await S.vincularInvitado(db, { familiaId: a.id, correo: 'cuenta02@ejemplo.com', clienteId: 'ana', compraId: 'c-sp-ana' });
  const r = await S.moverInvitado(db, { correo: 'cuenta02@ejemplo.com', destinoId: b.id, usuario: 'naara' });
  assert.deepEqual([r.origen.codigo, r.origen.ocupados, r.destino.codigo, r.destino.ocupados], ['SP-001', 0, 'SP-002', 1]);
  assert.equal(db._data.get('clientes/ana').data.servicios[0].spotifyFamiliaCodigo, 'SP-002');
  const aud = [...db._data.entries()].filter(([k]) => k.startsWith('auditoria_eventos/')).map(([, v]) => v.data);
  assert.ok(aud.some((x) => x.accion === 'mover' && x.antes.codigo === 'SP-001' && x.despues.codigo === 'SP-002' && x.usuario === 'naara'));
  const d = await S.desvincular(db, { correo: 'cuenta02@ejemplo.com', usuario: 'naara' });
  assert.match(d.advertencia, /ficha Spotify activa/);
  assert.ok(db._data.has('clientes/ana'), 'el cliente sigue'); assert.equal(db._data.get('clientes/ana').data.servicios[0].compraId, 'c-sp-ana');
  assert.equal(db._data.get('clientes/ana').data.servicios[0].spotifyFamiliaId, undefined);
  assert.equal((await S.leerFamilia(db, b.id)).ocupados, 0);
  assert.equal(await S.resolverCorreo(db, 'cuenta02@ejemplo.com'), null);
  await S.vincularInvitado(db, { familiaId: a.id, correo: 'cuenta02@ejemplo.com' }); // se puede volver a vincular
});

test('cableado: servidor con permiso propio, ficha Web consulta la familia, la ficha guardada se asigna sola, sin contraseña Spotify', () => {
  const inv = fs.readFileSync(new URL('../api/inventario.js', import.meta.url), 'utf8');
  for (const a of ['spotifyFamilias', 'spotifyResolver', 'spotifyBuscar', 'spotifyCrear', 'spotifyVincular', 'spotifyMover', 'spotifyDesvincular']) assert.match(inv, new RegExp(`"${a}"`));
  assert.match(inv, /PERMISOS\.aplicar\(permisosCtx, "spotify-familias"/);
  assert.match(fs.readFileSync(new URL('../api/_permisos.js', import.meta.url), 'utf8'), /id: 'spotify-familias'/);
  assert.match(fs.readFileSync(new URL('../api/renovar.js', import.meta.url), 'utf8'), /spotifyFam\.asignarServicio\(db/);
  const web = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(web, /async function invSpotifyFamilias\(\)/); assert.match(web, /accion:"spotifyResolver"/);
  // R196c/f · solo la cuenta madre lleva clave (pedido del 08/11/2026); los invitados (clientes) nunca.
  assert.doesNotMatch(fs.readFileSync(new URL('../api/_spotify-familias.js', import.meta.url), 'utf8').replace(/clave: f\.madreClave \|\| ""/g, ''), /clave\s*:/, 'no guarda contraseña de los invitados');
});
