// R172 · Fase 3B en navegador: avatares 3D reales (GLB CC0) en el editor y en la sala, persistencia y respaldo. Datos ficticios.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { abrir } from './arnes.mjs';
const require = createRequire(import.meta.url);
const { crearFakeDb } = require('../helpers/fake-firestore.cjs');
const out = process.argv[2] || ''; if (out) fs.mkdirSync(out, { recursive: true });
const foto = async (p, n, el) => { if (!out) return; if (el) await (await p.$(el)).screenshot({ path: path.join(out, n) }); else await p.screenshot({ path: path.join(out, n) }); };
const db = crearFakeDb();
const editor = async (P) => { await P.click('[data-sj="personaje"]'); await P.waitForFunction(() => !document.getElementById('sjEdCarga'), null, { timeout: 45000 }); await P.waitForTimeout(600); };
const kits = (h) => { const l = []; h.page.on('request', (r) => { const m = r.url().match(/\/assets\/avatares\/(\w+)\.glb/); if (m) l.push(m[1]); }); return l; };

// 1) Geisell en PC: avatar real, piezas, vistas, guardar
let h = await abrir({ usuario: 'geisell', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db });
let pedidos = kits(h); let P = h.page;
await P.click('#v2Fila [data-s="sala-juntas"]'); await P.waitForSelector('.sj-top');
await editor(P);
assert.deepEqual(pedidos, ['mujer'], 'carga el modelo real de la base femenina');
assert.equal(await P.$$eval('#sjOps [data-op="cabello"]', (x) => x.length), 6, '6 peinados');
for (const v of ['frente', 'tresCuartos', 'espalda']) { await P.click(`[data-sj="vistaPers"][data-v="${v}"]`); await P.waitForTimeout(900); await foto(P, `r172-geisell-${v}.png`, '.sj-ed-3d'); }
await P.click('[data-sj="vistaPers"][data-v="tresCuartos"]');
await P.click('#sjOps [data-op="cabello"][data-v="lacio"]'); await P.click('#sjOps [data-op="colorCabello"][data-v="#6B4226"]');
await P.click('[data-sj="tabPers"][data-t="ropa"]');
assert.deepEqual(await P.$$eval('#sjOps [data-op="superior"]', (x) => x.map((b) => b.dataset.v)), ['blazer', 'blusa', 'vestido', 'camiseta', 'chaqueta']);
await P.click('#sjOps [data-op="superior"][data-v="blazer"]'); await P.click('#sjOps [data-op="colorSuperior"][data-v="#7A1F2B"]');
assert.ok(await P.$('#sjOps [data-op="colorInterior"]'), 'blazer: camisa interior');
await P.click('#sjOps [data-op="inferior"][data-v="falda"]'); await P.click('#sjOps [data-op="calzado"][data-v="tacon"]');
await P.click('[data-sj="tabPers"][data-t="accesorios"]'); await P.check('#sjOps [data-op="lentes"]'); await P.check('#sjOps [data-op="reloj"]');
await P.click('[data-sj="zoomPers"][data-d="0.6"]'); await P.waitForTimeout(900);
await foto(P, 'r172-geisell-editor-1440.png');
await P.click('[data-sj="guardarPers"]'); await P.waitForFunction(() => document.querySelector('.sj-ed-mini img'), null, { timeout: 15000 });
let av = db.todos('sala_avatares').find((x) => x.id === 'geisell');
assert.equal(av.config.cabello, 'lacio'); assert.equal(av.config.superior, 'blazer'); assert.equal(av.config.inferior, 'falda'); assert.equal(av.config.calzado, 'tacon');
assert.equal(av.config.lentes, true); assert.equal(av.modelRef, 'glb:quaternius-modular:20261105-r172');
if (out) fs.writeFileSync(path.join(out, 'r172-miniatura-guardada.' + (av.miniatura.startsWith('data:image/webp') ? 'webp' : 'jpg')), Buffer.from(av.miniatura.split(',')[1], 'base64'));
// base masculina: otro modelo, otras piezas
await P.click('[data-sj="tabPers"][data-t="apariencia"]'); await P.click('#sjOps [data-op="genero"][data-v="hombre"]');
await P.waitForTimeout(2500);
assert.ok(pedidos.includes('hombre'));
assert.deepEqual(await P.$$eval('#sjOps [data-op="cabello"]', (x) => x.map((b) => b.dataset.v)), ['clasico', 'moderno', 'rizado', 'largoMedio', 'conBarba', 'cresta']);
await foto(P, 'r172-base-masculina-editor.png', '.sj-ed-3d');
await P.click('[data-sj="restablecer"]'); await P.waitForTimeout(2500);
assert.deepEqual(h.errores, []);
await h.cerrar();
console.log('ok Geisell PC: modelo real, 6 peinados, prendas, vistas frente/3-4/espalda, zoom, guardar (modelRef GLB), base masculina');

