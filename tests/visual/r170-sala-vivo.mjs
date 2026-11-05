// R170 · Sala de Juntas en vivo (Fase 4) en navegador: API real (Firestore en memoria) + livekit-client simulado. Datos ficticios.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { abrir } from './arnes.mjs';
const require = createRequire(import.meta.url);
const { crearFakeDb } = require('../helpers/fake-firestore.cjs');
const handler = require('../../api/sala-juntas.js');
const out = process.argv[2] || ''; if (out) fs.mkdirSync(out, { recursive: true });
const foto = async (p, n) => { if (out) await p.screenshot({ path: path.join(out, n) }); };
const ENV = { LIVEKIT_URL: 'wss://prueba.livekit.cloud', LIVEKIT_API_KEY: 'APIprueba', LIVEKIT_API_SECRET: 'secreto-de-prueba-no-real-0123456789' };
const db = crearFakeDb();
const llamar = (usuario, body) => new Promise((ok) => { const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { ok({ code: this.code, body: b }); } };
  handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body }, res, { auth: () => ({ verifyIdToken: async () => ({ usuario }) }), db: () => db, env: ENV, fetch: async () => ({ ok: true }) }); });
const hn = new Date(Date.now() - 6 * 3600000 + 15 * 60000); hn.setUTCMinutes(Math.ceil(hn.getUTCMinutes() / 5) * 5);
const fecha = hn.toISOString().slice(0, 10), hora = hn.toISOString().slice(11, 16);
const r = await llamar('naara', { accion: 'crear', titulo: 'Junta de prueba · Estrategia', fecha, hora, agenda: 'Resultados\nCampañas', participantes: ['naara', 'libni', 'geisell'], duracionMin: 60 });
assert.equal(r.code, 200, JSON.stringify(r.body)); const id = r.body.id;

// 1) Libni no puede entrar mientras la sala esté cerrada
let h = await abrir({ usuario: 'libni', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db, salaEnv: ENV });
await h.page.click('#v2Fila [data-s="sala-juntas"]'); await h.page.waitForSelector('.sj-top');
assert.ok(await h.page.$('[data-sj="entrar"][disabled]'), 'Libni espera a la anfitriona');
await h.cerrar();
console.log('ok Libni: botón Entrar bloqueado hasta que Naara abra');

// 2) Naara entra (abre la sala) y modera
h = await abrir({ usuario: 'naara', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db, salaEnv: ENV });
const P = h.page;
await P.click('#v2Fila [data-s="sala-juntas"]'); await P.waitForSelector('.sj-top');
await P.click(`[data-sj="entrar"][data-id="${id}"]`);
await P.waitForFunction(() => window.__lk && window.__lk.localParticipant && !document.getElementById('sj3dCarga') && document.querySelector('.sj3d-canvas'), null, { timeout: 30000 });
await P.waitForFunction(() => !document.querySelector('#sj3d-lkMic[disabled]'));
assert.equal(db.todos('sala_reuniones')[0].salaAbierta, true, 'al entrar Naara se abre la sala');
assert.equal(await P.evaluate(() => window.__lk.claims.sub), 'naara');
assert.match(await P.textContent('#sj3dChip'), /En vivo/);
let etq = await P.evaluate(() => [...document.querySelectorAll('.sj3d-nombre')].map((e) => e.firstChild.nodeValue));
assert.ok(etq.some((t) => /Libni · no ha entrado/.test(t)), 'ausentes marcadas');
await P.waitForTimeout(800); await foto(P, 'r170-1-naara-sola.png');

