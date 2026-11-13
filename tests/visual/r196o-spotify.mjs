// R196o · Capturas (datos FICTICIOS): Control Maestro › Spotify Familiar tras «No renovó»: el espacio queda libre, la cuenta muestra
// «Falta quitar en la app de Spotify», el menú del espacio ya no tiene Mover ni retirar a mano, y quien no es Sublicuentas no ve
// «+ Cuenta familiar». /api/inventario usa la librería REAL con Firestore en memoria. Uso: node tests/visual/r196o-spotify.mjs <carpeta>
import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict'; import { createRequire } from 'node:module';
import { abrir } from './arnes.mjs';
import { fakeFirestore } from '../helpers/fake-firestore.mjs';
const require = createRequire(import.meta.url);
const S = require('../../api/_spotify-familias.js');
const out = process.argv[2] || '/tmp/r196o'; fs.mkdirSync(out, { recursive: true });
const cli = (n, c) => ({ nombre: n, servicios: [{ compraId: 'sp-' + n.split(' ')[0].toLowerCase(), plataforma: 'spotify', correo: c, fechaRenovacion: '20/12/2026' }] });
const db = fakeFirestore({ inventario: {}, clientes: { jony: cli('Jony Prueba', 'invitado1@ejemplo.test'), olvin: cli('Olvin Prueba', 'invitado2@ejemplo.test'), karla: cli('Karla Prueba', 'invitado3@ejemplo.test'), dereck: cli('Dereck Prueba', 'invitado4@ejemplo.test') } });
const f1 = await S.crearFamilia(db, { madreCorreo: 'madre1@ejemplo.test' });
for (const [id, n] of [['jony', 1], ['olvin', 2], ['karla', 3], ['dereck', 4]]) await S.vincularInvitado(db, { familiaId: f1.id, correo: `invitado${n}@ejemplo.test`, clienteId: id, compraId: 'sp-' + id });
await S.agregarPorCorreo(db, { familiaId: f1.id, correo: 'nuevo5@ejemplo.test' });
await S.retirarPorBaja(db, { correo: 'invitado2@ejemplo.test', motivo: 'no_renovo' });
let admin = true; const llamadas = [];
async function apiInventario(route) {
  const body = JSON.parse(route.request().postData() || '{}'); const a = body.accion; llamadas.push(a);
  try {
    if (a === 'spotifyPanel') return route.fulfill({ json: { ok: true, hoy: '2026-11-12', puedeAdministrar: admin, capacidad: 5, familias: await S.panelFamilias(db, { hoy: '2026-11-12' }) } });
    if (a === 'spotifyConfirmarRetiro') return route.fulfill({ json: { ok: true, ...(await S.confirmarRetiroExterno(db, body)) } });
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
const recorte = async (pg, sel, nombre) => { const el = await pg.$(sel); await el.screenshot({ path: path.join(out, nombre) }); };
let h = await abrirCM(1440, 1400); let pg = h.page;
const txt = await pg.$eval('#cmSpotifyFamilias .sp-fam', (e) => e.innerText);
assert.match(txt, /4 de 5 espacios/); assert.match(txt, /Falta quitar en la app de Spotify/); assert.match(txt, /invitado2@ejemplo\.test/);
await pg.click('[data-sp-menu$="|1"]'); await pg.waitForTimeout(300);
const menu = await pg.$eval('.sp-menu', (e) => e.innerText);
assert.doesNotMatch(menu, /Mover|Retirar invitado|pendiente de retirada|Vincular ficha/);
await recorte(pg, '#cmSpotifyFamilias .sp-fam', '4-control-maestro-tras-no-renovo.png');
assert.ok(await pg.$('[data-sp-acc="crear"]'), 'Sublicuentas ve «+ Cuenta familiar»');
pg.once('dialog', (d) => d.accept()); await pg.click('[data-sp-acc="quitado"]'); await pg.waitForTimeout(900);
assert.doesNotMatch(await pg.$eval('#cmSpotifyFamilias .sp-fam', (e) => e.innerText), /Falta quitar/);
assert.equal((await S.leerFamilia(db, f1.id)).ocupados, 4);
if (h.errores && h.errores.length) console.log('ERRORES pagina', h.errores.slice(0, 5));
await h.cerrar();
admin = false; h = await abrirCM(390, 2200); pg = h.page;
assert.equal(await pg.$('[data-sp-acc="crear"]'), null, 'sin «+ Cuenta familiar» para quien no es Sublicuentas');
console.log('ancho móvil', await pg.evaluate(() => { const w = (e) => Math.round(e.getBoundingClientRect().width); const f = document.querySelector('#cmSpotifyFamilias .sp-fam'); let p = f, cad = []; while (p && cad.length < 8) { cad.push((p.id || p.className || p.tagName).toString().slice(0, 30) + ':' + w(p) + ':' + getComputedStyle(p).overflowX); p = p.parentElement; } return [document.documentElement.scrollWidth, cad.join(' < ')]; }));
await recorte(pg, '#cmSpotifyFamilias .sp-fam', '5-control-maestro-movil.png');
await h.cerrar();
console.log('llamadas', [...new Set(llamadas)].join(','), '· capturas en', out); process.exit(0);
