// api/finanzas.js · VERSION 2 · Movimientos financieros para Sublichat RBAC
// Guarda cobros, egresos y cierres en Firebase para que Sublichat y el bot de Telegram
// lean la misma base.
//
// Variables de entorno requeridas en Vercel:
// FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import admin from "firebase-admin";
import { financeMetadata } from "./_finance-schema.js";
import { fechaPagoValida, pagoSocioVista, pagoSocioDisponible } from "./_finanzas-operacion.js"; // R110 · R121
import { clasificarServicio, CATEGORIAS } from "./_catalogo-categorias.js"; // R112
import {
  PLANILLA_CONCEPTOS, PLANILLA_SUBTIPOS, SIN_BANCO, money, ymd, addDaysYmd, daysBetweenYmd,
  movementYmd, publicMethods, resolveBankId, movementKind, movementBankId, cycleTotals, bankBalances, validatePlanilla, estadoPago
} from "./_finanzas-libro.js";

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  privateKey = privateKey.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltan variables FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY.");
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
}

async function requireFirebaseUser(req, res) {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ ok: false, error: "Sesión requerida." });
    return null;
  }
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (_) {
    res.status(401).json({ ok: false, error: "Sesión inválida o vencida." });
    return null;
  }
}

function canonicalInternalUser(raw = "") {
  const k = String(raw || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "").trim();
  if (["naara", "sublicuentas", "sublicuentas2"].includes(k)) return "sublicuentas";
  if (["libni", "daniela", "relojes", "finanzas"].includes(k) || /^libni|daniela$/.test(k)) return "relojes"; // R119: "Libni Daniela" (bot) = Relojes
  return k;
}
function financeActorLabel(m = {}) {
  const origen = String(m.origenCanal || m.origen || "").toLowerCase();
  if (["socios", "socio", "revendedor", "revendedores"].includes(origen)) return cleanText(m.socioNombre || m.revendedorNombre || m.registradoPorNombre || m.registradoPor || m.cobradoPor || "Socio");
  const raw = cleanText(m.cobradoPor || m.registradoPor || m.userName || m.usuario || "");
  const k = canonicalInternalUser(raw);
  if (k === "sublicuentas") return "Sublicuentas";
  if (k === "relojes") return "Relojes";
  return raw;
}
function authIdentity(user) {
  const role = String(user && user.role || "").toLowerCase();
  const usuarioRaw = String(user && (user.usuario || user.uid) || "sublichat").toLowerCase();
  const usuarioKey = canonicalInternalUser(usuarioRaw);
  const adminUser = ["admin", "administrador", "sublicuentas", "owner"].includes(role) || usuarioKey === "sublicuentas";
  const canonicalRole = adminUser ? "sublicuentas" :
    (["finanzas", "relojes"].includes(role) || usuarioKey === "relojes" ? "relojes" :
      (["auditor", "auditoria", "magdiel"].includes(role) || usuarioKey === "magdiel" ? "magdiel" : role || "usuario"));
  const usuario = canonicalRole === "sublicuentas" ? "sublicuentas" : canonicalRole === "relojes" ? "relojes" : usuarioKey;
  return { usuario, role: canonicalRole, admin: adminUser };
}

// R104: vínculos del cobro (banco del libro mayor + renovación) sin romper el formato anterior.
async function cobroLinkFields(db, body = {}) {
  const methods = await loadMethods(db);
  const bancoId = cleanText(body.bancoId) && methods.some((m) => m.id === cleanText(body.bancoId)) ? cleanText(body.bancoId) : resolveBankId(body.metodoPago || body.metodo || body.banco, methods);
  const banco = methods.find((m) => m.id === bancoId);
  const out = { bancoId };
  if (banco) { out.banco = banco.nombre; if (!cleanText(body.metodoPago || body.metodo)) out.metodoPago = banco.nombre; }
  if (body.subtipo === "cobro_renovacion") out.subtipo = "cobro_renovacion";
  for (const k of ["clienteId", "compraId", "fechaAnterior", "fechaNueva", "renovacionOperationId", "operationId"]) if (cleanText(body[k])) out[k] = cleanText(body[k]).slice(0, 120);
  out.origenCanal = cleanText(body.origen || "apk").slice(0, 20);
  return out;
}
async function egresoBankFields(db, body = {}) {
  const methods = await loadMethods(db);
  const bancoId = cleanText(body.bancoId) && methods.some((m) => m.id === cleanText(body.bancoId)) ? cleanText(body.bancoId) : resolveBankId(body.banco, methods);
  const banco = methods.find((m) => m.id === bancoId);
  const out = { bancoId, origenCanal: cleanText(body.origen || "apk").slice(0, 20) };
  if (banco && !cleanText(body.banco)) out.banco = banco.nombre;
  if (cleanText(body.operationId)) out.operationId = cleanText(body.operationId).slice(0, 80);
  return out;
}

function isoNow() {
  return new Date().toISOString();
}

function cleanText(v) {
  return String(v || "").trim();
}

function cleanMoney(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function canonicalFinanceDate(raw, fallbackIso) {
  const value = cleanText(raw || fallbackIso);
  let yyyy, mm, dd;
  let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) [, yyyy, mm, dd] = match;
  else {
    match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (match) [, dd, mm, yyyy] = match;
  }
  yyyy = Number(yyyy); mm = Number(mm); dd = Number(dd);
  const check = new Date(Date.UTC(yyyy, mm - 1, dd, 12));
  if (!yyyy || !mm || !dd || check.getUTCFullYear() !== yyyy || check.getUTCMonth() !== mm - 1 || check.getUTCDate() !== dd) {
    throw new Error("Fecha financiera inválida.");
  }
  const d = String(dd).padStart(2, "0");
  const m = String(mm).padStart(2, "0");
  return {
    fecha: `${d}/${m}/${yyyy}`,
    fechaPago: `${yyyy}-${m}-${d}`,
    fechaTS: admin.firestore.Timestamp.fromDate(check),
    mesKey: `${yyyy}-${m}`,
    monthKey: `${yyyy}-${m}`
  };
}

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normPhone(s) {
  return String(s || "").replace(/\D/g, "");
}

// R101 · Idempotencia de cobros/egresos: la APK manda un operationId fijo por cada cambio
// (también los hechos sin conexión, que se reintentan al volver la señal). Con el mismo
// operationId del mismo usuario, el segundo intento NO duplica el movimiento.
const FIN_OP_ID_RE = /^[A-Za-z0-9-]{8,80}$/;
function finOpDocId(body = {}, uid = "") {
  const op = String(body?.operationId || "").trim();
  const u = String(uid || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  return FIN_OP_ID_RE.test(op) && u ? `op_${u}_${op}` : "";
}

// ===================== LIBRO MAYOR (Finanzas R104 · solo Sublicuentas y Relojes) =====================
const LIBRO_REF = ["finanzas_config", "libro_mayor"];
const INICIO_LIBRO = "2026-10-01";
// Solo respaldo si portal_cliente/configuracion no existe (la fuente real es la configuración del portal).
const METODOS_RESPALDO = [
  { id: "bac-credomatic", nombre: "BAC Credomatic", logoKey: "bac" }, { id: "ficohsa", nombre: "Ficohsa", logoKey: "ficohsa" },
  { id: "banco-atlantida", nombre: "Banco Atlántida", logoKey: "atlantida" }, { id: "tigo-money", nombre: "Tigo Money", logoKey: "tigo" },
];
function hoyYmdHN() { return ymd(new Date(Date.now() - 6 * 3600000)); }
function ymdStartTs(value) { const [y, m, d] = String(value).split("-").map(Number); return admin.firestore.Timestamp.fromDate(new Date(Date.UTC(y, m - 1, d, 0, 0, 0))); }
function canUseLibro(identity) { return ["sublicuentas", "relojes"].includes(identity.role); }
function libroRef(db) { return db.collection(LIBRO_REF[0]).doc(LIBRO_REF[1]); }

async function loadMethods(db) {
  const snap = await db.collection("portal_cliente").doc("configuracion").get();
  const data = snap.exists ? (snap.data() || {}) : {};
  const metodos = Array.isArray(data.metodos) && data.metodos.length ? data.metodos : METODOS_RESPALDO;
  return publicMethods(metodos);
}
function libroFrom(data = {}) {
  const bases = data.bases && typeof data.bases === "object" ? data.bases : {};
  const desdes = Object.values(bases).map((b) => b?.desde).filter(Boolean).sort();
  // Finanzas nueva arranca el 01/10/2026: aunque todavía no haya saldo inicial, el ciclo cuenta desde ese día.
  const cicloInicio = data.cicloInicio || desdes[0] || INICIO_LIBRO;
  return { ...data, bases, cicloInicio, cicloId: data.cicloId || `ciclo_${cicloInicio}`, lecturaDesde: [cicloInicio, ...desdes].sort()[0] };
}
function movementsQuery(db, desde) {
  return db.collection("finanzas_movimientos").where("fechaTS", ">=", ymdStartTs(desde));
}
function rowsOf(snap) { return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })); }

