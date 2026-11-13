// R196m · Capturas (datos FICTICIOS): Control Maestro › Spotify Familiar con alta directa por correo y «Retiro en Spotify
// pendiente». /api/inventario usa la librería REAL con Firestore en memoria. Uso: node tests/visual/r196m-spotify.mjs <carpeta> [antes]
import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict'; import { createRequire } from 'node:module';
import { abrir } from './arnes.mjs';
import { fakeFirestore } from '../helpers/fake-firestore.mjs';
const require = createRequire(import.meta.url);
const S = require('../../api/_spotify-familias.js');
const out = process.argv[2] || '/tmp/r196m'; const sufijo = process.argv[3] ? `-${process.argv[3]}` : ''; fs.mkdirSync(out, { recursive: true });

const db = fakeFirestore({ inventario: {}, clientes: {
  ana: { nombre: 'Ana Prueba', servicios: [{ compraId: 'sp-ana', plataforma: 'spotify', correo: 'invitado1@ejemplo.test', fechaRenovacion: '04/12/2026' }] },
  beto: { nombre: 'Beto Prueba', servicios: [{ compraId: 'sp-beto', plataforma: 'spotify', correo: 'invitado2@ejemplo.test', fechaRenovacion: '01/11/2026' }] },
  caro: { nombre: 'Caro Prueba', servicios: [{ compraId: 'sp-caro', plataforma: 'spotify', correo: 'compartido@ejemplo.test', fechaRenovacion: '20/12/2026' }] },
  dani: { nombre: 'Dani Prueba', servicios: [{ compraId: 'sp-dani', plataforma: 'spotify', correo: 'compartido@ejemplo.test', fechaRenovacion: '10/12/2026' }] },
} });
const f1 = await S.crearFamilia(db, { madreCorreo: 'madre.spotify@ejemplo.test' });
await S.vincularInvitado(db, { familiaId: f1.id, correo: 'invitado1@ejemplo.test', clienteId: 'ana', compraId: 'sp-ana' });
await S.vincularInvitado(db, { familiaId: f1.id, correo: 'invitado2@ejemplo.test', clienteId: 'beto', compraId: 'sp-beto' });
if (S.retirarPorBaja) await S.retirarPorBaja(db, { correo: 'invitado2@ejemplo.test', clienteId: 'beto', compraId: 'sp-beto', motivo: 'no_renovo' });
else await S.marcarMiembro(db, { correo: 'invitado2@ejemplo.test', retiroPendiente: true });
const llamadas = [];
async function apiInventario(route) {
  const body = JSON.parse(route.request().postData() || '{}'); const a = body.accion; llamadas.push(a);
  try {
    if (a === 'spotifyPanel') return route.fulfill({ json: { ok: true, hoy: '2026-11-12', capacidad: 5, familias: await S.panelFamilias(db, { hoy: '2026-11-12' }) } });
    if (a === 'spotifyAgregarCorreo') return route.fulfill({ json: { ok: true, ...(await S.agregarPorCorreo(db, body)) } });
    if (a === 'spotifyLiberar') return route.fulfill({ json: { ok: true, ...(await S.liberarEspacio(db, { correo: body.correo, confirmoRetiro: body.confirmoRetiro === true })) } });
  } catch (e) { return route.fulfill({ json: { ok: false, error: e.message } }); }
  return route.fulfill({ json: { ok: true, items: [], data: [] } });
}
async function abrirCM(ancho, alto) {
  const h = await abrir({ usuario: 'sublicuentas', ui: 'v2', ancho, alto, datos: { clientes: 36, inventario: 0 } }); const pg = h.page;
  await pg.route('**/api/inventario', apiInventario);
  const cuentas = [...db._data.entries()].filter(([k]) => k.startsWith('inventario/') && k.split('/').length === 2).map(([k, r]) => ({ id: k.split('/')[1], ...r.data }));
  await pg.evaluate((c) => { const orig = window.sublichatControlData; window.sublichatControlData = () => { const x = orig ? orig() : {}; return { ...x, ready: true, version: (Number(x.version) || 0) + 1000, cuentas: [...(x.cuentas || []), ...c] }; }; }, cuentas);
  await pg.evaluate(() => window.subliRBAC ? window.subliRBAC.go('control-cuentas') : window.SublichatRBAC.ir('control-cuentas'));
  await pg.waitForSelector('[data-cm-open-workspace="spotifyfamiliar"]', { timeout: 20000 });
  await pg.click('[data-cm-open-workspace="spotifyfamiliar"]');
  await pg.waitForSelector('#cmSpotifyFamilias .sp-fam', { timeout: 15000 }); await pg.waitForTimeout(700);
  return h;
}
const recorte = async (pg, nombre) => { const el = await pg.$('#cmSpotifyFamilias .sp-fam'); await el.screenshot({ path: path.join(out, nombre) }); };

let h = await abrirCM(1440, 1400); let pg = h.page;
await recorte(pg, `1-cuenta-familiar${sufijo}.png`);
if (!sufijo) {
  const txt = await pg.$eval('#cmSpotifyFamilias .sp-fam', (e) => e.innerText);
  assert.match(txt, /Falta quitar en la app de Spotify/); assert.match(txt, /No renovó/); assert.match(txt, /Correo del invitado/); // R196o
  assert.equal(await pg.$$eval('#cmSpotifyFamilias select', (s) => s.length), 0, 'sin selector de cuentas');
  // R196o · ya no se elige entre fichas: ese paso se quitó (ver tests/visual/r196o-spotify.mjs)
  // sin ficha → pendiente de vincular
  await pg.fill(`#spAlta_${f1.id}`, 'Nuevo.Cliente@Ejemplo.test'); await pg.click(`[data-sp-alta="${f1.id}"] button[type="submit"]`);
  await pg.waitForSelector('.sp-msg.warn', { timeout: 8000 }); await pg.waitForTimeout(500);
  await recorte(pg, '3-agregados-y-pendiente-de-vincular.png');
  const fam = await S.leerFamilia(db, f1.id);
  assert.equal(fam.ocupados, 2); // R196o · beto salió con «No renovó» assert.ok(fam.miembros.some((m) => m.correo === 'nuevo.cliente@ejemplo.test' && !m.clienteId));
  // 6.º invitado bloqueado (R196o · se llena primero: beto ya liberó su espacio)
  for (const c of ['c3@ejemplo.test', 'c4@ejemplo.test', 'c5@ejemplo.test']) await S.agregarPorCorreo(db, { familiaId: f1.id, correo: c });
  await pg.evaluate(() => window.SublichatSpotifyCM && window.SublichatSpotifyCM.recargar()); await pg.waitForTimeout(800);
  assert.equal(await pg.$(`#spAlta_${f1.id}`), null, 'llena: ya no hay campo para un 6.º');
  assert.match(await pg.$eval('#cmSpotifyFamilias .sp-fam', (e) => e.innerText), /Cuenta llena: 5 de 5/);
  await recorte(pg, '4-cuenta-llena.png');
  console.log('llamadas', [...new Set(llamadas)].join(','));
}
if (h.errores && h.errores.length) console.log('ERRORES pagina', h.errores.slice(0, 5));
await h.cerrar();
h = await abrirCM(390, 2200); pg = h.page;
const ancho = await pg.evaluate(() => document.documentElement.scrollWidth); console.log('ancho móvil', ancho);
await recorte(pg, `5-movil-390${sufijo}.png`);
await h.cerrar();
console.log('capturas en', out); process.exit(0);
