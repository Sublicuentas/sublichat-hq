/* SUBLICUENTAS · Sorteos — utilidades compartidas para api/sorteos.js
   Misma lógica que ya usa el bot (index_14_sorteos.js: clean/norm/safeId/rules)
   para que los boletos y reglas queden sincronizados entre Telegram y Sublichat. */

const DEFAULT_RULES = Object.freeze({
  compra: 1, renovacion: 2, oro: 3, ciclosOro: 6, limitePorCliente: 30
});

export function sorteoClean(value, max = 300) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function sorteoNorm(value) {
  return sorteoClean(value, 160)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function sorteoSafeId(value) {
  return sorteoClean(value, 160).replace(/[^a-zA-Z0-9_-]/g, "");
}

export function sorteoFechaKey(value) {
  const raw = sorteoClean(value, 40);
  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const candidate = dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return "";
  const date = new Date(`${candidate}T12:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== candidate ? "" : candidate;
}

export function sorteoEventoId(raw = {}, tipo = "") {
  const compraId = sorteoSafeId(raw.compraId);
  if (compraId && tipo === "compra") return `compra:${compraId}`;
  const fecha = sorteoFechaKey(raw.fechaEvento);
  if (compraId && tipo === "renovacion" && fecha) return `renov:${compraId}:${fecha}`;
  return sorteoClean(raw.eventoId, 500);
}

function integer(value, min, max, fallback) {
  return Number.isFinite(Number(value))
    ? Math.max(min, Math.min(max, Math.round(Number(value))))
    : fallback;
}

export function reglasSorteo(raw = {}) {
  return {
    compra: integer(raw.compra, 0, 20, DEFAULT_RULES.compra),
    renovacion: integer(raw.renovacion, 0, 20, DEFAULT_RULES.renovacion),
    oro: integer(raw.oro, 0, 20, DEFAULT_RULES.oro),
    ciclosOro: integer(raw.ciclosOro, 1, 60, DEFAULT_RULES.ciclosOro),
    limitePorCliente: integer(raw.limitePorCliente, 1, 200, DEFAULT_RULES.limitePorCliente)
  };
}

export const SORTEOS_DEFAULT_RULES = DEFAULT_RULES;
