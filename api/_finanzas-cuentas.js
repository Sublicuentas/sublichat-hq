// api/_finanzas-cuentas.js · R196z — Finanzas › Compras: cuentas madre leídas AUTOMÁTICAMENTE de Control Maestro.
// PDF «Finanzas: reparar registro de compras y cargar cuentas automáticamente» (16/11/2026).
// · Control Maestro (colección `inventario`) es la fuente operativa: aquí SOLO se lee (correo, plan, ocupados, capacidad).
//   Nunca se escriben correos, claves, capacidad, asignaciones, precios de venta, vencimientos ni clientes.
// · Clave de vínculo = id interno de la cuenta (no el correo). Una cuenta con 5 perfiles = UNA cuenta de proveedor.
// · Lo financiero va en `fin_cuentas_costo/{cuentaId}` (modalidad, moneda, frecuencia, tarjeta mínima) y cada pago real es
//   UNA compra (`fin_lotes`, vía fin_compra_registrar, con `cuentaInventarioId`). Sin compra = «Costo pendiente de
//   configurar», nunca L0 ni compra ficticia. Sincronizar NO crea compras, ventas ni ingresos.
"use strict";

// R200g (23/11/2026) · Todas las plataformas aceptan tarjeta, gift card y link/activación (más PayPal/Binance donde aplica),
// con historial de pagos. + Disney Premium, Disney Standard (sin ESPN) y Viki Rakuten. Las monedas en USD se convierten
// a Lempiras con la tasa de venta de BAC Honduras del día (editable: si el banco cobró otro monto, se escribe el real).
const TODAS_MOD = ["tarjeta", "gift_card", "link", "binance", "paypal", "otro"];
const PLATAFORMAS = Object.freeze({
  netflix: { id: "netflix", nombre: "Netflix Premium", monedas: ["USD", "HNL", "USDT"], modalidades: TODAS_MOD, frecuencias: ["mensual", "puntual"], defecto: { modalidad: "tarjeta", moneda: "USD", frecuencia: "mensual" } },
  paramount: { id: "paramount", nombre: "Paramount+", monedas: ["HNL", "USD", "USDT"], modalidades: TODAS_MOD, frecuencias: ["mensual", "puntual"], defecto: { modalidad: "tarjeta", moneda: "HNL", frecuencia: "mensual" } },
  crunchyroll: { id: "crunchyroll", nombre: "Crunchyroll", monedas: ["PHP", "HNL", "USD", "USDT"], modalidades: TODAS_MOD, frecuencias: ["mensual", "anual", "puntual"], defecto: { modalidad: "tarjeta", moneda: "PHP", frecuencia: "mensual" } },
  primevideo: { id: "primevideo", nombre: "Prime Video", monedas: ["USD", "HNL"], modalidades: TODAS_MOD.filter((m) => m !== "binance"), frecuencias: ["trimestral", "mensual", "puntual"], defecto: { modalidad: "tarjeta", moneda: "USD", frecuencia: "trimestral" } }, // USD, NO USDT
  hbomax: { id: "hbomax", nombre: "HBO Max", monedas: ["USDT", "USD", "HNL"], modalidades: TODAS_MOD, frecuencias: ["puntual", "mensual"], defecto: { modalidad: "binance", moneda: "USDT", frecuencia: "puntual" } },
  disneyp: { id: "disneyp", nombre: "Disney Premium", monedas: ["USDT", "USD", "HNL"], modalidades: TODAS_MOD, frecuencias: ["mensual", "trimestral", "puntual"], defecto: { modalidad: "link", moneda: "USDT", frecuencia: "mensual" } }, // generalmente por link
  disneys: { id: "disneys", nombre: "Disney Standard", monedas: ["USDT", "USD", "HNL"], modalidades: TODAS_MOD, frecuencias: ["mensual", "trimestral", "puntual"], defecto: { modalidad: "link", moneda: "USDT", frecuencia: "mensual" } },
  viki: { id: "viki", nombre: "Viki Rakuten", monedas: ["USD", "HNL", "USDT"], modalidades: TODAS_MOD, frecuencias: ["mensual", "anual", "puntual"], defecto: { modalidad: "tarjeta", moneda: "USD", frecuencia: "mensual" } },
});
const MODALIDADES = Object.freeze({ tarjeta: "Tarjeta bancaria", gift_card: "Saldo / gift card", link: "Link / activación", binance: "Activación USDT · Binance", paypal: "PayPal", otro: "Otro método" });
const FRECUENCIAS = Object.freeze({ mensual: { label: "Mensual", dias: 30 }, trimestral: { label: "Cada 3 meses", dias: 90 }, anual: { label: "Anual", dias: 365 }, puntual: { label: "Por activación / puntual", dias: 0 } });

