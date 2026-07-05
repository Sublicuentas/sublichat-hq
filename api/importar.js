<!doctype html><html><head><meta charset="utf-8"><title>api/importar.js para copiar</title><style>body{font-family:Arial;padding:20px;background:#f6f8fb}textarea{width:100%;height:90vh;font-family:monospace;font-size:13px}</style></head><body><h1>Copiar en api/importar.js</h1><textarea>// api/importar.js 路 Sublichat Archivos de trabajo por usuario
// Versi贸n CJS segura para Vercel. Guarda Bodega, Auditor铆a y Flujo diario en Firestore por hojas/bloques.
// No toca clientes, CRM operativo, inventario operativo ni bot Telegram.

const admin = require("firebase-admin");

function normalizePrivateKey(key = "") {
  return String(key || "").replace(/\\n/g, "\n");
}

function getApp() {
  if (admin.apps &amp;&amp; admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY || "");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltan variables Firebase Admin: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY.");
  }
  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
}

const SEC_COL = "secciones_trabajo";
const SECCIONES = {
  bodega:       { label: "Bodega",       kind: "excel", owner: "sublicuentas", emoji: "馃摝" },
  auditoria:    { label: "Auditor铆a",    kind: "excel", owner: "magdiel",      emoji: "馃搳" },
  flujo_diario: { label: "Flujo diario", kind: "word",  owner: "relojes",      emoji: "馃Ь" }
};
const ORDER = ["bodega", "auditoria", "flujo_diario"];

function ok(res, json = {}) { return res.status(200).json({ ok: true, ...json }); }
function fail(res, error, extra = {}) { return res.status(200).json({ ok: false, error: String(error &amp;&amp; error.message ? error.message : error), ...extra }); }
function secOk(s) { return Object.prototype.hasOwnProperty.call(SECCIONES, String(s || "")); }
function pad(n, w) { return String(Number(n) || 0).padStart(w, "0"); }
function cleanCell(v) { return v == null ? "" : String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, 700); }
function cleanFilas(filas) {
  if (!Array.isArray(filas)) return [];
  const out = [];
  for (const r of filas) {
    const arr = (Array.isArray(r) ? r : Object.values(r || {})).slice(0, 180).map(cleanCell);
    if (arr.some(v =&gt; String(v || "").trim() !== "")) out.push(arr);
  }
  return out;
}
function safeHojaName(name, index) { return String(name || `Hoja ${index}`).slice(0, 120); }
function uploadId() { return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; }
function emptySec(id) { const cfg = SECCIONES[id] || {}; return { id, label: cfg.label || id, kind: cfg.kind || "", owner: cfg.owner || "", emoji: cfg.emoji || "", hojas: [], totalHojas: 0, totalFilas: 0, filename: "", updatedAt: "", updatedBy: "", vacio: true }; }
function dataSec(id, d) { const cfg = SECCIONES[id] || {}; return { id, label: d.label || cfg.label || id, kind: d.kind || cfg.kind || "", owner: d.owner || cfg.owner || "", emoji: d.emoji || cfg.emoji || "", hojas: Array.isArray(d.hojas) ? d.hojas : [], totalHojas: Number(d.totalHojas) || 0, totalFilas: Number(d.totalFilas) || 0, filename: d.filename || "", updatedAt: d.updatedAt || "", updatedBy: d.updatedBy || "", vacio: false }; }

async function accionEstado(db, res) {
  const secciones = {};
  for (const id of ORDER) {
    const doc = await db.collection(SEC_COL).doc(id).get();
    secciones[id] = doc.exists ? dataSec(id, doc.data() || {}) : emptySec(id);
  }
  return ok(res, { secciones, config: SECCIONES });
}

async function accionLeer(db, res, body) {
  const seccion = String(body.seccion || "").trim();
  if (!secOk(seccion)) return fail(res, "Secci贸n no v谩lida");
  const doc = await db.collection(SEC_COL).doc(seccion).get();
  return ok(res, { seccion, ...(doc.exists ? dataSec(seccion, doc.data() || {}) : emptySec(seccion)) });
}

async function accionHojaIniciar(db, res, body) {
  const seccion = String(body.seccion || "").trim();
  if (!secOk(seccion)) return fail(res, "Secci贸n no v谩lida");
  const index = Number(body.index) || 1;
  const now = new Date().toISOString();
  const id = uploadId();
  await db.collection(SEC_COL).doc(seccion).collection("hojas").doc(pad(index, 3)).set({
    index,
    name: safeHojaName(body.name, index),
    rows: Math.max(0, Number(body.rows) || 0),
    cols: Math.max(0, Number(body.cols) || 0),
    uploadId: id,
    updatedAt: now,
    status: "uploading"
  }, { merge: true });
  return ok(res, { seccion, index, uploadId: id });
}

async function accionHojaBloque(db, res, body) {
  const seccion = String(body.seccion || "").trim();
  if (!secOk(seccion)) return fail(res, "Secci贸n no v谩lida");
  const index = Number(body.index) || 1;
  const bloque = Number(body.bloque) || 1;
  const filas = cleanFilas(body.filas || []);
  const hojaRef = db.collection(SEC_COL).doc(seccion).collection("hojas").doc(pad(index, 3));
  const hoja = await hojaRef.get();
  if (!hoja.exists) return fail(res, "Primero debe iniciar la hoja antes de subir bloques");
  const meta = hoja.data() || {};
  const up = meta.uploadId || uploadId();
  const payload = { bloque, total: filas.length, filas, updatedAt: new Date().toISOString() };
  const estimated = Buffer.byteLength(JSON.stringify(payload), "utf8");
  if (estimated &gt; 850000) return fail(res, `Bloque demasiado grande (${estimated} bytes). Reduzca filas por bloque.`);
  await hojaRef.collection("uploads").doc(up).collection("bloques").doc(pad(bloque, 4)).set(payload, { merge: false });
  return ok(res, { seccion, index, bloque, filas: filas.length });
}

