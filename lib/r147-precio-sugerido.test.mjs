import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { armarListaPublica, normalizarBorrador, firmaBorrador } from '../api/_precios-publicos-lib.js';
const docs = [{ id: 'n1', categoria: '📺 Streaming', nombre: 'Netflix Premium', precio: 130, activo: true }, { id: 'd1', categoria: '📺 Streaming', nombre: 'Disney', precio: 80, activo: true }];
test('R147: precio sugerido y ganancia sugerida = sugerido − precio revendedor; no toca el precio socio', () => {
  const l = armarListaPublica(docs, { items: { n1: { publico: true, precioSugerido: 150 }, d1: { publico: true } }, publicadoEn: 1 });
  const ps = l.categorias[0].productos, n = ps.find((p) => p.id === 'n1'), d = ps.find((p) => p.id === 'd1');
  assert.equal(n.precio, 130); assert.equal(n.precioSugerido, 150); assert.equal(n.gananciaSugerida, 20);
  assert.equal(d.precioSugerido, null); assert.equal(d.gananciaSugerida, null);
  assert.equal(docs[0].precio, 130);
});
test('R147: compra mínima mensual editable, se puede ocultar y cuenta como cambio real', () => {
  const base = { items: { n1: { publico: true } } };
  assert.equal(armarListaPublica(docs, { ...base, condiciones: { minimoMensual: 10, mostrar: true } }).condiciones.minimoMensual, 10);
  assert.equal(armarListaPublica(docs, { ...base, condiciones: { minimoMensual: 10, mostrar: false } }).condiciones, null);
  assert.notEqual(firmaBorrador({ ...base, condiciones: { minimoMensual: 5 } }), firmaBorrador({ ...base, condiciones: { minimoMensual: 10 } }));
  assert.equal(normalizarBorrador({}).condiciones.minimoMensual, 5, 'valor inicial, editable');
  const page = fs.readFileSync(new URL('../precios-revendedores.html', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /mínima mensual: <strong>5/);
  assert.match(page, /Precio sugerido de venta/);
});
