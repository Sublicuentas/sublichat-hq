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
  netflix: "Netflix Premium", vipnetflix: "Netflix VIP", disneyp: "Disney+", disneys: "Disney+ (cuenta)", hbomax: "HBO Max", hbomax_standard: "HBO Standard", hbomax_platinum: "HBO Platinum",
  primevideo: "Prime Video", paramount: "Paramount+", crunchyroll: "Crunchyroll", spotify: "Spotify Familiar", youtube: "YouTube Premium", vix: "ViX+", appletv: "Apple TV",
  viki: "Viki", deezer: "Deezer", canva: "Canva", gemini: "Gemini Pro", chatgpt: "ChatGPT", duolingo: "Duolingo", office: "Office", office2021: "Office 2021", autocad: "Autodesk",
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
  const lotesCubiertos = new Set(); // cuentas con lote real (el Excel Premium no se suma encima)
  for (const l of lotes) {
    if (l.estado === "anulado") continue;
    const p = productosPorId.get(l.productoId) || {}; const fam = familia(p.plataformaKey || l.plataformaKey || l.producto, (cuentasPorId.get(l.cuentaInventarioId) || {}).planHbo);
    const costo = r2(l.costoTotalHnl), fecha = ymd(l.fecha), inicio = ymd(l.fechaActivacion) || fecha;
    if (!fecha || !(costo > 0)) continue;
    const ref = { loteId: l.id, producto: s(l.producto || p.nombre, 60), proveedor: s(l.proveedor, 60), moneda: l.moneda || "HNL", montoMoneda: l.costoTotalMoneda, tasa: l.tasa, fechaCompra: fecha, cuentaId: s(l.cuentaInventarioId), correo: s((cuentasPorId.get(l.cuentaInventarioId) || {}).correo) };
    if (fecha >= desde && fecha <= hasta) caja.push({ ...ref, plataforma: fam, costoHnl: costo, pago: l.cuentaPagoNombre || l.pago || "" });
    // Netflix VIP y Spotify Familiar se reconocen por su costo mensual por acceso/familia: su compra es solo caja.
    if ((base(fam) === "vipnetflix" && vipConCosto) || (base(fam) === "spotify" && spfConCosto && !l.cuentaInventarioId)) continue;
    const regla = reglaCosto(l, p);
    if (regla === "cobertura") {
      const dur = Number(l.duracionDias) || Number(p.duracionDias) || 30;
      const d = diasDentro(inicio, dur, desde, hasta); if (!d) continue;
      if (l.cuentaInventarioId) lotesCubiertos.add(`${l.cuentaInventarioId}|${desde}`);
      piezas.push({ ...ref, plataforma: fam, regla, costoHnl: r2(costo * d / dur), criterio: `${d} de ${dur} días de vigencia (${inicio} → ${sumarDias(inicio, dur - 1)})`, costoCiclo: costo });
    } else if (regla === "consumo") {
      if (consumoEnRango.has(l.productoId)) continue; // se reconoce abajo por lo usado
      if (fecha < desde || fecha > hasta) continue;
      piezas.push({ ...ref, plataforma: fam, regla: "lote_sin_consumo", costoHnl: costo, criterio: "Lote reconocido en su mes: todavía no hay consumo calculado por venta", costoCiclo: costo, aviso: true });
    } else { // activación ocasional
      if (fecha < desde || fecha > hasta) continue;
      piezas.push({ ...ref, plataforma: fam, regla, costoHnl: costo, criterio: "Activación: un desembolso real en su fecha (sin vigencia conocida; no se inventan meses)", costoCiclo: costo });
    }
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
  return { piezas, caja };
}