const norm = (v = "") => String(v || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
// Plataforma de la cuenta de Control Maestro → clave de Finanzas. Netflix VIP (extras) NO es cuenta madre: queda fuera.
function plataformaDe(p) {
  const t = norm(p);
  if (!t || /vip/.test(t)) return "";
  if (/^netflix/.test(t)) return "netflix";
  if (/^paramount/.test(t)) return "paramount";
  if (/^crunchy/.test(t)) return "crunchyroll";
  if (/^(primevideo|prime|amazon)/.test(t)) return "primevideo";
  if (/^(hbo|max$)/.test(t)) return "hbomax";
  if (/^disney/.test(t)) return /^disneys$|sinespn|standard|estandar/.test(t) ? "disneys" : "disneyp"; // R200g
  if (/^(viki|rakuten)/.test(t)) return "viki";
  return "";
}
const ocupadosDe = (d = {}) => Math.max(Number(d.ocupados || 0) || 0, Array.isArray(d.clientes) ? d.clientes.length : 0);
const activa = (d = {}) => String(d.estado || "activa") !== "eliminada" && d.eliminado !== true && d.archivada !== true;
function sumarDias(ymd, dias) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || "")) || !(dias > 0)) return ""; const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + dias, 12)).toISOString().slice(0, 10); }
function planDe(d = {}, plat) {
  if (plat === "hbomax") { const p = String(d.planHbo || "").toLowerCase(); return p === "platinum" ? "Platinum · 5 perfiles" : p === "standard" ? "Standard · 3 perfiles" : "Plan sin definir"; }
  return String(d.plan || d.tipoCuenta || d.nombrePlan || "").slice(0, 40);
}

// Fila de Finanzas para UNA cuenta madre. `lotes` = compras reales ya vinculadas a esa cuenta (más reciente primero).
function filaCuenta(c, cfg = null, lotes = [], tarjeta = null, hoy = "") {
  const plat = plataformaDe(c.plataforma); const P = PLATAFORMAS[plat] || {};
  const ult = lotes[0] || null;
  const frecuencia = (cfg && cfg.frecuencia) || (P.defecto || {}).frecuencia || "mensual";
  const dias = ult && Number(ult.duracionDias) > 0 ? Number(ult.duracionDias) : FRECUENCIAS[frecuencia]?.dias || 0;
  const proximo = (cfg && cfg.proximoPago) || (ult ? ult.vigenciaHasta || sumarDias(ult.fecha, dias) : "");
  const en7 = sumarDias(hoy, 7);
  const conCosto = !!ult; // solo una compra real cuenta como costo; la configuración sola no es costo
  return {
    cuentaId: c.id, plataforma: plat, plataformaNombre: P.nombre || plat, correo: String(c.correo || c.email || "").trim().toLowerCase(), plan: planDe(c, plat),
    ocupados: ocupadosDe(c), capacidad: Math.max(1, Number(c.capacidad || c.perfilesTotales || 1) || 1), // solo consulta
    configurada: !!cfg, modalidad: (cfg && cfg.modalidad) || "", moneda: (cfg && cfg.moneda) || "", frecuencia: cfg ? frecuencia : "",
    tarjeta: tarjeta ? { id: tarjeta.id, banco: tarjeta.banco, titular: tarjeta.titular, ultimos4: tarjeta.ultimos4 } : null,
    costo: conCosto ? { fecha: ult.fecha, moneda: ult.moneda, montoMoneda: ult.costoTotalMoneda, costoHnl: ult.costoTotalHnl, tasa: ult.tasa, duracionDias: Number(ult.duracionDias) || 0, loteId: ult.id || ult.compraId } : null,
    estadoCosto: conCosto ? "con_costo" : "pendiente", compras: lotes.length, ultimaCompra: ult ? ult.fecha : "", proximoPago: proximo,
    pronto: !!(proximo && hoy && proximo <= en7), vencido: !!(proximo && hoy && proximo < hoy),
  };
}

// Valida y limpia la configuración financiera de UNA cuenta (nunca toca Control Maestro).
function limpiarConfig(plat, b = {}) {
  const P = PLATAFORMAS[plat]; if (!P) return { error: "Plataforma no administrada aquí." };
  const modalidad = P.modalidades.includes(b.modalidad) ? b.modalidad : null;
  const moneda = P.monedas.includes(b.moneda) ? b.moneda : null;
  const frecuencia = P.frecuencias.includes(b.frecuencia) ? b.frecuencia : null;
  if (!modalidad) return { error: `Elija cómo se paga (${P.modalidades.map((m) => MODALIDADES[m]).join(", ")}).` };
  if (!moneda) return { error: plat === "primevideo" && b.moneda === "USDT" ? "Prime Video se paga en USD (no USDT)." : `Moneda no válida para ${P.nombre}: ${P.monedas.join(", ")}.` };
  if (!frecuencia) return { error: `Frecuencia no válida para ${P.nombre}.` };
  const prox = b.proximoPago ? String(b.proximoPago) : "";
  if (prox && !/^\d{4}-\d{2}-\d{2}$/.test(prox)) return { error: "Fecha de próximo pago inválida." };
  return { config: { modalidad, moneda, frecuencia, proximoPago: prox, notas: String(b.notas || "").replace(/[<>]/g, "").slice(0, 200) } };
}

module.exports = { PLATAFORMAS, MODALIDADES, FRECUENCIAS, plataformaDe, filaCuenta, limpiarConfig, sumarDias, activa };
