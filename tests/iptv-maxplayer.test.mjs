import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('R58 IPTV: renovar guarda Max Player con su propio usuario/contraseña y lo conserva si no se manda', () => {
  const r = read('api/renovar.js');
  assert.match(r, /const mpActivo = \(servicio\.maxPlayer \?\? anterior\.maxPlayer\) === true;/);
  assert.match(r, /out\.maxPlayerUsuario = mpActivo \? String\(servicio\.maxPlayerUsuario \?\? anterior\.maxPlayerUsuario/);
});

test('R58 IPTV: el enlace muestra por defecto solo dispositivos y fecha; con Max Player sus credenciales', () => {
  const a = read('api/acceso.js');
  assert.match(a, /if \(modo === "plataforma"\) return true;/);
  assert.match(a, /correo: !vencido && !soloPlan && campos\.mostrarCorreo/);
  assert.match(a, /maxPlayerUsuario: !vencido && esFamiliaIptv\(plataforma\) && servicio\.maxPlayer === true/);
  const h = read('acceso.html');
  assert.match(h, /Cuenta válida en \$\{dispositivos\} dispositivo/);
  assert.match(h, /📱 Max Player/);
});
