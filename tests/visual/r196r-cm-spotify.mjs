// R196r · Bloque 01 en el navegador (datos FICTICIOS): Control Maestro › Spotify Familiar muestra SOLO familias reales (SP-xxx),
// el detalle tiene 5 renglones por correo con verificación contra la fuente operativa (la misma de Telegram), sin falsos
// «NO ESTÁ EN TG», sin PIN ni Sacar/Eliminar; «Marcar revisada» solo si todo coincide; un cambio posterior la invalida.
// /api/inventario usa la librería REAL con Firestore en memoria. Uso: node tests/visual/r196r-cm-spotify.mjs <carpeta> [antes]
import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict'; import { createRequire } from 'node:module';
import { abrir } from './arnes.mjs';
import { fakeFirestore } from '../helpers/fake-firestore.mjs';
const require = createRequire(import.meta.url);
const S = require('../../api/_spotify-familias.js');
const out = process.argv[2] || '/tmp/r196r'; const antes = process.argv[3] === 'antes'; const suf = antes ? '-antes' : ''; fs.mkdirSync(out, { recursive: true });
const cli = (n, c) => ({ nombre: n, nombrePerfil: n, telefono: '', servicios: [{ compraId: 'sp-' + n.split(' ')[0].toLowerCase(), plataforma: 'spotify', correo: c, fechaRenovacion: '' }] });
const db = fakeFirestore({ inventario: {}, clientes: { ronal: cli('Ronal Prueba', 'ronal@ejemplo.test'), marcia: cli('Marcia Prueba', 'marcia@ejemplo.test'), jimena: cli('Jimena Prueba', 'jimena@ejemplo.test') } });
const fam = async (madre, correos) => { const f = await S.crearFamilia(db, { madreCorreo: madre }); for (const [c, id] of correos) await S.vincularInvitado(db, { familiaId: f.id, correo: c, ...(id ? { clienteId: id, compraId: 'sp-' + id } : {}) }); return f; };
const f1 = await fam('madre-uno@ejemplo.test', [['a1@ejemplo.test'], ['a2@ejemplo.test'], ['a3@ejemplo.test'], ['a4@ejemplo.test']]);
const f2 = await fam('madre-dos@ejemplo.test', [['b1@ejemplo.test'], ['b2@ejemplo.test'], ['b3@ejemplo.test'], ['b4@ejemplo.test'], ['b5@ejemplo.test']]);
const f3 = await S.crearFamilia(db, { madreCorreo: 'madre-tres@ejemplo.test' }); await S.eliminarCuenta(db, { familiaId: f3.id, confirmo: true, usuario: 'sublicuentas' });
const f4 = await fam('madre-cuatro@ejemplo.test', [['ronal@ejemplo.test', 'ronal'], ['marcia@ejemplo.test', 'marcia'], ['musica01@ejemplo.test'], ['jimena@ejemplo.test', 'jimena']]);
await S.eliminarCorreo(db, { familiaId: f4.id, correo: 'musica01@ejemplo.test' }); await S.agregarPorCorreo(db, { familiaId: f4.id, correo: 'musica01@ejemplo.test', posicion: 3 });
// el 4.º espacio queda libre y Jimena en el 5.º, como en la captura de referencia
const raw4 = (await db.collection('spotify_familias').doc(f4.id).get()).data();
await db.collection('spotify_familias').doc(f4.id).set({ ...raw4, miembros: raw4.miembros.map((m) => (m.correo === 'jimena@ejemplo.test' && m.estado === 'activo' ? { ...m, posicion: 5 } : m)) });
// SP-001: un correo que Telegram (índice) tiene en otra familia → incidencia verificable
await db.collection('spotify_indice').doc('a4@ejemplo.test').set({ tipo: 'invitado', familiaId: f2.id, activo: true });
const llamadas = [];
async function apiInventario(route) {
  const body = JSON.parse(route.request().postData() || '{}'); const a = body.accion; llamadas.push(a);
  try {
    if (a === 'spotifyPanel') return route.fulfill({ json: { ok: true, hoy: '2026-11-14', puedeAdministrar: true, capacidad: 5, familias: await S.panelFamilias(db, { hoy: '2026-11-14' }) } });
    if (a === 'spotifyVerificar') return route.fulfill({ json: { ok: true, verificacion: await S.verificarFamilia(db, body.familiaId) } });
    if (a === 'spotifyRevisarFamilia') return route.fulfill({ json: { ok: true, ...(await S.guardarRevisionFamilia(db, { ...body, usuario: 'sublicuentas' })) } });
    if (a === 'spotifyResincronizar') { await S.sincronizarBodega(db, body.familiaId); return route.fulfill({ json: { ok: true, verificacion: await S.verificarFamilia(db, body.familiaId) } }); }
  } catch (e) { return route.fulfill({ json: { ok: false, error: e.message } }); }
  return route.fulfill({ json: { ok: true, items: [], data: [] } });
}
// «Cuentas» genéricas que antes se mezclaban: el reflejo de la madre en Bodega + correos invitados sueltos (Excel/fichas viejas)
const mezcla = { cuentas: [{ id: 'inv-x1', plataforma: 'spotifyfamiliar', correo: 'marcia@ejemplo.test', capacidad: 0, clientes: [] }, { id: 'inv-x2', plataforma: 'spotifyfamiliar', correo: 'musica01@ejemplo.test', capacidad: 0, clientes: [] }],
  servicios: [{ clienteId: 'ronal', servicioIndex: 0, perfilIndex: 0, compraId: 'sp-ronal', nombre: 'Ronal Prueba', titular: 'Ronal Prueba', telefono: '', plataforma: 'spotify familiar', plataformaLabel: 'Spotify Familiar', correo: 'madre-cuatro@ejemplo.test', clave: '', fecha: '', precio: 90 }] };
