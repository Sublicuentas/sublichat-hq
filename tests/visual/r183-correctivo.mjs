// R180–R183 · Paquete correctivo SubliStudio: 1) usuario retirado desaparece y pierde acceso · 2) ingreso tardío solo con
// aprobación de Sublicuentas · 3) Telegram para todos con estado real · 4) avatar: acercamientos y boca por nivel de voz.
// Todo con datos ficticios ("daniela" y "jimena" como usuarios de prueba) y Firestore en memoria.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { abrir } from './arnes.mjs';
const require = createRequire(import.meta.url);
const { crearFakeDb } = require('../helpers/fake-firestore.cjs');
const out = process.argv[2] || ''; if (out) fs.mkdirSync(out, { recursive: true });
const foto = async (p, n, el) => { if (!out) return; if (el) { await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), el); await p.waitForTimeout(300); await (await p.$(el)).screenshot({ path: path.join(out, n) }); } else await p.screenshot({ path: path.join(out, n) }); };
const ENV = { LIVEKIT_URL: 'wss://prueba.livekit.cloud', LIVEKIT_API_KEY: 'APIprueba', LIVEKIT_API_SECRET: 'secreto-de-prueba-no-real-0123456789', TELEGRAM_CHAT_ID_SUBLICUENTAS: '100', TELEGRAM_CHAT_ID_RELOJES: '200', TELEGRAM_BOT_USERNAME: 'SublicuentasPruebaBot',
  AUTH_USERS_JSON: JSON.stringify({ sublicuentas: { role: 'admin' }, relojes: { role: 'asesor' }, geisell: { role: 'geisell_admin' }, daniela: { role: 'asesor', uid: 'uid-prueba-daniela' }, jimena: { role: 'asesor' } }) };
const db = crearFakeDb(); await db.collection('config').doc('sublichat_permisos').set({ usuarios: { daniela: { modulos: { 'sala-juntas': true } }, jimena: { modulos: { 'sala-juntas': true } } } });
const ponerAhora = async (P) => { await P.click('[data-sj="horaAhora"]'); };

// ---------- 1) Retiro de usuario ----------
let h = await abrir({ usuario: 'naara', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db, salaEnv: ENV, permisos: 'real' }); let P = h.page;
await P.click('#v2Fila [data-s="sala-juntas"]'); await P.waitForSelector('.sj-top');
await P.click('[data-sj="nueva"]'); await P.waitForSelector('#sjForm [name=h12]');
assert.ok(await P.$('#sjForm [name=sjPart][value=daniela]'), 'antes del retiro Daniela aparece');
await P.fill('#sjForm [name=titulo]', 'Revisión futura (prueba)'); await P.fill('#sjForm [name=agenda]', 'Tema'); await P.fill('#sjForm [name=fecha]', '2026-12-01');
await P.check('#sjForm [name=sjPart][value=daniela]'); await P.click('#sjForm button[type=submit]');
for (let i = 0; i < 60 && !db.todos('sala_reuniones').length; i++) await P.waitForTimeout(250);
await P.evaluate(() => window.SublichatRBAC.ir('permisos')); await P.waitForSelector('.perm-card[data-card="daniela"]');
await P.click('[data-baja="daniela"]'); await P.fill('[data-baja-conf]', 'daniela');
await foto(P, 'r183-1a-retirar-confirmacion.png', '.perm-card[data-card="daniela"]');
await P.click('[data-baja-ok]'); await P.waitForFunction(() => !document.querySelector('.perm-card[data-card="daniela"]') && document.querySelector('.perm-ret'), null, { timeout: 15000 });
await P.click('.perm-ret summary');
await foto(P, 'r183-1b-usuarios-activos-y-retirados.png');
assert.ok(!db.todos('sala_reuniones')[0].participantes.includes('daniela'), 'sale de la convocatoria futura'); assert.equal(db.todos('sala_invitaciones').find((x) => x.usuario === 'daniela').estado, 'retirado');
assert.ok(db.todos('auditoria_eventos').some((a) => a.accion === 'retirar_usuario' && a.objetivo === 'daniela' && a.uid === 'uid-prueba-daniela'));
await P.evaluate(() => window.SublichatRBAC.ir('sala-juntas')); await P.waitForSelector('.sj-top'); await P.click('[data-sj="nueva"]'); await P.waitForSelector('#sjForm [name=h12]');
assert.ok(!(await P.$('#sjForm [name=sjPart][value=daniela]')), 'ya no aparece en el selector');
await h.cerrar();
h = await abrir({ usuario: 'daniela', ui: 'v2', ancho: 1440, alto: 900, salaDb: db, salaEnv: ENV, permisos: 'real' }); P = h.page;
assert.equal(await P.evaluate(async () => (await fetch('/api/sala-juntas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"accion":"panel"}' })).status), 403);
const mp = await P.evaluate(async () => (await (await fetch('/api/permisos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"accion":"mis_permisos"}' })).json()));
assert.equal(mp.retirado, true); assert.deepEqual(mp.pantallas, []);
await h.cerrar();
console.log('ok 1 · Retiro: confirmación por usuario exacto, sale de listas y convocatorias futuras, API 403, sesión marcada retirada');

