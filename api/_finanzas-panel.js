// api/_finanzas-panel.js · R196 — FINANZAS (pestaña nueva de Sublichat Web): Resumen · Proveedores · Compras · Ganancias · Reportes
// + importación del Excel «Sublichat_Netflix_VIP_Importacion.xlsx». Documento maestro v1.1 del 08/11/2026.
// ------------------------------------------------------------------------------------------------------------------
// · NO modifica Control Maestro: lee `inventario` (accesos VIP existentes) y escribe SOLO en colecciones propias:
//     fin_vip_extras/{idAccesoControlMaestro}   vínculo financiero del extra (proveedor, costo, fechas del PROVEEDOR)
//     fin_vip_lotes/{idLote}                     pago real agrupado a Trap/Deku (UNA vez por lote, nunca por extra)
//     fin_import_jobs/{jobId}                    hash, autor, contadores, foto «antes» para deshacer
//     finanzas_config/finanzas_panel             umbral de margen (configurable)
// · Reutiliza el FINANCE OS existente (R135–R139): productos, proveedores, lotes PEPS, costo de venta por venta
//   (fin_consumos) y Binance. No crea ventas, cobros, clientes, cuentas ni renovaciones.
// · Sin costo registrado = «Pendiente de costo» (nunca 0). Cero solo para productos «costo_cero» confirmados.
// · Los lotes VIP importados quedan como pagos al proveedor registrados en Finanzas; NO mueven bancos ni Binance
//   (para no duplicar un pago que quizá ya está en el libro). Ver documento R196.
// ------------------------------------------------------------------------------------------------------------------
import crypto from "node:crypto";
import { createRequire } from "node:module";
const requireCjs = createRequire(import.meta.url);

const r2 = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const r6 = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 1e6) / 1e6 : 0; };
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const txt = (v, max = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const normEmail = (v) => String(v ?? "").trim().toLowerCase();
const normTxt = (v) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const ymdOk = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
function errUsuario(msg, status = 400) { const e = new Error(msg); e.userError = true; e.status = status; return e; }

export const UMBRAL_MARGEN_DEFECTO = 30;
export const CATEGORIA_LABEL = Object.freeze({ perfiles: "Streaming", tv_digital: "TV digital", musica: "Música", software: "Software", cuentas_completas: "Cuentas completas", ia: "IA / Productividad", videojuegos: "Videojuegos", recargas: "Recargas", antivirus: "Antivirus", sin_clasificar: "Sin clasificar" });
const mesAnterior = (mes) => { const [y, m] = mes.split("-").map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

// ================================================================================================================
// 1) RENTABILIDAD POR PRODUCTO (desde fin_consumos: ingreso atribuido por línea + costo asignado PEPS, una sola vez)
// ================================================================================================================
export function rentabilidadMes(consumos = [], productos = [], mes, umbral = UMBRAL_MARGEN_DEFECTO) {
  const prodDe = new Map(productos.map((p) => [p.id, p]));
  const filas = new Map();
  const tot = { ingresoHnl: 0, ingresoCosteadoHnl: 0, costoHnl: 0, ingresoPendienteHnl: 0, ventas: 0, ventasPendientes: 0 };
  for (const c of consumos) {
    if (c.mesKey !== mes || c.estado === "revertido") continue;
    tot.ventas++;
    let ventaPend = false;
    for (const l of c.lineas || []) {
      const p = l.productoId ? prodDe.get(l.productoId) : null;
      const key = l.productoId || `?${normTxt(l.servicio)}`;
      const f = filas.get(key) || { productoId: l.productoId || "", producto: (p && p.nombre) || l.producto || l.servicio || "Sin producto", categoria: (p && p.categoria) || "sin_clasificar", modelo: (p && p.modelo) || "",
        ventas: 0, unidades: 0, ingresoHnl: 0, ingresoCosteadoHnl: 0, costoHnl: 0, ingresoPendienteHnl: 0, ventasPendientes: 0 };
      const ing = r2(l.ingresoHnl), costeada = !l.pendiente && !l.sinProducto && !(Number(l.faltante) > 0);
      f.ventas++; f.unidades += Number(l.cantidad || 1); f.ingresoHnl = r2(f.ingresoHnl + ing); tot.ingresoHnl = r2(tot.ingresoHnl + ing);
      if (costeada) { f.ingresoCosteadoHnl = r2(f.ingresoCosteadoHnl + ing); f.costoHnl = r2(f.costoHnl + r2(l.costoHnl)); tot.ingresoCosteadoHnl = r2(tot.ingresoCosteadoHnl + ing); tot.costoHnl = r2(tot.costoHnl + r2(l.costoHnl)); }
      else { f.ingresoPendienteHnl = r2(f.ingresoPendienteHnl + ing); f.ventasPendientes++; tot.ingresoPendienteHnl = r2(tot.ingresoPendienteHnl + ing); ventaPend = true; }
      filas.set(key, f);
    }
    if (ventaPend) tot.ventasPendientes++;
  }
  const productosOut = [...filas.values()].map((f) => {
    const ganancia = r2(f.ingresoCosteadoHnl - f.costoHnl);
    const margen = pct(ganancia, f.ingresoCosteadoHnl);
    let estado = "rentable";
    if (!(f.ingresoCosteadoHnl > 0)) estado = "pendiente_costo";
    else if (margen !== null && margen < umbral) estado = "margen_bajo";
    else if (f.ingresoPendienteHnl > 0) estado = "parcial";
    return { ...f, gananciaHnl: f.ingresoCosteadoHnl > 0 ? ganancia : null, margen: f.ingresoCosteadoHnl > 0 ? margen : null, estado };
  }).sort((a, b) => (b.gananciaHnl ?? -1e12) - (a.gananciaHnl ?? -1e12) || b.ingresoHnl - a.ingresoHnl);
  const cats = new Map();
  for (const f of productosOut) {
    const k = f.categoria || "sin_clasificar";
    const x = cats.get(k) || { categoria: k, label: CATEGORIA_LABEL[k] || k, gananciaHnl: 0, ingresoHnl: 0, costoHnl: 0, pendienteHnl: 0 };
    x.gananciaHnl = r2(x.gananciaHnl + (f.gananciaHnl || 0)); x.ingresoHnl = r2(x.ingresoHnl + f.ingresoHnl); x.costoHnl = r2(x.costoHnl + f.costoHnl); x.pendienteHnl = r2(x.pendienteHnl + f.ingresoPendienteHnl);
    cats.set(k, x);
  }
  const ganancia = r2(tot.ingresoCosteadoHnl - tot.costoHnl);
  return {
    mes, umbral,
    kpis: { ingresosHnl: tot.ingresoHnl, ingresoCosteadoHnl: tot.ingresoCosteadoHnl, costosHnl: tot.costoHnl, gananciaHnl: ganancia, margen: pct(ganancia, tot.ingresoCosteadoHnl), ingresoSinCostoHnl: tot.ingresoPendienteHnl, ventas: tot.ventas, ventasSinCosto: tot.ventasPendientes },
    productos: productosOut,
    categorias: [...cats.values()].sort((a, b) => b.gananciaHnl - a.gananciaHnl),
    top: productosOut.filter((p) => p.gananciaHnl !== null && p.gananciaHnl > 0).slice(0, 5),
  };
}
export function variacion(actual, anterior) {
  const d = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null);
  return { ingresos: d(actual.ingresosHnl, anterior.ingresosHnl), costos: d(actual.costosHnl, anterior.costosHnl), ganancia: anterior.gananciaHnl > 0 ? d(actual.gananciaHnl, anterior.gananciaHnl) : null,
    margenPp: actual.margen !== null && anterior.margen !== null ? Math.round((actual.margen - anterior.margen) * 10) / 10 : null };
}

// ================================================================================================================
// 2) EXCEL NETFLIX VIP · validación y coincidencias (el servidor SIEMPRE recalcula; el navegador solo lee el archivo)
// ================================================================================================================
export const COLS_EXTRAS = Object.freeze(["ID_acceso_Control_Maestro", "Correo_o_ID_extra", "Cuenta_madre_Netflix", "Proveedor", "Costo_mensual_USDT", "Fecha_proximo_cobro_proveedor", "Fecha_ultimo_pago_proveedor", "Estado", "ID_lote_compra", "Tasa_Binance_HNL_USDT", "Renovar_proximo_mes", "Notas"]);
export const COLS_LOTES = Object.freeze(["ID_lote", "Proveedor", "Fecha_pago_proveedor", "Cantidad_extras_pagados", "Total_pagado_USDT", "Tasa_Binance_HNL_por_USDT", "Comisiones_adicionales_HNL", "Comprobante_o_referencia", "Observaciones"]);
export const MAX_FILAS = 2000;

// Fecha de Excel: número de serie (sistema 1900) o texto ISO/dd-mm-aaaa → "aaaa-mm-dd", sin zona horaria.
export function fechaExcel(v) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number" && Number.isFinite(v) && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10); }
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return valida(`${m[1]}-${m[2]}-${m[3]}`);
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s); if (m) return valida(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
  return null;
  function valida(ymd) { const [y, mo, d] = ymd.split("-").map(Number); const t = new Date(Date.UTC(y, mo - 1, d)); return t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? ymd : null; }
}
const num = (v) => { if (v === null || v === undefined || v === "") return null; const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ".").replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : NaN; };
// Proveedor: por NOMBRE, nunca por precio.
export function proveedorVip(nombre, proveedores = []) {
  const n = normTxt(nombre);
  if (!n) return null;
  if (/\btrap\b/.test(n)) return { id: "trap-colombia", alias: "Trap colombiano", grupo: "trap" };
  if (/\bdeku\b/.test(n)) return { id: "deku-peru", alias: "Deku peruano", grupo: "deku" };
  if (/\bpropio/.test(n)) return { id: "propio", alias: "VIP propio", grupo: "propio" };
  const p = proveedores.find((x) => normTxt(x.alias) === n || x.id === n);
  return p ? { id: p.id, alias: p.alias, grupo: "otro" } : null;
}
const ESTADOS_VIP = { activo: "activo", activa: "activo", pendiente: "pendiente", baja: "baja", "dado de baja": "baja", inactivo: "baja" };
const SINO = (v) => { const n = normTxt(v); if (!n) return null; if (["si", "sí", "s", "yes", "true", "1", "x"].includes(n)) return true; if (["no", "n", "false", "0"].includes(n)) return false; return undefined; };
const madreDe = (c = {}) => normEmail(c.cuentaMadre || c.madre || c.correoMadre || c.cuentaPrincipal || c.madreCorreo || "");
const clienteDeInv = (c = {}) => { const cl = Array.isArray(c.clientes) ? c.clientes.find((x) => x && (x.nombre || x.cliente || x.clienteNombre)) : null; return cl ? txt(cl.nombre || cl.cliente || cl.clienteNombre, 80) : ""; };