// ---------------------------------------------------------------- 3) CONTEXTO (una sola lectura de datos)
export function prepararContexto({ clientes = [], inventario = [], lotes = [], productos = [], consumos = [], vipExtras = [], spotify = [], premium = [] } = {}) {
  const servPorCompra = new Map(), clientePorId = new Map(), servicios = [];
  for (const c of clientes) {
    if (!c || String(c.consolidadoEn || "").trim()) continue;
    clientePorId.set(c.id, c);
    for (const sv of Array.isArray(c.servicios) ? c.servicios : []) { if (!sv) continue; const x = { ...sv, _clienteId: c.id }; servicios.push(x); if (sv.compraId) servPorCompra.set(String(sv.compraId), x); }
  }
  const cuentaPorCompra = new Map(), cuentasPorId = new Map(), cuentasPorCorreo = new Map();
  for (const a of inventario) {
    if (!a || a.estado === "eliminada" || a.eliminado === true) continue;
    const perfilPorCompra = new Map(), slotPorCompra = new Map();
    for (const cl of Array.isArray(a.clientes) ? a.clientes : []) { if (!cl) continue; const cid = String(cl.compraId || ""); if (cid) { perfilPorCompra.set(cid, s(cl.nombre, 80)); slotPorCompra.set(cid, cl.slot != null ? `Perfil ${cl.slot}` : ""); if (!cuentaPorCompra.has(cid)) cuentaPorCompra.set(cid, null); } }
    const cta = { ...a, _perfilPorCompra: perfilPorCompra, _slotPorCompra: slotPorCompra };
    cuentasPorId.set(a.id, cta);
    for (const cid of perfilPorCompra.keys()) cuentaPorCompra.set(cid, cta);
    const k = `${base(familia(a.plataforma))}|${s(a.correo).toLowerCase()}`; if (!cuentasPorCorreo.has(k)) cuentasPorCorreo.set(k, cta);
  }
  // Venta sin enlace por compraId: se busca la cuenta por correo + plataforma del servicio (apoyo controlado)
  for (const sv of servicios) {
    if (!sv.compraId || cuentaPorCompra.get(String(sv.compraId))) continue;
    const c = cuentasPorCorreo.get(`${base(familia(sv.plataforma))}|${s(sv.correo).toLowerCase()}`);
    if (c) cuentaPorCompra.set(String(sv.compraId), c);
  }
  return { servPorCompra, clientePorId, servicios, cuentaPorCompra, cuentasPorId, cuentasPorCorreo, lotes, productosPorId: new Map(productos.map((p) => [p.id, p])), consumos, vipExtras, spotify, premium };
}

