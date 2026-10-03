import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
test('api/finanzas.js lleva su libro mayor dentro de /api (Vercel siempre lo empaqueta)', () => {
  const src = fs.readFileSync(path.join(root, 'api/finanzas.js'), 'utf8');
  // Vercel compila api/finanzas.js a CommonJS: sus dependencias locales deben ser .js dentro de /api (nunca .mjs).
  assert.match(src, /from "\.\/_finanzas-libro\.js"/);
  assert.match(src, /from "\.\/_finance-schema\.js"/);
  assert.doesNotMatch(src, /\.mjs["']/);
  assert.ok(fs.existsSync(path.join(root, 'api/_finanzas-libro.js')));
  assert.ok(fs.existsSync(path.join(root, 'api/_finance-schema.js')));
});
