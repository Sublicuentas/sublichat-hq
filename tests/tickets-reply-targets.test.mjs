import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tickets = fs.readFileSync(path.join(root, 'api/tickets.js'), 'utf8');
const mobileCore = fs.readFileSync(path.join(root, 'api/mobile-core.js'), 'utf8');

// La respuesta hecha desde Sublichat/APK debe ir a quien respondió por Telegram (no a todos los destinatarios del aviso).
test('tickets: la respuesta va a quien respondió por Telegram', () => {
  const fn = tickets.slice(tickets.indexOf('function ticketReplyTargets('), tickets.indexOf('function creationTelegramMessage'));
  assert.match(fn, /r\.origen === 'telegram' && destinationKey\(r\.porRol\)/);
  assert.match(fn, /return \[destinationKey\(ultimaTelegram\.porRol\)\]/);
  assert.match(fn, /return ticketConversationTargets\(ticket, actorRole\)/);
  assert.match(tickets, /const paraRoles = ticketReplyTargets\(old, body\.rol\)/);
  assert.match(tickets, /paraLabel: destinosLabel\(paraRoles\)/);
  assert.match(tickets, /sendTelegram\(db, msg, paraRoles,/);
});

// Control financiero (web y app) une el histórico (finanzas) con lo actual (finanzas_movimientos).
test('mobile-core: expone finanzas (histórico) además de finanzas_movimientos', () => {
  assert.match(mobileCore, /resource === 'finanzas_movimientos' \|\| resource === 'finanzas'/);
  assert.match(mobileCore, /\['clientes','inventario','finanzas_movimientos','finanzas'\]\.includes\(resource\)/);
});
