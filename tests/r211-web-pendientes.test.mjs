// R211 · Web: «Pago pendiente» visible en renovación/compra y pestaña Finanzas › Pendientes con pago masivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const R = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('formulario de pago: Con pago / Pago pendiente / Ajuste (o Socios); vendedor por su clave; nota del 50 %', () => {
  const s = R('sublichat-app.js');
  assert.match(s, /data-modo="pendiente" style="\$\{btn\(pend\)\}">🕒 Pago pendiente/);
  assert.match(s, /vendedorId:pagoOpClaveVend\(pago\)/); assert.match(s, /vendedorId:pagoOpClaveVend\(pagoOp\)/);
  assert.match(s, /Geisell · 50 % para Sublicuentas/);
  assert.match(s, /pend\?\(tipo==="compra"\?"Guardar compra con pago pendiente":"Renovar con pago pendiente"\)/);
});
test('Finanzas › Pendientes en la Web usa las mismas acciones del servidor y no duplica', () => {
  const f = R('finanzas-web.js'), p = R('pendientes-web.js'), i = R('index.html');
  assert.match(f, /\['pendientes', 'Pendientes', 'coins'\]/); assert.match(f, /SublichatPendientesWeb\.montar\(document\.getElementById\('fzPend'\), api\)/);
  for (const a of ["api('listar_pendientes'", "api('registrar_pago_masivo'", "api('listar_obligaciones_previa'", "api('finanzas_metodos')"]) assert.ok(p.includes(a), a);
  assert.match(p, /operationId: M2\.op/); assert.match(p, /no se duplica/); assert.match(p, /20000/);
  assert.match(i, /pendientes-web\.js\?v=20261128-r211/);
  assert.doesNotMatch(R('finanzas-web.css').split('R211')[1] || '', /gradient/);
});
