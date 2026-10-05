import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
test('R106 web: renovación y compra nueva piden el pago real (solo Sublicuentas/Relojes)', () => {
  assert.match(app, /function pagoOpHabilitado\(\)\{return \[[^\]]*"sublicuentas"[^\]]*"relojes"[^\]]*\]/); // lista ampliada (sublicuentas2, daniela, finanzas)
  assert.match(app, /pagoOp=await pedirPagoOperacion\(\{tipo:"renovacion"/, 'renovarServicio');
  assert.match(app, /pagoOp=await pedirPagoOperacion\(\{tipo:'renovacion'/, 'botón Pagado de la agenda');
  assert.match(app, /pagoOp=await pedirPagoOperacion\(\{tipo:"compra"/, 'compra nueva en la ficha');
  assert.match(app, /accion:"registrar_operacion_pago"/);
  assert.match(app, /ajusteAdministrativo:true,motivoAjuste:pagoOp\.motivo/);
  assert.doesNotMatch(app.slice(app.indexOf('async function pedirPagoOperacion'), app.indexOf('function pagoOpNuevoId')), /c\.precio|precioCatalogo/, 'nunca precarga el precio');
});
test('R106 web: añadir perfil a compra existente pide pago', () => {
  assert.match(app, /const perfilesNuevos=esCompraNueva\?0:Math\.max\(0,\(payload\.servicio\.perfiles\|\|\[\]\)\.length-fichaPerfilesOriginalesActual\)/);
  assert.match(app, /if\(\(esCompraNueva\|\|perfilesNuevos>0\)&&pagoOpHabilitado\(\)\)/);
});

test('R110 web: "¿Qué día entró el dinero?" en la ventana de pago y fechaPago en el envío', () => {
  assert.match(app, /📅 ¿Qué día entró el dinero\?/);
  assert.match(app, /fechaPago:pago\.fechaPago\|\|pagoOpHoy\(\)/);
});
