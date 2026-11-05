// R171 · Fase 5 en navegador: mano levantada y turnos, 6 reacciones con límite, pantalla completa (+ modo expandido en celular),
// modo presentación y "Guardar personaje" sin taparse en Android. API real + Firestore en memoria + LiveKit simulado. Datos ficticios.
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
const r = await llamar('naara', { accion: 'crear', titulo: 'Junta de prueba · Plan del mes', fecha: hn.toISOString().slice(0, 10), hora: hn.toISOString().slice(11, 16), agenda: 'Resultados', participantes: ['naara', 'libni', 'geisell'], duracionMin: 60 });
assert.equal(r.code, 200); const id = r.body.id;
const entrar = async (P) => {
  await P.click(`[data-sj="entrar"][data-id="${id}"]`);
  await P.waitForFunction(() => window.__lk && window.__lk.localParticipant && !document.getElementById('sj3dCarga') && document.querySelector('.sj3d-canvas'), null, { timeout: 30000 });
  await P.waitForFunction(() => !document.querySelector('#sj3d-lkMic[disabled]'));
};
const etiquetas = (P) => P.evaluate(() => Object.fromEntries([...document.querySelectorAll('.sj3d-nombre')].map((e) => [e.firstChild.nodeValue.replace(/^✋ /, '').split(' ')[0].replace('👑', '') || e.firstChild.nodeValue, e.firstChild.nodeValue])));

// ===== 1) Naara en PC =====
let h = await abrir({ usuario: 'naara', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db, salaEnv: ENV });
const P = h.page;
await P.click('#v2Fila [data-s="sala-juntas"]'); await P.waitForSelector('.sj-top');
await entrar(P);
await P.evaluate(() => { window.__lk.sim.entra('libni', 'Libni'); window.__lk.sim.entra('geisell', 'Geisell'); });
// mano: Geisell primero, luego Libni → cola en orden de hora
await P.evaluate(() => window.__lk.sim.mano('geisell', true)); await P.waitForTimeout(30);
await P.evaluate(() => window.__lk.sim.mano('libni', true)); await P.waitForTimeout(300);
assert.match(await P.textContent('#sj3d-lkMano'), /Mano \(2\)/);
let et = await P.evaluate(() => [...document.querySelectorAll('.sj3d-nombre')].map((e) => e.firstChild.nodeValue));
assert.ok(et.some((t) => /^✋ Geisell/.test(t)) && et.some((t) => /^✋ Libni/.test(t)), 'mano visible sobre el personaje');
await P.click('#sj3d-lkPart'); await P.waitForTimeout(200);
assert.deepEqual(await P.$$eval('.sj3d-cola li span', (x) => x.map((e) => e.textContent)), ['Geisell', 'Libni'], 'cola ordenada por hora');
await P.waitForTimeout(900); await foto(P, 'r171-1-cola-de-manos.png');
// dar la palabra a Geisell → atributo turno de Naara + saludo
await P.click('[data-sj="lkDarTurno"][data-u="geisell"]'); await P.waitForTimeout(200);
assert.equal(await P.evaluate(() => window.__lk.localParticipant.attributes.turno), 'geisell');
assert.match(await P.textContent('.sj3d-turno'), /Geisell/);
await P.waitForTimeout(700); await foto(P, 'r171-2-geisell-con-la-palabra.png');
// terminar turno: Geisell (su cliente) baja la mano; avanza la lista
await P.click('[data-sj="lkFinTurno"]'); await P.evaluate(() => window.__lk.sim.mano('geisell', false)); await P.waitForTimeout(200);
assert.deepEqual(await P.$$eval('.sj3d-cola li span', (x) => x.map((e) => e.textContent)), ['Libni']);
await P.click('[data-sj="lkLimpiarCola"]'); await P.waitForTimeout(100);
assert.ok(Number(await P.evaluate(() => window.__lk.localParticipant.attributes.limpia)) > 0);
// un turno falso puesto por otra (no anfitriona) se ignora
await P.evaluate(() => window.__lk.sim.atributos('libni', { turno: 'libni' })); await P.waitForTimeout(100);
assert.equal(await P.$('.sj3d-turno'), null, 'solo cuenta el turno que pone Naara');
await P.click('[data-sj="lkCerrarPanel"]');

