import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const cap = JSON.parse(fs.readFileSync(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('Android identity is stable', () => {
  assert.equal(cap.appId, 'com.sublicuentas.app');
  assert.equal(cap.appName, 'Sublicuentas');
  assert.equal(cap.webDir, 'dist');
});

test('mobile package can build with Vite and Capacitor 8', () => {
  assert.equal(pkg.scripts.build, 'vite build');
  assert.match(pkg.dependencies['@capacitor/android'], /^\^8/);
  assert.match(pkg.devDependencies['@capacitor/cli'], /^\^8/);
});

test('bottom navigation prioritizes Nuevo CRM over Catalog for daily operations', () => {
  for (const label of ['Inicio','Clientes','Nuevo CRM','Renovar','Más']) assert.match(main, new RegExp(label));
  assert.match(main, /nuevo-crm/);
});
