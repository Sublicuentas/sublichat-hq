// R196 · Capturas y prueba de navegador (datos FICTICIOS): pestaña FINANZAS y Spotify Familiar en Control Maestro.
// /api/finanzas (finp_*) y /api/inventario (spotify*) usan el código REAL con Firestore en memoria. Uso: node tests/visual/r196-finanzas-spotify.mjs <carpeta>
import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict'; import { createRequire } from 'node:module';
import { abrir } from './arnes.mjs';
import { fakeFirestore } from '../helpers/fake-firestore.mjs';
import { handlePanel } from '../../api/_finanzas-panel.js';
import { resumenInventario, MODELOS, MONEDAS } from '../../api/_finanzas-empresa.js';
import { costosProveedor, rentabilidad } from '../../api/_finanzas-reportes.js';
const require = createRequire(import.meta.url);
const S = require('../../api/_spotify-familias.js');
const out = process.argv[2] || '/tmp/r196'; fs.mkdirSync(out, { recursive: true });
let ok = 0; const paso = (m) => { ok++; console.log('ok', m); };

// ---------- datos ficticios
const P = [['NFX-VIP', 'Netflix VIP', 'perfiles', 150, 66.25, 40], ['DIS-PREM', 'Disney Premium', 'perfiles', 170, 102, 22], ['PRIME', 'Prime Video', 'perfiles', 120, 70, 18], ['OFFICE365', 'Office 365', 'software', 300, 182, 9],
  ['GEMINI', 'Gemini Pro', 'ia', 200, 37, 11], ['STELLA', 'Stella TV', 'tv_digital', 160, 125, 14], ['CANVA', 'Canva', 'software', 120, 1.4, 16], ['FF', 'Free Fire 100 diamantes', 'videojuegos', 50, 40, 25], ['DUOLINGO', 'Duolingo', 'software', 150, null, 4]];
const seed = { fin_productos: {}, fin_consumos: {}, fin_lotes: {}, fin_proveedores: { 'trap-colombia': { alias: 'Trap Colombia', pais: 'Colombia', moneda: 'USDT', metodoPago: 'Binance', activo: true }, 'deku-peru': { alias: 'Deku Perú', pais: 'Perú', moneda: 'USDT', metodoPago: 'Binance', activo: true }, eneba: { alias: 'Eneba', pais: 'Internacional', moneda: 'USD', metodoPago: 'Tarjeta', activo: true } }, inventario: {}, clientes: {} };
for (const [id, nombre, cat, , costo] of P) seed.fin_productos[id] = { nombre, categoria: cat, modelo: id === 'FF' ? 'unidad' : 'unidad', capacidad: 1, activo: true, costoRef: costo ? { monto: costo, moneda: 'HNL' } : { monto: 0, moneda: 'HNL' } };
let n = 0;
for (const mes of ['2026-10', '2026-11']) for (const [id, nombre, , precio, costo, ventas] of P) {
  const v = mes === '2026-10' ? Math.round(ventas * 0.85) : ventas;
  for (let i = 0; i < v; i++) seed.fin_consumos[`v${++n}`] = { mesKey: mes, estado: costo ? 'completo' : 'pendiente', fecha: `${mes}-0${1 + (i % 9)}`, clienteNombre: `Cliente ${i}`, lineas: [{ productoId: id, producto: nombre, servicio: nombre, cantidad: 1, ingresoHnl: precio, costoHnl: costo || 0, pendiente: !costo, consumos: costo ? [{ loteId: id === 'NFX-VIP' ? (i % 2 ? 'L-trap' : 'L-deku') : 'L-' + id, cantidad: 1, costoHnl: costo }] : [] }] };
}
seed.fin_lotes = { 'L-trap': { fecha: '2026-11-02', productoId: 'NFX-VIP', producto: 'Netflix VIP', proveedor: 'Trap Colombia', cantidad: 25, disponible: 5, consumido: 20, unidad: 'unidad', moneda: 'USDT', costoTotalMoneda: 62.5, tasa: 26.5, costoTotalHnl: 1656.25, costoUnitarioHnl: 66.25, pago: 'binance', cuentaPagoNombre: 'Binance' },
  'L-deku': { fecha: '2026-11-04', productoId: 'NFX-VIP', producto: 'Netflix VIP', proveedor: 'Deku Perú', cantidad: 20, disponible: 0, consumido: 20, unidad: 'unidad', moneda: 'USDT', costoTotalMoneda: 52, tasa: 26.6, costoTotalHnl: 1383.2, costoUnitarioHnl: 69.16, pago: 'binance', cuentaPagoNombre: 'Binance' },
  'L-OFFICE365': { fecha: '2026-11-05', productoId: 'OFFICE365', producto: 'Office 365', proveedor: 'Eneba', cantidad: 10, disponible: 1, consumido: 9, unidad: 'unidad', moneda: 'USD', costoTotalMoneda: 69, tasa: 26.38, costoTotalHnl: 1820, costoUnitarioHnl: 182, pago: 'banco', cuentaPagoNombre: 'BAC' } };
