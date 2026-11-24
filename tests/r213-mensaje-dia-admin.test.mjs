// R213 · Sublichat › Revendedores › «Mensaje del día»: publicar/retirar por fecha; el proxy deja pasar el recurso.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const s = fs.readFileSync(new URL('../revendedores-admin.js', import.meta.url), 'utf8');
const px = fs.readFileSync(new URL('../api/revendedores-admin.js', import.meta.url), 'utf8');
test('pestaña y acciones', () => {
  assert.match(s, /data-rtab="mensajes"/); assert.match(s, /mensajes:renderMensajesDia/);
  assert.match(s, /api\('PUT','mensajes-dia\/'\+encodeURIComponent\(f\),\{texto:t,estado:'publicado'\}\)/);
  assert.match(s, /estado:'retirado'/); assert.match(s, /no puede llevar < ni >/);
});
test('proxy: recurso permitido', () => { assert.match(px, /"mensajes-dia"\]\)/); });
test('caché del script renovada', () => { assert.match(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /revendedores-admin\.js\?v=20261124-r213/); });
