// R178 · Hora de la convocatoria sin confusión (hora, minutos y a. m./p. m.) y se puede programar "ahora".
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { abrir } from './arnes.mjs';
const require = createRequire(import.meta.url);
const { crearFakeDb } = require('../helpers/fake-firestore.cjs');
const out = process.argv[2] || ''; if (out) fs.mkdirSync(out, { recursive: true });
const db = crearFakeDb();
const h = await abrir({ usuario: 'naara', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db });
const P = h.page;
await P.click('#v2Fila [data-s="sala-juntas"]'); await P.waitForSelector('.sj-top');
await P.click('[data-sj="nueva"]'); await P.waitForSelector('#sjForm [name=h12]');
assert.equal(await P.$$eval('#sjForm [name=min] option', (x) => x.length), 60, 'cualquier minuto');
assert.deepEqual(await P.$$eval('#sjForm [name=ampm] option', (x) => x.map((o) => o.textContent)), ['a. m.', 'p. m.']);
await P.fill('#sjForm [name=titulo]', 'Prueba de reunión'); await P.fill('#sjForm [name=agenda]', 'Prueba de sala de juntas');
await P.check('#sjForm [name=sjPart][value=geisell]');
// fecha de ayer → mensaje claro con la hora real de Honduras
const ayer = new Date(Date.now() - 6 * 3600000 - 86400000).toISOString().slice(0, 10);
await P.fill('#sjForm [name=fecha]', ayer);
await P.click('#sjForm button[type=submit]');
await P.waitForFunction(() => /ya pasó: en Honduras son las/.test(document.body.textContent), null, { timeout: 15000 });
// "Ahora" → se programa para este momento
await P.click('[data-sj="horaAhora"]');
const hn = new Date(Date.now() - 6 * 3600000); const h24 = hn.getUTCHours();
assert.equal(await P.inputValue('#sjForm [name=ampm]'), h24 >= 12 ? 'pm' : 'am');
if (out) await P.screenshot({ path: path.join(out, 'r178-hora-am-pm.png') });
await P.click('#sjForm button[type=submit]');
for (let i = 0; i < 60 && !db.todos('sala_reuniones').length; i++) await P.waitForTimeout(250);
const r = db.todos('sala_reuniones')[0]; assert.ok(r, 'se programó'); assert.ok(Math.abs(r.inicioMs - Date.now()) < 3 * 60000, 'a la hora de ahora');
assert.deepEqual(h.errores, []);
await h.cerrar();
console.log('ok R178: hora con a. m./p. m., cualquier minuto, "Ahora" programa al momento, fecha pasada explica la hora de Honduras');
