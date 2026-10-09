// api/_finanzas-empresa.js · R135 — FINANCE OS · FASE 1 (catálogo financiero, proveedores, precios con historial y Binance USDT).
// Lógica pura arriba (se prueba sin Firestore) y el manejador de /api/finanzas abajo. Nada de esto modifica movimientos
// existentes: todo vive en colecciones nuevas fin_* y en movimientos nuevos con su propio operationId.
//
// Reglas del PDF que se cumplen aquí:
//  · Precio de venta con HISTORIAL: cambiar un precio crea una versión nueva y cierra la anterior. Nunca se edita una versión.
//  · Costo de referencia del proveedor con historial: cambiarlo agrega una versión; los lotes ya comprados no cambian (Fase 2).
//  · Recargar Binance desde un banco NO es gasto: el banco baja (transferencia) y Binance sube en USDT con su tasa efectiva.
//  · Binance lleva costo promedio ponderado: una recarga nueva no recalcula compras viejas.
//  · Ajuste de Binance: solo con motivo y queda en auditoría; nunca se cambia el historial en silencio.

export const MODELOS = Object.freeze({
  unidad: { label: "Unidad individual", unidad: "unidad", ejemplo: "Netflix VIP, Office" },
  cuenta_madre: { label: "Cuenta madre / perfiles", unidad: "cupo", ejemplo: "Netflix Premium, Paramount, Crunchyroll, Spotify" },
  link: { label: "Link / activación", unidad: "link", ejemplo: "Disney, HBO, Gemini, YouTube" },
  gift_card: { label: "Gift Card", unidad: "tarjeta", ejemplo: "Prime Video" },
  creditos: { label: "Créditos", unidad: "crédito", ejemplo: "Lion, Oleada, Stella, LatinTV, MaxPlayer" },
  panel: { label: "Panel / cupos", unidad: "cupo", ejemplo: "Canva, Duolingo" },
  costo_cero: { label: "Costo cero", unidad: "unidad", ejemplo: "Vix" },
});
export const MONEDAS = Object.freeze(["HNL", "USDT", "USD"]);
export const CATEGORIAS_FIN = Object.freeze({ perfiles: "Perfiles de streaming", tv_digital: "TV Digital", musica: "Música", software: "Software y licencias", cuentas_completas: "Cuentas completas" });
export const BINANCE_ID = "binance";

const r2 = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const r6 = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 1e6) / 1e6 : 0; };
const txt = (v, max = 160) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
export function slug(v) { return String(v || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60); }
const ymdOk = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
function errUsuario(msg) { const e = new Error(msg); e.userError = true; return e; }
function diaAnterior(ymd) { const [y, m, d] = ymd.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d - 1, 12)); return t.toISOString().slice(0, 10); }

// ---------------------------------------------------------------- catálogo (validación)
export function validarProducto(p = {}) {
  const nombre = txt(p.nombre, 80); if (!nombre) throw errUsuario("Escriba el nombre del producto.");
  const sku = (txt(p.sku, 30) || slug(nombre)).toUpperCase().replace(/[^A-Z0-9-]/g, "-").slice(0, 30);
  const modelo = String(p.modelo || ""); if (!MODELOS[modelo]) throw errUsuario("Elija el modelo de abastecimiento.");
  const categoria = CATEGORIAS_FIN[p.categoria] ? p.categoria : "perfiles";
  const capacidad = Math.max(1, Math.round(Number(p.capacidad) || 1));
  const duracionDias = Math.max(0, Math.round(Number(p.duracionDias) || 0));
  const c = p.costoRef || {};
  const costoRef = { monto: r6(c.monto), moneda: MONEDAS.includes(c.moneda) ? c.moneda : "HNL", cantidad: Math.max(1, Math.round(Number(c.cantidad) || 1)), nota: txt(c.nota, 160) };
  if (modelo === "costo_cero") costoRef.monto = 0;
  return {
    sku, nombre, categoria, modelo, unidad: txt(p.unidad, 20) || MODELOS[modelo].unidad, duracionDias, capacidad,
    plataformaKey: slug(p.plataformaKey || "").replace(/-/g, ""), costoRef,
    requiereCuentaMadre: modelo === "cuenta_madre", requiereCorreo: !!p.requiereCorreo, requierePin: !!p.requierePin,
    activo: p.activo !== false, notas: txt(p.notas, 300),
  };
}
export function validarVariante(v = {}, producto = {}) {
  const nombre = txt(v.nombre, 60); if (!nombre) throw errUsuario("Escriba el nombre de la variante (ej. 1 mes · 3 dispositivos).");
  return {
    productoId: String(producto.sku || v.productoId || ""), nombre,
    duracionMeses: Math.max(0, Number(v.duracionMeses) || 0), dispositivos: Math.max(0, Math.round(Number(v.dispositivos) || 0)),
    consumo: Math.max(0, Number(v.consumo ?? 1)), // créditos/cupos que consume UNA venta (Stella 3 disp. = 1 crédito)
    activo: v.activo !== false, notas: txt(v.notas, 200),
  };
}
export function validarProveedor(p = {}) {
  const alias = txt(p.alias, 60); if (!alias) throw errUsuario("Escriba el nombre del proveedor.");
  return { alias, pais: txt(p.pais, 40), moneda: MONEDAS.includes(p.moneda) ? p.moneda : "USDT", metodoPago: txt(p.metodoPago, 40), activo: p.activo !== false, notas: txt(p.notas, 300) };
}

