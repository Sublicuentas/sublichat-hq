// R174 · Fase 6 en navegador: 5 escenarios, editor común de estilos, presets con nombre, oficial de Naara,
// convocatoria con escenario y sala en vivo armada con ese estilo. API real + Firestore en memoria + LiveKit simulado.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { abrir } from './arnes.mjs';
const require = createRequire(import.meta.url);
const { crearFakeDb } = require('../helpers/fake-firestore.cjs');
const out = process.argv[2] || ''; if (out) fs.mkdirSync(out, { recursive: true });
const foto = async (p, n, el) => { if (!out) return; if (el) await (await p.$(el)).screenshot({ path: path.join(out, n) }); else await p.screenshot({ path: path.join(out, n) }); };
const ENV = { LIVEKIT_URL: 'wss://prueba.livekit.cloud', LIVEKIT_API_KEY: 'APIprueba', LIVEKIT_API_SECRET: 'secreto-de-prueba-no-real-0123456789' };
const db = crearFakeDb();
const listo = async (P) => { await P.waitForTimeout(400); await P.waitForFunction(() => !document.getElementById('sjEscCarga'), null, { timeout: 60000 }); await P.waitForTimeout(800); };

// 1) Naara: recorre los 5 escenarios, ajusta Subli Live y lo guarda como "Anuncio promo" oficial
let h = await abrir({ usuario: 'naara', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db, salaEnv: ENV });
let P = h.page;
await P.click('#v2Fila [data-s="sala-juntas"]'); await P.waitForSelector('.sj-top');
await P.click('[data-sj="escenarios"]'); await P.waitForSelector('#sjEsc3d'); await listo(P);
assert.deepEqual(await P.$$eval('[data-sj="escTab"]', (x) => x.map((b) => b.textContent)), ['Sala de Juntas', 'Sala de Socios', 'Subli Aula', 'Subli Live', 'Subli Cinema']);
for (const k of ['paredes', 'asientos', 'paleta', 'luz']) assert.equal(await P.$$eval(`[data-sj="escOp"][data-k="${k}"]`, (x) => x.length), k === 'paleta' ? 5 : 4, k);
await foto(P, 'r174-1-editor-sala-c.png');
await P.click('[data-sj="escTab"][data-e="live"]'); await listo(P);
await P.click('[data-sj="escOp"][data-k="paleta"][data-v="rojo-dorado"]'); await P.click('[data-sj="escOp"][data-k="luz"][data-v="aro"]'); await listo(P);
assert.equal(await P.evaluate(() => document.getElementById('sjEsc3d').__sj3d.escena.background.getHexString()), '140a0a', 'la escena usa la paleta elegida');
await P.fill('#sjEscF [name=nombre]', 'Anuncio promo'); await P.click('#sjEscF button[type=submit]'); await P.waitForSelector('.sj-esc-p.on');
await P.click('[data-sj="escOficial"]'); await P.waitForFunction(() => /Oficial/.test(document.querySelector('.sj-esc-p.on')?.textContent || ''));
let doc = db.todos('sala_escenarios').find((x) => x.id === 'live');
assert.equal(doc.presets[0].nombre, 'Anuncio promo'); assert.equal(doc.presets[0].estilo.paleta, 'rojo-dorado'); assert.equal(doc.predeterminado, doc.presets[0].id);
await foto(P, 'r174-2-editor-live-preset.png');
// restablecer vuelve al estilo base aprobado del escenario
await P.click('[data-sj="escReset"]'); await listo(P);
assert.ok(await P.$('[data-sj="escOp"][data-k="paleta"][data-v="rojo-negro"].on'));
// convocatoria en Subli Live con ese estilo
await P.click('[data-sj="inicio"]').catch(() => {}); await P.click('[data-sj="nueva"]'); await P.waitForSelector('#sjForm [name=escenario]');
const hn = new Date(Date.now() - 6 * 3600000 + 15 * 60000); hn.setUTCMinutes(Math.ceil(hn.getUTCMinutes() / 5) * 5);
await P.fill('#sjForm [name=titulo]', 'Lanzamiento promo de diciembre (prueba)');
await P.fill('#sjForm [name=fecha]', hn.toISOString().slice(0, 10)); await P.fill('#sjForm [name=hora]', hn.toISOString().slice(11, 16));
await P.fill('#sjForm [name=agenda]', 'Guion del anuncio');
await P.selectOption('#sjForm [name=escenario]', 'live'); await P.waitForFunction(() => document.querySelectorAll('#sjForm [name=presetId] option').length === 2);
assert.match(await P.textContent('#sjForm [name=presetId]'), /Anuncio promo \(oficial\)/);
await P.selectOption('#sjForm [name=presetId]', doc.presets[0].id);
await P.check('#sjForm [name=sjPart][value=libni]'); await P.check('#sjForm [name=sjPart][value=geisell]');
await foto(P, 'r174-3-convocatoria-escenario.png');
await P.click('#sjForm button[type=submit]'); for (let i = 0; i < 60 && !db.todos('sala_reuniones').length; i++) await P.waitForTimeout(250); await P.waitForSelector('[data-sj="entrar"]', { timeout: 15000 });
const reu = db.todos('sala_reuniones')[0]; assert.equal(reu.escenario, 'live'); assert.equal(reu.presetId, doc.presets[0].id);
// antesala → sala en vivo en Subli Live
await P.click(`[data-sj="entrar"][data-id="${reu.id}"]`);
await P.waitForFunction(() => window.__lk && window.__lk.localParticipant && !document.getElementById('sj3dCarga') && document.querySelector('.sj3d-canvas'), null, { timeout: 60000 });
assert.equal(await P.evaluate(() => document.getElementById('sj3dEscena').__sj3d.escena.background.getHexString()), '140a0a', 'la reunión se arma en Subli Live con "Anuncio promo"');
await P.evaluate(() => { window.__lk.sim.entra('libni', 'Libni'); window.__lk.sim.entra('geisell', 'Geisell'); });
await P.waitForTimeout(1200); await foto(P, 'r174-4-reunion-en-subli-live.png', '#sj3dEscena');
await P.click('[data-sj="salirSala"]'); await P.waitForSelector('.sj-ante');
assert.match(await P.textContent('.sj-ante-esc'), /Subli Live · Anuncio promo/);
assert.deepEqual(h.errores, []);
await h.cerrar();
console.log('ok Naara: 5 escenarios, 4/4/5/4 opciones, preset "Anuncio promo" oficial, restablecer, convocatoria y reunión en Subli Live');

