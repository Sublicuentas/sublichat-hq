import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const text = rel => readFile(path.join(root, rel), 'utf8');

test('api/renovar incluye el helper de sorteos en el bundle de Vercel', async () => {
  const renovar = await text('api/renovar.js');
  const local = /from\s+["']\.\/_sorteos-eventos\.js["']/.test(renovar);
  const shared = /from\s+["']\.\.\/lib\/sorteos-eventos\.js["']/.test(renovar);
  assert.ok(local || shared, 'renovar debe usar el helper compartido de sorteos (api/_sorteos-eventos.js o lib/sorteos-eventos.js)');

  // El helper dentro de api/ viaja solo con la función; el de lib/ necesita includeFiles.
  if (shared && !local) {
    const cfg = JSON.parse(await text('vercel.json'));
    const rule = cfg.functions?.['api/renovar.js'];
    assert.ok(rule, 'Falta configuración de Vercel específica para api/renovar.js');
    const includes = Array.isArray(rule.includeFiles) ? rule.includeFiles : [rule.includeFiles].filter(Boolean);
    assert.ok(includes.some(v => /^lib\/(?:\*\*|sorteos-)/.test(String(v))),
      'api/renovar.js debe incluir lib/** (o los helpers sorteos-*) en su bundle');
  }
});

test('las dos copias del helper de sorteos (api/_ y lib/) no se desincronizan', async () => {
  const norm = (src) => src.replace(/\r\n/g, '\n').replace(/\.\/_?sorteos-lib\.js/g, './sorteos-lib.js');
  assert.equal(norm(await text('api/_sorteos-eventos.js')), norm(await text('lib/sorteos-eventos.js')),
    'api/_sorteos-eventos.js y lib/sorteos-eventos.js deben ser idénticos (salvo la ruta de import)');
  assert.equal(norm(await text('api/_sorteos-lib.js')), norm(await text('lib/sorteos-lib.js')),
    'api/_sorteos-lib.js y lib/sorteos-lib.js deben ser idénticos');
});
