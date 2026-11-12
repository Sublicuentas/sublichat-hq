// R196m · PDF «Correcciones Spotify y entrega APK» — Spotify Familiar, pruebas A–F.
// Firestore en memoria con transacciones; correos y clientes ficticios. No toca producción.
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

test('A · sin ficha → «pendiente de vincular» (no crea cliente, venta ni renovación); varias fichas → se elige solo entre esas', async () => {
  const db = fakeFirestore(semilla());
  const f = await madre(db);
  const antes = await cuantos(db, 'clientes');
  const r = await S.agregarPorCorreo(db, { familiaId: f.id, correo: 'nuevo@ejemplo.com' });
  assert.equal(r.pendienteVincular, true); assert.match(r.aviso, /pendiente de vincular/);
  assert.equal(await cuantos(db, 'clientes'), antes, 'no se creó cliente');
  const [p] = await S.panelFamilias(db, { hoy: '2026-11-12' });
  assert.equal(p.espacios[0].sinFicha, true);
  const amb = await S.agregarPorCorreo(db, { familiaId: f.id, correo: 'doble@ejemplo.com' });
  assert.equal(amb.requiereElegir, true);
  assert.deepEqual(amb.opciones.map((o) => o.clienteId).sort(), ['caro', 'dani'], 'solo las coincidencias, no la lista completa');
  assert.equal((await S.leerFamilia(db, f.id)).ocupados, 1, 'pedir elegir no escribe nada');
  const ok = await S.agregarPorCorreo(db, { familiaId: f.id, correo: 'doble@ejemplo.com', clienteId: 'dani', compraId: 'sp-dani' });
  assert.equal(ok.familia.ocupados, 2);
});

test('B · «No renovó» / quitar Spotify: solo ESE invitado queda «Retiro en Spotify pendiente» con fecha y motivo; el cupo NO se declara libre', async () => {
  const db = fakeFirestore(semilla());
  const f = await madre(db);
  await S.agregarPorCorreo(db, { familiaId: f.id, correo: 'inv1@ejemplo.com' });
  await S.agregarPorCorreo(db, { familiaId: f.id, correo: 'inv2@ejemplo.com' });
  const r = await S.retirarPorBaja(db, { correo: 'INV1@ejemplo.com', clienteId: 'ana', compraId: 'sp-ana', motivo: 'no_renovo', usuario: 'sublicuentas' });
  assert.equal(r.estado, 'retiro_pendiente');
  const [p] = await S.panelFamilias(db, { hoy: '2026-11-12' });
  const e1 = p.espacios.find((e) => e.correo === 'inv1@ejemplo.com'), e2 = p.espacios.find((e) => e.correo === 'inv2@ejemplo.com');
  assert.deepEqual([e1.estado, e1.retiroMotivo, !!e1.retiroAt], ['retiro_pendiente', 'no_renovo', true]);
  assert.equal(e2.estado, 'ocupado', 'los demás invitados no cambian');
  assert.equal(p.ocupados, 2, 'el espacio sigue ocupado hasta confirmar el retiro en Spotify');
  // Confirmar el retiro libera solo ese espacio y deja historia
  await assert.rejects(S.liberarEspacio(db, { correo: 'inv1@ejemplo.com' }), /Confirme/);
  await S.liberarEspacio(db, { correo: 'inv1@ejemplo.com', confirmoRetiro: true, usuario: 'sublicuentas' });
  const fam = (await db.collection('spotify_familias').doc(f.id).get()).data();
  const m = fam.miembros.find((x) => x.correo === 'inv1@ejemplo.com');
  assert.deepEqual([m.estado, m.desvinculadoMotivo, !!m.retiroSpotifyConfirmadoAt], ['desvinculado', 'no_renovo', true]);
  assert.equal((await S.leerFamilia(db, f.id)).ocupados, 1);
  assert.ok((await db.collection('clientes').doc('ana').get()).exists, 'la ficha del cliente nunca se borra');
});

