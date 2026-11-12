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
// ================================================================================================================
// R196i · FASE 6 · dos plantillas SENCILLAS (prioridad sobre la plantilla de 5 hojas):
//   VIP (4 col.):     CORREO DEL EXTRA VIP · PROVEEDOR · FECHA DE RENOVACIÓN · PAGO POR CUENTA (USDT)
//   PREMIUM (6 col.): CORREO NETFLIX PREMIUM · BANCO HONDUREÑO · NOMBRE TITULAR TARJETA · ÚLTIMOS 4 DÍGITOS TARJETA ·
//                     FECHA DE COBRO / RENOVACIÓN · PAGO POR CUENTA (USD)
// Coincidencia por correo normalizado contra cuentas que YA existen en Control Maestro (inventario). Solo escribe en
// Finanzas (fin_vip_extras / fin_premium_cuentas). No crea clientes, ventas ni toca Control Maestro. La tarjeta se
// guarda SOLO como banco + titular + 4 últimos dígitos: una celda con más dígitos se rechaza (nunca número completo/CVV).
// ================================================================================================================
const normHead = (h) => normTxt(h).replace(/[^a-z0-9/() ]/g, "").replace(/\s+/g, " ").trim();
export const PLANTILLAS_SIMPLES = Object.freeze({
  vip: ["CORREO DEL EXTRA VIP", "PROVEEDOR", "FECHA DE RENOVACIÓN", "PAGO POR CUENTA (USDT)"],
  premium: ["CORREO NETFLIX PREMIUM", "BANCO HONDUREÑO", "NOMBRE TITULAR TARJETA", "ÚLTIMOS 4 DÍGITOS TARJETA", "FECHA DE COBRO / RENOVACIÓN", "PAGO POR CUENTA (USD)"],
});
export function detectarPlantilla(encabezados = []) {
  const h = encabezados.map(normHead).filter(Boolean);
  for (const [tipo, cols] of Object.entries(PLANTILLAS_SIMPLES)) { const c = cols.map(normHead); if (c.every((x, i) => h[i] === x)) return tipo; }
  return null;
}
export function previsualizarSimple(tipo, filas = [], { cuentas = [], existentes = new Map(), proveedores = [], tasa = null, resoluciones = {} } = {}) {
  if (!PLANTILLAS_SIMPLES[tipo]) throw errUsuario("Formato de Excel no reconocido.");
  if (filas.length > MAX_FILAS) throw errUsuario(`Más de ${MAX_FILAS} filas: divida el archivo.`);
  const porCorreo = new Map(); for (const c of cuentas) { const k = normEmail(c.correo); if (k) (porCorreo.get(k) || porCorreo.set(k, []).get(k)).push(c); }
  const vistos = new Map(); const out = [];
  filas.forEach((raw, i) => {
    const fila = Number(raw._fila) || i + 2; const v = Array.isArray(raw.v) ? raw.v : [];
    if (v.every((x) => x === null || x === undefined || String(x).trim() === "")) return;
    const errores = [], avisos = []; const correo = normEmail(v[0]);
    let match = null, candidatos = [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.push("Correo inválido");
    else {
      candidatos = porCorreo.get(correo) || [];
      if (candidatos.length === 1) match = candidatos[0];
      else if (candidatos.length > 1) { const el = resoluciones[String(fila)]; match = el ? candidatos.find((c) => c.id === el) || null : null; }
      else errores.push("Ese correo no existe en Control Maestro");
      if (vistos.has(correo)) errores.push(`Duplicado en el archivo (fila ${vistos.get(correo)})`);
      vistos.set(correo, fila);
    }
    let datos = null;
    if (tipo === "vip") {
      const provTxt = txt(v[1], 60); const prov = proveedorVip(provTxt, proveedores) || (provTxt ? { id: `otro-${normTxt(provTxt).replace(/[^a-z0-9]+/g, "-").slice(0, 30)}`, alias: provTxt, grupo: "otro" } : null);
      if (!prov) errores.push("Falta proveedor");
      const fecha = fechaExcel(v[2]); if (!fecha) errores.push("Fecha de renovación inválida");
      const usdt = num(v[3]); if (!(usdt > 0 && usdt < 1000)) errores.push("Pago USDT inválido");
      if (!(Number(tasa) > 0)) errores.push("Falta la tasa Binance HNL por USDT de la operación");
      if (!errores.length && match) datos = { cmId: match.id, correo, proveedorId: prov.id, proveedor: prov.alias, grupo: prov.grupo, proximoPagoProveedor: fecha, costoMensualUsdt: r6(usdt), tasa: r6(tasa), costoMensualHnl: r2(usdt * tasa), estadoSeguimiento: "activo" };
    } else {
      const banco = txt(v[1], 60), titular = txt(v[2], 80); const dig = String(v[3] ?? "").replace(/\D/g, "");
      if (!banco) errores.push("Falta banco");
      if (!titular) errores.push("Falta titular");
      if (!String(v[3] ?? "").trim() || !dig.length) errores.push("Faltan los 4 últimos dígitos");
      else if (dig.length > 4) errores.push("La celda de tarjeta trae más de 4 dígitos: no se guarda (solo los 4 últimos)");
      const fecha = fechaExcel(v[4]); if (!fecha) errores.push("Fecha de cobro inválida");
      const usd = num(v[5]); if (!(usd > 0 && usd < 1000)) errores.push("Pago USD inválido");
      const tc = Number(tasa) > 0 ? Number(tasa) : null; if (!tc) avisos.push("Sin tipo de cambio: el costo en Lempiras queda pendiente");
      if (!errores.length && match) datos = { inventarioId: match.id, correo, banco, titular, ultimos4: dig.padStart(4, "0"), fechaCobro: fecha, pagoUsd: r2(usd), tipoCambio: tc ? r6(tc) : null, cargoHnl: tc ? r2(usd * tc) : null };
    }
    let estado = errores.length ? (errores.some((e) => /Duplicado/.test(e)) ? "duplicado" : errores.some((e) => /no existe/.test(e)) ? "sin_coincidencia" : "error") : !match ? "ambiguo" : "nuevo";
    let cambios = [];
    if (datos) { const a = existentes.get(match.id); if (a) { cambios = Object.keys(datos).filter((k) => String(a[k] ?? "") !== String(datos[k] ?? "")); estado = cambios.length ? "actualiza" : "sin_cambios"; } }
    out.push({ fila, correo, estado, errores, avisos, cmId: match ? match.id : "", cliente: match ? clienteDeInv(match) : "", candidatos: !match && candidatos.length > 1 ? candidatos.map((c) => ({ id: c.id, correo: normEmail(c.correo), cliente: clienteDeInv(c) })) : [], datos, cambios });
  });
  const n = (e) => out.filter((x) => x.estado === e).length;
  return { tipo, filas: out, resumen: { total: out.length, nuevos: n("nuevo"), actualizados: n("actualiza"), sinCambios: n("sin_cambios"), ambiguos: n("ambiguo"), sinCoincidencia: n("sin_coincidencia"), duplicados: n("duplicado"), conError: n("error"), ventasNuevas: 0, clientesNuevos: 0 } };
}

export const ACCIONES_PANEL = Object.freeze(["finp_simple_preview", "finp_simple_confirmar", "finp_panel", "finp_costear", "finp_config", "finp_vip_preview", "finp_vip_confirmar", "finp_vip_deshacer", "finp_vip_lista", "finp_vip_editar", "finp_vip_reemplazar", "finp_reporte", "finp_importaciones", "finp_spf_lista", "finp_spf_guardar", "finp_hbo_lista", "finp_hbo_guardar"]); // R196n · HBO Max: tarjeta o activación // R196f · Spotify Familiar

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
    // R196i · P0 «No se pudo abrir Finanzas»: el panel ya NO corre el costeo dentro de la misma llamada (con ventas reales
    // podía pasar el límite de tiempo de Vercel y la respuesta llegaba vacía). El costeo va aparte (finp_costear, con tope).
    // Cada sección se arma por separado: si una falla, las demás abren y se informa cuál falló (sin datos inventados).
    if (accion === "finp_costear") {
      if (!d.correrCosteo) throw errUsuario("Costeo no disponible.");
      const t0 = Date.now(); let r;
      try { r = await d.correrCosteo(Math.min(60, Math.max(5, Number(body.limite) || 40))); } catch (e) { console.error("finanzas_panel costeo", e); throw errUsuario(`El costeo falló: ${String(e?.message || e).slice(0, 140)}`); }
      return ok({ costeo: r, ms: Date.now() - t0 });
    }
    if (accion === "finp_panel") {
      const mes = /^\d{4}-\d{2}$/.test(String(body.mes || "")) ? String(body.mes) : hoy.slice(0, 7);
      const fallas = [];
      const seguro = async (seccion, fn, vacio) => { try { return await fn(); } catch (e) { console.error("finanzas_panel", seccion, e); fallas.push({ seccion, error: String(e?.message || e).slice(0, 160) }); return vacio; } };
      const leerMes = (m) => col("fin_consumos").where("mesKey", "==", m).get().then((s) => s.docs.map((x) => ({ id: x.id, ...(x.data() || {}) })));
      const [productos, proveedores, lotes, cfgSnap, consumosMes, consumosAnt, methods] = await Promise.all([
        seguro("productos", () => todos("fin_productos"), []), seguro("proveedores", () => todos("fin_proveedores"), []), seguro("compras", () => todos("fin_lotes"), []),
        seguro("configuracion", () => col("finanzas_config").doc("finanzas_panel").get(), null),
        seguro("ventas_del_mes", () => leerMes(mes), []), seguro("mes_anterior", () => leerMes(mesAnterior(mes)), []),
        seguro("bancos", () => Promise.resolve().then(() => d.loadMethods(db)), []),
      ]);
      const cfg = { umbralMargen: UMBRAL_MARGEN_DEFECTO, ...(cfgSnap && cfgSnap.exists ? cfgSnap.data() : {}) };
      const vacioRent = (m) => rentabilidadMes([], [], m, cfg.umbralMargen);
      const actual = await seguro("ganancias", () => rentabilidadMes(consumosMes, productos, mes, cfg.umbralMargen), vacioRent(mes));
      const anterior = await seguro("ganancias_mes_anterior", () => rentabilidadMes(consumosAnt, productos, mesAnterior(mes), cfg.umbralMargen), vacioRent(mesAnterior(mes)));
      const { inv, ex, lo } = await seguro("netflix_vip", () => leerVipBase(db), { inv: [], ex: [], lo: [] });
      const vipProv = { trap: 0, deku: 0, propio: 0, otro: 0, sin: 0 };
      const exMap = new Map(ex.filter((x) => x.estadoSeguimiento !== "reemplazado").map((x) => [x.id, x]));
      for (const c of inv) { const x = exMap.get(c.id); const g = x ? x.grupo || "otro" : "sin"; vipProv[g] = (vipProv[g] || 0) + 1; }
      const en7 = new Date(Date.parse(`${hoy}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
      const proximos = ex.filter((x) => x.estadoSeguimiento === "activo" && x.proximoPagoProveedor && x.proximoPagoProveedor >= hoy && x.proximoPagoProveedor <= en7);
      const alertas = [];
      await seguro("alertas", async () => {
        for (const p of actual.productos.filter((p) => p.estado === "margen_bajo")) alertas.push({ tipo: "margen_bajo", nivel: "media", productoId: p.productoId, producto: p.producto, margen: p.margen, objetivo: cfg.umbralMargen, texto: `Margen actual ${p.margen}% · objetivo ≥ ${cfg.umbralMargen}%` });
        for (const p of actual.productos.filter((p) => p.ingresoPendienteHnl > 0)) alertas.push({ tipo: "sin_costo", nivel: "media", productoId: p.productoId, producto: p.producto, texto: `${p.ventasPendientes} venta(s) sin costo registrado (L${p.ingresoPendienteHnl}): registre la compra.` });
        if (proximos.length) alertas.push({ tipo: "vip_cobro", nivel: "info", producto: "Netflix VIP", texto: `${proximos.length} extra(s) VIP con cobro del proveedor en los próximos 7 días.` });
        const fs = await todos("fin_spotify_cuentas"); const vence = fs.filter((x) => x.proximaRenovacion && x.proximaRenovacion <= en7);
        if (vence.length) alertas.push({ tipo: "spf_renovacion", nivel: "info", producto: "Spotify Familiar", texto: `${vence.length} cuenta(s) principal(es) renuevan en 7 días o ya vencieron.` });
        if (vipProv.sin) alertas.push({ tipo: "vip_sin_proveedor", nivel: "info", producto: "Netflix VIP", texto: `${vipProv.sin} extra(s) VIP de Control Maestro sin proveedor en Finanzas.` });
        const inventario = d.resumenInventario ? d.resumenInventario(productos, lotes, hoy) : [];
        for (const i of inventario.filter((i) => i.stockBajo || i.bajo)) alertas.push({ tipo: "stock", nivel: "media", producto: i.nombre, texto: `Quedan ${i.disponible} ${i.unidad || "unidades"}: toca comprar.` });
      }, null);
      const txtc = (v) => String(v == null ? "" : v);
      const costosProv = await seguro("costos_proveedor", () => (d.costosProveedor ? d.costosProveedor(lotes) : []), []);
      const rentProv = await seguro("rentabilidad_proveedor", () => (d.rentabilidad ? d.rentabilidad({ consumos: consumosMes, lotes, movimientos: [] }, mes).proveedores : []), []);
      return ok({ hoy, mes, mesAnterior: mesAnterior(mes), config: cfg, ...actual, variacion: variacion(actual.kpis, anterior.kpis), anteriorKpis: anterior.kpis, alertas, fallas,
        proveedores: proveedores.map((p) => ({ id: p.id, alias: txtc(p.alias || p.nombre || p.id), pais: p.pais || "", moneda: p.moneda || "", metodoPago: p.metodoPago || "", activo: p.activo !== false, notas: p.notas || "", terminos: (Array.isArray(p.terminos) ? p.terminos : []).slice(-10) })),
        costosProveedor: costosProv, rentProveedores: rentProv,
        productosCatalogo: productos.map((p) => ({ id: p.id, nombre: txtc(p.nombre || p.id), categoria: p.categoria || "sin_clasificar", modelo: p.modelo || "", capacidad: p.capacidad, duracionDias: p.duracionDias, unidad: p.unidad, activo: p.activo !== false, costoRef: p.costoRef || null })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
        lotes: lotes.slice().sort((a, b) => txtc(b.fecha).localeCompare(txtc(a.fecha)) || txtc(b.createdAt).localeCompare(txtc(a.createdAt))).slice(0, 120).map((l) => ({ id: l.id, fecha: l.fecha || "", producto: l.producto || "", productoId: l.productoId || "", proveedor: l.proveedor || "", cantidad: l.cantidad, disponible: l.disponible, unidad: l.unidad || "", moneda: l.moneda || "HNL", costoTotalMoneda: l.costoTotalMoneda, tasa: l.tasa, costoTotalHnl: l.costoTotalHnl, costoUnitarioHnl: l.costoUnitarioHnl, pago: l.pago || "", cuentaPagoNombre: l.cuentaPagoNombre || "", estado: l.estado || "", referencia: l.referencia || "", vigenciaHasta: l.vigenciaHasta || "" })),
        vip: { porProveedor: vipProv, total: inv.length, proximos7: proximos.length, lotes: lo.length },
        lotesVip: lo.slice().sort((a, b) => txtc(b.fechaPago).localeCompare(txtc(a.fechaPago))).slice(0, 60),
        metodos: (methods || []).map((m) => ({ id: m.id, nombre: txtc(m.nombre || m.id) })), categoriasLabel: CATEGORIA_LABEL,
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

    if (accion === "finp_simple_preview" || accion === "finp_simple_confirmar") { // R196i · Fase 6
      const enc = Array.isArray(body.encabezados) ? body.encabezados.map((x) => String(x ?? "")) : [];
      const tipo = detectarPlantilla(enc);
      if (!tipo) throw errUsuario("Encabezados no reconocidos. VIP: CORREO DEL EXTRA VIP · PROVEEDOR · FECHA DE RENOVACIÓN · PAGO POR CUENTA (USDT). Premium: CORREO NETFLIX PREMIUM · BANCO HONDUREÑO · NOMBRE TITULAR TARJETA · ÚLTIMOS 4 DÍGITOS TARJETA · FECHA DE COBRO / RENOVACIÓN · PAGO POR CUENTA (USD).");
      const filas = (Array.isArray(body.filas) ? body.filas : []).slice(0, MAX_FILAS + 1).map((f, i) => ({ _fila: Number(f && f._fila) || i + 2, v: (Array.isArray(f && f.v) ? f.v : []).slice(0, 6).map((x) => (typeof x === "number" ? x : x == null ? null : String(x).slice(0, 200))) }));
      const plat = tipo === "vip" ? "vipnetflix" : "netflix"; const colF = tipo === "vip" ? "fin_vip_extras" : "fin_premium_cuentas";
      const cuentas = (await col("inventario").where("plataforma", "==", plat).get()).docs.map((x) => ({ id: x.id, ...(x.data() || {}) }));
      const ex = await todos(colF); const proveedores = await todos("fin_proveedores");
      const pv = previsualizarSimple(tipo, filas, { cuentas, existentes: new Map(ex.map((x) => [x.id, x])), proveedores, tasa: Number(body.tasa) || null, resoluciones: body.resoluciones && typeof body.resoluciones === "object" ? body.resoluciones : {} });
      const hash = hashFilas(filas, [tipo, Number(body.tasa) || 0]);
      if (accion === "finp_simple_preview") return ok({ hash, ...pv });
      if (body.confirmo !== true) throw errUsuario("Confirme la importación.");
      if (String(body.hash || "") !== hash) throw errUsuario("El archivo o la tasa cambiaron desde la vista previa: revise de nuevo.");
      const aplicar = pv.filas.filter((x) => x.estado === "nuevo" || x.estado === "actualiza");
      if (!aplicar.length) throw errUsuario("No hay filas nuevas ni cambios para importar.");
      if (aplicar.length > 480) throw errUsuario("Máximo 480 filas por confirmación: divida el archivo.");
      const jobRef = col("fin_import_jobs").doc();
      const r = await db.runTransaction(async (tx) => {
        const refs = aplicar.map((x) => col(colF).doc(x.cmId)); const snaps = await Promise.all(refs.map((rf) => tx.get(rf)));
        const antes = {};
        aplicar.forEach((x, i) => { const a = snaps[i].exists ? snaps[i].data() : null; antes[x.cmId] = a;
          tx.set(refs[i], { ...(a || {}), ...x.datos, importJobId: jobRef.id, actualizadoAt: ahora, actualizadoPor: actor, ...(a ? {} : { creadoAt: ahora, creadoPor: actor }), historial: [...((a && a.historial) || []), { at: ahora, por: actor, origen: "excel_simple", jobId: jobRef.id, cambios: x.cambios.length ? x.cambios : Object.keys(x.datos) }].slice(-30) }); });
        tx.set(jobRef, { tipo: `excel_${tipo}`, archivo: { nombre: txt(body.archivo?.nombre, 120), bytes: Number(body.archivo?.bytes) || 0 }, hash, actor, createdAt: ahora, estado: "aplicado", resumen: { ...pv.resumen, aplicadosExtras: aplicar.length, aplicadosLotes: 0 }, antesCol: { [colF]: antes } });
        audit(tx, { accion: `importar_excel_${tipo}`, targetType: "importacion", targetId: jobRef.id, detalle: `${aplicar.length} cuenta(s) existentes vinculadas · 0 ventas · 0 clientes` });
        return { jobId: jobRef.id, aplicados: aplicar.length, tipo };
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
        if (job.antesCol) { // R196i · importaciones sencillas (VIP 4 col. / Premium 6 col.)
          const pares = Object.entries(job.antesCol).flatMap(([c, m]) => Object.keys(m || {}).map((id) => [c, id, m[id]]));
          const ss = await Promise.all(pares.map(([c, id]) => tx.get(col(c).doc(id))));
          ss.forEach((s2) => { if (s2.exists && s2.data().importJobId !== jobId) throw errUsuario("Una fila de esta importación se editó después: no se puede deshacer automáticamente."); });
          pares.forEach(([c, id, a]) => { if (a) tx.set(col(c).doc(id), a); else tx.delete(col(c).doc(id)); });
          tx.set(jref, { estado: "deshecho", deshechoAt: ahora, deshechoPor: actor }, { merge: true });
          audit(tx, { accion: "deshacer_importacion_excel", targetType: "importacion", targetId: jobId, detalle: `${pares.length} fila(s) restauradas` });
          return { extras: pares.length, lotes: 0 };
        }
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

    // ---------------- R196n · HBO Max: modalidad por CUENTA (Control Maestro manda: aquí solo se leen sus cuentas madre).
    //   «activacion» (USDT/Binance, por activación; sin costo mensual) — es la de siempre y queda por defecto.
    //   «tarjeta»: tarjeta de banco hondureño (solo banco, titular y últimos 4) + cargos reales (USD/HNL → HNL real).
    // Cada cargo es UNA compra real (fin_compra_registrar, con su operationId); aquí solo se anota a qué cuenta pertenece.
    // Una tarjeta puede servir a varias cuentas (fin_tarjetas). Mismo cargo (cuenta + fecha + monto) dos veces: bloqueado.
    if (accion === "finp_hbo_lista") {
      const [cuentas, fin, tarjetas] = await Promise.all([(async () => (await col("inventario").where("plataforma", "==", "hbomax").get()).docs.map((x) => ({ id: x.id, ...(x.data() || {}) })))(), todos("fin_hbo_cuentas"), todos("fin_tarjetas")]);
      const finDe = new Map(fin.map((x) => [x.id, x])), tDe = new Map(tarjetas.map((x) => [x.id, x]));
      const en7 = new Date(Date.parse(`${hoy}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
      const filas = cuentas.filter((c) => String(c.estado || "activa") !== "eliminada" && c.eliminado !== true).map((c) => {
        const x = finDe.get(c.id) || {}, tj = x.tarjetaId ? tDe.get(x.tarjetaId) : null;
        return { cuentaId: c.id, correo: String(c.correo || c.email || ""), capacidad: Number(c.capacidad || c.perfilesTotales || 4) || 4, modalidad: x.modalidad === "tarjeta" ? "tarjeta" : "activacion",
          tarjeta: tj ? { id: tj.id, banco: tj.banco, titular: tj.titular, ultimos4: tj.ultimos4 } : null, periodicidad: x.periodicidad || "", proximoCobro: x.proximoCobro || "",
          pronto: !!(x.proximoCobro && x.proximoCobro <= en7), cargos: (x.cargos || []).slice(-6).reverse() };
      }).sort((a, b) => a.modalidad.localeCompare(b.modalidad) || String(a.proximoCobro || "9999").localeCompare(String(b.proximoCobro || "9999")) || a.correo.localeCompare(b.correo));
      return ok({ hoy, filas, tarjetas: tarjetas.map((x) => ({ id: x.id, banco: x.banco, titular: x.titular, ultimos4: x.ultimos4 })), porTarjeta: filas.filter((f) => f.modalidad === "tarjeta").length });
    }
    if (accion === "finp_hbo_guardar") {
      const cid = txt(body.cuentaId, 120);
      if (!cid) throw errUsuario("Falta la cuenta HBO Max.");
      const modalidad = body.modalidad === "tarjeta" ? "tarjeta" : body.modalidad === "activacion" ? "activacion" : null;
      let tarjetaNueva = null;
      if (body.tarjetaNueva) {
        const banco = txt(body.tarjetaNueva.banco, 60), titular = txt(body.tarjetaNueva.titular, 80), u4 = String(body.tarjetaNueva.ultimos4 || "").replace(/\s/g, "");
        if (!/^\d{4}$/.test(u4)) throw errUsuario(/\d{5,}/.test(u4) ? "Escriba SOLO los últimos 4 dígitos. Nunca el número completo de la tarjeta." : "Los últimos 4 dígitos deben ser 4 números.");
        if (banco.length < 2 || titular.length < 3) throw errUsuario("Escriba el banco y el nombre del titular de la tarjeta.");
        tarjetaNueva = { banco, titular, ultimos4: u4 };
      }
      const per = ["mensual", "puntual"].includes(body.periodicidad) ? body.periodicidad : null;
      const prox = body.proximoCobro === "" ? "" : body.proximoCobro ? fechaExcel(body.proximoCobro) : undefined;
      if (prox === null) throw errUsuario("Fecha de próximo cobro inválida.");
      const cargo = body.cargo && typeof body.cargo === "object" ? body.cargo : null;
      const r = await db.runTransaction(async (tx) => {
        const cref = col("inventario").doc(cid), ref = col("fin_hbo_cuentas").doc(cid);
        const [sc, s] = [await tx.get(cref), await tx.get(ref)];
        if (!sc.exists || String((sc.data() || {}).plataforma || "") !== "hbomax") throw errUsuario("Esa cuenta de HBO Max no está en Control Maestro.");
        const a = s.exists ? s.data() || {} : {};
        let tarjetaId = body.tarjetaId ? txt(body.tarjetaId, 120) : a.tarjetaId || "";
        if (tarjetaNueva) { // misma tarjeta (banco + titular + últimos 4) = mismo registro: no se duplica
          const id = `tj_${tarjetaNueva.banco}_${tarjetaNueva.ultimos4}_${tarjetaNueva.titular}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_]+/g, "-").slice(0, 120);
          const tref = col("fin_tarjetas").doc(id), ts = await tx.get(tref);
          if (!ts.exists) tx.set(tref, { ...tarjetaNueva, creadoAt: ahora, creadoPor: actor });
          tarjetaId = id;
        } else if (body.tarjetaId) { const ts = await tx.get(col("fin_tarjetas").doc(tarjetaId)); if (!ts.exists) throw errUsuario("Esa tarjeta ya no existe."); }
        const mod = modalidad || a.modalidad || "activacion";
        if (mod === "tarjeta" && !tarjetaId) throw errUsuario("Elija o agregue la tarjeta (banco, titular y últimos 4).");
        const cargos = [...(a.cargos || [])];
        if (cargo) {
          const fecha = fechaExcel(cargo.fecha), moneda = ["USD", "HNL"].includes(cargo.moneda) ? cargo.moneda : null, monto = r2(cargo.monto), hnl = r2(moneda === "HNL" ? cargo.monto : cargo.cargoHnl);
          if (!fecha || fecha > hoy) throw errUsuario("Fecha del cargo inválida.");
          if (!moneda || !(monto > 0) || !(hnl > 0)) throw errUsuario(moneda === "USD" ? "Escriba el monto en USD y el cargo REAL en Lempiras que cobró el banco." : "Escriba el monto del cargo.");
          const opid = txt(cargo.operationId, 80);
          if (opid && cargos.some((c) => c.operationId === opid)) return { duplicado: true }; // reintento del mismo cargo
          if (!cargo.loteId && cargos.some((c) => c.fecha === fecha && Math.abs(Number(c.cargoHnl) - hnl) < 0.005)) throw errUsuario(`Ese cargo (L${hnl} del ${fecha}) ya está registrado en esta cuenta. No se suma dos veces.`);
          if (!cargo.loteId) return { verificado: true }; // solo se comprobó que no está repetido (antes de registrar la compra)
          cargos.push({ fecha, moneda, monto, cargoHnl: hnl, loteId: txt(cargo.loteId, 120), operationId: opid, tarjetaId, por: actor, at: ahora });
        }
        const n = { modalidad: mod, tarjetaId: mod === "tarjeta" ? tarjetaId : a.tarjetaId || "", periodicidad: per || a.periodicidad || (mod === "tarjeta" ? "mensual" : ""), ...(prox !== undefined ? { proximoCobro: prox } : {}) };
        tx.set(ref, { ...a, ...n, cuentaId: cid, correo: String((sc.data() || {}).correo || ""), cargos: cargos.slice(-60), actualizadoAt: ahora, actualizadoPor: actor,
          historial: [...(a.historial || []), { at: ahora, por: actor, antes: { modalidad: a.modalidad || "activacion", tarjetaId: a.tarjetaId || "", periodicidad: a.periodicidad || "" }, despues: n }].slice(-30) });
        audit(tx, { accion: cargo ? (cargo.loteId ? "hbo_cargo_tarjeta" : "hbo_cargo_verificado") : "hbo_modalidad", targetType: "hbo_cuenta", targetId: cid, before: { modalidad: a.modalidad || "activacion" }, after: n });
        return { cuentaId: cid, modalidad: mod, tarjetaId };
      });
      return ok(r);
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