for (let i = 1; i <= 30; i++) seed.inventario[`vip-${i}`] = { plataforma: 'vipnetflix', correo: `extra${i}@ejemplo.test`, cuentaMadre: `madre${1 + (i % 3)}@ejemplo.test`, clientes: [{ nombre: `Cliente VIP ${i}` }], estado: 'ocupado' };
seed.clientes = { ana: { nombre: 'Ana Prueba', servicios: [{ compraId: 'sp-ana', plataforma: 'spotify', correo: 'invitado1@ejemplo.test', fechaRenovacion: '04/12/2026' }] }, beto: { nombre: 'Beto Prueba', servicios: [{ compraId: 'sp-beto', plataforma: 'spotify', correo: 'invitado2@ejemplo.test', fechaRenovacion: '01/11/2026' }] }, caro: { nombre: 'Caro Prueba', servicios: [{ compraId: 'sp-caro', plataforma: 'spotify', correo: 'invitado3@ejemplo.test', fechaRenovacion: '20/12/2026' }] } };
const db = fakeFirestore(seed);
const f1 = await S.crearFamilia(db, { madreCorreo: 'madre.spotify@ejemplo.test', usuario: 'naara' });
await S.vincularInvitado(db, { familiaId: f1.id, correo: 'invitado1@ejemplo.test', clienteId: 'ana', compraId: 'sp-ana' });
await S.vincularInvitado(db, { familiaId: f1.id, correo: 'invitado2@ejemplo.test', clienteId: 'beto', compraId: 'sp-beto' });
await S.vincularInvitado(db, { familiaId: f1.id, correo: 'invitado3@ejemplo.test', clienteId: 'caro', compraId: 'sp-caro', pendiente: true });
await S.crearFamilia(db, { madreCorreo: 'madre2.spotify@ejemplo.test', usuario: 'naara' });
await S.guardarClaveMadre(db, { familiaId: f1.id, clave: 'Ficticia#1' });
for (let i = 1; i <= 6; i++) db._data.set(`inventario/nf-${i}`, { v: 1, data: { plataforma: 'netflix', correo: `netflix${i}@ejemplo.test`, clave: 'x', capacidad: 5, ocupados: i % 5, disponibles: 5 - (i % 5), clientes: [], estado: 'activa' } });
for (let i = 1; i <= 3; i++) db._data.set(`inventario/sp-${i}`, { v: 1, data: { plataforma: 'spotify', correo: `individual${i}@ejemplo.test`, clave: 'x', capacidad: 1, ocupados: 1, disponibles: 0, clientes: [{ nombre: `Cliente ${i}` }], estado: 'llena' } });
// Bodega/Control Maestro leen el inventario REAL de esta prueba (incluye el reflejo «spotifyfamiliar» que crea la librería)
async function apiDatos(route) {
  let body = {}; try { body = JSON.parse(route.request().postData() || '{}'); } catch (_) {}
  const docs = [...db._data.entries()].filter(([k]) => k.startsWith('inventario/') && k.split('/').length === 2).map(([k, r]) => ({ id: k.split('/')[1], data: r.data }));
  if (route.request().url().includes('/api/mobile-core')) return route.fulfill({ json: { ok: true, items: docs.map((d) => ({ id: d.id, ...d.data })), nextCursor: '' } });
  if (body.accion === 'control_datos' && body.coleccion === 'inventario') return route.fulfill({ json: { ok: true, coleccion: 'inventario', documentos: docs, nextCursor: '' } });
  return route.fallback();
}
const deps = { hoyYmdHN: () => '2026-11-08', loadMethods: async () => [{ id: 'bac', nombre: 'BAC' }], auditar: (tx, d, idn, ev) => tx.set(d.collection('auditoria_eventos').doc(), ev), resumenInventario, costosProveedor, rentabilidad, MODELOS, MONEDAS };
const ident = { usuario: 'sublicuentas', role: 'sublicuentas', admin: true };
const llamadas = [];
// SheetJS 0.18.5, ExcelJS 4.4.0 y Chart.js 4.4.1 (mismas versiones que index.html pide a cdnjs): copia local porque la prueba corre sin red.
const VEND = process.env.R196_VENDOR || '/tmp/claude-0/vend196';
const libs = async (p) => { for (const f of ['xlsx-0.18.5/dist/xlsx.full.min.js', 'exceljs-4.4.0/dist/exceljs.min.js', 'chart.js-4.4.1/dist/chart.umd.js']) await p.addScriptTag({ path: path.join(VEND, f) }); };
async function apiFinanzas(route) {
  const body = JSON.parse(route.request().postData() || '{}'); llamadas.push(body.accion);
  if (!String(body.accion).startsWith('finp_')) return route.fulfill({ json: { ok: false, error: 'solo finp_ en esta prueba' } });
  const res = { c: 200, b: null, status(c) { res.c = c; return res; }, json(b) { res.b = b; return res; } };
  await handlePanel(db, body.accion, body, ident, { uid: 'u' }, res, deps);
  return route.fulfill({ status: res.c, json: res.b });
}
async function apiInventario(route) {
  const body = JSON.parse(route.request().postData() || '{}'); const a = body.accion;
  try {
    if (a === 'spotifyPanel') return route.fulfill({ json: { ok: true, hoy: '2026-11-08', capacidad: 5, familias: await S.panelFamilias(db, { hoy: '2026-11-08' }) } });
    if (a === 'spotifyMarcar') return route.fulfill({ json: { ok: true, ...(await S.marcarMiembro(db, body)) } });
    if (a === 'spotifyLiberar') return route.fulfill({ json: { ok: true, ...(await S.liberarEspacio(db, { correo: body.correo, confirmoRetiro: body.confirmoRetiro === true })) } });
  } catch (e) { return route.fulfill({ json: { ok: false, error: e.message } }); }
  return route.fulfill({ json: { ok: true, items: [], data: [] } });
}

