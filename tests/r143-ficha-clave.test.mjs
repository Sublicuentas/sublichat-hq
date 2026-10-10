import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const vieja = "Hola, *_Gaby Garcia_*.\n\n*👤 Perfil / cliente: Gaby Garcia*\n*📧 Correo: fgjnfsjg@hyscore.xyz*\n*🔑 Contraseña: —*\n\n*📅 Renovación: 09/11/2026*";
test('R143 APK: la ficha guardada con "Contraseña: —" muestra la clave real al abrir el cliente', () => {
  const { refrescarFichaTextoMovil } = require('../api/mobile-core.js').__pruebas;
  const s = { fechaRenovacion: '09/11/2026', correo: 'fgjnfsjg@hyscore.xyz', clave: 'octubre09', perfiles: [{ nombre: 'Gaby Garcia', correo: 'fgjnfsjg@hyscore.xyz', clave: 'octubre09' }] };
  const t = refrescarFichaTextoMovil(vieja, s);
  assert.match(t, /\*🔑 Contraseña: octubre09\*/);
  assert.match(t, /Perfil \/ cliente: Gaby Garcia\*/);
  const mp = refrescarFichaTextoMovil("*📱 Max Player*\n*🔒 Contraseña: mp1*", { maxPlayer: true, clave: 'otra' });
  assert.match(mp, /Contraseña: mp1/, 'Max Player conserva su propia contraseña');
});
test('R143 servidor: al guardar, la ficha vieja se corrige con la clave guardada', () => {
  const r = fs.readFileSync(new URL('../api/renovar.js', import.meta.url), 'utf8');
  assert.match(r, /out\.fichaTexto = refrescarCredencialesFicha\(fichaTexto, out\)/);
  assert.match(r, /function refrescarCredencialesFicha\(texto = "", s = \{\}\)/);
});
