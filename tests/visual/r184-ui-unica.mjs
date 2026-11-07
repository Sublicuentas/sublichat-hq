// R184 · Prueba de navegador (datos FICTICIOS): interfaz única, Perfil sin «Tema de color», tema corporativo fijo,
// esqueleto sin ceros falsos mientras carga, menú 44–48 px con foco visible, roles respetados.
// Uso: node tests/visual/r184-ui-unica.mjs <carpeta>
import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict'; import { abrir } from './arnes.mjs';
const out = process.argv[2] || '/tmp/r184'; fs.mkdirSync(out, { recursive: true });
let ok = 0; const paso = (m) => { ok++; console.log('ok', m); };

// 1) Preferencias viejas guardadas (tema y diseño anterior) no deciden nada y NO se borran del perfil
let h = await abrir({ usuario: 'naara', ui: 'v1', ancho: 1440 }); let P = h.page;
await P.evaluate(() => { const k = 'sublichat_profile_naara'; const p = JSON.parse(localStorage.getItem(k) || '{}'); p.tema = 'rosa'; localStorage.setItem(k, JSON.stringify(p)); localStorage.setItem('sublichat_ui_v2', '0'); });
await P.reload(); await P.waitForFunction(() => document.body.classList.contains('ready')); await P.waitForTimeout(1500);
let v = await P.evaluate(() => ({ v2: document.documentElement.classList.contains('ui-v2'), tema: JSON.parse(localStorage.getItem('sublichat_profile_naara') || '{}').tema, flag: localStorage.getItem('sublichat_ui_v2'), light: document.body.classList.contains('light') }));
assert.equal(v.v2, true); assert.equal(v.flag, null); assert.equal(v.tema, 'rosa', 'la preferencia vieja se conserva (no se borra)'); assert.equal(v.light, true);
paso('diseño nuevo para todos; preferencia vieja de tema conservada pero ignorada');

// 2) Perfil: sin selector de tema; los demás campos siguen guardando
await P.evaluate(() => window.SublichatRBAC.ir('perfil')); await P.waitForTimeout(900);
v = await P.evaluate(() => ({ grid: !!document.getElementById('themeSwatchGrid'), swatch: document.querySelectorAll('.theme-swatch').length, texto: /Tema de color/i.test(document.querySelector('#rbac-perfil, #screen-perfil')?.innerText || '') }));
assert.deepEqual(v, { grid: false, swatch: 0, texto: false }); paso('Perfil sin «Tema de color»');
const nombre = P.locator('#profNombre:visible').first(); await nombre.fill('Naara Prueba R184'); await P.locator('#profCargo:visible').first().fill('Gerencia R184');
await P.locator('#profGuardar:visible').first().click(); await P.waitForTimeout(700);
const g = await P.evaluate(() => localStorage.getItem('sublichat_profile_naara') || '');
assert.ok(g.includes('Naara Prueba R184') && g.includes('Gerencia R184'), 'el perfil guarda los demás campos'); assert.ok(g.includes('"tema":"rosa"'), 'guardar no borra la preferencia vieja');
paso('Perfil guarda nombre y cargo (demás campos intactos)');
await P.screenshot({ path: path.join(out, 'perfil-naara-1440.png'), fullPage: true });

// 3) Menú: alto 44–48, foco visible, sin cortes
v = await P.evaluate(() => { const t = [...document.querySelectorAll('#v2Fila .v2-tab')].filter((b) => b.offsetParent); const hs = t.map((b) => Math.round(b.getBoundingClientRect().height)); const cs = getComputedStyle(t[1]); return { hs, fs: cs.fontSize, fw: cs.fontWeight, ancho: document.documentElement.scrollWidth }; });
assert.ok(v.hs.every((x) => x >= 44 && x <= 48), 'alto ' + v.hs); assert.ok(parseFloat(v.fs) >= 13 && parseFloat(v.fs) <= 14, 'letra ' + v.fs); assert.equal(v.fw, '600'); assert.equal(v.ancho, 1440);
await P.keyboard.press('Tab'); await P.focus('#v2Fila .v2-tab:nth-child(2), #v2Fila > :nth-child(2) .v2-tab');
const foco = await P.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; });
assert.ok(foco, 'foco visible'); await P.screenshot({ path: path.join(out, 'menu-foco-1440.png'), clip: { x: 0, y: 0, width: 1440, height: 150 } });
paso(`menú ${v.hs[0]} px, ${v.fs}/${v.fw}, foco visible, sin desborde`);
await h.cerrar();

// 4) Esqueleto mientras carga: nunca muestra ceros falsos
h = await abrir({ usuario: 'naara', ui: 'v2', ancho: 1440, datos: { clientes: 1500, inventario: 600, finanzas: 4000, latFs: 600, latApi: 1500, msPorDoc: 0.3 } }); P = h.page;
await P.waitForFunction(() => document.querySelector('#v2Inicio .v2-esq'), null, { timeout: 60000 });
const esq = await P.evaluate(() => ({ n: document.querySelectorAll('#v2Inicio .v2-esq').length, ceros: /\bL0\b|^0$/m.test([...document.querySelectorAll('#v2Inicio .v2-kpis .v2k')].map((e) => e.innerText).join('\n')) }));
assert.ok(esq.n > 0); assert.equal(esq.ceros, false, 'sin ceros falsos'); await P.screenshot({ path: path.join(out, 'inicio-cargando-esqueleto.png') });
await P.waitForFunction(() => document.querySelector('#v2Inicio .v2-kpis .v2k:not(.v2-esq)'), null, { timeout: 120000 });
await P.waitForTimeout(500); await P.screenshot({ path: path.join(out, 'inicio-cargado.png') });
paso('Inicio muestra esqueleto (sin ceros) y luego datos reales');
await h.cerrar();

// 5) Rol limitado: mismo diseño, mismos permisos (no ve Control Maestro si no lo tiene)
h = await abrir({ usuario: 'relojes', ui: 'v1', ancho: 390, alto: 844 }); P = h.page; await P.waitForTimeout(1500);
v = await P.evaluate(() => ({ v2: document.documentElement.classList.contains('ui-v2'), ancho: document.documentElement.scrollWidth, permisos: !!document.querySelector('#v2Fila [data-s="permisos"]:not([hidden])') }));
assert.equal(v.v2, true); assert.equal(v.ancho, 390); assert.equal(v.permisos, false);
await P.screenshot({ path: path.join(out, 'relojes-390-inicio.png') }); paso('rol limitado: diseño nuevo, 390 px sin desborde, sin Permisos');
await h.cerrar();
console.log(`R184 interfaz única: ${ok} pasos OK`);
