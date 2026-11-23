// api/_finanzas-ganancias.js · R197 — MOTOR ÚNICO de ingresos, costos y ganancias (todas las plataformas).
// PDF «Finanzas: ganancias automáticas de todas las plataformas» (17/11/2026).
//
// Por qué noviembre daba L0: Ganancias SOLO sumaba `fin_consumos` (lo que deja el costeo automático). Si el costeo no
// tenía fecha de inicio, no se había corrido «Calcular costos» o la venta se guardó sin pago, no había consumo → ingreso
// L0 y costo L0, aunque existieran cientos de clientes, cobros y compras.
//
// Este motor es SOLO LECTURA (no escribe nada: correrlo mil veces no duplica) y une lo que ya existe:
//   · Ingresos COBRADOS  = movimientos del libro (`finanzas_movimientos`): ventas/renovaciones con su pago, abonos e
//                          ingresos manuales. Un combo se cuenta UNA vez y se reparte por sus líneas.
//   · Ingresos ESPERADOS = renovaciones de las fichas (`clientes.servicios.fechaRenovacion`) sin cobro registrado: NO son dinero.
//   · Costos REALES      = compras (`fin_lotes`, con su fecha, moneda, tasa y costo HISTÓRICO: nunca se revalorizan) +
//                          costos mensuales ya registrados por cuenta (Netflix VIP, Spotify Familiar, Netflix Premium Excel).
//   · Cuentas madre      = `inventario` (Control Maestro / Bodega), solo consulta: correo, plan, capacidad y quién ocupa cada perfil.
// Cada costo se reconoce según cómo se compra el producto (ver `reglaCosto`), sin cobrar dos veces la misma compra.

import { normPlataformaKey, clasificarServicio } from "./_catalogo-categorias.js";

const r2 = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const s = (v, max = 120) => String(v ?? "").trim().slice(0, max);
const DIA = 86400000;

export const NOMBRES = Object.freeze({
  netflix: "Netflix Premium", vipnetflix: "Netflix VIP", disneyp: "Disney Premium", disneys: "Disney Standard", hbomax: "HBO Max", hbomax_standard: "HBO Standard", hbomax_platinum: "HBO Platinum",
  primevideo: "Prime Video", paramount: "Paramount+", crunchyroll: "Crunchyroll", spotify: "Spotify Familiar", youtube: "YouTube Premium", vix: "ViX+", appletv: "Apple TV",
  viki: "Viki Rakuten", deezer: "Deezer", canva: "Canva", gemini: "Gemini Pro", chatgpt: "ChatGPT", duolingo: "Duolingo", office: "Office", office2021: "Office 2021", autocad: "Autodesk",
  eset: "Antivirus", elevenreader: "Eleven Reader", iptv: "IPTV", stellatv: "Stella TV", oleada: "Oleada TV", latintv: "LatinTV", liontv: "Lion TV", evoutouch: "Evoutouch", icomplay: "IcomPlay",
  universal: "Universal+", steam: "Steam", freefire: "Free Fire",
});
export const nombrePlataforma = (k) => NOMBRES[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : "Sin plataforma");

// Fecha a YYYY-MM-DD (acepta DD/MM/YYYY de las fichas).
export function ymd(v) {
  const t = String(v || "").trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}
