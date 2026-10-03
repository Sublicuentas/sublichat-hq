// api/_finance-schema.js · Copia de lib/finance-schema.mjs dentro de /api: Vercel compila api/finanzas.js a CommonJS y
// require() de un .mjs falla (ERR_REQUIRE_ESM). Mismo contenido.
function clean(value) {
  return String(value == null ? "" : value).trim();
}

export function financeMetadata({ docId = "", usuario = "", userId = "" } = {}) {
  const id = clean(docId);
  const uid = clean(userId);
  const actor = clean(usuario) || uid || "sublichat";
  return {
    movimientoId: id,
    origen: "sublichat",
    registradoPor: actor,
    registradoPorId: uid,
  };
}
