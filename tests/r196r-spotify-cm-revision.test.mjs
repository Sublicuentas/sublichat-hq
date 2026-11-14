// R196r · Bloque 01 (PDF 14/11/2026): Control Maestro › Spotify Familiar = familias reales + 5 espacios por correo +
// verificación contra la fuente operativa (la de Telegram) + revisión. Firestore en memoria; datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
const require = createRequire(import.meta.url);
const S = require('../api/_spotify-familias.js');
const R = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const cli = (n, c) => ({ nombre: n, servicios: [{ compraId: 'sp-' + n, plataforma: 'spotify', correo: c }] });
async function escenario() {
  const db = fakeFirestore({ clientes: { ronal: cli('ronal', 'ronal@ejemplo.test'), jimena: cli('jimena', 'jimena@ejemplo.test') } });
  const fam = async (madre, cs) => { const f = await S.crearFamilia(db, { madreCorreo: madre }); for (const [c, id] of cs) await S.vincularInvitado(db, { familiaId: f.id, correo: c, ...(id ? { clienteId: id, compraId: 'sp-' + id } : {}) }); return f; };
  const f1 = await fam('madre1@ejemplo.test', [['a1@ejemplo.test'], ['a2@ejemplo.test'], ['a3@ejemplo.test'], ['a4@ejemplo.test']]);
  const f2 = await fam('madre2@ejemplo.test', [1, 2, 3, 4, 5].map((n) => [`b${n}@ejemplo.test`]));
  const f4 = await fam('madre4@ejemplo.test', [['ronal@ejemplo.test', 'ronal'], ['marcia@ejemplo.test'], ['musica@ejemplo.test'], ['jimena@ejemplo.test', 'jimena']]);
  return { db, f1, f2, f4 };
}

test('Spotify 1 · tres familias reales con sus conteos 4/5, 5/5, 4/5 (dinámicos)', async () => {
  const { db } = await escenario();
  const p = await S.panelFamilias(db, {});
  assert.deepEqual(p.map((f) => [f.codigo, f.ocupados, f.capacidad]), [['SP-001', 4, 5], ['SP-002', 5, 5], ['SP-003', 4, 5]]);
  assert.ok(p.every((f) => f.revision.codigo === 'sin_revisar' && f.huella));
});

test('Spotify 2 · detalle: 4 correos + 1 libre; la madre no cuenta como invitado; cliente solo si la ficha lo comprueba', async () => {
  const { db, f4 } = await escenario();
  const v = await S.verificarFamilia(db, f4.id);
  assert.deepEqual([v.ocupados, v.capacidad, v.ok], [4, 5, true]);
  assert.deepEqual(v.espacios.map((e) => e.resultado), ['coincide', 'coincide', 'coincide', 'coincide', 'libre']);
  assert.ok(!v.espacios.some((e) => e.correo === 'madre4@ejemplo.test'));
  assert.deepEqual(v.espacios.slice(0, 4).map((e) => e.cliente), ['ronal', '', '', 'jimena']);
});

test('Spotify 3 · sin falsos «no está»: sin PIN/teléfono/fecha/ficha sigue «Coincide»; diferencias reales sí se señalan', async () => {
  const { db, f1, f2 } = await escenario();
  assert.ok((await S.verificarFamilia(db, f1.id)).espacios.slice(0, 4).every((e) => e.resultado === 'coincide'), 'sin ficha ni datos secundarios: coincide');
  await db.collection('spotify_indice').doc('a4@ejemplo.test').set({ tipo: 'invitado', familiaId: f2.id, activo: true }); // Telegram lo tiene en otra
  await db.collection('spotify_indice').doc('a3@ejemplo.test').set({ tipo: 'invitado', familiaId: f1.id, activo: false }); // falta en origen
  await db.collection('spotify_indice').doc('fantasma@ejemplo.test').set({ tipo: 'invitado', familiaId: f1.id, activo: true, correo: 'fantasma@ejemplo.test' }); // falta en CM
  const v = await S.verificarFamilia(db, f1.id);
  assert.deepEqual(v.espacios.slice(0, 4).map((e) => e.resultado), ['coincide', 'coincide', 'falta_en_origen', 'otra_familia']);
  assert.match(v.espacios[3].detalle, /Telegram lo tiene en SP-002/);
  assert.deepEqual(v.sobrantes.map((x) => [x.correo, x.resultado]), [['fantasma@ejemplo.test', 'falta_en_cm']]);
  assert.equal(v.ok, false);
  // duplicado real: activo en dos familias
  const raw = (await db.collection('spotify_familias').doc(f2.id).get()).data();
  await db.collection('spotify_familias').doc(f2.id).set({ ...raw, miembros: [...raw.miembros, { id: 'dup', correo: 'a1@ejemplo.test', correoNorm: 'a1@ejemplo.test', estado: 'activo', posicion: 6 }] });
  const d = await S.verificarFamilia(db, f1.id);
  assert.equal(d.espacios[0].resultado, 'duplicado'); assert.match(d.espacios[0].detalle, /SP-002/);
  assert.match((await S.verificarFamilia(db, f2.id)).avisos.join(' '), /Capacidad: 6 invitados activos de 5/);
});

