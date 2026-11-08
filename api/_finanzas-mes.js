// R186 · Finanzas del MES CALENDARIO de Honduras (APK + Web + Excel con la misma consulta).
// · Ventana [01 del mes, 01 del mes siguiente) sobre la fecha REAL del pago (fechaPago civil, hora de Honduras).
// · Montos en centavos enteros (sin errores de coma flotante).
// · Un pago = una operación (operacionId): si entró por dos bancos son 2 renglones de banco pero 1 pago.
// · Anulados/corregidos y sus reversas no suman (igual que el Excel y el libro, R123/R125).
// · Las asignaciones por servicio explican el desglose; NUNCA se suman como otro ingreso.
import { movementYmd, movementKind, anuladoOReversa } from "./_finanzas-libro.js";
import { resolverProducto, esCombinado, partesCombinado, PENDIENTE, PENDIENTE_NOMBRE, PRODUCTOS } from "./_productos-canonicos.js";

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

// R193 · Atribución de UN pago real a productos canónicos (APK = Web = Excel). Invariante en centavos:
//   suma(productos) + pendiente de clasificar === ingresos cobrados.  Nunca se inventa un reparto:
//   · asignaciones guardadas (montos por servicio) → se usan tal cual; si suman menos, la diferencia queda pendiente;
//   · un solo producto (aunque sean varios servicios de él) → todo el pago a ese producto;
//   · varios productos sin montos por servicio → «Pago combinado sin desglose» = pendiente de clasificar.
//   · etiqueta ambigua («Netflix Premium VIP») → la ficha del servicio (compraId) o un alias confirmado; si no, pendiente.
function resolverConEvidencia(raw, compraId, clienteId, ctx) {
  const r = resolverProducto(raw, ctx.confirmados);
  if (r.ambiguo && compraId && typeof ctx.evidencia === "function") {
    const key = ctx.evidencia(clienteId, compraId);
    if (key) { const e = resolverProducto(key, {}); if (!e.ambiguo && e.id !== PENDIENTE) return { ...e, original: r.original, motivo: "ficha_servicio" }; }
  }
  return r;
}
export function atribuirPago(p, filas = [], venta = null, ctx = {}) {
  const total = p.centavos;
  const cli = filas[0]?.clienteId || venta?.clienteId || "";
  const pend = (motivo, original, c = total) => [{ id: PENDIENTE, nombre: PENDIENTE_NOMBRE, centavos: c, motivo, original }];
  const desde = [...filas, venta].filter(Boolean);
  const asig = (desde.find((m) => Array.isArray(m.asignaciones) && m.asignaciones.length) || {}).asignaciones;
  if (asig) {
    const lineas = asig.map((a) => ({ ...resolverConEvidencia(a.plataforma, a.compraId, cli, ctx), centavos: Math.round(Number(a.montoCentavos) || 0) }));
    const suma = lineas.reduce((x, l) => x + l.centavos, 0);
    const prods = [...new Set(lineas.map((l) => l.id))];
    if (suma === total) return lineas;
    if (suma < total) return [...lineas, ...pend("diferencia_sin_asignar", "asignaciones", total - suma)];
    if (prods.length === 1) return [{ ...lineas[0], centavos: total }]; // abono parcial de un solo producto
    return pend("pago_parcial_varios_servicios", lineas.map((l) => l.original).join(" + "));
  }
  const servicios = (desde.find((m) => Array.isArray(m.servicios) && m.servicios.length) || {}).servicios;
  if (servicios) {
    const lineas = servicios.map((x) => ({ ...resolverConEvidencia(x.plataforma, x.compraId, cli, ctx), montoC: Math.round((Number(x.monto ?? x.precio) || 0) * 100) }));
    const prods = [...new Set(lineas.map((l) => l.id))];
    if (prods.length === 1) return [{ ...lineas[0], centavos: total }];
    if (lineas.every((l) => l.montoC > 0) && lineas.reduce((x, l) => x + l.montoC, 0) === total) return lineas.map((l) => ({ ...l, centavos: l.montoC }));
    return pend("pago_combinado_sin_desglose", lineas.map((l) => l.original).join(" + "));
  }
  const raw = p.plataforma || venta?.plataforma || "";
  const compraId = filas[0]?.compraId || venta?.compraId || "";
  if (esCombinado(raw)) {
    const lineas = partesCombinado(raw).map((x) => resolverConEvidencia(x, "", cli, ctx));
    const prods = [...new Set(lineas.map((l) => l.id))];
    if (prods.length === 1 && prods[0] !== PENDIENTE) return [{ ...lineas[0], original: raw, centavos: total }];
    return pend("pago_combinado_sin_desglose", raw);
  }
  return [{ ...resolverConEvidencia(raw, compraId, cli, ctx), centavos: total }];
}
// Pagos con etiqueta ambigua que pueden resolverse con la ficha (clienteId + compraId): el servidor los busca.
export function evidenciaNecesaria(movimientos = []) {
  const out = new Map();
  for (const m of movimientos) {
    if (movementKind(m) !== "ingreso" && movementKind(m) !== "venta") continue;
    const cli = m.clienteId || "";
    const items = Array.isArray(m.asignaciones) && m.asignaciones.length ? m.asignaciones : Array.isArray(m.servicios) && m.servicios.length ? m.servicios : [{ plataforma: m.plataforma, compraId: m.compraId }];
    for (const x of items) if (cli && x.compraId && resolverProducto(x.plataforma).ambiguo) out.set(`${cli}|${x.compraId}`, { clienteId: cli, compraId: x.compraId });
  }
  return [...out.values()].slice(0, 400);
}

