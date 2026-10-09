import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const r = fs.readFileSync(new URL('../api/renovar.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
test('R142: cuenta completa no pide TV/celular ni PIN (servidor = APK y web; web oculta el selector)', () => {
  assert.equal((r.match(/if \(nuevo\.tipoVenta !== "cuenta_completa" && servicioUsaSelectorDispositivo\(nuevo\.plataforma\)/g) || []).length, 3);
  assert.doesNotMatch(r, /if \(servicioUsaSelectorDispositivo\(nuevo\.plataforma\) && !\["tv", "cel"\]/);
  assert.match(r, /if \(nuevo\.tipoVenta !== "cuenta_completa" && !servicioNoUsaPinPerfil\(nuevo\.plataforma\) && !p\.pinPerfil\)/);
  assert.match(app, /const fichaUsaSelectorDispositivo=plat=>!fichaEsCuentaCompleta\(\)&&FICHA_CON_DISPOSITIVO/);
});
