import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const api = fs.readFileSync(new URL('../api/auditoria.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
test('R106 auditoría total: servidor + usuarios, cursor, antes/después y sin secretos', () => {
  assert.match(api, /collection\("auditoria_eventos"\)/);
  assert.match(api, /antesDe/);
  assert.match(api, /\(credencial cambiada\)/);
  assert.match(api, /nextCursor/);
  assert.match(app, /function actividadDiffHtml\(e\)/);
  assert.match(app, /id="actividadCsv"/);
  assert.match(app, /loadActividadMas\(\)/);
  assert.match(app, /id="actividadModulo"/);
});
test('sinSecretos oculta clave/pin/token en cualquier nivel', async () => {
  const src = api.slice(api.indexOf('const SECRET_RE'), api.indexOf('function eventoServidor'));
  const fn = new Function(src + '; return sinSecretos;')();
  const out = fn({ correo: 'a@b.c', clave: 'x1', perfil: { pin: '1234', nombre: 'Ana' }, token: 'zz' });
  assert.equal(out.clave, '(credencial cambiada)'); assert.equal(out.perfil.pin, '(credencial cambiada)'); assert.equal(out.token, '(credencial cambiada)');
  assert.equal(out.correo, 'a@b.c'); assert.equal(out.perfil.nombre, 'Ana');
});