// ---------------------------------------------------------------- 4) MOTOR por rango
// deps: { R: { movementYmd, movementKind, anuladoOReversa }, ventasACostear }
export function calcularGanancias(ctx, movimientos = [], { desde, hasta, hoy = "" }, deps) {
  const { R, ventasACostear } = deps;
  const vigente = (m) => !R.anuladoOReversa(m);
  const enRango = (m) => { const f = R.movementYmd(m); return f && f >= desde && f <= hasta; };
  // Ventas del período (devengado) y su reparto en líneas
  const ventas = ventasACostear(movimientos, desde, R, { paraIngresos: true }).filter((v) => v.fecha <= hasta && !v.anulada);
  const lineas = ventas.flatMap((v) => lineasDeVenta(v, ctx));
  // Caja: lo que realmente entró en el período (cobros de ventas, abonos de pendientes, ingresos manuales)
  const ingresosCaja = movimientos.filter((m) => vigente(m) && enRango(m) && R.movementKind(m) === "ingreso");
  const cobradoCaja = r2(ingresosCaja.reduce((a, m) => a + Number(m.monto || 0), 0));
  const abonos = r2(ingresosCaja.filter((m) => /^cobro_pendiente|abono/.test(String(m.subtipo || "")) || (m.cuentaId && !/_cobro($|_)/.test(String(m.id)))).reduce((a, m) => a + Number(m.monto || 0), 0));
  // Esperados: renovaciones que vencen en el período y no tienen cobro registrado (no son dinero)
  const conVenta = new Set(lineas.map((l) => l.compraId).filter(Boolean));
  const esperados = ctx.servicios.filter((sv) => { const f = ymd(sv.fechaRenovacion); return f && f >= desde && f <= hasta && r2(sv.precio) > 0 && !conVenta.has(String(sv.compraId || "")); }).map((sv) => {
    const cta = ctx.cuentaPorCompra.get(String(sv.compraId || "")); const cli = ctx.clientePorId.get(sv._clienteId) || {};
    return { compraId: s(sv.compraId), fecha: ymd(sv.fechaRenovacion), plataforma: familia(sv.plataforma, sv.planHbo || (cta && cta.planHbo)), cuentaId: cta ? cta.id : "", cuentaCorreo: cta ? s(cta.correo) : s(sv.correo),
      clienteId: sv._clienteId, titular: s(cli.nombre, 80), beneficiario: s(sv.beneficiarioNombre || sv.beneficiario || (cta && cta._perfilPorCompra.get(String(sv.compraId))) || cli.nombre, 80), vendedor: s(sv.vendedor, 60) || "Sin vendedor", precio: r2(sv.precio), estado: hoy && ymd(sv.fechaRenovacion) < hoy ? "vencido_sin_cobro" : "por_cobrar" };
  });
  const { piezas, caja } = costosRango(ctx, desde, hasta);

  // ---- por plataforma
  const plats = new Map();
  const P = (k) => plats.get(k) || plats.set(k, { plataforma: k, nombre: nombrePlataforma(k), ventas: 0, ingresoHnl: 0, cobradoHnl: 0, pendienteHnl: 0, esperadoHnl: 0, costoHnl: 0, desembolsoHnl: 0, cuentas: new Set(), clientes: new Set() }).get(k);
  for (const l of lineas) { const x = P(l.plataforma); x.ventas++; x.ingresoHnl += l.monto; x.cobradoHnl += l.cobrado; x.pendienteHnl += l.pendiente; if (l.cuentaId) x.cuentas.add(l.cuentaId); if (l.clienteId) x.clientes.add(l.clienteId); }
  for (const e of esperados) P(e.plataforma).esperadoHnl += e.precio;
  for (const c of piezas) P(c.plataforma).costoHnl += c.costoHnl;
  for (const c of caja) P(c.plataforma).desembolsoHnl += c.costoHnl;
  const porPlataforma = [...plats.values()].map((x) => {
    const sinCosto = x.cobradoHnl > 0 && !(x.costoHnl > 0);
    const resultado = sinCosto ? null : r2(x.cobradoHnl - x.costoHnl);
    return { ...x, cuentas: x.cuentas.size, clientes: x.clientes.size, ingresoHnl: r2(x.ingresoHnl), cobradoHnl: r2(x.cobradoHnl), pendienteHnl: r2(x.pendienteHnl), esperadoHnl: r2(x.esperadoHnl), costoHnl: r2(x.costoHnl), desembolsoHnl: r2(x.desembolsoHnl),
      resultadoHnl: resultado, margen: resultado == null ? null : pct(resultado, x.cobradoHnl), estado: sinCosto ? "costo_pendiente" : x.cobradoHnl === 0 && x.costoHnl > 0 ? "sin_ingreso" : "ok" };
  }).sort((a, b) => (b.resultadoHnl ?? -1e12) - (a.resultadoHnl ?? -1e12) || b.cobradoHnl - a.cobradoHnl);

  // ---- resumen (mismo motor para Resumen, Ganancias y Reportes)
  const cobradoVentas = r2(lineas.reduce((a, l) => a + l.cobrado, 0));
  const costo = r2(piezas.reduce((a, c) => a + c.costoHnl, 0));
  const cobradoSinCosto = r2(porPlataforma.filter((p) => p.estado === "costo_pendiente").reduce((a, p) => a + p.cobradoHnl, 0));
  const resumen = {
    desde, hasta, ventas: ventas.length, lineas: lineas.length,
    ingresoVentasHnl: r2(lineas.reduce((a, l) => a + l.monto, 0)), cobradoHnl: cobradoVentas, cobradoCajaHnl: cobradoCaja, abonosHnl: abonos,
    pendienteHnl: r2(lineas.reduce((a, l) => a + l.pendiente, 0)), esperadoHnl: r2(esperados.reduce((a, e) => a + e.precio, 0)), esperados: esperados.length,
    descuentosHnl: r2(lineas.reduce((a, l) => a + (l.descuento > 0 ? l.descuento : 0), 0)),
    costoHnl: costo, desembolsoHnl: r2(caja.reduce((a, c) => a + c.costoHnl, 0)),
    costoActivacionesHnl: r2(piezas.filter((c) => c.regla === "activacion").reduce((a, c) => a + c.costoHnl, 0)),
    costoSinConsumoHnl: r2(piezas.filter((c) => c.regla === "lote_sin_consumo").reduce((a, c) => a + c.costoHnl, 0)),
    resultadoHnl: r2(cobradoVentas - costo), margen: pct(r2(cobradoVentas - costo), cobradoVentas), cobradoSinCostoHnl: cobradoSinCosto,
    estado: !ventas.length && !costo ? "sin_datos" : cobradoSinCosto > 0 ? "costos_pendientes" : "ok",
  };

  // ---- bandeja de conciliación (nada se inventa: solo se muestra)
  const bandeja = [];
  for (const l of lineas) if (!l.cuentaId && ["netflix", "vipnetflix", "disneyp", "hbomax", "hbomax_standard", "hbomax_platinum", "primevideo", "paramount", "crunchyroll", "spotify"].includes(l.plataforma)) bandeja.push({ tipo: "sin_coincidencia", texto: "Venta sin cuenta madre vinculada", plataforma: l.plataforma, fecha: l.fecha, beneficiario: l.beneficiario, monto: l.monto, referencia: l.referencia, compraId: l.compraId });
  for (const l of lineas) if (l.pendiente > 0) bandeja.push({ tipo: "pago_pendiente", texto: "Venta con saldo por cobrar", plataforma: l.plataforma, fecha: l.fecha, beneficiario: l.beneficiario, monto: l.pendiente, referencia: l.referencia });
  for (const p of porPlataforma) if (p.estado === "costo_pendiente") bandeja.push({ tipo: "costo_pendiente", texto: `Ingresos sin compra registrada para ${p.nombre}`, plataforma: p.plataforma, monto: p.cobradoHnl });
  { // cuentas con cobros pero sin compra que las cubra (ni costo general de su plataforma): costo pendiente por cuenta
    const conCosto = new Set(piezas.filter((c) => c.cuentaId).map((c) => c.cuentaId)), poolPlat = new Set(piezas.filter((c) => !c.cuentaId).map((c) => c.plataforma));
    const vistas = new Map(); for (const l of lineas) if (l.cuentaId && l.cobrado > 0 && !conCosto.has(l.cuentaId) && !poolPlat.has(l.plataforma)) vistas.set(l.cuentaId, { plataforma: l.plataforma, correo: l.cuentaCorreo, monto: r2((vistas.get(l.cuentaId) || { monto: 0 }).monto + l.cobrado) });
    for (const [id, v] of vistas) bandeja.push({ tipo: "costo_pendiente", texto: `Cuenta ${v.correo || id} sin compra registrada que cubra el período`, plataforma: v.plataforma, monto: v.monto, referencia: id });
  }
  for (const c of piezas) if (c.aviso) bandeja.push({ tipo: "datos_incompletos", texto: `Lote sin consumo calculado: ${c.producto}`, plataforma: c.plataforma, fecha: c.fechaCompra, monto: c.costoHnl, referencia: c.loteId });
  for (const e of esperados) bandeja.push({ tipo: "ingreso_sin_confirmar", texto: e.estado === "vencido_sin_cobro" ? "Renovación vencida sin cobro registrado" : "Renovación por cobrar", plataforma: e.plataforma, fecha: e.fecha, beneficiario: e.beneficiario, monto: e.precio, compraId: e.compraId });

  return { resumen, porPlataforma, lineas, esperados, costos: piezas, desembolsos: caja, bandeja };
}

