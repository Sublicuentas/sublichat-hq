// R196p · Capturas (datos FICTICIOS): Control Maestro › Spotify Familiar SOLO CONSULTA (madre + 5 correos) y Bodega › Spotify
// con «Eliminar correo». /api/inventario usa la librería REAL con Firestore en memoria.
// Uso: node tests/visual/r196p-spotify.mjs <carpeta> [antes]
import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict'; import { createRequire } from 'node:module';
import { abrir } from './arnes.mjs';
import { fakeFirestore } from '../helpers/fake-firestore.mjs';
const require = createRequire(import.meta.url);
const S = require('../../api/_spotify-familias.js');
const out = process.argv[2] || '/tmp/r196p'; const antes = process.argv[3] === 'antes'; const suf = antes ? '-antes' : ''; fs.mkdirSync(out, { recursive: true });
const cli = (n, c) => ({ nombre: n, servicios: [{ compraId: 'sp-' + n.split(' ')[0].toLowerCase(), plataforma: 'spotify', correo: c, fechaRenovacion: '20/12/2026' }] });
const db = fakeFirestore({ inventario: {}, clientes: { jony: cli('Jony Prueba', 'invitado1@ejemplo.test'), olvin: cli('Olvin Prueba', 'invitado2@ejemplo.test'), karla: cli('Karla Prueba', 'invitado3@ejemplo.test'), dereck: cli('Dereck Prueba', 'invitado4@ejemplo.test'), eva: cli('Eva Prueba', 'invitado5@ejemplo.test') } });
const f1 = await S.crearFamilia(db, { madreCorreo: 'madre1@ejemplo.test' });
for (const [id, n] of [['jony', 1], ['olvin', 2], ['karla', 3], ['dereck', 4], ['eva', 5]]) await S.vincularInvitado(db, { familiaId: f1.id, correo: `invitado${n}@ejemplo.test`, clienteId: id, compraId: 'sp-' + id });
const llamadas = [];
async function apiInventario(route) {
  const body = JSON.parse(route.request().postData() || '{}'); const a = body.accion; llamadas.push(a);
  try {
    if (a === 'spotifyPanel') return route.fulfill({ json: { ok: true, hoy: '2026-11-13', puedeAdministrar: true, capacidad: 5, familias: await S.panelFamilias(db, { hoy: '2026-11-13' }) } });
    if (a === 'spotifyFamilias') return route.fulfill({ json: { ok: true, puedeAdministrar: true, capacidad: 5, familias: (await S.listarFamilias(db)).filter((f) => f.estado !== 'inactiva') } });
    if (a === 'spotifyEliminarCorreo') return route.fulfill({ json: { ok: true, ...(await S.eliminarCorreo(db, { familiaId: body.familiaId, correo: body.correo, usuario: 'sublicuentas' })) } });
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
let h = await abrirCM(1440, 1200); let pg = h.page;
await (await pg.$('#cmSpotifyFamilias .sp-cm')).screenshot({ path: path.join(out, `1-control-maestro-5de5${suf}.png`) });
if (!antes) {
  const sec = await pg.$eval('#cmSpotifyFamilias', (e) => ({ txt: e.innerText, html: e.innerHTML }));
  assert.match(sec.txt, /SP-001/); assert.match(sec.txt, /Cuenta madre: madre1@ejemplo\.test/); assert.match(sec.txt, /5\/5/);
  for (let n = 1; n <= 5; n++) assert.match(sec.txt, new RegExp(`0${n}\\. invitado${n}@ejemplo\\.test`));
  // T05 · nada que cambie asignaciones
  assert.doesNotMatch(sec.html, /<form|<input(?![^>]*type="search")|<select|data-sp-acc|data-sp-menu|data-sp-slot|data-sp-alta/);
  assert.doesNotMatch(sec.txt, /Agregar|Mover|Desvincular|Eliminar|Relación con Sublichat|Correo del invitado|⋮/);
  assert.equal(await pg.$('.sp-rel'), null);
  // T04 · se elimina en otro canal (Telegram/Bodega usan la misma función) → al recargar: 4 correos + Espacio libre
  await S.eliminarCorreo(db, { familiaId: f1.id, correo: 'invitado5@ejemplo.test', usuario: 'tg:sublicuentas' });
  await pg.evaluate(() => window.SublichatSpotifyCM.recargar()); await pg.waitForTimeout(800);
  const t2 = await pg.$eval('#cmSpotifyFamilias', (e) => e.innerText);
  assert.match(t2, /4\/5/); assert.match(t2, /05\. Espacio libre/); assert.doesNotMatch(t2, /invitado5@/);
  await (await pg.$('#cmSpotifyFamilias .sp-cm')).screenshot({ path: path.join(out, '2-control-maestro-4de5-tras-eliminar.png') });
}
await h.cerrar();
h = await abrirCM(390, 1400); pg = h.page;
console.log('ancho móvil', await pg.evaluate(() => document.documentElement.scrollWidth));
await (await pg.$('#cmSpotifyFamilias .sp-fam')).screenshot({ path: path.join(out, `3-control-maestro-movil${suf}.png`) });
await h.cerrar();
console.log('llamadas', [...new Set(llamadas)].join(','), '· capturas en', out); process.exit(0);