async function estadoLibro(db, tx = null) {
  const [methods, libroSnap] = await Promise.all([loadMethods(db), tx ? tx.get(libroRef(db)) : libroRef(db).get()]);
  const libro = libroFrom(libroSnap.exists ? libroSnap.data() : {});
  const snap = tx ? await tx.get(movementsQuery(db, libro.lecturaDesde)) : await movementsQuery(db, libro.lecturaDesde).get();
  const movimientos = rowsOf(snap);
  const totales = cycleTotals(movimientos, libro.cicloInicio, "");
  const saldos = bankBalances(movimientos, libro, methods);
  return { methods, libro, movimientos, totales, saldos };
}
function libroOpDocId(prefix, body, uid) {
  const id = finOpDocId(body, uid);
  return id ? `${prefix}_${id}` : "";
}
function movimientoView(m, methods) {
  const kind = movementKind(m);
  const bancoId = movementBankId(m, methods);
  return {
    id: m.id, kind, tipo: m.tipo || "", subtipo: m.subtipo || "", fecha: movementYmd(m), monto: money(m.monto),
    bancoId, banco: (methods.find((x) => x.id === bancoId) || {}).nombre || (bancoId === SIN_BANCO ? "Sin banco" : bancoId),
    detalle: m.motivo || m.descripcion || m.detalle || m.concepto || "", cliente: m.clienteNombre || "", plataforma: m.plataforma || "",
    beneficiario: m.beneficiario || "", planillaPagoId: m.planillaPagoId || "", origen: m.origenCanal || m.origen || "",
    usuario: financeActorLabel(m), operationId: m.operationId || "",
    createdAt: m.createdAt || "", clienteId: m.clienteId || "", estadoFinanciero: m.estadoFinanciero || "", reversaDe: m.reversaDe || "",
  };
}
// R114 · Un cliente paga UNA vez: los cobros del mismo cliente, banco, usuario y día registrados juntos
// (renovar varios servicios) se muestran como UN solo pago (L 150, no 75 + 75). Aplica a todo el historial.
function agruparPagos(rows = []) {
  const out = [];
  const asc = [...rows].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  for (const r of asc) {
    const t = Date.parse(r.createdAt || "") || 0;
    const key = [r.kind, (r.clienteId || r.cliente || "").toLowerCase(), r.bancoId, r.usuario, r.fecha].join("|");
    const g = r.kind === "ingreso" && !r.estadoFinanciero && !r.reversaDe && (r.clienteId || r.cliente)
      ? out.find((x) => x._key === key && t && Math.abs(t - x._t) <= 10 * 60000) : null;
    if (g) { g.monto = money(g.monto + r.monto); g.ids.push(r.id); if (r.plataforma && !g.plataformas.includes(r.plataforma)) g.plataformas.push(r.plataforma); g.n += 1; }
    else out.push({ ...r, _key: key, _t: t, ids: [r.id], plataformas: r.plataforma ? [r.plataforma] : [], n: 1 });
  }
  return out.map(({ _key, _t, ...r }) => ({ ...r, plataforma: r.plataformas.join(" + ") }));
}