async function accionFinalizar(db, res, body) {
  const seccion = String(body.seccion || "").trim();
  if (!secOk(seccion)) return fail(res, "Secci贸n no v谩lida");
  const cfg = SECCIONES[seccion];
  const now = new Date().toISOString();
  const editor = String(body.editor || body.usuario || "sublicuentas").trim().slice(0, 80);
  const filename = String(body.filename || "").slice(0, 180);
  const hojasRaw = Array.isArray(body.hojas) ? body.hojas : [];
  const hojas = [];
  for (let i = 0; i &lt; hojasRaw.length; i++) {
    const h = hojasRaw[i] || {};
    const index = Number(h.index) || i + 1;
    const hojaRef = db.collection(SEC_COL).doc(seccion).collection("hojas").doc(pad(index, 3));
    const hd = await hojaRef.get();
    const hm = hd.exists ? (hd.data() || {}) : {};
    hojas.push({
      index,
      name: safeHojaName(h.name || hm.name, index),
      rows: Number(h.rows || hm.rows) || 0,
      cols: Number(h.cols || hm.cols) || 0,
      uploadId: hm.uploadId || ""
    });
    await hojaRef.set({ status: "ready", updatedAt: now }, { merge: true });
  }
  const totalFilas = hojas.reduce((s, h) =&gt; s + (Number(h.rows) || 0), 0);
  await db.collection(SEC_COL).doc(seccion).set({
    id: seccion,
    label: cfg.label,
    kind: cfg.kind,
    owner: cfg.owner,
    emoji: cfg.emoji,
    hojas,
    totalHojas: hojas.length,
    totalFilas,
    filename,
    updatedAt: now,
    updatedBy: editor,
    motivo: String(body.motivo || "migracion").slice(0, 50),
    noModificaCRM: true,
    noModificaInventario: true,
    noModificaBotTelegram: true
  }, { merge: true });
  await db.collection("auditoria_eventos").add({ tipo: "seccion_trabajo_guardada", seccion, filename, totalHojas: hojas.length, totalFilas, editor, createdAt: now, noModificaCRM: true }).catch(() =&gt; null);
  return ok(res, { seccion, totalHojas: hojas.length, totalFilas, updatedAt: now });
}

async function accionHojaLeer(db, res, body) {
  const seccion = String(body.seccion || "").trim();
  if (!secOk(seccion)) return fail(res, "Secci贸n no v谩lida");
  const index = Number(body.index) || 1;
  const maxRows = Math.min(Math.max(Number(body.maxRows) || 5000, 50), 30000);
  const hojaRef = db.collection(SEC_COL).doc(seccion).collection("hojas").doc(pad(index, 3));
  const hd = await hojaRef.get();
  if (!hd.exists) return ok(res, { seccion, index, filas: [], vacio: true });
  const meta = hd.data() || {};
  const up = meta.uploadId || "";
  if (!up) return ok(res, { seccion, index, name: meta.name || `Hoja ${index}`, rows: meta.rows || 0, cols: meta.cols || 0, filas: [], vacio: true });
  const snap = await hojaRef.collection("uploads").doc(up).collection("bloques").get();
  let filas = [];
  snap.docs.map(d =&gt; d.data() || {}).sort((a, b) =&gt; (Number(a.bloque) || 0) - (Number(b.bloque) || 0)).forEach(b =&gt; { filas = filas.concat(b.filas || []); });
  const recortado = filas.length &gt; maxRows;
  filas = filas.slice(0, maxRows);
  return ok(res, { seccion, index, name: meta.name || `Hoja ${index}`, rows: Number(meta.rows) || filas.length, cols: Number(meta.cols) || (filas[0] ? filas[0].length : 0), filas, recortado });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, version: "archivos-trabajo-cjs-direct-safe-20260705", acciones: ["sec_estado", "sec_leer", "sec_hoja_iniciar", "sec_hoja_bloque", "sec_finalizar", "sec_hoja_leer"] });
  if (req.method !== "POST") return fail(res, "M茅todo no permitido");
  try {
    const body = req.body || {};
    const accion = String(body.accion || "sec_estado");
    const db = getApp().firestore();
    if (accion === "sec_estado") return accionEstado(db, res);
    if (accion === "sec_leer") return accionLeer(db, res, body);
    if (accion === "sec_hoja_iniciar") return accionHojaIniciar(db, res, body);
    if (accion === "sec_hoja_bloque") return accionHojaBloque(db, res, body);
    if (accion === "sec_finalizar") return accionFinalizar(db, res, body);
    if (accion === "sec_hoja_leer") return accionHojaLeer(db, res, body);
    return fail(res, `Acci贸n no reconocida: ${accion}`);
  } catch (e) {
    console.error("IMPORTAR_CJS_ERROR", e);
    return fail(res, e, { source: "api/importar.js", version: "archivos-trabajo-cjs-direct-safe-20260705" });
  }
};
</textarea></body></html>
