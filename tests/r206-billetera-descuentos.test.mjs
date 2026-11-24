// R206 · Sublichat › Revendedores › Billetera: descuentos por pagar con saldo y pedidos pagados con billetera.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const s = fs.readFileSync(new URL('../revendedores-admin.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
test('pestaña Descuentos: 5% parejo sin costos; % y activo por producto', () => {
  assert.match(s, /Descuentos por pagar con saldo/);
  for (const k of ['pct', 'activo']) assert.match(s, new RegExp(`data-k="${k}"`));
  assert.match(s, /billetera\/descuentos\/config/);
  assert.match(s, /billetera\/descuentos\/producto\//);
  assert.match(s, /El descuento máximo es de 0% a 5%/);
  assert.match(s, /Los precios del catálogo no se tocan/);
  assert.doesNotMatch(s, /data-bd=[^>]*data-k="costoHnl"/, 'ya no se piden costos');
  assert.match(s, /No necesita registrar costos/);
});
test('pedido pagado con billetera se distingue y cancelar informa la devolución sin duplicar', () => {
  assert.match(s, /Pagado con saldo de billetera/);
  assert.match(s, /devolucionBilletera/);
  assert.match(s, /ya se había devuelto antes \(no se duplica\)/);
});
test('caché del script renovada', () => { assert.match(html, /revendedores-admin\.js\?v=20261124-r213?/); });
