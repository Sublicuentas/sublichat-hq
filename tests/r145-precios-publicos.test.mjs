import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { armarListaPublica, normalizarBorrador, firmaBorrador, categoriaLimpia } from '../api/_precios-publicos-lib.js';
const docs = [
  { id: 'n1', categoria: '📺 Streaming', nombre: 'Netflix', precio: 110, detalle: 'interno', stockCantidad: 5, categoriaOrden: 1, orden: 1, activo: true },
  { id: 'd1', categoria: '📺 Streaming', nombre: 'Disney+', precio: 80, categoriaOrden: 1, orden: 2, activo: true },
  { id: 'x1', categoria: '💻 Productividad', nombre: 'Oculto', precio: 20, activo: true },
  { id: 'a1', categoria: '📺 Streaming', nombre: 'Apagado en socios', precio: 50, activo: false },
];
const estado = { items: { n1: { publico: true }, d1: { publico: true, usarPrecioSocio: false, precioMostrado: 100 }, x1: { publico: false }, a1: { publico: true } }, contacto: { destino: '9999-8888' }, publicadoEn: 1000 };
test('R145: solo productos autorizados, precio socio como fuente y excepción sin tocar el precio real', () => {
  const l = armarListaPublica(docs, estado);
  assert.equal(l.total, 2);
  const [n, d] = l.categorias[0].productos;
  assert.equal(n.precio, 110); assert.equal(d.precio, 100);
  assert.equal(docs[1].precio, 80, 'el precio socio no cambia');
  assert.equal(l.contacto.enlace.startsWith('https://wa.me/50499998888'), true);
  const json = JSON.stringify(l);
  for (const k of ['detalle', 'stockCantidad', 'interno', 'costo', 'proveedor']) assert.equal(json.includes(k), false, k);
});
test('R145: la fecha solo cambia con un cambio real (firma estable) y categorías limpias', () => {
  assert.equal(firmaBorrador(estado), firmaBorrador(JSON.parse(JSON.stringify(estado))));
  assert.notEqual(firmaBorrador(estado), firmaBorrador({ ...estado, items: { ...estado.items, n1: { publico: true, texto: 'x' } } }));
  assert.equal(categoriaLimpia('💻 Productividad'), 'Herramientas');
  assert.deepEqual(Object.keys(normalizarBorrador({ items: { n1: {}, malo: {} } }, new Set(['n1'])).items), ['n1']);
});
test('R145: rutas públicas, admin dentro de Socios y sin login en la página', () => {
  const v = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url)));
  assert.ok(v.rewrites.some((r) => r.source === '/precios-mayoristas' && r.destination === '/precios-revendedores.html'));
  const a = fs.readFileSync(new URL('../revendedores-admin.js', import.meta.url), 'utf8');
  assert.match(a, /data-rtab="publico">🏷️ Precios para Revendedores/);
  const api = fs.readFileSync(new URL('../api/precios-publicos.js', import.meta.url), 'utf8');
  assert.doesNotMatch(api, /verifyIdToken/);
});
