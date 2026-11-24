// R204 · Sublichat › Revendedores › Recompensas: aprobación manual con disponibilidad comprobada, sin claves, catálogo editable.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const s = fs.readFileSync(new URL('../revendedores-admin.js', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../api/revendedores-admin.js', import.meta.url), 'utf8');
test('aprobar exige «Comprobé el cupo y el acceso real» y la entrega pide nota SIN claves', () => {
  assert.match(s, /Comprobé el cupo y el acceso real/);
  assert.match(s, /body\.disponibilidadComprobada=true/);
  assert.match(s, /sin claves ni datos de acceso/);
});
test('catálogo editable: duración, costo, cupos, disponibilidad, activo y plan de HBO', () => {
  for (const k of ['duracion', 'costoHnl', 'cupos', 'disponibilidad', 'activo', 'plan']) assert.match(s, new RegExp(`data-k="${k}"`));
  assert.match(s, /todos menos Netflix/);
});
test('pedidos: estado «pago confirmado» y el puente solo agrega sublipoints (lectura)', () => {
  assert.match(s, /<option value="pago confirmado"/);
  assert.match(api, /"consultas", "sublipoints", "billetera"\]/);
});
test('billetera: acreditar exige confirmar el depósito y el monto real; rechazar pide motivo', () => {
  assert.match(s, /Confirmé que el dinero llegó a la cuenta/);
  assert.match(s, /Monto que realmente llegó/);
  assert.match(s, /billetera\/recargas\/\$\{id\}\/\$\{accion\}/);
});
