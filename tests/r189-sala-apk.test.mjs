// R189 · La APK usa el MISMO servidor de la Sala (sin base de datos ni cuentas aparte). Revisión de cableado.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('RSVP desde la APK queda con canal «android» en la misma colección y auditoría; el enlace /?sala=<id> sigue abriendo la antesala', () => {
  const api = fs.readFileSync(new URL('../api/sala-juntas.js', import.meta.url), 'utf8');
  assert.match(api, /const canal = body\.origen === 'android' \? 'android' : 'web';/);
  assert.match(api, /auditoria\(db, yo, 'rsvp', id, \{ respuesta: resp, canal \}\)/);
  assert.match(api, /verifyIdToken\(token, true\)/, 'sesión revocada = sin acceso');
  const web = fs.readFileSync(new URL('../sala-juntas.js', import.meta.url), 'utf8');
  assert.match(web, /new URLSearchParams\(location\.search\)\.get\('sala'\)/);
});