const ms = (f) => Date.parse(`${f}T12:00:00Z`);
const sumarDias = (f, d) => new Date(ms(f) + d * DIA).toISOString().slice(0, 10);
// Días del intervalo [ini, ini+dur) que caen dentro de [desde, hasta] (ambos inclusive).
function diasDentro(ini, dur, desde, hasta) {
  const a = Math.max(ms(ini), ms(desde)), b = Math.min(ms(ini) + (dur - 1) * DIA, ms(hasta));
  return b >= a ? Math.round((b - a) / DIA) + 1 : 0;
}
export function mesesDe(desde, hasta) { // ["2026-08", …] que toca el rango
  const out = []; let [y, m] = desde.slice(0, 7).split("-").map(Number); const [y2, m2] = hasta.slice(0, 7).split("-").map(Number);
  while (y < y2 || (y === y2 && m <= m2)) { out.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}
export function rangoMes(mes) { const [y, m] = mes.split("-").map(Number); const ult = new Date(Date.UTC(y, m, 0)).getUTCDate(); return { desde: `${mes}-01`, hasta: `${mes}-${String(ult).padStart(2, "0")}` }; }
const diasRango = (desde, hasta) => Math.round((ms(hasta) - ms(desde)) / DIA) + 1;

// Familia financiera de una plataforma (HBO se separa por plan cuando se conoce).
export function familia(plataforma, planHbo = "") {
  const k = normPlataformaKey(plataforma);
  if (k === "hbomax") { const p = String(planHbo || "").toLowerCase(); return p === "standard" ? "hbomax_standard" : p === "platinum" ? "hbomax_platinum" : "hbomax"; }
  if (/^steam/.test(k)) return "steam";
  if (/^freefire|^diamantes/.test(k)) return "freefire";
  return k || "otros";
}
const base = (fam) => (String(fam).startsWith("hbomax") ? "hbomax" : fam);

// ¿Cómo se reconoce el costo de una compra? (Fase 2 · un modelo por forma de adquisición; configurable por producto)
//   «cobertura»  → pago con vigencia (cuenta madre mensual, Prime trimestral, Crunchyroll anual, paneles, gift cards con
//                  duración): el costo se reparte por días dentro de su vigencia real. Ni más meses, ni menos.
//   «consumo»    → créditos/puntos, licencias, claves, enlaces, recargas: el costo sale con lo USADO (consumos PEPS de cada
//                  venta). Si todavía no hay consumo calculado, se reconoce en el mes de la compra como «lote sin consumo».
//   «activacion» → activación ocasional sin vigencia (HBO/Disney por activación): UN desembolso por activación, en su
//                  fecha, marcado como «ciclo de activación». Nunca se inventan meses.
export function reglaCosto(lote = {}, producto = {}) {
  const regla = String(producto.reglaCosto || lote.reglaCosto || "").toLowerCase();
  if (["cobertura", "consumo", "activacion"].includes(regla)) return regla; // producto nuevo: configurable
  const modelo = String(lote.modelo || producto.modelo || "");
  const dur = Number(lote.duracionDias ?? producto.duracionDias) || 0;
  if (["creditos", "unidad", "costo_cero"].includes(modelo)) return "consumo";
  if (modelo === "link") return dur > 0 ? "cobertura" : "activacion";
  if (dur > 0) return "cobertura";
  return "activacion";
}

// ---------------------------------------------------------------- 1) INGRESOS
// Líneas de ingreso de UNA venta del libro. Un combo (varias compras en un pago) se reparte por sus asignaciones; si no
// las tiene, por el precio de cada servicio en la ficha; si tampoco, en partes iguales. La suma de las líneas = la venta.
function lineasDeVenta(v, ctx) {
  const total = r2(v.monto), recibido = v.origenVenta === "venta" ? r2(v.montoRecibido ?? v.monto) : r2(v.monto);
  let partes = [];
  if (Array.isArray(v.asignaciones) && v.asignaciones.length) partes = v.asignaciones.map((a) => ({ compraId: s(a.compraId), plataforma: a.plataforma || v.plataforma, peso: Number(a.monto) || 0, esperado: a.montoEsperado != null ? r2(a.montoEsperado) : null, descuento: r2(a.descuento) }));
  else if (Array.isArray(v.compraIds) && v.compraIds.length > 1) partes = v.compraIds.map((cid, i) => { const sv = ctx.servPorCompra.get(cid); const x = (v.servicios || [])[i] || {}; return { compraId: cid, plataforma: (sv && sv.plataforma) || x.plataforma || v.plataforma, peso: sv ? Number(sv.precio) || 0 : 0 }; });
  else partes = [{ compraId: s(v.compraId || (v.compraIds || [])[0]), plataforma: v.plataforma, peso: 1, esperado: v.montoEsperado != null ? r2(v.montoEsperado) : null, descuento: r2(v.descuento) }];
  const pesoTot = partes.reduce((a, p) => a + p.peso, 0);
  let restoT = total, restoR = recibido;
  return partes.map((p, i) => {
    const f = pesoTot > 0 ? p.peso / pesoTot : 1 / partes.length; const ult = i === partes.length - 1;
    const monto = ult ? r2(restoT) : r2(total * f), cobrado = ult ? r2(restoR) : r2(recibido * f); restoT = r2(restoT - monto); restoR = r2(restoR - cobrado);
    const sv = p.compraId ? ctx.servPorCompra.get(p.compraId) : null; const cta = p.compraId ? ctx.cuentaPorCompra.get(p.compraId) : null;
    const cli = sv ? ctx.clientePorId.get(sv._clienteId) : ctx.clientePorId.get(s(v.clienteId));
    const planHbo = (sv && sv.planHbo) || (cta && cta.planHbo) || "";
    const fam = familia((sv && sv.plataforma) || p.plataforma || v.plataforma, planHbo);
    return {
      ventaId: v.id, fecha: v.fecha, tipo: v.origenVenta === "venta" ? (v.subtipo === "compra_nueva" ? "venta" : "renovacion") : "ingreso_manual",
      compraId: p.compraId || "", plataforma: fam, cuentaId: cta ? cta.id : "", cuentaCorreo: cta ? s(cta.correo) : "",
      clienteId: (sv && sv._clienteId) || s(v.clienteId), titular: s((cli && (cli.nombre || cli.nombrePerfil)) || v.clienteNombre, 80),
      beneficiario: s((sv && (sv.beneficiarioNombre || sv.beneficiario)) || (cta && cta._perfilPorCompra.get(p.compraId)) || (cli && cli.nombre) || v.clienteNombre, 80),
      perfil: s(sv && (sv.perfil || (sv.perfiles && sv.perfiles[0] && sv.perfiles[0].nombre)), 40) || s(cta && cta._slotPorCompra.get(p.compraId), 20),
      vendedor: s((sv && sv.vendedor) || v.vendedor || v.vendedorNombre || v.registradoPor, 60) || "Sin vendedor",
      monto, cobrado, pendiente: r2(monto - cobrado), esperado: p.esperado, descuento: p.descuento || 0,
      precioFicha: sv ? r2(sv.precio) : null, combo: partes.length > 1, referencia: v.id, origenVenta: v.origenVenta,
    };
  });
}

// ---------------------------------------------------------------- 2) COSTOS
// Devuelve las «piezas» de costo reconocidas en [desde, hasta] y los desembolsos (caja) del rango, sin duplicar.
function costosRango(ctx, desde, hasta) {
  const { lotes, productosPorId, consumos, vipExtras, spotify, premium, cuentasPorId, cuentasPorCorreo } = ctx;
  const piezas = [], caja = [];
  const finMes = (f) => f === rangoMes(f.slice(0, 7)).hasta;
  const meses = desde.endsWith("-01") && finMes(hasta) ? mesesDe(desde, hasta).length : r2(diasRango(desde, hasta) / 30.4375); // mensualidades: meses completos o proporción
  const vipConCosto = vipExtras.some((x) => r2(x.costoMensualHnl) > 0 && x.estadoSeguimiento !== "reemplazado" && x.estadoSeguimiento !== "vinculado");
  const spfConCosto = spotify.some((x) => r2(x.costoMensualHnl) > 0);
  // productos con costo por consumo que YA tienen consumos en el rango: su costo sale de los consumos
  const consumoEnRango = new Map(); // productoId → [{costo, ventaId, compraId?}]
  for (const c of consumos) {
    if (c.estado === "revertido" || !c.fecha || c.fecha < desde || c.fecha > hasta) continue;
    for (const l of c.lineas || []) { if (!l.productoId) continue; (consumoEnRango.get(l.productoId) || consumoEnRango.set(l.productoId, []).get(l.productoId)).push({ costo: r2(l.costoHnl), ventaId: c.ventaId, fecha: c.fecha }); }
  }
  const actPorCuenta = new Map(); // R198i · cuentaId → activaciones (todas las fechas)
  const lotesCubiertos = new Set(); // cuentas con lote real (el Excel Premium no se suma encima)
  for (const l of lotes) {
    if (l.estado === "anulado") continue;
    const ctaId = s(l._cuentaId || l.cuentaInventarioId); // R198h · cuenta efectiva (por ID o conciliada)
    const p = productosPorId.get(l.productoId) || {}; const fam = familia(p.plataformaKey || l.plataformaKey || l.producto, (cuentasPorId.get(ctaId) || {}).planHbo);
    const costo = r2(l.costoTotalHnl), fecha = ymd(l.fecha), inicio = ymd(l.fechaActivacion) || fecha;
    if (!fecha || !(costo > 0)) continue;
    const ref = { loteId: l.id, producto: s(l.producto || p.nombre, 60), proveedor: s(l.proveedor, 60), moneda: l.moneda || "HNL", montoMoneda: l.costoTotalMoneda, tasa: l.tasa, fechaCompra: fecha, cuentaId: ctaId, correo: s((cuentasPorId.get(ctaId) || {}).correo) };
    if (fecha >= desde && fecha <= hasta) caja.push({ ...ref, plataforma: fam, costoHnl: costo, pago: l.cuentaPagoNombre || l.pago || "" });
    // Netflix VIP y Spotify Familiar se reconocen por su costo mensual por acceso/familia: su compra es solo caja.
    if ((base(fam) === "vipnetflix" && vipConCosto) || (base(fam) === "spotify" && spfConCosto && !ctaId)) continue;
    if (l._ciclo) { // R198h · cobertura DOCUMENTADA en la conciliación: el costo del ciclo se reparte por días, en cualquier mes
      const cd = ymd(l._ciclo.coberturaDesde), ch = ymd(l._ciclo.coberturaHasta), dur = diasRango(cd, ch);
      const d = dur > 0 ? diasDentro(cd, dur, desde, hasta) : 0; if (!d) continue;
      if (ctaId) lotesCubiertos.add(`${ctaId}|${desde}`);
      piezas.push({ ...ref, plataforma: fam, regla: "cobertura_documentada", costoHnl: r2(costo * d / dur), criterio: `${d} de ${dur} días de la cobertura documentada (${cd} → ${ch}) · ${s(l._ciclo.evidencia, 120)}`, costoCiclo: costo });
      continue;
    }
    const regla = reglaCosto(l, p);
    if (regla === "cobertura") {
      const dur = Number(l.duracionDias) || Number(p.duracionDias) || 30;
      const d = diasDentro(inicio, dur, desde, hasta); if (!d) continue;
      if (ctaId) lotesCubiertos.add(`${ctaId}|${desde}`);
      piezas.push({ ...ref, plataforma: fam, regla, costoHnl: r2(costo * d / dur), criterio: `${d} de ${dur} días de vigencia (${inicio} → ${sumarDias(inicio, dur - 1)})`, costoCiclo: costo });
    } else if (regla === "consumo") {
      if (consumoEnRango.has(l.productoId)) continue; // se reconoce abajo por lo usado
      if (fecha < desde || fecha > hasta) continue;
      piezas.push({ ...ref, plataforma: fam, regla: "lote_sin_consumo", costoHnl: costo, criterio: "Lote reconocido en su mes: todavía no hay consumo calculado por venta", costoCiclo: costo, aviso: true });
    } else { // activación (R198i · regla del dueño): el costo se reconoce UNA vez en su fecha y cubre la cuenta hasta la próxima activación
      if (ctaId) (actPorCuenta.get(ctaId) || actPorCuenta.set(ctaId, []).get(ctaId)).push({ ...ref, plataforma: fam, fecha, costoHnl: costo });
      if (fecha < desde || fecha > hasta) continue;
      piezas.push({ ...ref, plataforma: fam, regla, costoHnl: costo, criterio: "Activación: el costo de la cuenta se reconoce en su fecha y la cubre hasta la próxima activación (los meses siguientes no suman costo)", costoCiclo: costo });
    }
  }
  // R198i · ciclo de activación vigente en el período: última activación ≤ hasta (la cuenta sigue cubierta, costo ya pagado)
  const ciclosAct = new Map();
  for (const [cid, arr] of actPorCuenta) {
    arr.sort((a, b) => a.fecha.localeCompare(b.fecha));
    const prev = arr.filter((a) => a.fecha <= hasta); if (!prev.length) continue;
    const u = prev[prev.length - 1], sig = arr.find((a) => a.fecha > u.fecha) || null;
    ciclosAct.set(cid, { cuentaId: cid, loteId: u.loteId, plataforma: u.plataforma, correo: u.correo, fechaActivacion: u.fecha, costoHnl: u.costoHnl, moneda: u.moneda, montoMoneda: u.montoMoneda, tasa: u.tasa, proveedor: u.proveedor,
      siguienteActivacion: sig ? sig.fecha : "", activacionEnPeriodo: u.fecha >= desde, activaciones: arr.length });
  }
  for (const [pid, arr] of consumoEnRango) { // créditos / licencias / unidades: lo realmente usado
    const p = productosPorId.get(pid) || {}; if (reglaCosto({}, p) !== "consumo") continue;
    const fam = familia(p.plataformaKey || p.nombre);
    piezas.push({ loteId: "", producto: s(p.nombre, 60), proveedor: "", plataforma: fam, regla: "consumo", costoHnl: r2(arr.reduce((a, x) => a + x.costo, 0)), criterio: `${arr.length} consumo(s) de ventas del período (PEPS, costo histórico del lote)`, ventas: arr.map((x) => x.ventaId) });
  }
  for (const x of vipExtras) { // Netflix VIP: costo mensual de cada acceso (USDT a su tasa guardada)
    if (!(r2(x.costoMensualHnl) > 0) || ["reemplazado", "vinculado", "baja", "cancelado"].includes(String(x.estadoSeguimiento || ""))) continue;
    const creado = ymd(x.creadoAt) || ymd(x.actualizadoAt) || desde; if (creado > hasta) continue;
    const cta = cuentasPorId.get(x.cmId || x.id) || null;
    piezas.push({ loteId: "", producto: "Netflix VIP", proveedor: s(x.proveedor, 60), plataforma: "vipnetflix", regla: "mensual_acceso", costoHnl: r2(x.costoMensualHnl * meses), moneda: "USDT", montoMoneda: x.costoMensualUsdt, tasa: x.tasa, cuentaId: cta ? cta.id : "", correo: s(x.correo), criterio: `Costo mensual del acceso (${x.costoMensualUsdt ?? "?"} USDT × tasa ${x.tasa ?? "?"}) × ${r2(meses)} mes(es)` });
  }
  for (const f of spotify) { // Spotify Familiar: UN costo por familia (no por invitado)
    if (!(r2(f.costoMensualHnl) > 0)) continue;
    const inicioF = ymd(f.creadoAt) || ymd(f.ultimoPago) || ymd(f.actualizadoAt); if (inicioF && inicioF > hasta) continue; // desde que se registró, no antes
    const cta = cuentasPorCorreo.get(`spotify|${s(f.madreCorreo).toLowerCase()}`) || null;
    piezas.push({ loteId: "", producto: "Spotify Familiar", proveedor: "", plataforma: "spotify", regla: "mensual_familia", costoHnl: r2(f.costoMensualHnl * meses), cuentaId: cta ? cta.id : "", familiaId: f.id, correo: s(f.madreCorreo), criterio: `Un costo por familia (${f.costoMensualHnl} al mes), aunque tenga varios invitados` });
  }
  for (const pr of premium) { // Netflix Premium por Excel (cargo real de tarjeta) si esa cuenta no tiene ya una compra registrada
    const f = ymd(pr.fechaCobro), hnl = r2(pr.cargoHnl); if (!f || !(hnl > 0) || !pr.inventarioId) continue;
    if (lotesCubiertos.has(`${pr.inventarioId}|${desde}`)) continue;
    const d = diasDentro(f, 30, desde, hasta); if (!d) continue;
    piezas.push({ loteId: "", producto: "Netflix Premium (tarjeta)", proveedor: s(pr.banco, 40), plataforma: "netflix", regla: "cobertura", costoHnl: r2(hnl * d / 30), moneda: "USD", montoMoneda: pr.pagoUsd, tasa: pr.tipoCambio, cuentaId: pr.inventarioId, criterio: `Cargo de tarjeta ${pr.pagoUsd} USD (${f}) · ${d} de 30 días`, fechaCompra: f });
  }
  return { piezas, caja, ciclosAct };
}

// ---------------------------------------------------------------- 3) CONTEXTO (una sola lectura de datos)
// Cuentas = cuentas madre de Control Maestro / Bodega (`inventario`) + accesos Netflix VIP registrados en Finanzas
// (`fin_vip_extras`) que no tienen documento local: un Extra VIP es un ACCESO INDIVIDUAL, no «0 cuentas».
// R198h · PDF «HBO: compras registradas pendientes de vinculación» (19/11/2026). Conciliación PERSISTENTE compra → cuenta → período
// en `fin_costo_ciclos/{loteId}` (la compra original NO se toca: monto, fecha, tasa y referencia quedan inmutables):
//   · cuentaInventarioId → vincula una compra que no traía cuenta (confirmación administrativa, con evidencia);
//   · coberturaDesde/coberturaHasta → cobertura DOCUMENTADA del ciclo: solo entonces el costo se reparte por días del período.
// Sin cobertura documentada, una activación se reconoce en su fecha y los meses siguientes quedan «cobertura desconocida».
export const cantidadNoAcreditada = (l = {}) => String(l.unidad || "") === "perfil-mes" && !(Number(l.duracionDias) > 0) && !String(l.vigenciaHasta || ""); // «60 perfil-mes» salió del catálogo (365 d × 5), no de la compra
export function prepararContexto({ clientes = [], inventario = [], lotes = [], productos = [], consumos = [], vipExtras = [], spotify = [], premium = [], ciclos = [] } = {}) {
  const cicloPorLote = new Map(ciclos.filter((c) => c && c.estado !== "anulado" && c.loteId).map((c) => [String(c.loteId), c]));
  lotes = lotes.map((l) => { const c = cicloPorLote.get(String(l.id)) || null; return { ...l, _cuentaId: s(l.cuentaInventarioId) || s(c && c.cuentaInventarioId), _vinculo: s(l.cuentaInventarioId) ? "por_id" : c && c.cuentaInventarioId ? "conciliado" : "sin_vinculo", _ciclo: c && /^\d{4}-\d{2}-\d{2}$/.test(String(c.coberturaDesde || "")) && /^\d{4}-\d{2}-\d{2}$/.test(String(c.coberturaHasta || "")) ? c : null, _conciliacion: c }; });
  const servPorCompra = new Map(), clientePorId = new Map(), servicios = [];
  for (const c of clientes) {
    if (!c || String(c.consolidadoEn || "").trim()) continue;
    clientePorId.set(c.id, c);
    for (const sv of Array.isArray(c.servicios) ? c.servicios : []) { if (!sv) continue; const x = { ...sv, _clienteId: c.id }; servicios.push(x); if (sv.compraId) servPorCompra.set(String(sv.compraId), x); }
  }
  const cuentaPorCompra = new Map(), cuentasPorId = new Map(), cuentasPorCorreo = new Map();
  const registrar = (a, pseudo = false) => {
    const perfilPorCompra = new Map(), slotPorCompra = new Map();
    for (const cl of Array.isArray(a.clientes) ? a.clientes : []) { if (!cl) continue; const cid = String(cl.compraId || ""); if (cid) { perfilPorCompra.set(cid, s(cl.nombre, 80)); slotPorCompra.set(cid, cl.slot != null ? `Perfil ${cl.slot}` : ""); } }
    const cta = { ...a, _perfilPorCompra: perfilPorCompra, _slotPorCompra: slotPorCompra, _pseudo: pseudo, _familia: familia(a.plataforma, a.planHbo) };
    cuentasPorId.set(a.id, cta);
    for (const cid of perfilPorCompra.keys()) cuentaPorCompra.set(cid, cta);
    const k = `${base(cta._familia)}|${s(a.correo).toLowerCase()}`; if (s(a.correo) && !cuentasPorCorreo.has(k)) cuentasPorCorreo.set(k, cta);
    return cta;
  };
  for (const a of inventario) { if (!a || a.estado === "eliminada" || a.eliminado === true) continue; registrar(a); }
  for (const x of vipExtras) { // accesos VIP sin documento en Control Maestro: se ven igual, como acceso individual
    if (!x || ["reemplazado", "vinculado"].includes(String(x.estadoSeguimiento || ""))) continue;
    const id = String(x.cmId || x.id); if (cuentasPorId.has(id)) continue;
    registrar({ id, plataforma: "vipnetflix", correo: s(x.correo), capacidad: 1, clientes: [], proveedor: x.proveedor || "" }, true);
  }
  // Servicio sin enlace por compraId: se busca por correo + plataforma (apoyo controlado; queda marcado como «por correo»)
  const enlacePorCorreo = new Set();
  for (const sv of servicios) {
    const cid = String(sv.compraId || ""); if (!cid || cuentaPorCompra.get(cid)) continue;
    const c = cuentasPorCorreo.get(`${base(familia(sv.plataforma))}|${s(sv.correo).toLowerCase()}`);
    if (c) { cuentaPorCompra.set(cid, c); enlacePorCorreo.add(cid); }
  }
  return { servPorCompra, clientePorId, servicios, cuentaPorCompra, enlacePorCorreo, cuentasPorId, cuentasPorCorreo, lotes, productosPorId: new Map(productos.map((p) => [p.id, p])), consumos, vipExtras, spotify, premium, cicloPorLote };
}

const PLAT_CUENTA = new Set(["netflix", "vipnetflix", "disneyp", "disneys", "hbomax", "hbomax_standard", "hbomax_platinum", "primevideo", "paramount", "crunchyroll", "spotify", "youtube", "appletv", "vix", "universal", "viki", "deezer", "canva"]);
export const DEFINICIONES = Object.freeze({
  altas: "Ventas nuevas creadas en el período (eventos de venta con pago registrado).",
  renovaciones: "Renovaciones COBRADAS en el período (no las programadas).",
  cobrado: "Dinero recibido, repartido a cada servicio; un combo cuenta una sola vez.",
  pendiente: "Saldo por cobrar de ventas o renovaciones del período (pago parcial o a crédito).",
  esperado: "Renovaciones que vencen en el período sin cobro registrado. NO es dinero cobrado.",
  costo: "Costo directo atribuible al período, con la tasa y el costo históricos de cada compra.",
  cobertura: "Cobrado de cuentas con costo ATRIBUIDO al período o con su ACTIVACIÓN vigente ÷ cobrado total del período. Una cuenta activada (p. ej. HBO por link) queda cubierta desde su activación hasta la próxima: el costo se cuenta una sola vez en la fecha de activación y los meses siguientes suman L0. Una compra sin vínculo a cuenta no cubre nada. Si es menor a 100 %, el margen no es definitivo.",
  ciclo: "Resultado del ciclo: todo lo cobrado de la cuenta desde su activación hasta hoy (o hasta la próxima activación) − lo que costó activarla.",
  cartera: "Cartera = cuentas y perfiles ocupados hoy en Control Maestro, paguen o no en el período. «Pagaron» = clientes con cobro registrado en el período.",
  resultado: "Cobrado con costo − costo directo. Lo cobrado sin costo se muestra aparte («costo incompleto»), nunca como ganancia.",
});

// R198i · cartera actual de Control Maestro por familia: cuentas madre (sin accesos sueltos), perfiles ocupados y clientes únicos.
export function carteraPorFamilia(ctx) {
  const m = new Map();
  for (const a of ctx.cuentasPorId.values()) {
    if (a._pseudo) continue;
    const x = m.get(a._familia) || m.set(a._familia, { cuentas: 0, perfiles: 0, clientes: 0, servicios: 0, _cli: new Set() }).get(a._familia);
    const cls = Array.isArray(a.clientes) ? a.clientes.filter(Boolean) : [];
    x.cuentas++; x.perfiles += cls.length || Number(a.ocupados) || 0;
    for (const cl of cls) { const sv = ctx.servPorCompra.get(String(cl.compraId || "")); const cid = (sv && sv._clienteId) || s(cl.clienteId) || s(cl.nombre, 80).toLowerCase(); if (cid) x._cli.add(cid); if (cl.compraId) x.servicios++; }
  }
  for (const x of m.values()) { x.clientes = x._cli.size; delete x._cli; }
  return m;
}

// ---------------------------------------------------------------- 4) MOTOR por rango
// deps: { R: { movementYmd, movementKind, anuladoOReversa }, ventasACostear }
export function calcularGanancias(ctx, movimientos = [], { desde, hasta, hoy = "" }, deps) {
  const { R, ventasACostear } = deps;
  const vigente = (m) => !R.anuladoOReversa(m);
  const enRango = (m) => { const f = R.movementYmd(m); return f && f >= desde && f <= hasta; };
  const porId = new Map(movimientos.map((m) => [m.id, m]));
  const cobrosPorRaiz = new Map(); // «oper_op_x_cobro», «…_cobro_2»: un índice evita recorrer todo el libro por venta
  for (const m of movimientos) { const k = String(m.id || "").match(/^(.*)_cobro(_\d+)?$/); if (k && vigente(m)) (cobrosPorRaiz.get(k[1]) || cobrosPorRaiz.set(k[1], []).get(k[1])).push(m); }
  const cobrosDe = (v) => cobrosPorRaiz.get(String(v.id).replace(/_venta$/, "")) || [];
  // Ventas del período (altas + renovaciones + cobros manuales con servicio) y su reparto en líneas
  const ventas = ventasACostear(movimientos, desde, R, { paraIngresos: true }).filter((v) => v.fecha <= hasta && !v.anulada);
  const lineas = ventas.flatMap((v) => {
    const cobros = v.origenVenta === "venta" ? cobrosDe(v) : [v];
    const extra = { banco: [...new Set(cobros.map((c) => s(c.banco || c.metodoPago || c.bancoId, 40)).filter(Boolean))].join(" + ") || (v.estadoPago === "pendiente" ? "Sin pago" : ""), fuente: s(v.origenCanal || v.origen || (porId.get(v.id) || {}).origenCanal, 20) || "web", registradoPor: s(v.registradoPor || v.usuario, 40), cobroIds: cobros.map((c) => c.id) };
    return lineasDeVenta(v, ctx).map((l) => ({ ...l, ...extra, enlace: !l.cuentaId ? (PLAT_CUENTA.has(l.plataforma) ? "sin_cuenta" : "no_aplica") : ctx.enlacePorCorreo.has(l.compraId) ? "por_correo" : "por_id", planSinClasificar: l.plataforma === "hbomax" }));
  });
  // Caja del período y cuadre de integridad: cobros originales = asignado a servicios + abonos + no asignado
  const ingresosCaja = movimientos.filter((m) => vigente(m) && enRango(m) && R.movementKind(m) === "ingreso");
  const cobradoCaja = r2(ingresosCaja.reduce((a, m) => a + Number(m.monto || 0), 0));
  const idsLinea = new Set(lineas.flatMap((l) => l.cobroIds || []));
  const abonos = r2(ingresosCaja.filter((m) => !idsLinea.has(m.id) && (m.cuentaId || /^cobro_pendiente|abono/.test(String(m.subtipo || "")))).reduce((a, m) => a + Number(m.monto || 0), 0));
  const fueraDeVentas = r2(ingresosCaja.filter((m) => !idsLinea.has(m.id) && !(m.cuentaId || /^cobro_pendiente|abono/.test(String(m.subtipo || "")))).reduce((a, m) => a + Number(m.monto || 0), 0));
  // Esperados: renovaciones que vencen en el período y no tienen cobro registrado (no son dinero)
  const conVenta = new Set(lineas.map((l) => l.compraId).filter(Boolean));
  const esperados = ctx.servicios.filter((sv) => { const f = ymd(sv.fechaRenovacion); return f && f >= desde && f <= hasta && r2(sv.precio) > 0 && !conVenta.has(String(sv.compraId || "")); }).map((sv) => {
    const cta = ctx.cuentaPorCompra.get(String(sv.compraId || "")); const cli = ctx.clientePorId.get(sv._clienteId) || {};
    return { compraId: s(sv.compraId), fecha: ymd(sv.fechaRenovacion), plataforma: familia(sv.plataforma, sv.planHbo || (cta && cta.planHbo)), cuentaId: cta ? cta.id : "", cuentaCorreo: cta ? s(cta.correo) : s(sv.correo),
      clienteId: sv._clienteId, titular: s(cli.nombre, 80), beneficiario: s(sv.beneficiarioNombre || sv.beneficiario || (cta && cta._perfilPorCompra.get(String(sv.compraId))) || cli.nombre, 80), vendedor: s(sv.vendedor, 60) || "Sin vendedor", precio: r2(sv.precio), estado: hoy && ymd(sv.fechaRenovacion) < hoy ? "vencido_sin_cobro" : "por_cobrar" };
  });
  const { piezas, caja, ciclosAct } = costosRango(ctx, desde, hasta);

  // ---- cobertura de costos: una línea está cubierta si su cuenta tiene costo en el período, su plataforma tiene costo general
  // o (R198i) su cuenta tiene un ciclo de activación vigente: el costo ya se pagó en la activación y aquí aporta L0.
  const ctaConCosto = new Set(piezas.filter((c) => c.cuentaId).map((c) => c.cuentaId)), platPool = new Set(piezas.filter((c) => !c.cuentaId).map((c) => c.plataforma));
  const cubierta = (l) => (l.cuentaId && ctaConCosto.has(l.cuentaId)) || platPool.has(l.plataforma);
  for (const l of lineas) {
    const ci = l.cuentaId ? ciclosAct.get(l.cuentaId) : null;
    const porCiclo = !!ci && ci.fechaActivacion <= l.fecha && !cubierta(l);
    l.costoCubierto = !!cubierta(l) || porCiclo; l.cubiertaPorCiclo = porCiclo;
    if (ci && ci.fechaActivacion <= l.fecha) l.cicloActivacion = ci.fechaActivacion;
  }

  // ---- por plataforma
  const plats = new Map();
  const P = (k) => plats.get(k) || plats.set(k, { plataforma: k, nombre: nombrePlataforma(k), altas: 0, renovaciones: 0, otros: 0, ingresoHnl: 0, cobradoHnl: 0, cobradoCubiertoHnl: 0, pendienteHnl: 0, esperadoHnl: 0, costoHnl: 0, desembolsoHnl: 0, cuentas: new Set(), clientes: new Set(), servicios: new Set(), sinCuenta: 0, planSinClasificar: 0, cobradoCicloHnl: 0, cuentasCiclo: new Set() }).get(k);
  for (const l of lineas) {
    const x = P(l.plataforma); if (l.tipo === "venta") x.altas++; else if (l.tipo === "renovacion") x.renovaciones++; else x.otros++;
    x.ingresoHnl += l.monto; x.cobradoHnl += l.cobrado; if (l.costoCubierto) x.cobradoCubiertoHnl += l.cobrado; x.pendienteHnl += l.pendiente;
    if (l.cuentaId) x.cuentas.add(l.cuentaId); if (l.clienteId) x.clientes.add(l.clienteId); if (l.compraId) x.servicios.add(l.compraId);
    if (l.enlace === "sin_cuenta") x.sinCuenta++; if (l.planSinClasificar) x.planSinClasificar++;
    if (l.cubiertaPorCiclo) { x.cobradoCicloHnl += l.cobrado; x.cuentasCiclo.add(l.cuentaId); }
  }
  // R198i · CARTERA de Control Maestro (todas las cuentas y perfiles ocupados, paguen o no en el período): no es lo mismo que «pagaron»
  const cartera = carteraPorFamilia(ctx);
  for (const [k, c] of cartera) if (plats.has(k) || c.cuentas > 0) Object.assign(P(k), { _cartera: c });
  for (const e of esperados) P(e.plataforma).esperadoHnl += e.precio;
  for (const c of piezas) P(c.plataforma).costoHnl += c.costoHnl;
  for (const c of caja) P(c.plataforma).desembolsoHnl += c.costoHnl;
  const porPlataforma = [...plats.values()].map((x) => {
    const cobrado = r2(x.cobradoHnl), cub = r2(x.cobradoCubiertoHnl), costo = r2(x.costoHnl);
    const cobertura = cobrado > 0 ? pct(cub, cobrado) : null;
    const resultado = cub > 0 || costo > 0 ? r2(cub - costo) : null;
    const estado = cobrado === 0 && costo === 0 ? "sin_movimiento" : cobrado > 0 && cub === 0 ? "costo_pendiente" : cobrado === 0 ? "sin_ingreso" : cobertura < 99.5 ? "cobertura_parcial" : "ok";
    const ct = x._cartera || { cuentas: 0, perfiles: 0, clientes: 0, servicios: 0 }; delete x._cartera;
    return { ...x, cuentas: x.cuentas.size, clientes: x.clientes.size, servicios: x.servicios.size, cobradoCicloHnl: r2(x.cobradoCicloHnl), cuentasCiclo: x.cuentasCiclo.size, carteraCuentas: ct.cuentas, carteraPerfiles: ct.perfiles, carteraClientes: ct.clientes, carteraServicios: ct.servicios, ventas: x.altas + x.renovaciones + x.otros, ingresoHnl: r2(x.ingresoHnl), cobradoHnl: cobrado, cobradoCubiertoHnl: cub, cobradoSinCostoHnl: r2(cobrado - cub), pendienteHnl: r2(x.pendienteHnl), esperadoHnl: r2(x.esperadoHnl), costoHnl: costo, desembolsoHnl: r2(x.desembolsoHnl),
      coberturaCostos: cobertura, resultadoHnl: estado === "costo_pendiente" ? null : resultado, margen: resultado != null && cub > 0 && estado !== "costo_pendiente" ? pct(resultado, cub) : null, margenDefinitivo: estado === "ok", estado };
  }).sort((a, b) => b.cobradoHnl - a.cobradoHnl || b.esperadoHnl - a.esperadoHnl);

  // ---- resumen (mismo motor para Resumen, Ganancias y Reportes)
  const cobradoVentas = r2(lineas.reduce((a, l) => a + l.cobrado, 0));
  const cobradoCub = r2(lineas.filter((l) => l.costoCubierto).reduce((a, l) => a + l.cobrado, 0));
  const costo = r2(piezas.reduce((a, c) => a + c.costoHnl, 0));
  const cobertura = cobradoVentas > 0 ? pct(cobradoCub, cobradoVentas) : null;
  const resultado = cobradoCub > 0 || costo > 0 ? r2(cobradoCub - costo) : null;
  const resumen = {
    desde, hasta, ventas: ventas.length, lineas: lineas.length,
    altas: lineas.filter((l) => l.tipo === "venta").length, renovaciones: lineas.filter((l) => l.tipo === "renovacion").length, otrosCobros: lineas.filter((l) => l.tipo === "ingreso_manual").length,
    clientesUnicos: new Set(lineas.map((l) => l.clienteId).filter(Boolean)).size, servicios: new Set(lineas.map((l) => l.compraId).filter(Boolean)).size,
    ingresoVentasHnl: r2(lineas.reduce((a, l) => a + l.monto, 0)), cobradoHnl: cobradoVentas, cobradoCubiertoHnl: cobradoCub, cobradoSinCostoHnl: r2(cobradoVentas - cobradoCub),
    pendienteHnl: r2(lineas.reduce((a, l) => a + l.pendiente, 0)), esperadoHnl: r2(esperados.reduce((a, e) => a + e.precio, 0)), esperados: esperados.length,
    descuentosHnl: r2(lineas.reduce((a, l) => a + (l.descuento > 0 ? l.descuento : 0), 0)),
    costoHnl: costo, desembolsoHnl: r2(caja.reduce((a, c) => a + c.costoHnl, 0)),
    costoActivacionesHnl: r2(piezas.filter((c) => c.regla === "activacion").reduce((a, c) => a + c.costoHnl, 0)),
    cobradoCicloVigenteHnl: r2(lineas.filter((l) => l.cubiertaPorCiclo).reduce((a, l) => a + l.cobrado, 0)), cuentasCicloVigente: ciclosAct.size, // R198i
    costoSinConsumoHnl: r2(piezas.filter((c) => c.regla === "lote_sin_consumo").reduce((a, c) => a + c.costoHnl, 0)),
    coberturaCostos: cobertura, resultadoHnl: resultado, margen: resultado != null && cobradoCub > 0 ? pct(resultado, cobradoCub) : null, margenDefinitivo: cobertura != null && cobertura >= 99.5,
    flujoCajaHnl: r2(cobradoCaja - caja.reduce((a, c) => a + c.costoHnl, 0)),
    cuadre: { cobrosOriginalesHnl: cobradoCaja, asignadoServiciosHnl: r2(lineas.reduce((a, l) => a + (l.cobroIds.length ? l.cobrado : 0), 0)), abonosVentasAnterioresHnl: abonos, noAsignadoHnl: fueraDeVentas,
      diferenciaHnl: r2(cobradoCaja - r2(lineas.reduce((a, l) => a + (l.cobroIds.length ? l.cobrado : 0), 0)) - abonos - fueraDeVentas) },
    cobradoCajaHnl: cobradoCaja, abonosHnl: abonos,
    estado: !ventas.length && !costo ? "sin_datos" : cobradoVentas > 0 && cobradoCub === 0 ? "costo_incompleto" : cobertura != null && cobertura < 99.5 ? "cobertura_parcial" : "ok",
    calculadoAt: new Date().toISOString(),
  };

  // ---- bandeja de conciliación (nada se inventa: solo se muestra)
  const bandeja = [];
  for (const l of lineas) if (l.enlace === "sin_cuenta") bandeja.push({ tipo: "sin_coincidencia", texto: "Asignación pendiente de conciliar: el servicio no encuentra su cuenta madre", plataforma: l.plataforma, fecha: l.fecha, beneficiario: l.beneficiario, monto: l.monto, referencia: l.referencia, compraId: l.compraId, clienteId: l.clienteId });
  for (const l of lineas) if (l.planSinClasificar) bandeja.push({ tipo: "plan_sin_clasificar", texto: "HBO con plan histórico sin clasificar (no se infiere por capacidad)", plataforma: l.plataforma, fecha: l.fecha, beneficiario: l.beneficiario, monto: l.monto, referencia: l.referencia, compraId: l.compraId });
  for (const l of lineas) if (l.pendiente > 0) bandeja.push({ tipo: "pago_pendiente", texto: "Venta con saldo por cobrar", plataforma: l.plataforma, fecha: l.fecha, beneficiario: l.beneficiario, monto: l.pendiente, referencia: l.referencia });
  for (const p of porPlataforma) if (p.estado === "costo_pendiente") bandeja.push({ tipo: "costo_pendiente", texto: `Ingresos sin compra registrada para ${p.nombre}`, plataforma: p.plataforma, monto: p.cobradoHnl });
  { const vistas = new Map(); for (const l of lineas) if (l.cuentaId && l.cobrado > 0 && !l.costoCubierto) vistas.set(l.cuentaId, { plataforma: l.plataforma, correo: l.cuentaCorreo, monto: r2((vistas.get(l.cuentaId) || { monto: 0 }).monto + l.cobrado) });
    for (const [id, v] of vistas) bandeja.push({ tipo: "costo_pendiente", texto: `Cuenta ${v.correo || id} sin compra que cubra el período`, plataforma: v.plataforma, monto: v.monto, referencia: id }); }
  for (const c of piezas) if (c.aviso) bandeja.push({ tipo: "datos_incompletos", texto: `Lote sin consumo calculado: ${c.producto}`, plataforma: c.plataforma, fecha: c.fechaCompra, monto: c.costoHnl, referencia: c.loteId });
  for (const e of esperados) bandeja.push({ tipo: "ingreso_sin_confirmar", texto: e.estado === "vencido_sin_cobro" ? "Renovación vencida sin cobro registrado" : "Renovación por cobrar", plataforma: e.plataforma, fecha: e.fecha, beneficiario: e.beneficiario, monto: e.precio, compraId: e.compraId });

  return { resumen, porPlataforma, lineas, esperados, costos: piezas, desembolsos: caja, bandeja, ciclosActivacion: [...ciclosAct.values()], _movs: movimientos };
}

// ---------------------------------------------------------------- 5) CONCILIACIÓN DE CARTERA (CRM ↔ movimientos)
// Explica por qué «75 clientes vigentes» del CRM no son «35 clientes con cobro en noviembre»: cada servicio vigente al corte
// queda en un estado (cobrado, parcial, sin movimiento, sin cuenta, plan sin clasificar) con su último cobro y próxima renovación.
export function conciliarCartera(ctx, calc, { plataforma = "", vendedor = "", desde, hasta, hoy = "" }, deps) {
  const corte = hoy && hasta > hoy ? hoy : hasta;
  const famOk = (f) => !plataforma || f === plataforma || (plataforma === "hbomax_todas" && String(f).startsWith("hbomax")) || (plataforma === "hbomax" && String(f).startsWith("hbomax"));
  const vendOk = (v) => !vendedor || String(v || "Sin vendedor").toLowerCase() === vendedor.toLowerCase();
  // último cobro de cada servicio (con los movimientos leídos), para «sin movimiento en el período»
  const ultimo = new Map();
  for (const v of deps.ventasACostear(calc._movs, "2000-01-01", deps.R, { paraIngresos: true })) { if (v.anulada) continue; for (const cid of [v.compraId, ...(v.compraIds || []), ...((v.asignaciones || []).map((a) => a.compraId))].filter(Boolean)) { const u = ultimo.get(cid); if (!u || v.fecha > u.fecha) ultimo.set(cid, { fecha: v.fecha, monto: r2(v.monto), tipo: v.subtipo === "compra_nueva" ? "alta" : "renovación" }); } }
  const lineasPor = new Map(); for (const l of calc.lineas) { if (!l.compraId) continue; (lineasPor.get(l.compraId) || lineasPor.set(l.compraId, []).get(l.compraId)).push(l); }
  const filas = [];
  const vistos = new Set();
  for (const sv of ctx.servicios) {
    const cid = String(sv.compraId || ""); const cta = cid ? ctx.cuentaPorCompra.get(cid) : null;
    const fam = familia(sv.plataforma, sv.planHbo || (cta && cta.planHbo)); if (!famOk(fam) || !vendOk(sv.vendedor)) continue;
    const venc = ymd(sv.fechaRenovacion); const mis = lineasPor.get(cid) || [];
    const vig = !!venc && venc >= corte;
    if (!vig && !mis.length) continue;
    vistos.add(cid);
    const cli = ctx.clientePorId.get(sv._clienteId) || {};
    const cobrado = r2(mis.reduce((a, l) => a + l.cobrado, 0)), pend = r2(mis.reduce((a, l) => a + l.pendiente, 0));
    let estado = mis.length ? (pend > 0 ? (cobrado > 0 ? "parcial" : "pendiente") : mis.some((l) => l.tipo === "venta") ? "alta_cobrada" : "renovacion_cobrada") : "sin_movimiento";
    const avisos = [];
    if (!cta && PLAT_CUENTA.has(fam)) avisos.push("sin_cuenta");
    if (fam === "hbomax") avisos.push("plan_sin_clasificar");
    if (mis.some((l) => l.combo)) avisos.push("combo");
    const u = ultimo.get(cid);
    filas.push({ compraId: cid, clienteId: sv._clienteId, titular: s(cli.nombre, 80), beneficiario: s(sv.beneficiarioNombre || sv.beneficiario || (cta && cta._perfilPorCompra.get(cid)) || cli.nombre, 80), vendedor: s(sv.vendedor, 60) || "Sin vendedor",
      plataforma: fam, cuentaId: cta ? cta.id : "", cuentaCorreo: cta ? s(cta.correo) : s(sv.correo), perfil: cta ? s(cta._slotPorCompra.get(cid), 20) : "", precio: r2(sv.precio), vigente: vig, proximaRenovacion: venc,
      estado, cobradoHnl: cobrado, pendienteHnl: pend, movimientos: mis.map((l) => ({ fecha: l.fecha, tipo: l.tipo, cobrado: l.cobrado, banco: l.banco, fuente: l.fuente, referencia: l.referencia })),
      ultimoCobro: u || null, avisos });
  }
  // cobros del período cuyo servicio ya no está en ninguna ficha (o sin compraId): se muestran, no se descartan
  for (const l of calc.lineas) { if (!famOk(l.plataforma) || !vendOk(l.vendedor) || (l.compraId && vistos.has(l.compraId))) continue; filas.push({ compraId: l.compraId, clienteId: l.clienteId, titular: l.titular, beneficiario: l.beneficiario, vendedor: l.vendedor, plataforma: l.plataforma, cuentaId: l.cuentaId, cuentaCorreo: l.cuentaCorreo, perfil: l.perfil, precio: l.precioFicha, vigente: false, proximaRenovacion: "", estado: l.pendiente > 0 ? "parcial" : l.tipo === "venta" ? "alta_cobrada" : "renovacion_cobrada", cobradoHnl: l.cobrado, pendienteHnl: l.pendiente, movimientos: [{ fecha: l.fecha, tipo: l.tipo, cobrado: l.cobrado, banco: l.banco, fuente: l.fuente, referencia: l.referencia }], ultimoCobro: null, avisos: [l.compraId ? "servicio_sin_ficha" : "sin_identificador"] }); }
  const vig = filas.filter((f) => f.vigente);
  const resumen = {
    corte, serviciosVigentes: vig.length, clientesVigentes: new Set(vig.map((f) => f.clienteId)).size,
    conCobroEnPeriodo: filas.filter((f) => f.cobradoHnl > 0).length, clientesConCobro: new Set(filas.filter((f) => f.cobradoHnl > 0).map((f) => f.clienteId)).size,
    vigentesSinMovimiento: vig.filter((f) => f.estado === "sin_movimiento").length, pendientesOParciales: filas.filter((f) => f.estado === "pendiente" || f.estado === "parcial").length,
    altas: filas.filter((f) => f.estado === "alta_cobrada").length, renovaciones: filas.filter((f) => f.estado === "renovacion_cobrada").length,
    sinCuenta: filas.filter((f) => f.avisos.includes("sin_cuenta")).length, planSinClasificar: filas.filter((f) => f.avisos.includes("plan_sin_clasificar")).length,
    cobradoHnl: r2(filas.reduce((a, f) => a + f.cobradoHnl, 0)),
  };
  return { resumen, filas: filas.sort((a, b) => (a.estado === b.estado ? 0 : a.estado === "sin_movimiento" ? 1 : -1) || a.beneficiario.localeCompare(b.beneficiario)) };
}

// Todas las cuentas de una plataforma (con o sin movimiento): estado de vinculación y costo — botón «Cuentas».
// ---------------------------------------------------------------- R198h · POR QUÉ una cuenta sí o no tiene costo en el período
export const ESTADOS_COSTO = Object.freeze({
  atribuido: "Vinculada y atribuida", ciclo_vigente: "Cubierta por su activación", cobertura_desconocida: "Costo histórico · cobertura desconocida",
  fuera_periodo: "Compra fuera del período", sin_compra: "Sin compra identificada",
});
const RELACION_TXT = Object.freeze({ imputado: "Imputada a este período", ciclo_vigente: "Activación vigente · cubre la cuenta hasta la próxima", ciclo_cerrado: "Activación anterior · su ciclo ya cerró", cobertura_desconocida: "Anterior · sin duración documentada", cobertura_terminada: "Cobertura documentada terminó antes", cobertura_posterior: "Cobertura documentada empieza después", posterior: "Compra posterior al período" });
function compraFila(l, desde, hasta, imputado, cicloLoteId = "", esActivacion = false) {
  const f = ymd(l.fecha);
  const relacion = imputado > 0 ? "imputado" : cicloLoteId && l.id === cicloLoteId ? "ciclo_vigente" : esActivacion && !l._ciclo && f <= hasta ? "ciclo_cerrado" : l._ciclo ? (ymd(l._ciclo.coberturaHasta) < desde ? "cobertura_terminada" : "cobertura_posterior") : f > hasta ? "posterior" : "cobertura_desconocida";
  return { loteId: l.id, fecha: f, fechaActivacion: ymd(l.fechaActivacion), producto: s(l.producto, 60), proveedor: s(l.proveedor, 60), modelo: s(l.modelo, 20), unidad: s(l.unidad, 20), cantidad: Number(l.cantidad) || 0, moneda: l.moneda || "HNL", montoMoneda: l.costoTotalMoneda, tasa: l.tasa, costoHnl: r2(l.costoTotalHnl),
    pago: s(l.cuentaPagoNombre || l.pago, 60), referencia: s(l.referencia, 80), cuentaId: s(l._cuentaId), vinculo: l._vinculo || (l.cuentaInventarioId ? "por_id" : "sin_vinculo"),
    ciclo: l._ciclo ? { desde: ymd(l._ciclo.coberturaDesde), hasta: ymd(l._ciclo.coberturaHasta), evidencia: s(l._ciclo.evidencia, 200), por: s(l._ciclo.actualizadoPor || l._ciclo.creadoPor, 40) } : null,
    imputadoHnl: r2(imputado), relacion, relacionTxt: RELACION_TXT[relacion], cantidadNoAcreditada: cantidadNoAcreditada(l) };
}
export function estadoCostoCuenta(ctx, calc, cuentaId) {
  const { desde, hasta } = calc.resumen;
  const piezas = calc.costos.filter((c) => c.cuentaId === cuentaId);
  const imp = new Map(); for (const c of piezas) if (c.loteId) imp.set(c.loteId, (imp.get(c.loteId) || 0) + c.costoHnl);
  const ci = (calc.ciclosActivacion || []).find((c) => c.cuentaId === cuentaId) || null; // R198i
  const esAct = (l) => reglaCosto(l, ctx.productosPorId.get(l.productoId) || {}) === "activacion";
  const compras = ctx.lotes.filter((l) => l._cuentaId === cuentaId && l.estado !== "anulado").map((l) => compraFila(l, desde, hasta, imp.get(l.id) || 0, ci ? ci.loteId : "", esAct(l))).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const previas = compras.filter((c) => c.relacion === "cobertura_desconocida");
  let estado, motivo;
  if (piezas.length) { estado = "atribuido"; motivo = piezas.map((c) => c.criterio).filter(Boolean).join(" · "); }
  else if (ci) { estado = "ciclo_vigente"; motivo = `Activada el ${ci.fechaActivacion} por L${ci.costoHnl}${ci.moneda === "USDT" ? ` (${ci.montoMoneda} USDT a ${ci.tasa})` : ""}. Ese es el costo de la cuenta hasta la próxima activación: en este período suma L0 de costo y todo lo cobrado es ganancia del ciclo.`; }
  else if (!compras.length) { estado = "sin_compra"; motivo = "No hay compra registrada ni conciliada para esta cuenta (no se pone L0 como costo)."; }
  else if (previas.length) { const u = previas[0]; estado = "cobertura_desconocida"; motivo = `Última compra ${u.fecha}: L${u.costoHnl}${u.moneda === "USDT" ? ` (${u.montoMoneda} USDT a ${u.tasa})` : ""}. Su duración no está documentada: no se imputa a este período ni se inventan meses.`; }
  else { estado = "fuera_periodo"; motivo = "Sus compras están identificadas, pero su cobertura no toca este período."; }
  return { estado, etiqueta: ESTADOS_COSTO[estado], motivo, costoPeriodoHnl: r2(piezas.reduce((a, c) => a + c.costoHnl, 0)), historicoNoImputadoHnl: r2(previas.reduce((a, c) => a + c.costoHnl, 0)), ultima: compras[0] || null, compras, ciclo: ci };
}
// Conciliación de compras de una plataforma (vista previa SOLO LECTURA): enlazadas, conciliadas, sin cuenta, fuera del período,
// cantidades «perfil-mes» no acreditadas y producto que no coincide con el plan real. No reparte nada por suposición.
export function conciliacionCompras(ctx, calc, plataforma) {
  const { desde, hasta } = calc.resumen; const b = base(plataforma);
  const imp = new Map(); for (const c of calc.costos) if (c.loteId) imp.set(c.loteId, (imp.get(c.loteId) || 0) + c.costoHnl);
  const cicloLotes = new Set((calc.ciclosActivacion || []).map((c) => c.loteId));
  const correos = [...ctx.cuentasPorId.values()].filter((a) => base(a._familia) === b && s(a.correo)).map((a) => ({ id: a.id, correo: s(a.correo).toLowerCase() }));
  const filas = [];
  for (const l of ctx.lotes) {
    if (l.estado === "anulado") continue;
    const p = ctx.productosPorId.get(l.productoId) || {}; const cta = ctx.cuentasPorId.get(s(l._cuentaId)) || null;
    const fam = familia(p.plataformaKey || l.plataformaKey || l.producto, cta && cta.planHbo); if (base(fam) !== b || (fam !== plataforma && plataforma !== b && fam !== b)) continue; // su plan + las compras sin cuenta (sin plan)
    const f = compraFila(l, desde, hasta, imp.get(l.id) || 0, cicloLotes.has(l.id) ? l.id : "", reglaCosto(l, p) === "activacion" && !!s(l._cuentaId)); // R198i
    const plan = s(cta && cta.planHbo, 20).toLowerCase();
    const productoPlanDistinto = b === "hbomax" && !!plan && ((/platinum/i.test(f.producto) && plan === "standard") || (/standard/i.test(f.producto) && plan === "platinum"));
    let propuesta = null;
    if (f.vinculo === "sin_vinculo") { const txt = `${l.referencia || ""} ${l.notas || ""} ${l.producto || ""}`.toLowerCase(); const m = correos.filter((c) => txt.includes(c.correo)); propuesta = m.length === 1 ? { cuentaId: m[0].id, correo: m[0].correo, evidencia: "El correo de la cuenta aparece en la referencia/notas de la compra" } : m.length > 1 ? { ambigua: true, candidatos: m.slice(0, 5) } : null; }
    filas.push({ ...f, plataforma: fam, correo: cta ? s(cta.correo) : "", plan: plan || "", productoPlanDistinto, propuesta, enPeriodo: f.fecha >= desde && f.fecha <= hasta });
  }
  filas.sort((x, y) => y.fecha.localeCompare(x.fecha));
  const n = (fn) => filas.filter(fn).length;
  return { filas, resumen: { compras: filas.length, porId: n((x) => x.vinculo === "por_id"), conciliadas: n((x) => x.vinculo === "conciliado"), sinVinculo: n((x) => x.vinculo === "sin_vinculo"), imputadas: n((x) => x.relacion === "imputado"), ciclosVigentes: n((x) => x.relacion === "ciclo_vigente"), ciclosCerrados: n((x) => x.relacion === "ciclo_cerrado"), coberturaDesconocida: n((x) => x.relacion === "cobertura_desconocida"), fueraPeriodo: n((x) => ["cobertura_terminada", "cobertura_posterior", "posterior"].includes(x.relacion)), cantidadNoAcreditada: n((x) => x.cantidadNoAcreditada), productoPlanDistinto: n((x) => x.productoPlanDistinto), costoImputadoHnl: r2(filas.reduce((a, x) => a + x.imputadoHnl, 0)), costoHistoricoHnl: r2(filas.reduce((a, x) => a + x.costoHnl, 0)) } };
}

// R198i · RESULTADO DEL CICLO de activación (regla del dueño): lo que costó activar la cuenta vs. TODO lo cobrado desde esa
// activación hasta hoy (o hasta la próxima). calcAmplio = calcularGanancias desde la activación más antigua hasta hoy.
export function resultadoCiclos(calcAmplio, { leidoDesde = "" } = {}) {
  const out = new Map(); if (!calcAmplio) return out;
  const porCta = new Map(); for (const l of calcAmplio.lineas) if (l.cuentaId) (porCta.get(l.cuentaId) || porCta.set(l.cuentaId, []).get(l.cuentaId)).push(l);
  for (const c of calcAmplio.ciclosActivacion || []) {
    const lin = (porCta.get(c.cuentaId) || []).filter((l) => l.fecha >= c.fechaActivacion);
    const cobrado = r2(lin.reduce((a, l) => a + l.cobrado, 0));
    out.set(c.cuentaId, { ...c, hastaFecha: calcAmplio.resumen.hasta, cobradoHnl: cobrado, pendienteHnl: r2(lin.reduce((a, l) => a + l.pendiente, 0)), resultadoHnl: r2(cobrado - c.costoHnl), recuperado: cobrado >= c.costoHnl,
      cobros: lin.length, clientes: new Set(lin.map((l) => l.clienteId).filter(Boolean)).size, completo: !leidoDesde || c.fechaActivacion >= leidoDesde });
  }
  return out;
}

export function cuentasDePlataforma(ctx, calc, plataforma, ciclos = null) {
  const famOk = (f) => f === plataforma || (plataforma === "hbomax" && String(f).startsWith("hbomax"));
  const out = [];
  for (const a of ctx.cuentasPorId.values()) {
    if (!famOk(a._familia)) continue;
    const lin = calc.lineas.filter((l) => l.cuentaId === a.id), cos = calc.costos.filter((c) => c.cuentaId === a.id), esp = calc.esperados.filter((e) => e.cuentaId === a.id);
    const ocupados = Array.isArray(a.clientes) ? a.clientes.length : Number(a.ocupados) || 0;
    const cobrado = r2(lin.reduce((x, l) => x + l.cobrado, 0)), costo = r2(cos.reduce((x, c) => x + c.costoHnl, 0));
    out.push({ cuentaId: a.id, correo: s(a.correo), plataforma: a._familia, nombre: nombrePlataforma(a._familia), plan: s(a.planHbo || a.plan, 20), capacidad: Number(a.capacidad) || ocupados, ocupados, acceso: a._pseudo ? "acceso_individual" : "cuenta_madre", proveedor: s(a.proveedor, 40),
      clientes: new Set(lin.map((l) => l.clienteId).filter(Boolean)).size, altas: lin.filter((l) => l.tipo === "venta").length, renovaciones: lin.filter((l) => l.tipo === "renovacion").length,
      cobradoHnl: cobrado, pendienteHnl: r2(lin.reduce((x, l) => x + l.pendiente, 0)), esperadoHnl: r2(esp.reduce((x, e) => x + e.precio, 0)), costoHnl: costo, conCosto: cos.length > 0 || lin.some((l) => l.costoCubierto),
      resultadoHnl: cos.length || lin.some((l) => l.cubiertaPorCiclo) ? r2(cobrado - costo) : null, sinMovimiento: !lin.length && !esp.length, planSinClasificar: a._familia === "hbomax", ...(() => { const ec = estadoCostoCuenta(ctx, calc, a.id); return { estadoCosto: ec.estado, estadoCostoTxt: ec.etiqueta, motivoCosto: ec.motivo, historicoNoImputadoHnl: ec.historicoNoImputadoHnl, ultimaCompra: ec.ultima ? { fecha: ec.ultima.fecha, costoHnl: ec.ultima.costoHnl, moneda: ec.ultima.moneda, montoMoneda: ec.ultima.montoMoneda } : null }; })(), cicloActual: ciclos ? ciclos.get(a.id) || null : null });
  }
  return out.sort((a, b) => b.cobradoHnl - a.cobradoHnl || a.correo.localeCompare(b.correo));
}

// Detalle de UNA cuenta madre (Fase 3): perfiles, clientes y beneficiarios, precios, cobros, esperados, compras y resultado.
export function detalleCuenta(ctx, calc, cuentaId, ciclos = null) {
  const a = ctx.cuentasPorId.get(cuentaId); if (!a) return null;
  const lineas = calc.lineas.filter((l) => l.cuentaId === cuentaId), esperados = calc.esperados.filter((e) => e.cuentaId === cuentaId);
  const ec = estadoCostoCuenta(ctx, calc, cuentaId); // R198h · compras por cuenta efectiva (ID o conciliada) + relación con el período
  const costos = calc.costos.filter((c) => c.cuentaId === cuentaId), compras = ec.compras;
  const ocupados = Array.isArray(a.clientes) ? a.clientes.length : Number(a.ocupados) || 0, capacidad = Number(a.capacidad) || ocupados;
  const perfiles = (Array.isArray(a.clientes) ? a.clientes : []).map((cl, i) => {
    const cid = String(cl.compraId || ""); const sv = ctx.servPorCompra.get(cid) || null; const fic = sv ? ctx.clientePorId.get(sv._clienteId) || {} : ctx.clientePorId.get(String(cl.clienteId || "")) || {};
    const mis = lineas.filter((l) => l.compraId === cid).sort((x, y) => y.fecha.localeCompare(x.fecha));
    return { perfil: cl.slot != null ? `Perfil ${cl.slot}` : `Perfil ${i + 1}`, beneficiario: s((sv && (sv.beneficiarioNombre || sv.beneficiario)) || cl.nombre || fic.nombre, 80), titular: s(fic.nombre, 80), vendedor: s(sv && sv.vendedor, 60) || "Sin vendedor",
      precio: sv ? r2(sv.precio) : null, ultimaVenta: mis[0] ? mis[0].fecha : "", ultimoTipo: mis[0] ? mis[0].tipo : "", proximoVencimiento: sv ? ymd(sv.fechaRenovacion) : "",
      cobradoHnl: r2(mis.reduce((x, l) => x + l.cobrado, 0)), pendienteHnl: r2(mis.reduce((x, l) => x + l.pendiente, 0)), descuentoHnl: r2(mis.reduce((x, l) => x + (l.descuento || 0), 0)), recibos: mis.map((l) => ({ fecha: l.fecha, tipo: l.tipo, monto: l.monto, cobrado: l.cobrado, banco: l.banco, fuente: l.fuente, registradoPor: l.registradoPor, referencia: l.referencia, combo: l.combo })),
      esperadoHnl: r2(esperados.filter((e) => e.compraId === cid).reduce((x, e) => x + e.precio, 0)), compraId: cid, referencias: mis.map((l) => l.referencia) };
  });
  const cobrado = r2(lineas.reduce((x, l) => x + l.cobrado, 0)), costo = r2(costos.reduce((x, c) => x + c.costoHnl, 0));
  const ciclo = compras[0] ? r2(compras[0].costoHnl) : null;
  const cic = ciclos ? ciclos.get(cuentaId) || null : null, conCosto = costos.length > 0 || lineas.some((l) => l.cubiertaPorCiclo); // R198i
  return {
    cuentaId, correo: s(a.correo), plataforma: familia(a.plataforma, a.planHbo), nombre: nombrePlataforma(familia(a.plataforma, a.planHbo)), plan: s(a.planHbo || a.plan, 30), capacidad, ocupados, disponibles: Math.max(0, capacidad - ocupados),
    perfiles, lineas, esperados, costos, compras,
    cobradoHnl: cobrado, pendienteHnl: r2(lineas.reduce((x, l) => x + l.pendiente, 0)), esperadoHnl: r2(esperados.reduce((x, e) => x + e.precio, 0)),
    costoPeriodoHnl: costo, resultadoPeriodoHnl: conCosto ? r2(cobrado - costo) : null, margen: conCosto && cobrado > 0 ? pct(r2(cobrado - costo), cobrado) : null,
    costoCicloHnl: cic ? cic.costoHnl : ciclo, resultadoCicloHnl: cic ? cic.resultadoHnl : ciclo != null ? r2(cobrado - ciclo) : null,
    estado: !conCosto && cobrado > 0 ? "costo_pendiente" : !lineas.length ? "sin_ingresos" : "ok",
    estadoCosto: ec.estado, estadoCostoTxt: ec.etiqueta, motivoCosto: ec.motivo, historicoNoImputadoHnl: ec.historicoNoImputadoHnl,
    cicloActual: cic, // R198i
  };
}

// Filas para Excel (Fase 7): una por línea de ingreso, esperado y costo. El beneficiario NO se cambia por el titular.
export function filasExcel(calc) {
  const f = [];
  for (const l of calc.lineas) f.push({ Fecha: l.fecha, Tipo: l.tipo === "renovacion" ? "Renovación cobrada" : l.tipo === "venta" ? "Alta nueva" : "Otro cobro", Plataforma: nombrePlataforma(l.plataforma), "Cuenta madre": l.cuentaCorreo, Perfil: l.perfil, Beneficiario: l.beneficiario, "Titular de ficha": l.titular, Vendedor: l.vendedor, Proveedor: "", "Ingreso cobrado": l.cobrado, "Ingreso pendiente": l.pendiente, "Costo imputado": "", Resultado: "", Moneda: "HNL", Tasa: "", Estado: l.pendiente > 0 ? (l.cobrado > 0 ? "Pago parcial" : "Pago pendiente") : l.enlace === "sin_cuenta" ? "Asignación pendiente de conciliar" : l.costoCubierto ? "Conciliado" : "Costo incompleto", Fuente: l.fuente, Banco: l.banco, "Registrado por": l.registradoPor, Combo: l.combo ? "Sí" : "", Referencia: l.referencia });
  for (const e of calc.esperados) f.push({ Fecha: e.fecha, Tipo: "Renovación esperada", Plataforma: nombrePlataforma(e.plataforma), "Cuenta madre": e.cuentaCorreo, Perfil: "", Beneficiario: e.beneficiario, "Titular de ficha": e.titular, Vendedor: e.vendedor, Proveedor: "", "Ingreso cobrado": 0, "Ingreso pendiente": e.precio, "Costo imputado": "", Resultado: "", Moneda: "HNL", Tasa: "", Estado: "Ingreso sin confirmar", Fuente: "", Banco: "", "Registrado por": "", Combo: "", Referencia: e.compraId });
  for (const c of calc.costos) f.push({ Fecha: c.fechaCompra || "", Tipo: `Costo · ${c.regla}`, Plataforma: nombrePlataforma(c.plataforma), "Cuenta madre": c.correo || "", Perfil: "", Beneficiario: "", "Titular de ficha": "", Vendedor: "", Proveedor: c.proveedor || "", "Ingreso cobrado": "", "Ingreso pendiente": "", "Costo imputado": c.costoHnl, Resultado: "", Moneda: c.moneda || "HNL", Tasa: c.tasa ?? "", Estado: c.aviso ? "Datos incompletos" : "Costo real", Fuente: "", Banco: "", "Registrado por": "", Combo: "", Referencia: c.loteId || c.familiaId || "" });
  return f;
}

// ---------------------------------------------------------------- 6) AUDITORÍA DE CARTERA (R197c · SOLO LECTURA)
// PDF «Autorización limitada: auditoría real de cartera, cobros y ganancias» (18/11/2026).
// Una fila por SERVICIO (compraId) vigente al corte o con evento en el período, clasificada SIN inferir:
//   alta_cobrada · renovacion_cobrada · cobro_socios · ajuste_sin_pago · renovacion_sin_cobro («por conciliar», NO «impagada»)
//   · sin_movimiento (vigente sin ingreso en el rango; se muestra el último cobro verificable) · datos_insuficientes (sin compraId).
// Además: cobros del período sin servicio en ninguna ficha (cobro_sin_servicio). Nunca escribe, nunca crea IDs.
export const CLASES_AUDITORIA = Object.freeze({
  alta_cobrada: "Alta cobrada", renovacion_cobrada: "Renovación cobrada", cobro_socios: "Cobro por Panel de Socios",
  ajuste_sin_pago: "Ajuste de fecha sin pago", renovacion_sin_cobro: "Renovación sin cobro identificado (por conciliar)",
  sin_movimiento: "Sin movimiento del período", datos_insuficientes: "Datos insuficientes (sin ID de compra)", cobro_sin_servicio: "Cobro sin servicio en ficha",
});
const enRangoIso = (iso, desde, hasta) => { const f = String(iso || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(f) && f >= desde && f <= hasta; };
export function enmascararCorreo(c) { const t = s(c, 160).toLowerCase(); if (!t) return ""; const [u, d] = t.split("@"); if (!d) return t.length <= 4 ? "***" : `${t.slice(0, 2)}***${t.slice(-2)}`; return `${u.slice(0, 2)}***@${d}`; }

export function auditarCartera(ctx, calc, { desde, hasta, hoy = "", plataforma = "", vendedor = "" }, deps) {
  const corte = hoy && hasta > hoy ? hoy : hasta;
  const famOk = (f) => !plataforma || f === plataforma || (plataforma === "hbomax" && String(f).startsWith("hbomax"));
  const vendOk = (v) => !vendedor || String(v || "Sin vendedor").toLowerCase() === vendedor.toLowerCase();
  const vigenteMov = (m) => !deps.R.anuladoOReversa(m);
  // Cobros por Panel de Socios del período (no pasan por «ventas»: se enlazan por las fichas que el socio amarró)
  const socioPorCompra = new Map(); const sociosSinFicha = [];
  for (const m of calc._movs || []) {
    if (!vigenteMov(m) || !["compra_socio", "renovacion_socio"].includes(String(m.subtipo || "")) || String(m.tipo) !== "ingreso") continue;
    const f = deps.R.movementYmd(m); if (!f || f < desde || f > hasta) continue;
    const cids = [...new Set([...(Array.isArray(m.fichasVinculadas) ? m.fichasVinculadas.map((v) => s(v && v.compraId)) : []), ...(Array.isArray(m.asignaciones) ? m.asignaciones.map((a) => s(a && a.compraId)) : []), m.subtipo === "renovacion_socio" ? s(m.compraId) : ""].filter(Boolean))];
    const ref = { movimientoId: s(m.id, 160), fecha: f, monto: r2(m.monto), banco: s(m.banco, 40), pedidoId: s(m.pedidoId, 120), socio: s(m.socioNombre, 60), compartido: cids.length > 1 };
    if (!cids.length) { sociosSinFicha.push(ref); continue; }
    for (const cid of cids) (socioPorCompra.get(cid) || socioPorCompra.set(cid, []).get(cid)).push(ref);
  }
  const ultimo = new Map();
  for (const v of deps.ventasACostear(calc._movs || [], "2000-01-01", deps.R, { paraIngresos: true })) { if (v.anulada) continue; for (const cid of [v.compraId, ...(v.compraIds || []), ...((v.asignaciones || []).map((a) => a.compraId))].filter(Boolean)) { const u = ultimo.get(cid); if (!u || v.fecha > u.fecha) ultimo.set(cid, { fecha: v.fecha, movimientoId: v.id, tipo: v.subtipo === "compra_nueva" ? "alta" : "renovación" }); } }
  const lineasPor = new Map(); for (const l of calc.lineas) { if (!l.compraId) continue; (lineasPor.get(l.compraId) || lineasPor.set(l.compraId, []).get(l.compraId)).push(l); }
  const costoCta = new Set(calc.costos.filter((c) => c.cuentaId).map((c) => c.cuentaId)), costoPlat = new Set(calc.costos.filter((c) => !c.cuentaId).map((c) => c.plataforma));
  const filas = [], vistos = new Set();
  for (const sv of ctx.servicios) {
    const cid = s(sv.compraId, 160); const cta = cid ? ctx.cuentaPorCompra.get(cid) : null;
    const fam = familia(sv.plataforma, sv.planHbo || (cta && cta.planHbo)); if (!famOk(fam) || !vendOk(sv.vendedor)) continue;
    const venc = ymd(sv.fechaRenovacion); const vig = !!venc && venc >= corte;
    const mis = cid ? lineasPor.get(cid) || [] : []; const soc = cid ? socioPorCompra.get(cid) || [] : [];
    const ur = sv.ultimaRenovacion && typeof sv.ultimaRenovacion === "object" ? sv.ultimaRenovacion : null;
    const aj = sv.ultimoAjusteAdministrativo && typeof sv.ultimoAjusteAdministrativo === "object" ? sv.ultimoAjusteAdministrativo : null;
    const renovEnRango = ur && enRangoIso(ur.at, desde, hasta), ajusteEnRango = aj && enRangoIso(aj.at, desde, hasta);
    if (!vig && !mis.length && !soc.length && !renovEnRango && !ajusteEnRango) continue;
    if (cid) vistos.add(cid);
    const cli = ctx.clientePorId.get(sv._clienteId) || {};
    const cobrado = r2(mis.reduce((a, l) => a + l.cobrado, 0) + soc.reduce((a, x) => a + (x.compartido ? 0 : x.monto), 0));
    const ausencias = [];
    let clase;
    if (!cid) { clase = "datos_insuficientes"; ausencias.push("sin compraId: no se puede enlazar con cobros"); }
    else if (mis.some((l) => l.tipo === "venta")) clase = "alta_cobrada";
    else if (mis.length) clase = "renovacion_cobrada";
    else if (soc.length) clase = "cobro_socios";
    else if (ajusteEnRango) clase = "ajuste_sin_pago";
    else if (renovEnRango) { clase = "renovacion_sin_cobro"; if (s(ur.lote)) ausencias.push(`la renovación cita el pago ${s(ur.lote, 80)} pero no está en el libro del período`); }
    else clase = "sin_movimiento";
    if (!cta && PLAT_CUENTA.has(fam)) ausencias.push("sin cuenta madre enlazada");
    if (cid && ctx.enlacePorCorreo.has(cid)) ausencias.push("cuenta enlazada solo por correo");
    if (fam === "hbomax") ausencias.push("HBO sin plan clasificado");
    const conCosto = !!((cta && costoCta.has(cta.id)) || costoPlat.has(fam));
    if (!conCosto) ausencias.push("sin costo vinculado en el período");
    const u = cid ? ultimo.get(cid) : null;
    const ev = mis.length ? mis : [];
    filas.push({
      clase, compraId: cid, clienteId: s(sv._clienteId, 160), titular: s(cli.nombre || cli.nombrePerfil, 80),
      beneficiario: s(sv.beneficiarioNombre || sv.beneficiario || (cta && cta._perfilPorCompra.get(cid)) || cli.nombre, 80),
      plataforma: fam, vendedor: s(sv.vendedor, 60) || "Sin vendedor", cuentaMadreId: cta ? s(cta.id, 160) : "", cuentaCorreo: enmascararCorreo(cta ? cta.correo : sv.correo), acceso: cta ? (cta._pseudo ? "acceso_individual" : "cuenta_madre") : "",
      perfil: cta ? s(cta._slotPorCompra.get(cid), 20) : "", precioFicha: r2(sv.precio), vigente: vig, proximaRenovacion: venc,
      fechaAnterior: ymd((ajusteEnRango ? aj : ur || {}).fechaAnterior), fechaNueva: ymd((ajusteEnRango ? aj : ur || {}).fechaNueva),
      renovadoPor: s((ajusteEnRango ? aj : ur || {}).por, 40), renovadoAt: s((ajusteEnRango ? aj : ur || {}).at, 25), origenRenovacion: s((ajusteEnRango ? aj : ur || {}).origen, 20), motivoAjuste: ajusteEnRango ? s(aj.motivo, 120) : "",
      cobradoHnl: cobrado, pendienteHnl: r2(mis.reduce((a, l) => a + l.pendiente, 0)),
      movimientos: [...ev.map((l) => ({ movimientoId: l.referencia, cobroIds: l.cobroIds || [], fecha: l.fecha, tipo: l.tipo === "venta" ? "alta" : l.tipo === "renovacion" ? "renovación" : "otro", cobrado: l.cobrado, banco: l.banco, origen: l.fuente, registradoPor: l.registradoPor, combo: !!l.combo })),
        ...soc.map((x) => ({ movimientoId: x.movimientoId, cobroIds: [x.movimientoId], fecha: x.fecha, tipo: "socios", cobrado: x.compartido ? null : x.monto, banco: x.banco, origen: "socios", registradoPor: x.socio, combo: x.compartido, pedidoId: x.pedidoId }))],
      ultimoCobro: u, costoVinculado: conCosto, ausencias,
      estadoConciliacion: clase === "alta_cobrada" || clase === "renovacion_cobrada" || clase === "cobro_socios" ? (ausencias.length ? "cobrado_con_faltantes" : "conciliado") : clase === "sin_movimiento" ? "sin_movimiento" : "por_conciliar",
    });
  }
  for (const l of calc.lineas) { // cobros del período cuyo servicio ya no está en ninguna ficha
    if (!famOk(l.plataforma) || !vendOk(l.vendedor) || (l.compraId && vistos.has(l.compraId))) continue;
    filas.push({ clase: "cobro_sin_servicio", compraId: l.compraId, clienteId: l.clienteId, titular: l.titular, beneficiario: l.beneficiario, plataforma: l.plataforma, vendedor: l.vendedor, cuentaMadreId: l.cuentaId, cuentaCorreo: enmascararCorreo(l.cuentaCorreo), acceso: "", perfil: l.perfil, precioFicha: l.precioFicha, vigente: false, proximaRenovacion: "", fechaAnterior: "", fechaNueva: "", renovadoPor: "", renovadoAt: "", origenRenovacion: "", motivoAjuste: "",
      cobradoHnl: l.cobrado, pendienteHnl: l.pendiente, movimientos: [{ movimientoId: l.referencia, cobroIds: l.cobroIds || [], fecha: l.fecha, tipo: l.tipo === "venta" ? "alta" : l.tipo === "renovacion" ? "renovación" : "otro", cobrado: l.cobrado, banco: l.banco, origen: l.fuente, registradoPor: l.registradoPor, combo: !!l.combo }], ultimoCobro: null, costoVinculado: !!l.costoCubierto,
      ausencias: [l.compraId ? "el compraId del cobro no está en ninguna ficha" : "cobro sin compraId"], estadoConciliacion: "por_conciliar" });
  }
  // Resumen por clase y por plataforma × clase (contar servicios, nunca sumar motivos como clientes)
  const porClase = {}; for (const k of Object.keys(CLASES_AUDITORIA)) porClase[k] = 0;
  const plat = new Map();
  for (const f of filas) {
    porClase[f.clase] = (porClase[f.clase] || 0) + 1;
    const x = plat.get(f.plataforma) || plat.set(f.plataforma, { plataforma: f.plataforma, nombre: nombrePlataforma(f.plataforma), vigentes: 0, cuentas: new Set(), clientes: new Set(), clientesConCobro: new Set(), cobradoHnl: 0, sinCosto: 0, ...Object.fromEntries(Object.keys(CLASES_AUDITORIA).map((k) => [k, 0])) }).get(f.plataforma);
    x[f.clase]++; if (f.vigente) x.vigentes++; if (f.cuentaMadreId) x.cuentas.add(f.cuentaMadreId); if (f.clienteId) x.clientes.add(f.clienteId); if (f.cobradoHnl > 0) x.clientesConCobro.add(f.clienteId); x.cobradoHnl = r2(x.cobradoHnl + f.cobradoHnl); if (!f.costoVinculado) x.sinCosto++;
  }
  const vig = filas.filter((f) => f.vigente);
  const sociosHnl = r2(filas.flatMap((f) => f.movimientos.filter((m) => m.tipo === "socios")).reduce((a, m) => a + (Number(m.cobrado) || 0), 0));
  const sociosCompartidosHnl = r2([...new Map([...socioPorCompra.values()].flat().filter((x) => x.compartido).map((x) => [x.movimientoId, x.monto])).values()].reduce((a, b) => a + b, 0));
  const resumen = {
    desde, hasta, corte, servicios: filas.length, serviciosVigentes: vig.length, clientesVigentes: new Set(vig.map((f) => f.clienteId)).size,
    vigentesConCobro: vig.filter((f) => f.cobradoHnl > 0 || f.clase === "cobro_socios").length, vigentesSoloVigentes: vig.filter((f) => !(f.cobradoHnl > 0 || f.clase === "cobro_socios")).length,
    porClase, cobradoServiciosHnl: r2(filas.reduce((a, f) => a + f.cobradoHnl, 0)), cobradoSociosHnl: sociosHnl, sociosCompartidosHnl, sociosSinFichaHnl: r2(sociosSinFicha.reduce((a, x) => a + x.monto, 0)), sociosSinFicha: sociosSinFicha.length,
    cuadre: calc.resumen.cuadre, sinCostoVinculado: filas.filter((f) => !f.costoVinculado).length,
  };
  const porPlataforma = [...plat.values()].map((x) => ({ ...x, cuentas: x.cuentas.size, clientes: x.clientes.size, clientesConCobro: x.clientesConCobro.size })).sort((a, b) => b.vigentes - a.vigentes);
  const orden = Object.keys(CLASES_AUDITORIA);
  return { resumen, porPlataforma, filas: filas.sort((a, b) => orden.indexOf(a.clase) - orden.indexOf(b.clase) || a.plataforma.localeCompare(b.plataforma) || a.beneficiario.localeCompare(b.beneficiario)), sociosSinFicha, clases: CLASES_AUDITORIA };
}

// CSV ENMASCARADO (descarga de auditoría): sin teléfonos, PIN, claves ni tokens; correos enmascarados; IDs abreviados.
export function csvAuditoria(filas = []) {
  const corto = (v) => { const t = s(v, 200); return t.length > 10 ? `…${t.slice(-8)}` : t; };
  const esc = (v) => { // anti-inyección de fórmulas en Excel + comillas CSV
    let t = String(v ?? "").replace(/[\r\n]+/g, " ");
    if (typeof v === "string" && /^[=+\-@]/.test(t)) t = `'${t}`;
    return /[",;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const cab = ["Clase", "Estado conciliación", "Plataforma", "Beneficiario", "Titular", "Vendedor", "Cuenta (enmascarada)", "Perfil", "ID compra", "ID cliente", "ID cuenta madre", "Precio ficha", "Vigente", "Próx. renovación", "Fecha anterior", "Fecha nueva", "Renovado por", "Origen", "Cobrado L", "Pendiente L", "Movimientos", "Último cobro", "Costo vinculado", "Faltantes"];
  const out = [cab.join(",")];
  for (const f of filas) out.push([CLASES_AUDITORIA[f.clase] || f.clase, f.estadoConciliacion, nombrePlataforma(f.plataforma), f.beneficiario, f.titular, f.vendedor, f.cuentaCorreo, f.perfil, corto(f.compraId), corto(f.clienteId), corto(f.cuentaMadreId), f.precioFicha, f.vigente ? "Sí" : "No", f.proximaRenovacion, f.fechaAnterior, f.fechaNueva, f.renovadoPor, f.origenRenovacion, f.cobradoHnl, f.pendienteHnl,
    f.movimientos.map((m) => `${m.fecha} ${m.tipo} ${m.cobrado ?? "compartido"} ${corto(m.movimientoId)}`).join(" | "), f.ultimoCobro ? `${f.ultimoCobro.fecha} ${f.ultimoCobro.tipo}` : "", f.costoVinculado ? "Sí" : "No", f.ausencias.join("; ")].map(esc).join(","));
  return out.join("\n");
}

// ---------------------------------------------------------------- R198j · GANANCIA POR CUENTA (regla del dueño, 20/11/2026)
// «Lo que yo pago de la cuenta y lo que paga cada cliente: el restante es la ganancia.»
// · Cuenta por ACTIVACIÓN (link, HBO, etc.): se paga UNA vez y cubre la cuenta hasta la próxima activación.
//   Ganancia neta al mes = lo que pagan los clientes al mes (ya no hay costo mensual: la activación ya se pagó).
//   Ganancia desde la activación (estimada) = Σ cuota mensual de cada perfil × meses pagados desde la activación (o desde
//   su alta, si entró después) − lo que costó activarla.
// · Cuenta con vigencia (p. ej. 30 días) o mensual (Spotify familiar): costo mensual = costo × 30.44 / días de vigencia.
// · Sin compra registrada: NO se inventa costo: «Registre cuánto pagó». Nada se escribe.
const mesesEntre = (ini, fin) => { // meses calendario pagados entre dos fechas (tolerancia de 3 días)
  if (!ini || !fin || fin <= ini) return 0;
  const [y1, m1, d1] = ini.split("-").map(Number), [y2, m2, d2] = fin.split("-").map(Number);
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) - (d2 + 3 < d1 ? 1 : 0));
};
// R200k (23/11/2026) · Control exacto desde OCTUBRE 2026 (pedido del dueño): el bot se usa desde marzo, pero los ingresos
// reales por perfil se registran completos desde octubre. «Ganancia desde octubre» = lo que pagan los clientes por los días
// desde el 1 de octubre (o desde que entraron) hasta hoy − la parte de cada compra que cae en ese mismo período.
// Una compra anual o de 3 meses solo cuenta por los días que caen dentro; una activación pagada antes de octubre sin fecha
// de vencimiento no se cobra otra vez en el período (se marca). Nada antes de octubre entra en esta cifra.
export const INICIO_CONTROL = "2026-10-01";
const diasEntre = (a, b) => (a && b && b > a ? Math.round((ms(b) - ms(a)) / DIA) : 0);
const sumarDiasG = (f, n) => new Date(ms(f) + n * DIA).toISOString().slice(0, 10);
export function rentabilidadCuentas(ctx, { hoy, plataforma = "", altas = new Map(), cobradoCiclo = null, desdeControl = INICIO_CONTROL } = {}) {
  const b = plataforma ? base(plataforma) : "";
  const lotesPorCuenta = new Map();
  for (const l of ctx.lotes) { if (l.estado === "anulado" || !l._cuentaId || !(r2(l.costoTotalHnl) > 0) || !ymd(l.fecha) || ymd(l.fecha) > hoy) continue; (lotesPorCuenta.get(l._cuentaId) || lotesPorCuenta.set(l._cuentaId, []).get(l._cuentaId)).push(l); }
  const spfPorCorreo = new Map((ctx.spotify || []).filter((x) => r2(x.costoMensualHnl) > 0).map((x) => [s(x.madreCorreo || x.correo).toLowerCase(), x]));
  const filas = [];
  for (const a of ctx.cuentasPorId.values()) {
    if (a._pseudo) continue;
    if (b && base(a._familia) !== b) continue;
    const cls = (Array.isArray(a.clientes) ? a.clientes : []).filter(Boolean);
    // ---- lo que pagué (la última compra de esa cuenta; la de activación manda)
    const ls = (lotesPorCuenta.get(a.id) || []).sort((x, y) => ymd(y.fecha).localeCompare(ymd(x.fecha)));
    const ult = ls[0] || null; let compra = null;
    if (ult) {
      const p = ctx.productosPorId.get(ult.productoId) || {}; const regla = ult._ciclo ? "cobertura" : reglaCosto(ult, p);
      const dur = ult._ciclo ? diasRango(ymd(ult._ciclo.coberturaDesde), ymd(ult._ciclo.coberturaHasta)) : Number(ult.duracionDias) || Number(p.duracionDias) || 0;
      const costo = r2(ult.costoTotalHnl);
      compra = { fecha: ymd(ult.fecha), costoHnl: costo, moneda: ult.moneda || "HNL", montoMoneda: ult.costoTotalMoneda, tasa: ult.tasa, tipo: regla === "cobertura" && dur > 0 ? "vigencia" : "activacion", dias: dur || null,
        costoMensualHnl: regla === "cobertura" && dur > 0 ? r2(costo * 30.4375 / dur) : 0, compras: ls.length };
    } else { const sp = spfPorCorreo.get(s(a.correo).toLowerCase()); if (sp) compra = { fecha: ymd(sp.creadoAt) || "", costoHnl: r2(sp.costoMensualHnl), moneda: "HNL", tipo: "mensual", dias: 30, costoMensualHnl: r2(sp.costoMensualHnl), compras: 1 }; }
    // ---- lo que pagan los clientes (cuota mensual de cada perfil, según su ficha)
    const inicioCuenta = compra && compra.tipo === "activacion" ? compra.fecha : "";
    const perfiles = cls.map((cl, i) => {
      const sv = ctx.servPorCompra.get(String(cl.compraId || "")) || null; const cli = sv ? ctx.clientePorId.get(sv._clienteId) || {} : {};
      const meses = Math.max(1, Number(sv && sv.mesesContratados) || 1);
      const cuota = sv ? r2(Number(sv.precio || 0) / meses) : 0;
      const alta = altas.get(String(cl.compraId || "")) || "";
      const inicio = [inicioCuenta, alta].filter(Boolean).sort().pop() || ""; // desde la activación, o desde que entró si fue después
      const vence = sv ? ymd(sv.fechaRenovacion) : "";
      const desdeP = [inicio || desdeControl, desdeControl].sort()[1]; // R200k · solo lo que pagó desde octubre (meses pagados hasta su vencimiento)
      const mesesPagados = desdeP && vence ? mesesEntre(desdeP, vence) : 0;
      return { perfil: cl.slot != null ? `Perfil ${cl.slot}` : `Perfil ${i + 1}`, cliente: s((sv && (sv.beneficiarioNombre || sv.beneficiario)) || cl.nombre || cli.nombre, 80), cuotaMesHnl: cuota, vence, inicio: desdeP, mesesPagados, estimadoHnl: r2(cuota * mesesPagados), sinFicha: !sv };
    });
    const finPeriodo = [hoy, ...perfiles.map((p) => p.vence).filter(Boolean)].sort().pop(); // hasta donde ya pagaron los clientes (o hoy)
    // ---- R200k · parte de lo pagado que cae entre el inicio del control y hoy (todas las compras de la cuenta)
    let costoVentana = null, activacionAntes = false;
    if (ls.length) {
      costoVentana = 0;
      for (const l of ls) {
        const p = ctx.productosPorId.get(l.productoId) || {}; const costo = r2(l.costoTotalHnl);
        const ini = l._ciclo ? ymd(l._ciclo.coberturaDesde) : ymd(l.fechaActivacion) || ymd(l.fecha);
        const dur = l._ciclo ? diasRango(ymd(l._ciclo.coberturaDesde), ymd(l._ciclo.coberturaHasta)) : Number(l.duracionDias) || (l.vigenciaHasta ? diasEntre(ini, ymd(l.vigenciaHasta)) : 0) || (reglaCosto(l, p) === "cobertura" ? Number(p.duracionDias) || 0 : 0);
        if (dur > 0 && ini) { const fin = l._ciclo ? sumarDiasG(ymd(l._ciclo.coberturaHasta), 1) : ymd(l.vigenciaHasta) || sumarDiasG(ini, dur); const total = Math.max(1, diasEntre(ini, fin)); const dentro = diasEntre([ini, desdeControl].sort()[1], [fin, finPeriodo].sort()[0]); costoVentana += costo * dentro / total; }
        else if (ymd(l.fecha) >= desdeControl) costoVentana += costo; // activación pagada dentro del período
        else activacionAntes = true; // activación pagada antes de octubre, sin vencimiento: no se vuelve a cobrar aquí
      }
      costoVentana = r2(costoVentana);
    } else if (compra && compra.tipo === "mensual") costoVentana = r2(compra.costoMensualHnl * diasEntre([compra.fecha || desdeControl, desdeControl].sort()[1], finPeriodo) / 30.4375);
    const mensual = r2(perfiles.reduce((x, p) => x + p.cuotaMesHnl, 0));
    const estimado = r2(perfiles.reduce((x, p) => x + p.estimadoHnl, 0));
    const mesesCuenta = compra && compra.fecha ? mesesEntre(compra.fecha, hoy) : 0;
    const costoAcum = !compra ? null : costoVentana; // R200k · solo la parte del período de control
    const cap = Number(a.capacidad) || cls.length;
    const completa = cls.some((c) => c.cuentaCompleta === true || c.tipoVenta === "cuenta_completa") || (cls.length > 0 && (s(a.modalidadVenta) === "cuenta_completa" || !!s(a.exclusivaCompraId)));
    const reg = cobradoCiclo ? cobradoCiclo.get(a.id) || null : null;
    const estado = !compra ? "sin_compra" : !cls.length ? "vacia" : estimado - costoAcum < 0 ? "por_recuperar" : "ganando";
    filas.push({ cuentaId: a.id, correo: s(a.correo), plataforma: a._familia, base: base(a._familia), nombre: nombrePlataforma(base(a._familia)), plan: s(a.planHbo || a.plan, 20), capacidad: cap, ocupados: cls.length, libres: completa ? 0 : Math.max(0, cap - cls.length), completa,
      compra, meMensualHnl: mensual, gananciaMesHnl: compra ? r2(mensual - compra.costoMensualHnl) : null,
      estimadoDesdeCompraHnl: estimado, gananciaDesdeCompraHnl: costoAcum == null ? null : r2(estimado - costoAcum), mesesDesdeCompra: mesesCuenta, costoPeriodoHnl: costoAcum, activacionAntesDelControl: activacionAntes, desdeControl,
      registradoCajaHnl: reg ? reg.cobradoHnl : null, perfiles, estado });
  }
  filas.sort((x, y) => x.nombre.localeCompare(y.nombre) || (y.gananciaMesHnl ?? -1e9) - (x.gananciaMesHnl ?? -1e9) || x.correo.localeCompare(y.correo));
  const grupos = new Map();
  for (const f of filas) {
    const g = grupos.get(f.base) || grupos.set(f.base, { plataforma: f.base, nombre: f.nombre, cuentas: 0, perfiles: 0, libres: 0, meMensualHnl: 0, pagueHnl: 0, gananciaMesHnl: 0, gananciaDesdeCompraHnl: 0, costoPeriodoHnl: 0, ingresoPeriodoHnl: 0, sinCompra: 0, sinCompraMensualHnl: 0, vacias: 0, porRecuperar: 0 }).get(f.base);
    g.cuentas++; g.perfiles += f.ocupados; g.libres += f.libres; g.meMensualHnl += f.meMensualHnl;
    if (f.compra) { g.pagueHnl += f.compra.costoHnl; g.gananciaMesHnl += f.gananciaMesHnl; g.gananciaDesdeCompraHnl += f.gananciaDesdeCompraHnl; g.costoPeriodoHnl += f.costoPeriodoHnl || 0; g.ingresoPeriodoHnl += f.estimadoDesdeCompraHnl; } else { g.sinCompra++; g.sinCompraMensualHnl += f.meMensualHnl; }
    if (f.estado === "vacia") g.vacias++; if (f.estado === "por_recuperar") g.porRecuperar++;
  }
  const plataformas = [...grupos.values()].map((g) => ({ ...g, meMensualHnl: r2(g.meMensualHnl), pagueHnl: r2(g.pagueHnl), gananciaMesHnl: r2(g.gananciaMesHnl), gananciaDesdeCompraHnl: r2(g.gananciaDesdeCompraHnl), costoPeriodoHnl: r2(g.costoPeriodoHnl), ingresoPeriodoHnl: r2(g.ingresoPeriodoHnl), sinCompraMensualHnl: r2(g.sinCompraMensualHnl) }))
    .filter((g) => g.perfiles > 0 || g.pagueHnl > 0).sort((x, y) => y.meMensualHnl - x.meMensualHnl);
  const tot = (k) => r2(plataformas.reduce((x, g) => x + g[k], 0));
  return { hoy, desdeControl, plataformas, filas, total: { cuentas: plataformas.reduce((x, g) => x + g.cuentas, 0), perfiles: plataformas.reduce((x, g) => x + g.perfiles, 0), meMensualHnl: tot("meMensualHnl"), pagueHnl: tot("pagueHnl"), gananciaMesHnl: tot("gananciaMesHnl"), gananciaDesdeCompraHnl: tot("gananciaDesdeCompraHnl"), sinCompra: plataformas.reduce((x, g) => x + g.sinCompra, 0), sinCompraMensualHnl: tot("sinCompraMensualHnl") } };
}
