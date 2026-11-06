// R179 · Sala de Juntas como módulo de Permisos: cualquier usuario al que Sublicuentas se lo active puede ser convocado,
// entra a la sala con su personaje en un asiento libre; sin el módulo no la ve ni la API lo deja. Datos ficticios.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { abrir } from './arnes.mjs';
const require = createRequire(import.meta.url);
const { crearFakeDb } = require('../helpers/fake-firestore.cjs');
const out = process.argv[2] || ''; if (out) fs.mkdirSync(out, { recursive: true });
const foto = async (p, n, el) => { if (!out) return; if (el) { await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), el); await p.waitForTimeout(300); } if (el) await (await p.$(el)).screenshot({ path: path.join(out, n) }); else await p.screenshot({ path: path.join(out, n) }); };
const ENV = { LIVEKIT_URL: 'wss://prueba.livekit.cloud', LIVEKIT_API_KEY: 'APIprueba', LIVEKIT_API_SECRET: 'secreto-de-prueba-no-real-0123456789', AUTH_USERS_JSON: JSON.stringify({ sublicuentas: { role: 'admin' }, relojes: { role: 'asesor' }, magdiel: { role: 'auditor' }, daniela: { role: 'asesor' } }) };
const CFG = { usuarios: { magdiel: { modulos: { 'sala-juntas': true } } } };
const db = crearFakeDb(); await db.collection('config').doc('sublichat_permisos').set(CFG);

// 1) Naara convoca a Geisell y a Magdiel (invitado con el módulo); Daniela no aparece
let h = await abrir({ usuario: 'naara', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db, salaEnv: ENV, permisos: CFG });
let P = h.page;
await P.click('#v2Fila [data-s="sala-juntas"]'); await P.waitForSelector('.sj-top');
await P.click('[data-sj="nueva"]'); await P.waitForSelector('#sjForm [name=h12]');
const lista = await P.$$eval('#sjForm [name=sjPart]', (x) => x.map((i) => i.value));
assert.deepEqual(lista, ['naara', 'libni', 'geisell', 'magdiel'], 'Magdiel aparece; Daniela no');
assert.match(await P.textContent('.sj-form-d'), /Magdiel.*Invitado · Auditor/s);
await P.fill('#sjForm [name=titulo]', 'Revisión con auditoría (prueba)'); await P.fill('#sjForm [name=agenda]', 'Cuadre del mes');
await P.uncheck('#sjForm [name=sjPart][value=libni]'); await P.check('#sjForm [name=sjPart][value=magdiel]');
await P.click('[data-sj="horaAhora"]');
await foto(P, 'r179-1-convocatoria-con-invitado.png');
await P.click('#sjForm button[type=submit]'); for (let i = 0; i < 60 && !db.todos('sala_reuniones').length; i++) await P.waitForTimeout(250);
const reu = db.todos('sala_reuniones')[0]; assert.deepEqual(reu.participantes, ['naara', 'geisell', 'magdiel']);
assert.ok(!db.todos('sala_avisos').some((a) => a.usuario === 'magdiel'), 'sin Telegram para invitados');
assert.ok(db.todos('sala_invitaciones').some((a) => a.usuario === 'magdiel'), 'invitación en Sublichat');
await P.waitForSelector(`[data-sj="entrar"][data-id="${reu.id}"]`, { timeout: 15000 });
await P.click(`[data-sj="entrar"][data-id="${reu.id}"]`);
await P.waitForFunction(() => window.__lk && window.__lk.localParticipant && !document.getElementById('sj3dCarga') && document.querySelector('.sj3d-canvas'), null, { timeout: 60000 });
await P.evaluate(() => { window.__lk.sim.entra('geisell', 'Geisell'); window.__lk.sim.entra('magdiel', 'Magdiel'); }); await P.waitForTimeout(1500);
const nombres = await P.$$eval('.sj3d-nombre', (x) => x.map((e) => e.firstChild.nodeValue.trim()));
assert.ok(nombres.some((n) => /Magdiel/.test(n)), 'Magdiel tiene personaje y nombre en la sala: ' + nombres);
assert.equal(nombres.length, 3);
await P.click('[data-sj="vista3d"][data-v="general"]').catch(() => {}); await P.waitForTimeout(1200);
await foto(P, 'r179-2-sala-con-invitado.png', '#sj3dEscena');
await P.click('[data-sj="salirSala"]'); await P.waitForSelector('.sj-ante');
assert.deepEqual(h.errores, []); await h.cerrar();
console.log('ok Naara: convoca a Magdiel (módulo activado), Daniela no aparece, sin Telegram para invitado, Magdiel sentado en la sala');

// 2) Magdiel: ve el módulo, su reunión, arma su personaje y entra
h = await abrir({ usuario: 'magdiel', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db, salaEnv: ENV, permisos: CFG }); P = h.page;
await P.click('#v2Fila [data-s="sala-juntas"]'); await P.waitForSelector('.sj-top');
assert.match(await P.textContent('#rbac-sala-juntas'), /Revisión con auditoría/);
await P.click('[data-sj="personaje"]'); await P.waitForFunction(() => !document.getElementById('sjEdCarga'), null, { timeout: 60000 });
await P.fill('#sjNomVis', 'Magdiel (Auditoría)'); await P.click('[data-sj="guardarPers"]'); await P.waitForFunction(() => document.querySelector('.sj-ed-mini img'), null, { timeout: 20000 });
assert.equal(db.todos('sala_avatares').find((x) => x.id === 'magdiel').config.nombre, 'Magdiel (Auditoría)');
await P.click('[data-sj="inicio"]'); await P.waitForSelector(`[data-sj="entrar"][data-id="${reu.id}"]`);
await P.click(`[data-sj="entrar"][data-id="${reu.id}"]`);
await P.waitForFunction(() => window.__lk && window.__lk.localParticipant && document.querySelector('.sj3d-canvas'), null, { timeout: 60000 });
assert.ok(!(await P.$('[data-sj="lkTerminar"]')), 'invitado sin permisos de anfitriona');
assert.deepEqual(h.errores, []); await h.cerrar();
console.log('ok Magdiel: ve la Sala, su reunión, guarda personaje y entra sin permisos de anfitriona');

// 3) Daniela sin el módulo: no hay botón y la API responde 403
h = await abrir({ usuario: 'daniela', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db, salaEnv: ENV, permisos: CFG }); P = h.page;
assert.ok(!(await P.$('#v2Fila [data-s="sala-juntas"]')), 'sin botón');
const r403 = await P.evaluate(async () => (await fetch('/api/sala-juntas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"accion":"panel"}' })).status);
assert.equal(r403, 403); await h.cerrar();
console.log('ok Daniela: sin módulo no ve la Sala y la API la bloquea');
console.log('R179 invitados: 3/3 recorridos OK');
