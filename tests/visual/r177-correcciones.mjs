// R177 · Correcciones avanzadas SubliStudio: avatar (pose, accesorios, logo), nombre visible, señal de voz, editor de ambiente,
// decoración on/off, convocatoria con tipo de sesión, modo grabación y persistencia. API real + Firestore en memoria + LiveKit simulado.
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { abrir } from './arnes.mjs';
const require = createRequire(import.meta.url);
const { crearFakeDb } = require('../helpers/fake-firestore.cjs');
const out = process.argv[2] || ''; if (out) fs.mkdirSync(out, { recursive: true });
const foto = async (p, n, el) => { if (!out) return; if (el) { await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), el); await p.waitForTimeout(300); } if (el) await (await p.$(el)).screenshot({ path: path.join(out, n) }); else await p.screenshot({ path: path.join(out, n) }); };
const ENV = { LIVEKIT_URL: 'wss://prueba.livekit.cloud', LIVEKIT_API_KEY: 'APIprueba', LIVEKIT_API_SECRET: 'secreto-de-prueba-no-real-0123456789' };
const db = crearFakeDb();
const editor = async (P) => { await P.click('[data-sj="personaje"]'); await P.waitForFunction(() => !document.getElementById('sjEdCarga'), null, { timeout: 60000 }); await P.waitForTimeout(800); };
const escListo = async (P) => { await P.waitForTimeout(400); await P.waitForFunction(() => !document.getElementById('sjEscCarga'), null, { timeout: 60000 }); await P.waitForTimeout(800); };
const secundarios = (P) => P.evaluate(() => { let n = 0; document.getElementById('sjEsc3d').__sj3d.escena.traverse((o) => { if (o.userData.secundario && o.visible) n++; }); return n; });

// 1) Naara: avatar corregido + logo + nombre visible + persistencia
let h = await abrir({ usuario: 'naara', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db, salaEnv: ENV });
let P = h.page;
await P.click('#v2Fila [data-s="sala-juntas"]'); await P.waitForSelector('.sj-top');
await editor(P);
await P.fill('#sjNomVis', 'Licda. Naara');
assert.equal(await P.textContent('#sjEdNom'), 'Licda. Naara', 'vista previa inmediata del nombre');
await P.click('[data-sj="tabPers"][data-t="ropa"]'); await P.click('#sjOps [data-op="superior"][data-v="blazer"]'); await P.click('#sjOps [data-op="colorSuperior"][data-v="#1F2430"]');
await P.click('[data-sj="tabPers"][data-t="accesorios"]');
for (const k of ['lentes', 'aretes', 'collar', 'reloj', 'logo']) await P.check(`#sjOps [data-op="${k}"]`);
await P.click('[data-sj="vistaPers"][data-v="frente"]'); await P.waitForTimeout(1200);
await foto(P, 'r177-1-avatar-femenino-frente.png', '.sj-ed-3d');
await P.click('[data-sj="vistaPers"][data-v="lado"]'); await P.waitForTimeout(1200);
await foto(P, 'r177-1-avatar-femenino-lateral.png', '.sj-ed-3d');
await P.click('[data-sj="vistaPers"][data-v="frente"]'); for (let i = 0; i < 4; i++) await P.click('[data-sj="zoomPers"][data-d="0.6"]'); await P.waitForTimeout(1400);
await foto(P, 'r177-2-logo-y-accesorios-cerca.png', '.sj-ed-3d');
await P.click('[data-sj="giro360"]'); assert.equal(await P.getAttribute('[data-sj="giro360"]', 'aria-pressed'), 'true', 'giro 360 activo');
await P.click('[data-sj="camReset"]');
await P.click('[data-sj="tabPers"][data-t="apariencia"]');
assert.equal(await P.inputValue('#sjNomVis'), 'Licda. Naara', 'el nombre sigue al cambiar de pestaña');
await foto(P, 'r177-3-editor-nombre-visible.png');
await P.click('[data-sj="guardarPers"]'); await P.waitForFunction(() => document.querySelector('.sj-ed-mini img'), null, { timeout: 20000 });
let av = db.todos('sala_avatares').find((x) => x.id === 'naara');
assert.equal(av.config.nombre, 'Licda. Naara'); assert.equal(av.config.logo, true); assert.equal(av.config.collar, true);
await h.cerrar();
console.log('ok Avatar: pose, accesorios, logo, vistas frente/lateral/360, nombre visible guardado');

// 2) Geisell: base masculina de prueba (solo captura, no guarda) + persistencia del nombre de Naara en otra sesión
h = await abrir({ usuario: 'geisell', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db, salaEnv: ENV }); P = h.page;
await P.click('#v2Fila [data-s="sala-juntas"]'); await P.waitForSelector('.sj-top'); await editor(P);
await P.click('#sjOps [data-op="genero"][data-v="hombre"]'); await P.waitForTimeout(3000);
await P.click('[data-sj="tabPers"][data-t="accesorios"]'); for (const k of ['lentes', 'reloj', 'logo']) await P.check(`#sjOps [data-op="${k}"]`);
await P.click('[data-sj="vistaPers"][data-v="frente"]'); await P.waitForTimeout(1400);
await foto(P, 'r177-1-avatar-masculino-frente.png', '.sj-ed-3d');
await h.cerrar();
console.log('ok Base masculina con lentes, reloj y logo');

