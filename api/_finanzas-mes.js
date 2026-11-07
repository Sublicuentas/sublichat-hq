// R186 · Finanzas del MES CALENDARIO de Honduras (APK + Web + Excel con la misma consulta).
// · Ventana [01 del mes, 01 del mes siguiente) sobre la fecha REAL del pago (fechaPago civil, hora de Honduras).
// · Montos en centavos enteros (sin errores de coma flotante).
// · Un pago = una operación (operacionId): si entró por dos bancos son 2 renglones de banco pero 1 pago.
// · Anulados/corregidos y sus reversas no suman (igual que el Excel y el libro, R123/R125).
// · Las asignaciones por servicio explican el desglose; NUNCA se suman como otro ingreso.
import { movementYmd, movementKind, anuladoOReversa } from "./_finanzas-libro.js";

const cents = (v) => Math.round((Number(v) || 0) * 100);
const L = (c) => Math.round(c) / 100;

export function periodoHN(ahora = new Date(), periodo = "") {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(periodo || ""));
  let y, mes;
  if (m) { y = +m[1]; mes = +m[2]; }
  else { const t = new Date(ahora.getTime() - 6 * 3600000); y = t.getUTCFullYear(); mes = t.getUTCMonth() + 1; }
  const pad = (n) => String(n).padStart(2, "0");
  const fin = new Date(Date.UTC(y, mes, 0)).getUTCDate();
  return { periodo: `${y}-${pad(mes)}`, desde: `${y}-${pad(mes)}-01`, hasta: `${y}-${pad(mes)}-${pad(fin)}`, siguiente: mes === 12 ? `${y + 1}-01-01` : `${y}-${pad(mes + 1)}-01` };
}

export function resumenMes(movimientos = [], { desde, hasta }) {
  const delMes = movimientos.filter((m) => { const f = movementYmd(m); return f && f >= desde && f <= hasta; });
  const vigentes = delMes.filter((m) => !anuladoOReversa(m));
  const ingresos = vigentes.filter((m) => movementKind(m) === "ingreso");
  const egresos = vigentes.filter((m) => movementKind(m) === "egreso");
  const planilla = vigentes.filter((m) => movementKind(m) === "planilla");
  const ventas = vigentes.filter((m) => movementKind(m) === "venta");
  const pagos = new Map(); // operacionId → pago único
  for (const m of ingresos) {
    const k = String(m.operacionId || m.pagoId || m.id);
    const p = pagos.get(k) || { id: k, fecha: movementYmd(m), cliente: m.clienteNombre || m.cliente || "", plataforma: m.plataforma || "", centavos: 0, bancos: [], origen: m.origenCanal || m.origen || "" };
    p.centavos += cents(m.monto); p.bancos.push({ banco: m.banco || m.bancoId || "", centavos: cents(m.monto) });
    pagos.set(k, p);
  }
  const porPlataforma = new Map();
  let renovados = 0;
  for (const v of ventas) {
    const asig = Array.isArray(v.asignaciones) && v.asignaciones.length ? v.asignaciones : null;
    if (asig) { renovados += asig.length; for (const a of asig) porPlataforma.set(a.plataforma || "Sin plataforma", (porPlataforma.get(a.plataforma || "Sin plataforma") || 0) + Math.round(Number(a.montoCentavos) || 0)); }
    else { renovados += Array.isArray(v.servicios) && v.servicios.length ? v.servicios.length : 1; porPlataforma.set(v.plataforma || "Sin plataforma", (porPlataforma.get(v.plataforma || "Sin plataforma") || 0) + cents(v.monto)); }
  }
  // R192 · Ingresos COBRADOS por plataforma: cada pago único se cuenta UNA vez, en la plataforma de su renglón de cobro
  // (un pago de varios servicios queda como «Pago combinado»). La suma es exactamente «Ingresos cobrados».
  const cobrosPlat = new Map();
  for (const p of pagos.values()) {
    const pl = String(p.plataforma || "").trim(), k = !pl ? "Sin plataforma" : /\s\+\s/.test(pl) ? "Pago combinado (varios servicios)" : pl;
    cobrosPlat.set(k, (cobrosPlat.get(k) || 0) + p.centavos);
  }
  const sum = (arr) => arr.reduce((a, m) => a + cents(m.monto), 0);
  const ingresosC = sum(ingresos), pagosC = [...pagos.values()].reduce((a, p) => a + p.centavos, 0);
  return {
    desde, hasta,
    ingresos: L(ingresosC), ingresosCentavos: ingresosC, pagosUnicos: pagos.size, renglonesBanco: ingresos.length,
    egresos: L(sum(egresos)), planilla: L(sum(planilla)), resultado: L(ingresosC - sum(egresos) - sum(planilla)),
    ventasGeneradas: L(sum(ventas)), serviciosRenovadosOVendidos: renovados,
    cobrosPorPlataforma: [...cobrosPlat.entries()].map(([plataforma, c]) => ({ plataforma, monto: L(c), centavos: c })).sort((a, b) => b.centavos - a.centavos),
    porPlataforma: [...porPlataforma.entries()].map(([plataforma, c]) => ({ plataforma, monto: L(c), centavos: c })).sort((a, b) => b.centavos - a.centavos),
    anulados: delMes.filter((m) => anuladoOReversa(m)).length,
    conciliacion: { ingresosVsPagos: ingresosC === pagosC, diferenciaCentavos: ingresosC - pagosC },
    pagos: [...pagos.values()].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 500).map((p) => ({ ...p, monto: L(p.centavos) })),
  };
}

// Diagnóstico SOLO LECTURA de posibles cobros duplicados (no borra ni anula nada: propone revisión supervisada).
export function diagnosticarDuplicados(movimientos = []) {
  const ing = movimientos.filter((m) => movementKind(m) === "ingreso" && !anuladoOReversa(m));
  const grupos = new Map();
  for (const m of ing) {
    const cli = String(m.clienteId || m.clienteNombre || "").toLowerCase().trim();
    if (!cli) continue;
    const k = `${cli}|${cents(m.monto)}|${movementYmd(m)}`;
    const g = grupos.get(k) || []; g.push(m); grupos.set(k, g);
  }
  const sospechosos = [];
  for (const [k, g] of grupos) {
    const ops = new Set(g.map((m) => String(m.operacionId || m.id)));
    if (ops.size > 1) sospechosos.push({ clave: k, cliente: g[0].clienteNombre || g[0].clienteId || "", fecha: movementYmd(g[0]), monto: L(cents(g[0].monto)), veces: ops.size, ids: g.map((m) => m.id), operaciones: [...ops], origenes: [...new Set(g.map((m) => m.origenCanal || m.origen || ""))], propuesta: "Revisar: mismo cliente, mismo monto y mismo día en operaciones distintas. Si es duplicado, anular UNO con motivo (queda auditado)." });
  }
  return { revisados: ing.length, sospechosos: sospechosos.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))) };
}