export function hashFilas(extras, lotes) { return crypto.createHash("sha256").update(JSON.stringify({ e: extras, l: lotes })).digest("hex").slice(0, 32); }

/* Recalcula todo: filas válidas, duplicadas, sin coincidencia, ambiguas, costo/fecha inválidos, lote sin referencia,
   proveedor desconocido. Bloquea SOLO la fila con problema, nunca el archivo entero. */
export function previsualizarVip({ extras = [], lotes = [] }, { inventarioVip = [], existentes = new Map(), lotesExistentes = new Map(), proveedores = [], resoluciones = {} } = {}) {
  if (extras.length > MAX_FILAS || lotes.length > MAX_FILAS) throw errUsuario(`El archivo trae más de ${MAX_FILAS} filas: divídalo.`);
  const porId = new Map(inventarioVip.map((c) => [c.id, c]));
  const porCorreo = new Map(); for (const c of inventarioVip) { const k = normEmail(c.correo); if (!k) continue; (porCorreo.get(k) || porCorreo.set(k, []).get(k)).push(c); }
  // --- lotes ---
  const lotesOut = []; const loteValido = new Map();
  const vistosLote = new Set();
  lotes.forEach((raw, i) => {
    const fila = Number(raw._fila) || i + 2;
    const id = txt(raw.ID_lote, 60);
    const vacia = COLS_LOTES.every((k) => raw[k] === null || raw[k] === undefined || String(raw[k]).trim() === "");
    if (vacia) return;
    const errores = [];
    if (!id) errores.push("Falta ID_lote");
    if (id && vistosLote.has(id)) errores.push("ID_lote repetido en el archivo");
    const prov = proveedorVip(raw.Proveedor, proveedores); if (!prov) errores.push("Proveedor desconocido");
    const fecha = fechaExcel(raw.Fecha_pago_proveedor); if (!fecha) errores.push("Fecha de pago inválida");
    const cant = num(raw.Cantidad_extras_pagados); if (!(Number.isInteger(cant) && cant > 0)) errores.push("Cantidad inválida");
    const total = num(raw.Total_pagado_USDT); if (!(total > 0)) errores.push("Total USDT inválido");
    const tasa = num(raw.Tasa_Binance_HNL_por_USDT); if (!(tasa > 0)) errores.push("Falta la tasa Binance del lote");
    const com = num(raw.Comisiones_adicionales_HNL); if (Number.isNaN(com) || (com !== null && com < 0)) errores.push("Comisión inválida");
    const datos = errores.length ? null : { idLote: id, proveedorId: prov.id, proveedor: prov.alias, grupo: prov.grupo, fechaPago: fecha, cantidad: cant, totalUsdt: r6(total), tasa: r6(tasa), comisionesHnl: r2(com || 0),
      costoTotalHnl: r2(total * tasa + (com || 0)), costoPorExtraHnl: r6((total * tasa + (com || 0)) / cant), costoPorExtraUsdt: r6(total / cant), comprobante: txt(raw.Comprobante_o_referencia, 120), observaciones: txt(raw.Observaciones, 300) };
    let estado = errores.length ? "error" : "nuevo", cambios = [];
    if (datos && lotesExistentes.has(id)) {
      const a = lotesExistentes.get(id);
      cambios = ["proveedorId", "fechaPago", "cantidad", "totalUsdt", "tasa", "comisionesHnl", "comprobante"].filter((k) => String(a[k] ?? "") !== String(datos[k] ?? ""));
      estado = cambios.length ? "actualiza" : "sin_cambios";
    }
    if (id) vistosLote.add(id);
    if (datos) loteValido.set(id, datos);
    lotesOut.push({ fila, idLote: id, estado, errores, datos, cambios, extrasEnArchivo: 0 });
  });
  // --- extras ---
  const extrasOut = []; const usados = new Map();
  extras.forEach((raw, i) => {
    const fila = Number(raw._fila) || i + 2;
    const vacia = COLS_EXTRAS.every((k) => raw[k] === null || raw[k] === undefined || String(raw[k]).trim() === "");
    if (vacia) return; // filas con solo fórmulas de ayuda: se ignoran
    const errores = [], avisos = [];
    const idCM = txt(raw.ID_acceso_Control_Maestro, 80), correo = normEmail(raw.Correo_o_ID_extra), madre = normEmail(raw.Cuenta_madre_Netflix);
    let match = null, candidatos = [];
    if (idCM) { match = porId.get(idCM) || null; if (!match) errores.push("Ese ID no existe en Control Maestro (Netflix VIP)"); }
    else if (correo) {
      candidatos = porCorreo.get(correo) || [];
      if (candidatos.length > 1 && madre) { const f2 = candidatos.filter((c) => madreDe(c) === madre); if (f2.length) candidatos = f2; }
      if (candidatos.length === 1) match = candidatos[0];
      else if (candidatos.length > 1) { const elegido = resoluciones[String(fila)]; match = elegido ? candidatos.find((c) => c.id === elegido) || null : null; }
      else errores.push("Sin coincidencia exacta por correo");
    } else errores.push("Falta ID de Control Maestro o correo");
    if (match && madre && madreDe(match) && madreDe(match) !== madre) avisos.push("La cuenta madre del Excel no coincide con la de Control Maestro");
    const prov = proveedorVip(raw.Proveedor, proveedores); if (!prov) errores.push(raw.Proveedor ? "Proveedor desconocido" : "Falta proveedor");
    const loteId = txt(raw.ID_lote_compra, 60);
    const lote = loteId ? (loteValido.get(loteId) || lotesExistentes.get(loteId) || null) : null;
    if (loteId && !lote) errores.push("ID de lote sin referencia válida en LOTES_COMPRAS");
    if (lote && prov && lote.proveedorId !== prov.id) errores.push("El proveedor del lote no coincide con el de la fila");
    const costoE = num(raw.Costo_mensual_USDT);
    if (Number.isNaN(costoE) || (costoE !== null && !(costoE > 0 && costoE < 1000))) errores.push("Costo mensual USDT inválido");
    const costoUsdt = costoE > 0 ? r6(costoE) : lote ? r6(lote.costoPorExtraUsdt) : null;
    if (costoUsdt === null && !errores.some((e) => /Costo|lote sin referencia/.test(e))) errores.push("Falta costo (ni en la fila ni en el lote)");
    const proximo = fechaExcel(raw.Fecha_proximo_cobro_proveedor); if (!proximo) errores.push(raw.Fecha_proximo_cobro_proveedor ? "Fecha de próximo cobro inválida" : "Falta fecha de próximo cobro del proveedor");
    const ultimo = fechaExcel(raw.Fecha_ultimo_pago_proveedor); if (ultimo === null) errores.push("Fecha de último pago inválida");
    const est = raw.Estado ? ESTADOS_VIP[normTxt(raw.Estado)] : "activo"; if (!est) errores.push("Estado inválido (Activo, Pendiente o Baja)");
    const tasaFila = num(raw.Tasa_Binance_HNL_USDT); if (Number.isNaN(tasaFila) || (tasaFila !== null && !(tasaFila > 0))) errores.push("Tasa inválida");
    const renovar = SINO(raw.Renovar_proximo_mes); if (renovar === undefined) errores.push("Renovar_proximo_mes: use Sí o No");
    if (match && usados.has(match.id)) errores.push(`Duplicado en el archivo (igual que la fila ${usados.get(match.id)})`);
    let estado;
    if (!match && candidatos.length > 1 && !errores.length) estado = "ambiguo";
    else if (errores.length) estado = errores.some((e) => /Duplicado/.test(e)) ? "duplicado" : !match ? "sin_coincidencia" : "error";
    else estado = "ok";
    const tasa = lote ? lote.tasa : tasaFila || null;
    const datos = estado === "ok" ? { cmId: match.id, correo: normEmail(match.correo), madre: madreDe(match), proveedorId: prov.id, proveedor: prov.alias, grupo: prov.grupo, costoMensualUsdt: costoUsdt, tasa: tasa ? r6(tasa) : null,
      costoMensualHnl: tasa ? r2(costoUsdt * tasa) : null, proximoPagoProveedor: proximo, ultimoPagoProveedor: ultimo || "", estadoSeguimiento: est, loteId: loteId || "", renovarProximoMes: renovar ?? null, notas: txt(raw.Notas, 300) } : null;
    let cambios = [];
    if (datos) {
      usados.set(match.id, fila);
      const a = existentes.get(match.id);
      if (a) { cambios = Object.keys(datos).filter((k) => String(a[k] ?? "") !== String(datos[k] ?? "")); if (!cambios.length) estado = "sin_cambios"; else estado = "actualiza"; }
      else estado = "nuevo";
      if (loteId) { const lo = lotesOut.find((x) => x.idLote === loteId); if (lo) lo.extrasEnArchivo++; }
    }
    extrasOut.push({ fila, estado, errores, avisos, cmId: match ? match.id : "", correo: correo || (match ? normEmail(match.correo) : ""), cliente: match ? clienteDeInv(match) : "",
      candidatos: !match && candidatos.length > 1 ? candidatos.map((c) => ({ id: c.id, correo: normEmail(c.correo), madre: madreDe(c), cliente: clienteDeInv(c) })) : [], datos, cambios });
  });
  for (const lo of lotesOut) if (lo.datos && lo.extrasEnArchivo && lo.extrasEnArchivo !== lo.datos.cantidad) lo.avisos = [`El lote dice ${lo.datos.cantidad} extras y el archivo vincula ${lo.extrasEnArchivo}: revise (no se ajusta solo).`];
  const cuenta = (arr, e) => arr.filter((x) => x.estado === e).length;
  const resumen = {
    filasExtras: extrasOut.length, nuevos: cuenta(extrasOut, "nuevo"), actualizados: cuenta(extrasOut, "actualiza"), sinCambios: cuenta(extrasOut, "sin_cambios"), ambiguos: cuenta(extrasOut, "ambiguo"),
    sinCoincidencia: cuenta(extrasOut, "sin_coincidencia"), duplicados: cuenta(extrasOut, "duplicado"), conError: cuenta(extrasOut, "error"),
    costoInvalido: extrasOut.filter((x) => x.errores.some((e) => /Costo|costo/.test(e))).length, fechaInvalida: extrasOut.filter((x) => x.errores.some((e) => /Fecha|fecha/.test(e))).length,
    loteSinReferencia: extrasOut.filter((x) => x.errores.some((e) => /lote sin referencia/.test(e))).length, proveedorDesconocido: extrasOut.filter((x) => x.errores.some((e) => /Proveedor desconocido|Falta proveedor/.test(e))).length,
    lotesNuevos: cuenta(lotesOut, "nuevo"), lotesActualizados: cuenta(lotesOut, "actualiza"), lotesSinCambios: cuenta(lotesOut, "sin_cambios"), lotesConError: cuenta(lotesOut, "error"),
    pagosUnicos: lotesOut.filter((x) => x.estado === "nuevo").length, ventasNuevas: 0, cuentasNuevas: 0, clientesNuevos: 0,
  };
  return { resumen, extras: extrasOut, lotes: lotesOut };
}

