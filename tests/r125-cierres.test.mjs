import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cycleTotals, bankBalances, publicMethods, anuladoOReversa } from '../api/_finanzas-libro.js';

const dia = [
  { tipo: 'ingreso', monto: 6269, fechaPago: '2026-10-01', bancoId: 'bac' },
  { tipo: 'ingreso', monto: 270, fechaPago: '2026-10-01', bancoId: 'bac', estadoFinanciero: 'anulado' },
  { tipo: 'egreso', monto: 224, fechaPago: '2026-10-01', bancoId: 'bac' },
];
const reversa = { tipo: 'ingreso', monto: -270, fechaPago: '2026-10-07', bancoId: 'bac', reversaDe: 'x' };

test('R125: el cierre del 01/10 ya no suma el voucher anulado (antes L270 de más hasta incluir el día de la anulación)', () => {
  assert.equal(cycleTotals(dia, '2026-10-01', '2026-10-01').ingresos, 6269);
  assert.equal(cycleTotals([...dia, reversa], '2026-10-01', '2026-10-07').ingresos, 6269);
  assert.equal(cycleTotals([...dia, reversa], '2026-10-07', '2026-10-07').ingresos, 0, 'la reversa ya no resta el día que se anuló');
  assert.equal(anuladoOReversa({ estadoFinanciero: 'corregido' }), true);
  assert.equal(anuladoOReversa({ tipo: 'ingreso' }), false);
});

test('R125: saldo de bancos igual que antes (anulado + reversa se cancelaban); ingresos del banco sin inflar', () => {
  const methods = publicMethods([{ id: 'bac', nombre: 'BAC', logoKey: 'bac' }]);
  const b = bankBalances([...dia, reversa], { bases: {} }, methods).bancos.find((x) => x.id === 'bac');
  assert.equal(b.saldo, 6269 - 224); assert.equal(b.ingresos, 6269);
});

test('R125 web: Control financiero filtra anulados, reversas, transferencias, saldos/ajustes y copias viejas desde el 01/10', () => {
  const app = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  const src = ['finYmdR125', 'finVigenteR125'].map((n) => { const i = app.indexOf(`function ${n}(`); let d = 0; const j = app.indexOf('{', app.indexOf(')', i)); for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}') { d--; if (!d) return app.slice(i, k + 1); } } }).join('\n');
  const vig = new Function(`${src}; return finVigenteR125;`)();
  assert.equal(vig({ tipo: 'ingreso', monto: 100, fecha: '01/10/2026' }), true);
  assert.equal(vig({ tipo: 'ingreso', estadoFinanciero: 'anulado' }), false);
  assert.equal(vig({ tipo: 'ingreso', reversaDe: 'x' }), false);
  assert.equal(vig({ tipo: 'transferencia' }), false);
  assert.equal(vig({ tipo: 'ajuste_saldo', subtipo: 'ajuste_saldo' }), false);
  assert.equal(vig({ tipo: 'ingreso', _source: 'finanzas', fecha: '01/10/2026' }), false);
  assert.equal(vig({ tipo: 'ingreso', _source: 'finanzas', fecha: '30/09/2026' }), true, 'el histórico anterior sigue');
  assert.match(app, /FINANZAS=\[\.\.\.finPorId\.values\(\)\]\.filter\(finVigenteR125\);/);
});
