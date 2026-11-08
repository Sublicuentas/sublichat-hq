// R196 · Spotify Premium Familiar en Control Maestro (especificación §17.5): 1 cuenta madre + 5 espacios.
// Firestore en memoria con transacciones; correos y clientes ficticios. No toca Netflix ni otras plataformas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
const require = createRequire(import.meta.url);
const S = require('../api/_spotify-familias.js');

const semilla = () => ({
  clientes: {
    ana: { nombre: 'Ana Prueba', servicios: [{ compraId: 'sp-ana', plataforma: 'spotify', correo: 'inv1@ejemplo.com', fechaRenovacion: '04/12/2026', precio: 120 }] },
    beto: { nombre: 'Beto Prueba', servicios: [{ compraId: 'sp-beto', plataforma: 'Spotify Premium', correo: 'inv2@ejemplo.com', fechaRenovacion: '01/11/2026', precio: 120 }] },
    caro: { nombre: 'Caro Prueba', servicios: [{ compraId: 'sp-caro', plataforma: 'spotify', correo: 'inv3@ejemplo.com', fechaRenovacion: '20/12/2026', precio: 120 }, { compraId: 'nf-caro', plataforma: 'netflix', correo: 'nf@ejemplo.com', fechaRenovacion: '20/12/2026', precio: 150 }] },
  },
  inventario: { 'nf-1': { plataforma: 'netflix', correo: 'nf@ejemplo.com', capacidad: 5, ocupados: 1 }, 'vip-1': { plataforma: 'vipnetflix', correo: 'v1@ejemplo.com' } },
});
async function familiaCon3(db) {
  const f = await S.crearFamilia(db, { madreCorreo: 'madre@ejemplo.com', usuario: 'naara' });
  await S.vincularInvitado(db, { familiaId: f.id, correo: 'inv1@ejemplo.com', clienteId: 'ana', compraId: 'sp-ana', usuario: 'naara' });
  await S.vincularInvitado(db, { familiaId: f.id, correo: 'inv2@ejemplo.com', clienteId: 'beto', compraId: 'sp-beto', usuario: 'naara' });
  await S.vincularInvitado(db, { familiaId: f.id, correo: 'inv3@ejemplo.com', clienteId: 'caro', compraId: 'sp-caro', usuario: 'naara', pendiente: true });
  return f;
}

test('17.5 · una madre con 3 ocupados muestra EXACTAMENTE 5 filas: 3 ocupadas/pendiente y 2 disponibles; cliente y vencimiento salen de la ficha', async () => {
  const db = fakeFirestore(semilla());
  await familiaCon3(db);
  const [p] = await S.panelFamilias(db, { hoy: '2026-11-08' });
  assert.equal(p.espacios.length, 5);
  assert.deepEqual(p.espacios.map((e) => e.estado), ['ocupado', 'ocupado', 'pendiente', 'disponible', 'disponible']);
  assert.equal(p.ocupados, 3); assert.equal(p.libres, 2);
  assert.deepEqual([p.espacios[0].cliente, p.espacios[0].vence], ['Ana Prueba', '2026-12-04']);
  assert.equal(p.espacios[1].vencido, true, 'Beto venció el 01/11/2026');
});

test('17.5 · vincular dos veces el mismo correo con la misma ficha es idempotente (no duplica ni consume otro espacio)', async () => {
  const db = fakeFirestore(semilla());
  const f = await familiaCon3(db);
  const r = await S.vincularInvitado(db, { familiaId: f.id, correo: 'INV1@ejemplo.com ', clienteId: 'ana', compraId: 'sp-ana' });
  assert.equal(r.idempotente, true);
  const [p] = await S.panelFamilias(db, {});
  assert.equal(p.ocupados, 3);
  assert.equal(db._data.get('clientes/ana').data.servicios.length, 1);
  await assert.rejects(S.vincularInvitado(db, { familiaId: f.id, correo: 'inv1@ejemplo.com', clienteId: 'beto', compraId: 'sp-beto' }), /Vincular ficha/);
});

