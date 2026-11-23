import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { rentabilidadCuentas, INICIO_CONTROL } from "../api/_finanzas-ganancias.js";
const hoy = "2026-11-23";
const cuenta = (id, fam, cls) => ({ id, _familia: fam, correo: id + "@x.test", capacidad: 4, clientes: cls });
function ctx(lotes) {
  return { lotes, cuentasPorId: new Map([["c1", cuenta("c1", "crunchyroll", [{ compraId: "v1", slot: 1 }, { compraId: "v2", slot: 2 }])], ["c2", cuenta("c2", "paramount", [{ compraId: "v3", slot: 1 }])]]),
    servPorCompra: new Map([["v1", { precio: 100, mesesContratados: 1, fechaRenovacion: "2026-12-05" }], ["v2", { precio: 100, mesesContratados: 1, fechaRenovacion: "2026-12-10" }], ["v3", { precio: 90, mesesContratados: 1, fechaRenovacion: "2026-12-01" }]]),
    clientePorId: new Map(), productosPorId: new Map([["p", {}]]), spotify: [] };
}
test("R200k · el control empieza el 01/10/2026", () => assert.equal(INICIO_CONTROL, "2026-10-01"));
test("R200k · compra anual de abril solo cuenta los días desde el 01/10 hasta donde pagaron los clientes; ingresos de marzo no entran", () => {
  const r = rentabilidadCuentas(ctx([{ _cuentaId: "c1", fecha: "2026-04-01", costoTotalHnl: 2400, duracionDias: 365, productoId: "p" }]), { hoy, altas: new Map([["v1", "2026-03-15"], ["v2", "2026-10-20"]]) });
  const f = r.filas.find((x) => x.cuentaId === "c1");
  assert.equal(f.costoPeriodoHnl, 460.27); // 2400 × 70/365 (01/10 → 10/12)
  assert.equal(f.perfiles[0].inicio, "2026-10-01");
  assert.deepEqual(f.perfiles.map((p) => p.mesesPagados), [2, 1]); assert.equal(f.estimadoDesdeCompraHnl, 300);
  assert.equal(r.desdeControl, "2026-10-01");
});
test("R200k · activación pagada antes de octubre no se vuelve a restar; la de octubre sí", () => {
  const a = rentabilidadCuentas(ctx([{ _cuentaId: "c2", fecha: "2026-05-10", costoTotalHnl: 300, productoId: "p" }]), { hoy }).filas.find((x) => x.cuentaId === "c2");
  assert.equal(a.costoPeriodoHnl, 0); assert.equal(a.activacionAntesDelControl, true);
  const b = rentabilidadCuentas(ctx([{ _cuentaId: "c2", fecha: "2026-10-12", costoTotalHnl: 300, productoId: "p" }]), { hoy }).filas.find((x) => x.cuentaId === "c2");
  assert.equal(b.costoPeriodoHnl, 300); assert.equal(b.gananciaDesdeCompraHnl, -210);
});
test("R200k · el panel no deja leer ganancias antes de octubre", () => {
  const s = fs.readFileSync(new URL("../api/_finanzas-panel.js", import.meta.url), "utf8");
  assert.match(s, /if \(desde < INICIO_CONTROL\) desde = INICIO_CONTROL/);
});