// reacciones: 6, con nombre y límite anti-spam
await P.click('#sj3d-lkReac');
await P.evaluate(() => { window.__toasts = []; new MutationObserver(() => { const t = document.getElementById('sjToast'); if (t) window.__toasts.push(t.textContent); }).observe(document.body, { subtree: true, childList: true, characterData: true }); });
assert.equal(await P.$$eval('[data-sj="lkReaccion"]', (x) => x.length), 6);
assert.deepEqual(await P.$$eval('[data-sj="lkReaccion"]', (x) => x.map((b) => b.getAttribute('aria-label').split(' (')[0])), ['Aplausos', 'Me gusta', 'Corazón', 'Risa', 'Sorpresa', 'Fiesta']);
await P.evaluate(() => { document.querySelector('[data-sj="lkReaccion"][data-e="👏"]').click(); document.querySelector('[data-sj="lkReaccion"][data-e="❤️"]').click(); }); await P.waitForTimeout(400);
assert.equal(await P.evaluate(() => window.__lk.enviados.filter((x) => x.topic === 'reaccion').length), 1, 'el segundo clic inmediato no se envía');
assert.ok((await P.evaluate(() => window.__toasts)).some((t) => /Espere/.test(t)), JSON.stringify(await P.evaluate(() => window.__toasts)));
await P.click('[data-sj="lkCerrarPanel"]'); await P.waitForTimeout(1300);
await P.keyboard.press('6'); await P.waitForTimeout(100);
assert.deepEqual(await P.evaluate(() => window.__lk.enviados.filter((x) => x.topic === 'reaccion').map((x) => x.d.e)), ['👏', '🎉'], 'atajo de teclado 6 = Fiesta');
// spam recibido de otra: se descarta lo que pase del límite
await P.evaluate(() => { for (let i = 0; i < 30; i++) window.__lk.sim.reaccion('libni', '😂'); });
assert.ok((await P.$$eval('.sj3d-reac', (x) => x.length)) <= 3, 'no se satura la sala');

// pantalla completa (Fullscreen API) sin cortar el audio
const audiosAntes = await P.evaluate(() => document.querySelectorAll('audio[data-sj-audio]').length);
await P.click('#sj3dFull'); await P.waitForTimeout(600);
assert.ok(await P.evaluate(() => !!document.fullscreenElement || !!document.querySelector('.sj3d-expandido')));
assert.match(await P.textContent('#sj3dFull'), /Salir del modo/);
await foto(P, 'r171-3-pantalla-completa.png');
await P.click('#sj3dFull'); await P.waitForTimeout(300);
assert.ok(await P.evaluate(() => !document.fullscreenElement && !document.querySelector('.sj3d-expandido')));
assert.equal(await P.evaluate(() => document.querySelectorAll('audio[data-sj-audio]').length), audiosAntes, 'el audio sigue igual');
assert.equal(await P.evaluate(() => window.__lk.desconectada || false), false);

// modo presentación: Libni comparte → pantalla grande + banda de participantes; "Volver a la sala"
await P.evaluate(() => { window.__lk.sim.habla(['libni']); window.__lk.sim.pantalla('libni'); }); await P.waitForTimeout(1200);
assert.equal(await P.isVisible('#sj3dPres'), true);
assert.equal(await P.$$eval('.sj3d-presp', (x) => x.length), 3);
const prop = await P.evaluate(() => { const a = document.querySelector('.sj3d-presm').getBoundingClientRect(), b = document.getElementById('sj3dEscena').getBoundingClientRect(); return a.width * a.height / (b.width * b.height); });
assert.ok(prop > 0.6, 'la presentación ocupa la mayor parte: ' + prop.toFixed(2));
await foto(P, 'r171-4-modo-presentacion.png');
await P.click('[data-sj="lkVolverSala"]'); await P.waitForTimeout(300);
assert.equal(await P.isVisible('#sj3dPres'), false); assert.equal(await P.isVisible('#sj3dVerPres'), true);
await P.waitForTimeout(4500); await foto(P, 'r171-5-sala-con-presentacion.png');
assert.deepEqual(h.errores, []);
await h.cerrar();
console.log('ok Naara: cola de manos ordenada, dar/terminar turno, limpiar, turno falso ignorado, 6 reacciones con límite y atajos, pantalla completa sin cortar audio, modo presentación');

