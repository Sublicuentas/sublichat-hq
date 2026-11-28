// R211 · Geisell 50 % al nacer la deuda (misma regla en servidor, renovación atómica y bot). Datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import reglaVend from '../api/_regla-vendedor.js';
import { planPago, previaGeisell } from '../api/_obligaciones.js';
const { obligacionVendedor, reglaDe, camposRegla } = reglaVend;

test('L150 → deuda L75; abono L50 → L25; pago L25 → L0 (los abonos no se vuelven a dividir)', () => {
  const o = obligacionVendedor({ deudorTipo: 'vendedor', vendedorNombre: 'Geisell', saldo: 150 });
  assert.equal(o.obligacion, 75); assert.equal(o.regla.retenidoVendedor, 75); assert.equal(o.regla.clave, 'geisell');
  const c = { id: 'g', deudorTipo: 'vendedor', deudorNombre: 'Geisell', saldoPendiente: o.obligacion, estado: 'pendiente', createdAt: '2026-11-28T10:00:00Z', ...camposRegla(o) };
  const a = planPago([c], 50).detalle[0]; assert.equal(a.aplica, 50); assert.equal(a.queda, 25);
  const b = planPago([{ ...c, saldoPendiente: 25 }], 25).detalle[0]; assert.equal(b.queda, 0); assert.equal(b.estado, 'pagado');
});

test('identifica por la clave estable del registro (alias geissel, mayúsculas, tildes); otros vendedores y clientes no cambian', () => {
  for (const n of ['geisell', 'GEISSEL', ' Geisél ']) assert.ok(reglaDe('vendedor', '', n), n);
  assert.ok(reglaDe('vendedor', 'geisell', 'Otro nombre escrito'));
  assert.equal(reglaDe('cliente', '', 'Geisell'), null, 'si la deudora es la clienta no aplica');
  for (const n of ['Heber', 'Relojes', 'Sublicuentas', 'Geisellita']) assert.equal(obligacionVendedor({ deudorTipo: 'vendedor', vendedorNombre: n, saldo: 150 }).obligacion, 150, n);
  assert.deepEqual(camposRegla(obligacionVendedor({ deudorTipo: 'vendedor', vendedorNombre: 'Heber', saldo: 150 })), {});
  assert.equal(obligacionVendedor({ deudorTipo: 'vendedor', vendedorNombre: 'Geisell', saldo: 0.01 }).obligacion, 0.01);
});

test('vista previa: deuda nueva con regla ya es neta (L75 no se vuelve a dividir); deuda vieja bruta se propone al 50 %', () => {
  const nueva = { id: 'n', deudorTipo: 'vendedor', deudorNombre: 'Geisell', montoTotalOperacion: 150, montoRecibidoInicial: 0, montoOriginalPendiente: 75, montoRecibidoPosterior: 50, saldoPendiente: 25, estado: 'parcial', ...camposRegla(obligacionVendedor({ deudorTipo: 'vendedor', vendedorNombre: 'Geisell', saldo: 150 })) };
  const vieja = { id: 'v', deudorTipo: 'vendedor', deudorNombre: 'Geissel', montoTotalOperacion: 1000, montoRecibidoInicial: 0, montoOriginalPendiente: 1000, montoRecibidoPosterior: 300, saldoPendiente: 700, estado: 'parcial' };
  const p = previaGeisell([nueva, vieja]);
  const n = p.filas.find((f) => f.cuentaId === 'n'), v = p.filas.find((f) => f.cuentaId === 'v');
  assert.equal(n.yaNeto, true); assert.equal(n.obligacion, 75); assert.equal(n.saldoPropuesto, 25); assert.equal(n.diferencia, 0);
  assert.equal(v.obligacion, 500); assert.equal(v.saldoPropuesto, 200); assert.equal(p.porAjustar, 1);
});

test('los 3 lugares que crean la deuda usan la MISMA regla y el bot tiene copia fiel', () => {
  const R = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  for (const f of ['api/finanzas.js', 'api/_finanzas-operacion.js']) {
    const s = R(f); assert.match(s, /reglaVend\.obligacionVendedor\(/, f);
    assert.match(s, /montoOriginalPendiente: deuda, montoRecibidoPosterior: 0, saldoPendiente: deuda, \.\.\.reglaVend\.camposRegla\(oblV\)/, f);
    assert.match(s, /saldoPendiente: deuda, estadoPago: ep\.estado/, f);
  }
  const bot = new URL('../../bot-gh/lib_regla_vendedor.js', import.meta.url);
  if (fs.existsSync(bot)) assert.equal(fs.readFileSync(bot, 'utf8').split('\n').slice(1).join('\n'), R('api/_regla-vendedor.js').split('\n').slice(1).join('\n'));
});
