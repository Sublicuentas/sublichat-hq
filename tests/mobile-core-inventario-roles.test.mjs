import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const core = fs.readFileSync(path.join(root, 'api/mobile-core.js'), 'utf8');

// Inventario en la app: Sublicuentas, Geisell y Relojes. Finanzas sigue solo para Sublicuentas y Relojes.
test('mobile-core: Inventario lo leen Sublicuentas, Geisell y Relojes', () => {
  assert.match(core, /if \(resource === 'inventario'\) return a\.sublicuentas \|\| a\.geisell \|\| a\.relojes;/);
  assert.match(core, /if \(resource === 'finanzas_movimientos' \|\| resource === 'finanzas'\) return a\.sublicuentas \|\| a\.relojes;/);
  assert.match(core, /if \(resource === 'clientes'\) return a\.sublicuentas \|\| a\.relojes \|\| a\.geisell;/);
});