// ===== 2) Libni en Android (diseño clásico, 412 px) =====
h = await abrir({ usuario: 'libni', ui: 'v1', ancho: 412, alto: 860, salaDb: db, salaEnv: ENV });
const L = h.page;
await L.evaluate(() => window.SublichatRBAC.ir('sala-juntas')); await L.waitForSelector('.sj-top');
// editor: "Guardar personaje" nunca queda debajo de la barra inferior
await L.click('[data-sj="personaje"]'); await L.waitForFunction(() => !document.getElementById('sjEdCarga'), null, { timeout: 30000 });
for (const y of [0, 300, 600, 900, 1e6]) {
  await L.evaluate((y) => window.scrollTo(0, y), y); await L.waitForTimeout(120);
  const libre = await L.evaluate(() => { const b = document.querySelector('[data-sj="guardarPers"]').getBoundingClientRect(); if (b.bottom < 0 || b.top > innerHeight) return 'fuera'; const t = document.elementFromPoint(b.left + b.width / 2, Math.min(b.top + b.height / 2, innerHeight - 1)); return !!t && !!t.closest('[data-sj="guardarPers"]'); });
  assert.ok(libre === true, `Guardar visible y libre al desplazar a ${y}: ${libre}`);
}
await L.evaluate(() => window.scrollTo(0, 400)); await foto(L, 'r171-6-android-editor-guardar.png');
await L.click('[data-sj="atras"], [data-sj="inicio"]').catch(() => {});
await L.evaluate(() => window.SublichatRBAC.ir('sala-juntas')); await L.waitForSelector(`[data-sj="entrar"][data-id="${id}"]`);
await entrar(L);
assert.equal(await L.evaluate(() => { const n = document.querySelector('.nav'); return !n || getComputedStyle(n).display === 'none'; }), true, 'la barra inferior del sistema no tapa los controles');
// modo expandido cuando el navegador no deja pantalla completa
await L.evaluate(() => { Element.prototype.requestFullscreen = undefined; Element.prototype.webkitRequestFullscreen = undefined; });
await L.click('#sj3dFull'); await L.waitForTimeout(400);
assert.equal(await L.evaluate(() => !!document.querySelector('.sj3d-expandido')), true);
const tapados = await L.evaluate(() => [...document.querySelectorAll('.sj3d-barra .sj3d-ctl')].filter((b) => { const r = b.getBoundingClientRect(); if (r.bottom > innerHeight || r.right > innerWidth) return false; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !(t && b.contains(t)); }).map((b) => b.textContent));
assert.deepEqual(tapados, [], 'ningún control tapado');
await L.evaluate(() => window.__lk.sim.entra('naara', 'Naara'));
await L.click('#sj3d-lkMano'); await L.waitForTimeout(200);
assert.ok(Number(await L.evaluate(() => window.__lk.localParticipant.attributes.mano)) > 0);
assert.match(await L.textContent('#sj3d-lkMano'), /Bajar mano/);
await L.evaluate(() => window.__lk.sim.atributos('naara', { turno: 'libni' })); await L.waitForTimeout(300);
assert.match(await L.textContent('#sjToast'), /le dio la palabra/);
await L.waitForTimeout(700); await foto(L, 'r171-7-android-expandido-con-la-palabra.png');
await L.evaluate(() => window.__lk.sim.atributos('naara', { turno: '' })); await L.waitForTimeout(200);
assert.equal(await L.evaluate(() => window.__lk.localParticipant.attributes.mano), '', 'al terminar su turno, su mano baja sola');
await L.keyboard.press('Escape'); await L.waitForTimeout(200);
assert.equal(await L.evaluate(() => !!document.querySelector('.sj3d-expandido')), false, 'Escape sale del modo expandido');
assert.equal(await L.evaluate(() => document.documentElement.scrollWidth), 412);
assert.deepEqual(h.errores, []);
await h.cerrar();
console.log('ok Libni Android: Guardar personaje libre, barra inferior oculta en la sala, modo expandido, mano → palabra → baja sola, Escape');
console.log('R171 interacción: 2/2 recorridos OK');