async function handleLibro(db, accion, body, identity, authUser, res) {
  if (!canUseLibro(identity)) return res.status(403).json({ ok: false, error: "Finanzas (libro mayor) es exclusivo de Sublicuentas y Relojes." });
  const now = isoNow();
  const actor = identity.usuario;

  if (accion === "finanzas_metodos") {
    // Ligero (1 lectura): para el formulario "¿Dónde pagó?" al renovar.
    return res.status(200).json({ ok: true, accion, metodos: await loadMethods(db) });
  }

  if (accion === "finanzas_resumen") {
    const { methods, libro, totales, saldos } = await estadoLibro(db);
    const [pagosSnap, cierresSnap] = await Promise.all([
      db.collection("planilla_pagos").where("cicloId", "==", libro.cicloId).get(),
      db.collection("finanzas_ciclos").orderBy("cerradoAt", "desc").limit(6).get().catch(() => ({ docs: [] })),
    ]);
    const hoy = hoyYmdHN();
    return res.status(200).json({
      ok: true, accion, hoy, metodos: methods,
      ciclo: { id: libro.cicloId, inicio: libro.cicloInicio, dias: Math.max(0, daysBetweenYmd(libro.cicloInicio, hoy)) + 1, ultimoCierreFin: libro.ultimoCierreFin || "", diasDesdeUltimoCierre: libro.ultimoCierreFin ? daysBetweenYmd(libro.ultimoCierreFin, hoy) : null },
      totales, disponibleCiclo: totales.resultado, bancos: saldos.bancos, totalBancos: saldos.total, cartera: await resumenCartera(db),
      planillaPagos: rowsOf(pagosSnap).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      cierres: rowsOf(cierresSnap), conceptos: PLANILLA_CONCEPTOS,
    });
  }

  // R117 · Datos del Excel Saiyajin para la APK (misma data y reglas que el reporte del bot).
  if (accion === "finanzas_reporte") {
    const { methods, libro, saldos } = await estadoLibro(db);
    const hoyR = hoyYmdHN();
    const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(body.desde || "")) ? body.desde : "2026-10-01";
    const hasta = /^\d{4}-\d{2}-\d{2}$/.test(String(body.hasta || "")) ? body.hasta : hoyR;
    const all = rowsOf(await movementsQuery(db, desde).limit(6000).get()).filter((m) => { const f = movementYmd(m); return f && f >= desde && f <= hasta; });
    const views = all.map((m) => ({ ...movimientoView(m, methods), socio: m.socioNombre || "", productos: m.productosSocio || m.serviciosSocio || null, descuento: money(m.descuento || 0), categoriaLabel: m.categoriaLabel || "", operacion: m.operationId || "", pedido: m.pedidoId || m.compraId || "", motivoAnulacion: m.motivoAnulacion || m.motivoCorreccion || "", anuladoPor: m.anuladoPor || "", anuladoAt: m.anuladoAt || "" }));
    // R123: anulados/corregidos y sus reversas van APARTE (hoja "Anulados") y no suman en Ingresos, Egresos ni Resumen:
    // el período muestra solo lo que de verdad entró/salió. Mismo criterio que el Excel del bot.
    const anuladoR123 = (v) => ["anulado", "corregido"].includes(v.estadoFinanciero);
    const vigentes = views.filter((v) => !anuladoR123(v) && !v.reversaDe);
    const anulados = views.filter((v) => anuladoR123(v) && ["ingreso", "egreso", "ajuste", "planilla"].includes(v.kind));
    const ingresos = agruparPagos(vigentes.filter((v) => v.kind === "ingreso"));
    const totales = cycleTotals(all.filter((m) => !["anulado", "corregido"].includes(m.estadoFinanciero) && !m.reversaDe), desde, hasta);
    const [cxc, pp, ci] = await Promise.all([db.collection(CXC).get(), db.collection("planilla_pagos").get(), db.collection("finanzas_ciclos").get()]);
    const cuentas = rowsOf(cxc), abiertas = cuentas.filter((c) => ["pendiente", "parcial"].includes(c.estado));
    const sum = (arr) => money(arr.reduce((a, c) => a + money(c.saldoPendiente), 0));
    return res.status(200).json({ ok: true, accion, desde, hasta, generado: isoNow(), libroDesde: libro.cicloInicio,
      totales, ingresos, egresos: vigentes.filter((v) => v.kind === "egreso"), planillaMovs: vigentes.filter((v) => v.kind === "planilla"), anulados,
      saldos: saldos.bancos, totalBancos: saldos.total,
      cartera: { cuentas, pendienteClientes: sum(abiertas.filter((c) => c.deudorTipo !== "vendedor")), pendienteVendedores: sum(abiertas.filter((c) => c.deudorTipo === "vendedor")) },
      planillaPagos: rowsOf(pp).filter((p) => p.estado === "confirmado" && p.fecha >= desde && p.fecha <= hasta),
      cierres: rowsOf(ci).filter((c) => c.fechaInicio <= hasta && c.fechaFin >= desde) });
  }

  if (accion === "finanzas_movimientos") {
    const [methods, libroSnap] = await Promise.all([loadMethods(db), libroRef(db).get()]);
    const libro = libroFrom(libroSnap.exists ? libroSnap.data() : {});
    const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(body.desde || "")) ? body.desde : libro.cicloInicio;
    const hasta = /^\d{4}-\d{2}-\d{2}$/.test(String(body.hasta || "")) ? body.hasta : "";
    const snap = await movementsQuery(db, desde).limit(1500).get();
    // "venta" es el valor comercial acordado, NO dinero real. Se conserva en Firestore
    // para Ventas generadas / Auditoría, pero jamás debe mezclarse con el listado de
    // movimientos monetarios (ingresos, egresos, planilla, ajustes, etc.).
    let rows = rowsOf(snap).map((m) => movimientoView(m, methods)).filter((m) => !["ignorar", "venta"].includes(m.kind) && (!hasta || m.fecha <= hasta));
    if (body.tipo) rows = rows.filter((m) => m.kind === body.tipo);
    if (body.bancoId) rows = rows.filter((m) => m.bancoId === body.bancoId);
    const q = String(body.texto || "").toLowerCase().trim();
    if (q) rows = rows.filter((m) => [m.detalle, m.cliente, m.beneficiario, m.plataforma, m.usuario].join(" ").toLowerCase().includes(q));
    rows = agruparPagos(rows);
    // Orden REAL: por fecha y, dentro del día, en el orden en que se registraron (lo último arriba).
    rows.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "") || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return res.status(200).json({ ok: true, accion, desde, hasta, movimientos: rows.slice(0, 500), total: rows.length });
  }

  if (accion === "registrar_saldo_inicial") {
    const methods = await loadMethods(db);
    const bancoId = cleanText(body.bancoId);
    const banco = methods.find((m) => m.id === bancoId);
    const monto = money(body.monto);
    if (!banco) return res.status(200).json({ ok: false, error: "Elija un banco activo." });
    if (!(monto >= 0) || body.monto === "" || body.monto == null) return res.status(200).json({ ok: false, error: "Escriba el saldo inicial del banco (0 o más)." });
    const hoy = hoyYmdHN();
    // R104b: el saldo inicial puede ser el que el banco tenía al EMPEZAR un día pasado (p. ej. 01/10/2026),
    // así todo lo registrado desde ese día cuenta para el saldo y para el ciclo.
    const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(body.desde || "")) && body.desde <= hoy ? body.desde : hoy;
    const out = await db.runTransaction(async (tx) => {
      const ref = libroRef(db);
      const snap = await tx.get(ref);
      const data = snap.exists ? (snap.data() || {}) : {};
      const bases = { ...(data.bases || {}) };
      if (bases[bancoId]) throw new Error(`${banco.nombre} ya tiene saldo inicial. Para corregir use “Ajuste de saldo” con motivo.`);
      if (data.ultimoCierreFin && desde <= data.ultimoCierreFin) throw new Error(`La fecha debe ser posterior al último cierre (${data.ultimoCierreFin}).`);
      bases[bancoId] = { saldo: monto, desde, registradoPor: actor, at: now };
      const movRef = db.collection("finanzas_movimientos").doc(`saldoini_${bancoId}`);
      tx.set(movRef, { ...financeMetadata({ docId: movRef.id, usuario: actor, userId: authUser.uid }), tipo: "saldo_inicial", subtipo: "saldo_inicial", bancoId, banco: banco.nombre, monto, ...canonicalFinanceDate(desde, hoy), origenCanal: cleanText(body.origen || "apk"), createdAt: now, updatedAt: now });
      const cicloInicio = !data.cicloInicio ? desde : (!data.ultimoCierreFin && desde < data.cicloInicio ? desde : data.cicloInicio);
      tx.set(ref, { bases, cicloInicio, cicloId: data.ultimoCierreFin ? (data.cicloId || `ciclo_${cicloInicio}`) : `ciclo_${cicloInicio}`, updatedAt: now }, { merge: true });
      tx.set(db.collection("auditoria_eventos").doc(), { tipo: "finanzas_saldo_inicial", bancoId, monto, registradoPor: actor, rol: identity.role, createdAt: now });
      return { bancoId, monto, desde };
    });
    return res.status(200).json({ ok: true, accion, ...out });
  }

  if (accion === "registrar_ajuste_saldo") {
    const methods = await loadMethods(db);
    const bancoId = cleanText(body.bancoId);
    const banco = methods.find((m) => m.id === bancoId);
    const monto = money(body.monto);
    const motivo = cleanText(body.motivo);
    if (!banco) return res.status(200).json({ ok: false, error: "Elija un banco activo." });
    if (!monto) return res.status(200).json({ ok: false, error: "Escriba el ajuste (positivo suma, negativo resta)." });
    if (motivo.length < 4) return res.status(200).json({ ok: false, error: "El ajuste necesita un motivo." });
    const libro = libroFrom((await libroRef(db).get()).data() || {});
    if (!libro.bases[bancoId]) return res.status(200).json({ ok: false, error: `${banco.nombre} no tiene saldo inicial. Regístrelo primero.` });
    const offId = libroOpDocId("ajuste", body, authUser.uid);
    const movRef = offId ? db.collection("finanzas_movimientos").doc(offId) : db.collection("finanzas_movimientos").doc();
    if (offId && (await movRef.get()).exists) return res.status(200).json({ ok: true, accion, movimientoId: movRef.id, duplicado: true });
    const hoy = hoyYmdHN();
    await movRef.set({ ...financeMetadata({ docId: movRef.id, usuario: actor, userId: authUser.uid }), tipo: "ajuste_saldo", subtipo: "ajuste_saldo", bancoId, banco: banco.nombre, monto, motivo, ...canonicalFinanceDate(hoy, hoy), operationId: cleanText(body.operationId), origenCanal: cleanText(body.origen || "apk"), createdAt: now, updatedAt: now });
    await db.collection("auditoria_eventos").add({ tipo: "finanzas_ajuste_saldo", bancoId, monto, motivo, movimientoId: movRef.id, registradoPor: actor, rol: identity.role, createdAt: now });
    return res.status(200).json({ ok: true, accion, movimientoId: movRef.id });
  }

  if (accion === "confirmar_pago_planilla") {
    const beneficiario = cleanText(body.beneficiario).slice(0, 80);
    const conceptoId = PLANILLA_SUBTIPOS.has(cleanText(body.concepto)) ? cleanText(body.concepto) : "";
    const descripcion = cleanText(body.descripcion).slice(0, 160);
    const montoTotal = money(body.montoTotal ?? body.monto);
    if (!beneficiario) return res.status(200).json({ ok: false, error: "Escriba el beneficiario." });
    if (!conceptoId) return res.status(200).json({ ok: false, error: "Elija el concepto del pago." });
    if (conceptoId === "otro_planilla" && descripcion.length < 3) return res.status(200).json({ ok: false, error: "“Otro” necesita una descripción." });
    const opId = libroOpDocId("planilla", body, authUser.uid);
    if (!opId) return res.status(200).json({ ok: false, error: "Falta operationId (actualice la app)." });
    const hoy = hoyYmdHN();
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(body.fecha || "")) ? body.fecha : hoy;
    const pagoRef = db.collection("planilla_pagos").doc(opId);
    const result = await db.runTransaction(async (tx) => {
      const ya = await tx.get(pagoRef);
      if (ya.exists) return { duplicado: true, pago: { id: pagoRef.id, ...(ya.data() || {}) } };
      const { methods, libro, totales, saldos } = await estadoLibro(db, tx);
      const v = validatePlanilla({ montoTotal, asignaciones: Array.isArray(body.asignaciones) ? body.asignaciones : [], bancos: saldos.bancos, disponibleCiclo: totales.resultado });
      if (!v.ok) { const e = new Error(v.errors.join(" ")); e.userError = true; e.detalle = v; throw e; }
      const pago = {
        planillaPagoId: pagoRef.id, cicloId: libro.cicloId, beneficiario, concepto: conceptoId, conceptoLabel: PLANILLA_CONCEPTOS[conceptoId], descripcion,
        montoTotal, fecha, estado: "confirmado", asignaciones: v.asignaciones, registradoPor: actor, rol: identity.role,
        origenCanal: cleanText(body.origen || "apk"), operationId: cleanText(body.operationId), createdAt: now, updatedAt: now,
      };
      tx.set(pagoRef, pago);
      for (const a of v.asignaciones) {
        const movRef = db.collection("finanzas_movimientos").doc(`${pagoRef.id}_${a.bancoId}`);
        tx.set(movRef, {
          ...financeMetadata({ docId: movRef.id, usuario: actor, userId: authUser.uid }),
          tipo: "egreso", subtipo: conceptoId, planillaPagoId: pagoRef.id, grupoId: pagoRef.id, cicloId: libro.cicloId,
          beneficiario, motivo: `${PLANILLA_CONCEPTOS[conceptoId]} · ${beneficiario}${descripcion ? ` · ${descripcion}` : ""}`,
          bancoId: a.bancoId, banco: a.banco, monto: a.monto, saldoAntes: a.saldoAntes, saldoDespues: a.saldoDespues,
          ...canonicalFinanceDate(fecha, hoy), registradoPor: actor, rol: identity.role, origenCanal: pago.origenCanal, operationId: pago.operationId, createdAt: now, updatedAt: now,
        });
      }
      tx.set(db.collection("auditoria_eventos").doc(), { tipo: "finanzas_pago_planilla", planillaPagoId: pagoRef.id, beneficiario, montoTotal, asignaciones: v.asignaciones.map((a) => ({ bancoId: a.bancoId, monto: a.monto })), registradoPor: actor, rol: identity.role, createdAt: now });
      return { duplicado: false, pago: { id: pagoRef.id, ...pago } };
    }).catch((e) => { if (e.userError) return { error: e.message, detalle: e.detalle }; throw e; });
    if (result.error) return res.status(200).json({ ok: false, error: result.error, validacion: result.detalle });
    return res.status(200).json({ ok: true, accion, ...result });
  }

  if (accion === "guardar_cierre_ciclo") {
    const hoy = hoyYmdHN();
    const fechaFin = /^\d{4}-\d{2}-\d{2}$/.test(String(body.fechaFin || "")) ? body.fechaFin : hoy;
    if (fechaFin > hoy) return res.status(200).json({ ok: false, error: "La fecha de cierre no puede ser futura." });
    const result = await db.runTransaction(async (tx) => {
      const { methods, libro, movimientos } = await estadoLibro(db, tx);
      if (fechaFin < libro.cicloInicio) { const e = new Error("La fecha de cierre es anterior al inicio del ciclo."); e.userError = true; throw e; }
      const cicloRef = db.collection("finanzas_ciclos").doc(libro.cicloId);
      const ya = await tx.get(cicloRef);
      if (ya.exists && ya.data()?.estado === "cerrado") return { duplicado: true, cierre: { id: cicloRef.id, ...(ya.data() || {}) } };
      const hastaFin = movimientos.filter((m) => { const f = movementYmd(m); return f && f <= fechaFin; });
      // R119: el usuario elige DESDE qué día cierra (por defecto el inicio del ciclo).
      const inicioCierre = /^\d{4}-\d{2}-\d{2}$/.test(String(body.fechaInicio || "")) && body.fechaInicio >= libro.cicloInicio && body.fechaInicio <= fechaFin ? body.fechaInicio : libro.cicloInicio;
      const totales = cycleTotals(hastaFin, inicioCierre, fechaFin);
      const saldos = bankBalances(hastaFin, libro, methods);
      const cierre = {
        cicloId: libro.cicloId, estado: "cerrado", fechaInicio: inicioCierre, fechaFin, ...totales,
        saldoRetenido: saldos.total, saldosBancos: saldos.bancos.filter((b) => b.activado).map((b) => ({ bancoId: b.id, banco: b.nombre, inicial: b.base, ingresos: b.ingresos, egresosOperativos: b.egresosOperativos, planilla: b.planilla, ajustes: b.ajustes, final: b.saldo, movimientos: b.movimientos })),
        nota: cleanText(body.nota).slice(0, 300), cerradoPor: actor, rol: identity.role, cerradoAt: now, origenCanal: cleanText(body.origen || "apk"),
      };
      tx.set(cicloRef, cierre);
      const nuevoInicio = addDaysYmd(fechaFin, 1);
      const bases = {};
      for (const b of saldos.bancos) if (b.activado) bases[b.id] = { saldo: b.saldo, desde: nuevoInicio, origen: `cierre ${libro.cicloId}` };
      tx.set(libroRef(db), { bases, cicloInicio: nuevoInicio, cicloId: `ciclo_${nuevoInicio}`, ultimoCierreId: libro.cicloId, ultimoCierreFin: fechaFin, updatedAt: now }, { merge: false });
      tx.set(db.collection("auditoria_eventos").doc(), { tipo: "finanzas_cierre_ciclo", cicloId: libro.cicloId, fechaInicio: libro.cicloInicio, fechaFin, resultado: totales.resultado, saldoRetenido: saldos.total, cerradoPor: actor, rol: identity.role, createdAt: now });
      return { duplicado: false, cierre: { id: cicloRef.id, ...cierre }, nuevoCiclo: { id: `ciclo_${nuevoInicio}`, inicio: nuevoInicio } };
    }).catch((e) => { if (e.userError) return { error: e.message }; throw e; });
    if (result.error) return res.status(200).json({ ok: false, error: result.error });
    return res.status(200).json({ ok: true, accion, ...result });
  }
  return null;
}

