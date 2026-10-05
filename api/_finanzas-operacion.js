// api/_finanzas-operacion.js · R107 — Pago de compra/renovación en la MISMA transacción que la fecha o la compra.
// renovar.js lo usa así: preparar (fuera de la transacción) → leer (al inicio de la transacción) → escribir
// (junto con el cambio de la ficha). Si algo falla, Firestore no guarda NADA: ni la fecha sin pago, ni el pago sin fecha.
// Mismos documentos y campos que /api/finanzas · registrar_operacion_pago (mismo operationId ⇒ nunca se duplica).
import { estadoPago, publicMethods, money } from "./_finanzas-libro.js";
import { financeMetadata } from "./_finance-schema.js";

const OP_RE = /^[A-Za-z0-9-]{8,80}$/;
function clean(v, max = 120) { return String(v ?? "").trim().slice(0, max); }
function hoyHN() { const d = new Date(Date.now() - 6 * 3600000); return d.toISOString().slice(0, 10); }
// R110 · Fecha del PAGO (el día que entró el dinero), elegida por el usuario. Hoy por defecto; máx. 30 días atrás; nunca futura.
export function fechaPagoValida(v) {
  const hoy = hoyHN(), f = String(v || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return hoy;
  const [y, m, d] = f.split("-").map(Number), dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return hoy;
  const dias = Math.round((Date.parse(`${hoy}T00:00:00Z`) - dt.getTime()) / 86400000);
  if (dias < 0) throw errorUsuario("La fecha del pago no puede ser futura.");
  if (dias > 30) throw errorUsuario("La fecha del pago no puede ser de hace más de 30 días.");
  return f;
}
function fechaCampos(ymd, nowIso) {
  const [y, m, d] = ymd.split("-");
  return { fecha: `${d}/${m}/${y}`, fechaPago: ymd, mesKey: `${y}-${m}`, monthKey: `${y}-${m}`, fechaTS: new Date(Date.UTC(+y, +m - 1, +d, 12)), createdAt: nowIso, updatedAt: nowIso };
}
export function esUsuarioLibro(user = {}) {
  const role = String(user.role || "").toLowerCase(), usuario = String(user.usuario || user.uid || "").toLowerCase();
  return ["admin", "administrador", "sublicuentas", "owner", "finanzas", "relojes"].includes(role) || ["naara", "sublicuentas", "libni", "relojes"].includes(usuario);
}
function errorUsuario(msg) { const e = new Error(msg); e.crmUserMessage = msg; return e; } // renovar.js responde estos errores como {ok:false,error}

// 1) Validar fuera de la transacción (métodos activos, montos, responsable). Devuelve null si no viene pago.
export async function prepararPago(db, pago, user, tipoOrigen) {
  if (!pago || typeof pago !== "object") return null;
  if (!esUsuarioLibro(user)) throw errorUsuario("El pago de la operación solo lo registran Sublicuentas y Relojes.");
  const ep = estadoPago(pago.montoTotal, pago.recibido);
  if (!(ep.total > 0)) throw errorUsuario("Escriba el monto total de la operación.");
  if (ep.recibido < 0 || ep.recibido > ep.total) throw errorUsuario("Lo recibido no puede ser negativo ni mayor que el total.");
  const cfg = await db.collection("portal_cliente").doc("configuracion").get();
  const methods = publicMethods(cfg.exists ? (cfg.data() || {}).metodos : []);
  const banco = methods.find((m) => m.id === clean(pago.bancoId));
  if (ep.recibido > 0 && !banco) throw errorUsuario("Elija el método/banco donde entró el dinero.");
  const deudorTipo = clean(pago.responsable) === "vendedor" ? "vendedor" : "cliente";
  const vendedorNombre = clean(pago.vendedorNombre || pago.vendedor, 60);
  if (ep.saldo > 0 && deudorTipo === "vendedor" && vendedorNombre.length < 2) throw errorUsuario("Escriba el vendedor responsable del pendiente.");
  const op = clean(pago.operationId, 80);
  if (!OP_RE.test(op)) throw errorUsuario("Falta operationId del pago (actualice la app).");
  const uid = String(user.uid || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  const opId = `oper_op_${uid}_${op}`; // mismo esquema que registrar_operacion_pago
  // R111: un solo pago para varios servicios del cliente (renovación múltiple de la APK) conserva la lista completa.
  const grupo = { compraIds: Array.isArray(pago.compraIds) ? pago.compraIds.map((x) => clean(x)).filter(Boolean).slice(0, 30) : [], servicios: Array.isArray(pago.servicios) ? pago.servicios.slice(0, 30).map((x) => ({ compraId: clean(x?.compraId), plataforma: clean(x?.plataforma, 40), fechaAnterior: clean(x?.fechaAnterior), fechaNueva: clean(x?.fechaNueva) })) : [], plataforma: clean(pago.plataforma, 200) };
  return { grupo, ep, banco, deudorTipo, vendedorNombre, operationId: op, opId, tipoOrigen, fechaPago: fechaPagoValida(pago.fechaPago), origen: clean(pago.origen || "web", 20), usuario: String(user.usuario || user.uid || "sublichat").toLowerCase(), rol: String(user.role || ""), uid: user.uid || "" };
}

// 2) Leer al inicio de la transacción (antes de cualquier escritura).
export async function leerPago(transaction, db, prep) {
  if (!prep) return null;
  const ventaRef = db.collection("finanzas_movimientos").doc(`${prep.opId}_venta`);
  const [libroSnap, ventaSnap] = await Promise.all([transaction.get(db.collection("finanzas_config").doc("libro_mayor")), transaction.get(ventaRef)]);
  const libro = libroSnap.exists ? (libroSnap.data() || {}) : {};
  const desdes = Object.values(libro.bases || {}).map((b) => b?.desde).filter(Boolean).sort();
  const cicloInicio = libro.cicloInicio || desdes[0] || "2026-10-01";
  return { yaExiste: ventaSnap.exists, cicloId: libro.cicloId || `ciclo_${cicloInicio}` };
}

// 3) Escribir junto con la ficha (misma transacción). rel = cliente/compra/fechas reales de la operación.
export function escribirPago(transaction, db, prep, lectura, rel = {}) {
  if (!prep || !lectura || lectura.yaExiste) return lectura?.yaExiste ? { duplicado: true, ...prep.ep } : null;
  const { ep, banco, deudorTipo, vendedorNombre, opId, tipoOrigen } = prep;
  const now = new Date().toISOString(), hoy = prep.fechaPago || hoyHN(); // R110: fecha real del pago
  const base = { ...financeMetadata({ docId: "", usuario: prep.usuario, userId: prep.uid }), registradoPor: prep.usuario, rol: prep.rol, origenCanal: prep.origen, ...fechaCampos(hoy, now) };
  const r = { clienteId: clean(rel.clienteId), clienteNombre: clean(rel.clienteNombre, 80), compraId: clean(rel.compraId), plataforma: clean(rel.plataforma, 40), tipoOrigen, operacionId: opId, cicloId: lectura.cicloId, operationId: prep.operationId, fechaNueva: clean(rel.fechaNueva), fechaAnterior: clean(rel.fechaAnterior), vendedor: vendedorNombre, atomico: true, ...(prep.grupo?.compraIds?.length ? { compraIds: prep.grupo.compraIds, servicios: prep.grupo.servicios } : {}), ...(prep.grupo?.plataforma ? { plataforma: prep.grupo.plataforma } : {}) };
  const ventaRef = db.collection("finanzas_movimientos").doc(`${opId}_venta`);
  const ingRef = db.collection("finanzas_movimientos").doc(`${opId}_cobro`);
  const cxcRef = db.collection("cuentas_por_cobrar").doc(opId);
  transaction.set(ventaRef, { ...base, movimientoId: ventaRef.id, tipo: "venta", subtipo: tipoOrigen === "compra" ? "compra_nueva" : "renovacion", monto: ep.total, montoRecibido: ep.recibido, saldoPendiente: ep.saldo, estadoPago: ep.estado, ...r });
  if (ep.recibido > 0) transaction.set(ingRef, { ...base, movimientoId: ingRef.id, tipo: "ingreso", subtipo: tipoOrigen === "compra" ? "cobro_compra" : "cobro_renovacion", monto: ep.recibido, bancoId: banco.id, banco: banco.nombre, metodoPago: banco.nombre, cobradoPor: prep.usuario, ...(ep.saldo > 0 ? { cuentaId: cxcRef.id } : {}), ...r });
  if (ep.saldo > 0) transaction.set(cxcRef, { cuentaId: cxcRef.id, deudorTipo, deudorId: deudorTipo === "cliente" ? r.clienteId : vendedorNombre, deudorNombre: deudorTipo === "cliente" ? r.clienteNombre : vendedorNombre, ...r, montoTotalOperacion: ep.total, montoRecibidoInicial: ep.recibido, montoOriginalPendiente: ep.saldo, montoRecibidoPosterior: 0, saldoPendiente: ep.saldo, estado: ep.recibido > 0 ? "parcial" : "pendiente", cicloOrigen: lectura.cicloId, abonos: [], creadoPor: prep.usuario, createdAt: now, updatedAt: now });
  transaction.set(db.collection("auditoria_eventos").doc(), { actorUsuario: prep.usuario, rol: prep.rol, origen: prep.origen, modulo: tipoOrigen === "compra" ? "compras" : "renovaciones", accion: tipoOrigen === "compra" ? "compra_pago" : "renovacion_pago", targetType: "operacion", targetId: opId, clienteId: r.clienteId, compraId: r.compraId, operationId: prep.operationId, monto: ep.total, after: { total: ep.total, recibido: ep.recibido, saldo: ep.saldo, estado: ep.estado, banco: banco?.nombre || "", responsable: ep.saldo > 0 ? deudorTipo : "" }, detalle: `${r.clienteNombre} · ${r.plataforma} · total ${ep.total} · recibido ${ep.recibido}${banco ? ` en ${banco.nombre}` : ""}${ep.saldo > 0 ? ` · pendiente ${ep.saldo} (${deudorTipo})` : ""} · guardado junto con la ${tipoOrigen}`, bancos: ep.recibido > 0 ? [{ bancoId: banco.id, monto: ep.recibido, direccion: "entrada" }] : [], resultado: "ok", tipo: `finanzas_${tipoOrigen}_pago`, createdAt: now });
  return { duplicado: false, ...ep, cuentaId: ep.saldo > 0 ? cxcRef.id : "", operacionId: opId };
}
export { money };
