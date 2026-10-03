// api/finanzas.js · VERSION 2 · Movimientos financieros para Sublichat RBAC
// Guarda cobros, egresos y cierres en Firebase para que Sublichat y el bot de Telegram
// lean la misma base.
//
// Variables de entorno requeridas en Vercel:
// FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import admin from "firebase-admin";
import { financeMetadata } from "../lib/finance-schema.mjs";
import {
  PLANILLA_CONCEPTOS, PLANILLA_SUBTIPOS, SIN_BANCO, money, ymd, addDaysYmd, daysBetweenYmd,
  movementYmd, publicMethods, resolveBankId, movementKind, movementBankId, cycleTotals, bankBalances, validatePlanilla
} from "../lib/finanzas-libro.mjs";

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

function authIdentity(user) {
  const role = String(user && user.role || "").toLowerCase();
  const usuario = String(user && (user.usuario || user.uid) || "sublichat").toLowerCase();
  const adminUser = ["admin", "administrador", "sublicuentas", "owner"].includes(role) ||
    ["naara", "sublicuentas"].includes(usuario);
  const canonicalRole = adminUser ? "sublicuentas" :
    (["finanzas", "relojes"].includes(role) || ["libni", "relojes"].includes(usuario) ? "relojes" :
      (["auditor", "auditoria", "magdiel"].includes(role) || usuario === "magdiel" ? "magdiel" : role || "usuario"));
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
  const cicloInicio = data.cicloInicio || desdes[0] || hoyYmdHN();
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
    usuario: m.cobradoPor || m.registradoPor || m.userName || "", operationId: m.operationId || "",
  };
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
      totales, disponibleCiclo: totales.resultado, bancos: saldos.bancos, totalBancos: saldos.total,
      planillaPagos: rowsOf(pagosSnap).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      cierres: rowsOf(cierresSnap), conceptos: PLANILLA_CONCEPTOS,
    });
  }

  if (accion === "finanzas_movimientos") {
    const [methods, libroSnap] = await Promise.all([loadMethods(db), libroRef(db).get()]);
    const libro = libroFrom(libroSnap.exists ? libroSnap.data() : {});
    const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(body.desde || "")) ? body.desde : libro.cicloInicio;
    const hasta = /^\d{4}-\d{2}-\d{2}$/.test(String(body.hasta || "")) ? body.hasta : "";
    const snap = await movementsQuery(db, desde).limit(1500).get();
    let rows = rowsOf(snap).map((m) => movimientoView(m, methods)).filter((m) => m.kind !== "ignorar" && (!hasta || m.fecha <= hasta));
    if (body.tipo) rows = rows.filter((m) => m.kind === body.tipo);
    if (body.bancoId) rows = rows.filter((m) => m.bancoId === body.bancoId);
    const q = String(body.texto || "").toLowerCase().trim();
    if (q) rows = rows.filter((m) => [m.detalle, m.cliente, m.beneficiario, m.plataforma, m.usuario].join(" ").toLowerCase().includes(q));
    rows.sort((a, b) => (b.fecha + b.id).localeCompare(a.fecha + a.id));
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
      const totales = cycleTotals(hastaFin, libro.cicloInicio, fechaFin);
      const saldos = bankBalances(hastaFin, libro, methods);
      const cierre = {
        cicloId: libro.cicloId, estado: "cerrado", fechaInicio: libro.cicloInicio, fechaFin, ...totales,
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
    if (["finanzas_metodos", "finanzas_resumen", "finanzas_movimientos", "registrar_saldo_inicial", "registrar_ajuste_saldo", "confirmar_pago_planilla", "guardar_cierre_ciclo"].includes(accion)) {
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

      const financeDate = canonicalFinanceDate(body.fechaPago || body.fecha, now.slice(0, 10));
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
        metodoPago: cleanText(body.metodoPago || body.metodo || "No especificado"),
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

      const financeDate = canonicalFinanceDate(body.fecha || body.fechaPago, now.slice(0, 10));
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
