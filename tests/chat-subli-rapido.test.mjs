import test from 'node:test';
import assert from 'node:assert/strict';
import { __chatInternal } from '../api/chat.js';
const { respuestaLocal, contextoRelevante } = __chatInternal;
const hoy = '2026-09-24';
const clientes = [
  { nombre: 'Kevin Valle', tel: '9669-9149', vendedor: 'Sublicuentas', cuentas: [{ plataforma: 'vipnetflix', precio: 130, renueva: '2026-09-24', correo: 'k@x.com', clave: 'secreta' }, { plataforma: 'disneyp', precio: 70, renueva: '2026-10-25' }] },
  { nombre: 'Kerstin Obando', tel: '94756665', vendedor: 'Relojes', cuentas: [{ plataforma: 'hbomax', precio: 80, renueva: '2026-09-25' }] },
  { nombre: 'Ana Vencida', tel: '99990000', vendedor: 'Geisell', cuentas: [{ plataforma: 'netflix', precio: 100, renueva: '2026-09-20' }] },
];
test('Subli R63: "¿Qué clientes vencen hoy?" se responde al instante sin Gemini y con cifras exactas', () => {
  const r = respuestaLocal('¿Qué clientes vencen hoy?', clientes, hoy);
  assert.match(r, /\*\*1 cuenta vence hoy\*\*/); assert.match(r, /Kevin Valle/); assert.match(r, /Netflix Premium VIP/); assert.doesNotMatch(r, /Kerstin/);
  assert.match(respuestaLocal('clientes que vencen mañana', clientes, hoy), /Kerstin Obando/);
  assert.match(respuestaLocal('¿quiénes están vencidos?', clientes, hoy), /Ana Vencida/);
  assert.equal(respuestaLocal('¿cuál es la clave de Kevin?', clientes, hoy), null, 'preguntas de detalle van a Gemini');
});
test('Subli R63: a Gemini solo va lo necesario (sin claves salvo que las pida de un cliente)', () => {
  const ctx = contextoRelevante('¿cuánto paga Kevin?', clientes);
  assert.equal(ctx.length, 1); assert.equal(ctx[0].cuentas[0].clave, undefined);
  const cred = contextoRelevante('dame la clave de Kevin', clientes);
  assert.equal(cred[0].cuentas[0].clave, 'secreta');
  assert.equal(contextoRelevante('¿cuántos clientes tengo por vendedor?', clientes).length, 3);
});