// Detalle de UNA cuenta madre (Fase 3): perfiles, clientes y beneficiarios, precios, cobros, esperados, compras y resultado.
export function detalleCuenta(ctx, calc, cuentaId) {
  const a = ctx.cuentasPorId.get(cuentaId); if (!a) return null;
  const lineas = calc.lineas.filter((l) => l.cuentaId === cuentaId), esperados = calc.esperados.filter((e) => e.cuentaId === cuentaId);
  const costos = calc.costos.filter((c) => c.cuentaId === cuentaId), compras = ctx.lotes.filter((l) => l.cuentaInventarioId === cuentaId && l.estado !== "anulado").map((l) => ({ loteId: l.id, fecha: ymd(l.fecha), fechaActivacion: ymd(l.fechaActivacion), producto: l.producto, proveedor: l.proveedor || "", moneda: l.moneda, montoMoneda: l.costoTotalMoneda, tasa: l.tasa, costoHnl: r2(l.costoTotalHnl), duracionDias: Number(l.duracionDias) || 0, pago: l.cuentaPagoNombre || l.pago || "" })).sort((x, y) => y.fecha.localeCompare(x.fecha));
  const ocupados = Array.isArray(a.clientes) ? a.clientes.length : Number(a.ocupados) || 0, capacidad = Number(a.capacidad) || ocupados;
  const perfiles = (Array.isArray(a.clientes) ? a.clientes : []).map((cl, i) => {
    const cid = String(cl.compraId || ""); const sv = ctx.servPorCompra.get(cid) || null; const fic = sv ? ctx.clientePorId.get(sv._clienteId) || {} : ctx.clientePorId.get(String(cl.clienteId || "")) || {};
    const mis = lineas.filter((l) => l.compraId === cid).sort((x, y) => y.fecha.localeCompare(x.fecha));
    return { perfil: cl.slot != null ? `Perfil ${cl.slot}` : `Perfil ${i + 1}`, beneficiario: s((sv && (sv.beneficiarioNombre || sv.beneficiario)) || cl.nombre || fic.nombre, 80), titular: s(fic.nombre, 80), vendedor: s(sv && sv.vendedor, 60) || "Sin vendedor",
      precio: sv ? r2(sv.precio) : null, ultimaVenta: mis[0] ? mis[0].fecha : "", ultimoTipo: mis[0] ? mis[0].tipo : "", proximoVencimiento: sv ? ymd(sv.fechaRenovacion) : "",
      cobradoHnl: r2(mis.reduce((x, l) => x + l.cobrado, 0)), pendienteHnl: r2(mis.reduce((x, l) => x + l.pendiente, 0)), descuentoHnl: r2(mis.reduce((x, l) => x + (l.descuento || 0), 0)),
      esperadoHnl: r2(esperados.filter((e) => e.compraId === cid).reduce((x, e) => x + e.precio, 0)), compraId: cid, referencias: mis.map((l) => l.referencia) };
  });
  const cobrado = r2(lineas.reduce((x, l) => x + l.cobrado, 0)), costo = r2(costos.reduce((x, c) => x + c.costoHnl, 0));
  const ciclo = compras[0] ? r2(compras[0].costoHnl) : null;
  return {
    cuentaId, correo: s(a.correo), plataforma: familia(a.plataforma, a.planHbo), nombre: nombrePlataforma(familia(a.plataforma, a.planHbo)), plan: s(a.planHbo || a.plan, 30), capacidad, ocupados, disponibles: Math.max(0, capacidad - ocupados),
    perfiles, lineas, esperados, costos, compras,
    cobradoHnl: cobrado, pendienteHnl: r2(lineas.reduce((x, l) => x + l.pendiente, 0)), esperadoHnl: r2(esperados.reduce((x, e) => x + e.precio, 0)),
    costoPeriodoHnl: costo, resultadoPeriodoHnl: costos.length ? r2(cobrado - costo) : null, margen: costos.length && cobrado > 0 ? pct(r2(cobrado - costo), cobrado) : null,
    costoCicloHnl: ciclo, resultadoCicloHnl: ciclo != null ? r2(cobrado - ciclo) : null,
    estado: !costos.length && cobrado > 0 ? "costo_pendiente" : !lineas.length ? "sin_ingresos" : "ok",
  };
}

