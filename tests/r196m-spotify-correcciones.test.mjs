// R196m · PDF «Correcciones Spotify y entrega APK» — Spotify Familiar, pruebas A–F.
// Firestore en memoria con transacciones; correos y clientes ficticios. No toca producción.
// R196o · Las pruebas A(varias fichas), B, C, D y E de R196m probaban «Retiro en Spotify pendiente» y elegir entre fichas:
//   el PDF «Lógica estricta» lo reemplazó («No renovó» libera solo, sin listas). Sus versiones nuevas están en r196o-spotify-estricto.
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
    caro: { nombre: 'Caro Prueba', servicios: [{ compraId: 'sp-caro', plataforma: 'spotify', correo: 'doble@ejemplo.com', fechaRenovacion: '20/12/2026' }, { compraId: 'nf-caro', plataforma: 'netflix', correo: 'nf@ejemplo.com' }] },
    dani: { nombre: 'Dani Prueba', servicios: [{ compraId: 'sp-dani', plataforma: 'spotify', correo: 'Doble@Ejemplo.com ', fechaRenovacion: '10/12/2026' }] },
    eva: { nombre: 'Eva Prueba', servicios: [{ compraId: 'dp-eva', plataforma: 'disney', correo: 'eva@ejemplo.com' }] },
  },
});
const cuantos = async (db, col) => (await db.collection(col).get()).docs.length;
const madre = (db) => S.crearFamilia(db, { madreCorreo: 'madre@ejemplo.com', usuario: 'sublicuentas' });

test('A · alta por correo: 1 correo + Agregar; ficha única → vinculada sola (correo normalizado); ocupación correcta', async () => {
  const db = fakeFirestore(semilla());
  const f = await madre(db);
  const r = await S.agregarPorCorreo(db, { familiaId: f.id, correo: '  INV1@Ejemplo.com ', usuario: 'sublicuentas' });
  assert.equal(r.pendienteVincular, false);
  assert.deepEqual([r.ficha.clienteId, r.ficha.compraId], ['ana', 'sp-ana']);
  const [p] = await S.panelFamilias(db, { hoy: '2026-11-12' });
  assert.deepEqual([p.ocupados, p.libres, p.espacios[0].correo, p.espacios[0].cliente], [1, 4, 'inv1@ejemplo.com', 'Ana Prueba']);
  const ana = (await db.collection('clientes').doc('ana').get()).data();
  assert.equal(ana.servicios[0].spotifyFamiliaId, f.id, 'el servicio EXISTENTE queda marcado con su familia');
});

test('F · regresión: Netflix y Disney de la misma ficha no cambian; Control Maestro sin listas para agregar', async () => {
  const db = fakeFirestore(semilla());
  const f = await madre(db);
  await S.agregarPorCorreo(db, { familiaId: f.id, correo: 'doble@ejemplo.com', clienteId: 'caro', compraId: 'sp-caro' });
  await S.retirarPorBaja(db, { correo: 'doble@ejemplo.com', clienteId: 'caro', compraId: 'sp-caro', motivo: 'quitar_servicio' });
  const caro = (await db.collection('clientes').doc('caro').get()).data();
  assert.deepEqual(caro.servicios.find((s) => s.compraId === 'nf-caro'), { compraId: 'nf-caro', plataforma: 'netflix', correo: 'nf@ejemplo.com' });
  assert.deepEqual((await db.collection('clientes').doc('eva').get()).data(), semilla().clientes.eva);
  const cm = fs.readFileSync(new URL('../control-maestro-spotify.js', import.meta.url), 'utf8');
  assert.match(cm, /data-sp-alta=/); assert.match(cm, /accion: 'spotifyAgregarCorreo'/);
  assert.doesNotMatch(cm, /b\('vincular', 'Vincular invitado/, 'la alta ya no abre la búsqueda de fichas');
  const app = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /id="spfBuscar"/); assert.match(app, /accion:"spotifyAgregarCorreo"/);
  const inv = fs.readFileSync(new URL('../api/inventario.js', import.meta.url), 'utf8');
  assert.match(inv, /accion === "spotifyAgregarCorreo"/);
  const bot = fs.readFileSync(new URL('../api/_spotify-familias.js', import.meta.url), 'utf8');
  assert.match(bot, /async function retirarPorBaja/);
});
