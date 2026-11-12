// R196l · Nunca se muestran los nombres de las personas: Naara → Sublicuentas, Libni → Relojes. Datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../nombres-publicos.js', import.meta.url), 'utf8');
const win = {}; vm.runInNewContext(src, { window: win });
const P = win.nombrePublico;

test('R196l: nombres públicos y titular bancario legal intacto', () => {
  assert.equal(P('naara (vía Sublicuentas) · 05 nov'), 'Sublicuentas (vía Sublicuentas) · 05 nov');
  assert.equal(P('RELOJES → Libni Daniela'), 'RELOJES → Relojes');
  assert.equal(P('Titular: NAARA BETZABÉ VELÁSQUEZ BLANCO'), 'Titular: NAARA BETZABÉ VELÁSQUEZ BLANCO');
  assert.equal(P('Geisell'), 'Geisell');
});

test('R196l: la app carga el filtro y la Sala ya no usa los nombres', () => {
  assert.match(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /<script src="\/nombres-publicos\.js\?v=20261111-r196l"><\/script>\s*<\/head>/);
  const sala = fs.readFileSync(new URL('../api/_sala-juntas.js', import.meta.url), 'utf8');
  assert.match(sala, /id: 'naara', nombre: 'Sublicuentas'/); assert.match(sala, /id: 'libni', nombre: 'Relojes'/);
  assert.doesNotMatch(fs.readFileSync(new URL('../sala-juntas.js', import.meta.url), 'utf8'), /Naara|Libni/);
});