// ---------- 2) Telegram para todos + 3) ingreso tardío ----------
h = await abrir({ usuario: 'naara', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db, salaEnv: ENV, permisos: 'real' }); P = h.page;
await P.click('#v2Fila [data-s="sala-juntas"]'); await P.waitForSelector('.sj-top');
await P.click('[data-sj="nueva"]'); await P.waitForSelector('#sjForm [name=h12]');
assert.match(await P.textContent('.sj-form-d'), /Libni.*Telegram: LISTO.*Geisell.*Telegram: PENDIENTE.*Jimena.*Telegram: PENDIENTE/s);
await P.fill('#sjForm [name=titulo]', 'Junta de fundadores (prueba)'); await P.fill('#sjForm [name=agenda]', 'Ventas'); await ponerAhora(P);
await P.check('#sjForm [name=sjPart][value=libni]'); await P.check('#sjForm [name=sjPart][value=jimena]');
await foto(P, 'r183-2a-convocatoria-estado-telegram.png');
await P.click('#sjForm button[type=submit]');
await P.waitForFunction(() => /Envío INCOMPLETO/.test(document.body.textContent), null, { timeout: 15000 });
const reu = db.todos('sala_reuniones').find((x) => x.titulo === 'Junta de fundadores (prueba)');
const avs = db.todos('sala_avisos').filter((a) => a.reunionId === reu.id && a.tipo === 'invitacion');
assert.equal(avs.find((a) => a.usuario === 'libni').estado, 'pendiente'); assert.equal(avs.find((a) => a.usuario === 'jimena').estado, 'sin_vinculo');
// el bot entrega a Libni (simulado: la API de Telegram respondió OK)
await db.collection('sala_avisos').doc(avs.find((a) => a.usuario === 'libni').id).set({ estado: 'enviado', enviadoAt: new Date().toISOString() }, { merge: true });
await P.evaluate(() => window.SublichatSala.recargar()); await P.waitForTimeout(700);
await foto(P, 'r183-2b-reunion-entrega-por-persona.png', '.sj-avisos');
await P.click(`[data-sj="entrar"][data-id="${reu.id}"]`);
await P.waitForFunction(() => window.__lk && window.__lk.localParticipant && document.querySelector('.sj3d-canvas'), null, { timeout: 60000 });
// Jimena (invitada) llega tarde: Mi Telegram + sala de espera
const h2 = await abrir({ usuario: 'jimena', ui: 'v2', ancho: 1280, alto: 900, salaDb: db, salaEnv: ENV, permisos: 'real' }); const J = h2.page;
await J.click('#v2Fila [data-s="sala-juntas"]'); await J.waitForSelector('.sj-top');
assert.match(await J.textContent('.sj-tg'), /Telegram sin vincular/);
const link = await J.evaluate(async () => (await (await fetch('/api/sala-juntas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"accion":"telegram_vincular"}' })).json()).url);
assert.match(link, /^https:\/\/t\.me\/SublicuentasPruebaBot\?start=sj_/);
await foto(J, 'r183-2c-invitado-vincular-telegram.png', '.sj-tg');
await J.click(`[data-sj="entrar"][data-id="${reu.id}"]`);
await J.waitForSelector('#sjEspera', { timeout: 15000 });
assert.match(await J.textContent('#sjEspera'), /La junta ya comenzó.*SIN SOLICITAR/s);
assert.ok(!(await J.evaluate(() => !!(window.__lk && window.__lk.localParticipant))), 'sin audio ni sala');
await J.click('[data-sj="solicitarIngreso"]'); await J.waitForFunction(() => /ESPERANDO/.test(document.getElementById('sjEspera')?.textContent || ''), null, { timeout: 10000 });
await foto(J, 'r183-3a-sala-de-espera.png', '#sjEspera');
await P.waitForSelector('#sj3dSol .sj3d-sol-c', { timeout: 15000 });
await foto(P, 'r183-3b-panel-solicitud-super-admin.png', '#sj3dEscena');
await P.click('#sj3dSol [data-ok="1"]');
await J.waitForFunction(() => window.__lk && window.__lk.localParticipant && document.querySelector('.sj3d-canvas'), null, { timeout: 30000 });
assert.ok(db.todos('auditoria_eventos').some((a) => a.accion === 'aprobar_ingreso' && a.actorUsuario === 'naara'));
assert.deepEqual(h2.errores, []); await h2.cerrar();
console.log('ok 2 · Telegram: estado por persona, envío INCOMPLETO si falta vínculo, enlace de un solo uso al bot existente');
console.log('ok 3 · Ingreso tardío: espera sin audio, solicitud a Sublicuentas, aprobación exclusiva, entra después');

