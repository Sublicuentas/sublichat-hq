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
import { prepararContexto, calcularGanancias, resultadoCiclos, rentabilidadCuentas, detalleCuenta, filasExcel, mesesDe, rangoMes, nombrePlataforma, conciliarCartera, cuentasDePlataforma, DEFINICIONES, auditarCartera, csvAuditoria, conciliacionCompras, ESTADOS_COSTO } from "./_finanzas-ganancias.js"; // R197 · motor único de ganancias
import { ventasACostear as ventasACostearG } from "./_finanzas-costeo.js";
import finCuentas from "./_finanzas-cuentas.js"; // R196z · cuentas madre automáticas desde Control Maestro (solo lectura)
import hboPlanes from "./_hbo-planes.js"; // R196z · HBO Standard 3 / Platinum 5 en Finanzas
import spotifyFam from "./_spotify-familias.js"; // R196s · antes se cargaba con require dinámico + meta.url: Vercel compila api/ como CommonJS y esa
// referencia de módulo ES tumbaba TODO /api/finanzas al cargar (500 «A server error has occurred» en Control financiero).

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
// R196y · Netflix VIP 4 col.: el correo se busca en Control Maestro, Bodega Netflix VIP (misma colección `inventario`) y en las
// asignaciones de Telegram (servicios VIP de las fichas). Si no aparece en ninguno, se guarda SOLO el dato financiero como
// «Sin asignación comercial» (id = el mismo id que Bodega le daría a ese correo): no se crea venta, cliente ni entrada en
// Control Maestro. Al entregarla luego desde Bodega, `asignar` la enlaza con este costo (ver _bodega-vip.js).
export const normCorreoVip = (v) => String(v ?? "").replace(/[\u200b-\u200d\u2060\ufeff\u00a0\s]+/g, "").replace(/^mailto:/i, "").toLowerCase();
export const docIdVipCorreo = (correo) => `vipnetflix__${normCorreoVip(correo).replace(/[.#$/\[\]\s]+/g, "_")}`;
export const PLATAFORMAS_VIP_LEGADO = Object.freeze(["vipnetflix", "netflixvip", "vip", "netflix_vip", "netflix vip", "Netflix VIP", "VIP"]);
export const esPlataformaVip = (p) => { const t = String(p || "").toLowerCase().replace(/[\s_+-]+/g, ""); return t === "vipnetflix" || t === "netflixvip" || t === "vip" || t === "netflixpremiumvip"; };
const esUnidadBodega = (c = {}) => String(c.id || "").startsWith("vipnetflix__") || c.estadoBodega !== undefined || Array.isArray(c.historialBodega);
const ETQ_BODEGA = { disponible: "Disponible", reservado: "Reservado", asignado: "Asignado", suspendido: "Suspendido", revision: "Requiere revisión" };
function estadoBodegaDe(d = {}) {
  const m = String(d.estadoBodega || "").toLowerCase(); if (m === "suspendido" || m === "revision") return m;
  const o = Number(d.ocupados || 0) || (Array.isArray(d.clientes) ? d.clientes.length : 0);
  if (o >= Math.max(1, Number(d.capacidad || 1))) return "asignado"; return m === "reservado" ? "reservado" : "disponible";
}
// Asignaciones VIP de Telegram (fichas de clientes). Solo lectura: devuelve correo + cliente, nunca claves.
export function asignacionesVipDeClientes(clientes = []) {
  const out = [];
  for (const c of clientes) for (const sv of Array.isArray(c && c.servicios) ? c.servicios : []) {
    if (!sv || !esPlataformaVip(sv.plataforma)) continue; const correo = normCorreoVip(sv.correo); if (!correo) continue;
    out.push({ correo, clienteId: String(c.id || ""), nombre: txt(c.nombre || c.nombreCliente || "", 80) });
  }
  return out;
}
const igualCampo = (a, b) => (typeof a === "object" || typeof b === "object" ? JSON.stringify(a ?? null) === JSON.stringify(b ?? null) : String(a ?? "") === String(b ?? ""));