// ---------------------------------------------------------------- precios con historial
export function precioVigente(versiones = [], fecha) {
  return versiones.filter((v) => v.desde <= fecha && (!v.hasta || v.hasta >= fecha)).sort((a, b) => b.desde.localeCompare(a.desde))[0] || null;
}
// Nueva versión de precio: la anterior se CIERRA el día antes; nunca se edita su precio.
export function planNuevoPrecio(versiones = [], { precioHnl, desde }) {
  const precio = r2(precioHnl);
  if (!(precio > 0)) throw errUsuario("Escriba el precio de venta en Lempiras (mayor que 0).");
  if (!ymdOk(desde)) throw errUsuario("Fecha desde inválida.");
  if (versiones.some((v) => v.desde >= desde)) throw errUsuario("Ya hay un precio con esa fecha o posterior. Use una fecha más nueva.");
  const abiertas = versiones.filter((v) => !v.hasta || v.hasta >= desde);
  return { cerrar: abiertas.map((v) => ({ id: v.id, hasta: diaAnterior(desde) })), nueva: { precioHnl: precio, desde, hasta: null } };
}
// Términos del proveedor: cambiar el costo de referencia agrega una versión (los lotes guardan su propio costo).
export function agregarTermino(terminos = [], t = {}, hoy) {
  const productoId = String(t.productoId || ""); if (!productoId) throw errUsuario("Elija el producto del término.");
  const costo = r6(t.costoRef); if (!(costo >= 0)) throw errUsuario("Costo de referencia inválido.");
  const desde = ymdOk(t.desde) ? t.desde : hoy;
  const previos = terminos.map((x) => (x.productoId === productoId && !x.hasta ? { ...x, hasta: diaAnterior(desde) < x.desde ? x.desde : diaAnterior(desde) } : x));
  return [...previos, { productoId, costoRef: costo, moneda: MONEDAS.includes(t.moneda) ? t.moneda : "USDT", cantidad: Math.max(1, Math.round(Number(t.cantidad) || 1)), minimo: Math.max(0, Math.round(Number(t.minimo) || 0)), nota: txt(t.nota, 160), desde, hasta: null }];
}

// ---------------------------------------------------------------- Binance (USDT) · costo promedio ponderado
export function estadoBilleteraVacio() { return { id: BINANCE_ID, nombre: "Binance", moneda: "USDT", saldo: 0, valorHnl: 0, costoPromedio: 0, ultimaTasa: 0, recargas: 0 }; }
export function aplicarRecarga(est = estadoBilleteraVacio(), { hnl, usdt }) {
  const h = r2(hnl), u = r6(usdt);
  if (!(h > 0)) throw errUsuario("Escriba los Lempiras que salieron del banco.");
  if (!(u > 0)) throw errUsuario("Escriba los USDT que recibió en Binance.");
  const tasa = r6(h / u);
  const saldo = r6((est.saldo || 0) + u), valorHnl = r2((est.valorHnl || 0) + h);
  return { estado: { ...est, saldo, valorHnl, costoPromedio: saldo > 0 ? r6(valorHnl / saldo) : 0, ultimaTasa: tasa, recargas: (est.recargas || 0) + 1 }, tasa, hnl: h, usdt: u };
}
// Salida de USDT (pago a proveedor, Fase 2): sale al costo promedio actual; el promedio NO cambia.
export function aplicarSalida(est = estadoBilleteraVacio(), usdt) {
  const u = r6(usdt);
  if (!(u > 0)) throw errUsuario("Monto USDT inválido.");
  if (u > (est.saldo || 0) + 1e-6) throw errUsuario(`Saldo insuficiente en Binance: tiene ${r6(est.saldo)} USDT.`);
  const costoHnl = r2(u * (est.costoPromedio || 0));
  const saldo = r6(est.saldo - u);
  return { estado: { ...est, saldo, valorHnl: saldo > 0 ? r2(est.valorHnl - costoHnl) : 0, costoPromedio: saldo > 0 ? est.costoPromedio : 0 }, costoHnl, usdt: u };
}
// Ajuste a saldo real: la diferencia se valora al costo promedio (o a la última tasa si no hay saldo).
export function aplicarAjuste(est = estadoBilleteraVacio(), saldoCorrecto) {
  const nuevo = r6(saldoCorrecto);
  if (!(nuevo >= 0)) throw errUsuario("Escriba el saldo correcto en USDT (0 o más).");
  const delta = r6(nuevo - (est.saldo || 0));
  if (!delta) throw errUsuario("El saldo ya es ese. No hay nada que ajustar.");
  const tasa = est.costoPromedio || est.ultimaTasa || 0;
  const deltaHnl = r2(delta * tasa);
  const valorHnl = nuevo > 0 ? r2((est.valorHnl || 0) + deltaHnl) : 0;
  return { estado: { ...est, saldo: nuevo, valorHnl, costoPromedio: nuevo > 0 && valorHnl > 0 ? r6(valorHnl / nuevo) : (nuevo > 0 ? tasa : 0) }, delta, deltaHnl };
}