// ===================== CENTRO FINANCIERO R106 (solo Sublicuentas y Relojes) =====================
// Compra/renovación con pago completo, parcial o pendiente · cartera por cobrar (cliente/vendedor) · abonos ·
// transferencias · anular/corregir con REVERSA (nunca se borra un movimiento confirmado) · auditoría detallada.
const CXC = "cuentas_por_cobrar";
const ACCIONES_CORRECCION = ["anular_movimiento", "anular_pago_planilla", "corregir_pago_planilla", "corregir_movimiento"];
async function resumenCartera(db) {
  const snap = await db.collection(CXC).where("estado", "in", ["pendiente", "parcial"]).get().catch(() => ({ docs: [] }));
  let clientes = 0, vendedores = 0, n = 0;
  for (const d of snap.docs) { const c = d.data() || {}; n++; if (c.deudorTipo === "vendedor") vendedores += money(c.saldoPendiente); else clientes += money(c.saldoPendiente); }
  return { pendienteClientes: money(clientes), pendienteVendedores: money(vendedores), pendienteTotal: money(clientes + vendedores), cuentas: n };
}
// Bitácora append-only con antes/después (nunca secretos).
function auditar(tx, db, identity, ev = {}) {
  tx.set(db.collection("auditoria_eventos").doc(), {
    actorUsuario: identity.usuario, rol: identity.role, origen: cleanText(ev.origen || "apk").slice(0, 20), modulo: ev.modulo || "finanzas",
    accion: ev.accion, targetType: ev.targetType || "", targetId: ev.targetId || "", clienteId: ev.clienteId || "", compraId: ev.compraId || "",
    movimientoId: ev.movimientoId || "", planillaPagoId: ev.planillaPagoId || "", cuentaId: ev.cuentaId || "", operationId: ev.operationId || "",
    before: ev.before ?? null, after: ev.after ?? null, motivo: ev.motivo || "", detalle: ev.detalle || "", monto: ev.monto ?? null,
    bancos: ev.bancos || [], resultado: "ok", tipo: `finanzas_${ev.accion}`, createdAt: isoNow(),
  });
}
function userErr(msg) { const e = new Error(msg); e.userError = true; return e; }
function baseMov(identity, authUser, body) {
  return { ...financeMetadata({ docId: "", usuario: identity.usuario, userId: authUser.uid }), registradoPor: identity.usuario, rol: identity.role, origenCanal: cleanText(body.origen || "apk").slice(0, 20), createdAt: isoNow(), updatedAt: isoNow() };
}