// ================================================================================================================
// 3) HANDLER (/api/finanzas · acciones finp_*). Permiso: módulo «finanzas-panel» (por defecto solo Sublicuentas).
// ================================================================================================================
export const ACCIONES_PANEL = Object.freeze(["finp_panel", "finp_config", "finp_vip_preview", "finp_vip_confirmar", "finp_vip_deshacer", "finp_vip_lista", "finp_vip_editar", "finp_vip_reemplazar", "finp_reporte", "finp_importaciones", "finp_spf_lista", "finp_spf_guardar"]); // R196f · Spotify Familiar

async function leerVipBase(db) {
  const inv = (await db.collection("inventario").where("plataforma", "==", "vipnetflix").get()).docs.map((x) => ({ id: x.id, ...(x.data() || {}) }));
  const ex = (await db.collection("fin_vip_extras").get()).docs.map((x) => ({ id: x.id, ...(x.data() || {}) }));
  const lo = (await db.collection("fin_vip_lotes").get()).docs.map((x) => ({ id: x.id, ...(x.data() || {}) }));
  return { inv, ex, lo };
}
function limpiarEntrada(arr = [], cols) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, MAX_FILAS + 1).map((r, i) => { const o = { _fila: Number(r && r._fila) || i + 2 }; for (const k of cols) { const v = r ? r[k] : null; o[k] = typeof v === "number" ? v : v == null ? null : String(v).slice(0, 400); } return o; });
}

