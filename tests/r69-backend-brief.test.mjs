import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('R69 renovar: idempotencia por uid+operationId, auditoría con identidad del TOKEN y sin secretos, 426 si la APK es vieja', async () => {
  const r = read('api/renovar.js');
  assert.match(r, /collection\("operaciones_idempotentes"\)\.doc\(`\$\{user\.uid\}_\$\{opId\}`\)/);
  assert.match(r, /X-Idempotent-Replay/);
  assert.match(r, /uid: user\.uid, usuario: String\(user\.usuario \|\| ""\), rol: String\(user\.role \|\| ""\), \/\/ del token/);
  assert.match(r, /code: "UPDATE_REQUIRED"/);
  const { __wrapperInternal } = await import('../api/renovar.js');
  const campos = __wrapperInternal.camposModificados({ servicio: { clave: 'S3CRETO', maxPlayerClave: 'X', precio: 1 } });
  assert.ok(campos.includes('servicio.clave(protegido)')); assert.ok(!JSON.stringify(campos).includes('S3CRETO'));
});
test('R69 mobile-core: configuración remota sin secretos y con build mínimo', () => {
  const m = read('api/mobile-core.js');
  assert.match(m, /if \(action === 'config'\) return getConfig\(req, res\);/);
  assert.match(m, /collection\('configuracion_app'\)\.doc\('android'\)/);
  assert.match(m, /MIN_ANDROID_BUILD/);
});
test('R69 URL pública IPTV: fecha y hora de renovación', () => {
  assert.match(read('api/acceso.js'), /iptvHora: esFamiliaIptv\(plataforma\)/);
  assert.match(read('acceso.html'), /d\.iptvHora\?` · \$\{d\.iptvHora\}`/);
});
