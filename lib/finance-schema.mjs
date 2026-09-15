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
