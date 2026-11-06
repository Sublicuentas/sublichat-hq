// R175 · Fase 7: Naara graba la reunión en su navegador (video 3D + audio de todas), todas ven "Grabando",
// el archivo se descarga sin subirse, y el acta registra que se grabó. LiveKit simulado, datos ficticios.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { abrir } from './arnes.mjs';
const require = createRequire(import.meta.url);
const { crearFakeDb } = require('../helpers/fake-firestore.cjs');
const handler = require('../../api/sala-juntas.js');
const out = process.argv[2] || ''; if (out) fs.mkdirSync(out, { recursive: true });
const foto = async (p, n, el) => { if (!out) return; if (el) await (await p.$(el)).screenshot({ path: path.join(out, n) }); else await p.screenshot({ path: path.join(out, n) }); };
const ENV = { LIVEKIT_URL: 'wss://prueba.livekit.cloud', LIVEKIT_API_KEY: 'APIprueba', LIVEKIT_API_SECRET: 'secreto-de-prueba-no-real-0123456789' };
const db = crearFakeDb();
const llamar = (usuario, body) => new Promise((ok) => { const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { ok({ code: this.code, body: b }); } };
  handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body }, res, { auth: () => ({ verifyIdToken: async () => ({ usuario }) }), db: () => db, env: ENV, fetch: async () => ({ ok: true }) }); });
const hn = new Date(Date.now() - 6 * 3600000 + 15 * 60000); hn.setUTCMinutes(Math.ceil(hn.getUTCMinutes() / 5) * 5);
const r0 = await llamar('naara', { accion: 'crear', titulo: 'Junta grabada (prueba)', fecha: hn.toISOString().slice(0, 10), hora: hn.toISOString().slice(11, 16), agenda: 'x', participantes: ['naara', 'libni', 'geisell'], duracionMin: 60 });
const id = r0.body.id;
const entrar = async (P) => { await P.click(`[data-sj="entrar"][data-id="${id}"]`); await P.waitForFunction(() => window.__lk && window.__lk.localParticipant && !document.getElementById('sj3dCarga') && document.querySelector('.sj3d-canvas'), null, { timeout: 60000 }); await P.waitForFunction(() => !document.querySelector('#sj3d-lkMic[disabled]')); };

let h = await abrir({ usuario: 'naara', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db, salaEnv: ENV });
const P = h.page; P.on('dialog', (d) => d.accept());
await P.click('#v2Fila [data-s="sala-juntas"]'); await P.waitForSelector('.sj-top'); await entrar(P);
await P.evaluate(() => { window.__lk.sim.entra('libni', 'Libni'); window.__lk.sim.entra('geisell', 'Geisell'); });
assert.equal(await P.isHidden('#sj3dRec'), true);
await P.click('#sj3d-lkGrabar'); await P.waitForSelector('#sj3dRec:not([hidden])');
assert.ok(Number(await P.evaluate(() => window.__lk.localParticipant.attributes.grabando)) > 0, 'todas reciben el aviso (atributo de la anfitriona)');
assert.match(await P.textContent('#sj3d-lkGrabar'), /Detener/);
await P.evaluate(() => window.__lk.sim.habla(['libni'])); await P.waitForTimeout(3500);
assert.ok(Number((await P.textContent('#sj3dRecT')).split(':')[1]) >= 1, 'el contador avanza');
await foto(P, 'r175-1-grabando.png', '#sj3dEscena');
const [descarga] = await Promise.all([P.waitForEvent('download', { timeout: 20000 }), P.click('#sj3d-lkGrabar')]);
const archivo = path.join(out || '/tmp', 'r175-grabacion' + path.extname(descarga.suggestedFilename()));
await descarga.saveAs(archivo);
const b = fs.readFileSync(archivo);
assert.match(descarga.suggestedFilename(), /^Junta_grabada_prueba_.*\.(webm|mp4)$/);
assert.ok(b.length > 20000, 'el video tiene contenido: ' + b.length);
assert.equal(b.subarray(0, 4).toString('hex'), '1a45dfa3', 'archivo WebM válido');
await P.waitForSelector('#sj3dRec[hidden]', { state: 'attached' });
assert.equal(await P.evaluate(() => window.__lk.localParticipant.attributes.grabando), '');
for (let i = 0; i < 20 && !db.todos('auditoria_eventos').some((x) => x.accion === 'grabacion_fin'); i++) await P.waitForTimeout(250);
const fin = db.todos('auditoria_eventos').find((x) => x.accion === 'grabacion_fin'); assert.ok(fin && fin.duracionSeg >= 2);
assert.ok(db.todos('auditoria_eventos').some((x) => x.accion === 'grabacion_inicio'));
await P.click('[data-sj="lkTerminar"]'); await P.waitForSelector('#sjActaF', { timeout: 20000 });
assert.match(await P.textContent('.sj-acta-meta'), /Grabada/);
assert.deepEqual(h.errores, []);
await h.cerrar();
console.log('ok Naara: graba (video + audio mezclado), aviso para todas, descarga WebM válida sin subir nada, registro y acta "Grabada"');

// Libni: ve el aviso cuando Naara graba y no puede grabar ella
const r1 = await llamar('naara', { accion: 'crear', titulo: 'Otra junta', fecha: hn.toISOString().slice(0, 10), hora: hn.toISOString().slice(11, 16), agenda: 'x', participantes: ['naara', 'libni'], duracionMin: 60 });
await llamar('naara', { accion: 'abrir_sala', id: r1.body.id });
h = await abrir({ usuario: 'libni', ui: 'v1', ancho: 412, alto: 860, salaDb: db, salaEnv: ENV });
const L = h.page;
await L.evaluate(() => window.SublichatRBAC.ir('sala-juntas')); await L.waitForSelector('.sj-top');
await L.click(`[data-sj="entrar"][data-id="${r1.body.id}"]`); await L.waitForFunction(() => window.__lk && window.__lk.localParticipant && document.querySelector('.sj3d-canvas'), null, { timeout: 60000 });
assert.equal(await L.$('#sj3d-lkGrabar'), null); assert.ok(await L.$('.sj3d-ctl[disabled][title="Solo la anfitriona puede grabar"]'));
await L.evaluate(() => { window.__lk.sim.entra('naara', 'Naara'); window.__lk.sim.atributos('naara', { grabando: String(Date.now()) }); });
await L.waitForSelector('#sj3dRec:not([hidden])'); await L.waitForTimeout(1200);
await foto(L, 'r175-2-libni-ve-grabando.png');
// un participante que no es la anfitriona no puede encender el aviso
await L.evaluate(() => { window.__lk.sim.atributos('naara', { grabando: '' }); window.__lk.sim.entra('geisell', 'Geisell'); window.__lk.sim.atributos('geisell', { grabando: String(Date.now()) }); });
await L.waitForTimeout(300); assert.equal(await L.isHidden('#sj3dRec'), true);
assert.deepEqual(h.errores, []);
await h.cerrar();
console.log('ok Libni: ve "Grabando", no puede grabar; un aviso falso de otra no cuenta');
console.log('R175 grabación: 2/2 recorridos OK');