test('B · idempotente y seguro: repetir la baja no duplica; otra ficha con el mismo correo no se toca; sin familia no hace nada', async () => {
  const db = fakeFirestore(semilla());
  const f = await madre(db);
  await S.agregarPorCorreo(db, { familiaId: f.id, correo: 'inv1@ejemplo.com' });
  await S.retirarPorBaja(db, { correo: 'inv1@ejemplo.com', clienteId: 'ana', compraId: 'sp-ana', motivo: 'no_renovo' });
  const auditAntes = await cuantos(db, 'auditoria_eventos');
  const r2 = await S.retirarPorBaja(db, { correo: 'inv1@ejemplo.com', clienteId: 'ana', compraId: 'sp-ana', motivo: 'no_renovo' });
  assert.equal(r2.yaEstaba, true);
  assert.equal(await cuantos(db, 'auditoria_eventos'), auditAntes, 'no duplica historial');
  const otra = await S.retirarPorBaja(db, { correo: 'inv1@ejemplo.com', clienteId: 'beto', compraId: 'sp-beto' });
  assert.equal(otra.omitido, 'otra_ficha');
  assert.equal((await S.retirarPorBaja(db, { correo: 'nadie@ejemplo.com' })).omitido, 'no_es_invitado');
});

test('C · cliente renueva: el invitado permanece; si vuelve a tener su Spotify, la marca automática se quita sola', async () => {
  const db = fakeFirestore(semilla());
  const f = await madre(db);
  await S.agregarPorCorreo(db, { familiaId: f.id, correo: 'inv1@ejemplo.com' });
  await S.asignarServicio(db, { correo: 'inv1@ejemplo.com', clienteId: 'ana', compraId: 'sp-ana' }); // renovación/guardado de ficha
  let [p] = await S.panelFamilias(db, { hoy: '2026-11-12' });
  assert.equal(p.espacios[0].estado, 'ocupado');
  await S.retirarPorBaja(db, { correo: 'inv1@ejemplo.com', clienteId: 'ana', compraId: 'sp-ana', motivo: 'no_renovo' });
  await S.asignarServicio(db, { correo: 'inv1@ejemplo.com', clienteId: 'ana', compraId: 'sp-ana-2' }); // vuelve a comprar
  [p] = await S.panelFamilias(db, { hoy: '2026-11-12' });
  assert.deepEqual([p.espacios[0].estado, p.espacios[0].correo, p.ocupados], ['ocupado', 'inv1@ejemplo.com', 1]);
  // Una marca MANUAL de retiro no se quita sola
  await S.marcarMiembro(db, { correo: 'inv1@ejemplo.com', retiroPendiente: true });
  await S.asignarServicio(db, { correo: 'inv1@ejemplo.com', clienteId: 'ana', compraId: 'sp-ana-2' });
  [p] = await S.panelFamilias(db, { hoy: '2026-11-12' });
  assert.equal(p.espacios[0].estado, 'retiro_pendiente');
});

test('D · duplicado y 6.º cupo: bloqueo con mensaje legible y datos intactos', async () => {
  const db = fakeFirestore(semilla());
  const f = await madre(db);
  const g = await S.crearFamilia(db, { madreCorreo: 'madre2@ejemplo.com' });
  await S.agregarPorCorreo(db, { familiaId: f.id, correo: 'inv1@ejemplo.com' });
  const rep = await S.agregarPorCorreo(db, { familiaId: f.id, correo: 'INV1@ejemplo.com' }); // doble clic
  assert.equal(rep.familia.idempotente, true);
  await assert.rejects(S.agregarPorCorreo(db, { familiaId: g.id, correo: 'inv1@ejemplo.com' }), /ya está activo en otra familia/);
  for (const c of ['a2@ejemplo.com', 'a3@ejemplo.com', 'a4@ejemplo.com', 'a5@ejemplo.com']) await S.agregarPorCorreo(db, { familiaId: f.id, correo: c });
  await assert.rejects(S.agregarPorCorreo(db, { familiaId: f.id, correo: 'a6@ejemplo.com' }), /no hay espacios libres/);
  await assert.rejects(S.agregarPorCorreo(db, { familiaId: f.id, correo: 'no-es-correo' }), /correo válido/);
  const fam = await S.leerFamilia(db, f.id);
  assert.deepEqual([fam.ocupados, fam.miembros.filter((m) => m.estado === 'activo').length], [5, 5]);
});

test('E · error de sincronización: la baja no declara éxito falso en Spotify (queda «pendiente de revisión»)', () => {
  const src = fs.readFileSync(new URL('../api/renovar.js', import.meta.url), 'utf8');
  assert.match(src, /acc === "no_renovo" \|\| acc === "eliminar"/);
  assert.match(src, /spotifyFam\.retirarPorBaja\(db, \{ correo: correoBaja/);
  assert.match(src, /spotifyRetiro = \{ pendienteRevision: true/);
  assert.match(src, /\.\.\.\(spotifyRetiro \? \{ spotifyRetiro \} : \{\}\)/);
  const app = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(app, /no se pudo marcar el retiro, revíselo en Control Maestro/);
  assert.match(app, /Retiro en Spotify pendiente/);
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