// ---------------------------------------------------------------- semilla: datos del PDF (08/10/2026)
// Precios con rango en el PDF (ej. L70–80) se cargan con el valor alto y la nota del rango: se editan con "Cambiar precio".
const P = (sku, nombre, categoria, modelo, extra = {}) => ({ sku, nombre, categoria, modelo, ...extra });
export const SEMILLA = Object.freeze({
  productos: [
    P("NFX-VIP", "Netflix VIP", "perfiles", "unidad", { plataformaKey: "vipnetflix", duracionDias: 30, capacidad: 1, costoRef: { monto: 2.5, moneda: "USDT", cantidad: 1, nota: "Deku Perú 2.50; Trap Colombia 25+ a 2.50; otras 2.70" }, notas: "Miembro extra individual, 1 persona." }),
    P("NFX-PREM", "Netflix Premium propio", "perfiles", "cuenta_madre", { plataformaKey: "netflix", duracionDias: 30, capacidad: 7, costoRef: { monto: 377, moneda: "HNL", cantidad: 1, nota: "Tarjeta: base L237 + 2 extras de L70" }, requierePin: true, notas: "5 perfiles compartidos + 2 miembros extra." }),
    P("PRIME", "Prime Video", "perfiles", "gift_card", { plataformaKey: "primevideo", duracionDias: 90, capacidad: 5, costoRef: { monto: 12.9, moneda: "USD", cantidad: 1, nota: "Eneba aprox. USD 12.90–13; usar cargo real de tarjeta en HNL" }, requierePin: true, notas: "3 meses, 5 perfiles." }),
    P("HBO-LINK", "HBO links", "perfiles", "link", { plataformaKey: "hbomax", duracionDias: 0, capacidad: 1, costoRef: { monto: 0, moneda: "USDT", cantidad: 1, nota: "Costo y duración variables: registrar lote y vigencia real" } }),
    P("HBO-PLAT", "HBO Platinum", "perfiles", "cuenta_madre", { plataformaKey: "hbomax", duracionDias: 365, capacidad: 5, costoRef: { monto: 3.5, moneda: "USDT", cantidad: 1, nota: "Binance, por cuenta" }, requierePin: true, notas: "1 año; 5 perfiles." }),
    P("DIS-PREM", "Disney Premium (link)", "perfiles", "link", { plataformaKey: "disneyp", duracionDias: 30, capacidad: 1, costoRef: { monto: 8.5, moneda: "USDT", cantidad: 1, nota: "Link 8.00–8.50 USDT; dura 1, 2 o 3 meses" } }),
    P("PARAMOUNT", "Paramount+", "perfiles", "cuenta_madre", { plataformaKey: "paramount", duracionDias: 30, capacidad: 4, costoRef: { monto: 150, moneda: "HNL", cantidad: 1, nota: "L150/mes" } }),
    P("CRUNCHY", "Crunchyroll", "perfiles", "cuenta_madre", { plataformaKey: "crunchyroll", duracionDias: 365, capacidad: 4, costoRef: { monto: 450, moneda: "HNL", cantidad: 1, nota: "L450/año, tarjeta" }, requierePin: true }),
    P("VIX", "Vix", "perfiles", "costo_cero", { plataformaKey: "vix", duracionDias: 30, capacidad: 1, notas: "Costo directo L0: margen bruto 100%; los gastos generales van aparte." }),
    P("LION", "Lion TV", "tv_digital", "creditos", { plataformaKey: "liontv", duracionDias: 30, capacidad: 1, costoRef: { monto: 7500, moneda: "HNL", cantidad: 100, nota: "L7,500 por 100 créditos" }, notas: "1 crédito activa 1–3 pantallas." }),
    P("OLEADA-1", "Oleada 1 dispositivo", "tv_digital", "creditos", { plataformaKey: "oleada", duracionDias: 30, capacidad: 1, costoRef: { monto: 18, moneda: "USDT", cantidad: 20, nota: "20 créditos por 18 USDT" }, notas: "1 crédito = 1 acceso." }),
    P("OLEADA-3", "Oleada 3 dispositivos", "tv_digital", "creditos", { plataformaKey: "oleada", duracionDias: 30, capacidad: 1, costoRef: { monto: 35, moneda: "USDT", cantidad: 20, nota: "20 créditos por 35 USDT" }, notas: "1 crédito = plan 3 accesos." }),
    P("STELLA", "Stella TV", "tv_digital", "creditos", { plataformaKey: "stellatv", duracionDias: 30, capacidad: 1, costoRef: { monto: 37.5, moneda: "USDT", cantidad: 15, nota: "15 créditos por 37.50 USDT" }, notas: "1 crédito activa hasta 3 dispositivos." }),
    P("LATINTV", "LatinTV", "tv_digital", "creditos", { plataformaKey: "latintv", duracionDias: 30, capacidad: 1, costoRef: { monto: 200, moneda: "USDT", cantidad: 200, nota: "Último lote: 200 USDT por 200 créditos" }, notas: "1 crédito activa hasta 4 dispositivos; tarifario 1–4 pantallas editable." }),
    P("MAXPLAYER", "MaxPlayer", "tv_digital", "creditos", { plataformaKey: "maxplayer", duracionDias: 365, capacidad: 1, costoRef: { monto: 83, moneda: "HNL", cantidad: 5, nota: "5 créditos por L83" }, notas: "Reproductor IPTV; 1 crédito por licencia. Costo separado del servicio IPTV." }),
    P("SPOTIFY-FAM", "Spotify Familiar", "musica", "cuenta_madre", { plataformaKey: "spotify", duracionDias: 30, capacidad: 5, costoRef: { monto: 320, moneda: "HNL", cantidad: 1, nota: "L320/mes" }, notas: "5 invitaciones." }),
    P("YOUTUBE", "YouTube Premium (link)", "musica", "link", { plataformaKey: "youtube", duracionDias: 90, capacidad: 1, costoRef: { monto: 85, moneda: "HNL", cantidad: 1, nota: "Link de 3 meses L85" } }),
    P("CANVA", "Canva", "software", "panel", { plataformaKey: "canva", duracionDias: 1095, capacidad: 500, costoRef: { monto: 25, moneda: "USDT", cantidad: 1, nota: "Panel 25 USDT por 500 accesos, 3 años" } }),
    P("GEMINI", "Gemini Pro (link)", "software", "link", { plataformaKey: "gemini", duracionDias: 540, capacidad: 1, costoRef: { monto: 1.4, moneda: "USDT", cantidad: 1, nota: "Link 1.40 USDT; activa al Gmail del cliente; 18 meses" } }),
    P("DUOLINGO", "Duolingo", "software", "panel", { plataformaKey: "duolingo", duracionDias: 365, capacidad: 6, costoRef: { monto: 10, moneda: "USDT", cantidad: 1, nota: "Panel familiar 10 USDT/año" }, notas: "Capacidad del panel configurable (puesta en 6)." }),
    P("OFFICE365", "Office 365", "software", "unidad", { plataformaKey: "office", duracionDias: 365, capacidad: 1, costoRef: { monto: 6.9, moneda: "USDT", cantidad: 1, nota: "6.90 USDT por licencia, Binance" } }),
  ],
  // [sku, nombre, meses, dispositivos, consumo, precioHnl|null, nota]
  variantes: [
    ["NFX-VIP", "1 mes · 1 persona", 1, 1, 1, null, "Precio no indicado en el PDF"],
    ["NFX-PREM", "Perfil 1 mes", 1, 1, 1, 130, ""],
    ["NFX-PREM", "Miembro extra 1 mes", 1, 1, 1, null, "Precio no indicado en el PDF"],
    ["PRIME", "Perfil 1 mes", 1, 1, 1, 80, "Rango L70–80"],
    ["HBO-LINK", "Link", 1, 1, 1, null, "Precio no indicado en el PDF"],
    ["HBO-PLAT", "Perfil 1 mes", 1, 1, 1, 80, ""],
    ["DIS-PREM", "Link", 1, 1, 1, null, "Precio no indicado en el PDF"],
    ["PARAMOUNT", "Perfil 1 mes", 1, 1, 1, 80, ""],
    ["CRUNCHY", "Perfil 1 mes", 1, 1, 1, 80, "Rango L70–80"],
    ["VIX", "1 mes", 1, 1, 1, null, "Precio no indicado en el PDF"],
    ["LION", "1 mes · 1 pantalla", 1, 1, 1, 250, ""],
    ["LION", "1 mes · 2 pantallas", 1, 2, 1, 275, ""],
    ["LION", "1 mes · 3 pantallas", 1, 3, 1, 300, ""],
    ["OLEADA-1", "1 mes · 1 dispositivo", 1, 1, 1, 90, ""],
    ["OLEADA-3", "1 mes · 3 dispositivos", 1, 3, 1, 200, ""],
    ["STELLA", "1 mes · 1 dispositivo", 1, 1, 1, 130, ""],
    ["STELLA", "1 mes · 2 dispositivos", 1, 2, 1, 170, ""],
    ["STELLA", "1 mes · 3 dispositivos", 1, 3, 1, 200, ""],
    ["LATINTV", "1 mes · 1 pantalla", 1, 1, 1, null, "Tarifario 1–4 pantallas por definir"],
    ["LATINTV", "1 mes · 2 pantallas", 1, 2, 1, null, ""],
    ["LATINTV", "1 mes · 3 pantallas", 1, 3, 1, null, ""],
    ["LATINTV", "1 mes · 4 pantallas", 1, 4, 1, null, ""],
    ["MAXPLAYER", "Licencia", 12, 1, 1, null, "Precio no indicado en el PDF"],
    ["SPOTIFY-FAM", "Invitación 1 mes", 1, 1, 1, 110, "Rango L100–110"],
    ["YOUTUBE", "Link 3 meses", 3, 1, 1, 300, ""],
    ["CANVA", "1 mes", 1, 1, 1, 50, "Planes flexibles; desde L50/mes"],
    ["GEMINI", "1 mes", 1, 1, 1, 150, ""],
    ["DUOLINGO", "1 mes", 1, 1, 1, 80, ""],
    ["OFFICE365", "1 año", 12, 1, 1, 300, ""],
  ],
  proveedores: [
    { alias: "Deku Perú", pais: "Perú", moneda: "USDT", metodoPago: "Binance", terminos: [{ productoId: "NFX-VIP", costoRef: 2.5, moneda: "USDT", nota: "" }] },
    { alias: "Trap Colombia", pais: "Colombia", moneda: "USDT", metodoPago: "Binance", terminos: [{ productoId: "NFX-VIP", costoRef: 2.5, moneda: "USDT", minimo: 25, nota: "25 o más a 2.50; otras compras 2.70" }] },
    { alias: "Eneba", pais: "Internacional", moneda: "USD", metodoPago: "Tarjeta", terminos: [{ productoId: "PRIME", costoRef: 12.9, moneda: "USD", nota: "Gift card; usar cargo real de tarjeta en HNL" }] },
    { alias: "Pago directo (tarjeta)", pais: "Honduras", moneda: "HNL", metodoPago: "Tarjeta", terminos: [
      { productoId: "NFX-PREM", costoRef: 377, moneda: "HNL", nota: "Base L237 + 2 extras de L70" }, { productoId: "PARAMOUNT", costoRef: 150, moneda: "HNL" },
      { productoId: "CRUNCHY", costoRef: 450, moneda: "HNL", nota: "Anual" }, { productoId: "SPOTIFY-FAM", costoRef: 320, moneda: "HNL" }] },
  ],
});
export const PRECIOS_DESDE_SEMILLA = "2026-10-01";
export const varianteIdDe = (sku, nombre) => `${sku}__${slug(nombre)}`;

