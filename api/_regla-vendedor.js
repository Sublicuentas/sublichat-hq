// api/_regla-vendedor.js · R211 — Reglas EXCLUSIVAS por vendedor para la deuda «Pago pendiente por vendedor».
// MISMO ARCHIVO en Sublichat HQ (api/_regla-vendedor.js) y en el TG Bot (lib_regla_vendedor.js): una sola regla
// para APK, Web y bot. CommonJS a propósito (lo usan módulos ESM y CommonJS, igual que _vendedores.js).
//
// Geisell (orden de trabajo Rev02, 28/11/2026): cuando ELLA administra el dinero de una venta, a Sublicuentas le
// corresponde el 50 % UNA sola vez. Venta elegible L150 → deuda L75. Lo que ella entregue se descuenta completo de
// esa deuda (abono L50 → queda L25; L25 → L0), sin volver a dividir. Los demás vendedores conservan su lógica.
// Se identifica por la CLAVE ESTABLE del registro de vendedores (vendedores/{clave}; alias «geissel»), no por
// cómo esté escrito el nombre. Solo se aplica a deudas NUEVAS; los saldos viejos pasan por la vista previa.

const REGLAS = Object.freeze({
  geisell: Object.freeze({ porcentajeSublicuentas: 0.5, etiqueta: "Geisell · 50 % para Sublicuentas", desde: "2026-11-28" }),
});
const ALIAS = Object.freeze({ geissel: "geisell", geisel: "geisell", "geisell sublicuentas": "geisell" });

function claveVendedor(v) {
  const k = String(v == null ? "" : v).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  return ALIAS[k] || k;
}
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Regla aplicable (o null). Se busca primero por ID del vendedor y luego por su nombre registrado. */
function reglaDe(deudorTipo, vendedorId, vendedorNombre) {
  if (deudorTipo !== "vendedor") return null;
  for (const v of [vendedorId, vendedorNombre]) { const k = claveVendedor(v); if (REGLAS[k]) return { clave: k, ...REGLAS[k] }; }
  return null;
}

/**
 * Deuda que nace con el «Pago pendiente por vendedor».
 * saldo = lo que quedó en manos del vendedor (bruto). Devuelve la obligación con Sublicuentas.
 */
function obligacionVendedor({ deudorTipo, vendedorId = "", vendedorNombre = "", saldo }) {
  const base = r2(saldo), regla = reglaDe(deudorTipo, vendedorId, vendedorNombre);
  if (!regla || !(base > 0)) return { base, obligacion: base, regla: null };
  const obligacion = r2(base * regla.porcentajeSublicuentas);
  return { base, obligacion, regla: { clave: regla.clave, porcentaje: regla.porcentajeSublicuentas, base, obligacion, retenidoVendedor: r2(base - obligacion), etiqueta: regla.etiqueta } };
}

/** Campos que se guardan en la cuenta por cobrar (y la venta) cuando hay regla. Vacío si no aplica. */
function camposRegla(o) { return o && o.regla ? { reglaVendedor: o.regla, montoBaseVendedor: o.base, retenidoVendedor: o.regla.retenidoVendedor } : {}; }

module.exports = { REGLAS, claveVendedor, reglaDe, obligacionVendedor, camposRegla };
