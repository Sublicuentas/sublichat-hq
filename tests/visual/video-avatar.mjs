// R183 · Video de evidencia: personaje girando 360° (de pie), acercamientos, y en la sala sentado hablando (boca por nivel de voz).
import path from 'node:path'; import fs from 'node:fs'; import { createRequire } from 'node:module'; import { abrir } from './arnes.mjs';
const require = createRequire(import.meta.url); const { crearFakeDb } = require('../helpers/fake-firestore.cjs');
const dir = process.argv[2] || '/tmp/video-avatar'; fs.mkdirSync(dir, { recursive: true });
const ENV = { LIVEKIT_URL: 'wss://prueba.livekit.cloud', LIVEKIT_API_KEY: 'APIprueba', LIVEKIT_API_SECRET: 'secreto-de-prueba-no-real-0123456789' };
const db = crearFakeDb();
const h = await abrir({ usuario: 'naara', ui: 'v2', ancho: 1280, alto: 800, salaDb: db, salaEnv: ENV, video: dir }); const P = h.page;
await P.click('#v2Fila [data-s="sala-juntas"]'); await P.waitForSelector('.sj-top');
await P.click('[data-sj="personaje"]'); await P.waitForFunction(() => !document.getElementById('sjEdCarga'), null, { timeout: 60000 });
await P.click('[data-sj="tabPers"][data-t="accesorios"]'); for (const k of ['lentes', 'aretes', 'collar', 'reloj', 'logo']) await P.check(`#sjOps [data-op="${k}"]`);
await P.evaluate(() => document.querySelector('.sj-ed-3d').scrollIntoView({ block: 'center' }));
await P.click('[data-sj="giro360"]'); await P.waitForTimeout(9000); // vuelta completa
await P.click('[data-sj="enfoquePers"][data-v="rostro"]'); await P.waitForTimeout(3500);
await P.click('[data-sj="enfoquePers"][data-v="torso"]'); await P.waitForTimeout(3500);
await P.click('[data-sj="enfoquePers"][data-v="cuerpo"]'); await P.waitForTimeout(1500);
await P.click('[data-sj="guardarPers"]'); await P.waitForTimeout(1500);
// sala: reunión ahora, Naara entra, Libni entra y habla
await P.click('[data-sj="inicio"]'); await P.click('[data-sj="nueva"]'); await P.waitForSelector('#sjForm [name=h12]');
await P.fill('#sjForm [name=titulo]', 'Video de prueba'); await P.fill('#sjForm [name=agenda]', 'Demo'); await P.click('[data-sj="horaAhora"]'); await P.check('#sjForm [name=sjPart][value=libni]');
await P.click('#sjForm button[type=submit]'); for (let i = 0; i < 60 && !db.todos('sala_reuniones').length; i++) await P.waitForTimeout(250);
const id = db.todos('sala_reuniones')[0].id; await P.waitForSelector(`[data-sj="entrar"][data-id="${id}"]`); await P.click(`[data-sj="entrar"][data-id="${id}"]`);
await P.waitForFunction(() => window.__lk && window.__lk.localParticipant && !document.getElementById('sj3dCarga'), null, { timeout: 60000 });
await P.evaluate(() => window.__lk.sim.entra('libni', 'Libni')); await P.waitForTimeout(2500);
for (let i = 0; i < 6; i++) { await P.evaluate((k) => window.__lk.sim.habla(k % 2 ? [] : ['libni']), i); await P.waitForTimeout(1300); }
await P.evaluate(() => window.__lk.sim.habla(['naara'])); await P.waitForTimeout(2500);
const v = P.video(); await h.cerrar(); const f = await v.path(); const dest = path.join(dir, 'r183-avatar-360-sentado-hablando.webm'); fs.renameSync(f, dest); console.log('video', dest);