export async function handlePanel(db, accion, body, identity, authUser, res, d) {
  const hoy = d.hoyYmdHN(), ahora = new Date().toISOString(), actor = identity.usuario;
  const ok = (r) => res.status(200).json({ ok: true, accion, ...r });
  const fail = (e) => res.status(e.status && e.status < 500 ? 200 : 500).json({ ok: false, error: e.userError ? e.message : "No se pudo completar." });
  const col = (c) => db.collection(c);
  const todos = async (c) => (await col(c).get()).docs.map((x) => ({ id: x.id, ...(x.data() || {}) }));
  const audit = (tx, ev) => d.auditar(tx, db, identity, { origen: body.origen || "web", modulo: "finanzas_panel", ...ev });
  try {
    if (accion === "finp_panel") {
      const mes = /^\d{4}-\d{2}$/.test(String(body.mes || "")) ? String(body.mes) : hoy.slice(0, 7);
      let costeo = null;
      if (d.correrCosteo) { try { costeo = await d.correrCosteo(); } catch (e) { costeo = { error: String(e?.message || e).slice(0, 160) }; } }
      const [productos, proveedores, lotes, cfgSnap, consumosMes, consumosAnt, methods] = await Promise.all([
        todos("fin_productos"), todos("fin_proveedores"), todos("fin_lotes"), col("finanzas_config").doc("finanzas_panel").get(),
        col("fin_consumos").where("mesKey", "==", mes).get().then((s) => s.docs.map((x) => ({ id: x.id, ...(x.data() || {}) }))),
        col("fin_consumos").where("mesKey", "==", mesAnterior(mes)).get().then((s) => s.docs.map((x) => ({ id: x.id, ...(x.data() || {}) }))),
        d.loadMethods(db).catch(() => []),
      ]);
      const cfg = { umbralMargen: UMBRAL_MARGEN_DEFECTO, ...(cfgSnap.exists ? cfgSnap.data() : {}) };
      const actual = rentabilidadMes(consumosMes, productos, mes, cfg.umbralMargen);
      const anterior = rentabilidadMes(consumosAnt, productos, mesAnterior(mes), cfg.umbralMargen);
      const { inv, ex, lo } = await leerVipBase(db);
      const vipProv = { trap: 0, deku: 0, propio: 0, otro: 0, sin: 0 };
      const exMap = new Map(ex.filter((x) => x.estadoSeguimiento !== "reemplazado").map((x) => [x.id, x]));
      for (const c of inv) { const x = exMap.get(c.id); vipProv[x ? x.grupo || "otro" : "sin"]++; }
      const en7 = new Date(Date.parse(`${hoy}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
      const proximos = ex.filter((x) => x.estadoSeguimiento === "activo" && x.proximoPagoProveedor && x.proximoPagoProveedor >= hoy && x.proximoPagoProveedor <= en7);
      const alertas = [];
      for (const p of actual.productos.filter((p) => p.estado === "margen_bajo")) alertas.push({ tipo: "margen_bajo", nivel: "media", productoId: p.productoId, producto: p.producto, margen: p.margen, objetivo: cfg.umbralMargen, texto: `Margen actual ${p.margen}% · objetivo ≥ ${cfg.umbralMargen}%` });
      for (const p of actual.productos.filter((p) => p.ingresoPendienteHnl > 0)) alertas.push({ tipo: "sin_costo", nivel: "media", productoId: p.productoId, producto: p.producto, texto: `${p.ventasPendientes} venta(s) sin costo registrado (L${p.ingresoPendienteHnl}): registre la compra.` });
      if (proximos.length) alertas.push({ tipo: "vip_cobro", nivel: "info", producto: "Netflix VIP", texto: `${proximos.length} extra(s) VIP con cobro del proveedor en los próximos 7 días.` });
      try { // R196f · renovaciones de cuentas Spotify Familiar
        const fs = await todos("fin_spotify_cuentas"); const vence = fs.filter((x) => x.proximaRenovacion && x.proximaRenovacion <= en7);
        if (vence.length) alertas.push({ tipo: "spf_renovacion", nivel: "info", producto: "Spotify Familiar", texto: `${vence.length} cuenta(s) principal(es) renuevan en 7 días o ya vencieron.` });
      } catch (_) {}
      if (vipProv.sin) alertas.push({ tipo: "vip_sin_proveedor", nivel: "info", producto: "Netflix VIP", texto: `${vipProv.sin} extra(s) VIP de Control Maestro sin proveedor en Finanzas.` });
      const inventario = d.resumenInventario ? d.resumenInventario(productos, lotes, hoy) : [];
      for (const i of inventario.filter((i) => i.stockBajo)) alertas.push({ tipo: "stock", nivel: "media", producto: i.nombre, texto: `Quedan ${i.disponible} ${i.unidad || "unidades"}: toca comprar.` });
      for (const i of inventario.filter((i) => i.vencePronto)) alertas.push({ tipo: "vence", nivel: "media", producto: i.nombre, texto: `Lote vence el ${i.proximoVencimiento}.` });
      return ok({ hoy, mes, mesAnterior: mesAnterior(mes), config: cfg, ...actual, variacion: variacion(actual.kpis, anterior.kpis), anteriorKpis: anterior.kpis, alertas, costeo,
        proveedores: proveedores.map((p) => ({ id: p.id, alias: p.alias, pais: p.pais || "", moneda: p.moneda || "", metodoPago: p.metodoPago || "", activo: p.activo !== false, notas: p.notas || "", terminos: (p.terminos || []).slice(-10) })),
        costosProveedor: d.costosProveedor ? d.costosProveedor(lotes) : [], rentProveedores: d.rentabilidad ? d.rentabilidad({ consumos: consumosMes, lotes, movimientos: [] }, mes).proveedores : [],
        productosCatalogo: productos.map((p) => ({ id: p.id, nombre: p.nombre, categoria: p.categoria, modelo: p.modelo, capacidad: p.capacidad, duracionDias: p.duracionDias, unidad: p.unidad, activo: p.activo !== false, costoRef: p.costoRef || null })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
        lotes: lotes.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 120).map((l) => ({ id: l.id, fecha: l.fecha, producto: l.producto, productoId: l.productoId, proveedor: l.proveedor, cantidad: l.cantidad, disponible: l.disponible, unidad: l.unidad, moneda: l.moneda, costoTotalMoneda: l.costoTotalMoneda, tasa: l.tasa, costoTotalHnl: l.costoTotalHnl, costoUnitarioHnl: l.costoUnitarioHnl, pago: l.pago, cuentaPagoNombre: l.cuentaPagoNombre, estado: l.estado, referencia: l.referencia || "", vigenciaHasta: l.vigenciaHasta || "" })),
        vip: { porProveedor: vipProv, total: inv.length, proximos7: proximos.length, lotes: lo.length },
        lotesVip: lo.sort((a, b) => String(b.fechaPago).localeCompare(String(a.fechaPago))).slice(0, 60),
        metodos: (methods || []).map((m) => ({ id: m.id, nombre: m.nombre })), categoriasLabel: CATEGORIA_LABEL,
        modelos: d.MODELOS || {}, monedas: d.MONEDAS || [] });
    }

    if (accion === "finp_config") {
      if (!identity.admin) throw errUsuario("Solo Sublicuentas cambia el umbral de margen.", 403);
      const u = Number(body.umbralMargen);
      if (!(u >= 0 && u <= 95)) throw errUsuario("El umbral debe estar entre 0% y 95%.");
      await db.runTransaction(async (tx) => {
        const ref = col("finanzas_config").doc("finanzas_panel"); const s = await tx.get(ref); const antes = s.exists ? s.data() : {};
        tx.set(ref, { umbralMargen: Math.round(u * 10) / 10, updatedAt: ahora, updatedBy: actor }, { merge: true });
        audit(tx, { accion: "umbral_margen", targetType: "config", targetId: "finanzas_panel", before: { umbralMargen: antes.umbralMargen ?? null }, after: { umbralMargen: u } });
      });
      return ok({ umbralMargen: u });
    }

    if (accion === "finp_vip_preview" || accion === "finp_vip_confirmar") {
      const extras = limpiarEntrada(body.extras, COLS_EXTRAS), lotes = limpiarEntrada(body.lotes, COLS_LOTES);
      const hojas = Array.isArray(body.hojas) ? body.hojas.map((h) => String(h)) : [];
      if (!hojas.includes("EXTRAS_VIP") || !hojas.includes("LOTES_COMPRAS")) throw errUsuario("Ese archivo no es la plantilla «Sublichat_Netflix_VIP_Importacion.xlsx» (faltan las hojas EXTRAS_VIP y LOTES_COMPRAS).");
      const { inv, ex, lo } = await leerVipBase(db);
      const proveedores = await todos("fin_proveedores");
      const resoluciones = body.resoluciones && typeof body.resoluciones === "object" ? body.resoluciones : {};
      const base = { inventarioVip: inv, existentes: new Map(ex.map((x) => [x.id, x])), lotesExistentes: new Map(lo.map((x) => [x.id, x])), proveedores, resoluciones };
      const pv = previsualizarVip({ extras, lotes }, base);
      const hash = hashFilas(extras, lotes);
      if (accion === "finp_vip_preview") return ok({ hash, archivo: { nombre: txt(body.archivo?.nombre, 120), bytes: Number(body.archivo?.bytes) || 0 }, ...pv });
      // ---------- confirmar: misma vista previa recalculada + hash igual + confirmación explícita ----------
      if (body.confirmo !== true) throw errUsuario("Confirme la conciliación.");
      if (String(body.hash || "") !== hash) throw errUsuario("El archivo cambió desde la vista previa: vuelva a revisarlo.");
      const extrasOk = pv.extras.filter((x) => x.estado === "nuevo" || x.estado === "actualiza");
      const lotesOk = pv.lotes.filter((x) => x.estado === "nuevo" || x.estado === "actualiza");
      if (!extrasOk.length && !lotesOk.length) throw errUsuario("No hay filas nuevas ni cambios para importar.");
      if (extrasOk.length + lotesOk.length > 480) throw errUsuario("Demasiadas filas para una sola confirmación (máx. 480): divida el archivo.");
      const jobRef = col("fin_import_jobs").doc();
      const r = await db.runTransaction(async (tx) => {
        const exRefs = extrasOk.map((x) => col("fin_vip_extras").doc(x.cmId)), loRefs = lotesOk.map((x) => col("fin_vip_lotes").doc(x.idLote));
        const exSnaps = await Promise.all(exRefs.map((rf) => tx.get(rf))), loSnaps = await Promise.all(loRefs.map((rf) => tx.get(rf)));
        const antesEx = {}, antesLo = {};
        extrasOk.forEach((x, i) => {
          const s = exSnaps[i]; const a = s.exists ? s.data() : null; antesEx[x.cmId] = a;
          tx.set(exRefs[i], { ...x.datos, importJobId: jobRef.id, actualizadoAt: ahora, actualizadoPor: actor, ...(a ? {} : { creadoAt: ahora, creadoPor: actor }), historial: [...((a && a.historial) || []), { at: ahora, por: actor, origen: "importacion", jobId: jobRef.id, cambios: x.cambios.length ? x.cambios : Object.keys(x.datos) }].slice(-30) });
        });
        lotesOk.forEach((x, i) => {
          const s = loSnaps[i]; const a = s.exists ? s.data() : null; antesLo[x.idLote] = a;
          tx.set(loRefs[i], { ...x.datos, contabilizadoEnCaja: false, importJobId: jobRef.id, actualizadoAt: ahora, actualizadoPor: actor, ...(a ? {} : { creadoAt: ahora, creadoPor: actor }) });
        });
        tx.set(jobRef, { tipo: "netflix_vip_excel", archivo: { nombre: txt(body.archivo?.nombre, 120), bytes: Number(body.archivo?.bytes) || 0, hashArchivo: txt(body.archivo?.hash, 80) }, hash, actor, createdAt: ahora, estado: "aplicado",
          resumen: { ...pv.resumen, aplicadosExtras: extrasOk.length, aplicadosLotes: lotesOk.length }, antes: { extras: antesEx, lotes: antesLo } });
        audit(tx, { accion: "importar_netflix_vip", targetType: "importacion", targetId: jobRef.id, detalle: `${extrasOk.length} vínculos VIP · ${lotesOk.length} lotes · 0 ventas · 0 cuentas` });
        return { jobId: jobRef.id, extras: extrasOk.length, lotes: lotesOk.length };
      });
      return ok({ ...r, resumen: pv.resumen });
    }

    if (accion === "finp_vip_deshacer") {
      const jobId = String(body.jobId || "");
      const aplicados = (await todos("fin_import_jobs")).filter((x) => x.estado === "aplicado").sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      if (aplicados[0] && aplicados[0].id !== jobId) throw errUsuario("Solo se puede deshacer la ÚLTIMA importación (hay una posterior).");
      const r = await db.runTransaction(async (tx) => {
        const jref = col("fin_import_jobs").doc(jobId); const js = await tx.get(jref);
        if (!js.exists) throw errUsuario("Esa importación no existe.");
        const job = js.data();
        if (job.estado !== "aplicado") throw errUsuario("Esa importación ya se deshizo.");
        const exIds = Object.keys(job.antes?.extras || {}), loIds = Object.keys(job.antes?.lotes || {});
        const exS = await Promise.all(exIds.map((id) => tx.get(col("fin_vip_extras").doc(id))));
        exS.forEach((s, i) => { if (s.exists && s.data().importJobId !== jobId) throw errUsuario("Un vínculo de esta importación se editó después: no se puede deshacer automáticamente."); });
        exIds.forEach((id) => { const a = job.antes.extras[id]; if (a) tx.set(col("fin_vip_extras").doc(id), a); else tx.delete(col("fin_vip_extras").doc(id)); });
        loIds.forEach((id) => { const a = job.antes.lotes[id]; if (a) tx.set(col("fin_vip_lotes").doc(id), a); else tx.delete(col("fin_vip_lotes").doc(id)); });
        tx.set(jref, { estado: "deshecho", deshechoAt: ahora, deshechoPor: actor }, { merge: true });
        audit(tx, { accion: "deshacer_importacion_vip", targetType: "importacion", targetId: jobId, detalle: `${exIds.length} vínculos y ${loIds.length} lotes restaurados` });
        return { extras: exIds.length, lotes: loIds.length };
      });
      return ok(r);
    }

    if (accion === "finp_importaciones") {
      const jobs = (await todos("fin_import_jobs")).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 30)
        .map((j) => ({ id: j.id, tipo: j.tipo, archivo: j.archivo, actor: j.actor, createdAt: j.createdAt, estado: j.estado, resumen: j.resumen, deshechoAt: j.deshechoAt || "" }));
      return ok({ jobs });
    }

    if (accion === "finp_vip_lista") {
      const { inv, ex } = await leerVipBase(db);
      const exMap = new Map(ex.filter((x) => x.estadoSeguimiento !== "reemplazado").map((x) => [x.id, x]));
      const tab = ["trap", "deku", "propio", "otro", "sin", "todos"].includes(body.tab) ? body.tab : "todos";
      const q = normTxt(body.q);
      let filas = inv.map((c) => { const x = exMap.get(c.id) || null; return { cmId: c.id, correo: normEmail(c.correo), madre: madreDe(c), cliente: clienteDeInv(c), estadoCM: c.estado || "", grupo: x ? x.grupo || "otro" : "sin", proveedor: x ? x.proveedor : "", costoMensualUsdt: x ? x.costoMensualUsdt : null, costoMensualHnl: x ? x.costoMensualHnl : null, tasa: x ? x.tasa : null, proximoPagoProveedor: x ? x.proximoPagoProveedor : "", ultimoPagoProveedor: x ? x.ultimoPagoProveedor : "", estado: x ? x.estadoSeguimiento : "sin_registro", loteId: x ? x.loteId : "", renovarProximoMes: x ? x.renovarProximoMes : null, notas: x ? x.notas || "" : "", historial: x ? (x.historial || []).slice(-10) : [] }; });
      const conteo = filas.reduce((a, f) => ((a[f.grupo] = (a[f.grupo] || 0) + 1), a), { trap: 0, deku: 0, propio: 0, otro: 0, sin: 0 });
      if (tab !== "todos") filas = filas.filter((f) => f.grupo === tab);
      if (q) filas = filas.filter((f) => normTxt(`${f.correo} ${f.madre} ${f.cliente} ${f.cmId}`).includes(q));
      if (["activo", "pendiente", "baja"].includes(body.estado)) filas = filas.filter((f) => f.estado === body.estado);
      filas.sort((a, b) => String(a.proximoPagoProveedor || "9999").localeCompare(String(b.proximoPagoProveedor || "9999")) || a.correo.localeCompare(b.correo));
      const porPagina = 25, pagina = Math.max(1, Math.floor(Number(body.pagina) || 1));
      return ok({ conteo, total: filas.length, pagina, paginas: Math.max(1, Math.ceil(filas.length / porPagina)), porPagina, filas: filas.slice((pagina - 1) * porPagina, pagina * porPagina) });
    }

    if (accion === "finp_vip_editar") {
      const cmId = String(body.cmId || ""), c = body.cambios || {};
      const proveedores = await todos("fin_proveedores");
      const r = await db.runTransaction(async (tx) => {
        const invS = await tx.get(col("inventario").doc(cmId));
        if (!invS.exists || String(invS.data().plataforma || "") !== "vipnetflix") throw errUsuario("Ese acceso no es un Netflix VIP de Control Maestro.");
        const ref = col("fin_vip_extras").doc(cmId); const s = await tx.get(ref); const a = s.exists ? s.data() : {};
        const n = {};
        if (c.proveedor !== undefined) { const p = proveedorVip(c.proveedor, proveedores); if (!p) throw errUsuario("Proveedor desconocido."); Object.assign(n, { proveedorId: p.id, proveedor: p.alias, grupo: p.grupo }); }
        if (c.costoMensualUsdt !== undefined) { const v = num(c.costoMensualUsdt); if (!(v > 0 && v < 1000)) throw errUsuario("Costo USDT inválido."); n.costoMensualUsdt = r6(v); }
        if (c.tasa !== undefined) { const v = num(c.tasa); if (!(v > 0)) throw errUsuario("Tasa inválida."); n.tasa = r6(v); }
        if (c.proximoPagoProveedor !== undefined) { const f = fechaExcel(c.proximoPagoProveedor); if (!f) throw errUsuario("Fecha inválida."); n.proximoPagoProveedor = f; }
        if (c.ultimoPagoProveedor !== undefined) { const f = fechaExcel(c.ultimoPagoProveedor); if (f === null) throw errUsuario("Fecha inválida."); n.ultimoPagoProveedor = f || ""; }
        if (c.estadoSeguimiento !== undefined) { const e = ESTADOS_VIP[normTxt(c.estadoSeguimiento)]; if (!e) throw errUsuario("Estado inválido."); n.estadoSeguimiento = e; }
        if (c.notas !== undefined) n.notas = txt(c.notas, 300);
        if (!Object.keys(n).length) throw errUsuario("Nada que cambiar.");
        const fin = { ...a, ...n }; if (fin.costoMensualUsdt && fin.tasa) fin.costoMensualHnl = r2(fin.costoMensualUsdt * fin.tasa);
        if (!fin.proveedorId) throw errUsuario("Elija el proveedor.");
        const antes = Object.fromEntries(Object.keys(n).map((k) => [k, a[k] ?? null]));
        tx.set(ref, { ...fin, cmId, correo: normEmail(invS.data().correo), actualizadoAt: ahora, actualizadoPor: actor, ...(s.exists ? {} : { creadoAt: ahora, creadoPor: actor, estadoSeguimiento: fin.estadoSeguimiento || "activo" }), historial: [...(a.historial || []), { at: ahora, por: actor, origen: "edicion", antes, despues: n }].slice(-30) });
        audit(tx, { accion: "editar_extra_vip", targetType: "fin_vip_extra", targetId: cmId, before: antes, after: n });
        return { cmId };
      });
      return ok(r);
    }

    if (accion === "finp_vip_reemplazar") { // el cliente y su vencimiento NO cambian (eso vive en Control Maestro); solo el vínculo financiero
      const de = String(body.de || ""), a = String(body.a || "");
      if (!de || !a || de === a) throw errUsuario("Elija el acceso actual y el acceso de reemplazo (existente).");
      const r = await db.runTransaction(async (tx) => {
        const [sa, sb, ia] = [await tx.get(col("fin_vip_extras").doc(de)), await tx.get(col("fin_vip_extras").doc(a)), await tx.get(col("inventario").doc(a))];
        if (!sa.exists) throw errUsuario("El acceso actual no tiene registro financiero.");
        if (!ia.exists || String(ia.data().plataforma || "") !== "vipnetflix") throw errUsuario("El reemplazo debe ser un Netflix VIP que ya exista en Control Maestro.");
        if (sb.exists && sb.data().estadoSeguimiento !== "reemplazado") throw errUsuario("El acceso de reemplazo ya tiene un registro financiero activo.");
        const viejo = sa.data();
        const pagado = body.pagado === true;
        tx.set(col("fin_vip_extras").doc(a), { ...viejo, cmId: a, correo: normEmail(ia.data().correo), reemplazoDe: de, reemplazoPagado: pagado, actualizadoAt: ahora, actualizadoPor: actor, historial: [...(viejo.historial || []), { at: ahora, por: actor, origen: "reemplazo", de, a, pagado }].slice(-30) });
        tx.set(col("fin_vip_extras").doc(de), { estadoSeguimiento: "reemplazado", reemplazadoPor: a, actualizadoAt: ahora, actualizadoPor: actor }, { merge: true });
        audit(tx, { accion: "reemplazar_extra_vip", targetType: "fin_vip_extra", targetId: de, detalle: `${de} → ${a} · ${pagado ? "pagado: registre la compra en Compras" : "gratuito: sin costo nuevo"}` });
        return { de, a, pagado };
      });
      return ok({ ...r, aviso: r.pagado ? "Registre la compra del reemplazo en Compras (una compra real, sin venta)." : "" });
    }

    // ---------------- R196f · Spotify Familiar: lo único que se llena en Finanzas es el pago mensual (L) y la renovación de la cuenta principal
    if (accion === "finp_spf_lista") {
      const [fams, fin] = await Promise.all([todos("spotify_familias"), todos("fin_spotify_cuentas")]);
      const finDe = new Map(fin.map((x) => [x.id, x]));
      const en7 = new Date(Date.parse(`${hoy}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
      const filas = fams.filter((f) => f.estado !== "inactiva").map((f) => { const x = finDe.get(f.id) || {}; const ocup = (f.miembros || []).filter((m) => m.estado === "activo").length;
        return { familiaId: f.id, codigo: f.codigo || "", madreCorreo: f.madreCorreo || "", ocupados: ocup, capacidad: Number(f.capacidad || 5), costoMensualHnl: x.costoMensualHnl ?? null, proximaRenovacion: x.proximaRenovacion || "", ultimoPago: x.ultimoPago || "", ultimoLoteId: x.ultimoLoteId || "",
          vencida: !!(x.proximaRenovacion && x.proximaRenovacion < hoy), pronto: !!(x.proximaRenovacion && x.proximaRenovacion >= hoy && x.proximaRenovacion <= en7), historial: (x.historial || []).slice(-10) }; })
        .sort((a, b) => String(a.proximaRenovacion || "9999").localeCompare(String(b.proximaRenovacion || "9999")) || a.codigo.localeCompare(b.codigo));
      return ok({ hoy, filas, totalMensualHnl: r2(filas.reduce((a, f) => a + (Number(f.costoMensualHnl) || 0), 0)), sinDatos: filas.filter((f) => f.costoMensualHnl == null || !f.proximaRenovacion).length, pronto: filas.filter((f) => f.pronto || f.vencida).length });
    }
    if (accion === "finp_spf_guardar") {
      const fid = String(body.familiaId || "");
      const costo = body.costoMensualHnl === "" || body.costoMensualHnl == null ? null : Number(body.costoMensualHnl);
      if (costo !== null && !(costo > 0 && costo < 100000)) throw errUsuario("Escriba cuánto paga al mes en Lempiras.");
      const ren = body.proximaRenovacion ? fechaExcel(body.proximaRenovacion) : "";
      if (ren === null) throw errUsuario("Fecha de renovación inválida.");
      const pago = body.ultimoPago ? fechaExcel(body.ultimoPago) : "";
      if (pago === null || (pago && pago > hoy)) throw errUsuario("Fecha de pago inválida.");
      await db.runTransaction(async (tx) => {
        const fref = col("spotify_familias").doc(fid), ref = col("fin_spotify_cuentas").doc(fid);
        const [sf, s] = [await tx.get(fref), await tx.get(ref)];
        if (!sf.exists || (sf.data() || {}).estado === "inactiva") throw errUsuario("Esa cuenta de Spotify Familiar no existe.");
        const a = s.exists ? s.data() : {};
        const n = { costoMensualHnl: costo === null ? a.costoMensualHnl ?? null : r2(costo), proximaRenovacion: ren || a.proximaRenovacion || "", ...(pago ? { ultimoPago: pago } : {}), ...(body.loteId ? { ultimoLoteId: txt(body.loteId, 120) } : {}) };
        tx.set(ref, { ...a, ...n, familiaId: fid, codigo: (sf.data() || {}).codigo || "", madreCorreo: (sf.data() || {}).madreCorreo || "", actualizadoAt: ahora, actualizadoPor: actor,
          historial: [...(a.historial || []), { at: ahora, por: actor, antes: { costoMensualHnl: a.costoMensualHnl ?? null, proximaRenovacion: a.proximaRenovacion || "" }, despues: n }].slice(-30) });
        audit(tx, { accion: "spotify_familiar_pago", targetType: "spotify_familia", targetId: fid, before: { costoMensualHnl: a.costoMensualHnl ?? null, proximaRenovacion: a.proximaRenovacion || "" }, after: n });
      });
      try { await requireCjs("./_spotify-familias.js").sincronizarBodega(db, fid); } catch (_) {} // Bodega muestra pago y renovación
      return ok({ familiaId: fid });
    }

    if (accion === "finp_reporte") {
      const desde = /^\d{4}-\d{2}$/.test(String(body.desde || "")) ? body.desde : hoy.slice(0, 7);
      const hasta = /^\d{4}-\d{2}$/.test(String(body.hasta || "")) && body.hasta >= desde ? body.hasta : desde;
      const meses = []; for (let m = desde; m <= hasta && meses.length < 12; ) { meses.push(m); const [y, mm] = m.split("-").map(Number); const n = new Date(Date.UTC(y, mm, 1)); m = `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`; }
      const [productos, lotes, consumos, cfgSnap, jobs] = await Promise.all([todos("fin_productos"), todos("fin_lotes"), Promise.all(meses.map((m) => col("fin_consumos").where("mesKey", "==", m).get().then((s) => s.docs.map((x) => ({ id: x.id, ...(x.data() || {}) }))))).then((a) => a.flat()), col("finanzas_config").doc("finanzas_panel").get(), todos("fin_import_jobs")]);
      const umbral = (cfgSnap.exists && cfgSnap.data().umbralMargen) ?? UMBRAL_MARGEN_DEFECTO;
      const porMes = meses.map((m) => rentabilidadMes(consumos, productos, m, umbral));
      const enRango = (f) => String(f || "").slice(0, 7) >= desde && String(f || "").slice(0, 7) <= hasta;
      const sinCosto = consumos.filter((c) => c.estado !== "revertido").flatMap((c) => (c.lineas || []).filter((l) => l.pendiente || l.sinProducto || Number(l.faltante) > 0).map((l) => ({ fecha: c.fecha, cliente: c.clienteNombre || "", servicio: l.servicio, producto: l.producto || "", ingresoHnl: r2(l.ingresoHnl), motivo: l.sinProducto ? "Producto no configurado" : "Sin compra registrada" })));
      const { inv, ex, lo } = await leerVipBase(db);
      const exMap = new Map(ex.map((x) => [x.id, x]));
      return ok({ desde, hasta, meses, umbral, porMes,
        compras: lotes.filter((l) => enRango(l.fecha)).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).map((l) => ({ fecha: l.fecha, producto: l.producto, proveedor: l.proveedor || "", cantidad: l.cantidad, unidad: l.unidad || "", moneda: l.moneda, montoMoneda: l.costoTotalMoneda, tasa: l.tasa, costoHnl: l.costoTotalHnl, pago: l.cuentaPagoNombre || l.pago, referencia: l.referencia || "", consumido: l.consumido, disponible: l.disponible })),
        proveedores: d.costosProveedor ? d.costosProveedor(lotes.filter((l) => enRango(l.fecha))) : [],
        sinCosto, vipLotes: lo.filter((l) => enRango(l.fechaPago)),
        vipExtras: inv.map((c) => { const x = exMap.get(c.id); return { cmId: c.id, correo: normEmail(c.correo), cliente: clienteDeInv(c), proveedor: x ? x.proveedor : "Sin proveedor", costoMensualUsdt: x ? x.costoMensualUsdt : "", costoMensualHnl: x ? x.costoMensualHnl : "", proximoPagoProveedor: x ? x.proximoPagoProveedor : "", estado: x ? x.estadoSeguimiento : "sin_registro", loteId: x ? x.loteId : "" }; }),
        importaciones: jobs.map((j) => ({ fecha: j.createdAt, archivo: j.archivo?.nombre || "", actor: j.actor, estado: j.estado, vinculos: j.resumen?.aplicadosExtras ?? 0, lotes: j.resumen?.aplicadosLotes ?? 0, hash: j.hash })) });
    }
  } catch (e) { if (!e.userError) console.error("finanzas_panel", accion, e); return fail(e); }
  return null;
}