await P.evaluate(() => { window.__lk.sim.entra('libni', 'Libni'); window.__lk.sim.entra('geisell', 'Geisell'); });
await P.waitForTimeout(300);
etq = await P.evaluate(() => [...document.querySelectorAll('.sj3d-nombre')].map((e) => e.firstChild.nodeValue));
assert.ok(!etq.some((t) => /no ha entrado/.test(t)), 'presencia actualizada');
assert.equal(await P.evaluate(() => document.querySelectorAll('audio[data-sj-audio]').length), 2, 'audio remoto conectado');
// cámara automática: Libni habla > 1.5 s
await P.evaluate(() => window.__lk.sim.habla(['libni'])); await P.waitForTimeout(5200);
await foto(P, 'r170-2-auto-libni-habla.png');
assert.ok(await P.$('[data-sj="vista3d"][data-v="auto"].on'));
// chat + reacción
await P.evaluate(() => { window.__lk.sim.chat('geisell', 'Buenas tardes, ya estoy lista 👋'); window.__lk.sim.reaccion('libni', '👏'); });
assert.match(await P.textContent('#sj3d-lkChat'), /Chat \(1\)/);
await P.click('#sj3d-lkChat'); await P.fill('#sj3dChatT', '<b>Empezamos</b> con resultados de octubre'); await P.press('#sj3dChatT', 'Enter');
await P.waitForTimeout(300);
assert.deepEqual(await P.evaluate(() => window.__lk.enviados.map((x) => x.topic)), ['chat']);
assert.equal(await P.evaluate(() => document.querySelectorAll('.sj3d-msg b').length), 0, 'el chat no interpreta HTML');
await foto(P, 'r170-3-chat.png');
// participantes + silenciada
await P.evaluate(() => window.__lk.sim.silencia('geisell', true));
await P.click('#sj3d-lkPart'); await P.waitForTimeout(200);
assert.match(await P.textContent('#sj3dPanel'), /Geisell.*silenciada/s);
assert.equal(await P.$$eval('#sj3dPanel [data-sj="lkSacar"]', (x) => x.length), 2, 'Naara puede sacar a las otras dos');
await foto(P, 'r170-4-participantes.png');
// pantalla compartida → vista presentación
await P.click('[data-sj="lkCerrarPanel"]');
await P.evaluate(() => window.__lk.sim.pantalla('libni')); await P.waitForTimeout(5000);
await foto(P, 'r170-5-pantalla-compartida.png');
await P.evaluate(() => window.__lk.sim.quitaPantalla('libni'));
// mic propio
await P.click('#sj3d-lkMic'); assert.match(await P.textContent('#sj3d-lkMic'), /Activar mic/);
// reconexión
await P.evaluate(() => window.__lk.sim.reconecta()); await P.waitForTimeout(150);
assert.match(await P.textContent('#sj3dEstado'), /Reconectando/); await foto(P, 'r170-6-reconectando.png');
await P.waitForTimeout(1000); assert.equal(await P.isHidden('#sj3dEstado'), true);
// salir: desconecta y vuelve a la antesala
await P.click('[data-sj="salirSala"]'); await P.waitForSelector('.sj-ante');
assert.equal(await P.evaluate(() => window.__lk.desconectada), true);
assert.deepEqual(h.errores, []);
await h.cerrar();
console.log('ok Naara: abre, presencia, audio, cámara automática, chat seguro, participantes, pantalla, mic, reconexión, salir');

// 3) Libni en celular, ya abierta
h = await abrir({ usuario: 'libni', ui: 'v2', ancho: 390, alto: 844, salaDb: db, salaEnv: ENV });
await h.page.evaluate(() => window.SublichatRBAC.ir('sala-juntas')); await h.page.waitForSelector('.sj-top');
await h.page.click(`[data-sj="entrar"][data-id="${id}"]`);
await h.page.waitForFunction(() => window.__lk && window.__lk.localParticipant && document.querySelector('.sj3d-canvas'), null, { timeout: 30000 });
assert.equal(await h.page.evaluate(() => window.__lk.claims.video.roomAdmin), false);
assert.equal(await h.page.$('[data-sj="lkTerminar"]'), null, 'Libni no tiene Terminar');
await h.page.evaluate(() => window.__lk.sim.entra('naara', 'Naara')); await h.page.waitForTimeout(600);
await foto(h.page, 'r170-7-libni-390.png');
await h.page.click('#sj3d-lkReac'); await h.page.click('[data-sj="lkReaccion"][data-e="🎉"]'); await h.page.waitForTimeout(400);
await foto(h.page, 'r170-8-libni-390-reaccion.png');
assert.equal(await h.page.evaluate(() => document.documentElement.scrollWidth), 390);
await h.page.evaluate(() => window.__lk.sim.expulsar()); await h.page.waitForSelector('.sj-ante');
assert.deepEqual(h.errores, []);
await h.cerrar();
console.log('ok Libni (390): entra sin permisos de anfitriona, reacción, sin desborde; si la sacan vuelve a la antesala');
console.log('R170 sala en vivo: 3/3 recorridos OK');