// 3) Naara: editor de ambiente, decoración on/off, preset guardado
h = await abrir({ usuario: 'naara', ui: 'v2', ancho: 1440, alto: 1100, salaDb: db, salaEnv: ENV }); P = h.page;
await P.click('#v2Fila [data-s="sala-juntas"]'); await P.waitForSelector('.sj-top');
await P.click('[data-sj="escenarios"]'); await P.waitForSelector('#sjEsc3d'); await escListo(P);
assert.deepEqual(await P.$$eval('.sj-esc-sec h4', (x) => x.map((e) => e.textContent.trim())), ['Iluminación', 'Piso', 'Paredes / fondo', 'Asientos / set', 'Paleta de color', 'Decoración', 'Logo / branding']);
await P.click('[data-sj="escTab"][data-e="socios"]'); await escListo(P);
await P.click('[data-sj="escOp"][data-k="piso"][data-v="claro"]'); await P.click('[data-sj="escOp"][data-k="brillo"][data-v="brillante"]');
for (const k of ['cuadros', 'lamparas', 'mesas', 'logos']) await P.check(`[data-sj="escDeco"][data-d="${k}"]`);
await escListo(P);
const conTodo = await secundarios(P);
await foto(P, 'r177-5-editor-ambiente.png');
await foto(P, 'r177-6a-decoracion-encendida.png', '#sjEsc3d');
await P.uncheck('[data-sj="escDeco"][data-d="plantas"]'); await P.uncheck('[data-sj="escDeco"][data-d="cuadros"]'); await P.uncheck('[data-sj="escDeco"][data-d="lamparas"]'); await P.uncheck('[data-sj="escDeco"][data-d="mesas"]');
await escListo(P);
const sinPlantas = await secundarios(P);
assert.ok(sinPlantas < conTodo, `menos objetos sin plantas/cuadros (${sinPlantas} < ${conTodo})`);
await foto(P, 'r177-6b-decoracion-apagada.png', '#sjEsc3d');
await P.check('[data-sj="escDeco"][data-d="plantas"]'); await escListo(P);
await P.fill('#sjEscF [name=nombre]', 'Junta mensual clara'); await P.click('#sjEscF button[type=submit]'); await P.waitForSelector('.sj-esc-p.on');
let D = db.todos('sala_escenarios').find((x) => x.id === 'socios');
assert.equal(D.presets[0].estilo.piso, 'claro'); assert.equal(D.presets[0].estilo.brillo, 'brillante'); assert.equal(D.presets[0].estilo.deco.plantas, true); assert.equal(D.presets[0].estilo.deco.cuadros, false); assert.equal(D.presets[0].estilo.deco.logos, true);
// sugerido "Grabación limpia" en Subli Live
await P.click('[data-sj="escTab"][data-e="live"]'); await escListo(P);
await P.click('[data-sj="escSug"][data-s="grabacion"]'); await escListo(P);
assert.equal(await P.inputValue('#sjEscF [name=nombre]'), 'Grabación limpia');
assert.ok(!(await P.isChecked('[data-sj="escDeco"][data-d="utileria"]')) && await P.isChecked('[data-sj="escDeco"][data-d="logos"]'));
await foto(P, 'r177-6c-live-grabacion-limpia.png', '#sjEsc3d');
console.log('ok Ambiente: 7 secciones, piso/brillo/decoración en vivo, preset con ambiente guardado, sugerido Grabación limpia');

// 4) Convocatoria: tipo de sesión sugiere escenario/estilo; participantes con roles
await P.click('[data-sj="inicio"]').catch(() => {}); await P.click('[data-sj="nueva"]'); await P.waitForSelector('#sjForm [name=tipo]');
assert.deepEqual(await P.$$eval('#sjForm [name=tipo] option', (x) => x.map((o) => o.value)), ['junta', 'revision', 'clase', 'presentacion', 'grabacion', 'otra']);
await P.selectOption('#sjForm [name=tipo]', 'grabacion');
assert.equal(await P.inputValue('#sjForm [name=escenario]'), 'live'); assert.equal(await P.inputValue('#sjForm [name=presetId]'), 's:grabacion');
assert.match(await P.textContent('.sj-sug-nota'), /Grabación de anuncio.*Subli Live.*Grabación limpia/s);
const hn = new Date(Date.now() - 6 * 3600000 + 15 * 60000); hn.setUTCMinutes(Math.ceil(hn.getUTCMinutes() / 5) * 5);
await P.fill('#sjForm [name=titulo]', 'Anuncio promo diciembre (prueba)'); await P.fill('#sjForm [name=fecha]', hn.toISOString().slice(0, 10)); await P.fill('#sjForm [name=hora]', hn.toISOString().slice(11, 16));
await P.selectOption('#sjForm [name=duracionMin]', '15'); await P.fill('#sjForm [name=agenda]', 'Guion del anuncio');
await P.check('#sjForm [name=sjPart][value=libni]'); await P.uncheck('#sjForm [name=sjPart][value=geisell]').catch(() => {});
assert.match(await P.textContent('.sj-form-d'), /Modera, da la palabra, graba/);
await foto(P, 'r177-7-convocatoria-tipo-participantes.png');
await P.click('#sjForm button[type=submit]'); for (let i = 0; i < 60 && !db.todos('sala_reuniones').length; i++) await P.waitForTimeout(250); await P.waitForSelector('[data-sj="entrar"]', { timeout: 15000 });
const reu = db.todos('sala_reuniones')[0]; assert.equal(reu.tipo, 'grabacion'); assert.equal(reu.escenario, 'live'); assert.equal(reu.sugerido, 'grabacion'); assert.equal(reu.duracionMin, 15); assert.deepEqual(reu.participantes, ['naara', 'libni']);
console.log('ok Convocatoria: tipo → Subli Live + Grabación limpia, 15 min, participantes con roles');

