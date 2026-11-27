// R201 · Finanzas › cuentas madre: el próximo pago sale de la última compra (no lo tapa una fecha vieja anotada a mano),
// HBO Max usa la misma vista (Nuevo pago · Cómo se paga · Historial) y «Failed to fetch» ya no sale crudo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fc = require('../api/_finanzas-cuentas.js');
const cuenta = { id: 'c1', plataforma: 'paramount', correo: 'ufcbox@capuchino.lat', capacidad: 5, ocupados: 3 };

test('compra del 26/11 después de una fecha anotada el 24/11 → próximo pago 26/12 (no «vencido»)', () => {
  const cfg = { modalidad: 'tarjeta', moneda: 'HNL', frecuencia: 'mensual', proximoPago: '2026-11-24' };
  const f = fc.filaCuenta(cuenta, cfg, [{ id: 'l1', fecha: '2026-11-26', createdAt: '2026-11-26T15:00:00Z', costoTotalHnl: 51, moneda: 'HNL', duracionDias: 30 }], null, '2026-11-27');
  assert.equal(f.proximoPago, '2026-12-26'); assert.equal(f.vencido, false); assert.equal(f.ultimaCompra, '2026-11-26');
});
test('el «cubre hasta» que escribió el usuario en la compra manda', () => {
  const f = fc.filaCuenta(cuenta, { modalidad: 'tarjeta', moneda: 'HNL', frecuencia: 'mensual' }, [{ id: 'l1', fecha: '2026-11-26', vigenciaHasta: '2026-12-31', createdAt: '2026-11-26T15:00:00Z', costoTotalHnl: 51 }], null, '2026-11-27');
  assert.equal(f.proximoPago, '2026-12-31');
});
test('fecha anotada a mano DESPUÉS de la compra se respeta', () => {
  const cfg = { modalidad: 'tarjeta', moneda: 'HNL', frecuencia: 'mensual', proximoPago: '2026-12-10', proximoPagoAt: '2026-11-27T10:00:00Z' };
  const f = fc.filaCuenta(cuenta, cfg, [{ id: 'l1', fecha: '2026-11-26', createdAt: '2026-11-26T15:00:00Z', costoTotalHnl: 51 }], null, '2026-11-27');
  assert.equal(f.proximoPago, '2026-12-10');
});
test('pago adelantado: anotada 30/11 antes, compra 26/11 registrada después → manda la compra', () => {
  const cfg = { modalidad: 'tarjeta', moneda: 'HNL', frecuencia: 'mensual', proximoPago: '2026-11-30', proximoPagoAt: '2026-11-20T10:00:00Z' };
  const f = fc.filaCuenta(cuenta, cfg, [{ id: 'l1', fecha: '2026-11-26', createdAt: '2026-11-26T15:00:00Z', costoTotalHnl: 51 }], null, '2026-11-27');
  assert.equal(f.proximoPago, '2026-12-26');
});
test('sin compras: queda la fecha anotada; sin nada: vacío (nunca inventa)', () => {
  assert.equal(fc.filaCuenta(cuenta, { modalidad: 'tarjeta', moneda: 'HNL', frecuencia: 'mensual', proximoPago: '2026-11-30' }, [], null, '2026-11-27').proximoPago, '2026-11-30');
  assert.equal(fc.filaCuenta(cuenta, null, [], null, '2026-11-27').proximoPago, '');
});
test('web: HBO Max en la vista de cuentas madre, próximo pago editable en la compra y reintento ante «Failed to fetch»', () => {
  const web = fs.readFileSync(new URL('../finanzas-web.js', import.meta.url), 'utf8');
  assert.match(web, /CUENTAS_SUB = \{ pendientes: 'Cuentas por configurar', hbomax: 'HBO Max'/);
  assert.doesNotMatch(web, /registre la activación o el cargo desde su lista/);
  assert.match(web, /Próximo pago <small>\(cubre hasta · puede cambiarlo\)/);
  assert.match(web, /function sumarMeses/);
  assert.match(web, /for \(var intento = 0; intento < 3 && !r; intento\+\+\)/);
  assert.match(web, /data-fz-cta-retry/);
  const panel = fs.readFileSync(new URL('../api/_finanzas-panel.js', import.meta.url), 'utf8');
  assert.match(panel, /todos\("fin_hbo_cuentas"\)/); assert.match(panel, /proximoPagoAt: ahora/);
});
