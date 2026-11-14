// R196q · Control Maestro y CRM web: reconocimiento del tipo de venta (solo lectura). La regla sale de la modalidad GUARDADA en la
// compra (tipoVenta) + la marca de exclusividad de Bodega; nunca de «1 perfil ocupado». Datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const R = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const cm = R('control-maestro.js');
const src = cm.slice(cm.indexOf('  function accountSaleType(g){'), cm.indexOf('  function saleTypeTag(a)'));
const accountSaleType = new Function(`${src}; return accountSaleType;`)();
const sv = (compraId, extra = {}) => ({ compraId, clienteId: 'c-' + compraId, servicioIndex: 0, ...extra });
const inv = (clientes, extra = {}) => ({ inventoryAccounts: [{ clientes, ...extra }], invClients: clientes });

test('T05/T10 · CUENTA COMPLETA solo con la modalidad guardada; 1 perfil ocupado sigue siendo PERFIL COMPARTIDO', () => {
  assert.equal(accountSaleType({ services: [sv('a', { tipoVenta: 'cuenta_completa' })], ...inv([{ compraId: 'a' }], { modalidadVenta: 'cuenta_completa', exclusivaCompraId: 'a' }) }).code, 'cuenta_completa');
  assert.equal(accountSaleType({ services: [sv('a', { tipoVenta: 'cuenta_completa' })], ...inv([{ compraId: 'a' }]) }).code, 'cuenta_completa', 'ventas R118 sin marca de Bodega');
  assert.deepEqual(accountSaleType({ services: [sv('b')], ...inv([{ compraId: 'b' }]) }), { code: 'perfil', label: 'PERFIL COMPARTIDO' }, 'NO INFERIR por 1 perfil');
  assert.equal(accountSaleType({ services: [sv('b'), sv('c')], ...inv([{ compraId: 'b' }, { compraId: 'c' }]) }).code, 'perfil');
  // datos ambiguos → «Revisar tipo» (no se convierte nada)
  assert.equal(accountSaleType({ services: [sv('a', { tipoVenta: 'cuenta_completa' }), sv('b')], ...inv([{ compraId: 'a' }, { compraId: 'b' }]) }).code, 'revisar');
  assert.equal(accountSaleType({ services: [sv('b')], ...inv([{ compraId: 'b' }], { modalidadVenta: 'cuenta_completa', exclusivaCompraId: 'zzz' }) }).code, 'revisar');
  assert.equal(accountSaleType({ services: [sv('a', { tipoVenta: 'cuenta_completa' }), sv('d', { tipoVenta: 'cuenta_completa' })], ...inv([]) }).code, 'revisar');
  assert.equal(accountSaleType({ services: [sv('a', { tipoVenta: 'cuenta_completa' })], ...inv([{ compraId: 'a' }, { nombre: 'Legado sin compra' }]) }).code, 'revisar');
});

test('T05 · Control Maestro solo muestra (sin formularios ni botones nuevos) y la etiqueta reemplaza «1/5 perfiles» en la cuenta completa', () => {
  assert.match(cm, /saleType:accountSaleType\(g\)/);
  assert.match(cm, /<small>\$\{a\.saleType&&a\.saleType\.code==='cuenta_completa'\?'1 cliente · exclusiva':`\$\{esc\(String\(\(a\.roster\|\|\[\]\)\.length\)\)\}\/\$\{esc\(String\(a\.capacity\|\|0\)\)\} perfiles`\}<\/small>/);
  assert.match(cm, /'CUENTA COMPLETA \(exclusiva\)'/); assert.match(cm, /perfiles · PERFIL COMPARTIDO/);
  const nuevo = cm.slice(cm.indexOf('  // R196q · Tipo de venta'), cm.indexOf('  function buildAccountAudit('));
  assert.doesNotMatch(nuevo, /<button|<input|<form|data-cm-|api\(/, 'solo reconocimiento');
  assert.doesNotMatch(R('control-maestro.css').split('R196q')[1] || '', /gradient/);
});

test('T04/T12 · CRM web lee la misma compra: «Cuenta completa» en vez de «1 perfil»; Control Maestro recibe tipoVenta y la marca de Bodega', () => {
  const app = R('sublichat-app.js');
  assert.match(app, /tipoVenta:String\(s\.tipoVenta\|\|""\)==="cuenta_completa"\|\|\/\^viki\/i\.test\(String\(s\[F\.s_plataforma\]\|\|""\)\)\?"cuenta_completa":String\(s\.tipoVenta\|\|""\),categoria:String\(s\.categoria\|\|""\),cuentaInventarioId:String\(s\.cuentaInventarioId\|\|""\)/);
  assert.match(app, /tipoVenta:c\.tipoVenta\|\|'',cuentaInventarioId:c\.cuentaInventarioId\|\|'', \/\/ R196q/);
  assert.match(app, /modalidadVenta:c\.modalidadVenta\|\|'',exclusivaCompraId:c\.exclusivaCompraId\|\|''/);
  assert.match(app, /\$\{s\.tipoVenta==="cuenta_completa"\?"<b>Cuenta completa<\/b>":`\$\{Number\(s\.cantidadPerfiles\)\|\|1\} perfil/);
  assert.match(R('index.html'), /control-maestro\.js\?v=20261114-r196q/); assert.match(R('index.html'), /sublichat-app\.js\?v=20261114-r196q/);
});