// 5) En vivo: nombre visible, señal de voz, estados de asistentes, modo grabación
await P.click(`[data-sj="entrar"][data-id="${reu.id}"]`);
await P.waitForFunction(() => window.__lk && window.__lk.localParticipant && !document.getElementById('sj3dCarga') && document.querySelector('.sj3d-canvas'), null, { timeout: 60000 });
await P.evaluate(() => window.__lk.sim.entra('libni', 'Libni'));
await P.waitForTimeout(800);
assert.match(await P.textContent('.sj3d-nombre.sj3d-anf'), /Licda\. Naara \(Anfitriona\)/, 'nombre visible sobre el avatar');
await P.evaluate(() => window.__lk.sim.habla(['libni'])); await P.waitForTimeout(900);
assert.ok(await P.$('.sj3d-nombre.sj3d-hablando'), 'etiqueta de quien habla con ondas');
const aro = await P.evaluate(() => { let op = 0; document.getElementById('sj3dEscena').__sj3d.escena.traverse((o) => { if (o.name === 'aroVoz' && o.visible) op = Math.max(op, o.material.opacity); }); return op; });
assert.ok(aro > 0.2, 'aro luminoso encendido: ' + aro);
await foto(P, 'r177-4-indicador-voz.png', '#sj3dEscena');
await P.click('[data-sj="lkPart"]'); await P.waitForSelector('.sj3d-pp');
assert.match(await P.textContent('#sj3dPanel'), /Libni.*En la sala.*Hablando/s);
await P.evaluate(() => window.__lk.sim.silencia('libni', true)).catch(() => {});
await foto(P, 'r177-4b-asistentes-estado.png', '#sj3dPanel');
await P.click('[data-sj="lkAju"]'); await P.waitForSelector('#sj3dModoGrab'); await P.check('#sj3dModoGrab'); await P.waitForTimeout(1500);
assert.ok(await P.$('.sj3d-nombres.sj3d-limpio'), 'modo grabación oculta nombres');
await P.click('[data-sj="lkCerrarPanel"]'); await P.waitForTimeout(600);
await foto(P, 'r177-6d-modo-grabacion.png', '#sj3dEscena');
await P.click('[data-sj="salirSala"]'); await P.waitForSelector('.sj-ante');
assert.match(await P.textContent('.sj-ante-esc'), /Subli Live · Grabación limpia/);
assert.deepEqual(h.errores, []);
await h.cerrar();
console.log('ok En vivo: nombre visible, aro + ondas al hablar, estados en asistentes, modo grabación');

// 6) Persistencia en otra sesión (celular): nombre, avatar y preset siguen guardados
h = await abrir({ usuario: 'naara', ui: 'v2', ancho: 390, alto: 844, salaDb: db, salaEnv: ENV }); P = h.page;
await P.evaluate(() => window.SublichatRBAC.ir('sala-juntas')); await P.waitForSelector('.sj-top'); await editor(P);
assert.equal(await P.inputValue('#sjNomVis'), 'Licda. Naara'); assert.equal(await P.textContent('#sjEdNom'), 'Licda. Naara');
await foto(P, 'r177-8-persistencia-celular.png');
const ancho = await P.evaluate(() => document.documentElement.scrollWidth); assert.ok(ancho <= 392, 'sin desborde: ' + ancho);
await P.click('[data-sj="inicio"]').catch(() => {}); await P.click('[data-sj="escenarios"]'); await P.waitForSelector('#sjEsc3d'); await escListo(P);
await P.click('[data-sj="escTab"][data-e="socios"]'); await escListo(P);
assert.match(await P.textContent('.sj-esc-ps'), /Junta mensual clara/);
assert.deepEqual(h.errores, []);
await h.cerrar();
console.log('ok Persistencia: nombre, personaje y preset al recargar y en otro dispositivo; celular sin desborde');
console.log('R177 correcciones: 6/6 recorridos OK');
