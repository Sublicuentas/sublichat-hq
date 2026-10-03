import test from "node:test";
import assert from "node:assert/strict";
import {
  cycleTotals, bankBalances, validatePlanilla, resolveBankId, movementKind, movementYmd, publicMethods, addDaysYmd,
} from "../lib/finanzas-libro.mjs";

const methods = publicMethods([
  { id: "bac-credomatic", nombre: "BAC Credomatic", logoKey: "bac", cuenta: "1", titular: "X", activo: true },
  { id: "ficohsa", nombre: "Ficohsa", logoKey: "ficohsa", activo: true },
  { id: "banco-atlantida", nombre: "Banco Atlántida", logoKey: "atlantida", activo: true },
  { id: "tigo-money", nombre: "Tigo Money", logoKey: "tigo", activo: true },
  { id: "davivienda", nombre: "Davivienda", logoKey: "davivienda", activo: false },
]);
const libro = { bases: {
  "bac-credomatic": { saldo: 4000, desde: "2026-10-01" }, ficohsa: { saldo: 1000, desde: "2026-10-01" },
  "banco-atlantida": { saldo: 600, desde: "2026-10-01" }, "tigo-money": { saldo: 400, desde: "2026-10-01" },
} };

test("métodos: solo activos y sin cuenta/titular", () => {
  assert.equal(methods.length, 4);
  assert.deepEqual(Object.keys(methods[0]).sort(), ["activo", "id", "logoKey", "nombre"]);
});

test("texto libre de banco (bot / movimientos viejos) se mapea al método configurado", () => {
  assert.equal(resolveBankId("BAC", methods), "bac-credomatic");
  assert.equal(resolveBankId("bac credomatic", methods), "bac-credomatic");
  assert.equal(resolveBankId("Atlántida", methods), "banco-atlantida");
  assert.equal(resolveBankId("tigo", methods), "tigo-money");
  assert.equal(resolveBankId("No especificado", methods), "sin_banco");
});

test("fecha del movimiento: fechaPago (API), dd/mm/yyyy (bot) y fechaTS", () => {
  assert.equal(movementYmd({ fechaPago: "2026-10-05" }), "2026-10-05");
  assert.equal(movementYmd({ fecha: "5/10/2026" }), "2026-10-05");
  assert.equal(movementYmd({ fechaTS: { toMillis: () => Date.UTC(2026, 9, 5, 12) } }), "2026-10-05");
});

test("Caso A/1: renovación de Juan L220 en BAC → ingreso una vez en Ingresos, Bancos y Resumen", () => {
  const movs = [{ tipo: "ingreso", subtipo: "cobro_renovacion", monto: 220, bancoId: "bac-credomatic", fechaPago: "2026-10-02" }];
  assert.equal(cycleTotals(movs, "2026-10-01").ingresos, 220);
  assert.equal(bankBalances(movs, libro, methods).bancos.find((b) => b.id === "bac-credomatic").saldo, 4220);
});

test("Caso 2: egreso operativo L500 desde Ficohsa reduce Ficohsa y Egresos, no Planilla", () => {
  const movs = [{ tipo: "egreso", monto: 500, banco: "Ficohsa", fecha: "03/10/2026" }];
  const t = cycleTotals(movs, "2026-10-01");
  assert.equal(t.egresosOperativos, 500); assert.equal(t.planilla, 0);
  assert.equal(bankBalances(movs, libro, methods).bancos.find((b) => b.id === "ficohsa").saldo, 500);
});

test("Caso B/3/4: Naara L2000 = BAC 1000 + Ficohsa 1000; la siguiente persona parte de esos saldos", () => {
  const before = bankBalances([], libro, methods);
  assert.equal(before.total, 6000);
  const v = validatePlanilla({ montoTotal: 2000, asignaciones: [{ bancoId: "bac-credomatic", monto: 1000 }, { bancoId: "ficohsa", monto: 1000 }], bancos: before.bancos });
  assert.equal(v.ok, true, v.errors.join(" "));
  assert.deepEqual(v.asignaciones.map((a) => [a.bancoId, a.saldoAntes, a.saldoDespues]), [["bac-credomatic", 4000, 3000], ["ficohsa", 1000, 0]]);
  // Al confirmar se crean 2 movimientos hijos (uno por banco) ligados al pago padre.
  const movs = v.asignaciones.map((a) => ({ tipo: "egreso", subtipo: "pago_planilla", planillaPagoId: "p1", bancoId: a.bancoId, monto: a.monto, fechaPago: "2026-10-04" }));
  const after = bankBalances(movs, libro, methods);
  assert.equal(after.total, 4000);
  assert.equal(after.bancos.find((b) => b.id === "bac-credomatic").saldo, 3000);
  assert.equal(after.bancos.find((b) => b.id === "ficohsa").saldo, 0);
  assert.equal(cycleTotals(movs, "2026-10-01").planilla, 2000);
  assert.equal(movementKind(movs[0]), "planilla");
});

