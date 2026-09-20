import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

// La app Android llama /api/academia; la Academia web guarda en la misma colección.
test('api/academia.js existe y comparte academia_progreso con la Academia web', () => {
  const api = fs.readFileSync(path.join(root, 'api/academia.js'), 'utf8');
  const web = fs.readFileSync(path.join(root, 'academia-sublicuentas.html'), 'utf8');
  assert.match(api, /collection\('academia_progreso'\)/);
  assert.match(web, /ACA_COL\s*=\s*'academia_progreso'/);
  assert.match(api, /accion === 'obtener'/);
  assert.match(api, /accion === 'completar'/);
});