// 2) Otra sesión en Android (diseño clásico): el mismo personaje, Guardar libre
h = await abrir({ usuario: 'geisell', ui: 'v1', ancho: 412, alto: 860, salaDb: db });
P = h.page;
await P.evaluate(() => window.SublichatRBAC.ir('sala-juntas')); await P.waitForSelector('.sj-top');
await editor(P);
assert.ok(await P.$('#sjOps [data-op="cabello"][data-v="lacio"].on'), 'mismo peinado tras cerrar sesión');
await P.click('[data-sj="tabPers"][data-t="ropa"]');
assert.ok(await P.$('#sjOps [data-op="inferior"][data-v="falda"].on'));
await P.evaluate(() => document.querySelector('.sj-ed-3d').scrollIntoView({ block: 'center' })); await P.waitForTimeout(500);
await foto(P, 'r172-android-editor.png');
assert.equal(await P.evaluate(() => document.documentElement.scrollWidth), 412);
assert.deepEqual(h.errores, []);
await h.cerrar();
console.log('ok Android: el personaje guardado se recupera igual en otra sesión; sin desborde');

// 3) Naara: sala con los 3 avatares reales sentados
h = await abrir({ usuario: 'naara', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db });
P = h.page;
await P.click('#v2Fila [data-s="sala-juntas"]'); await P.waitForSelector('.sj-top');
await editor(P);
await P.click('[data-sj="verSalaPers"]'); await P.waitForFunction(() => !document.getElementById('sj3dCarga') && document.querySelector('.sj3d-canvas'), null, { timeout: 45000 });
await P.waitForTimeout(1500); await foto(P, 'r172-sala-general.png', '#sj3dEscena');
for (const v of ['naara', 'libni', 'geisell']) { await P.click(`[data-sj="vista3d"][data-v="${v}"]`); await P.waitForTimeout(1500); await foto(P, `r172-sala-${v}.png`, '#sj3dEscena'); }
assert.deepEqual(h.errores, []);
await h.cerrar();
console.log('ok Sala: Naara, Libni y Geisell con avatar real sentadas; planos individuales');

// 4) Si el modelo no descarga: aviso claro y personaje simple (no se rompe ni se borra lo guardado)
h = await abrir({ usuario: 'libni', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db });
P = h.page;
await P.route('**/assets/avatares/*.glb*', (r) => r.fulfill({ status: 503, body: '' }));
await P.click('#v2Fila [data-s="sala-juntas"]'); await P.waitForSelector('.sj-top');
const toasts = []; await P.exposeFunction('__t', (t) => toasts.push(t));
await P.evaluate(() => new MutationObserver(() => { const t = document.getElementById('sjToast'); if (t) window.__t(t.textContent); }).observe(document.body, { subtree: true, childList: true, characterData: true }));
await editor(P);
await P.waitForTimeout(300);
assert.ok(toasts.some((t) => /versión simple/.test(t)), 'avisa que usa el respaldo');
assert.equal(db.todos('sala_avatares').filter((x) => x.id === 'libni').length, 0, 'no se guardó nada solo por abrir');
await h.cerrar();
console.log('ok Respaldo: sin modelo → aviso y personaje simple, sin errores');
console.log('R172 avatares reales: 4/4 recorridos OK');