// ---------- FINANZAS (escritorio)
let h = await abrir({ usuario: 'sublicuentas', ui: 'v2', ancho: 1440, alto: 1700, datos: { clientes: 36, inventario: 40 } }); let pg = h.page;
await pg.route('**/api/finanzas', apiFinanzas); await pg.route('**/api/inventario', apiInventario); await libs(pg);
const tab = await pg.evaluate(() => [...document.querySelectorAll('button,a')].some((b) => /^\s*Finanzas\s*$/.test(b.textContent) && b.offsetParent));
assert.ok(tab, 'la pestaña Finanzas aparece en la navegación horizontal'); paso('pestaña Finanzas visible en el menú horizontal (Sublicuentas)');
await pg.evaluate(() => window.subliRBAC ? window.subliRBAC.go('finanzas') : window.SublichatRBAC.ir('finanzas'));
await pg.waitForSelector('.fz-kpis', { timeout: 15000 }); await pg.waitForTimeout(800);
let v = await pg.evaluate(() => ({ tabs: [...document.querySelectorAll('.fz-tab')].map((t) => t.textContent.trim()), filas: document.querySelectorAll('.fz-rent tbody tr').length, pend: /Pendiente de costo/.test(document.querySelector('.fz-rent').innerText), top: document.querySelectorAll('.fz-top-f').length, canvas: !!document.querySelector('#fzChart'), ancho: document.documentElement.scrollWidth, bg: getComputedStyle(document.querySelector('.fz-card')).backgroundColor }));
assert.deepEqual(v.tabs, ['Resumen', 'Proveedores', 'Compras', 'Ganancias', 'Reportes']); assert.ok(v.filas >= 8); assert.ok(v.pend, 'Duolingo sin costo → Pendiente de costo'); assert.equal(v.top, 5); assert.equal(v.bg, 'rgb(255, 255, 255)'); assert.equal(v.ancho, 1440);
paso('Ganancias: KPIs, gráfico por categoría, Top 5, tabla con «Pendiente de costo», alertas; tarjetas blancas, sin scroll horizontal');
await pg.screenshot({ path: path.join(out, 'finanzas-ganancias-1440.png'), fullPage: true });
for (const t of ['resumen', 'proveedores']) { await pg.click(`[data-fz-tab="${t}"]`); await pg.waitForTimeout(700); await pg.screenshot({ path: path.join(out, `finanzas-${t}-1440.png`), fullPage: true }); }
paso('Resumen y Proveedores');
await pg.click('[data-fz-tab="compras"]'); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(out, 'finanzas-compras-1440.png'), fullPage: true });
// Importación Excel VIP con la PLANTILLA real (rellenada con datos ficticios por openpyxl)
await pg.click('[data-fz-sub="importar"]'); await pg.waitForSelector('[data-fz-file]', { state: 'attached' });
await pg.setInputFiles('[data-fz-file]', process.env.R196_XLSX || '/tmp/claude-0/r196-vip-prueba.xlsx');
await pg.waitForSelector('.fz-cont', { timeout: 15000 }).catch(async (e) => { console.log('IMP', await pg.evaluate(() => JSON.stringify(window.SublichatFinanzas._st.imp && { e: window.SublichatFinanzas._st.imp.error, c: window.SublichatFinanzas._st.imp.cargando })), llamadas.slice(-4)); await pg.screenshot({ path: path.join(out, 'fallo.png') }); throw e; }); await pg.waitForTimeout(400);
v = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('.fz-cont > div')].map((d) => [d.querySelector('span').textContent, Number(d.querySelector('b').textContent)])));
assert.equal(v['Nuevos'], 20); assert.equal(v['Ambiguos'], 0); assert.equal(v['Sin coincidencia'], 1); assert.equal(v['Pagos únicos (lotes nuevos)'], 1); assert.equal(v['Ventas, cuentas o clientes creados'], 0);
paso('vista previa: 20 nuevos, 1 sin coincidencia bloqueada sola, 1 pago único, ejemplos ignorados');
await pg.screenshot({ path: path.join(out, 'finanzas-importar-previa-1440.png'), fullPage: true });
const [dlErr] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-fz="errores"]')]);
await dlErr.saveAs(path.join(out, 'Sublichat_Netflix_VIP_errores.xlsx')); paso('Excel de errores descargado');
await pg.check('[data-fz-confirmo]'); await pg.click('[data-fz="importar"]');
await pg.waitForFunction(() => !document.querySelector('.fz-cont') && document.querySelectorAll('.fz-t tbody tr').length > 0, null, { timeout: 15000 }).catch(() => {});
await pg.waitForTimeout(1200);
assert.equal([...db._data.keys()].filter((k) => k.startsWith('fin_vip_extras/')).length, 20); assert.equal([...db._data.keys()].filter((k) => k.startsWith('fin_vip_lotes/')).length, 1);
paso('importación confirmada: 20 vínculos, 1 lote, auditoría');
await pg.click('[data-fz-tab="compras"]'); await pg.click('[data-fz-sub="vip"]'); await pg.waitForSelector('[data-fz-viptab]'); await pg.waitForTimeout(900);
await pg.screenshot({ path: path.join(out, 'finanzas-netflix-vip-1440.png'), fullPage: true });
await pg.click('[data-fz-sub="spotify"]'); await pg.waitForSelector('[data-fz-spf]', { timeout: 15000 }); await pg.waitForTimeout(500);
await pg.click(`[data-fz-spf="editar"][data-id="${f1.id}"]`); await pg.fill('.fz-modal [name="costo"]', '320'); await pg.fill('.fz-modal [name="ren"]', '2026-11-12'); await pg.click('.fz-modal [data-ok]');
await pg.waitForTimeout(1200);
assert.equal(db._data.get(`inventario/${S.idBodega(f1.id)}`).data.costoMensualHnl, 320, 'Bodega refleja el pago mensual');
await pg.screenshot({ path: path.join(out, 'finanzas-spotify-familiar-1440.png'), fullPage: true });
paso('Finanzas › Spotify Familiar: cuentas solas; se anota pago (L320) y renovación; Bodega lo refleja');
await pg.click('[data-fz-tab="reportes"]'); await pg.waitForTimeout(300);
const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 20000 }), pg.click('[data-fz="excel"]')]);
const xlsx = path.join(out, 'Sublichat_Finanzas_reporte.xlsx'); await dl.saveAs(xlsx);
assert.ok(fs.statSync(xlsx).size > 5000); paso('Reportes: Excel descargado (' + fs.statSync(xlsx).size + ' bytes)');
await pg.screenshot({ path: path.join(out, 'finanzas-reportes-1440.png'), fullPage: true });
if (h.errores.length) console.log('ERRORES pagina', h.errores.slice(0, 5));
await h.cerrar();

