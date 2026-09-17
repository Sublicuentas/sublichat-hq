import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../src/api.js', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../src/data.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const mobileCore = fs.readFileSync(new URL('./fixtures/mobile-core.js', import.meta.url), 'utf8');

test('Activar TV is completely removed from Android UI and capability surface', () => {
  assert.equal(main.includes('Activar TV'), false);
  assert.equal(main.includes('activar-tv'), false);
  assert.equal(main.includes('ensureTv'), false);
  assert.equal(api.includes('loadTvAvailability'), false);
  assert.equal(data.includes('activarTv'), false);
});

test('WhatsApp action lets the operator choose Personal or Business explicitly', () => {
  assert.match(main, /WhatsApp normal/);
  assert.match(main, /WhatsApp Business/);
  assert.match(main, /com\.whatsapp\.w4b/);
  assert.match(main, /whatsappChooser/);
  assert.match(css, /whatsapp-choice/);
});

test('Android operational reads go through authenticated Core instead of Firestore REST rules', () => {
  assert.match(api, /\/api\/mobile-core/);
  assert.match(api, /loadMobileResource/);
  assert.match(main, /loadMobileResource\('clientes'/);
  assert.equal(main.includes("firestoreListCollection('clientes'"), false);
  assert.equal(main.includes("firestoreListCollection('inventario'"), false);
  assert.equal(main.includes("firestoreListCollection('finanzas_movimientos'"), false);
});

test('mobile Core fixture reuses login and role-gates clientes, inventario and finanzas', () => {
  assert.match(mobileCore, /require\('\.\/login'\)/);
  assert.match(mobileCore, /verifyIdToken/);
  for (const name of ['clientes','inventario','finanzas_movimientos']) assert.match(mobileCore, new RegExp(name));
  assert.match(mobileCore, /geisell_admin/);
  assert.match(mobileCore, /nextCursor/);
});
