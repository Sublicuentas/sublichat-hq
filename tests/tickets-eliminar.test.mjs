import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.join(process.cwd(), 'api', 'tickets.js'), 'utf8');

// El usuario pidió poder borrar avisos de prueba: antes no existía ninguna acción para eliminar un ticket.
test('api/tickets.js: existe una acción "eliminar" que borra el aviso, respeta permisos y es idempotente', () => {
  assert.match(src, /else if \(accion === 'eliminar'\) out = await deleteTicket\(db, body\);/);
  const fn = src.slice(src.indexOf('async function deleteTicket'), src.indexOf('async function deleteTicket') + 700);
  assert.match(fn, /db\.collection\('tickets_auditoria'\)\.doc\(id\)/, 'usa la misma colección que el resto de acciones de tickets');
  assert.match(fn, /if \(!snap\.exists\) return \{ ok: true, id, yaNoExistia: true \}/, 'si ya no existe, responde ok igual (no falla al reintentar)');
  assert.match(fn, /canAccessTicket\(old, body\.rol\)/, 'respeta el mismo control de permisos que ver/responder un ticket');
  assert.match(fn, /await ref\.delete\(\);/);
});