// 2) Libni: ve el preset de Naara pero no lo borra ni lo hace oficial; guarda el suyo en Subli Aula (celular)
h = await abrir({ usuario: 'libni', ui: 'v1', ancho: 412, alto: 860, salaDb: db, salaEnv: ENV });
P = h.page;
await P.evaluate(() => window.SublichatRBAC.ir('sala-juntas')); await P.waitForSelector('.sj-top');
await P.click('[data-sj="escenarios"]'); await P.waitForSelector('#sjEsc3d'); await listo(P);
await P.click('[data-sj="escTab"][data-e="live"]'); await listo(P);
assert.equal(await P.$$eval('.sj-esc-p', (x) => x.length), 1);
assert.equal(await P.$('[data-sj="escOficial"]'), null); assert.equal(await P.$('[data-sj="escBorrar"]'), null);
await P.click('[data-sj="escTab"][data-e="aula"]'); await listo(P);
await P.click('[data-sj="escOp"][data-k="asientos"][data-v="mesas"]'); await P.click('[data-sj="escOp"][data-k="paredes"][data-v="grafito"]'); await listo(P);
await P.fill('#sjEscF [name=nombre]', 'Clase onboarding'); await P.click('#sjEscF button[type=submit]'); await P.waitForSelector('.sj-esc-p.on');
doc = db.todos('sala_escenarios').find((x) => x.id === 'aula'); assert.equal(doc.presets[0].creadoPor, 'libni'); assert.equal(doc.presets[0].estilo.asientos, 'mesas');
assert.equal(await P.evaluate(() => document.documentElement.scrollWidth), 412, 'sin desborde en celular');
await P.evaluate(() => document.getElementById('sjEsc3d').scrollIntoView({ block: 'start' })); await P.waitForTimeout(300);
await foto(P, 'r174-5-android-aula.png');
assert.deepEqual(h.errores, []);
await h.cerrar();
console.log('ok Libni (Android): ve presets de Naara sin poder borrarlos, guarda "Clase onboarding" en Subli Aula');
console.log('R174 escenarios: 2/2 recorridos OK');