export function previsualizarSimple(tipo, filas = [], { cuentas = [], existentes = new Map(), proveedores = [], tasa = null, resoluciones = {}, asignacionesTelegram = [] } = {}) {
  if (!PLANTILLAS_SIMPLES[tipo]) throw errUsuario("Formato de Excel no reconocido.");
  if (filas.length > MAX_FILAS) throw errUsuario(`Más de ${MAX_FILAS} filas: divida el archivo.`);
  const vipX = tipo === "vip"; const nc = vipX ? normCorreoVip : normEmail;
  const porCorreo = new Map(); for (const c of cuentas) { const k = nc(c.correo); if (k) (porCorreo.get(k) || porCorreo.set(k, []).get(k)).push(c); }
  const tgPorCorreo = new Map(); if (vipX) for (const a of asignacionesTelegram) { const k = normCorreoVip(a.correo); if (!k) continue; const l = tgPorCorreo.get(k) || tgPorCorreo.set(k, []).get(k); if (!l.some((x) => x.clienteId === a.clienteId)) l.push({ clienteId: a.clienteId, nombre: a.nombre }); }
  const exPorCorreo = new Map(); if (vipX) for (const [id, x] of existentes) { if (!x || x.estadoSeguimiento === "reemplazado" || x.estadoSeguimiento === "vinculado") continue; const k = normCorreoVip(x.correo); if (k && !exPorCorreo.has(k)) exPorCorreo.set(k, { id, ...x }); }
  const vistos = new Map(); const out = [];
  filas.forEach((raw, i) => {
    const fila = Number(raw._fila) || i + 2; const v = Array.isArray(raw.v) ? raw.v : [];
    if (v.every((x) => x === null || x === undefined || String(x).trim() === "")) return;
    const errores = [], avisos = []; const correo = nc(v[0]);
    let match = null, candidatos = [], telegram = [], sinAsignacion = false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.push("Correo inválido");
    else {
      candidatos = porCorreo.get(correo) || [];
      if (vipX) telegram = tgPorCorreo.get(correo) || [];
      if (candidatos.length === 1) match = candidatos[0];
      else if (candidatos.length > 1) { const el = resoluciones[String(fila)]; match = el ? candidatos.find((c) => c.id === el) || null : null; }
      else if (vipX) sinAsignacion = true; // R196y · no está en Control Maestro ni en Bodega: se registra solo en Finanzas
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
      if (!errores.length && (match || sinAsignacion)) {
        datos = { cmId: match ? match.id : "", correo, proveedorId: prov.id, proveedor: prov.alias, grupo: prov.grupo, proximoPagoProveedor: fecha, costoMensualUsdt: r6(usdt), tasa: r6(tasa), costoMensualHnl: r2(usdt * tasa), estadoSeguimiento: "activo" };
        if (match) { datos.sinInventario = false; datos.sinAsignacionComercial = false; }
        else { datos.sinInventario = true; datos.sinAsignacionComercial = !telegram.length; datos.asignacionesTelegram = telegram.slice(0, 5); }
      }
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
    let estado = errores.length ? (errores.some((e) => /Duplicado/.test(e)) ? "duplicado" : errores.some((e) => /no existe/.test(e)) ? "sin_coincidencia" : "error") : !match && !sinAsignacion ? "ambiguo" : "nuevo";
    let cambios = [], docId = match ? match.id : "", vinculaDesde = "";
    // vínculo (VIP): de dónde salió la coincidencia, para la vista previa
    const vinculo = !vipX ? "" : match ? (esUnidadBodega(match) ? "bodega" : "control_maestro") : sinAsignacion ? (telegram.length ? "telegram" : "sin_asignacion") : "";
    if (datos) {
      if (vipX && !match) docId = docIdVipCorreo(correo);
      let a = existentes.get(docId);
      if (vipX) { // sin duplicar: si ese correo ya tiene registro financiero (con otro id), se reutiliza
        const porC = exPorCorreo.get(correo);
        if (!a && porC && porC.id !== docId) { if (match) vinculaDesde = porC.id; else docId = porC.id; a = porC; }
        if (!match && a && a.cmId) { datos.cmId = a.cmId; datos.sinInventario = !!a.sinInventario; datos.sinAsignacionComercial = !!a.sinAsignacionComercial; } // ya enlazado por Bodega: no se desvincula
      }
      if (a) { cambios = Object.keys(datos).filter((k) => !igualCampo(a[k], datos[k])); if (vinculaDesde) cambios = [...new Set([...cambios, "cmId"])]; estado = cambios.length ? "actualiza" : "sin_cambios"; }
    }
    const bodega = vipX && match && esUnidadBodega(match) ? ETQ_BODEGA[estadoBodegaDe(match)] : "";
    const clienteTxt = match ? clienteDeInv(match) : telegram.map((t) => t.nombre).filter(Boolean).join(", ");
    out.push({ fila, correo, estado, errores, avisos, cmId: match ? match.id : "", docId, vinculo, vinculaDesde, bodega, cliente: clienteTxt, candidatos: !match && candidatos.length > 1 ? candidatos.map((c) => ({ id: c.id, correo: nc(c.correo), cliente: clienteDeInv(c) })) : [], datos, cambios });
  });
  const n = (e) => out.filter((x) => x.estado === e).length;
  const nv = (vv) => out.filter((x) => x.datos && x.vinculo === vv).length;
  return { tipo, filas: out, resumen: { total: out.length, nuevos: n("nuevo"), actualizados: n("actualiza"), sinCambios: n("sin_cambios"), ambiguos: n("ambiguo"), sinCoincidencia: n("sin_coincidencia"), duplicados: n("duplicado"), conError: n("error"), ...(vipX ? { enControlMaestro: nv("control_maestro"), enBodega: nv("bodega"), enTelegram: nv("telegram"), sinAsignacion: nv("sin_asignacion") } : {}), ventasNuevas: 0, clientesNuevos: 0 } };
}

export const ACCIONES_PANEL = Object.freeze(["finp_simple_preview", "finp_simple_confirmar", "finp_panel", "finp_costear", "finp_config", "finp_vip_preview", "finp_vip_confirmar", "finp_vip_deshacer", "finp_vip_lista", "finp_vip_editar", "finp_vip_reemplazar", "finp_reporte", "finp_importaciones", "finp_spf_lista", "finp_spf_guardar", "finp_hbo_lista", "finp_hbo_guardar", "finp_cuentas_lista", "finp_cuenta_config", "finp_cuenta_historial", "finp_ganancias", "finp_ganancias_cuenta", "finp_ganancias_excel", "finp_excel_financiero", "finp_ganancias_plataforma", "finp_auditoria_cartera", "finp_costo_conciliar", "finp_costo_conciliar_quitar", "finp_rentabilidad", "finp_tasa_bac"]); // R200g · tasa BAC Honduras // R196n · HBO Max: tarjeta o activación // R196f · Spotify Familiar

// ---------------- R200g · Tasa del dólar de BAC Honduras (compra/venta) para convertir pagos en USD a Lempiras.
// Fuente pública de BAC Credomatic (XML por país). Se guarda una vez por día en `fin_tasas/bac_{fecha}` para que el
// valor quede trazable; si BAC no responde se usa la última guardada (se dice de qué fecha es). La tasa de cada compra
// queda fija en la compra y NO cambia después aunque cambie la tasa del día.
export const BAC_XML_URL = "https://www.sucursalelectronica.com/exchangerate/showXmlExchangeRate.do";
export function leerTasaBacXml(xml = "", pais = "Honduras") {
  const bloques = String(xml || "").split(/<country>/i).slice(1);
  for (const b of bloques) {
    const nombre = (/<name>\s*([^<]+?)\s*<\/name>/i.exec(b) || [])[1] || "";
    if (nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() !== pais.toLowerCase()) continue;
    const num = (tag) => Number(String((new RegExp(`<${tag}>\\s*([^<]+?)\\s*</${tag}>`, "i").exec(b) || [])[1] || "").replace(",", "."));
    const compra = num("buyRateUSD"), venta = num("saleRateUSD");
    if (compra > 5 && compra < 100 && venta > 5 && venta < 100 && venta >= compra) return { compra, venta };
    return null;
  }
  return null;
}
let tasaBacCache = null; // { t, dato }
async function tasaBac(db, hoy, fetcher = globalThis.fetch) {
  if (tasaBacCache && Date.now() - tasaBacCache.t < 30 * 60 * 1000 && tasaBacCache.dato.fecha === hoy) return tasaBacCache.dato;
  const ref = db.collection("fin_tasas").doc(`bac_${hoy}`);
  let error = "";
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 7000);
    const r = await fetcher(BAC_XML_URL, { signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 Sublichat", accept: "application/xml,text/xml" } }).finally(() => clearTimeout(to));
    const t = r && r.ok ? leerTasaBacXml(await r.text()) : null;
    if (t) {
      const dato = { fuente: "BAC Credomatic Honduras", fecha: hoy, compra: t.compra, venta: t.venta, consultadoAt: new Date().toISOString(), deHoy: true };
      try { await ref.set(dato, { merge: true }); } catch (_) {}
      tasaBacCache = { t: Date.now(), dato }; return dato;
    }
    error = r && !r.ok ? `BAC respondió ${r.status}` : "BAC no trajo la tasa de Honduras";
  } catch (e) { error = e && e.name === "AbortError" ? "BAC tardó demasiado" : "No se pudo consultar BAC"; }
  // Respaldo: la última tasa guardada (de hoy o de otro día), nunca inventada.
  try {
    const hoyDoc = await ref.get(); if (hoyDoc.exists) return { ...hoyDoc.data(), deHoy: true };
    const todas = (await db.collection("fin_tasas").get()).docs.map((x) => x.data() || {}).filter((x) => x.fuente === "BAC Credomatic Honduras" && x.venta > 0 && x.fecha <= hoy).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    if (todas.length) return { ...todas[0], deHoy: false, aviso: `${error}. Se usa la última tasa guardada (${todas[0].fecha}).` };
  } catch (_) {}
  return { error: `${error}. Escriba el cargo en Lempiras que cobró el banco.` };
}

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
      const exMap = new Map(ex.filter((x) => x.estadoSeguimiento !== "reemplazado" && x.estadoSeguimiento !== "vinculado").map((x) => [x.id, x]));
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
      const costosProv = await seguro("costos_proveedor", () => (d.costosProveedor ? d.costosProveedor(lotes.filter((l) => l.estado !== "anulado")) : []) /* R200a */, []);
      const rentProv = await seguro("rentabilidad_proveedor", () => (d.rentabilidad ? d.rentabilidad({ consumos: consumosMes, lotes, movimientos: [] }, mes).proveedores : []), []);
      return ok({ hoy, mes, mesAnterior: mesAnterior(mes), config: cfg, ...actual, variacion: variacion(actual.kpis, anterior.kpis), anteriorKpis: anterior.kpis, alertas, fallas,
        proveedores: proveedores.map((p) => ({ id: p.id, alias: txtc(p.alias || p.nombre || p.id), pais: p.pais || "", moneda: p.moneda || "", metodoPago: p.metodoPago || "", activo: p.activo !== false, notas: p.notas || "", terminos: (Array.isArray(p.terminos) ? p.terminos : []).slice(-10) })),
        costosProveedor: costosProv, rentProveedores: rentProv,
        productosCatalogo: productos.map((p) => ({ id: p.id, nombre: txtc(p.nombre || p.id), categoria: p.categoria || "sin_clasificar", modelo: p.modelo || "", capacidad: p.capacidad, duracionDias: p.duracionDias, unidad: p.unidad, activo: p.activo !== false, costoRef: p.costoRef || null })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
        lotes: lotes.slice().sort((a, b) => txtc(b.fecha).localeCompare(txtc(a.fecha)) || txtc(b.createdAt).localeCompare(txtc(a.createdAt))).slice(0, 120).map((l) => ({ id: l.id, fecha: l.fecha || "", producto: l.producto || "", productoId: l.productoId || "", proveedor: l.proveedor || "", cantidad: l.cantidad, disponible: l.disponible, unidad: l.unidad || "", moneda: l.moneda || "HNL", costoTotalMoneda: l.costoTotalMoneda, tasa: l.tasa, costoTotalHnl: l.costoTotalHnl, costoUnitarioHnl: l.costoUnitarioHnl, pago: l.pago || "", cuentaPagoNombre: l.cuentaPagoNombre || "", estado: l.estado || "", referencia: l.referencia || "", vigenciaHasta: l.vigenciaHasta || "", motivoAnulacion: l.motivoAnulacion || "", anuladoAt: l.anuladoAt || "" })),
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
      let cuentas, asignacionesTelegram = [];
      if (tipo === "vip") { // R196y · Control Maestro + Bodega (misma colección, incluye nombres de plataforma antiguos) + Telegram
        const vistos = new Map();
        for (const pl of PLATAFORMAS_VIP_LEGADO) for (const x of (await col("inventario").where("plataforma", "==", pl).get()).docs) if (!vistos.has(x.id)) vistos.set(x.id, { id: x.id, ...(x.data() || {}) });
        cuentas = [...vistos.values()];
        const qc = typeof col("clientes").select === "function" ? col("clientes").select("nombre", "nombreCliente", "servicios") : col("clientes");
        asignacionesTelegram = asignacionesVipDeClientes((await qc.get()).docs.map((x) => ({ id: x.id, ...(x.data() || {}) })));
      } else cuentas = (await col("inventario").where("plataforma", "==", plat).get()).docs.map((x) => ({ id: x.id, ...(x.data() || {}) }));
      const ex = await todos(colF); const proveedores = await todos("fin_proveedores");
      const pv = previsualizarSimple(tipo, filas, { cuentas, asignacionesTelegram, existentes: new Map(ex.map((x) => [x.id, x])), proveedores, tasa: Number(body.tasa) || null, resoluciones: body.resoluciones && typeof body.resoluciones === "object" ? body.resoluciones : {} });
      const hash = hashFilas(filas, [tipo, Number(body.tasa) || 0]);
      if (accion === "finp_simple_preview") return ok({ hash, ...pv });
      if (body.confirmo !== true) throw errUsuario("Confirme la importación.");
      if (String(body.hash || "") !== hash) throw errUsuario("El archivo o la tasa cambiaron desde la vista previa: revise de nuevo.");
      const aplicar = pv.filas.filter((x) => x.estado === "nuevo" || x.estado === "actualiza");
      if (!aplicar.length) throw errUsuario("No hay filas nuevas ni cambios para importar.");
      if (aplicar.length > 480) throw errUsuario("Máximo 480 filas por confirmación: divida el archivo.");
      const jobRef = col("fin_import_jobs").doc();
      const r = await db.runTransaction(async (tx) => {
        const idDe = (x) => x.docId || x.cmId; // R196y · VIP sin asignación: id determinista por correo (el mismo que usa Bodega)
        const refs = aplicar.map((x) => col(colF).doc(idDe(x))); const snaps = await Promise.all(refs.map((rf) => tx.get(rf)));
        const desde = aplicar.filter((x) => x.vinculaDesde); const dRefs = desde.map((x) => col(colF).doc(x.vinculaDesde)); const dSnaps = await Promise.all(dRefs.map((rf) => tx.get(rf)));
        const antes = {};
        desde.forEach((x, i) => { antes[x.vinculaDesde] = dSnaps[i].exists ? dSnaps[i].data() : null; });
        aplicar.forEach((x, i) => { const a0 = snaps[i].exists ? snaps[i].data() : null; antes[idDe(x)] = a0;
          const j = desde.indexOf(x); const a = a0 || (j >= 0 && dSnaps[j].exists ? dSnaps[j].data() : null);
          tx.set(refs[i], { ...(a || {}), ...x.datos, importJobId: jobRef.id, actualizadoAt: ahora, actualizadoPor: actor, ...(a ? {} : { creadoAt: ahora, creadoPor: actor }), ...(j >= 0 ? { vinculadoDesde: x.vinculaDesde } : {}), historial: [...((a && a.historial) || []), { at: ahora, por: actor, origen: "excel_simple", jobId: jobRef.id, vinculo: x.vinculo || undefined, cambios: x.cambios.length ? x.cambios : Object.keys(x.datos) }].slice(-30) }); });
        desde.forEach((x, i) => { if (dSnaps[i].exists) tx.set(dRefs[i], { ...dSnaps[i].data(), estadoSeguimiento: "vinculado", vinculadoA: idDe(x), importJobId: jobRef.id, actualizadoAt: ahora, actualizadoPor: actor }); });
        const sinAsig = aplicar.filter((x) => x.vinculo === "sin_asignacion" || x.vinculo === "telegram").length;
        tx.set(jobRef, { tipo: `excel_${tipo}`, archivo: { nombre: txt(body.archivo?.nombre, 120), bytes: Number(body.archivo?.bytes) || 0 }, hash, actor, createdAt: ahora, estado: "aplicado", resumen: { ...pv.resumen, aplicadosExtras: aplicar.length, aplicadosLotes: 0 }, antesCol: { [colF]: antes } });
        audit(tx, { accion: `importar_excel_${tipo}`, targetType: "importacion", targetId: jobRef.id, detalle: `${aplicar.length - sinAsig} cuenta(s) existentes vinculadas · ${sinAsig} registro(s) solo financieros sin asignación comercial · 0 ventas · 0 clientes · 0 cuentas en Control Maestro` });
        return { jobId: jobRef.id, aplicados: aplicar.length, vinculadas: aplicar.length - sinAsig, sinAsignacion: sinAsig, tipo };
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
      const exMap = new Map(ex.filter((x) => x.estadoSeguimiento !== "reemplazado" && x.estadoSeguimiento !== "vinculado").map((x) => [x.id, x]));
      const tab = ["trap", "deku", "propio", "otro", "sin", "todos"].includes(body.tab) ? body.tab : "todos";
      const q = normTxt(body.q);
      let filas = inv.map((c) => { const x = exMap.get(c.id) || null; return { cmId: c.id, correo: normEmail(c.correo), madre: madreDe(c), cliente: clienteDeInv(c), estadoCM: c.estado || "", grupo: x ? x.grupo || "otro" : "sin", proveedor: x ? x.proveedor : "", costoMensualUsdt: x ? x.costoMensualUsdt : null, costoMensualHnl: x ? x.costoMensualHnl : null, tasa: x ? x.tasa : null, proximoPagoProveedor: x ? x.proximoPagoProveedor : "", ultimoPagoProveedor: x ? x.ultimoPagoProveedor : "", estado: x ? x.estadoSeguimiento : "sin_registro", loteId: x ? x.loteId : "", renovarProximoMes: x ? x.renovarProximoMes : null, notas: x ? x.notas || "" : "", historial: x ? (x.historial || []).slice(-10) : [] }; });
      // R196y · registros solo financieros (aún sin unidad en Control Maestro/Bodega): se listan como «Sin asignación comercial»
      const invIds = new Set(inv.map((c) => c.id));
      for (const x of exMap.values()) if (!invIds.has(x.id) && !(x.cmId && invIds.has(x.cmId))) filas.push({ cmId: x.id, correo: normCorreoVip(x.correo), madre: "", cliente: (x.asignacionesTelegram || []).map((t) => t.nombre).filter(Boolean).join(", "), estadoCM: x.sinInventario ? (x.sinAsignacionComercial ? "sin_asignacion" : "telegram") : "", sinInventario: !!x.sinInventario, grupo: x.grupo || "otro", proveedor: x.proveedor, costoMensualUsdt: x.costoMensualUsdt ?? null, costoMensualHnl: x.costoMensualHnl ?? null, tasa: x.tasa ?? null, proximoPagoProveedor: x.proximoPagoProveedor || "", ultimoPagoProveedor: x.ultimoPagoProveedor || "", estado: x.estadoSeguimiento || "activo", loteId: x.loteId || "", renovarProximoMes: x.renovarProximoMes ?? null, notas: x.notas || "", historial: (x.historial || []).slice(-10) });
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
        const ref = col("fin_vip_extras").doc(cmId); const s = await tx.get(ref); const a = s.exists ? s.data() : {};
        const soloFin = !invS.exists && s.exists && a.sinInventario === true; // R196y · registro sin asignación comercial: se edita solo en Finanzas
        if (!soloFin && (!invS.exists || String(invS.data().plataforma || "") !== "vipnetflix")) throw errUsuario("Ese acceso no es un Netflix VIP de Control Maestro.");
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
        tx.set(ref, { ...fin, cmId: soloFin ? a.cmId || "" : cmId, correo: soloFin ? a.correo : normEmail(invS.data().correo), actualizadoAt: ahora, actualizadoPor: actor, ...(s.exists ? {} : { creadoAt: ahora, creadoPor: actor, estadoSeguimiento: fin.estadoSeguimiento || "activo" }), historial: [...(a.historial || []), { at: ahora, por: actor, origen: "edicion", antes, despues: n }].slice(-30) });
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
      try { await spotifyFam.sincronizarBodega(db, fid); } catch (_) {} // Bodega muestra pago y renovación
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
        const rp = hboPlanes.resumenCuenta(c); // R196z · plan real: Standard 3 / Platinum 5 (cuentas viejas: su capacidad, sin tocarla)
        return { cuentaId: c.id, correo: String(c.correo || c.email || ""), plan: rp.plan, nombrePlan: rp.nombrePlan, ocupados: rp.ocupados, capacidad: rp.capacidad, modalidad: x.modalidad === "tarjeta" ? "tarjeta" : "activacion",
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
        if (mod === "tarjeta" && !tarjetaId && !(cargo && cargo.activacion === true)) throw errUsuario("Elija o agregue la tarjeta (banco, titular y últimos 4).");
        const cargos = [...(a.cargos || [])];
        if (cargo) {
          const fecha = fechaExcel(cargo.fecha), moneda = ["USD", "HNL"].includes(cargo.moneda) || (cargo.moneda === "USDT" && cargo.activacion === true) ? cargo.moneda : null, monto = r2(cargo.monto), hnl = r2(moneda === "HNL" ? cargo.monto : cargo.cargoHnl); // R196z · activación Binance (USDT): se anota tras la compra real
          if (!fecha || fecha > hoy) throw errUsuario("Fecha del cargo inválida.");
          if (!moneda || !(monto > 0) || !(hnl > 0)) throw errUsuario(moneda === "USD" ? "Escriba el monto en USD y el cargo REAL en Lempiras que cobró el banco." : "Escriba el monto del cargo.");
          const opid = txt(cargo.operationId, 80);
          if (opid && cargos.some((c) => c.operationId === opid)) return { duplicado: true }; // reintento del mismo cargo
          if (!cargo.loteId && cargos.some((c) => c.fecha === fecha && Math.abs(Number(c.cargoHnl) - hnl) < 0.005)) throw errUsuario(`Ese cargo (L${hnl} del ${fecha}) ya está registrado en esta cuenta. No se suma dos veces.`);
          if (!cargo.loteId) return { verificado: true }; // solo se comprobó que no está repetido (antes de registrar la compra)
          cargos.push({ fecha, moneda, monto, cargoHnl: hnl, loteId: txt(cargo.loteId, 120), operationId: opid, tarjetaId: moneda === "USDT" ? "" : tarjetaId, ...(moneda === "USDT" ? { tipo: "activacion", tasa: Number(cargo.tasa) || 0, ...(fechaExcel(cargo.fechaActivacion) ? { fechaActivacion: fechaExcel(cargo.fechaActivacion) } : {}) } : {}), por: actor, at: ahora });
        }
        const n = { modalidad: mod, tarjetaId: mod === "tarjeta" ? tarjetaId : a.tarjetaId || "", periodicidad: per || a.periodicidad || (mod === "tarjeta" ? "mensual" : ""), ...(prox !== undefined ? { proximoCobro: prox } : {}) };
        tx.set(ref, { ...a, ...n, cuentaId: cid, correo: String((sc.data() || {}).correo || ""), cargos: cargos.slice(-60), actualizadoAt: ahora, actualizadoPor: actor,
          historial: [...(a.historial || []), { at: ahora, por: actor, antes: { modalidad: a.modalidad || "activacion", tarjetaId: a.tarjetaId || "", periodicidad: a.periodicidad || "" }, despues: n }].slice(-30) });
        audit(tx, { accion: cargo ? (cargo.loteId ? "hbo_cargo_tarjeta" : "hbo_cargo_verificado") : "hbo_modalidad", targetType: "hbo_cuenta", targetId: cid, before: { modalidad: a.modalidad || "activacion" }, after: n });
        return { cuentaId: cid, modalidad: mod, tarjetaId };
      });
      return ok(r);
    }

    // ---------------- R196z · Cuentas madre automáticas (Netflix Premium, Paramount+, Crunchyroll, Prime Video, HBO Max)
    // Se LEEN de Control Maestro; aquí no se crean cuentas, compras, ventas ni ingresos. «pendientes» = todas sin compra.
    if (accion === "finp_cuentas_lista") {
      const pedida = String(body.plataforma || "");
      const plats = pedida === "pendientes" ? Object.keys(finCuentas.PLATAFORMAS) : finCuentas.PLATAFORMAS[pedida] ? [pedida] : null;
      if (!plats) throw errUsuario("Plataforma no administrada aquí.");
      const [inv, cfgs, tarjetas, productos] = await Promise.all([todos("inventario"), todos("fin_cuentas_costo"), todos("fin_tarjetas"), todos("fin_productos")]);
      const cuentas = inv.filter((c) => finCuentas.activa(c) && plats.includes(finCuentas.plataformaDe(c.plataforma)));
      const ids = new Set(cuentas.map((c) => c.id));
      const prodIds = productos.filter((p) => plats.includes(finCuentas.plataformaDe(p.plataformaKey))).map((p) => p.id);
      const lotes = (await Promise.all(prodIds.map((pid) => col("fin_lotes").where("productoId", "==", pid).get().then((sn) => sn.docs.map((x) => ({ id: x.id, ...(x.data() || {}) })))))).flat()
        .filter((l) => l.estado !== "anulado" && ids.has(String(l.cuentaInventarioId || ""))).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      const porCuenta = new Map(); for (const l of lotes) { const k = l.cuentaInventarioId; (porCuenta.get(k) || porCuenta.set(k, []).get(k)).push(l); }
      const cfgDe = new Map(cfgs.map((x) => [x.id, x])), tDe = new Map(tarjetas.map((x) => [x.id, x]));
      let filas = cuentas.map((c) => { const cfg = cfgDe.get(c.id) || null; return finCuentas.filaCuenta(c, cfg, porCuenta.get(c.id) || [], cfg && cfg.tarjetaId ? tDe.get(cfg.tarjetaId) : null, hoy); });
      if (pedida === "pendientes") filas = filas.filter((f) => f.estadoCosto === "pendiente");
      filas.sort((a, b) => a.plataforma.localeCompare(b.plataforma) || (a.estadoCosto === b.estadoCosto ? 0 : a.estadoCosto === "pendiente" ? -1 : 1) || String(a.proximoPago || "9999").localeCompare(String(b.proximoPago || "9999")) || a.correo.localeCompare(b.correo));
      const resumen = { cuentas: filas.length, conCosto: filas.filter((f) => f.estadoCosto === "con_costo").length, pendientes: filas.filter((f) => f.estadoCosto === "pendiente").length, proximos: filas.filter((f) => f.pronto).length };
      return ok({ hoy, plataforma: pedida, filas, resumen, plataformas: finCuentas.PLATAFORMAS, modalidades: finCuentas.MODALIDADES, frecuencias: finCuentas.FRECUENCIAS,
        tarjetas: tarjetas.map((x) => ({ id: x.id, banco: x.banco, titular: x.titular, ultimos4: x.ultimos4 })),
        productos: productos.filter((p) => p.activo !== false && plats.includes(finCuentas.plataformaDe(p.plataformaKey))).map((p) => ({ id: p.id, nombre: p.nombre, modelo: p.modelo, plataforma: finCuentas.plataformaDe(p.plataformaKey) })) });
    }
    if (accion === "finp_cuenta_config") { // solo Finanzas: modalidad, moneda, frecuencia, tarjeta mínima y próximo pago
      const cid = txt(body.cuentaId, 120); if (!cid) throw errUsuario("Falta la cuenta.");
      let tarjetaNueva = null;
      if (body.tarjetaNueva) {
        const banco = txt(body.tarjetaNueva.banco, 60), titular = txt(body.tarjetaNueva.titular, 80), u4 = String(body.tarjetaNueva.ultimos4 || "").replace(/\s/g, "");
        if (!/^\d{4}$/.test(u4)) throw errUsuario(/\d{5,}/.test(u4) ? "Escriba SOLO los últimos 4 dígitos. Nunca el número completo de la tarjeta." : "Los últimos 4 dígitos deben ser 4 números.");
        if (banco.length < 2 || titular.length < 3) throw errUsuario("Escriba el banco y el nombre del titular de la tarjeta.");
        tarjetaNueva = { banco, titular, ultimos4: u4 };
      }
      const r = await db.runTransaction(async (tx) => {
        const cref = col("inventario").doc(cid), ref = col("fin_cuentas_costo").doc(cid);
        const [sc, s] = [await tx.get(cref), await tx.get(ref)];
        const plat = sc.exists ? finCuentas.plataformaDe((sc.data() || {}).plataforma) : "";
        if (!sc.exists || !plat) throw errUsuario("Esa cuenta no está en Control Maestro.");
        const lc = finCuentas.limpiarConfig(plat, body); if (lc.error) throw errUsuario(lc.error);
        const a = s.exists ? s.data() || {} : {};
        let tarjetaId = body.tarjetaId ? txt(body.tarjetaId, 120) : "";
        if (tarjetaNueva) {
          const id = `tj_${tarjetaNueva.banco}_${tarjetaNueva.ultimos4}_${tarjetaNueva.titular}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_]+/g, "-").slice(0, 120);
          const tref = col("fin_tarjetas").doc(id), ts = await tx.get(tref);
          if (!ts.exists) tx.set(tref, { ...tarjetaNueva, creadoAt: ahora, creadoPor: actor });
          tarjetaId = id;
        } else if (tarjetaId) { const ts = await tx.get(col("fin_tarjetas").doc(tarjetaId)); if (!ts.exists) throw errUsuario("Esa tarjeta ya no existe."); }
        if (lc.config.modalidad === "tarjeta" && !tarjetaId) throw errUsuario("Elija o agregue la tarjeta (banco, titular y últimos 4).");
        const n = { ...lc.config, tarjetaId: lc.config.modalidad === "tarjeta" ? tarjetaId : "" };
        const antes = { modalidad: a.modalidad || "", moneda: a.moneda || "", frecuencia: a.frecuencia || "", tarjetaId: a.tarjetaId || "", proximoPago: a.proximoPago || "" };
        tx.set(ref, { ...a, ...n, cuentaId: cid, plataforma: plat, correo: String((sc.data() || {}).correo || "").toLowerCase(), actualizadoAt: ahora, actualizadoPor: actor, ...(s.exists ? {} : { creadoAt: ahora, creadoPor: actor }),
          historial: [...(a.historial || []), { at: ahora, por: actor, antes, despues: n }].slice(-30) });
        audit(tx, { accion: "cuenta_costo_config", targetType: "fin_cuenta", targetId: cid, before: antes, after: n });
        return { cuentaId: cid, plataforma: plat };
      });
      return ok(r);
    }
    if (accion === "finp_tasa_bac") { // R200g · tasa del día (venta = la que cobra el banco al pagar en USD)
      const t = await tasaBac(db, hoy);
      if (t.error) return ok({ disponible: false, error: t.error });
      return ok({ disponible: true, fuente: t.fuente, fecha: t.fecha, compra: t.compra, venta: t.venta, deHoy: !!t.deHoy, aviso: t.aviso || "" });
    }
    if (accion === "finp_cuenta_historial" && body.spotifyFamiliaId) { // R200g · Spotify Familiar: pagos de UNA cuenta principal
      const fid = txt(body.spotifyFamiliaId, 120);
      const sf = await col("spotify_familias").doc(fid).get(); if (!sf.exists) throw errUsuario("Esa cuenta de Spotify Familiar no existe.");
      const codigo = String((sf.data() || {}).codigo || ""), madre = String((sf.data() || {}).madreCorreo || "").toLowerCase();
      const prods = (await col("fin_productos").get()).docs.map((x) => ({ id: x.id, ...(x.data() || {}) })).filter((p) => p.plataformaKey === "spotify" || /spotify/i.test(p.nombre || ""));
      const lotes = (await Promise.all(prods.map((p) => col("fin_lotes").where("productoId", "==", p.id).get()))).flatMap((sn) => sn.docs.map((x) => ({ id: x.id, ...(x.data() || {}) })))
        .filter((l) => { const ref = String(l.referencia || ""); return (codigo && ref.startsWith(`Spotify Familiar ${codigo} `)) || (madre && ref.toLowerCase().includes(madre)); })
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      return ok({ familiaId: fid, compras: lotes.map((l) => ({ loteId: l.id, fecha: l.fecha, producto: l.producto, moneda: l.moneda, montoMoneda: l.costoTotalMoneda, tasa: l.tasa, costoHnl: l.costoTotalHnl, duracionDias: l.duracionDias || 0, vigenciaHasta: l.vigenciaHasta || "", pago: l.cuentaPagoNombre || l.pago, referencia: l.referencia || "", estado: l.estado || "activo", motivoAnulacion: l.motivoAnulacion || "", por: l.createdBy || "" })), cambios: [] });
    }
    if (accion === "finp_cuenta_historial") { // compras reales de UNA cuenta (más reciente primero); no cambia nada
      const cid = txt(body.cuentaId, 120); if (!cid) throw errUsuario("Falta la cuenta.");
      const lotes = (await col("fin_lotes").where("cuentaInventarioId", "==", cid).get()).docs.map((x) => ({ id: x.id, ...(x.data() || {}) })).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      const cfg = await col("fin_cuentas_costo").doc(cid).get();
      return ok({ cuentaId: cid, compras: lotes.map((l) => ({ loteId: l.id, fecha: l.fecha, producto: l.producto, moneda: l.moneda, montoMoneda: l.costoTotalMoneda, tasa: l.tasa, costoHnl: l.costoTotalHnl, duracionDias: l.duracionDias || 0, vigenciaHasta: l.vigenciaHasta || "", pago: l.cuentaPagoNombre || l.pago, referencia: l.referencia || "", estado: l.estado || "activo", motivoAnulacion: l.motivoAnulacion || "", por: l.createdBy || "" })),
        cambios: cfg.exists ? (cfg.data().historial || []).slice(-10).reverse() : [] });
    }

    // ---------------- R198h · CONCILIACIÓN compra → cuenta → período (fin_costo_ciclos). Solo Sublicuentas. NUNCA toca la compra
    // (monto, fecha, tasa, referencia y cuenta original quedan iguales), ni Control Maestro, ni ventas. Cada cambio queda auditado.
    if (accion === "finp_costo_conciliar" || accion === "finp_costo_conciliar_quitar") {
      if (identity.role !== "sublicuentas") throw errUsuario("Solo Sublicuentas concilia compras con cuentas.");
      const loteId = txt(body.loteId, 160); if (!loteId) throw errUsuario("Falta la compra.");
      const ymdOk = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
      const r = await db.runTransaction(async (tx) => {
        const lref = col("fin_lotes").doc(loteId), cref = col("fin_costo_ciclos").doc(loteId);
        const [sl, sc] = [await tx.get(lref), await tx.get(cref)];
        if (!sl.exists || (sl.data() || {}).estado === "anulado") throw errUsuario("Esa compra no existe o está anulada.");
        const l = sl.data() || {}, a = sc.exists ? sc.data() || {} : {};
        if (accion === "finp_costo_conciliar_quitar") {
          if (!sc.exists || a.estado === "anulado") return { sinCambios: true };
          tx.set(cref, { ...a, estado: "anulado", actualizadoAt: ahora, actualizadoPor: actor, historial: [...(a.historial || []), { at: ahora, por: actor, accion: "quitar", antes: { cuentaInventarioId: a.cuentaInventarioId || "", coberturaDesde: a.coberturaDesde || "", coberturaHasta: a.coberturaHasta || "" }, motivo: txt(body.motivo, 200) }].slice(-30) });
          audit(tx, { accion: "costo_conciliacion_quitar", targetType: "fin_lote", targetId: loteId, before: { cuentaInventarioId: a.cuentaInventarioId || "", coberturaDesde: a.coberturaDesde || "", coberturaHasta: a.coberturaHasta || "" }, after: { estado: "anulado" } });
          return { loteId, quitado: true };
        }
        const evidencia = txt(body.evidencia, 300);
        if (evidencia.length < 5) throw errUsuario("Escriba la evidencia (de dónde sale el vínculo o la cobertura).");
        let cuentaId = txt(body.cuentaInventarioId, 160);
        if (l.cuentaInventarioId) { // la compra ya trae su cuenta: no se cambia el vínculo original
          if (cuentaId && cuentaId !== l.cuentaInventarioId) throw errUsuario("Esa compra ya está registrada para otra cuenta. No se cambia el vínculo original.");
          cuentaId = "";
        } else if (cuentaId) {
          const ci = await tx.get(col("inventario").doc(cuentaId));
          if (!ci.exists) throw errUsuario("Esa cuenta no está en Control Maestro.");
        }
        const cd = txt(body.coberturaDesde, 10), ch = txt(body.coberturaHasta, 10);
        if ((cd || ch) && !(ymdOk(cd) && ymdOk(ch))) throw errUsuario("Escriba las dos fechas de la cobertura (desde y hasta) o ninguna.");
        if (cd && ch) {
          if (ch < cd) throw errUsuario("La cobertura termina antes de empezar.");
          const base = String(l.fechaActivacion || l.fecha || "");
          if (base && cd < base) throw errUsuario(`La cobertura no puede empezar antes de la compra/activación (${base}).`);
          if ((Date.parse(ch) - Date.parse(cd)) / 86400000 > 400) throw errUsuario("Una cobertura de más de 13 meses necesita revisión: no se guarda.");
        }
        if (!cuentaId && !l.cuentaInventarioId && !(cd && ch)) throw errUsuario("Elija la cuenta madre o la cobertura documentada.");
        const n = { loteId, cuentaInventarioId: cuentaId || a.cuentaInventarioId || "", coberturaDesde: cd || "", coberturaHasta: ch || "", evidencia, estado: "confirmado" };
        tx.set(cref, { ...a, ...n, loteFecha: l.fecha || "", loteCostoHnl: l.costoTotalHnl || 0, loteMoneda: l.moneda || "", loteMonto: l.costoTotalMoneda || 0, loteTasa: l.tasa || 0, ...(sc.exists ? {} : { creadoAt: ahora, creadoPor: actor }), actualizadoAt: ahora, actualizadoPor: actor,
          historial: [...(a.historial || []), { at: ahora, por: actor, accion: "conciliar", antes: { cuentaInventarioId: a.cuentaInventarioId || "", coberturaDesde: a.coberturaDesde || "", coberturaHasta: a.coberturaHasta || "" }, despues: { cuentaInventarioId: n.cuentaInventarioId, coberturaDesde: n.coberturaDesde, coberturaHasta: n.coberturaHasta }, evidencia }].slice(-30) });
        audit(tx, { accion: "costo_conciliacion", targetType: "fin_lote", targetId: loteId, before: { cuentaInventarioId: a.cuentaInventarioId || "", coberturaDesde: a.coberturaDesde || "", coberturaHasta: a.coberturaHasta || "" }, after: { cuentaInventarioId: n.cuentaInventarioId, coberturaDesde: n.coberturaDesde, coberturaHasta: n.coberturaHasta }, detalle: evidencia });
        return { loteId, ...n };
      });
      return ok(r);
    }

    // ---------------- R197 · GANANCIAS de todas las plataformas (motor único, SOLO LECTURA: no crea ni cambia nada)
    if (accion === "finp_ganancias" || accion === "finp_ganancias_cuenta" || accion === "finp_ganancias_excel" || accion === "finp_excel_financiero" || accion === "finp_ganancias_plataforma" || accion === "finp_auditoria_cartera" || accion === "finp_rentabilidad") { // R198j · + ganancia por cuenta
      if (!d.leerMovimientos || !d.R) throw errUsuario("El motor de ganancias no está disponible.");
      const ymdOk = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
      const mesHoy = hoy.slice(0, 7);
      const mesMenos = (mes, k) => { const n = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 - k; return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`; };
      const mesesIni = [3, 2, 1, 0].map((k) => mesMenos(mesHoy, k)); // mes actual y los 3 anteriores (p. ej. ago–nov 2026)
      let desde = ymdOk(body.desde) ? body.desde : rangoMes(mesHoy).desde, hasta = ymdOk(body.hasta) ? body.hasta : rangoMes(mesHoy).hasta;
      if (hasta < desde) [desde, hasta] = [hasta, desde];
      if (Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000) > 400) throw errUsuario("Elija un rango de hasta 13 meses.");
      const leerDesde = accion === "finp_ganancias" || accion === "finp_excel_financiero" /* R200c · igual que la Web */ ? [desde, rangoMes(mesesIni[0]).desde].sort()[0] : accion === "finp_rentabilidad" ? new Date(Date.parse(`${hoy}T12:00:00Z`) - 400 * 86400000).toISOString().slice(0, 10) : accion === "finp_ganancias_plataforma" || accion === "finp_auditoria_cartera" ? new Date(Date.parse(`${desde}T12:00:00Z`) - 180 * 86400000).toISOString().slice(0, 10) : desde; // plataforma: 6 meses atrás para «último cobro»
      const mesesConsumo = mesesDe(leerDesde, hasta > hoy ? hasta : hoy);
      const [movs, clientes, inventario, lotes, productos, vipExtras, spotify, premium, consumos, cfgCosteo, ciclos] = await Promise.all([
        d.leerMovimientos(leerDesde), todos("clientes"), todos("inventario"), todos("fin_lotes"), todos("fin_productos"), todos("fin_vip_extras"), todos("fin_spotify_cuentas"), todos("fin_premium_cuentas"),
        Promise.all(mesesConsumo.map((m) => col("fin_consumos").where("mesKey", "==", m).get().then((sn) => sn.docs.map((x) => ({ id: x.id, ...(x.data() || {}) }))))).then((a) => a.flat()),
        col("finanzas_config").doc("costeo").get(), todos("fin_costo_ciclos")]);
      const ctx = prepararContexto({ clientes, inventario, lotes, productos, consumos, vipExtras, spotify, premium, ciclos }); // R198h · + conciliaciones
      const deps = { R: d.R, ventasACostear: ventasACostearG };
      const calc = calcularGanancias(ctx, movs, { desde, hasta, hoy }, deps);
      // R198i · resultado del CICLO de activación: se lee desde la activación más antigua de las cuentas pedidas (máx. 400 días) hasta hoy
      const ciclosDe = async (filtro) => {
        const acts = ctx.lotes.length ? calcularGanancias(ctx, [], { desde: hoy, hasta: hoy, hoy }, deps).ciclosActivacion.filter(filtro) : [];
        if (!acts.length) return null;
        const tope = new Date(Date.parse(`${hoy}T12:00:00Z`) - 400 * 86400000).toISOString().slice(0, 10);
        const ini = [acts.map((c) => c.fechaActivacion).sort()[0], tope].sort()[1];
        const mv = ini < leerDesde ? await d.leerMovimientos(ini) : movs;
        return resultadoCiclos(calcularGanancias(ctx, mv, { desde: ini, hasta: hoy, hoy }, deps), { leidoDesde: ini });
      };
      if (accion === "finp_rentabilidad") { // R198j · lo que pagué por la cuenta vs. lo que pagan sus clientes (SOLO LECTURA)
        const altas = new Map();
        for (const v of deps.ventasACostear(movs, "2000-01-01", deps.R, { paraIngresos: true })) {
          if (v.anulada || v.subtipo !== "compra_nueva" || v.origenVenta !== "venta") continue;
          for (const cid of [v.compraId, ...(v.compraIds || []), ...((v.asignaciones || []).map((a) => a.compraId))].filter(Boolean)) { const k = String(cid); if (!altas.has(k) || v.fecha < altas.get(k)) altas.set(k, v.fecha); }
        }
        const plat = txt(body.plataforma, 40);
        const r = rentabilidadCuentas(ctx, { hoy, plataforma: plat, altas, cobradoCiclo: plat ? await ciclosDe((c) => String(c.plataforma).replace(/^hbomax.*/, "hbomax") === String(plat).replace(/^hbomax.*/, "hbomax")) : null });
        return ok({ hoy, plataforma: plat, nombre: plat ? nombrePlataforma(plat) : "", plataformas: r.plataformas, total: r.total, cuentas: plat ? r.filas : undefined });
      }
      if (accion === "finp_ganancias_cuenta") {
        const cid = txt(body.cuentaId, 160);
        const det = detalleCuenta(ctx, calc, cid, await ciclosDe((c) => c.cuentaId === cid)); if (!det) throw errUsuario("Esa cuenta ya no está en Control Maestro.");
        return ok({ desde, hasta, cuenta: det });
      }
      if (accion === "finp_ganancias_plataforma") { // R197b · botón «Cuentas»: todas las cuentas/accesos + conciliación de cartera (solo lectura)
        const plat = txt(body.plataforma, 40); if (!plat) throw errUsuario("Elija la plataforma.");
        const cartera = conciliarCartera(ctx, calc, { plataforma: plat, vendedor: txt(body.vendedor, 60), desde, hasta, hoy }, deps);
        const vendedores = [...new Set(ctx.servicios.map((x) => String(x.vendedor || "Sin vendedor")))].sort();
        return ok({ desde, hasta, plataforma: plat, nombre: nombrePlataforma(plat), cuentas: cuentasDePlataforma(ctx, calc, plat, await ciclosDe((c) => String(c.plataforma).replace(/^hbomax.*/, "hbomax") === String(plat).replace(/^hbomax.*/, "hbomax"))), compras: conciliacionCompras(ctx, calc, plat), estadosCosto: ESTADOS_COSTO, puedeConciliar: identity.role === "sublicuentas", /* R198h */ cartera: { resumen: cartera.resumen, filas: cartera.filas.slice(0, 1500), truncado: cartera.filas.length > 1500 }, vendedores, plataformaResumen: calc.porPlataforma.find((x) => x.plataforma === plat) || null, definiciones: DEFINICIONES });
      }
      if (accion === "finp_auditoria_cartera") { // R197c · auditoría SOLO LECTURA: no crea, no cambia, no borra; queda registro del acceso
        const plat = txt(body.plataforma, 40), vend = txt(body.vendedor, 60), clase = txt(body.clase, 40);
        const aud = auditarCartera(ctx, calc, { desde, hasta, hoy, plataforma: plat, vendedor: vend }, deps);
        const filtradas = clase ? aud.filas.filter((f) => f.clase === clase) : aud.filas;
        try { await col("auditoria_eventos").add({ tipo: "finanzas_auditoria_consulta", modulo: "finanzas_panel", accion: "finp_auditoria_cartera", actorUsuario: identity.usuario, rol: identity.role, origen: txt(body.origen, 20) || "web", detalle: `${desde}..${hasta} ${plat || "todas"} ${vend || ""} ${clase || ""} ${body.formato === "csv" ? "csv" : "json"}`.trim().slice(0, 160), filas: filtradas.length, resultado: "ok", createdAt: ahora }); } catch (e) { console.error("auditoria_cartera log", e); }
        const meta = { desde, hasta, corte: aud.resumen.corte, version: "r197c", fuentes: ["clientes (CRM)", "inventario (Control Maestro, consulta)", "finanzas_movimientos (libro)", "fin_lotes / fin_vip_extras / fin_spotify_cuentas / fin_premium_cuentas (costos)"],
          limitaciones: ["Solo la ÚLTIMA renovación y el último ajuste quedan guardados en cada servicio: renovaciones intermedias sin cobro no se reconstruyen aquí.", "Los cobros por Socios se enlazan por las fichas que el socio amarró; un pago de varios servicios se marca «compartido» y no se reparte.", "Correos enmascarados; no se devuelven teléfonos, PIN, claves ni tokens."] };
        if (body.formato === "csv") return ok({ ...meta, csv: csvAuditoria(filtradas), filas: filtradas.length });
        const porPagina = Math.min(500, Math.max(20, Number(body.porPagina) || 200)), pagina = Math.max(1, Math.floor(Number(body.pagina) || 1));
        return ok({ ...meta, resumen: aud.resumen, porPlataforma: aud.porPlataforma, clases: aud.clases, sociosSinFicha: aud.sociosSinFicha.slice(0, 200), total: filtradas.length, pagina, porPagina, filas: filtradas.slice((pagina - 1) * porPagina, pagina * porPagina),
          vendedores: [...new Set(ctx.servicios.map((x) => String(x.vendedor || "Sin vendedor")))].sort() });
      }
      if (accion === "finp_ganancias_excel") { const filas = filasExcel(calc); return ok({ desde, hasta, filas: filas.slice(0, 20000), truncado: filas.length > 20000 }); }
      // R200c · Libro Excel financiero (9 hojas). MISMO motor y MISMO corte por mes que la Web: cada mes se calcula como en
      // Finanzas → mes elegido, así los totales del Excel por mes coinciden con la pantalla. Sin teléfonos, PIN ni claves.
      if (accion === "finp_excel_financiero") {
        const meses = mesesDe(desde, hasta).slice(0, 13);
        const r2e = (v) => Math.round(Number(v || 0) * 100) / 100;
        const out = { meses: [], ventas: [], costos: [], desembolsos: [], cuentasMes: [], pendientes: [] };
        for (const m of meses) {
          // cada mes con la MISMA ventana de lectura que usa la Web al abrir ese mes (desde el mes o los 3 meses de comparación)
          const rg = rangoMes(m); const leerM = [rg.desde, rangoMes(mesesIni[0]).desde].sort()[0];
          const movsM = movs.filter((x) => String(d.R.movementYmd(x) || "") >= leerM);
          const c = calcularGanancias(ctx, movsM, { ...rg, hoy }, deps);
          out.meses.push({ mes: m, ...c.resumen, porPlataforma: c.porPlataforma.map((x) => ({ plataforma: x.plataforma, nombre: x.nombre, altas: x.altas, renovaciones: x.renovaciones, clientes: x.clientes, cobradoHnl: x.cobradoHnl, cobradoCubiertoHnl: x.cobradoCubiertoHnl, costoHnl: x.costoHnl, desembolsoHnl: x.desembolsoHnl, resultadoHnl: x.resultadoHnl, margen: x.margen, coberturaCostos: x.coberturaCostos, estado: x.estado })) });
          for (const l of c.lineas) out.ventas.push({ id: `${l.referencia}|${l.compraId || ""}`, mes: m, fecha: l.fecha, tipo: l.tipo, plataforma: nombrePlataforma(l.plataforma), cuentaId: l.cuentaId, cuenta: l.cuentaCorreo, perfil: l.perfil, beneficiario: l.beneficiario, titular: l.titular, vendedor: l.vendedor, valor: r2e(l.monto), cobrado: r2e(l.cobrado), pendiente: r2e(l.pendiente), descuento: r2e(l.descuento), costoVinculado: !!l.costoCubierto, combo: !!l.combo, cobroId: l.referencia, compraId: l.compraId || "" });
          for (const x of c.costos) out.costos.push({ mes: m, plataforma: nombrePlataforma(x.plataforma), cuentaId: x.cuentaId || "", cuenta: x.correo || "", loteId: x.loteId || "", producto: x.producto || "", proveedor: x.proveedor || "", regla: x.regla, costoHnl: r2e(x.costoHnl), moneda: x.moneda || "HNL", montoMoneda: x.montoMoneda ?? "", tasa: x.tasa ?? "", fechaCompra: x.fechaCompra || "", criterio: x.criterio || "" });
          for (const x of c.desembolsos) out.desembolsos.push({ mes: m, loteId: x.loteId || "", fecha: x.fechaCompra || "", producto: x.producto || "", proveedor: x.proveedor || "", plataforma: nombrePlataforma(x.plataforma), moneda: x.moneda || "HNL", montoMoneda: x.montoMoneda ?? "", tasa: x.tasa ?? "", costoHnl: r2e(x.costoHnl), pago: x.pago || "" });
          const cm = new Map(); const C = (id, plat, correo) => cm.get(id) || cm.set(id, { mes: m, cuentaId: id, plataforma: nombrePlataforma(plat), cuenta: correo || "", clientes: new Set(), cobradoHnl: 0, cobradoCubiertoHnl: 0, costoHnl: 0 }).get(id);
          for (const l of c.lineas) if (l.cuentaId) { const x = C(l.cuentaId, l.plataforma, l.cuentaCorreo); x.cobradoHnl += l.cobrado; if (l.costoCubierto) x.cobradoCubiertoHnl += l.cobrado; if (l.beneficiario) x.clientes.add(l.beneficiario); }
          for (const x of c.costos) if (x.cuentaId) C(x.cuentaId, x.plataforma, x.correo).costoHnl += x.costoHnl;
          for (const x of cm.values()) { const cta = ctx.cuentasPorId.get(x.cuentaId) || {}; out.cuentasMes.push({ ...x, cuenta: x.cuenta || String(cta.correo || ""), clientes: x.clientes.size, perfilesOcupados: Array.isArray(cta.clientes) ? cta.clientes.length : "", capacidad: Number(cta.capacidad || 0) || "", cobradoHnl: r2e(x.cobradoHnl), cobradoCubiertoHnl: r2e(x.cobradoCubiertoHnl), costoHnl: r2e(x.costoHnl) }); }
          for (const b of c.bandeja) out.pendientes.push({ mes: m, tipo: b.tipo, texto: b.texto, plataforma: nombrePlataforma(b.plataforma), fecha: b.fecha || "", beneficiario: b.beneficiario || "", monto: r2e(b.monto), referencia: b.referencia || "" });
        }
        const compras = ctx.lotes.filter((l) => { const f = String(l.fecha || ""); return f >= desde && f <= hasta; }).map((l) => ({ loteId: l.id, folio: String(l.id).slice(-8).toUpperCase(), fecha: l.fecha, fechaActivacion: l.fechaActivacion || "", producto: l.producto || "", proveedor: l.proveedor || "", plataforma: nombrePlataforma(String((ctx.productosPorId.get(l.productoId) || {}).plataformaKey || "")), cuentaId: l._cuentaId || "", cantidad: l.cantidad, unidad: l.unidad || "", moneda: l.moneda || "HNL", montoMoneda: l.costoTotalMoneda, tasa: l.tasa, costoHnl: r2e(l.costoTotalHnl), pago: l.cuentaPagoNombre || l.pago || "", estado: l.estado || "activo", motivoAnulacion: l.motivoAnulacion || "", anuladoAt: l.anuladoAt || "", anuladoPor: l.anuladoPor || "" }));
        const lim = (a) => a.slice(0, 20000);
        return ok({ desde, hasta, generado: new Date().toISOString(), zona: "America/Tegucigalpa", definiciones: DEFINICIONES, meses: out.meses, ventas: lim(out.ventas), costos: lim(out.costos), desembolsos: lim(out.desembolsos), compras: lim(compras), cuentasMes: lim(out.cuentasMes), pendientes: lim(out.pendientes),
          truncado: [out.ventas, out.costos, out.desembolsos, compras, out.cuentasMes, out.pendientes].some((a) => a.length > 20000), usuario: identity.usuario });
      }
      // meses de comparación (mismo motor)
      const meses = mesesIni.map((m) => { const r = rangoMes(m); return { mes: m, ...calcularGanancias(ctx, movs, { ...r, hoy }, deps).resumen }; });
      const anteriorMes = mesMenos(desde.slice(0, 7), 1);
      const ant = calcularGanancias(ctx, leerDesde <= rangoMes(anteriorMes).desde ? movs : await d.leerMovimientos(rangoMes(anteriorMes).desde), { ...rangoMes(anteriorMes), hoy }, deps).resumen;
      // cuentas del período (resumen por cuenta madre)
      const porCta = new Map(); const C = (id, fam, correo) => porCta.get(id) || porCta.set(id, { cuentaId: id, plataforma: fam, nombre: nombrePlataforma(fam), correo, clientes: new Set(), cobradoHnl: 0, pendienteHnl: 0, esperadoHnl: 0, costoHnl: 0, conCosto: false }).get(id);
      for (const l of calc.lineas) if (l.cuentaId) { const x = C(l.cuentaId, l.plataforma, l.cuentaCorreo); x.cobradoHnl += l.cobrado; x.pendienteHnl += l.pendiente; if (l.beneficiario) x.clientes.add(l.beneficiario); }
      for (const e of calc.esperados) if (e.cuentaId) C(e.cuentaId, e.plataforma, e.cuentaCorreo).esperadoHnl += e.precio;
      for (const c of calc.costos) if (c.cuentaId) { const x = C(c.cuentaId, c.plataforma, c.correo || ""); x.costoHnl += c.costoHnl; x.conCosto = true; }
      const r2x = (v) => Math.round(Number(v || 0) * 100) / 100;
      const cuentas = [...porCta.values()].map((x) => { const cta = ctx.cuentasPorId.get(x.cuentaId) || {}; return { ...x, correo: x.correo || String(cta.correo || ""), clientes: x.clientes.size, cobradoHnl: r2x(x.cobradoHnl), pendienteHnl: r2x(x.pendienteHnl), esperadoHnl: r2x(x.esperadoHnl), costoHnl: r2x(x.costoHnl), resultadoHnl: x.conCosto ? r2x(x.cobradoHnl - x.costoHnl) : null }; })
        .sort((a, b) => a.plataforma.localeCompare(b.plataforma) || (b.cobradoHnl - a.cobradoHnl));
      const vend = new Map(); for (const l of calc.lineas) { const v = vend.get(l.vendedor) || vend.set(l.vendedor, { vendedor: l.vendedor, ventas: 0, cobradoHnl: 0 }).get(l.vendedor); v.ventas++; v.cobradoHnl = r2x(v.cobradoHnl + l.cobrado); }
      const conteo = {}; for (const b of calc.bandeja) conteo[b.tipo] = (conteo[b.tipo] || 0) + 1;
      const cc = cfgCosteo.exists ? cfgCosteo.data() || {} : {};
      // R200b · Gráficos del MISMO cálculo que las tarjetas (antes «Ganancia por categoría» leía fin_consumos y quedaba vacío
      // aunque las tarjetas tuvieran ingresos y resultado). Composición, inversión, cobertura, serie diaria y transacciones.
      const graficos = (() => {
        const comp = { venta: { n: 0, cobradoHnl: 0 }, renovacion: { n: 0, cobradoHnl: 0 }, ingreso_manual: { n: 0, cobradoHnl: 0 } };
        for (const l of calc.lineas) { const c = comp[l.tipo] || comp.ingreso_manual; c.n++; c.cobradoHnl = r2x(c.cobradoHnl + l.cobrado); }
        const agrupar = (arr, key) => { const m = new Map(); for (const c of arr) { const k = key(c) || "Sin dato"; const x = m.get(k) || m.set(k, { clave: k, costoHnl: 0, compras: 0 }).get(k); x.costoHnl = r2x(x.costoHnl + c.costoHnl); x.compras++; } return [...m.values()].sort((a, b) => b.costoHnl - a.costoHnl); };
        const dias = new Map(); for (const l of calc.lineas) { const x = dias.get(l.fecha) || dias.set(l.fecha, { fecha: l.fecha, cobradoHnl: 0, ventas: 0 }).get(l.fecha); x.cobradoHnl = r2x(x.cobradoHnl + l.cobrado); x.ventas++; }
        for (const c of calc.desembolsos) { const f = String(c.fechaCompra || "").slice(0, 10); if (!f) continue; const x = dias.get(f) || dias.set(f, { fecha: f, cobradoHnl: 0, ventas: 0 }).get(f); x.desembolsoHnl = r2x((x.desembolsoHnl || 0) + c.costoHnl); }
        const transacciones = calc.lineas.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 3000).map((l) => ({ fecha: l.fecha, tipo: l.tipo, plataforma: l.plataforma, nombre: nombrePlataforma(l.plataforma), beneficiario: l.beneficiario, titular: l.titular, vendedor: l.vendedor, cuentaId: l.cuentaId, cuenta: l.cuentaCorreo ? String(l.cuentaCorreo).replace(/^(.{2}).*(@.*)$/, "$1•••$2") : "", monto: l.monto, cobrado: l.cobrado, pendiente: l.pendiente, descuento: l.descuento || 0, costoCubierto: !!l.costoCubierto, combo: !!l.combo, referencia: l.referencia }));
        return { composicion: comp, inversionProveedor: agrupar(calc.desembolsos, (c) => c.proveedor), inversionPago: agrupar(calc.desembolsos, (c) => c.pago), inversionMoneda: agrupar(calc.desembolsos, (c) => c.moneda || "HNL"),
          cobertura: { cubiertoHnl: calc.resumen.cobradoCubiertoHnl, sinCostoHnl: calc.resumen.cobradoSinCostoHnl }, porDia: [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)), transacciones, transaccionesTotal: calc.lineas.length };
      })();
      return ok({ hoy, desde, hasta, definiciones: DEFINICIONES, meses, anterior: { mes: anteriorMes, ...ant }, resumen: calc.resumen, porPlataforma: calc.porPlataforma, cuentas, vendedores: [...vend.values()].sort((a, b) => b.cobradoHnl - a.cobradoHnl), graficos,
        costos: calc.costos.slice(0, 400), desembolsos: calc.desembolsos.slice(0, 400), bandeja: calc.bandeja.slice(0, 400), bandejaConteo: conteo,
        costeo: { desde: cc.desde || "", activo: !!cc.desde && cc.activo !== false, ultimaCorrida: cc.ultimaCorrida || "" } });
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