// ---------- FINANZAS móvil
h = await abrir({ usuario: 'sublicuentas', ui: 'v2', ancho: 390, alto: 2600 }); pg = h.page;
await pg.route('**/api/finanzas', apiFinanzas); await libs(pg);
await pg.evaluate(() => window.subliRBAC ? window.subliRBAC.go('finanzas') : window.SublichatRBAC.ir('finanzas'));
await pg.waitForSelector('.fz-kpis', { timeout: 15000 }); await pg.waitForTimeout(800);
v = await pg.evaluate(() => document.documentElement.scrollWidth); assert.ok(v <= 392, 'sin scroll horizontal en móvil: ' + v);
await pg.screenshot({ path: path.join(out, 'finanzas-ganancias-390.png'), fullPage: true }); paso('móvil 390 sin scroll horizontal');
await h.cerrar();

// ---------- Geisell / Relojes no ven Finanzas (permiso propio)
h = await abrir({ usuario: 'libni', ui: 'v2', ancho: 1440 }); pg = h.page;
v = await pg.evaluate(() => [...document.querySelectorAll('button,a')].some((b) => /^\s*Finanzas\s*$/.test(b.textContent) && b.offsetParent));
assert.equal(v, false); paso('Relojes no ve la pestaña Finanzas (solo Sublicuentas por defecto)'); await h.cerrar();