async function abrirCM(ancho, alto) {
  const h = await abrir({ usuario: 'sublicuentas', ui: 'v2', ancho, alto, datos: { clientes: 4, inventario: 0 } }); const pg = h.page;
  await pg.route('**/api/inventario', apiInventario);
  const cuentas = [...db._data.entries()].filter(([k]) => k.startsWith('inventario/') && k.split('/').length === 2).map(([k, r]) => ({ id: k.split('/')[1], ...r.data }));
  await pg.evaluate(({ c, mezcla }) => { const orig = window.sublichatControlData; window.sublichatControlData = () => { const x = orig ? orig() : {}; return { ...x, ready: true, version: (Number(x.version) || 0) + 1000, cuentas: [...(x.cuentas || []), ...c, ...mezcla.cuentas], servicios: [...(x.servicios || []), ...mezcla.servicios] }; }; }, { c: cuentas, mezcla });
  await pg.evaluate(() => window.subliRBAC ? window.subliRBAC.go('control-cuentas') : window.SublichatRBAC.ir('control-cuentas'));
  await pg.waitForSelector('[data-cm-open-workspace="spotifyfamiliar"]', { timeout: 20000 });
  await pg.click('[data-cm-open-workspace="spotifyfamiliar"]'); await pg.waitForTimeout(1500);
  return h;
}
let h = await abrirCM(1440, 1500); let pg = h.page;
await pg.screenshot({ path: path.join(out, `1-spotify-control-maestro${suf}.png`), fullPage: false });
if (antes) {
  const r = await pg.$('#cmAccountResults .cm-account-list'); if (r) await r.screenshot({ path: path.join(out, '1b-lista-generica-antes.png') });
} else {
  const filas = await pg.$$eval('.sp-fam-row', (x) => x.map((e) => e.innerText.replace(/\s+/g, ' ')));
  assert.deepEqual(filas.map((t) => t.split(' ')[0]), ['SP-001', 'SP-002', 'SP-004'], 'solo familias reales (IDs estables)');
  assert.ok(filas.every((t) => /madre-/.test(t)), 'cada tarjeta es una cuenta madre');
  assert.equal((await pg.$eval('#cmAccountResults', (e) => e.innerText)).trim(), '', 'sin la lista genérica que mezclaba madres e invitados');
  assert.match(filas[0], /4\/5 ocupados/); assert.match(filas[1], /5\/5 ocupados/); assert.match(filas[2], /4\/5 ocupados/);
  // SP-004: 4 correos + 1 libre, todos «Coincide», cliente solo si la ficha lo comprueba
  await pg.click(`[data-sp-abrir="${f4.id}"]`); await pg.waitForSelector('.sp-slot .sp-chip.ok', { timeout: 8000 }); await pg.waitForTimeout(400);
  const det = await pg.$eval('.sp-det-card', (e) => e.innerText);
  assert.match(det, /SP-004 · madre-cuatro@ejemplo\.test/); assert.match(det, /4\/5 ocupados/);
  for (const c of ['ronal@', 'marcia@', 'musica01@', 'jimena@']) assert.match(det, new RegExp(c));
  assert.match(det, /04\s+Espacio libre/); assert.equal((det.match(/Coincide/g) || []).length, 4);
  assert.match(det, /Cliente: Ronal Prueba/); assert.doesNotMatch(det, /musica01@ejemplo\.test\s+Cliente:/);
  assert.doesNotMatch(det, /NO ESTÁ EN TG|PIN|Teléfono|Vencimiento|Sacar|Eliminar|PERFIL COMPARTIDO|Agregar|Mover|Desvincular/);
  await (await pg.$('.sp-det-card')).screenshot({ path: path.join(out, '2-sp-004-verificado.png') });
  await pg.click(`[data-sp-revisada="${f4.id}"]`); await pg.waitForSelector('.sp-msg.ok', { timeout: 8000 }); await pg.waitForTimeout(500);
  assert.match(await pg.$eval(`[data-sp-abrir="${f4.id}"]`, (e) => e.innerText), /Revisada/);
  await pg.click(`[data-sp-detalle="${f4.id}"]`); await pg.waitForTimeout(200);
  assert.match(await pg.$eval('.sp-rev-det', (e) => e.innerText), /Estado: Revisada · por sublicuentas/);
  await (await pg.$('.sp-det-card')).screenshot({ path: path.join(out, '3-sp-004-revisada.png') });
  // SP-001: correo que Telegram tiene en otra familia → «Otra familia», no se puede marcar revisada
  await pg.click(`[data-sp-abrir="${f1.id}"]`); await pg.waitForSelector('.sp-slot .sp-chip.err', { timeout: 8000 }); await pg.waitForTimeout(300);
  const d1 = await pg.$eval('.sp-det-card', (e) => e.innerText);
  assert.match(d1, /a4@ejemplo\.test[\s\S]*Telegram lo tiene en SP-002[\s\S]*Otra familia/);
  assert.equal(await pg.$eval(`[data-sp-revisada="${f1.id}"]`, (b) => b.disabled), true);
  await (await pg.$('.sp-det-card')).screenshot({ path: path.join(out, '4-sp-001-incidencia-verificable.png') });
  // baja posterior en SP-004 (Telegram/Web) → espacio libre y revisión desactualizada, sin perder el historial
  await S.retirarPorBaja(db, { correo: 'marcia@ejemplo.test', clienteId: 'marcia', compraId: 'sp-marcia', motivo: 'no_renovo' });
  await pg.evaluate(() => window.SublichatSpotifyCM.recargar()); await pg.waitForTimeout(900);
  assert.match(await pg.$eval(`[data-sp-abrir="${f4.id}"]`, (e) => e.innerText), /3\/5 ocupados[\s\S]*Pendiente de revisar/);
  const rev = (await db.collection('spotify_familias_revisiones').doc(f4.id).get()).data();
  assert.equal(rev.historial.length, 1); assert.equal(rev.estado, 'revisada');
}
await h.cerrar();
h = await abrirCM(390, 1800); pg = h.page;
if (!antes) { await pg.click(`[data-sp-abrir="${f4.id}"]`); await pg.waitForTimeout(1200); }
console.log('ancho móvil', await pg.evaluate(() => document.documentElement.scrollWidth));
const m = await pg.$('#cmSpotifyFamilias .sp-cm') || await pg.$('#cmSpotifyFamilias'); await m.screenshot({ path: path.join(out, `5-movil${suf}.png`) });
await h.cerrar();
console.log('llamadas', [...new Set(llamadas)].join(','), '· capturas en', out); process.exit(0);
