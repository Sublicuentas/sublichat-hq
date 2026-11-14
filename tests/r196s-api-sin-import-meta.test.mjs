// R196s · Vercel compila api/ como CommonJS (api/package.json sin "type":"module"): «import.meta» en cualquier archivo
// de api/ tumba la función entera al cargar (log: SyntaxError: Cannot use 'import.meta' outside a module →
// 500 «A server error has occurred» en Control financiero). Ningún archivo de api/ debe usarlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('api/: ningún archivo usa import.meta (rompe la carga en Vercel)', () => {
  const dir = new URL('../api/', import.meta.url);
  const malos = fs.readdirSync(dir).filter((f) => /\.(m?js|cjs)$/.test(f)).filter((f) => /\bimport\.meta\b/.test(fs.readFileSync(new URL(f, dir), 'utf8').replace(/\/\/.*$/gm, '')));
  assert.deepEqual(malos, []);
});
test('_finanzas-panel.js usa la librería de Spotify por import normal', () => {
  const s = fs.readFileSync(new URL('../api/_finanzas-panel.js', import.meta.url), 'utf8');
  assert.match(s, /import spotifyFam from "\.\/_spotify-familias\.js"/);
  assert.match(s, /await spotifyFam\.sincronizarBodega\(db, fid\)/);
  assert.doesNotMatch(s, /createRequire/);
});