// Filas para Excel (Fase 7): una por línea de ingreso, esperado y costo. El beneficiario NO se cambia por el titular.
export function filasExcel(calc) {
  const f = [];
  for (const l of calc.lineas) f.push({ Fecha: l.fecha, Tipo: l.tipo === "renovacion" ? "Renovación" : l.tipo === "venta" ? "Venta" : "Ingreso manual", Plataforma: nombrePlataforma(l.plataforma), "Cuenta madre": l.cuentaCorreo, Perfil: l.perfil, Beneficiario: l.beneficiario, "Titular de ficha": l.titular, Vendedor: l.vendedor, Proveedor: "", "Ingreso cobrado": l.cobrado, "Ingreso pendiente": l.pendiente, "Costo imputado": "", Resultado: "", Moneda: "HNL", Tasa: "", Estado: l.pendiente > 0 ? "Pago pendiente" : l.cuentaId || !["netflix", "vipnetflix", "hbomax", "hbomax_standard", "hbomax_platinum", "disneyp", "primevideo", "paramount", "crunchyroll", "spotify"].includes(l.plataforma) ? "Conciliado" : "Sin coincidencia", Referencia: l.referencia });
  for (const e of calc.esperados) f.push({ Fecha: e.fecha, Tipo: "Renovación esperada", Plataforma: nombrePlataforma(e.plataforma), "Cuenta madre": e.cuentaCorreo, Perfil: "", Beneficiario: e.beneficiario, "Titular de ficha": e.titular, Vendedor: e.vendedor, Proveedor: "", "Ingreso cobrado": 0, "Ingreso pendiente": e.precio, "Costo imputado": "", Resultado: "", Moneda: "HNL", Tasa: "", Estado: "Ingreso sin confirmar", Referencia: e.compraId });
  for (const c of calc.costos) f.push({ Fecha: c.fechaCompra || "", Tipo: `Costo · ${c.regla}`, Plataforma: nombrePlataforma(c.plataforma), "Cuenta madre": c.correo || "", Perfil: "", Beneficiario: "", "Titular de ficha": "", Vendedor: "", Proveedor: c.proveedor || "", "Ingreso cobrado": "", "Ingreso pendiente": "", "Costo imputado": c.costoHnl, Resultado: "", Moneda: c.moneda || "HNL", Tasa: c.tasa ?? "", Estado: c.aviso ? "Datos incompletos" : "Costo real", Referencia: c.loteId || c.familiaId || "" });
  return f;
}