test('17.5 · «pendiente de retirada» sigue ocupando; liberar exige confirmación del retiro', async () => {
  const db = fakeFirestore(semilla());
  await familiaCon3(db);
  await S.marcarMiembro(db, { correo: 'inv2@ejemplo.com', retiroPendiente: true, usuario: 'naara' });
  let [p] = await S.panelFamilias(db, {});
  assert.equal(p.espacios[1].estado, 'retiro_pendiente'); assert.equal(p.ocupados, 3, 'no se liberó solo');
  await assert.rejects(S.liberarEspacio(db, { correo: 'inv2@ejemplo.com' }), /retirado/);
  await S.liberarEspacio(db, { correo: 'inv2@ejemplo.com', confirmoRetiro: true, usuario: 'naara' });
  [p] = await S.panelFamilias(db, {});
  assert.equal(p.ocupados, 2); assert.equal(p.espacios[1].estado, 'disponible', 'la posición 2 queda libre; las demás no se mueven');
  assert.equal(p.espacios[2].correo, 'inv3@ejemplo.com');
  const beto = db._data.get('clientes/beto').data.servicios[0];
  assert.deepEqual([beto.fechaRenovacion, beto.precio], ['01/11/2026', 120], 'no cambia cobro ni fecha del cliente');
});

test('17.5 · cambiar el correo conserva cliente, posición, vencimiento e historial; el índice viejo queda inactivo', async () => {
  const db = fakeFirestore(semilla());
  await familiaCon3(db);
  await S.cambiarCorreo(db, { correoActual: 'inv1@ejemplo.com', correoNuevo: 'nuevo1@ejemplo.com', usuario: 'naara' });
  const [p] = await S.panelFamilias(db, {});
  const e = p.espacios[0];
  assert.deepEqual([e.correo, e.cliente, e.vence, e.posicion], ['nuevo1@ejemplo.com', 'Ana Prueba', '2026-12-04', 1]);
  assert.equal(e.historialCorreos.at(-1).antes, 'inv1@ejemplo.com');
  const ana = db._data.get('clientes/ana').data.servicios[0];
  assert.deepEqual([ana.correo, ana.fechaRenovacion, ana.precio, ana.compraId], ['nuevo1@ejemplo.com', '04/12/2026', 120, 'sp-ana']);
  assert.equal(db._data.get('spotify_indice/inv1@ejemplo.com').data.activo, false);
  assert.equal(p.ocupados, 3);
});

test('17.5 · mover entre familias es transaccional: origen libera, destino ocupa, ficha intacta', async () => {
  const db = fakeFirestore(semilla());
  const f = await familiaCon3(db);
  const g = await S.crearFamilia(db, { madreCorreo: 'madre2@ejemplo.com' });
  await S.moverInvitado(db, { correo: 'inv3@ejemplo.com', destinoId: g.id, usuario: 'naara' });
  const ps = await S.panelFamilias(db, {});
  const pf = ps.find((x) => x.id === f.id), pg = ps.find((x) => x.id === g.id);
  assert.equal(pf.ocupados, 2); assert.equal(pg.ocupados, 1);
  assert.equal(pg.espacios[0].cliente, 'Caro Prueba');
  assert.equal(db._data.get('clientes/caro').data.servicios[0].fechaRenovacion, '20/12/2026');
});

test('17.5 · Netflix y VIP de Control Maestro no se tocan', async () => {
  const db = fakeFirestore(semilla());
  const antes = JSON.stringify([db._data.get('inventario/nf-1'), db._data.get('inventario/vip-1'), db._data.get('clientes/caro').data.servicios[1]]);
  await familiaCon3(db);
  await S.cambiarCorreo(db, { correoActual: 'inv3@ejemplo.com', correoNuevo: 'otro3@ejemplo.com' });
  assert.equal(JSON.stringify([db._data.get('inventario/nf-1'), db._data.get('inventario/vip-1'), db._data.get('clientes/caro').data.servicios[1]]), antes);
});

test('Control Maestro: el cambio fuera de Spotify son SOLO 2 líneas (contenedor + montaje), ambas condicionadas a Spotify', () => {
  const src = fs.readFileSync(new URL('../control-maestro.js', import.meta.url), 'utf8');
  const lineas = src.split('\n').filter((l) => /R196/.test(l));
  assert.equal(lineas.length, 2);
  assert.ok(lineas.every((l) => /accountPlatform===\'spotify\'/.test(l)));
  const ui = fs.readFileSync(new URL('../control-maestro-spotify.js', import.meta.url), 'utf8');
  assert.match(ui, /SublichatSpotifyCM/);
  assert.doesNotMatch(ui.replace(/^\s*\/?\*.*$/gm, ''), /vipnetflix|plataforma: *'netflix'/i, 'la UI de Spotify no maneja Netflix');
});
