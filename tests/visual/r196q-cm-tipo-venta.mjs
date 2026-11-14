// R196q · T05/T10/T12 en el navegador (datos FICTICIOS): Control Maestro distingue «CUENTA COMPLETA» de «PERFIL COMPARTIDO» por la
// modalidad GUARDADA en la compra (tipoVenta) y la marca de exclusividad de Bodega — nunca por «1 perfil ocupado».
// Uso: node tests/visual/r196q-cm-tipo-venta.mjs <carpeta> [antes]
import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict';
import { abrir } from './arnes.mjs';
const out = process.argv[2] || '/tmp/r196q'; const antes = process.argv[3] === 'antes'; const suf = antes ? '-antes' : ''; fs.mkdirSync(out, { recursive: true });
const h = await abrir({ usuario: 'sublicuentas', ui: 'v2', ancho: 1440, alto: 1500, datos: { clientes: 4, inventario: 0 } }); const pg = h.page;
await pg.route('**/api/inventario', (r) => r.fulfill({ json: { ok: true, items: [], cuentas: [], data: [] } }));
await pg.evaluate(() => {
  const orig = window.sublichatControlData; window.__v = 3000;
  const s = (i, correo, nombre, extra = {}) => ({ clienteId: 'cli-' + i, servicioIndex: 0, perfilIndex: 0, compraId: 'cmp-' + i, nombre, titular: nombre, telefono: '9999000' + i, plataforma: 'netflix', plataformaLabel: 'Netflix', correo, clave: 'x', fecha: '2026-12-20', precio: 300, ...extra });
  const inv = (id, correo, clientes, extra = {}) => ({ id, plataforma: 'netflix', correo, clave: 'x', capacidad: 5, disponibles: 5 - clientes.length, ocupados: clientes.length, estado: 'activa', clientes, ...extra });
  window.sublichatControlData = () => { const x = orig ? orig() : {}; return { ...x, ready: true, version: window.__v,
    servicios: [...(x.servicios || []),
      s(1, 'cuenta-completa@ejemplo.test', 'Ana Prueba', { tipoVenta: 'cuenta_completa', cuentaInventarioId: 'inv-cc' }),
      s(2, 'un-perfil@ejemplo.test', 'Beto Prueba'),
      s(3, 'compartida@ejemplo.test', 'Caro Prueba'), s(4, 'compartida@ejemplo.test', 'Dani Prueba', { precio: 150 }),
      s(5, 'rara@ejemplo.test', 'Eva Prueba', { tipoVenta: 'cuenta_completa' }), s(6, 'rara@ejemplo.test', 'Fer Prueba')],
    cuentas: [...(x.cuentas || []),
      inv('inv-cc', 'cuenta-completa@ejemplo.test', [{ nombre: 'Ana Prueba', clienteId: 'cli-1', compraId: 'cmp-1' }], { modalidadVenta: 'cuenta_completa', exclusivaCompraId: 'cmp-1', disponibles: 0 }),
      inv('inv-1p', 'un-perfil@ejemplo.test', [{ nombre: 'Beto Prueba', clienteId: 'cli-2', compraId: 'cmp-2' }]),
      inv('inv-sh', 'compartida@ejemplo.test', [{ nombre: 'Caro Prueba', clienteId: 'cli-3', compraId: 'cmp-3' }, { nombre: 'Dani Prueba', clienteId: 'cli-4', compraId: 'cmp-4' }]),
      inv('inv-rr', 'rara@ejemplo.test', [{ nombre: 'Eva Prueba', clienteId: 'cli-5', compraId: 'cmp-5' }, { nombre: 'Fer Prueba', clienteId: 'cli-6', compraId: 'cmp-6' }])] }; };
});
await pg.evaluate(() => window.subliRBAC ? window.subliRBAC.go('control-cuentas') : window.SublichatRBAC.ir('control-cuentas'));
await pg.waitForSelector('[data-cm-audit-platform="netflix"],[data-cm-open-workspace="netflix"],[data-cm-open-workspace="all"]', { timeout: 20000 });
const ws = await pg.$('[data-cm-open-workspace="netflix"]') || await pg.$('[data-cm-open-workspace="all"]'); await ws.click(); await pg.waitForTimeout(1200);
const plat = await pg.$('[data-cm-audit-platform="netflix"]'); if (plat) { await plat.click(); await pg.waitForTimeout(900); }
const filas = await pg.$$eval('.cm-account-list-row', (rs) => rs.map((r) => r.innerText.replace(/\s+/g, ' ')));
const fila = (c) => filas.find((t) => t.includes(c)) || '';
console.log(filas.filter((t) => /ejemplo\.test/.test(t)).join('\n'));
const lista = await pg.$('.cm-account-list') || await pg.$('#cmAccountResults');
await lista.screenshot({ path: path.join(out, `1-control-maestro-lista${suf}.png`) });
if (!antes) {
  assert.match(fila('cuenta-completa@'), /CUENTA COMPLETA/); assert.match(fila('cuenta-completa@'), /1 cliente · exclusiva/); assert.doesNotMatch(fila('cuenta-completa@'), /1\/5 perfiles/);
  assert.doesNotMatch(fila('un-perfil@'), /CUENTA COMPLETA/, 'NO INFERIR: 1 perfil ocupado no es cuenta completa'); assert.match(fila('un-perfil@'), /1\/5 perfiles/);
  assert.doesNotMatch(fila('compartida@'), /CUENTA COMPLETA|REVISAR/); assert.match(fila('compartida@'), /2\/5 perfiles/);
  assert.match(fila('rara@'), /REVISAR TIPO/);
  // detalle de la cuenta completa
  await pg.click(`[data-cm-select-account="netflix|cuenta-completa@ejemplo.test"]`); await pg.waitForTimeout(700);
  const det = await pg.$eval('.cm-account-detail', (e) => e.innerText);
  assert.match(det, /Cuenta completa · 1 cliente/); assert.match(det, /CUENTA COMPLETA \(exclusiva\)/); assert.match(det, /Ana Prueba/);
  await (await pg.$('.cm-account-detail')).screenshot({ path: path.join(out, '2-control-maestro-detalle-cuenta-completa.png') });
  await pg.click(`[data-cm-select-account="netflix|compartida@ejemplo.test"]`); await pg.waitForTimeout(700);
  assert.match(await pg.$eval('.cm-account-detail', (e) => e.innerText), /2\/5 perfiles · PERFIL COMPARTIDO/);
}
await h.cerrar();
console.log('T05/T10 ' + (antes ? '(antes)' : 'OK') + ' · errores página:', (h.errores || []).slice(0, 3).join(' | ') || 'ninguno'); process.exit(0);