export function resumenMes(movimientos = [], { desde, hasta }, ctx = {}) {
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
    const nom = (raw) => { const r = resolverProducto(raw, ctx.confirmados); return r.id === PENDIENTE ? (esCombinado(raw) ? "Venta combinada sin desglose" : PENDIENTE_NOMBRE) : r.nombre; }; // R193: mismo catálogo canónico
    if (asig) { renovados += asig.length; for (const a of asig) porPlataforma.set(nom(a.plataforma), (porPlataforma.get(nom(a.plataforma)) || 0) + Math.round(Number(a.montoCentavos) || 0)); }
    else { renovados += Array.isArray(v.servicios) && v.servicios.length ? v.servicios.length : 1; porPlataforma.set(nom(v.plataforma), (porPlataforma.get(nom(v.plataforma)) || 0) + cents(v.monto)); }
  }
  // R193 · Ingresos COBRADOS por PRODUCTO canónico (reemplaza la agrupación por etiqueta de R192).
  const ventaDeOp = new Map(); for (const v of ventas) { const k = String(v.operacionId || ""); if (k && !ventaDeOp.has(k)) ventaDeOp.set(k, v); }
  const filasDe = new Map(); for (const m of ingresos) { const k = String(m.operacionId || m.pagoId || m.id); (filasDe.get(k) || filasDe.set(k, []).get(k)).push(m); }
  const prod = new Map(), alias = new Map(), pendDet = []; let pendC = 0, pendPagos = 0;
  for (const p of pagos.values()) {
    const lineas = atribuirPago(p, filasDe.get(p.id) || [], ventaDeOp.get(p.id) || null, ctx);
    let tienePend = false;
    for (const l of lineas) {
      const ka = `${l.original}|${l.id}|${l.motivo}`; const al = alias.get(ka) || { original: l.original, productoId: l.id, producto: l.nombre, motivo: l.motivo, centavos: 0, pagos: 0 }; al.centavos += l.centavos; al.pagos++; alias.set(ka, al);
      if (l.id === PENDIENTE) { pendC += l.centavos; tienePend = true; if (pendDet.length < 300) pendDet.push({ pagoId: p.id, fecha: p.fecha, cliente: p.cliente, original: l.original, motivo: l.motivo, monto: L(l.centavos), centavos: l.centavos }); continue; }
      const x = prod.get(l.id) || { productoId: l.id, plataforma: l.nombre, centavos: 0, pagos: new Set(), alias: new Set() };
      x.centavos += l.centavos; x.pagos.add(p.id); if (l.original) x.alias.add(l.original); prod.set(l.id, x);
    }
    if (tienePend) pendPagos++;
  }
  // Vista ANTERIOR (R192, por etiqueta tal como se guardó): solo para la conciliación antes/después.
  const porEtiqueta = new Map(); for (const p of pagos.values()) { const k = String(p.plataforma || "").trim() || "Sin plataforma"; porEtiqueta.set(k, (porEtiqueta.get(k) || 0) + p.centavos); }
  const cobrosPorEtiqueta = [...porEtiqueta.entries()].map(([etiqueta, c]) => ({ etiqueta, monto: L(c), centavos: c })).sort((a, b) => b.centavos - a.centavos);
  const cobrosPorProducto = [...prod.values()].map((x) => ({ productoId: x.productoId, plataforma: x.plataforma, monto: L(x.centavos), centavos: x.centavos, pagos: x.pagos.size, alias: [...x.alias].slice(0, 12) })).sort((a, b) => b.centavos - a.centavos);
  const asignadoC = cobrosPorProducto.reduce((a, x) => a + x.centavos, 0);
  const sum = (arr) => arr.reduce((a, m) => a + cents(m.monto), 0);
  const ingresosC = sum(ingresos), pagosC = [...pagos.values()].reduce((a, p) => a + p.centavos, 0);
  return {
    desde, hasta,
    ingresos: L(ingresosC), ingresosCentavos: ingresosC, pagosUnicos: pagos.size, renglonesBanco: ingresos.length,
    egresos: L(sum(egresos)), planilla: L(sum(planilla)), resultado: L(ingresosC - sum(egresos) - sum(planilla)),
    ventasGeneradas: L(sum(ventas)), serviciosRenovadosOVendidos: renovados,
    cobrosPorEtiqueta, cobrosPorProducto, pendienteClasificar: { monto: L(pendC), centavos: pendC, pagos: pendPagos, detalle: pendDet },
    cobrosPorPlataforma: [...cobrosPorProducto, ...(pendC ? [{ productoId: PENDIENTE, plataforma: PENDIENTE_NOMBRE, monto: L(pendC), centavos: pendC, pendiente: true }] : [])], // compatibilidad R192
    aliasRevisados: [...alias.values()].map((a) => ({ ...a, monto: L(a.centavos) })).sort((a, b) => b.centavos - a.centavos).slice(0, 200),
    productosCatalogo: PRODUCTOS,
    porPlataforma: [...porPlataforma.entries()].map(([plataforma, c]) => ({ plataforma, monto: L(c), centavos: c })).sort((a, b) => b.centavos - a.centavos),
    anulados: delMes.filter((m) => anuladoOReversa(m)).length,
    conciliacion: { ingresosVsPagos: ingresosC === pagosC, diferenciaCentavos: ingresosC - pagosC, productosMasPendienteIgualIngresos: asignadoC + pendC === ingresosC, asignadoCentavos: asignadoC, pendienteCentavos: pendC },
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