// ---------------------------------------------------------------- manejador /api/finanzas
export const ACCIONES_EMPRESA = Object.freeze(["fin_empresa_estado", "fin_sembrar_catalogo", "fin_producto_guardar", "fin_variante_guardar", "fin_precio_nuevo", "fin_proveedor_guardar", "fin_proveedor_termino", "fin_binance_recargar", "fin_binance_ajustar"]);

export async function handleEmpresa(db, accion, body, identity, authUser, res, d) {
  if (!d.canUseLibro(identity)) return res.status(403).json({ ok: false, error: "Finanzas empresarial es exclusivo de Sublicuentas y Relojes." });
  const hoy = d.hoyYmdHN(), ahora = new Date().toISOString(), actor = identity.usuario;
  const run = (fn) => db.runTransaction(fn).catch((e) => { if (e.userError) return { error: e.message }; throw e; });
  const reply = (r) => res.status(200).json(r && r.error ? { ok: false, error: r.error } : { ok: true, accion, ...r });
  const col = (c) => db.collection(c);
  const todos = async (c) => { const s = await col(c).get(); return s.docs.map((x) => ({ id: x.id, ...(x.data() || {}) })); };
  const audit = (tx, ev) => d.auditar(tx, db, identity, { origen: body.origen || "web", modulo: "finanzas_empresa", ...ev });
  const billeteraRef = col("fin_billeteras").doc(BINANCE_ID);

  if (accion === "fin_empresa_estado") {
    const [productos, variantes, precios, proveedores, bSnap] = await Promise.all([todos("fin_productos"), todos("fin_variantes"), todos("fin_precios"), todos("fin_proveedores"), billeteraRef.get()]);
    const movsSnap = await col("finanzas_movimientos").where("billeteraId", "==", BINANCE_ID).get().catch(() => ({ docs: [] }));
    const movsBinance = movsSnap.docs.map((x) => ({ id: x.id, ...(x.data() || {}) })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 60);
    const vars = variantes.map((v) => {
      const hist = precios.filter((p) => p.varianteId === v.id).sort((a, b) => b.desde.localeCompare(a.desde));
      return { ...v, precioVigente: precioVigente(hist, hoy), historialPrecios: hist };
    });
    return res.status(200).json({ ok: true, accion, hoy, modelos: MODELOS, categorias: CATEGORIAS_FIN, monedas: MONEDAS,
      productos: productos.sort((a, b) => a.nombre.localeCompare(b.nombre)).map((p) => ({ ...p, variantes: vars.filter((v) => v.productoId === p.id) })),
      proveedores: proveedores.sort((a, b) => a.alias.localeCompare(b.alias)),
      billetera: bSnap.exists ? { ...estadoBilleteraVacio(), ...bSnap.data() } : estadoBilleteraVacio(), movimientosBinance: movsBinance });
  }

  if (accion === "fin_sembrar_catalogo") { // idempotente: solo crea lo que falta; nunca pisa lo que el usuario ya editó
    const r = await run(async (tx) => {
      const refsP = SEMILLA.productos.map((p) => col("fin_productos").doc(p.sku));
      const refsV = SEMILLA.variantes.map(([sku, nombre]) => col("fin_variantes").doc(varianteIdDe(sku, nombre)));
      const refsS = SEMILLA.proveedores.map((p) => col("fin_proveedores").doc(slug(p.alias)));
      const [sP, sV, sS] = await Promise.all([Promise.all(refsP.map((x) => tx.get(x))), Promise.all(refsV.map((x) => tx.get(x))), Promise.all(refsS.map((x) => tx.get(x)))]);
      let productos = 0, variantes = 0, precios = 0, proveedores = 0;
      SEMILLA.productos.forEach((p, i) => { if (sP[i].exists) return; tx.set(refsP[i], { ...validarProducto(p), createdAt: ahora, updatedAt: ahora, createdBy: actor, origenSemilla: "pdf_2026-10-08" }); productos++; });
      SEMILLA.variantes.forEach(([sku, nombre, meses, disp, consumo, precio, nota], i) => {
        if (sV[i].exists) return;
        tx.set(refsV[i], { ...validarVariante({ nombre, duracionMeses: meses, dispositivos: disp, consumo, notas: nota }, { sku }), createdAt: ahora, updatedAt: ahora, createdBy: actor }); variantes++;
        if (precio) { tx.set(col("fin_precios").doc(`${refsV[i].id}__${PRECIOS_DESDE_SEMILLA}`), { varianteId: refsV[i].id, productoId: sku, precioHnl: precio, desde: PRECIOS_DESDE_SEMILLA, hasta: null, canal: "general", nota, createdBy: actor, createdAt: ahora }); precios++; }
      });
      SEMILLA.proveedores.forEach((p, i) => { if (sS[i].exists) return; tx.set(refsS[i], { ...validarProveedor(p), terminos: p.terminos.reduce((acc, t) => agregarTermino(acc, { ...t, desde: PRECIOS_DESDE_SEMILLA }, hoy), []), createdAt: ahora, updatedAt: ahora, createdBy: actor }); proveedores++; });
      audit(tx, { accion: "sembrar_catalogo", targetType: "catalogo_financiero", detalle: `Catálogo del PDF: ${productos} productos, ${variantes} variantes, ${precios} precios, ${proveedores} proveedores` });
      return { productos, variantes, precios, proveedores };
    });
    return reply(r);
  }

  if (accion === "fin_producto_guardar") {
    const r = await run(async (tx) => {
      const p = validarProducto(body.producto || {});
      const ref = col("fin_productos").doc(String(body.producto?.id || p.sku));
      const snap = await tx.get(ref);
      if (!body.producto?.id && snap.exists) throw errUsuario(`Ya existe un producto con el código ${p.sku}.`);
      const antes = snap.exists ? snap.data() : null;
      tx.set(ref, { ...p, sku: ref.id, updatedAt: ahora, ...(snap.exists ? {} : { createdAt: ahora, createdBy: actor }) }, { merge: true });
      audit(tx, { accion: snap.exists ? "editar_producto" : "crear_producto", targetType: "producto", targetId: ref.id, before: antes ? { nombre: antes.nombre, modelo: antes.modelo, capacidad: antes.capacidad, costoRef: antes.costoRef, activo: antes.activo } : null, after: { nombre: p.nombre, modelo: p.modelo, capacidad: p.capacidad, costoRef: p.costoRef, activo: p.activo }, motivo: txt(body.motivo, 200) });
      return { productoId: ref.id };
    });
    return reply(r);
  }

  if (accion === "fin_variante_guardar") {
    const r = await run(async (tx) => {
      const prodRef = col("fin_productos").doc(String(body.variante?.productoId || ""));
      const prod = await tx.get(prodRef); if (!prod.exists) throw errUsuario("Producto no encontrado.");
      const v = validarVariante(body.variante || {}, { sku: prodRef.id });
      const ref = col("fin_variantes").doc(String(body.variante?.id || varianteIdDe(prodRef.id, v.nombre)));
      const snap = await tx.get(ref);
      if (!body.variante?.id && snap.exists) throw errUsuario("Ya existe una variante con ese nombre en este producto.");
      tx.set(ref, { ...v, updatedAt: ahora, ...(snap.exists ? {} : { createdAt: ahora, createdBy: actor }) }, { merge: true });
      audit(tx, { accion: snap.exists ? "editar_variante" : "crear_variante", targetType: "variante", targetId: ref.id, after: v });
      return { varianteId: ref.id };
    });
    return reply(r);
  }

  if (accion === "fin_precio_nuevo") { // nunca se edita una versión: se cierra la vigente y se crea otra
    const varianteId = String(body.varianteId || "");
    const desde = ymdOk(body.desde) ? body.desde : hoy;
    const versSnap = await col("fin_precios").where("varianteId", "==", varianteId).get();
    const versiones = versSnap.docs.map((x) => ({ id: x.id, ...(x.data() || {}) }));
    const r = await run(async (tx) => {
      const vRef = col("fin_variantes").doc(varianteId); const v = await tx.get(vRef);
      if (!v.exists) throw errUsuario("Variante no encontrada.");
      const plan = planNuevoPrecio(versiones, { precioHnl: body.precioHnl, desde });
      const antes = precioVigente(versiones, desde);
      plan.cerrar.forEach((c) => tx.set(col("fin_precios").doc(c.id), { hasta: c.hasta, cerradoPor: actor, cerradoAt: ahora }, { merge: true }));
      const ref = col("fin_precios").doc(`${varianteId}__${desde}`);
      tx.set(ref, { ...plan.nueva, varianteId, productoId: v.data().productoId, canal: "general", nota: txt(body.motivo, 160), createdBy: actor, createdAt: ahora });
      audit(tx, { accion: "cambiar_precio", targetType: "variante", targetId: varianteId, before: { precioHnl: antes?.precioHnl ?? null }, after: { precioHnl: plan.nueva.precioHnl, desde }, motivo: txt(body.motivo, 200), detalle: `${v.data().nombre}: L${antes?.precioHnl ?? "—"} → L${plan.nueva.precioHnl} desde ${desde}` });
      return { precioId: ref.id, cerradas: plan.cerrar.length };
    });
    return reply(r);
  }

  if (accion === "fin_proveedor_guardar") {
    const r = await run(async (tx) => {
      const p = validarProveedor(body.proveedor || {});
      const ref = col("fin_proveedores").doc(String(body.proveedor?.id || slug(p.alias)));
      const snap = await tx.get(ref);
      if (!body.proveedor?.id && snap.exists) throw errUsuario("Ya existe un proveedor con ese nombre.");
      tx.set(ref, { ...p, updatedAt: ahora, ...(snap.exists ? {} : { createdAt: ahora, createdBy: actor, terminos: [] }) }, { merge: true });
      audit(tx, { accion: snap.exists ? "editar_proveedor" : "crear_proveedor", targetType: "proveedor", targetId: ref.id, after: p });
      return { proveedorId: ref.id };
    });
    return reply(r);
  }

  if (accion === "fin_proveedor_termino") { // costo de referencia nuevo = versión nueva; lo viejo queda con "hasta"
    const r = await run(async (tx) => {
      const ref = col("fin_proveedores").doc(String(body.proveedorId || ""));
      const snap = await tx.get(ref); if (!snap.exists) throw errUsuario("Proveedor no encontrado.");
      const prod = await tx.get(col("fin_productos").doc(String(body.termino?.productoId || ""))); if (!prod.exists) throw errUsuario("Producto no encontrado.");
      const terminos = agregarTermino(snap.data().terminos || [], body.termino || {}, hoy);
      tx.set(ref, { terminos, updatedAt: ahora }, { merge: true });
      const t = terminos[terminos.length - 1];
      audit(tx, { accion: "costo_referencia_proveedor", targetType: "proveedor", targetId: ref.id, after: t, detalle: `${snap.data().alias} · ${prod.data().nombre}: ${t.costoRef} ${t.moneda} desde ${t.desde}` });
      return { proveedorId: ref.id, terminos: terminos.length };
    });
    return reply(r);
  }

  if (accion === "fin_binance_recargar") { // Prueba A: BAC −L2,820 · Binance +100 USDT · gasto L0 · tasa 28.20
    const methods = await d.loadMethods(db);
    const banco = methods.find((m) => m.id === String(body.bancoId || ""));
    if (!banco) return res.status(200).json({ ok: false, error: "Elija el banco de donde salieron los Lempiras." });
    const opId = d.libroOpDocId("binrec", body, authUser.uid);
    if (!opId) return res.status(200).json({ ok: false, error: "Falta operationId (actualice la app)." });
    const fecha = ymdOk(body.fecha) && body.fecha <= hoy ? body.fecha : hoy;
    const refOut = col("finanzas_movimientos").doc(opId), refIn = col("finanzas_movimientos").doc(`${opId}_usdt`);
    const r = await run(async (tx) => {
      if ((await tx.get(refOut)).exists) return { duplicado: true };
      const bSnap = await tx.get(billeteraRef);
      const { saldos } = await d.estadoLibro(db, tx);
      const est = bSnap.exists ? { ...estadoBilleteraVacio(), ...bSnap.data() } : estadoBilleteraVacio();
      const rec = aplicarRecarga(est, { hnl: body.hnl, usdt: body.usdt });
      const b = saldos.bancos.find((x) => x.id === banco.id);
      if (b && rec.hnl > b.saldo + 0.001 && !body.forzar) throw errUsuario(`Saldo insuficiente en ${banco.nombre} según el libro (Lps. ${b.saldo}). Si el banco sí lo tiene, revise movimientos pendientes.`);
      const comun = { ...d.baseMov(identity, authUser, body), operationId: String(body.operationId), transferenciaId: refOut.id, referencia: txt(body.referencia, 80), nota: txt(body.nota, 160), ...d.canonicalFinanceDate(fecha, hoy) };
      // Lado banco: TRANSFERENCIA de salida (no es gasto). Cierres, cuadre y saldos la tratan como hoy.
      tx.set(refOut, { ...comun, movimientoId: refOut.id, tipo: "transferencia", subtipo: "recarga_binance", direccion: "salida", monto: rec.hnl, bancoId: banco.id, banco: banco.nombre, contraparteId: BINANCE_ID, montoUsdt: rec.usdt, tasa: rec.tasa });
      // Lado Binance: movimiento de BILLETERA en USDT con su valor contable en Lempiras.
      tx.set(refIn, { ...comun, movimientoId: refIn.id, tipo: "billetera", subtipo: "recarga", direccion: "entrada", billeteraId: BINANCE_ID, moneda: "USDT", montoUsdt: rec.usdt, monto: rec.hnl, tasa: rec.tasa, contraparteId: banco.id, banco: "Binance", saldoUsdtAntes: est.saldo, saldoUsdtDespues: rec.estado.saldo, costoPromedioDespues: rec.estado.costoPromedio });
      tx.set(billeteraRef, { ...rec.estado, updatedAt: ahora });
      audit(tx, { accion: "recarga_binance", targetType: "billetera", targetId: BINANCE_ID, movimientoId: refOut.id, operationId: String(body.operationId), monto: rec.hnl, detalle: `${banco.nombre} −Lps. ${rec.hnl} → Binance +${rec.usdt} USDT · tasa ${rec.tasa}`, before: { saldoUsdt: est.saldo, valorHnl: est.valorHnl }, after: { saldoUsdt: rec.estado.saldo, valorHnl: rec.estado.valorHnl, costoPromedio: rec.estado.costoPromedio } });
      return { duplicado: false, tasa: rec.tasa, billetera: rec.estado, movimientoId: refOut.id };
    });
    return reply(r);
  }

  if (accion === "fin_binance_ajustar") { // solo con motivo; queda en auditoría; no toca el historial
    const motivo = txt(body.motivo, 200);
    if (motivo.length < 4) return res.status(200).json({ ok: false, error: "Escriba el motivo del ajuste." });
    const opId = d.libroOpDocId("binaju", body, authUser.uid);
    if (!opId) return res.status(200).json({ ok: false, error: "Falta operationId (actualice la app)." });
    const ref = col("finanzas_movimientos").doc(opId);
    const r = await run(async (tx) => {
      if ((await tx.get(ref)).exists) return { duplicado: true };
      const bSnap = await tx.get(billeteraRef);
      const est = bSnap.exists ? { ...estadoBilleteraVacio(), ...bSnap.data() } : estadoBilleteraVacio();
      const aj = aplicarAjuste(est, body.saldoCorrecto);
      tx.set(ref, { ...d.baseMov(identity, authUser, body), movimientoId: ref.id, operationId: String(body.operationId), tipo: "billetera", subtipo: "ajuste", direccion: aj.delta > 0 ? "entrada" : "salida", billeteraId: BINANCE_ID, moneda: "USDT", montoUsdt: aj.delta, monto: aj.deltaHnl, banco: "Binance", motivo, saldoUsdtAntes: est.saldo, saldoUsdtDespues: aj.estado.saldo, ...d.canonicalFinanceDate(hoy, hoy) });
      tx.set(billeteraRef, { ...aj.estado, updatedAt: ahora });
      audit(tx, { accion: "ajuste_binance", targetType: "billetera", targetId: BINANCE_ID, movimientoId: ref.id, motivo, monto: aj.deltaHnl, before: { saldoUsdt: est.saldo, valorHnl: est.valorHnl }, after: { saldoUsdt: aj.estado.saldo, valorHnl: aj.estado.valorHnl }, detalle: `Binance ${est.saldo} → ${aj.estado.saldo} USDT (${aj.delta > 0 ? "+" : ""}${aj.delta})` });
      return { duplicado: false, billetera: aj.estado, delta: aj.delta, deltaHnl: aj.deltaHnl };
    });
    return reply(r);
  }
  return null;
}