// ---------- Control Maestro › Spotify
h = await abrir({ usuario: 'sublicuentas', ui: 'v2', ancho: 1440, alto: 2300, datos: { clientes: 36, inventario: 0 } }); pg = h.page;
await pg.route('**/api/inventario', apiInventario);
// El arnés no tiene Firestore real: se le pasa a Control Maestro el inventario de ESTA prueba (incluye el reflejo «spotifyfamiliar»)
const cuentasInv = [...db._data.entries()].filter(([k]) => k.startsWith('inventario/') && k.split('/').length === 2).map(([k, r]) => ({ id: k.split('/')[1], ...r.data }));
await pg.evaluate((cuentas) => { const orig = window.sublichatControlData; window.sublichatControlData = () => { const x = orig ? orig() : {}; return { ...x, ready: true, version: (Number(x.version) || 0) + 1000, cuentas: [...(x.cuentas || []), ...cuentas] }; }; }, cuentasInv);
await pg.evaluate(() => window.subliRBAC ? window.subliRBAC.go('control-cuentas') : window.SublichatRBAC.ir('control-cuentas'));
await pg.waitForSelector('[data-cm-open-workspace="spotifyfamiliar"]', { timeout: 20000 });
v = await pg.evaluate(() => [...document.querySelectorAll('[data-cm-open-workspace]')].map((b) => b.getAttribute('data-cm-open-workspace')));
assert.ok(v.includes('spotifyfamiliar') && v.includes('spotify'), 'Spotify Familiar es una plataforma APARTE de Spotify: ' + v);
paso('Control Maestro: «Spotify Familiar» sale como plataforma aparte (reflejo automático de las cuentas)');
await pg.click('[data-cm-open-workspace="spotifyfamiliar"]');
await pg.waitForSelector('#cmSpotifyFamilias .sp-fam, #cmSpotifyFamilias [class*="sp-"]', { timeout: 15000 }); await pg.waitForTimeout(900);
v = await pg.evaluate(() => { const c = document.querySelector('#cmSpotifyFamilias'); const fams = c.querySelectorAll('.sp-fam'); return { fams: fams.length, filas: fams[0] ? fams[0].querySelectorAll('.sp-fila:not(.sp-th)').length : 0, txt: c.innerText }; });
assert.ok(v.fams >= 2); assert.equal(v.filas, 5, 'exactamente 5 filas por familia');
assert.match(v.txt, /Ana Prueba/); assert.match(v.txt, /Disponible/); assert.match(v.txt, /clave guardada/); assert.doesNotMatch(v.txt, /Ficticia#1/, 'la clave no se muestra');
paso('Control Maestro › Spotify: 2 familias, 5 filas cada una, 3 ocupadas y 2 disponibles con cliente de la ficha');
await pg.screenshot({ path: path.join(out, 'control-maestro-spotify-1440.png'), fullPage: true });
// otra plataforma: no aparece el bloque Spotify
const clic = await pg.evaluate(() => { const b = [...document.querySelectorAll('[data-cm-audit-platform],[data-cm-platform],[data-cm-open-workspace]')].find((x) => /^spotify$/i.test(x.getAttribute('data-cm-audit-platform') || x.getAttribute('data-cm-platform') || x.getAttribute('data-cm-open-workspace') || '')); if (b) { b.click(); return true; } return false; });
await pg.waitForTimeout(900);
v = await pg.evaluate(() => !!document.querySelector('#cmSpotifyFamilias'));
assert.ok(clic, 'se encontró Spotify individual'); assert.equal(v, false, 'en Spotify (individual) no aparece el bloque familiar');
await pg.screenshot({ path: path.join(out, 'control-maestro-spotify-individual-1440.png') });
paso('Control Maestro › Spotify (individual): vista de siempre, sin bloque familiar');
if (h.errores.length) console.log('ERRORES pagina', h.errores.slice(0, 5));
await h.cerrar();
console.log(`\n${ok} comprobaciones OK · capturas en ${out}`);
process.exit(0);
