import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

// Vercel solo compila/empaqueta bien los helpers ESM que viven dentro de /api.
// Un helper .js fuera de /api (p. ej. ../lib/sorteos-lib.js) llega sin compilar y
// la función entera cae con FUNCTION_INVOCATION_FAILED antes de ejecutar nada.
test('api/sorteos mantiene sus helpers dentro de /api para el bundle de Vercel', () => {
  const src = read('api/sorteos.js');
  assert.match(src, /from\s+["']\.\/_sorteos-lib\.js["']/, 'sorteos.js debe importar ./_sorteos-lib.js');
  assert.match(src, /from\s+["']\.\/_sorteos-eventos\.js["']/, 'sorteos.js debe importar ./_sorteos-eventos.js');
  assert.doesNotMatch(src, /from\s+["']\.\.\/lib\/sorteos-[a-z-]+\.js["']/, 'sorteos.js no debe importar helpers .js desde ../lib');
});

test('ninguna función de api/ importa un .js ESM desde fuera de /api', () => {
  for (const file of fs.readdirSync(path.join(root, 'api')).filter(f => f.endsWith('.js'))) {
    const src = read(`api/${file}`);
    const re = /from\s+["'](\.\.\/[^"']+)["']/g;
    let m;
    while ((m = re.exec(src))) {
      assert.ok(m[1].endsWith('.mjs'), `api/${file} importa ${m[1]}: fuera de /api solo se permiten módulos .mjs`);
    }
  }
});