async function handleCentro(db, accion, body, identity, authUser, res) {
  if (!canUseLibro(identity)) return res.status(403).json({ ok: false, error: "El centro financiero es exclusivo de Sublicuentas y Relojes." });
  const hoy = hoyYmdHN();
  const methods = await loadMethods(db);
  const bancoDe = (id) => methods.find((m) => m.id === cleanText(id));
  const run = (fn) => db.runTransaction(fn).catch((e) => { if (e.userError) return { error: e.message }; throw e; });
  const reply = (r) => (r?.error ? res.status(200).json({ ok: false, error: r.error }) : res.status(200).json({ ok: true, accion, ...r }));
  const fmov = (id) => db.collection("finanzas_movimientos").doc(id);

  // ---- compra nueva / renovación: monto total + recibido ahora → venta + ingreso real + cuenta por cobrar
  if (accion === "registrar_operacion_pago") {
    let fechaPagoR110; try { fechaPagoR110 = fechaPagoValida(body.fechaPago); } catch (e) { return res.status(200).json({ ok: false, error: e.crmUserMessage || e.message }); } // R110: día real del pago
    const tipoOrigen = cleanText(body.tipoOrigen) === "compra" ? "compra" : "renovacion";
    const ep = estadoPago(body.montoTotal, body.recibido);
    if (!(ep.total > 0)) return res.status(200).json({ ok: false, error: "Escriba el monto total de la operación." });
    if (ep.recibido < 0 || ep.recibido > ep.total) return res.status(200).json({ ok: false, error: "Lo recibido no puede ser negativo ni mayor que el total." });
    if (ep.recibido > 0 && !bancoDe(body.bancoId)) return res.status(200).json({ ok: false, error: "Elija el método/banco donde entró el dinero." });
    const deudorTipo = cleanText(body.responsable) === "vendedor" ? "vendedor" : "cliente";
    if (ep.saldo > 0 && deudorTipo === "vendedor" && !cleanText(body.vendedorNombre || body.vendedorId)) return res.status(200).json({ ok: false, error: "Elija el vendedor responsable del pendiente." });
    const opId = libroOpDocId("oper", body, authUser.uid);
    if (!opId) return res.status(200).json({ ok: false, error: "Falta operationId (actualice la app)." });
    const ventaRef = fmov(`${opId}_venta`), ingRef = fmov(`${opId}_cobro`), cxcRef = db.collection(CXC).doc(opId);
    const r = await run(async (tx) => {
      if ((await tx.get(ventaRef)).exists) return { duplicado: true, operacionId: opId };
      const { libro } = await estadoLibro(db, tx);
      const banco = bancoDe(body.bancoId);
      const compraIds = Array.isArray(body.compraIds) ? [...new Set(body.compraIds.map((x) => cleanText(x)).filter(Boolean))].slice(0, 30) : [];
      const servicios = Array.isArray(body.servicios) ? body.servicios.slice(0, 30).map((x) => ({ compraId: cleanText(x?.compraId).slice(0, 120), plataforma: cleanText(x?.plataforma).slice(0, 60), fechaAnterior: cleanText(x?.fechaAnterior).slice(0, 20), fechaNueva: cleanText(x?.fechaNueva).slice(0, 20) })) : [];
      const clsR112 = clasificarServicio({ plataforma: body.plataforma, categoria: body.categoria, tipoVenta: body.tipoVenta }); // R112
      const rel = { categoria: clsR112.categoria, tipoVenta: clsR112.tipoVenta, categoriaLabel: CATEGORIAS[clsR112.categoria]?.finanzas || "", clienteId: cleanText(body.clienteId), clienteNombre: cleanText(body.clienteNombre).slice(0, 80), compraId: cleanText(body.compraId), compraIds, servicios, plataforma: cleanText(body.plataforma).slice(0, 160), tipoOrigen, operacionId: opId, cicloId: libro.cicloId, operationId: cleanText(body.operationId), fechaNueva: cleanText(body.fechaNueva), fechaAnterior: cleanText(body.fechaAnterior), vendedor: cleanText(body.vendedorNombre).slice(0, 60) };
      tx.set(ventaRef, { ...baseMov(identity, authUser, body), movimientoId: ventaRef.id, tipo: "venta", subtipo: tipoOrigen === "compra" ? "compra_nueva" : "renovacion", monto: ep.total, montoRecibido: ep.recibido, saldoPendiente: ep.saldo, estadoPago: ep.estado, ...rel, ...canonicalFinanceDate(fechaPagoR110, hoy) });
      if (ep.recibido > 0) tx.set(ingRef, { ...baseMov(identity, authUser, body), movimientoId: ingRef.id, tipo: "ingreso", subtipo: tipoOrigen === "compra" ? "cobro_compra" : "cobro_renovacion", monto: ep.recibido, bancoId: banco.id, banco: banco.nombre, metodoPago: banco.nombre, cobradoPor: identity.usuario, ...(ep.saldo > 0 ? { cuentaId: cxcRef.id } : {}), ...rel, ...canonicalFinanceDate(fechaPagoR110, hoy) });
      if (ep.saldo > 0) tx.set(cxcRef, { cuentaId: cxcRef.id, deudorTipo, deudorId: deudorTipo === "cliente" ? rel.clienteId : cleanText(body.vendedorId || body.vendedorNombre), deudorNombre: deudorTipo === "cliente" ? rel.clienteNombre : cleanText(body.vendedorNombre || body.vendedorId), ...rel, montoTotalOperacion: ep.total, montoRecibidoInicial: ep.recibido, montoOriginalPendiente: ep.saldo, montoRecibidoPosterior: 0, saldoPendiente: ep.saldo, estado: ep.recibido > 0 ? "parcial" : "pendiente", cicloOrigen: libro.cicloId, abonos: [], creadoPor: identity.usuario, createdAt: isoNow(), updatedAt: isoNow() });
      auditar(tx, db, identity, { origen: body.origen, modulo: tipoOrigen === "compra" ? "compras" : "renovaciones", accion: tipoOrigen === "compra" ? "compra_pago" : "renovacion_pago", targetType: "operacion", targetId: opId, clienteId: rel.clienteId, compraId: rel.compraId, operationId: rel.operationId, monto: ep.total, after: { total: ep.total, recibido: ep.recibido, saldo: ep.saldo, estado: ep.estado, banco: banco?.nombre || "", responsable: ep.saldo > 0 ? deudorTipo : "", compraIds: rel.compraIds || [], servicios: rel.servicios || [] }, detalle: `${rel.clienteNombre} · ${rel.plataforma} · total ${ep.total} · recibido ${ep.recibido}${banco ? ` en ${banco.nombre}` : ""}${ep.saldo > 0 ? ` · pendiente ${ep.saldo} (${deudorTipo})` : ""}`, bancos: ep.recibido > 0 ? [{ bancoId: banco.id, monto: ep.recibido, direccion: "entrada" }] : [] });
      return { duplicado: false, operacionId: opId, ...ep, cuentaId: ep.saldo > 0 ? cxcRef.id : "" };
    });
    return reply(r);
  }

  // ---- R121 · compras de socios YA pagadas que todavía no tienen su ficha armada ("Ya pagó por Socios")
  if (accion === "listar_pagos_socios_sin_ficha") {
    const pagos = rowsOf(await db.collection("finanzas_movimientos").where("fichaPendiente", "==", true).get())
      .filter(pagoSocioDisponible).map((m) => pagoSocioVista({ ...m, movimientoId: m.id })).filter((p) => p.productos.length)
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.movimientoId).localeCompare(String(a.movimientoId)));
    return res.status(200).json({ ok: true, accion, pagos: pagos.slice(0, 80) });
  }
  // ---- R121 · esa compra de socio ya tiene su ficha (armada antes de este cambio): se quita de la lista. No mueve dinero.
  if (accion === "socio_ficha_lista") {
    const id = cleanText(body.movimientoId);
    if (!/^socio_compra_[A-Za-z0-9_-]{1,120}_cobro$/.test(id)) return res.status(200).json({ ok: false, error: "Elija la compra de socio." });
    const r = await run(async (tx) => {
      const snap = await tx.get(fmov(id));
      const m = snap.exists ? (snap.data() || {}) : null;
      if (!m || m.subtipo !== "compra_socio" || m.tipo !== "ingreso") throw userErr("Esa compra de socio no existe.");
      if (m.fichaPendiente === false) return { yaEstaba: true };
      tx.update(fmov(id), { fichaPendiente: false, fichaListaPor: identity.usuario, fichaListaAt: isoNow(), updatedAt: isoNow() });
      auditar(tx, db, identity, { origen: body.origen, modulo: "compras", accion: "socio_ficha_lista", targetType: "movimiento", targetId: id, movimientoId: id, monto: money(m.monto), detalle: `${m.clienteNombre || m.plataforma || "Compra de socio"} · socio ${m.socioNombre || ""} · marcada como ficha ya armada (sin mover dinero)` });
      return {};
    });
    return reply(r);
  }

  // ---- cartera por cobrar (filtrable por cliente / vendedor)
  if (accion === "listar_pendientes") {
    let rows = (await db.collection(CXC).where("estado", "in", body.incluirPagadas ? ["pendiente", "parcial", "pagado"] : ["pendiente", "parcial"]).get()).docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    if (["cliente", "vendedor"].includes(body.deudorTipo)) rows = rows.filter((c) => c.deudorTipo === body.deudorTipo);
    const t = String(body.texto || "").toLowerCase().trim();
    if (t) rows = rows.filter((c) => [c.deudorNombre, c.clienteNombre, c.plataforma].join(" ").toLowerCase().includes(t));
    rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    return res.status(200).json({ ok: true, accion, cuentas: rows.slice(0, 300), cartera: await resumenCartera(db) });
  }

  // ---- abono / cobro posterior (también después de un cierre: entra en su fecha real, el cierre no se toca)
  if (accion === "registrar_abono") {
    let fechaPagoR110; try { fechaPagoR110 = fechaPagoValida(body.fechaPago); } catch (e) { return res.status(200).json({ ok: false, error: e.crmUserMessage || e.message }); } // R110: día real del pago
    const monto = money(body.monto), banco = bancoDe(body.bancoId);
    if (!(monto > 0)) return res.status(200).json({ ok: false, error: "Escriba el monto que pagó." });
    if (!banco) return res.status(200).json({ ok: false, error: "Elija el banco donde entró el abono." });
    const opId = libroOpDocId("abono", body, authUser.uid);
    if (!opId) return res.status(200).json({ ok: false, error: "Falta operationId (actualice la app)." });
    const ref = fmov(opId), cxcRef = db.collection(CXC).doc(cleanText(body.cuentaId) || "x");
    const r = await run(async (tx) => {
      const [ya, cs] = await Promise.all([tx.get(ref), tx.get(cxcRef)]);
      if (ya.exists) return { duplicado: true, movimientoId: ref.id };
      if (!cs.exists) throw userErr("Esa cuenta por cobrar no existe.");
      const c = cs.data() || {};
      if (monto > money(c.saldoPendiente) + 0.001) throw userErr(`El abono (Lps. ${monto}) es mayor que el saldo pendiente (Lps. ${money(c.saldoPendiente)}).`);
      const { libro } = await estadoLibro(db, tx);
      const saldo = money(c.saldoPendiente - monto);
      tx.set(ref, { ...baseMov(identity, authUser, body), movimientoId: ref.id, tipo: "ingreso", subtipo: c.deudorTipo === "vendedor" ? "cobro_pendiente_vendedor" : "cobro_pendiente_cliente", monto, bancoId: banco.id, banco: banco.nombre, metodoPago: banco.nombre, cobradoPor: identity.usuario, cuentaId: cxcRef.id, clienteId: c.clienteId || "", clienteNombre: c.clienteNombre || "", compraId: c.compraId || "", plataforma: c.plataforma || "", tipoOrigen: c.tipoOrigen || "", operacionId: c.operacionId || "", deudorTipo: c.deudorTipo, deudorNombre: c.deudorNombre || "", cicloId: libro.cicloId, cicloOrigen: c.cicloOrigen || "", deCicloAnterior: !!(c.cicloOrigen && c.cicloOrigen !== libro.cicloId), operationId: cleanText(body.operationId), ...canonicalFinanceDate(fechaPagoR110, hoy) });
      tx.set(cxcRef, { saldoPendiente: saldo, montoRecibidoPosterior: money((c.montoRecibidoPosterior || 0) + monto), estado: saldo <= 0 ? "pagado" : "parcial", abonos: [...(c.abonos || []), { movimientoId: ref.id, monto, bancoId: banco.id, banco: banco.nombre, fecha: hoy, por: identity.usuario }], updatedAt: isoNow() }, { merge: true });
      auditar(tx, db, identity, { origen: body.origen, modulo: "cartera", accion: "abono", targetType: "cuenta_por_cobrar", targetId: cxcRef.id, cuentaId: cxcRef.id, movimientoId: ref.id, clienteId: c.clienteId, compraId: c.compraId, operationId: cleanText(body.operationId), monto, before: { saldo: money(c.saldoPendiente) }, after: { saldo, estado: saldo <= 0 ? "pagado" : "parcial" }, detalle: `${c.deudorNombre} (${c.deudorTipo}) abonó ${monto} en ${banco.nombre} · pendiente ${saldo}`, bancos: [{ bancoId: banco.id, monto, direccion: "entrada" }] });
      return { duplicado: false, movimientoId: ref.id, saldoPendiente: saldo, estado: saldo <= 0 ? "pagado" : "parcial" };
    });
    return reply(r);
  }

  // ---- transferencia interna: resta origen y suma destino; no es ingreso ni egreso
  if (accion === "registrar_transferencia") {
    const monto = money(body.monto), o = bancoDe(body.origenId), d = bancoDe(body.destinoId);
    if (!(monto > 0) || !o || !d || o.id === d.id) return res.status(200).json({ ok: false, error: "Elija banco origen, banco destino (distintos) y monto." });
    const opId = libroOpDocId("transf", body, authUser.uid);
    if (!opId) return res.status(200).json({ ok: false, error: "Falta operationId (actualice la app)." });
    const ref = fmov(opId), refIn = fmov(`${opId}_in`);
    const r = await run(async (tx) => {
      if ((await tx.get(ref)).exists) return { duplicado: true };
      const { saldos } = await estadoLibro(db, tx);
      const bo = saldos.bancos.find((b) => b.id === o.id), bd = saldos.bancos.find((b) => b.id === d.id);
      if (!bo?.activado || !bd?.activado) throw userErr("Los dos bancos necesitan saldo inicial.");
      if (monto > bo.saldo + 0.001) throw userErr(`Saldo insuficiente en ${o.nombre} (Lps. ${bo.saldo}).`);
      const comun = { ...baseMov(identity, authUser, body), tipo: "transferencia", subtipo: "transferencia_interna", monto, transferenciaId: ref.id, nota: cleanText(body.nota).slice(0, 160), operationId: cleanText(body.operationId), ...canonicalFinanceDate(hoy, hoy) };
      tx.set(ref, { ...comun, movimientoId: ref.id, direccion: "salida", bancoId: o.id, banco: o.nombre, contraparteId: d.id, saldoAntes: bo.saldo, saldoDespues: money(bo.saldo - monto) });
      tx.set(refIn, { ...comun, movimientoId: refIn.id, direccion: "entrada", bancoId: d.id, banco: d.nombre, contraparteId: o.id, saldoAntes: bd.saldo, saldoDespues: money(bd.saldo + monto) });
      auditar(tx, db, identity, { origen: body.origen, accion: "transferencia", targetType: "transferencia", targetId: ref.id, movimientoId: ref.id, operationId: cleanText(body.operationId), monto, detalle: `${o.nombre} → ${d.nombre} · ${monto}`, bancos: [{ bancoId: o.id, monto, direccion: "salida", saldoAntes: bo.saldo, saldoDespues: money(bo.saldo - monto) }, { bancoId: d.id, monto, direccion: "entrada", saldoAntes: bd.saldo, saldoDespues: money(bd.saldo + monto) }] });
      return { duplicado: false, transferenciaId: ref.id };
    });
    return reply(r);
  }

  // ---- ajustar SOLO la fecha real del dinero (sin reversa): no cambia monto/banco, solo el día financiero.
  // Nunca se deriva de la fecha de corte/renovación del cliente.
  if (accion === "ajustar_fecha_movimiento" && Array.isArray(body.movimientoIds) && body.movimientoIds.length > 1) {
    // R114: un pago agrupado (varios servicios) cambia de fecha completo, en una transacción.
    const ids = body.movimientoIds.map((x) => cleanText(x)).filter(Boolean).slice(0, 30), fechaPago = cleanText(body.fechaPago || body.fecha);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaPago) || fechaPago > hoy) return res.status(200).json({ ok: false, error: "Fecha inválida o futura." });
    const r = await run(async (tx) => {
      const snaps = await Promise.all(ids.map((id) => tx.get(fmov(id))));
      const ventas = await Promise.all(ids.filter((id) => id.endsWith("_cobro")).map((id) => tx.get(fmov(id.replace(/_cobro$/, "_venta")))));
      for (const sn of snaps) { const m = sn.data() || {}; if (!sn.exists || movementKind(m) !== "ingreso" || m.reversaDe || m.estadoFinanciero) throw userErr("Ese pago no admite ajuste de fecha."); }
      const campos = { ...canonicalFinanceDate(fechaPago, hoy), fechaPagoAjustadaManualmente: true, fechaAjustadaPor: identity.usuario, fechaAjustadaAt: isoNow(), updatedAt: isoNow() };
      [...snaps, ...ventas].forEach((sn) => { if (sn.exists) tx.set(fmov(sn.id), { ...campos, fechaAjustadaDe: movementYmd(sn.data() || {}) || "" }, { merge: true }); });
      auditar(tx, db, identity, { origen: body.origen, accion: "ajustar_fecha_pago", targetType: "pago", targetId: ids.join(","), movimientoId: ids[0], motivo: cleanText(body.motivo || "Ajuste de fecha del pago").slice(0, 200), after: { fechaPago }, detalle: `${ids.length} servicios, un solo pago → ${fechaPago}` });
      return { sinCambios: false, fechaPago, n: ids.length };
    });
    return reply(r);
  }
  if (accion === "ajustar_fecha_movimiento") {
    const id = cleanText(body.movimientoId), fechaPago = cleanText(body.fechaPago || body.fecha);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaPago)) return res.status(200).json({ ok: false, error: "Fecha inválida. Use yyyy-mm-dd." });
    if (fechaPago > hoy) return res.status(200).json({ ok: false, error: "La fecha del pago no puede ser futura." });
    const motivo = cleanText(body.motivo || "Ajuste manual de fecha de pago").slice(0, 200);
    const ref = fmov(id || "x");
    const r = await run(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw userErr("Ese movimiento no existe.");
      const m = snap.data() || {};
      const kind = movementKind(m);
      if (!["ingreso", "egreso", "ajuste"].includes(kind) || m.reversaDe || m.estadoFinanciero || m.planillaPagoId) throw userErr("Ese movimiento no admite ajuste individual de fecha.");
      const antes = movementYmd(m) || "";
      if (antes === fechaPago) return { sinCambios: true, movimientoId: ref.id, fechaPago };
      tx.set(ref, { ...canonicalFinanceDate(fechaPago, hoy), fechaPagoAjustadaManualmente: true, fechaAjustadaDe: antes, fechaAjustadaPor: identity.usuario, fechaAjustadaAt: isoNow(), updatedAt: isoNow() }, { merge: true });
      auditar(tx, db, identity, { origen: body.origen, accion: "ajustar_fecha_pago", targetType: "movimiento", targetId: ref.id, movimientoId: ref.id, clienteId: m.clienteId || "", compraId: m.compraId || "", motivo, monto: money(m.monto), before: { fechaPago: antes }, after: { fechaPago }, detalle: `${antes || "sin fecha"} → ${fechaPago} · ${m.clienteNombre || m.motivo || m.plataforma || m.tipo || "Movimiento"}` });
      return { sinCambios: false, movimientoId: ref.id, fechaAnterior: antes, fechaPago };
    });
    return reply(r);
  }

  // ---- anular / corregir con reversa (nunca se borra nada confirmado)
  if (!ACCIONES_CORRECCION.includes(accion)) return null;
  const motivo = cleanText(body.motivo).slice(0, 200);
  if (motivo.length < 4) return res.status(200).json({ ok: false, error: "Escriba el motivo (obligatorio)." });
  const opKey = libroOpDocId("corr", body, authUser.uid);
  if (!opKey) return res.status(200).json({ ok: false, error: "Falta operationId (actualice la app)." });
  const marcaRef = db.collection("finanzas_operaciones").doc(opKey);
  const reversa = (tx, orig, id, estadoFinal) => {
    const rev = fmov(`${id}_rev`);
    const { createdAt, updatedAt, movimientoId, saldoAntes, saldoDespues, estadoFinanciero, reversaId, ...resto } = orig;
    tx.set(rev, { ...resto, ...baseMov(identity, authUser, body), movimientoId: rev.id, monto: -money(orig.monto), reversaDe: id, motivo: `Reversa: ${motivo}`, ...canonicalFinanceDate(hoy, hoy) });
    tx.set(fmov(id), { estadoFinanciero: estadoFinal, reversaId: rev.id, anuladoPor: identity.usuario, anuladoAt: isoNow(), motivoAnulacion: motivo, updatedAt: isoNow() }, { merge: true });
    return rev.id;
  };

  if (accion === "anular_movimiento" || accion === "corregir_movimiento") {
    const id = cleanText(body.movimientoId), ref = fmov(id || "x");
    const r = await run(async (tx) => {
      if ((await tx.get(marcaRef)).exists) return { duplicado: true };
      const snap = await tx.get(ref);
      if (!snap.exists) throw userErr("Ese movimiento no existe.");
      const m = snap.data() || {};
      if (m.estadoFinanciero) throw userErr(`Ese movimiento ya está ${m.estadoFinanciero}.`);
      if (m.reversaDe) throw userErr("No se puede anular una reversa.");
      if (m.planillaPagoId) throw userErr("Este movimiento es parte de un pago de planilla: anule o corrija el pago completo.");
      if (!["ingreso", "egreso", "ajuste"].includes(movementKind(m))) throw userErr("Este tipo de movimiento no se anula aquí.");
      const cxcRef = m.cuentaId ? db.collection(CXC).doc(m.cuentaId) : null;
      const cs = cxcRef ? await tx.get(cxcRef) : null;
      let nuevo = null;
      if (accion === "corregir_movimiento") {
        const monto = body.monto != null && body.monto !== "" ? money(body.monto) : money(m.monto);
        const b = body.bancoId ? bancoDe(body.bancoId) : bancoDe(m.bancoId || resolveBankId(m.banco || m.metodoPago, methods));
        if (!(monto > 0) || !b) throw userErr("Corrección inválida: revise monto y banco.");
        if (cs?.exists && movementKind(m) === "ingreso" && monto - money(m.monto) > money((cs.data() || {}).saldoPendiente) + 0.001) throw userErr("La corrección deja el cobro mayor que lo que se debía.");
        nuevo = { monto, bancoId: b.id, banco: b.nombre };
      }
      const revId = reversa(tx, m, id, nuevo ? "corregido" : "anulado");
      let sustitutoId = "";
      if (nuevo) {
        const sus = fmov(`${id}_c${Date.now().toString(36)}`);
        const { createdAt, updatedAt, movimientoId, estadoFinanciero, reversaId, ...resto } = m;
        const fOrig = movementYmd(m) || hoy; // el sustituto conserva la fecha real del movimiento original
        tx.set(sus, { ...resto, ...nuevo, ...(m.metodoPago ? { metodoPago: nuevo.banco } : {}), ...baseMov(identity, authUser, body), movimientoId: sus.id, sustituyeA: id, motivoCorreccion: motivo, ...canonicalFinanceDate(fOrig, hoy) });
        sustitutoId = sus.id;
      }
      // Cartera: anular un cobro devuelve ese dinero al pendiente; corregir el monto ajusta solo la diferencia.
      if (cs?.exists && movementKind(m) === "ingreso") {
        const c = cs.data() || {};
        const delta = money((nuevo ? nuevo.monto : 0) - money(m.monto));
        const saldo = money(Math.max(0, money(c.saldoPendiente) - delta));
        const posterior = money((c.montoRecibidoPosterior || 0) + (String(m.subtipo).startsWith("cobro_pendiente") ? delta : 0));
        const inicial = money((c.montoRecibidoInicial || 0) + (String(m.subtipo).startsWith("cobro_pendiente") ? 0 : delta));
        tx.set(cxcRef, { saldoPendiente: saldo, montoRecibidoPosterior: posterior, montoRecibidoInicial: inicial, estado: saldo <= 0 ? "pagado" : (inicial + posterior > 0 ? "parcial" : "pendiente"), updatedAt: isoNow() }, { merge: true });
      }
      tx.set(marcaRef, { accion, movimientoId: id, reversaId: revId, sustitutoId, por: identity.usuario, motivo, createdAt: isoNow() });
      auditar(tx, db, identity, { origen: body.origen, accion, targetType: "movimiento", targetId: id, movimientoId: id, clienteId: m.clienteId, compraId: m.compraId, cuentaId: m.cuentaId || "", operationId: cleanText(body.operationId), motivo, monto: money(m.monto), before: { monto: money(m.monto), banco: m.banco || "", bancoId: m.bancoId || "" }, after: nuevo || { estado: "anulado" }, detalle: nuevo ? `${m.banco || "—"} L${money(m.monto)} → ${nuevo.banco} L${nuevo.monto}` : `Anulado L${money(m.monto)} ${m.banco || ""}`, bancos: [{ bancoId: m.bancoId || "", monto: -money(m.monto) }, ...(nuevo ? [{ bancoId: nuevo.bancoId, monto: nuevo.monto }] : [])] });
      return { duplicado: false, reversaId: revId, sustitutoId };
    });
    return reply(r);
  }

  // anular_pago_planilla / corregir_pago_planilla
  const pagoRef = db.collection("planilla_pagos").doc(cleanText(body.planillaPagoId) || "x");
  const r = await run(async (tx) => {
    if ((await tx.get(marcaRef)).exists) return { duplicado: true };
    const ps = await tx.get(pagoRef);
    if (!ps.exists) throw userErr("Ese pago de planilla no existe.");
    const p = ps.data() || {};
    if (p.estado !== "confirmado") throw userErr(`Ese pago ya está ${p.estado}.`);
    const hijos = await Promise.all((p.asignaciones || []).map((a) => tx.get(fmov(`${pagoRef.id}_${a.bancoId}`))));
    let nuevoPago = null, v = null;
    if (accion === "corregir_pago_planilla") {
      const { totales, saldos } = await estadoLibro(db, tx);
      // Se valida como si el pago original ya estuviera devuelto a sus bancos y al disponible.
      const bancos = saldos.bancos.map((b) => { const a = (p.asignaciones || []).find((x) => x.bancoId === b.id); return a ? { ...b, saldo: money(b.saldo + a.monto) } : b; });
      const conceptoId = PLANILLA_SUBTIPOS.has(cleanText(body.concepto)) ? cleanText(body.concepto) : p.concepto;
      const montoTotal = body.montoTotal != null && body.montoTotal !== "" ? money(body.montoTotal) : money(p.montoTotal);
      v = validatePlanilla({ montoTotal, asignaciones: Array.isArray(body.asignaciones) ? body.asignaciones : p.asignaciones, bancos, disponibleCiclo: money(totales.resultado + money(p.montoTotal)) });
      if (!v.ok) throw userErr(v.errors.join(" "));
      nuevoPago = { beneficiario: cleanText(body.beneficiario || p.beneficiario).slice(0, 80), concepto: conceptoId, conceptoLabel: PLANILLA_CONCEPTOS[conceptoId], descripcion: cleanText(body.descripcion ?? p.descripcion ?? "").slice(0, 160), montoTotal };
    }
    hijos.forEach((h) => { if (h.exists) reversa(tx, h.data() || {}, h.id, nuevoPago ? "corregido" : "anulado"); });
    let sustitutoId = "";
    if (nuevoPago) {
      const nRef = db.collection("planilla_pagos").doc(`${pagoRef.id}_c${Date.now().toString(36)}`);
      sustitutoId = nRef.id;
      tx.set(nRef, { ...p, ...nuevoPago, planillaPagoId: nRef.id, asignaciones: v.asignaciones, sustituyeA: pagoRef.id, motivoCorreccion: motivo, estado: "confirmado", registradoPor: identity.usuario, createdAt: isoNow(), updatedAt: isoNow() });
      for (const a of v.asignaciones) {
        const mRef = fmov(`${nRef.id}_${a.bancoId}`);
        tx.set(mRef, { ...baseMov(identity, authUser, body), movimientoId: mRef.id, tipo: "egreso", subtipo: nuevoPago.concepto, planillaPagoId: nRef.id, grupoId: nRef.id, cicloId: p.cicloId, beneficiario: nuevoPago.beneficiario, motivo: `${nuevoPago.conceptoLabel} · ${nuevoPago.beneficiario} (corrección)`, bancoId: a.bancoId, banco: a.banco, monto: a.monto, saldoAntes: a.saldoAntes, saldoDespues: a.saldoDespues, ...canonicalFinanceDate(p.fecha || hoy, hoy) });
      }
    }
    tx.set(pagoRef, { estado: nuevoPago ? "corregido" : "anulado", sustituidoPor: sustitutoId, anuladoPor: identity.usuario, anuladoAt: isoNow(), motivoAnulacion: motivo, updatedAt: isoNow() }, { merge: true });
    tx.set(marcaRef, { accion, planillaPagoId: pagoRef.id, sustitutoId, por: identity.usuario, motivo, createdAt: isoNow() });
    auditar(tx, db, identity, { origen: body.origen, modulo: "planilla", accion, targetType: "planilla_pago", targetId: pagoRef.id, planillaPagoId: pagoRef.id, operationId: cleanText(body.operationId), motivo, monto: money(p.montoTotal), before: { beneficiario: p.beneficiario, montoTotal: p.montoTotal, asignaciones: (p.asignaciones || []).map((a) => ({ banco: a.banco, monto: a.monto })) }, after: nuevoPago ? { ...nuevoPago, asignaciones: v.asignaciones.map((a) => ({ banco: a.banco, monto: a.monto })) } : { estado: "anulado" }, detalle: nuevoPago ? `${p.beneficiario} L${p.montoTotal} (${(p.asignaciones || []).map((a) => `${a.banco} ${a.monto}`).join(" + ")}) → ${nuevoPago.beneficiario} L${nuevoPago.montoTotal} (${v.asignaciones.map((a) => `${a.banco} ${a.monto}`).join(" + ")})` : `Anulado pago a ${p.beneficiario} L${p.montoTotal}` });
    return { duplicado: false, sustitutoId };
  });
  return reply(r);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, version: 2, msg: "finanzas v2 activo. Usá POST." });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Método no permitido" });

  try {
    const db = getApp().firestore();
    const authUser = await requireFirebaseUser(req, res);
    if (!authUser) return;
    const identity = authIdentity(authUser);
    const body = req.body || {};
    const accion = cleanText(body.accion || body.tipoAccion);
    const now = isoNow();

    if (accion === "guardar_cierre" && !identity.admin) {
      return res.status(403).json({ ok: false, error: "Esta acción corresponde únicamente a Sublicuentas." });
    }
    // R104: egresos operativos los registran Sublicuentas y Relojes (Finanzas nueva).
    if (accion === "registrar_egreso" && !canUseLibro(identity)) {
      return res.status(403).json({ ok: false, error: "Esta acción corresponde únicamente a Sublicuentas y Relojes." });
    }
    if (["registrar_operacion_pago", "listar_pagos_socios_sin_ficha", "socio_ficha_lista", "listar_pendientes", "registrar_abono", "registrar_transferencia", "ajustar_fecha_movimiento", "anular_movimiento", "anular_pago_planilla", "corregir_pago_planilla", "corregir_movimiento"].includes(accion)) {
      const handled = await handleCentro(db, accion, body, identity, authUser, res);
      if (handled !== null) return handled;
    }
    if (["finanzas_reporte", "finanzas_metodos", "finanzas_resumen", "finanzas_movimientos", "registrar_saldo_inicial", "registrar_ajuste_saldo", "confirmar_pago_planilla", "guardar_cierre_ciclo"].includes(accion)) {
      const handled = await handleLibro(db, accion, body, identity, authUser, res);
      if (handled !== null) return handled;
    }
    // R104: cobro de renovación con pago REAL: monto escrito y banco obligatorio, ligado a cliente/compra.
    if (accion === "registrar_cobro_renovacion") {
      if (!canUseLibro(identity)) return res.status(403).json({ ok: false, error: "Disponible solo para Sublicuentas y Relojes." });
      const methods = await loadMethods(db);
      if (!(cleanMoney(body.monto) > 0)) return res.status(200).json({ ok: false, error: "Escriba cuánto pagó el cliente (mayor que 0)." });
      if (!methods.some((m) => m.id === cleanText(body.bancoId))) return res.status(200).json({ ok: false, error: "Elija dónde pagó (método activo)." });
      body.subtipo = "cobro_renovacion";
    }

    if (accion === "registrar_cobro" || accion === "registrar_cobro_renovacion") {
      const monto = cleanMoney(body.monto);
      if (!monto) return res.status(200).json({ ok: false, error: "Falta el monto del cobro." });

      const financeDate = canonicalFinanceDate(body.fechaPago || body.fecha, hoyYmdHN()); // fecha de Honduras (antes UTC: de 6 PM a medianoche quedaba con fecha de mañana)
      const offId = finOpDocId(body, authUser?.uid);
      const movRef = offId ? db.collection("finanzas_movimientos").doc(offId) : db.collection("finanzas_movimientos").doc();
      if (offId) {
        const ya = await movRef.get();
        if (ya.exists) return res.status(200).json({ ok: true, accion, movimientoId: movRef.id, duplicado: true });
      }
      const movimiento = {
        ...financeMetadata({ docId: movRef.id, usuario: identity.usuario, userId: authUser.uid }),
        tipo: "ingreso",
        subtipo: "cobro_cliente",
        clienteNombre: cleanText(body.clienteNombre || body.nombrePerfil || body.nombre),
        clienteNorm: cleanText(body.clienteNorm) || normName(body.clienteNombre || body.nombrePerfil || body.nombre),
        telefono: cleanText(body.telefono),
        telefono_norm: normPhone(body.telefono),
        plataforma: cleanText(body.plataforma),
        monto,
        metodoPago: cleanText(body.metodoPago || body.metodo || "No especificado"), ...(cleanText(body.bancoId) ? { bancoId: cleanText(body.bancoId), banco: cleanText(body.metodoPago || body.bancoId) } : {}), // R114: banco enlazado
        ...(await cobroLinkFields(db, body)),
        cobradoPor: identity.usuario,
        vendedor: cleanText(body.vendedor),
        rol: identity.role,
        ...financeDate,
        createdAt: now,
        updatedAt: now
      };

      await movRef.set(movimiento);
      await db.collection("cobros").doc(movRef.id).set(movimiento, { merge: true });
      return res.status(200).json({ ok: true, accion, movimientoId: movRef.id });
    }

    if (accion === "registrar_egreso") {
      const monto = cleanMoney(body.monto);
      const motivo = cleanText(body.motivo || body.descripcion);
      if (!motivo || !monto) return res.status(200).json({ ok: false, error: "Falta motivo o monto del egreso." });

      const financeDate = canonicalFinanceDate(body.fecha || body.fechaPago, hoyYmdHN()); // fecha de Honduras
      const offId = finOpDocId(body, authUser?.uid);
      const movRef = offId ? db.collection("finanzas_movimientos").doc(offId) : db.collection("finanzas_movimientos").doc();
      if (offId) {
        const ya = await movRef.get();
        if (ya.exists) return res.status(200).json({ ok: true, accion, movimientoId: movRef.id, duplicado: true });
      }
      const movimiento = {
        ...financeMetadata({ docId: movRef.id, usuario: identity.usuario, userId: authUser.uid }),
        tipo: "egreso",
        subtipo: cleanText(body.subtipo || "egreso_operativo"),
        motivo,
        descripcion: cleanText(body.descripcion || motivo),
        monto,
        banco: cleanText(body.banco),
        ...(await egresoBankFields(db, body)),
        registradoPor: identity.usuario,
        rol: identity.role,
        ...financeDate,
        createdAt: now,
        updatedAt: now
      };

      await movRef.set(movimiento);
      await db.collection("egresos").doc(movRef.id).set(movimiento, { merge: true });
      return res.status(200).json({ ok: true, accion, movimientoId: movRef.id });
    }

    if (accion === "guardar_cierre") {
      const cierre = {
        tipo: "cierre_caja",
        fechaInicio: cleanText(body.fechaInicio),
        fechaFin: cleanText(body.fechaFin),
        ingresos: cleanMoney(body.ingresos),
        egresos: cleanMoney(body.egresos),
        neto: cleanMoney(body.neto),
        registradoPor: identity.usuario,
        rol: identity.role,
        nota: cleanText(body.nota),
        createdAt: now,
        updatedAt: now
      };

      const id = `${cierre.fechaInicio || now.slice(0,10)}_${cierre.registradoPor || "sublichat"}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      await db.collection("cierres_caja").doc(id).set(cierre, { merge: true });
      await db.collection("auditoria_eventos").add({
        tipo: "cierre_caja_guardado",
        cierreId: id,
        registradoPor: cierre.registradoPor,
        rol: cierre.rol,
        createdAt: now
      });
      return res.status(200).json({ ok: true, accion, cierreId: id });
    }

    return res.status(200).json({ ok: false, error: "Acción no reconocida." });
  } catch (e) {
    console.error("FINANZAS_ERROR", e);
    return res.status(200).json({ ok: false, error: "Error: " + (e.message || "") });
  }
}
