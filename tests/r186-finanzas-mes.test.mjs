// R186 · Finanzas del mes calendario de Honduras: un pago real = un ingreso; desglose por asignaciones; conciliación exacta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { periodoHN, resumenMes, diagnosticarDuplicados } from '../api/_finanzas-mes.js';

const mov = (id, tipo, monto, fechaPago, extra = {}) => ({ id, tipo, monto, fechaPago, fecha: fechaPago.split('-').reverse().join('/'), ...extra });

test('mes de Honduras: 23:30 del 30/11 en Honduras sigue siendo noviembre; diciembre empieza el 01 local', () => {
  assert.equal(periodoHN(new Date('2026-12-01T05:30:00Z')).periodo, '2026-11');
  assert.equal(periodoHN(new Date('2026-12-01T06:00:00Z')).periodo, '2026-12');
  assert.deepEqual(periodoHN(new Date(), '2026-02'), { periodo: '2026-02', desde: '2026-02-01', hasta: '2026-02-28', siguiente: '2026-03-01' });
  assert.equal(periodoHN(new Date(), '2026-12').siguiente, '2027-01-01');
});

test('F01/F03: solo el mes; TX-1001 = L350 una vez con 3 asignaciones; anulados fuera; centavos exactos', () => {
  const movs = [
    mov('oper_op_u_TX1001_venta', 'venta', 350, '2026-11-07', { operacionId: 'oper_op_u_TX1001', asignaciones: [{ plataforma: 'Netflix', montoCentavos: 15000 }, { plataforma: 'Disney+', montoCentavos: 11000 }, { plataforma: 'Prime', montoCentavos: 9000 }] }),
    mov('oper_op_u_TX1001_cobro', 'ingreso', 350, '2026-11-07', { operacionId: 'oper_op_u_TX1001', clienteNombre: 'Ana López', banco: 'BAC' }),
    mov('oct', 'ingreso', 999, '2026-10-31', { operacionId: 'oct' }), // mes anterior: no se arrastra
    mov('anu', 'ingreso', 500, '2026-11-03', { operacionId: 'anu', estadoFinanciero: 'anulado' }),
    mov('anu_rev', 'ingreso', -500, '2026-11-03', { reversaDe: 'anu' }),
    mov('div_cobro', 'ingreso', 100.1, '2026-11-05', { operacionId: 'div' }), mov('div_cobro_2', 'ingreso', 0.2, '2026-11-05', { operacionId: 'div' }), // un pago en 2 bancos
  ];
  const r = resumenMes(movs, periodoHN(new Date(), '2026-11'));
  assert.equal(r.ingresosCentavos, 45030); assert.equal(r.ingresos, 450.3); // 350 + (100.10 + 0.20), sin el 999 de octubre ni el anulado
  assert.equal(r.pagosUnicos, 2, 'TX-1001 y el pago dividido: 2 pagos reales'); assert.equal(r.renglonesBanco, 3);
  assert.equal(r.serviciosRenovadosOVendidos, 3);
  assert.deepEqual(r.porPlataforma.map((p) => [p.plataforma, p.monto]), [['Netflix Premium', 150], ['Disney Premium', 110], ['Prime Video', 90]]); // R193: nombres canónicos
  assert.equal(r.porPlataforma.reduce((a, p) => a + p.centavos, 0), 35000, 'el desglose cuadra con el pago, no se suma 3 veces');
  assert.equal(r.anulados, 2); assert.equal(r.conciliacion.ingresosVsPagos, true);
});

test('diagnóstico de duplicados: lista sospechosos (mismo cliente, monto y día en operaciones distintas) sin tocar nada', () => {
  const movs = [
    mov('a_cobro', 'ingreso', 150, '2026-11-02', { operacionId: 'a', clienteId: 'ana', origenCanal: 'android' }),
    mov('b_cobro', 'ingreso', 150, '2026-11-02', { operacionId: 'b', clienteId: 'ana', origenCanal: 'telegram' }),
    mov('c_cobro', 'ingreso', 150, '2026-11-02', { operacionId: 'c', clienteId: 'luis' }),
    mov('d_cobro', 'ingreso', 75, '2026-11-02', { operacionId: 'd', clienteId: 'ana', estadoFinanciero: 'anulado' }),
  ];
  const copia = JSON.stringify(movs);
  const d = diagnosticarDuplicados(movs);
  assert.equal(d.sospechosos.length, 1); assert.equal(d.sospechosos[0].veces, 2); assert.deepEqual(d.sospechosos[0].origenes.sort(), ['android', 'telegram']);
  assert.equal(JSON.stringify(movs), copia, 'solo lectura');
});

test('cableado: acciones finanzas_mes y diagnostico_duplicados solo dentro del libro (Sublicuentas/Relojes)', () => {
  const src = fs.readFileSync(new URL('../api/finanzas.js', import.meta.url), 'utf8');
  assert.match(src, /if \(accion === "finanzas_mes"\)/); assert.match(src, /\["finanzas_mes", "diagnostico_duplicados"\]\.includes\(accion\)/);
});
