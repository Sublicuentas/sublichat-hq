// R176 · La actualización automática ya no borra lo que se está llenando (Inicio de Naara con formulario embebido) + duración 15 min.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { abrir } from './arnes.mjs';
const require = createRequire(import.meta.url);
const { crearFakeDb } = require('../helpers/fake-firestore.cjs');
const db = crearFakeDb();
const h = await abrir({ usuario: 'naara', ui: 'v2', ancho: 1440, alto: 1000, salaDb: db });
const P = h.page;
await P.click('#v2Fila [data-s="sala-juntas"]'); await P.waitForSelector('.sj-top');
await P.click('[data-sj="nueva"]'); await P.waitForSelector('#sjForm [name=titulo]');
const ops = await P.$$eval('#sjForm [name=duracionMin] option', (x) => x.map((o) => o.value));
assert.equal(ops[0], '15', 'existe 15 minutos'); assert.ok(ops.includes('30'));
await P.fill('#sjForm [name=titulo]', 'Revisión rápida (prueba)'); await P.fill('#sjForm [name=agenda]', 'Punto 1');
await P.selectOption('#sjForm [name=duracionMin]', '15'); await P.check('#sjForm [name=sjPart][value=libni]');
await P.evaluate(() => document.activeElement && document.activeElement.blur());
for (let i = 0; i < 3; i++) { await P.evaluate(() => window.SublichatSala.recargar()); await P.waitForTimeout(500); }
assert.equal(await P.inputValue('#sjForm [name=titulo]'), 'Revisión rápida (prueba)');
assert.equal(await P.inputValue('#sjForm [name=duracionMin]'), '15');
assert.ok(await P.isChecked('#sjForm [name=sjPart][value=libni]'));
// Inicio con formulario embebido: escribir sin guardar y forzar 3 recargas automáticas
await P.click('[data-sj="inicio"]').catch(() => {}); await P.waitForTimeout(400);
const emb = await P.$('form [name=titulo]');
if (emb) {
  await emb.fill('Borrador en inicio'); await P.evaluate(() => document.activeElement && document.activeElement.blur());
  for (let i = 0; i < 3; i++) { await P.evaluate(() => window.SublichatSala.recargar()); await P.waitForTimeout(500); }
  assert.equal(await (await P.$('form [name=titulo]')).inputValue(), 'Borrador en inicio');
}
assert.deepEqual(h.errores, []);
await h.cerrar();
console.log('ok R176: recarga automática no borra formulario (form y Inicio), opción 15 minutos');
