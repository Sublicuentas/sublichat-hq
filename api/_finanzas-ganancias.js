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
// Cuentas = cuentas madre de Control Maestro / Bodega (`inventario`) + accesos Netflix VIP registrados en Finanzas
// (`fin_vip_extras`) que no tienen documento local: un Extra VIP es un ACCESO INDIVIDUAL, no «0 cuentas».
export function prepararContexto({ clientes = [], inventario = [], lotes = [], productos = [], consumos = [], vipExtras = [], spotify = [], premium = [] } = {}) {
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
  return { servPorCompra, clientePorId, servicios, cuentaPorCompra, enlacePorCorreo, cuentasPorId, cuentasPorCorreo, lotes, productosPorId: new Map(productos.map((p) => [p.id, p])), consumos, vipExtras, spotify, premium };
}

const PLAT_CUENTA = new Set(["netflix", "vipnetflix", "disneyp", "disneys", "hbomax", "hbomax_standard", "hbomax_platinum", "primevideo", "paramount", "crunchyroll", "spotify", "youtube", "appletv", "vix", "universal", "viki", "deezer", "canva"]);
export const DEFINICIONES = Object.freeze({
  altas: "Ventas nuevas creadas en el período (eventos de venta con pago registrado).",
  renovaciones: "Renovaciones COBRADAS en el período (no las programadas).",
  cobrado: "Dinero recibido, repartido a cada servicio; un combo cuenta una sola vez.",
  pendiente: "Saldo por cobrar de ventas o renovaciones del período (pago parcial o a crédito).",
  esperado: "Renovaciones que vencen en el período sin cobro registrado. NO es dinero cobrado.",
  costo: "Costo directo atribuible al período, con la tasa y el costo históricos de cada compra.",
  cobertura: "Parte de lo cobrado cuya cuenta/plataforma tiene costo registrado. Si es menor a 100 %, el margen no es definitivo.",
  resultado: "Cobrado con costo − costo directo. Lo cobrado sin costo se muestra aparte («costo incompleto»), nunca como ganancia.",
});

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
  const { piezas, caja } = costosRango(ctx, desde, hasta);

  // ---- cobertura de costos: una línea está cubierta si su cuenta tiene costo en el período o su plataforma tiene costo general
  const ctaConCosto = new Set(piezas.filter((c) => c.cuentaId).map((c) => c.cuentaId)), platPool = new Set(piezas.filter((c) => !c.cuentaId).map((c) => c.plataforma));
  const cubierta = (l) => (l.cuentaId && ctaConCosto.has(l.cuentaId)) || platPool.has(l.plataforma);
  for (const l of lineas) l.costoCubierto = !!cubierta(l);

  // ---- por plataforma
  const plats = new Map();
  const P = (k) => plats.get(k) || plats.set(k, { plataforma: k, nombre: nombrePlataforma(k), altas: 0, renovaciones: 0, otros: 0, ingresoHnl: 0, cobradoHnl: 0, cobradoCubiertoHnl: 0, pendienteHnl: 0, esperadoHnl: 0, costoHnl: 0, desembolsoHnl: 0, cuentas: new Set(), clientes: new Set(), servicios: new Set(), sinCuenta: 0, planSinClasificar: 0 }).get(k);
  for (const l of lineas) {
    const x = P(l.plataforma); if (l.tipo === "venta") x.altas++; else if (l.tipo === "renovacion") x.renovaciones++; else x.otros++;
    x.ingresoHnl += l.monto; x.cobradoHnl += l.cobrado; if (l.costoCubierto) x.cobradoCubiertoHnl += l.cobrado; x.pendienteHnl += l.pendiente;
    if (l.cuentaId) x.cuentas.add(l.cuentaId); if (l.clienteId) x.clientes.add(l.clienteId); if (l.compraId) x.servicios.add(l.compraId);
    if (l.enlace === "sin_cuenta") x.sinCuenta++; if (l.planSinClasificar) x.planSinClasificar++;
  }
  for (const e of esperados) P(e.plataforma).esperadoHnl += e.precio;
  for (const c of piezas) P(c.plataforma).costoHnl += c.costoHnl;
  for (const c of caja) P(c.plataforma).desembolsoHnl += c.costoHnl;
  const porPlataforma = [...plats.values()].map((x) => {
    const cobrado = r2(x.cobradoHnl), cub = r2(x.cobradoCubiertoHnl), costo = r2(x.costoHnl);
    const cobertura = cobrado > 0 ? pct(cub, cobrado) : null;
    const resultado = cub > 0 || costo > 0 ? r2(cub - costo) : null;
    const estado = cobrado === 0 && costo === 0 ? "sin_movimiento" : cobrado > 0 && cub === 0 ? "costo_pendiente" : cobrado === 0 ? "sin_ingreso" : cobertura < 99.5 ? "cobertura_parcial" : "ok";
    return { ...x, cuentas: x.cuentas.size, clientes: x.clientes.size, servicios: x.servicios.size, ventas: x.altas + x.renovaciones + x.otros, ingresoHnl: r2(x.ingresoHnl), cobradoHnl: cobrado, cobradoCubiertoHnl: cub, cobradoSinCostoHnl: r2(cobrado - cub), pendienteHnl: r2(x.pendienteHnl), esperadoHnl: r2(x.esperadoHnl), costoHnl: costo, desembolsoHnl: r2(x.desembolsoHnl),
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

  return { resumen, porPlataforma, lineas, esperados, costos: piezas, desembolsos: caja, bandeja, _movs: movimientos };
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
export function cuentasDePlataforma(ctx, calc, plataforma) {
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
      resultadoHnl: cos.length ? r2(cobrado - costo) : null, sinMovimiento: !lin.length && !esp.length, planSinClasificar: a._familia === "hbomax" });
  }
  return out.sort((a, b) => b.cobradoHnl - a.cobradoHnl || a.correo.localeCompare(b.correo));
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
      cobradoHnl: r2(mis.reduce((x, l) => x + l.cobrado, 0)), pendienteHnl: r2(mis.reduce((x, l) => x + l.pendiente, 0)), descuentoHnl: r2(mis.reduce((x, l) => x + (l.descuento || 0), 0)), recibos: mis.map((l) => ({ fecha: l.fecha, tipo: l.tipo, monto: l.monto, cobrado: l.cobrado, banco: l.banco, fuente: l.fuente, registradoPor: l.registradoPor, referencia: l.referencia, combo: l.combo })),
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
  for (const l of calc.lineas) f.push({ Fecha: l.fecha, Tipo: l.tipo === "renovacion" ? "Renovación cobrada" : l.tipo === "venta" ? "Alta nueva" : "Otro cobro", Plataforma: nombrePlataforma(l.plataforma), "Cuenta madre": l.cuentaCorreo, Perfil: l.perfil, Beneficiario: l.beneficiario, "Titular de ficha": l.titular, Vendedor: l.vendedor, Proveedor: "", "Ingreso cobrado": l.cobrado, "Ingreso pendiente": l.pendiente, "Costo imputado": "", Resultado: "", Moneda: "HNL", Tasa: "", Estado: l.pendiente > 0 ? (l.cobrado > 0 ? "Pago parcial" : "Pago pendiente") : l.enlace === "sin_cuenta" ? "Asignación pendiente de conciliar" : l.costoCubierto ? "Conciliado" : "Costo incompleto", Fuente: l.fuente, Banco: l.banco, "Registrado por": l.registradoPor, Combo: l.combo ? "Sí" : "", Referencia: l.referencia });
  for (const e of calc.esperados) f.push({ Fecha: e.fecha, Tipo: "Renovación esperada", Plataforma: nombrePlataforma(e.plataforma), "Cuenta madre": e.cuentaCorreo, Perfil: "", Beneficiario: e.beneficiario, "Titular de ficha": e.titular, Vendedor: e.vendedor, Proveedor: "", "Ingreso cobrado": 0, "Ingreso pendiente": e.precio, "Costo imputado": "", Resultado: "", Moneda: "HNL", Tasa: "", Estado: "Ingreso sin confirmar", Fuente: "", Banco: "", "Registrado por": "", Combo: "", Referencia: e.compraId });
  for (const c of calc.costos) f.push({ Fecha: c.fechaCompra || "", Tipo: `Costo · ${c.regla}`, Plataforma: nombrePlataforma(c.plataforma), "Cuenta madre": c.correo || "", Perfil: "", Beneficiario: "", "Titular de ficha": "", Vendedor: "", Proveedor: c.proveedor || "", "Ingreso cobrado": "", "Ingreso pendiente": "", "Costo imputado": c.costoHnl, Resultado: "", Moneda: c.moneda || "HNL", Tasa: c.tasa ?? "", Estado: c.aviso ? "Datos incompletos" : "Costo real", Fuente: "", Banco: "", "Registrado por": "", Combo: "", Referencia: c.loteId || c.familiaId || "" });
  return f;
}