test('Spotify 4 · revisar familia 4/5: si todo coincide se marca Revisada con auditoría; con diferencias o huella vieja no', async () => {
  const { db, f1, f4 } = await escenario();
  const v = await S.verificarFamilia(db, f4.id);
  const r = await S.guardarRevisionFamilia(db, { familiaId: f4.id, resultado: 'revisada', huella: v.huella, usuario: 'sublicuentas' });
  assert.deepEqual([r.revision.estado, r.revision.por, r.revision.ocupados, r.revision.huella], ['revisada', 'sublicuentas', 4, v.huella]);
  assert.equal((await S.panelFamilias(db, {})).find((f) => f.id === f4.id).revision.codigo, 'revisada');
  assert.ok((await db.collection('auditoria_eventos').get()).docs.some((d) => d.data().accion === 'cm_familia_revisada'));
  await db.collection('spotify_indice').doc('a4@ejemplo.test').set({ tipo: 'invitado', familiaId: f4.id, activo: true });
  await assert.rejects(S.guardarRevisionFamilia(db, { familiaId: f1.id, resultado: 'revisada' }), /hay diferencias/);
  await assert.rejects(S.guardarRevisionFamilia(db, { familiaId: f4.id, resultado: 'revisada', huella: 'vieja' }), /cambió desde que la verificó/);
  await assert.rejects(S.guardarRevisionFamilia(db, { familiaId: f1.id, resultado: 'incidencia', nota: 'x' }), /mínimo 4/);
  const inc = await S.guardarRevisionFamilia(db, { familiaId: f1.id, resultado: 'incidencia', nota: 'a4 está en otra familia', usuario: 'sublicuentas' });
  assert.equal((await S.panelFamilias(db, {})).find((f) => f.id === f1.id).revision.codigo, 'con_incidencia'); assert.equal(inc.revision.nota, 'a4 está en otra familia');
});

test('Spotify 5 · cambio posterior / baja: el espacio se libera, la revisión pasa a «Pendiente de revisar» y el historial queda', async () => {
  const { db, f4 } = await escenario();
  const v = await S.verificarFamilia(db, f4.id);
  await S.guardarRevisionFamilia(db, { familiaId: f4.id, resultado: 'revisada', huella: v.huella, usuario: 'sublicuentas' });
  await S.retirarPorBaja(db, { correo: 'marcia@ejemplo.test', motivo: 'no_renovo' });
  const f = (await S.panelFamilias(db, {})).find((x) => x.id === f4.id);
  assert.deepEqual([f.ocupados, f.revision.codigo], [3, 'desactualizada']); assert.match(f.revision.texto, /Pendiente de revisar/);
  const rev = (await db.collection('spotify_familias_revisiones').doc(f4.id).get()).data();
  assert.equal(rev.historial.length, 1);
  const v2 = await S.verificarFamilia(db, f4.id);
  await S.guardarRevisionFamilia(db, { familiaId: f4.id, resultado: 'revisada', huella: v2.huella, usuario: 'sublicuentas' });
  assert.equal((await db.collection('spotify_familias_revisiones').doc(f4.id).get()).data().historial.length, 2);
  // leer/verificar no escribe nada en membresías (idempotente)
  const antes = JSON.stringify((await db.collection('spotify_familias').doc(f4.id).get()).data());
  for (let i = 0; i < 3; i++) { await S.verificarFamilia(db, f4.id); await S.panelFamilias(db, {}); }
  assert.equal(JSON.stringify((await db.collection('spotify_familias').doc(f4.id).get()).data()), antes);
});

test('Spotify 6 · Control Maestro: familias reales, sin lista genérica, sin PIN/Sacar/Eliminar/Agregar/Mover/Desvincular', () => {
  const cm = R('control-maestro.js'), ui = R('control-maestro-spotify.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(cm, /<div id="cmAccountResults">\$\{state\.accountPlatform==='spotifyfamiliar'\?'':accountResultsHtml\(\)\}<\/div>/);
  assert.match(cm, /accounts\.filter\(\(a\)=>a\.family!=='spotifyfamiliar'\)/);
  assert.match(ui, /accion: 'spotifyPanel'/); assert.match(ui, /accion: 'spotifyVerificar'/); assert.match(ui, /accion: 'spotifyRevisarFamilia'/);
  assert.doesNotMatch(ui, /spotifyAgregarCorreo|spotifyEliminarCorreo|spotifyMover|spotifyDesvincular|spotifyCrear|spotifyLiberar|NO ESTÁ EN TG|PIN|Sacar|Eliminar cuenta|<form|<select/);
  assert.match(ui, /'Espacio libre'/); assert.match(ui, /No se pudo verificar/);
  assert.match(R('api/inventario.js'), /if \(accion === "spotifyVerificar"\)/);
  assert.doesNotMatch(R('control-maestro-spotify.css'), /gradient/);
  const bot = new URL('../../bot-gh/lib_spotify_familias.js', import.meta.url);
  if (fs.existsSync(bot)) assert.equal(fs.readFileSync(bot, 'utf8').split('\n').slice(1).join('\n'), R('api/_spotify-familias.js').split('\n').slice(1).join('\n'), 'bot = copia fiel');
});