// ---------- 4) Avatar: boca por nivel de voz y acercamientos ----------
await P.evaluate(() => window.__lk.sim.entra('libni', 'Libni')); await P.waitForTimeout(800);
await P.evaluate(() => window.__lk.sim.habla(['libni'])); await P.waitForTimeout(900);
const niveles = await P.evaluate(() => { const e = document.getElementById('sj3dEscena').__sj3d.escena; const out = []; e.traverse((o) => { if (o.userData && typeof o.userData.nivelVoz === 'number') out.push(Math.round(o.userData.nivelVoz * 100) / 100); }); return out; });
assert.ok(niveles.some((v) => v > 0.3) && niveles.some((v) => v < 0.06), 'solo la que habla mueve la boca: ' + niveles);
await P.evaluate(() => window.__lk.sim.silencia('libni', true)); await P.waitForTimeout(1500);
const niv2 = await P.evaluate(() => { const e = document.getElementById('sj3dEscena').__sj3d.escena; const out = []; e.traverse((o) => { if (o.userData && typeof o.userData.nivelVoz === 'number') out.push(o.userData.nivelVoz); }); return out; });
assert.ok(niv2.every((v) => v < 0.06), 'micrófono apagado = sin boca: ' + niv2);
await P.click('[data-sj="salirSala"]'); await P.waitForSelector('.sj-ante');
await P.click('[data-sj="personajeAnte"]'); await P.waitForFunction(() => !document.getElementById('sjEdCarga'), null, { timeout: 60000 });
await P.click('[data-sj="tabPers"][data-t="accesorios"]'); for (const k of ['lentes', 'aretes', 'collar', 'reloj', 'logo']) await P.check(`#sjOps [data-op="${k}"]`);
await P.click('[data-sj="tabPers"][data-t="apariencia"]'); await P.click('#sjOps [data-op="cabello"][data-v="recogido"]').catch(() => {});
await P.click('[data-sj="enfoquePers"][data-v="rostro"]'); await P.waitForTimeout(1600); await foto(P, 'r183-4a-acercamiento-rostro.png', '.sj-ed-3d');
await P.click('[data-sj="enfoquePers"][data-v="torso"]'); await P.waitForTimeout(1600); await foto(P, 'r183-4b-acercamiento-torso.png', '.sj-ed-3d');
await P.click('[data-sj="enfoquePers"][data-v="cuerpo"]'); await P.waitForTimeout(1200);
assert.deepEqual(h.errores, []); await h.cerrar();
console.log('ok 4 · Avatar: boca solo de quien habla (por nivel), micrófono apagado = sin boca, acercamientos rostro/torso');
console.log('R183 paquete correctivo: 4/4 flujos OK');