test("Caso C: uso parcial de BAC es válido (no obliga a usar todo el banco)", () => {
  const { bancos } = bankBalances([], libro, methods);
  const v = validatePlanilla({ montoTotal: 2000, asignaciones: [{ bancoId: "bac-credomatic", monto: 1000 }, { bancoId: "banco-atlantida", monto: 600 }, { bancoId: "tigo-money", monto: 400 }], bancos });
  assert.equal(v.ok, true);
});

test("Caso D: banco insuficiente bloquea", () => {
  const { bancos } = bankBalances([], { bases: { ficohsa: { saldo: 500, desde: "2026-10-01" } } }, methods);
  const v = validatePlanilla({ montoTotal: 700, asignaciones: [{ bancoId: "ficohsa", monto: 700 }], bancos });
  assert.equal(v.ok, false);
  assert.match(v.errors.join(" "), /Saldo insuficiente en Ficohsa/);
});

test("Caso E: distribución incompleta / de más", () => {
  const { bancos } = bankBalances([], libro, methods);
  assert.match(validatePlanilla({ montoTotal: 2000, asignaciones: [{ bancoId: "bac-credomatic", monto: 1700 }], bancos }).errors.join(" "), /Faltan Lps\. 300 por asignar/);
  assert.match(validatePlanilla({ montoTotal: 2000, asignaciones: [{ bancoId: "bac-credomatic", monto: 2500 }], bancos }).errors.join(" "), /Ha asignado Lps\. 500 de más/);
});

test("no se puede pagar más que el disponible del ciclo", () => {
  const { bancos } = bankBalances([], libro, methods);
  const v = validatePlanilla({ montoTotal: 2000, asignaciones: [{ bancoId: "bac-credomatic", monto: 2000 }], bancos, disponibleCiclo: 1500 });
  assert.match(v.errors.join(" "), /supera el disponible del ciclo/);
});

test("Caso 5: ciclo 01–10 oct: ingresos 20000, egresos 12000, planilla 5500 → 8000 / 2500", () => {
  const movs = [
    { tipo: "ingreso", monto: 20000, fechaPago: "2026-10-03" },
    { tipo: "egreso", monto: 12000, fechaPago: "2026-10-05", banco: "BAC" },
    { tipo: "egreso", subtipo: "pago_planilla", monto: 5500, fechaPago: "2026-10-10" },
    { tipo: "ingreso", monto: 999, fechaPago: "2026-10-11" }, // fuera del ciclo
    { tipo: "saldo_inicial", monto: 4000, fechaPago: "2026-10-01" }, // no es ingreso
    { tipo: "ajuste_saldo", monto: -50, fechaPago: "2026-10-02", bancoId: "bac-credomatic" }, // no es ingreso ni egreso
  ];
  const t = cycleTotals(movs, "2026-10-01", "2026-10-10");
  assert.equal(t.ingresos, 20000); assert.equal(t.egresosOperativos, 12000);
  assert.equal(t.disponibleAntesPlanilla, 8000); assert.equal(t.planilla, 5500); assert.equal(t.resultado, 2500);
});

test("ajuste auditado mueve el saldo del banco con signo", () => {
  const movs = [{ tipo: "ajuste_saldo", monto: -150, bancoId: "tigo-money", fechaPago: "2026-10-02" }];
  assert.equal(bankBalances(movs, libro, methods).bancos.find((b) => b.id === "tigo-money").saldo, 250);
});

test("movimientos antes de la activación del banco no alteran su saldo; banco sin saldo inicial no cuenta", () => {
  const movs = [{ tipo: "ingreso", monto: 100, bancoId: "bac-credomatic", fechaPago: "2026-09-30" }];
  const r = bankBalances(movs, { bases: { "bac-credomatic": { saldo: 4000, desde: "2026-10-01" } } }, methods);
  assert.equal(r.bancos.find((b) => b.id === "bac-credomatic").saldo, 4000);
  assert.equal(r.bancos.find((b) => b.id === "ficohsa").activado, false);
  assert.equal(r.total, 4000);
});

test("cierre: el ciclo siguiente empieza al día siguiente", () => {
  assert.equal(addDaysYmd("2026-10-10", 1), "2026-10-11");
  assert.equal(addDaysYmd("2026-10-31", 1), "2026-11-01");
});
