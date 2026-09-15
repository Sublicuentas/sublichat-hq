import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('api/renovar keeps its runtime helper modules inside /api for Vercel bundling', () => {
  const renovar = read('api/renovar.js');
  assert.match(
    renovar,
    /from\s+["']\.\/_sorteos-eventos\.js["']/,
    'renovar.js must import its helper from api/_sorteos-eventos.js'
  );
  assert.doesNotMatch(
    renovar,
    /from\s+["']\.\.\/lib\/sorteos-eventos\.js["']/,
    'renovar.js must not depend on a helper outside /api'
  );

  const eventosPath = path.join(root, 'api/_sorteos-eventos.js');
  const libPath = path.join(root, 'api/_sorteos-lib.js');
  assert.ok(fs.existsSync(eventosPath), 'api/_sorteos-eventos.js must exist');
  assert.ok(fs.existsSync(libPath), 'api/_sorteos-lib.js must exist');

  const eventos = fs.readFileSync(eventosPath, 'utf8');
  assert.match(
    eventos,
    /from\s+["']\.\/_sorteos-lib\.js["']/,
    '_sorteos-eventos.js must import its sibling helper inside /api'
  );
});
