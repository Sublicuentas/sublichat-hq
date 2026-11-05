// R169 · Mi personaje + sala 3D en navegador (datos ficticios, API real con Firestore en memoria, three.js local).
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { abrir } from './arnes.mjs';
const require = createRequire(import.meta.url);
const { crearFakeDb } = require('../helpers/fake-firestore.cjs');
const out = process.argv[2] || ''; if (out) fs.mkdirSync(out, { recursive: true });
const foto = async (p, n) => { if (out) await p.screenshot({ path: path.join(out, n) }); };
const db = crearFakeDb();

let h = await abrir({ usuario: 'geisell', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db });
await h.page.click('#v2Fila [data-s="sala-juntas"]'); await h.page.waitForSelector('.sj-top');
await h.page.click('[data-sj="personaje"]'); await h.page.waitForFunction(() => !document.getElementById('sjEdCarga'), null, { timeout: 30000 });
await h.page.click('#sjOps [data-op="cabello"][data-v="ondulado"]');
await h.page.click('#sjOps [data-op="colorCabello"][data-v="#A0703F"]');
await h.page.click('[data-sj="tabPers"][data-t="ropa"]'); await h.page.click('#sjOps [data-op="superior"][data-v="camiseta"]'); await h.page.click('#sjOps [data-op="colorSuperior"][data-v="#2B4C7E"]');
await h.page.click('[data-sj="tabPers"][data-t="accesorios"]'); await h.page.check('#sjOps [data-op="logo"]');
await h.page.click('[data-sj="rotar"][data-d="0.6"]'); await h.page.waitForTimeout(700);
await foto(h.page, 'geisell-1440-editor.png');
await h.page.click('[data-sj="guardarPers"]'); await h.page.waitForFunction(() => document.querySelector('.sj-ed-mini img'), null, { timeout: 15000 });
const av = db.todos('sala_avatares').find((x) => x.id === 'geisell');
assert.equal(av.config.cabello, 'ondulado'); assert.equal(av.config.superior, 'camiseta'); assert.equal(av.config.logo, true); assert.equal(av.version, 1);
assert.ok(/^data:image\/(webp|jpeg)/.test(av.miniatura), 'se guardó la miniatura');
console.log('ok Geisell edita y guarda su personaje (versión 1, miniatura)');
await h.cerrar();

// otro navegador / nueva sesión: mismo personaje
h = await abrir({ usuario: 'geisell', ui: 'v2', ancho: 390, alto: 844, salaDb: db });
await h.page.evaluate(() => window.SublichatRBAC.ir('sala-juntas')); await h.page.waitForSelector('.sj-top');
await h.page.click('[data-sj="personaje"]'); await h.page.waitForFunction(() => !document.getElementById('sjEdCarga'), null, { timeout: 30000 });
assert.ok(await h.page.$('#sjOps [data-op="cabello"][data-v="ondulado"].on'), 'el personaje guardado se carga en otra sesión');
await h.page.waitForTimeout(500); await foto(h.page, 'geisell-390-editor.png');
assert.equal(await h.page.evaluate(() => document.documentElement.scrollWidth), 390);
console.log('ok en otra sesión (celular) aparece el mismo personaje; sin desborde');
await h.cerrar();

// Naara ve la sala 3D con el personaje de Geisell; cámaras
h = await abrir({ usuario: 'naara', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db });
await h.page.click('#v2Fila [data-s="sala-juntas"]'); await h.page.waitForSelector('.sj-top');
await h.page.click('[data-sj="personaje"]'); await h.page.waitForFunction(() => !document.getElementById('sjEdCarga'), null, { timeout: 30000 });
await h.page.click('[data-sj="verSalaPers"]'); await h.page.waitForFunction(() => !document.getElementById('sj3dCarga') && document.querySelector('.sj3d-canvas'), null, { timeout: 30000 });
await h.page.waitForTimeout(1500); await foto(h.page, 'naara-1440-sala-general.png');
const nombres = await h.page.evaluate(() => [...document.querySelectorAll('.sj3d-nombre')].map((e) => e.textContent));
assert.deepEqual(nombres.length, 3);
for (const v of ['geisell', 'presentacion']) { await h.page.click(`[data-sj="vista3d"][data-v="${v}"]`); await h.page.waitForTimeout(1300); await foto(h.page, `naara-1440-sala-${v}.png`); }
assert.ok(await h.page.$('[data-sj="vista3d"][data-v="presentacion"].on'));
await h.page.click('[data-sj="salirSala"]'); await h.page.waitForSelector('#sjEdCanvas');
console.log('ok sala 3D: 3 personajes con nombre, cámaras general / hablante / presentación, salir vuelve');
assert.deepEqual(h.errores, []);
await h.cerrar();
console.log('R169 Mi personaje y sala 3D: 3/3 recorridos OK');
