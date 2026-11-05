// R167 · Sala de Juntas en navegador (datos ficticios, API real con Firestore en memoria):
// Naara programa desde el formulario → Libni la ve, confirma y entra a la antesala → Magdiel no ve el botón.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { abrir } from './arnes.mjs';
const require = createRequire(import.meta.url);
const { crearFakeDb } = require('../helpers/fake-firestore.cjs');
const out = process.argv[2] || ''; if (out) fs.mkdirSync(out, { recursive: true });
const foto = async (p, n, w) => { if (out) await p.screenshot({ path: path.join(out, n), fullPage: !!w }); };
const db = crearFakeDb();
const manana = new Date(Date.now() - 6 * 3600000 + 4 * 86400000).toISOString().slice(0, 10);

let h = await abrir({ usuario: 'naara', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db });
const tabs = await h.page.evaluate(() => [...document.querySelectorAll('#v2Fila > .v2-tab, #v2Fila > .v2-grupo > .v2-tab')].map((b) => b.textContent.trim()));
assert.equal(tabs[6], 'Sala de Juntas', 'después de Catálogo: ' + tabs.join(' · '));
await h.page.click('#v2Fila [data-s="sala-juntas"]'); await h.page.waitForSelector('.sj-top'); await h.page.waitForTimeout(400);
await foto(h.page, 'naara-1440-panel-vacio.png');
await h.page.fill('#sjForm [name="titulo"]', 'Revisión mensual y próximos objetivos');
await h.page.fill('#sjForm [name="fecha"]', manana); await h.page.fill('#sjForm [name="hora"]', '19:00');
await h.page.fill('#sjForm [name="agenda"]', 'Resultados de ventas de octubre\nCampañas de noviembre\nProyectos: Sublichat, Catálogo y SubliStudio');
await h.page.click('#sjForm button[type="submit"]'); await h.page.click('#sjForm button[type="submit"]').catch(() => {}); // doble clic
await h.page.waitForSelector('.sj-prox h4'); await h.page.waitForTimeout(3600); // deja pasar el aviso del 2.º clic
assert.equal(db.todos('sala_reuniones').length, 1, 'un solo registro aunque haya doble clic');
assert.equal(db.todos('sala_invitaciones').length, 3);
await foto(h.page, 'naara-1440-panel.png', true);
await h.page.click('.sj-prox [data-sj="antesala"]'); await h.page.waitForSelector('.sj-ante-acc'); await h.page.waitForTimeout(300);
await foto(h.page, 'naara-1440-antesala.png');
await h.page.click('[data-sj="calendario"]').catch(() => {});
await h.page.click('[data-sj="inicio"]'); await h.page.click('[data-sj="calendario"]'); await h.page.waitForSelector('.sj-cal');
await foto(h.page, 'naara-1440-calendario.png');
console.log('ok Naara programa (sin duplicar con doble clic), antesala y calendario');
await h.cerrar();

h = await abrir({ usuario: 'libni', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db });
await h.page.click('#v2Fila [data-s="sala-juntas"]'); await h.page.waitForSelector('.sj-top'); await h.page.waitForTimeout(400);
assert.equal(await h.page.$('#sjForm'), null, 'Libni no ve el formulario de convocatoria');
assert.equal(await h.page.$('[data-sj="nueva"]'), null);
await foto(h.page, 'libni-1440-panel.png', true);
await h.page.click('.sj-prox [data-sj="rsvp"][data-r="aceptada"]'); await h.page.waitForTimeout(700);
assert.equal(db.todos('sala_invitaciones').find((x) => x.usuario === 'libni').estado, 'aceptada');
assert.equal(db.todos('sala_invitaciones').find((x) => x.usuario === 'geisell').estado, 'pendiente');
console.log('ok Libni confirma solo su invitación; no puede convocar');
await h.cerrar();

h = await abrir({ usuario: 'libni', ui: 'v2', ancho: 390, alto: 844, salaDb: db });
await h.page.evaluate(() => window.SublichatRBAC.ir('sala-juntas')); await h.page.waitForSelector('.sj-top'); await h.page.waitForTimeout(400);
await foto(h.page, 'libni-390-panel.png', true);
assert.equal(await h.page.evaluate(() => document.documentElement.scrollWidth), 390);
await h.page.click('.sj-prox [data-sj="antesala"]'); await h.page.waitForSelector('.sj-ante-acc'); await h.page.waitForTimeout(300);
await foto(h.page, 'libni-390-antesala.png', true);
console.log('ok celular sin desborde · errores JS:', h.errores.length);
assert.deepEqual(h.errores, []);
await h.cerrar();

h = await abrir({ usuario: 'magdiel', ui: 'v2', ancho: 1440, salaDb: db });
assert.equal(await h.page.$('#v2Fila [data-s="sala-juntas"]'), null, 'Magdiel no ve el botón');
const forzado = await h.page.evaluate(async () => { const r = await fetch('/api/sala-juntas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"accion":"panel"}' }); return r.status; });
assert.equal(forzado, 403); console.log('ok Magdiel: sin botón y 403 si llama la API directo');
await h.cerrar();
console.log('R167 Sala de Juntas: 5/5 recorridos OK');
