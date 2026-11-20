// R198j · Cuenta vendida como CUENTA COMPLETA = 0 perfiles para vender en Web/APK/Bodega (marca de cliente o de cuenta).
// Datos FICTICIOS.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import hboPlanes from '../api/_hbo-planes.js';

const completa = { plataforma: 'hbomax', planHbo: 'platinum', capacidad: 5, modalidadVenta: 'cuenta_completa', exclusivaCompraId: 'k1', clientes: [{ nombre: 'Cliente A', compraId: 'k1' }] };

test('marca de la cuenta (modalidadVenta / exclusivaCompraId) = vendida completa; sin cliente vuelve a ser normal', () => {
  assert.equal(hboPlanes.vendidaCompleta(completa), true);
  assert.equal(hboPlanes.vendidaCompleta({ ...completa, clientes: [] }), false);
  assert.equal(hboPlanes.resumenCuenta(completa).libres, 0);
  assert.match(hboPlanes.etiquetaPlan(completa), /Platinum · cuenta completa/);
  assert.match(hboPlanes.validarAsignacion(completa, { plan: 'platinum', completa: false, compraId: 'k9' }), /vendida como cuenta completa/);
  assert.equal(hboPlanes.validarAsignacion(completa, { plan: 'platinum', completa: true, compraId: 'k1' }), '');
});

test('lib del bot es copia fiel (mismas reglas) y Web/Bodega/renovar usan la regla', () => {
  const app = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(app, /function invDisp\(c\)\{ return invCuentaCompleta\(c\)\?0:/);
  const inv = fs.readFileSync(new URL('../api/inventario.js', import.meta.url), 'utf8');
  assert.equal((inv.match(/hboPlanes\.vendidaCompleta\(/g) || []).length, 3);
  const ren = fs.readFileSync(new URL('../api/renovar.js', import.meta.url), 'utf8');
  assert.match(ren, /const disponibles = hboPlanes\.vendidaCompleta\(\{ \.\.\.data, clientes \}\) \? 0 :/);
});
