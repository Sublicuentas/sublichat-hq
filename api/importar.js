// api/importar.js · Respaldos Excel Sublichat
// Guarda, lista, abre y busca tablas de Excel guardadas en Firestore.
// No modifica clientes, servicios, inventario operativo ni bot Telegram.
// Requiere variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

const admin = require("firebase-admin");
const crypto = require("crypto");

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  privateKey = privateKey.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltan variables FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY.");
  }
  return admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

async function requireFirebaseUser(req, res) {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ ok: false, error: "Sesión requerida." });
    return null;
  }
  try {
    const user = await admin.auth().verifyIdToken(token);
    if (!String(user.usuario || "").trim() || !String(user.role || "").trim()) throw new Error("claims_missing");
    return user;
  } catch (_) {
    res.status(401).json({ ok: false, error: "Sesión inválida o vencida." });
    return null;
  }
}

function importIdentity(user) {
  const role = String(user && user.role || "").toLowerCase();
  const usuario = String(user && (user.usuario || user.uid) || "sublichat").toLowerCase();
  const canonicalRole = ["admin", "administrador", "sublicuentas", "owner"].includes(role) || ["naara", "sublicuentas"].includes(usuario)
    ? "sublicuentas"
    : (["finanzas", "relojes"].includes(role) || ["libni", "relojes"].includes(usuario)
      ? "relojes"
      : (["auditor", "auditoria", "magdiel"].includes(role) || usuario === "magdiel" ? "magdiel" : role || usuario));
  return { usuario, role: canonicalRole };
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function chunkString(str, size) {
  const s = String(str || "");
  const out = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

function cleanRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const o = {};
    Object.keys(row || {}).forEach((k) => {
      const key = String(k || "").trim().slice(0, 80) || "campo";
      const v = row[k];
      o[key] = v == null ? "" : String(v).trim();
    });
    return o;
  }).filter((r) => Object.values(r).some((v) => String(v || "").trim() !== ""));
}

function cleanSheets(sheets) {
  if (!Array.isArray(sheets)) return [];
  return sheets.map((s, i) => ({
    index: Number(s && s.index) || i + 1,
    name: String(s && s.name ? s.name : `Hoja ${i + 1}`).trim().slice(0, 80),
    rows: cleanRows((s && s.rows) || [])
  })).filter((s) => s.rows.length);
}

function safeTipo(tipo) {
  const t = String(tipo || "").trim().toLowerCase();
  if (t === "streaming") return "streaming";
  if (t === "inventario") return "inventario";
  return "general";
}

function labelTipo(tipo) {
  if (tipo === "streaming") return "Sublicuentas streaming / Magdiel";
  if (tipo === "inventario") return "Inventario de sublicuentas / Admin";
  return "Respaldo Excel";
}

function legacyDenied() {
  return { status: 403, json: { ok: false, error: "No tiene permiso para consultar ese documento." } };
}

function legacyExcelCanAccess(body, tipo) {
  const role = secRole(body);
  const safe = safeTipo(tipo);
  if (role === "sublicuentas") return true;
  return role === "magdiel" && safe === "streaming";
}

function legacyWordCanAccess(body) {
  const role = secRole(body);
  return role === "sublicuentas" || role === "relojes";
}

function normalizeText(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function rowMatches(row, q) {
  const nq = normalizeText(q);
  if (!nq) return true;
  return normalizeText(Object.values(row || {}).join(" ")).includes(nq);
}

async function guardarRespaldo(db, body) {
  const tipo = safeTipo(body.tipo);
  if (!legacyExcelCanAccess(body, tipo)) return legacyDenied();
  const filename = String(body.filename || "").trim();
  const usuario = String(body.usuario || "sublicuentas").trim();
  const rol = String(body.rol || "admin").trim();
  const destinoRol = String(body.destinoRol || (tipo === "streaming" ? "auditor" : "admin")).trim();
  const archivoOriginal = body.archivoOriginal && typeof body.archivoOriginal === "object" ? body.archivoOriginal : null;
  const archivoBase64 = archivoOriginal && archivoOriginal.base64 ? String(archivoOriginal.base64) : "";
  const now = new Date().toISOString();

  let sheets = cleanSheets(body.sheets || []);
  if (!sheets.length && Array.isArray(body.rows)) {
    sheets = [{ index: 1, name: "Hoja 1", rows: cleanRows(body.rows) }].filter((s) => s.rows.length);
  }
  const totalFilas = sheets.reduce((sum, s) => sum + s.rows.length, 0);
  if (!totalFilas) return { status: 400, json: { ok: false, error: "No hay filas de Excel para guardar" } };

  const ref = db.collection("respaldos_excel").doc();
  const resumenHojas = sheets.map((s) => ({ index: s.index, name: s.name, totalFilas: s.rows.length }));
  const resumen = {
    tipo,
    tipoLabel: labelTipo(tipo),
    filename,
    usuario,
    rol,
    destinoRol,
    totalHojas: sheets.length,
    totalFilas,
    hojas: resumenHojas,
    archivoGuardado: !!archivoBase64,
    archivoOriginal: archivoBase64 ? {
      filename: String((archivoOriginal && archivoOriginal.filename) || filename || "respaldo.xlsx").slice(0, 180),
      size: Number((archivoOriginal && archivoOriginal.size) || 0),
      mime: String((archivoOriginal && archivoOriginal.mime) || "application/octet-stream").slice(0, 120),
      ext: String((archivoOriginal && archivoOriginal.ext) || "").slice(0, 20),
      base64Length: archivoBase64.length,
      chunks: Math.ceil(archivoBase64.length / 450000)
    } : null,
    estado: "excel_guardado_completo_solo_respaldo",
    noModificaCRM: true,
    noModificaInventario: true,
    noModificaBotTelegram: true,
    createdAt: now,
    updatedAt: now
  };

  await ref.set(resumen);

  if (archivoBase64) {
    const chunksArchivo = chunkString(archivoBase64, 450000);
    let batchFile = db.batch();
    let opsFile = 0;
    for (let i = 0; i < chunksArchivo.length; i++) {
      const cRef = ref.collection("archivo_original").doc(String(i + 1).padStart(4, "0"));
      batchFile.set(cRef, {
        index: i + 1,
        totalChunks: chunksArchivo.length,
        base64: chunksArchivo[i],
        filename: String((archivoOriginal && archivoOriginal.filename) || filename || "respaldo.xlsx").slice(0, 180),
        createdAt: now
      });
      opsFile++;
      if (opsFile >= 400) { await batchFile.commit(); batchFile = db.batch(); opsFile = 0; }
    }
    if (opsFile) await batchFile.commit();
  }

  for (const sheet of sheets) {
    const sheetRef = ref.collection("hojas").doc(String(sheet.index).padStart(3, "0"));
    await sheetRef.set({ index: sheet.index, name: sheet.name, totalFilas: sheet.rows.length, createdAt: now });
    const chunks = chunkArray(sheet.rows, 300);
    let batch = db.batch();
    let ops = 0;
    for (let i = 0; i < chunks.length; i++) {
      const cRef = sheetRef.collection("filas").doc(String(i + 1).padStart(4, "0"));
      batch.set(cRef, { index: i + 1, total: chunks[i].length, rows: chunks[i], createdAt: now });
      ops++;
      if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
    }
    if (ops) await batch.commit();
  }

  await db.collection("auditoria_eventos").add({
    tipo: "respaldo_excel_guardado",
    respaldoExcelId: ref.id,
    respaldoTipo: tipo,
    filename,
    totalHojas: sheets.length,
    totalFilas,
    archivoGuardado: !!archivoBase64,
    archivoOriginalChunks: archivoBase64 ? Math.ceil(archivoBase64.length / 450000) : 0,
    usuario,
    rol,
    destinoRol,
    noModificaCRM: true,
    createdAt: now
  });

  return { status: 200, json: { ok: true, id: ref.id, totalHojas: sheets.length, totalFilas, archivoGuardado: !!archivoBase64, archivoOriginalChunks: archivoBase64 ? Math.ceil(archivoBase64.length / 450000) : 0, estado: resumen.estado } };
}

async function listarRespaldos(db, body) {
  const tipo = safeTipo(body.tipo);
  const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 50);
  let q = db.collection("respaldos_excel");
  if (tipo !== "general") q = q.where("tipo", "==", tipo);
  // Evita depender de índices compuestos: si falla orderBy, hacemos fallback sin orden.
  let snap;
  try { snap = await q.orderBy("createdAt", "desc").limit(limit).get(); }
  catch (_) { snap = await q.limit(limit).get(); }
  const items = snap.docs.filter(d => legacyExcelCanAccess(body, (d.data() || {}).tipo)).map(d => {
    const x = d.data() || {};
    return {
      id: d.id,
      tipo: x.tipo,
      tipoLabel: x.tipoLabel,
      filename: x.filename,
      totalHojas: x.totalHojas || (Array.isArray(x.hojas) ? x.hojas.length : 0),
      totalFilas: x.totalFilas || 0,
      hojas: x.hojas || [],
      archivoGuardado: !!x.archivoGuardado,
      usuario: x.usuario,
      rol: x.rol,
      destinoRol: x.destinoRol,
      createdAt: x.createdAt,
      updatedAt: x.updatedAt
    };
  }).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
  return { ok: true, items };
}

async function leerRespaldo(db, body) {
  const id = String(body.id || "").trim();
  if (!id) return { status: 400, json: { ok: false, error: "Falta id del respaldo" } };
  const doc = await db.collection("respaldos_excel").doc(id).get();
  if (!doc.exists) return { status: 404, json: { ok: false, error: "No encontré ese respaldo Excel" } };
  const meta = doc.data() || {};
  if (!legacyExcelCanAccess(body, meta.tipo)) return legacyDenied();
  const hojas = Array.isArray(meta.hojas) ? meta.hojas : [];
  const sheetIndex = Number(body.sheetIndex) || Number(hojas[0]?.index) || 1;
  const sheetId = String(sheetIndex).padStart(3, "0");
  const sheetRef = doc.ref.collection("hojas").doc(sheetId);
  const sheetDoc = await sheetRef.get();
  let sheetName = hojas.find(h => Number(h.index) === Number(sheetIndex))?.name || `Hoja ${sheetIndex}`;
  if (sheetDoc.exists && sheetDoc.data()?.name) sheetName = sheetDoc.data().name;
  const chunkSnap = await sheetRef.collection("filas").orderBy("index", "asc").limit(30).get();
  let rows = [];
  chunkSnap.docs.forEach(c => { rows = rows.concat((c.data() || {}).rows || []); });
  const maxRows = Math.min(Math.max(Number(body.maxRows) || 1000, 50), 9000);
  rows = rows.slice(0, maxRows);
  return { status: 200, json: { ok: true, id: doc.id, ...meta, hojas, sheetIndex, sheetName, rows, maxRows } };
}

async function buscarRespaldos(db, body) {
  const tipo = safeTipo(body.tipo);
  const q = String(body.q || "").trim();
  if (!q) return { status: 400, json: { ok: false, error: "Escriba algo para buscar" } };
  const limit = Math.min(Math.max(Number(body.limit) || 200, 20), 300);
  const list = await listarRespaldos(db, { tipo, limit: 12 });
  const results = [];
  for (const item of list.items || []) {
    if (results.length >= limit) break;
    const ref = db.collection("respaldos_excel").doc(item.id);
    const hojas = Array.isArray(item.hojas) ? item.hojas : [];
    for (const h of hojas) {
      if (results.length >= limit) break;
      const sheetIndex = Number(h.index) || 1;
      const sheetRef = ref.collection("hojas").doc(String(sheetIndex).padStart(3, "0"));
      const chunks = await sheetRef.collection("filas").orderBy("index", "asc").limit(60).get();
      for (const ch of chunks.docs) {
        if (results.length >= limit) break;
        const rows = (ch.data() || {}).rows || [];
        for (const row of rows) {
          if (rowMatches(row, q)) {
            results.push({
              respaldoId: item.id,
              filename: item.filename,
              tipo: item.tipo,
              sheetIndex,
              sheetName: h.name || `Hoja ${sheetIndex}`,
              row
            });
            if (results.length >= limit) break;
          }
        }
      }
    }
  }
  return { status: 200, json: { ok: true, q, total: results.length, results } };
}


async function deleteCollectionInBatches(collectionRef, batchSize = 300) {
  while (true) {
    const snap = await collectionRef.limit(batchSize).get();
    if (snap.empty) break;
    const batch = collectionRef.firestore.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    if (snap.size < batchSize) break;
  }
}

async function actualizarRespaldoExcel(db, body) {
  const id = String(body.id || "").trim();
  if (!id) return { status: 400, json: { ok: false, error: "Falta id del Excel" } };
  const sheetIndex = Number(body.sheetIndex) || 1;
  const rows = cleanRows(body.rows || []);
  const usuario = String(body.usuario || "sublicuentas").trim();
  const rol = String(body.rol || "admin").trim();
  const now = new Date().toISOString();
  const ref = db.collection("respaldos_excel").doc(id);
  const doc = await ref.get();
  if (!doc.exists) return { status: 404, json: { ok: false, error: "No encontré ese Excel guardado" } };
  const meta = doc.data() || {};
  if (!legacyExcelCanAccess(body, meta.tipo)) return legacyDenied();
  const hojasMeta = Array.isArray(meta.hojas) ? meta.hojas : [];
  const sheetId = String(sheetIndex).padStart(3, "0");
  const sheetName = hojasMeta.find(h => Number(h.index) === Number(sheetIndex))?.name || `Hoja ${sheetIndex}`;
  const sheetRef = ref.collection("hojas").doc(sheetId);
  await deleteCollectionInBatches(sheetRef.collection("filas"));
  await sheetRef.set({ index: sheetIndex, name: sheetName, totalFilas: rows.length, updatedAt: now, editable: true }, { merge: true });
  const chunks = chunkArray(rows, 300);
  let batch = db.batch();
  let ops = 0;
  for (let i = 0; i < chunks.length; i++) {
    const cRef = sheetRef.collection("filas").doc(String(i + 1).padStart(4, "0"));
    batch.set(cRef, { index: i + 1, total: chunks[i].length, rows: chunks[i], updatedAt: now });
    ops++;
    if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
  }
  if (ops) await batch.commit();
  const newHojas = hojasMeta.map(h => Number(h.index) === Number(sheetIndex) ? { ...h, totalFilas: rows.length } : h);
  const totalFilas = newHojas.reduce((sum, h) => sum + Number(h.totalFilas || 0), 0);
  await ref.update({ hojas: newHojas, totalFilas, updatedAt: now, editable: true, ultimoEditor: usuario, ultimoRol: rol });
  await db.collection("auditoria_eventos").add({ tipo: "respaldo_excel_editado", respaldoExcelId: id, sheetIndex, totalFilasHoja: rows.length, usuario, rol, createdAt: now, noModificaCRM: true });
  return { status: 200, json: { ok: true, id, sheetIndex, totalFilasHoja: rows.length, totalFilas, updatedAt: now } };
}

function cleanWordRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    Fecha: String(r.Fecha || r.fecha || "").trim(),
    Nombre: String(r.Nombre || r.nombre || "").trim(),
    Plataforma: String(r.Plataforma || r.plataforma || "").trim(),
    Precio: String(r.Precio || r.precio || "").trim(),
    "Teléfono": String(r["Teléfono"] || r.Telefono || r.telefono || "").trim(),
    Detalle: String(r.Detalle || r.detalle || "").trim()
  })).filter((r) => Object.values(r).some((v) => String(v || "").trim() !== ""));
}

async function guardarRespaldoWord(db, body) {
  if (!legacyWordCanAccess(body)) return legacyDenied();
  const filename = String(body.filename || "LISTA RELOJES.docx").trim();
  const usuario = String(body.usuario || "sublicuentas").trim();
  const rol = String(body.rol || "admin").trim();
  const rawText = String(body.rawText || "");
  const rows = cleanWordRows(body.rows || []);
  const archivoOriginal = body.archivoOriginal && typeof body.archivoOriginal === "object" ? body.archivoOriginal : null;
  const archivoBase64 = archivoOriginal && archivoOriginal.base64 ? String(archivoOriginal.base64) : "";
  const now = new Date().toISOString();
  if (!rows.length && !rawText.trim()) return { status: 400, json: { ok: false, error: "No hay datos del Word para guardar" } };
  const ref = db.collection("respaldos_word").doc();
  await ref.set({
    filename,
    tipo: "word_relojes",
    tipoLabel: "Word Relojes / Cobros",
    usuario,
    rol,
    totalFilas: rows.length,
    editable: true,
    archivoGuardado: !!archivoBase64,
    archivoOriginal: archivoBase64 ? {
      filename: String((archivoOriginal && archivoOriginal.filename) || filename).slice(0, 180),
      size: Number((archivoOriginal && archivoOriginal.size) || 0),
      mime: String((archivoOriginal && archivoOriginal.mime) || "application/octet-stream").slice(0, 120),
      ext: "docx",
      base64Length: archivoBase64.length,
      chunks: Math.ceil(archivoBase64.length / 450000)
    } : null,
    rawTextChunks: Math.ceil(rawText.length / 450000),
    noModificaCRM: true,
    noModificaBotTelegram: true,
    createdAt: now,
    updatedAt: now
  });
  if (archivoBase64) {
    const chunksArchivo = chunkString(archivoBase64, 450000);
    let batchFile = db.batch(); let opsFile = 0;
    for (let i = 0; i < chunksArchivo.length; i++) {
      const cRef = ref.collection("archivo_original").doc(String(i + 1).padStart(4, "0"));
      batchFile.set(cRef, { index: i + 1, totalChunks: chunksArchivo.length, base64: chunksArchivo[i], filename, createdAt: now });
      opsFile++;
      if (opsFile >= 400) { await batchFile.commit(); batchFile = db.batch(); opsFile = 0; }
    }
    if (opsFile) await batchFile.commit();
  }
  const rawChunks = chunkString(rawText, 450000);
  let rawBatch = db.batch(); let rawOps = 0;
  for (let i = 0; i < rawChunks.length; i++) {
    const cRef = ref.collection("texto_original").doc(String(i + 1).padStart(4, "0"));
    rawBatch.set(cRef, { index: i + 1, text: rawChunks[i], createdAt: now });
    rawOps++;
    if (rawOps >= 400) { await rawBatch.commit(); rawBatch = db.batch(); rawOps = 0; }
  }
  if (rawOps) await rawBatch.commit();
  await guardarWordRows(ref, rows, now);
  await db.collection("auditoria_eventos").add({ tipo: "respaldo_word_guardado", respaldoWordId: ref.id, filename, totalFilas: rows.length, usuario, rol, createdAt: now, noModificaCRM: true });
  return { status: 200, json: { ok: true, id: ref.id, totalFilas: rows.length, archivoGuardado: !!archivoBase64, updatedAt: now } };
}

async function guardarWordRows(ref, rows, now) {
  await deleteCollectionInBatches(ref.collection("filas"));
  const chunks = chunkArray(rows, 300);
  let batch = ref.firestore.batch(); let ops = 0;
  for (let i = 0; i < chunks.length; i++) {
    const cRef = ref.collection("filas").doc(String(i + 1).padStart(4, "0"));
    batch.set(cRef, { index: i + 1, total: chunks[i].length, rows: chunks[i], updatedAt: now });
    ops++;
    if (ops >= 400) { await batch.commit(); batch = ref.firestore.batch(); ops = 0; }
  }
  if (ops) await batch.commit();
}

async function listarRespaldosWord(db, body) {
  if (!legacyWordCanAccess(body)) return legacyDenied();
  const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 50);
  let snap;
  try { snap = await db.collection("respaldos_word").orderBy("createdAt", "desc").limit(limit).get(); }
  catch (_) { snap = await db.collection("respaldos_word").limit(limit).get(); }
  const items = snap.docs.map(d => {
    const x = d.data() || {};
    return { id: d.id, filename: x.filename, tipo: x.tipo, tipoLabel: x.tipoLabel, totalFilas: x.totalFilas || 0, editable: !!x.editable, archivoGuardado: !!x.archivoGuardado, usuario: x.usuario, rol: x.rol, createdAt: x.createdAt, updatedAt: x.updatedAt };
  }).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
  return { ok: true, items };
}

async function leerRespaldoWord(db, body) {
  if (!legacyWordCanAccess(body)) return legacyDenied();
  const id = String(body.id || "").trim();
  if (!id) return { status: 400, json: { ok: false, error: "Falta id del Word" } };
  const doc = await db.collection("respaldos_word").doc(id).get();
  if (!doc.exists) return { status: 404, json: { ok: false, error: "No encontré ese Word guardado" } };
  const meta = doc.data() || {};
  const maxRows = Math.min(Math.max(Number(body.maxRows) || 1000, 50), 9000);
  const chunks = await doc.ref.collection("filas").orderBy("index", "asc").limit(60).get();
  let rows = [];
  chunks.docs.forEach(c => { rows = rows.concat((c.data() || {}).rows || []); });
  rows = rows.slice(0, maxRows);
  return { status: 200, json: { ok: true, id: doc.id, ...meta, rows, maxRows } };
}

async function actualizarRespaldoWord(db, body) {
  if (!legacyWordCanAccess(body)) return legacyDenied();
  const id = String(body.id || "").trim();
  if (!id) return { status: 400, json: { ok: false, error: "Falta id del Word" } };
  const rows = cleanWordRows(body.rows || []);
  const usuario = String(body.usuario || "sublicuentas").trim();
  const rol = String(body.rol || "admin").trim();
  const now = new Date().toISOString();
  const ref = db.collection("respaldos_word").doc(id);
  const doc = await ref.get();
  if (!doc.exists) return { status: 404, json: { ok: false, error: "No encontré ese Word guardado" } };
  await guardarWordRows(ref, rows, now);
  await ref.update({ totalFilas: rows.length, updatedAt: now, ultimoEditor: usuario, ultimoRol: rol, editable: true });
  await db.collection("auditoria_eventos").add({ tipo: "respaldo_word_editado", respaldoWordId: id, totalFilas: rows.length, usuario, rol, createdAt: now, noModificaCRM: true });
  return { status: 200, json: { ok: true, id, totalFilas: rows.length, updatedAt: now } };
}


async function iniciarRespaldoExcel(db, body) {
  const tipo = safeTipo(body.tipo);
  if (!legacyExcelCanAccess(body, tipo)) return legacyDenied();
  const filename = String(body.filename || "respaldo.xlsx").trim();
  const usuario = String(body.usuario || "sublicuentas").trim();
  const rol = String(body.rol || "admin").trim();
  const destinoRol = String(body.destinoRol || (tipo === "streaming" ? "auditor" : "admin")).trim();
  const now = new Date().toISOString();
  const hojasRaw = Array.isArray(body.hojas) ? body.hojas : [];
  const hojas = hojasRaw.map((h, i) => ({
    index: Number(h && h.index) || i + 1,
    name: String((h && h.name) || `Hoja ${i + 1}`).slice(0, 80),
    totalFilas: Number(h && h.totalFilas) || 0
  })).filter(h => h.totalFilas > 0);
  const totalFilas = Number(body.totalFilas) || hojas.reduce((a, h) => a + Number(h.totalFilas || 0), 0);
  if (!hojas.length || !totalFilas) return { status: 400, json: { ok: false, error: "No hay hojas/filas para iniciar respaldo" } };
  const ref = db.collection("respaldos_excel").doc();
  await ref.set({
    tipo,
    tipoLabel: labelTipo(tipo),
    filename,
    usuario,
    rol,
    destinoRol,
    totalHojas: hojas.length,
    totalFilas,
    hojas,
    editable: true,
    archivoGuardado: false,
    estado: "subiendo_por_partes",
    noModificaCRM: true,
    noModificaInventario: true,
    noModificaBotTelegram: true,
    createdAt: now,
    updatedAt: now
  });
  return { status: 200, json: { ok: true, id: ref.id, totalHojas: hojas.length, totalFilas, estado: "subiendo_por_partes" } };
}

async function guardarRespaldoExcelChunk(db, body) {
  const id = String(body.id || "").trim();
  if (!id) return { status: 400, json: { ok: false, error: "Falta id del Excel" } };
  const sheetIndex = Number(body.sheetIndex) || 1;
  const sheetName = String(body.sheetName || `Hoja ${sheetIndex}`).slice(0, 80);
  const chunkIndex = Number(body.chunkIndex) || 1;
  const totalChunks = Number(body.totalChunks) || 1;
  const rows = cleanRows(body.rows || []);
  const now = new Date().toISOString();
  const ref = db.collection("respaldos_excel").doc(id);
  const doc = await ref.get();
  if (!doc.exists) return { status: 404, json: { ok: false, error: "No encontré ese respaldo iniciado" } };
  if (!legacyExcelCanAccess(body, (doc.data() || {}).tipo)) return legacyDenied();
  const sheetRef = ref.collection("hojas").doc(String(sheetIndex).padStart(3, "0"));
  await sheetRef.set({ index: sheetIndex, name: sheetName, updatedAt: now, editable: true }, { merge: true });
  await sheetRef.collection("filas").doc(String(chunkIndex).padStart(4, "0")).set({
    index: chunkIndex,
    totalChunks,
    total: rows.length,
    rows,
    updatedAt: now
  });
  await ref.update({ updatedAt: now, estado: "subiendo_por_partes" });
  return { status: 200, json: { ok: true, id, sheetIndex, chunkIndex, total: rows.length } };
}

async function finalizarRespaldoExcel(db, body) {
  const id = String(body.id || "").trim();
  if (!id) return { status: 400, json: { ok: false, error: "Falta id del Excel" } };
  const usuario = String(body.usuario || "sublicuentas").trim();
  const rol = String(body.rol || "admin").trim();
  const now = new Date().toISOString();
  const ref = db.collection("respaldos_excel").doc(id);
  const doc = await ref.get();
  if (!doc.exists) return { status: 404, json: { ok: false, error: "No encontré ese respaldo Excel" } };
  const meta = doc.data() || {};
  if (!legacyExcelCanAccess(body, meta.tipo)) return legacyDenied();
  await ref.update({ estado: "guardado_editable", editable: true, updatedAt: now, ultimoEditor: usuario, ultimoRol: rol });
  await db.collection("auditoria_eventos").add({
    tipo: "respaldo_excel_guardado_por_partes",
    respaldoExcelId: id,
    filename: meta.filename || "",
    respaldoTipo: meta.tipo || "",
    totalHojas: meta.totalHojas || 0,
    totalFilas: meta.totalFilas || 0,
    usuario,
    rol,
    noModificaCRM: true,
    createdAt: now
  });
  return { status: 200, json: { ok: true, id, estado: "guardado_editable", totalHojas: meta.totalHojas || 0, totalFilas: meta.totalFilas || 0 } };
}

/* ============================================================
   CONTROL MAESTRO · SOLO USUARIO SUBLICUENTAS

   Conserva el Excel original y los respaldos generados como archivos
   privados divididos en bloques de Firestore. El navegador usa el Excel
   original como plantilla, lo compara con clientes/inventario y genera
   una copia nueva sin publicar datos dentro del código estático.
   ============================================================ */
const CONTROL_ARCHIVOS_COL = "control_maestro_archivos";
const CONTROL_CONFIG_COL = "control_maestro_config";
const CONTROL_REVISIONES_COL = "control_maestro_revisiones";
const CONTROL_CONFIG_DOC = "principal";
const CONTROL_CHUNK_SIZE = 450000;
const CONTROL_MAX_BASE64 = 20 * 1024 * 1024;
// Una respuesta grande de una función serverless puede cortarse antes de llegar
// al navegador. Los archivos grandes se sirven bloque por bloque; los pequeños
// conservan la respuesta completa por compatibilidad con versiones anteriores.
const CONTROL_INLINE_MAX_BASE64 = 1200000;
const CONTROL_BACKUPS_DIA = 2;

function controlDateKey(value) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Tegucigalpa", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value || Date.now()));
    const get = (type) => (parts.find((x) => x.type === type) || {}).value || "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch (_) {
    return new Date(value || Date.now()).toISOString().slice(0, 10);
  }
}

function controlEsAdmin(body) {
  const usuario = String(body && (body.usuario || body.editor) || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const rol = String(body && body.rol || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  return ["sublicuentas", "naara"].includes(usuario) || ["sublicuentas", "admin", "administrador", "owner"].includes(rol);
}

function controlDenegado() {
  return { status: 403, json: { ok: false, error: "Control Maestro es exclusivo del usuario Sublicuentas." } };
}

function controlArchivoMeta(id, x) {
  const d = x || {};
  return {
    id,
    clase: d.clase || "respaldo",
    filename: d.filename || "Sublicuentas.xlsx",
    size: Number(d.size) || 0,
    mime: d.mime || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    chunks: Number(d.chunks) || 0,
    dateKey: d.dateKey || String(d.createdAt || "").slice(0, 10),
    createdAt: d.createdAt || "",
    createdBy: d.createdBy || "",
    motivo: d.motivo || "manual",
    metricas: d.metricas || {},
    listo: d.estado === "listo"
  };
}

function controlRevisionMeta(id, x) {
  const d = x || {};
  return {
    id,
    accountKey: String(d.accountKey || ""),
    accountId: String(d.accountId || ""),
    plataforma: String(d.plataforma || ""),
    correo: String(d.correo || ""),
    resultado: d.resultado === "incidencia" ? "incidencia" : "correcta",
    nota: String(d.nota || "").slice(0, 500),
    clientesEsperados: Math.max(0, Number(d.clientesEsperados) || 0),
    diferencias: Math.max(0, Number(d.diferencias) || 0),
    revisadoAt: String(d.revisadoAt || ""),
    revisadoPor: String(d.revisadoPor || "")
  };
}

async function controlListarRevisiones(db) {
  try {
    const snap = await db.collection(CONTROL_REVISIONES_COL).limit(1000).get();
    return snap.docs.map((d) => controlRevisionMeta(d.id, d.data()));
  } catch (_) {
    return [];
  }
}

async function controlGuardarRevisionCuenta(db, body) {
  if (!controlEsAdmin(body)) return controlDenegado();
  const plataforma = String(body.plataforma || "").toLowerCase().trim().slice(0, 80);
  const correo = String(body.correo || "").toLowerCase().trim().slice(0, 220);
  const accountKeyEnviado = String(body.accountKey || "").trim().slice(0, 500);
  if (!plataforma || (!correo && !accountKeyEnviado)) return { status: 400, json: { ok: false, error: "La cuenta necesita plataforma y una identificación válida para guardar su revisión." } };
  // Para Windows/ESET el identificador estable no es un correo: viene de la
  // cuenta de Bodega. El endpoint sigue siendo exclusivo del administrador.
  const accountKey = accountKeyEnviado || `${plataforma}|${correo}`;
  const id = crypto.createHash("sha256").update(accountKey).digest("hex");
  const resultado = body.resultado === "incidencia" ? "incidencia" : "correcta";
  const nota = String(body.nota || "").trim().slice(0, 500);
  const now = new Date().toISOString();
  const revisadoPor = String(body.usuario || body.editor || "sublicuentas").trim();
  const data = {
    version: "control-maestro-revision-v1",
    accountKey,
    accountId: String(body.accountId || "").trim().slice(0, 220),
    plataforma,
    correo,
    resultado,
    nota,
    clientesEsperados: Math.max(0, Math.round(Number(body.clientesEsperados) || 0)),
    diferencias: Math.max(0, Math.round(Number(body.diferencias) || 0)),
    revisadoAt: now,
    revisadoPor,
    updatedAt: now,
    owner: "sublicuentas",
    privado: true,
    totalRevisiones: admin.firestore.FieldValue.increment(1)
  };
  await db.collection(CONTROL_REVISIONES_COL).doc(id).set(data, { merge: true });
  await db.collection("auditoria_eventos").add({
    tipo: "control_maestro_cuenta_revisada",
    cuentaRevisionId: id,
    plataforma,
    correo,
    resultado,
    nota,
    clientesEsperados: data.clientesEsperados,
    diferencias: data.diferencias,
    usuario: revisadoPor,
    rol: "sublicuentas",
    createdAt: now
  });
  return { status: 200, json: { ok: true, revision: controlRevisionMeta(id, data) } };
}

async function controlEliminarIncidenciaCuenta(db, body) {
  if (!controlEsAdmin(body)) return controlDenegado();
  const accountKey = String(body.accountKey || "").trim().slice(0, 500);
  if (!accountKey) return { status: 400, json: { ok: false, error: "Falta la identificación de la cuenta." } };
  const id = crypto.createHash("sha256").update(accountKey).digest("hex");
  const ref = db.collection(CONTROL_REVISIONES_COL).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { status: 200, json: { ok: true, eliminada: false, accountKey } };
  const anterior = snap.data() || {};
  // Esta acción existe únicamente para borrar una marca de incidencia. Nunca
  // puede usarse como atajo para eliminar una cuenta, una ficha o una revisión
  // correcta del proveedor.
  if (anterior.resultado !== "incidencia") {
    return { status: 409, json: { ok: false, error: "La revisión actual no es una incidencia y no se eliminó." } };
  }
  const now = new Date().toISOString();
  const usuario = String(body.usuario || body.editor || "sublicuentas").trim();
  await db.runTransaction(async (transaction) => {
    const latest = await transaction.get(ref);
    if (!latest.exists) return;
    const data = latest.data() || {};
    if (data.resultado !== "incidencia") throw new Error("La incidencia cambió antes de eliminarse. Actualice la pantalla.");
    transaction.delete(ref);
    transaction.set(db.collection("auditoria_eventos").doc(), {
      tipo: "control_maestro_incidencia_eliminada",
      cuentaRevisionId: id,
      accountKey,
      accountId: String(data.accountId || ""),
      plataforma: String(data.plataforma || ""),
      correo: String(data.correo || ""),
      notaAnterior: String(data.nota || "").slice(0, 500),
      revisadoPorAnterior: String(data.revisadoPor || ""),
      usuario,
      rol: "sublicuentas",
      createdAt: now
    });
  });
  return { status: 200, json: { ok: true, eliminada: true, accountKey } };
}

function controlMetricas(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const keys = ["clientes", "servicios", "cuentas", "filasExcel", "correctos", "revision", "soloExcel", "soloSublichat", "fechaDistinta", "cuentaDistinta"];
  const out = {};
  keys.forEach((k) => {
    const n = Number(src[k]);
    if (Number.isFinite(n)) out[k] = Math.max(0, Math.round(n));
  });
  return out;
}

async function controlContarRespaldosDia(db, dateKey) {
  let count = 0;
  try {
    const snap = await db.collection(CONTROL_ARCHIVOS_COL)
      .where("clase", "==", "respaldo")
      .where("dateKey", "==", dateKey)
      .limit(CONTROL_BACKUPS_DIA + 5).get();
    return snap.size;
  } catch (_) {
    try {
      const snap = await db.collection(CONTROL_ARCHIVOS_COL).limit(120).get();
      snap.docs.forEach((d) => {
        const x = d.data() || {};
        if (x.clase === "respaldo" && x.dateKey === dateKey) count++;
      });
    } catch (__) {}
  }
  return count;
}

async function controlGuardarArchivo(db, body, clase) {
  if (!controlEsAdmin(body)) return controlDenegado();
  const raw = String(body.base64 || body.archivoBase64 || "").replace(/^data:[^,]+,/, "").trim();
  if (!raw) return { status: 400, json: { ok: false, error: "Falta el archivo Excel." } };
  if (raw.length > CONTROL_MAX_BASE64) return { status: 413, json: { ok: false, error: "El Excel supera el tamaño permitido para Control Maestro." } };

  const tipo = clase === "plantilla" ? "plantilla" : "respaldo";
  const now = new Date().toISOString();
  const dateKey = controlDateKey(now);
  if (tipo === "respaldo") {
    const count = await controlContarRespaldosDia(db, dateKey);
    if (count >= CONTROL_BACKUPS_DIA) {
      return { status: 200, json: { ok: true, skipped: true, reason: "limite_diario", dateKey, dailyLimit: CONTROL_BACKUPS_DIA } };
    }
  }

  const filename = String(body.filename || (tipo === "plantilla" ? "Sublicuentas_plantilla.xlsx" : "Sublicuentas_actual.xlsx"))
    .replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 180) || "Sublicuentas.xlsx";
  const size = Math.max(0, Number(body.size) || Math.floor(raw.length * 0.75));
  const mime = String(body.mime || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").slice(0, 140);
  const chunks = chunkString(raw, CONTROL_CHUNK_SIZE);
  const usuario = String(body.usuario || body.editor || "sublicuentas").trim();
  const motivo = String(body.motivo || (tipo === "plantilla" ? "carga_inicial" : "manual")).slice(0, 80);
  const metricas = controlMetricas(body.metricas);
  const ref = db.collection(CONTROL_ARCHIVOS_COL).doc();

  await ref.set({
    version: "control-maestro-v1-20260804",
    clase: tipo,
    filename,
    size,
    mime,
    chunks: chunks.length,
    base64Length: raw.length,
    dateKey,
    createdAt: now,
    createdBy: usuario,
    motivo,
    metricas,
    estado: "guardando",
    privado: true,
    owner: "sublicuentas"
  });

  let batch = db.batch();
  let ops = 0;
  for (let i = 0; i < chunks.length; i++) {
    const cRef = ref.collection("archivo").doc(String(i + 1).padStart(4, "0"));
    batch.set(cRef, { index: i + 1, totalChunks: chunks.length, base64: chunks[i], createdAt: now });
    ops++;
    if (ops >= 350) { await batch.commit(); batch = db.batch(); ops = 0; }
  }
  if (ops) await batch.commit();
  await ref.update({ estado: "listo", updatedAt: new Date().toISOString() });

  const cfgRef = db.collection(CONTROL_CONFIG_COL).doc(CONTROL_CONFIG_DOC);
  if (tipo === "plantilla") {
    await cfgRef.set({ plantillaId: ref.id, plantillaFilename: filename, plantillaUpdatedAt: now, updatedBy: usuario, version: "control-maestro-v1" }, { merge: true });
  } else {
    await cfgRef.set({ ultimoRespaldoId: ref.id, ultimoRespaldoFilename: filename, ultimoRespaldoAt: now, updatedBy: usuario, version: "control-maestro-v1" }, { merge: true });
  }

  await db.collection("auditoria_eventos").add({
    tipo: tipo === "plantilla" ? "control_maestro_plantilla_guardada" : "control_maestro_respaldo_guardado",
    archivoId: ref.id,
    filename,
    size,
    chunks: chunks.length,
    metricas,
    usuario,
    rol: "sublicuentas",
    createdAt: now
  });

  return { status: 200, json: { ok: true, archivo: controlArchivoMeta(ref.id, { clase: tipo, filename, size, mime, chunks: chunks.length, dateKey, createdAt: now, createdBy: usuario, motivo, metricas, estado: "listo" }), dailyLimit: CONTROL_BACKUPS_DIA } };
}

async function controlObtenerDoc(db, id) {
  const safeId = String(id || "").trim();
  if (!safeId || safeId.includes("/")) return null;
  const doc = await db.collection(CONTROL_ARCHIVOS_COL).doc(safeId).get();
  return doc.exists ? doc : null;
}

async function controlEstado(db, body) {
  if (!controlEsAdmin(body)) return controlDenegado();
  const cfgDoc = await db.collection(CONTROL_CONFIG_COL).doc(CONTROL_CONFIG_DOC).get();
  const cfg = cfgDoc.exists ? (cfgDoc.data() || {}) : {};
  let plantilla = null;
  if (cfg.plantillaId) {
    const doc = await controlObtenerDoc(db, cfg.plantillaId);
    if (doc) plantilla = controlArchivoMeta(doc.id, doc.data());
  }

  let snap;
  try { snap = await db.collection(CONTROL_ARCHIVOS_COL).where("clase", "==", "respaldo").orderBy("createdAt", "desc").limit(20).get(); }
  catch (_) { snap = await db.collection(CONTROL_ARCHIVOS_COL).limit(80).get(); }
  const respaldos = snap.docs
    .map((d) => controlArchivoMeta(d.id, d.data()))
    .filter((x) => x.clase === "respaldo" && x.listo)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 20);
  const revisiones = await controlListarRevisiones(db);

  return { status: 200, json: { ok: true, plantilla, respaldos, revisiones, config: { plantillaId: cfg.plantillaId || "", ultimoRespaldoId: cfg.ultimoRespaldoId || "" }, dailyLimit: CONTROL_BACKUPS_DIA } };
}

async function controlLeerArchivo(db, body) {
  if (!controlEsAdmin(body)) return controlDenegado();
  const doc = await controlObtenerDoc(db, body.id);
  if (!doc) return { status: 404, json: { ok: false, error: "No encontré ese archivo de Control Maestro." } };
  const meta = doc.data() || {};
  if (meta.owner !== "sublicuentas" || meta.estado !== "listo") return { status: 403, json: { ok: false, error: "Ese archivo no está disponible." } };

  const archivo = controlArchivoMeta(doc.id, meta);
  const totalChunks = Math.max(0, Number(meta.chunks) || 0);
  const base64Length = Math.max(0, Number(meta.base64Length) || 0);
  const requestedChunk = Number(body.chunkIndex);

  // Lectura segura de un solo bloque. El id es determinista en todos los
  // archivos guardados por Control Maestro, así que no se descarga el resto.
  if (Number.isInteger(requestedChunk) && requestedChunk > 0) {
    if (totalChunks && requestedChunk > totalChunks) {
      return { status: 416, json: { ok: false, error: "Ese bloque no existe en el archivo." } };
    }
    const chunkDoc = await doc.ref.collection("archivo").doc(String(requestedChunk).padStart(4, "0")).get();
    if (!chunkDoc.exists) {
      return { status: 409, json: { ok: false, error: `Falta el bloque ${requestedChunk} del respaldo.` } };
    }
    const chunk = String((chunkDoc.data() || {}).base64 || "");
    if (!chunk) {
      return { status: 409, json: { ok: false, error: `El bloque ${requestedChunk} está vacío.` } };
    }
    return {
      status: 200,
      json: { ok: true, archivo, chunked: true, chunkIndex: requestedChunk, totalChunks, base64Length, base64: chunk }
    };
  }

  // El navegador pide primero solo esta información y luego baja los bloques
  // en respuestas pequeñas. Esto evita que Canva y las demás hojas desaparezcan
  // cuando el Excel completo supera el límite de respuesta del proveedor.
  if (body.metaOnly || base64Length > CONTROL_INLINE_MAX_BASE64 || totalChunks > Math.ceil(CONTROL_INLINE_MAX_BASE64 / CONTROL_CHUNK_SIZE)) {
    if (!totalChunks) {
      return { status: 409, json: { ok: false, error: "El respaldo no informa cuántos bloques contiene." } };
    }
    return { status: 200, json: { ok: true, archivo, chunked: true, totalChunks, base64Length } };
  }

  const snap = await doc.ref.collection("archivo").orderBy("index", "asc").limit(100).get();
  const base64 = snap.docs.map((d) => String((d.data() || {}).base64 || "")).join("");
  if (!base64 || (meta.base64Length && base64.length !== Number(meta.base64Length))) {
    return { status: 409, json: { ok: false, error: "El respaldo está incompleto. Use otra versión." } };
  }
  return { status: 200, json: { ok: true, archivo, chunked: false, totalChunks, base64Length: base64.length, base64 } };
}

async function controlRestaurarComoPlantilla(db, body) {
  if (!controlEsAdmin(body)) return controlDenegado();
  const doc = await controlObtenerDoc(db, body.id);
  if (!doc) return { status: 404, json: { ok: false, error: "No encontré ese respaldo." } };
  const x = doc.data() || {};
  if (x.owner !== "sublicuentas" || x.estado !== "listo") return { status: 400, json: { ok: false, error: "Ese respaldo no se puede restaurar." } };
  const now = new Date().toISOString();
  const usuario = String(body.usuario || body.editor || "sublicuentas");
  await db.collection(CONTROL_CONFIG_COL).doc(CONTROL_CONFIG_DOC).set({
    plantillaId: doc.id,
    plantillaFilename: x.filename || "Sublicuentas.xlsx",
    plantillaUpdatedAt: now,
    restauradoDesde: doc.id,
    updatedBy: usuario
  }, { merge: true });
  await db.collection("auditoria_eventos").add({ tipo: "control_maestro_respaldo_restaurado", archivoId: doc.id, usuario, rol: "sublicuentas", createdAt: now });
  return { status: 200, json: { ok: true, plantilla: controlArchivoMeta(doc.id, x) } };
}



/* ============================================================
   MÓDULOS DE TRABAJO POR SECCIÓN · HOJA DE CÁLCULO COMPLETA
   Todo el archivo entra a Sublichat (todas las hojas, todas las celdas)
   y se trabaja aquí dentro. Guarda valores (los gráficos/fórmulas de
   Excel se regeneran al exportar). No toca CRM, inventario ni el bot.
       bodega       -> Sublicuentas (Excel inventario)
       auditoria    -> Magdiel      (Excel streaming)
       flujo_diario -> Relojes       (Word)
   Estructura Firestore:
     secciones_trabajo/{sec}                         (meta + lista de hojas)
     secciones_trabajo/{sec}/hojas/{NNN}             (meta de hoja)
     secciones_trabajo/{sec}/hojas/{NNN}/bloques/{CCCC}  (filas en bloques)
   ============================================================ */
const SEC_COL = "secciones_trabajo";
const SECCIONES = {
  bodega:       { label: "Bodega",       kind: "excel", owner: "sublicuentas", emoji: "📦" },
  auditoria:    { label: "Auditoría",    kind: "excel", owner: "magdiel",      emoji: "📊" },
  flujo_diario: { label: "Flujo diario", kind: "word",  owner: "relojes",       emoji: "🧾" }
};
function secOk(s) { return Object.prototype.hasOwnProperty.call(SECCIONES, String(s || "")); }
function secPad(n, w) { return String(n).padStart(w, "0"); }
function secCleanCell(v) { return v == null ? "" : String(v).slice(0, 900); }
function secCleanFilas(filas) {
  if (!Array.isArray(filas)) return [];
  return filas.slice(0, 2000).map((r) => (Array.isArray(r) ? r : []).slice(0, 250).map(secCleanCell));
}

// Firestore NO permite guardar arrays dentro de arrays.
// Sublichat trabaja las hojas como matriz: filas = [[celda, celda], ...].
// Para guardar sin romper Firestore, cada fila se almacena como string JSON
// y al leer se reconstruye otra vez como matriz.
function secEncodeFilas(filas) {
  return secCleanFilas(filas).map((row) => JSON.stringify(row));
}
function secDecodeFilas(block) {
  const data = block || {};
  if (Array.isArray(data.filasJson)) {
    return data.filasJson.map((s) => {
      try {
        const row = JSON.parse(String(s || "[]"));
        return Array.isArray(row) ? row.map(secCleanCell) : [];
      } catch (_) {
        return [String(s || "")];
      }
    }).filter((r) => r.some((c) => String(c || "").trim() !== ""));
  }
  // Compatibilidad por si hay bloques viejos guardados antes del fix.
  if (Array.isArray(data.filas)) {
    return data.filas.map((r) => {
      if (Array.isArray(r)) return r.map(secCleanCell);
      if (typeof r === "string") {
        try {
          const row = JSON.parse(r);
          return Array.isArray(row) ? row.map(secCleanCell) : [secCleanCell(r)];
        } catch (_) {
          return [secCleanCell(r)];
        }
      }
      if (r && typeof r === "object") return Object.keys(r).sort().map((k) => secCleanCell(r[k]));
      return [];
    }).filter((r) => r.some((c) => String(c || "").trim() !== ""));
  }
  return [];
}

function secUploadId() {
  return Date.now().toString(36) + "_" + crypto.randomBytes(8).toString("hex");
}


function secRole(body) {
  const raw = String((body && (body.rol || body.role || body.usuario || body.editor)) || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (['magdiel','auditor','auditoria'].includes(raw)) return 'magdiel';
  if (['libni','relojes','reloj','finanzas','cobros'].includes(raw)) return 'relojes';
  if (['sublicuentas','naara','admin','administrador','owner'].includes(raw)) return 'sublicuentas';
  return 'sin_permiso';
}
function secCanEdit(body, seccion) {
  const r = secRole(body);
  if (r === 'sublicuentas') return true;
  if (r === 'magdiel') return seccion === 'auditoria';
  if (r === 'relojes') return seccion === 'flujo_diario';
  return false;
}
function secCanRead(body, seccion) {
  return secCanEdit(body, seccion);
}
function secDeny(seccion) {
  return { status: 403, json: { ok: false, error: 'Su usuario no tiene permiso para acceder a esta sección: ' + seccion } };
}

function secHojaDocId(index) {
  return secPad(index, 3);
}


const SEC_BACKUP_COL = "secciones_trabajo_backups";
const SEC_BACKUP_DAILY_LIMIT = 2;
function secDateKey(d) {
  return new Date(d || Date.now()).toISOString().slice(0, 10);
}

async function secBackupCountToday(db, seccion, dateKey) {
  let count = 0;
  try {
    const snap = await db.collection(SEC_BACKUP_COL).where("seccion", "==", seccion).where("dateKey", "==", dateKey).limit(SEC_BACKUP_DAILY_LIMIT + 5).get();
    count = snap.size;
  } catch (_) {
    try {
      const snap = await db.collection(SEC_BACKUP_COL).limit(400).get();
      snap.docs.forEach((d) => { const x = d.data() || {}; if (x.seccion === seccion && x.dateKey === dateKey) count++; });
    } catch (__) {}
  }
  return count;
}
function secCanBackup(body, seccion) {
  // Admin puede respaldar/restaurar todo. Cada mesa puede respaldar/restaurar su propia sección.
  const r = secRole(body);
  if (r === "sublicuentas") return true;
  return secCanEdit(body, seccion);
}
async function secCopyBlocksToBackup(db, hojaRef, backupHojaRef, uploadId, now) {
  let source = null;
  if (uploadId) {
    source = hojaRef.collection("uploads").doc(uploadId).collection("bloques");
  } else {
    source = hojaRef.collection("bloques");
  }
  const blocks = await secLeerBloquesOrdenados(source);
  let batch = db.batch();
  let ops = 0;
  for (const b of blocks) {
    const bloque = Number(b.bloque) || Number(b.index) || (ops + 1);
    const ref = backupHojaRef.collection("bloques").doc(secPad(bloque, 4));
    batch.set(ref, {
      bloque,
      total: Number(b.total) || 0,
      cols: Number(b.cols) || 0,
      filasJson: Array.isArray(b.filasJson) ? b.filasJson.map((x) => String(x || "")) : secEncodeFilas(secDecodeFilas(b)),
      backedAt: now,
      storage: "filas_json_backup"
    });
    ops++;
    if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
  }
  if (ops) await batch.commit();
  return blocks.length;
}
async function secBackupOne(db, seccion, body, motivo) {
  if (!secOk(seccion)) return null;
  if (!secCanBackup(body, seccion)) return null;
  const secRef = db.collection(SEC_COL).doc(seccion);
  const doc = await secRef.get();
  if (!doc.exists) return null;
  const meta = doc.data() || {};
  const hojas = Array.isArray(meta.hojas) ? meta.hojas : [];
  if (!hojas.length) return null;
  const now = new Date().toISOString();
  const today = secDateKey(now);
  const existingToday = await secBackupCountToday(db, seccion, today);
  if (existingToday >= SEC_BACKUP_DAILY_LIMIT) {
    return { skipped: true, seccion, motivo: String(motivo || body.motivo || "manual"), reason: "limite_diario", limit: SEC_BACKUP_DAILY_LIMIT, dateKey: today };
  }
  const usuario = String(body.usuario || body.editor || "sublicuentas").trim();
  const rol = secRole(body);
  const ref = db.collection(SEC_BACKUP_COL).doc();
  const safeHojas = [];
  let totalBloques = 0;
  await ref.set({
    version: "backup-secciones-limite2-20260705",
    seccion,
    seccionLabel: meta.label || SECCIONES[seccion].label,
    kind: meta.kind || SECCIONES[seccion].kind,
    owner: meta.owner || SECCIONES[seccion].owner,
    emoji: meta.emoji || SECCIONES[seccion].emoji,
    filename: meta.filename || "",
    motivo: String(motivo || body.motivo || "manual").slice(0, 80),
    createdAt: now,
    dateKey: today,
    createdBy: usuario,
    rol,
    origenUpdatedAt: meta.updatedAt || "",
    origenUpdatedBy: meta.updatedBy || "",
    totalHojas: hojas.length,
    totalFilas: Number(meta.totalFilas) || 0,
    status: "creating",
    noModificaCRM: true,
    noModificaInventario: true,
    noModificaBotTelegram: true
  });
  for (let i = 0; i < hojas.length; i++) {
    const h = hojas[i] || {};
    const index = Number(h.index) || i + 1;
    const hojaId = secHojaDocId(index);
    const hojaRef = secRef.collection("hojas").doc(hojaId);
    const hd = await hojaRef.get();
    const hm = hd.exists ? (hd.data() || {}) : {};
    const uploadId = String(hm.uploadId || h.uploadId || "");
    const hojaBackupRef = ref.collection("hojas").doc(hojaId);
    const hcopy = {
      index,
      name: String(h.name || hm.name || ("Hoja " + index)).slice(0, 120),
      rows: Number(h.rows || hm.rows) || 0,
      cols: Number(h.cols || hm.cols) || 0,
      uploadId,
      backedAt: now
    };
    safeHojas.push(hcopy);
    await hojaBackupRef.set(hcopy);
    totalBloques += await secCopyBlocksToBackup(db, hojaRef, hojaBackupRef, uploadId, now);
  }
  await ref.update({ hojas: safeHojas, totalBloques, status: "ready", updatedAt: new Date().toISOString() });
  await db.collection("auditoria_eventos").add({ tipo: "backup_seccion_creado", backupId: ref.id, seccion, motivo: String(motivo || body.motivo || "manual"), totalHojas: safeHojas.length, totalBloques, usuario, rol, createdAt: now, noModificaCRM: true });
  return { id: ref.id, seccion, totalHojas: safeHojas.length, totalBloques, createdAt: now, motivo: String(motivo || body.motivo || "manual") };
}
async function secBackupCrear(db, body) {
  const rol = secRole(body);
  const seccionRaw = String(body.seccion || "all").trim();
  const motivo = String(body.motivo || "manual").trim() || "manual";
  let secciones;
  if (seccionRaw === "all" || !seccionRaw) {
    if (rol !== "sublicuentas") return { status: 403, json: { ok: false, error: "Solo Sublicuentas puede crear backup de todos los documentos." } };
    secciones = Object.keys(SECCIONES);
  } else {
    if (!secOk(seccionRaw)) return { status: 400, json: { ok: false, error: "Sección no válida" } };
    if (!secCanBackup(body, seccionRaw)) return secDeny(seccionRaw);
    secciones = [seccionRaw];
  }
  const items = [];
  for (const s of secciones) {
    const item = await secBackupOne(db, s, body, motivo);
    if (item) items.push(item);
  }
  const created = items.filter((x) => x && !x.skipped).length;
  const skipped = items.filter((x) => x && x.skipped).length;
  return { status: 200, json: { ok: true, created, skipped, items, motivo, dailyLimit: SEC_BACKUP_DAILY_LIMIT } };
}
async function secBackupDiario(db, body) {
  const today = secDateKey();
  const rol = secRole(body);
  const secciones = rol === "sublicuentas" ? Object.keys(SECCIONES) : Object.keys(SECCIONES).filter((s) => secCanEdit(body, s));
  let snap;
  try { snap = await db.collection(SEC_BACKUP_COL).orderBy("createdAt", "desc").limit(150).get(); }
  catch (_) { snap = await db.collection(SEC_BACKUP_COL).limit(150).get(); }
  const existing = new Set();
  snap.docs.forEach((d) => {
    const x = d.data() || {};
    if (x.dateKey === today && x.motivo === "diario" && secciones.includes(x.seccion)) existing.add(x.seccion);
  });
  const items = [];
  for (const s of secciones) {
    if (existing.has(s)) continue;
    const item = await secBackupOne(db, s, body, "diario");
    if (item) items.push(item);
  }
  return { status: 200, json: { ok: true, dateKey: today, created: items.length, items } };
}
async function secBackupListar(db, body) {
  const rol = secRole(body);
  const seccion = String(body.seccion || "").trim();
  const limit = Math.min(Math.max(Number(body.limit) || 30, 1), 100);
  let snap;
  try { snap = await db.collection(SEC_BACKUP_COL).orderBy("createdAt", "desc").limit(limit * 3).get(); }
  catch (_) { snap = await db.collection(SEC_BACKUP_COL).limit(limit * 3).get(); }
  const items = [];
  const seenByDay = {};
  for (const d of snap.docs) {
    const x = d.data() || {};
    if (seccion && x.seccion !== seccion) continue;
    if (rol !== "sublicuentas" && !secCanEdit(body, x.seccion)) continue;
    const key = String(x.dateKey || String(x.createdAt || "").slice(0, 10));
    seenByDay[key] = seenByDay[key] || 0;
    if (seenByDay[key] >= SEC_BACKUP_DAILY_LIMIT) continue;
    seenByDay[key]++;
    items.push({
      id: d.id,
      seccion: x.seccion,
      seccionLabel: x.seccionLabel || x.seccion,
      filename: x.filename || "",
      motivo: x.motivo || "manual",
      totalHojas: x.totalHojas || 0,
      totalFilas: x.totalFilas || 0,
      totalBloques: x.totalBloques || 0,
      createdAt: x.createdAt || "",
      createdBy: x.createdBy || "",
      origenUpdatedAt: x.origenUpdatedAt || ""
    });
    if (items.length >= limit) break;
  }
  return { status: 200, json: { ok: true, items } };
}
async function secBackupRestaurar(db, body) {
  const id = String(body.id || "").trim();
  if (!id) return { status: 400, json: { ok: false, error: "Falta id del backup" } };
  const ref = db.collection(SEC_BACKUP_COL).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return { status: 404, json: { ok: false, error: "No encontré ese backup" } };
  const b = doc.data() || {};
  const seccion = String(b.seccion || "");
  if (!secOk(seccion)) return { status: 400, json: { ok: false, error: "Backup con sección inválida" } };
  if (!secCanBackup(body, seccion)) return secDeny(seccion);
  const now = new Date().toISOString();
  const usuario = String(body.usuario || body.editor || "sublicuentas").trim();
  const newHojas = [];
  const secRef = db.collection(SEC_COL).doc(seccion);
  const hojasSnap = await ref.collection("hojas").get();
  for (const hdoc of hojasSnap.docs) {
    const hm = hdoc.data() || {};
    const index = Number(hm.index) || Number(hdoc.id) || 1;
    const hojaId = secHojaDocId(index);
    const restoreUploadId = ("restore_" + id + "_" + hojaId + "_" + Date.now()).slice(0, 80);
    const hojaRef = secRef.collection("hojas").doc(hojaId);
    const blocks = await secLeerBloquesOrdenados(hdoc.ref.collection("bloques"));
    let batch = db.batch();
    let ops = 0;
    for (const block of blocks) {
      const bloque = Number(block.bloque) || Number(block.index) || (ops + 1);
      const bref = hojaRef.collection("uploads").doc(restoreUploadId).collection("bloques").doc(secPad(bloque, 4));
      batch.set(bref, {
        bloque,
        total: Number(block.total) || 0,
        cols: Number(block.cols) || 0,
        filasJson: Array.isArray(block.filasJson) ? block.filasJson.map((x) => String(x || "")) : secEncodeFilas(secDecodeFilas(block)),
        updatedAt: now,
        restoredFromBackup: id,
        storage: "filas_json_restaurado"
      });
      ops++;
      if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
    }
    if (ops) await batch.commit();
    const hojaMeta = { index, name: hm.name || ("Hoja " + index), rows: Number(hm.rows) || 0, cols: Number(hm.cols) || 0, uploadId: restoreUploadId };
    newHojas.push(hojaMeta);
    await hojaRef.set({ ...hojaMeta, status: "ready", updatedAt: now, restoredFromBackup: id }, { merge: true });
  }
  newHojas.sort((a, b) => a.index - b.index);
  await secRef.set({
    id: seccion,
    label: b.seccionLabel || SECCIONES[seccion].label,
    kind: b.kind || SECCIONES[seccion].kind,
    owner: b.owner || SECCIONES[seccion].owner,
    emoji: b.emoji || SECCIONES[seccion].emoji,
    filename: b.filename || "",
    hojas: newHojas,
    totalHojas: newHojas.length,
    totalFilas: newHojas.reduce((a, h) => a + Number(h.rows || 0), 0),
    updatedAt: now,
    updatedBy: usuario,
    restoredFromBackup: id,
    noModificaCRM: true,
    noModificaInventario: true,
    noModificaBotTelegram: true
  }, { merge: true });
  await db.collection("auditoria_eventos").add({ tipo: "backup_seccion_restaurado", backupId: id, seccion, usuario, rol: secRole(body), createdAt: now, noModificaCRM: true });
  return { status: 200, json: { ok: true, id, seccion, totalHojas: newHojas.length, restoredAt: now } };
}

async function secLeerBloquesOrdenados(collectionRef) {
  let snap;
  try {
    snap = await collectionRef.orderBy("bloque", "asc").get();
  } catch (_) {
    snap = await collectionRef.get();
  }
  return snap.docs
    .map((d) => d.data() || {})
    .sort((a, b) => (Number(a.bloque) || 0) - (Number(b.bloque) || 0));
}

async function secHojaIniciar(db, body) {
  const seccion = String(body.seccion || "").trim();
  if (!secOk(seccion)) return { status: 400, json: { ok: false, error: "Sección no válida" } };
  if (!secCanEdit(body, seccion)) return secDeny(seccion);
  const index = Number(body.index) || 1;
  const name = String(body.name || ("Hoja " + index)).slice(0, 120);
  const rows = Math.max(0, Number(body.rows) || 0);
  const cols = Math.max(0, Number(body.cols) || 0);
  const now = new Date().toISOString();
  const uploadId = String(body.uploadId || secUploadId()).slice(0, 80);
  const hojaRef = db.collection(SEC_COL).doc(seccion).collection("hojas").doc(secHojaDocId(index));

  // IMPORTANTE: no borramos bloques viejos aquí.
  // En Vercel esa limpieza puede tumbar la función si antes hubo cargas grandes.
  // Cada carga nueva queda aislada por uploadId; solo se lee el uploadId activo.
  await hojaRef.set({ index, name, rows, cols, uploadId, updatedAt: now, status: "uploading" }, { merge: true });
  return { status: 200, json: { ok: true, seccion, index, name, uploadId } };
}
async function secHojaBloque(db, body) {
  const seccion = String(body.seccion || "").trim();
  if (!secOk(seccion)) return { status: 400, json: { ok: false, error: "Sección no válida" } };
  if (!secCanEdit(body, seccion)) return secDeny(seccion);
  const index = Number(body.index) || 1;
  const bloque = Number(body.bloque) || 1;
  const filas = secCleanFilas(body.filas || []);
  const filasJson = secEncodeFilas(filas);
  const now = new Date().toISOString();
  const hojaRef = db.collection(SEC_COL).doc(seccion).collection("hojas").doc(secHojaDocId(index));
  const hd = await hojaRef.get();
  let uploadId = hd.exists ? String((hd.data() || {}).uploadId || "") : "";
  if (!uploadId) {
    uploadId = secUploadId();
    await hojaRef.set({ index, uploadId, updatedAt: now, status: "uploading" }, { merge: true });
  }
  await hojaRef.collection("uploads").doc(uploadId).collection("bloques").doc(secPad(bloque, 4)).set({
    bloque,
    total: filas.length,
    filasJson,
    cols: filas.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0),
    updatedAt: now,
    storage: "filas_json_sin_arrays_anidados"
  });
  return { status: 200, json: { ok: true, seccion, index, bloque, filas: filas.length, uploadId, storage: "filasJson" } };
}
async function secFinalizar(db, body) {
  const seccion = String(body.seccion || "").trim();
  if (!secOk(seccion)) return { status: 400, json: { ok: false, error: "Sección no válida" } };
  if (!secCanEdit(body, seccion)) return secDeny(seccion);
  const cfg = SECCIONES[seccion];
  const hojasRaw = Array.isArray(body.hojas) ? body.hojas : [];
  const now = new Date().toISOString();
  const hojas = [];
  for (let i = 0; i < hojasRaw.length; i++) {
    const h = hojasRaw[i] || {};
    const index = Number(h.index) || i + 1;
    const hojaRef = db.collection(SEC_COL).doc(seccion).collection("hojas").doc(secHojaDocId(index));
    const hd = await hojaRef.get();
    const meta = hd.exists ? (hd.data() || {}) : {};
    const item = {
      index,
      name: String(h.name || meta.name || ("Hoja " + index)).slice(0, 120),
      rows: Number(h.rows || meta.rows) || 0,
      cols: Number(h.cols || meta.cols) || 0,
      uploadId: String(meta.uploadId || "").slice(0, 80)
    };
    hojas.push(item);
    await hojaRef.set({ status: "ready", updatedAt: now }, { merge: true });
  }
  const totalFilas = hojas.reduce((a, h) => a + (h.rows || 0), 0);
  const editor = String(body.editor || body.usuario || "sublicuentas").trim();
  const filename = String(body.filename || "").slice(0, 180);
  const motivo = String(body.motivo || "migracion").slice(0, 40);
  await db.collection(SEC_COL).doc(seccion).set({
    id: seccion, label: cfg.label, kind: cfg.kind, owner: cfg.owner, emoji: cfg.emoji,
    hojas, totalHojas: hojas.length, totalFilas, filename, motivo,
    updatedAt: now, updatedBy: editor,
    noModificaCRM: true, noModificaInventario: true, noModificaBotTelegram: true
  }, { merge: true });
  await db.collection("auditoria_eventos").add({ tipo: "seccion_" + motivo, seccion, totalHojas: hojas.length, totalFilas, editor, filename, createdAt: now, noModificaCRM: true });
  return { status: 200, json: { ok: true, seccion, totalHojas: hojas.length, totalFilas, updatedAt: now } };
}
async function secLeer(db, body) {
  const seccion = String(body.seccion || "").trim();
  if (!secOk(seccion)) return { status: 400, json: { ok: false, error: "Sección no válida" } };
  if (!secCanRead(body, seccion)) return secDeny(seccion);
  const cfg = SECCIONES[seccion];
  const doc = await db.collection(SEC_COL).doc(seccion).get();
  if (!doc.exists) return { status: 200, json: { ok: true, seccion, label: cfg.label, kind: cfg.kind, emoji: cfg.emoji, owner: cfg.owner, hojas: [], totalHojas: 0, totalFilas: 0, filename: "", updatedAt: "", updatedBy: "", vacio: true } };
  const m = doc.data() || {};
  return { status: 200, json: { ok: true, seccion, label: m.label || cfg.label, kind: m.kind || cfg.kind, emoji: m.emoji || cfg.emoji, owner: m.owner || cfg.owner, hojas: m.hojas || [], totalHojas: m.totalHojas || 0, totalFilas: m.totalFilas || 0, filename: m.filename || "", updatedAt: m.updatedAt || "", updatedBy: m.updatedBy || "", vacio: false } };
}
async function secHojaLeer(db, body) {
  const seccion = String(body.seccion || "").trim();
  if (!secOk(seccion)) return { status: 400, json: { ok: false, error: "Sección no válida" } };
  if (!secCanRead(body, seccion)) return secDeny(seccion);
  const index = Number(body.index) || 1;
  const hojaRef = db.collection(SEC_COL).doc(seccion).collection("hojas").doc(secHojaDocId(index));
  const hd = await hojaRef.get();
  if (!hd.exists) return { status: 404, json: { ok: false, error: "No encontré esa hoja" } };
  const meta = hd.data() || {};
  const maxRows = Math.min(Math.max(Number(body.maxRows) || 5000, 50), 30000);
  let filas = [];

  const uploadId = String(meta.uploadId || "");
  if (uploadId) {
    const blocks = await secLeerBloquesOrdenados(hojaRef.collection("uploads").doc(uploadId).collection("bloques"));
    blocks.forEach((d) => { filas = filas.concat(secDecodeFilas(d)); });
  }

  // Compatibilidad con cargas anteriores que guardaban en /bloques directamente.
  if (!filas.length) {
    const blocks = await secLeerBloquesOrdenados(hojaRef.collection("bloques"));
    blocks.forEach((d) => { filas = filas.concat(secDecodeFilas(d)); });
  }

  const recortado = filas.length > maxRows;
  filas = filas.slice(0, maxRows);
  return { status: 200, json: { ok: true, seccion, index, name: meta.name || ("Hoja " + index), rows: meta.rows || filas.length, cols: meta.cols || 0, filas, recortado, uploadId } };
}
async function secEstado(db, body) {
  const out = {};
  for (const s of Object.keys(SECCIONES).filter(seccion => secCanRead(body, seccion))) {
    const cfg = SECCIONES[s];
    const doc = await db.collection(SEC_COL).doc(s).get();
    if (doc.exists) { const m = doc.data() || {}; out[s] = { label: m.label || cfg.label, kind: m.kind || cfg.kind, emoji: m.emoji || cfg.emoji, owner: m.owner || cfg.owner, totalHojas: m.totalHojas || 0, totalFilas: m.totalFilas || 0, filename: m.filename || "", updatedAt: m.updatedAt || "", updatedBy: m.updatedBy || "", vacio: false }; }
    else out[s] = { label: cfg.label, kind: cfg.kind, emoji: cfg.emoji, owner: cfg.owner, totalHojas: 0, totalFilas: 0, filename: "", updatedAt: "", updatedBy: "", vacio: true };
  }
  return { status: 200, json: { ok: true, secciones: out, config: SECCIONES } };
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  try {
    const db = getApp().firestore();
    const authUser = await requireFirebaseUser(req, res);
    if (!authUser) return;
    const identity = importIdentity(authUser);
    const body = req.body && typeof req.body === "object" ? { ...req.body } : {};
    body.usuario = identity.usuario;
    body.editor = identity.usuario;
    body.rol = identity.role;
    const accion = body.accion || "guardar_respaldo_excel";

    if (accion === "control_estado") {
      const out = await controlEstado(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === "control_guardar_revision_cuenta") {
      const out = await controlGuardarRevisionCuenta(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === "control_eliminar_incidencia_cuenta") {
      const out = await controlEliminarIncidenciaCuenta(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === "control_guardar_plantilla") {
      const out = await controlGuardarArchivo(db, body, "plantilla");
      return res.status(out.status).json(out.json);
    }
    if (accion === "control_guardar_respaldo") {
      const out = await controlGuardarArchivo(db, body, "respaldo");
      return res.status(out.status).json(out.json);
    }
    if (accion === "control_leer_archivo") {
      const out = await controlLeerArchivo(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === "control_restaurar_plantilla") {
      const out = await controlRestaurarComoPlantilla(db, body);
      return res.status(out.status).json(out.json);
    }

    if (accion === "iniciar_respaldo_excel") {
      const out = await iniciarRespaldoExcel(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === "guardar_respaldo_excel_chunk") {
      const out = await guardarRespaldoExcelChunk(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === "finalizar_respaldo_excel") {
      const out = await finalizarRespaldoExcel(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === "guardar_respaldo_excel" || accion === "guardar_importacion") {
      const out = await guardarRespaldo(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === "listar_respaldos_excel") {
      return res.status(200).json(await listarRespaldos(db, body));
    }
    if (accion === "leer_respaldo_excel") {
      const out = await leerRespaldo(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === "buscar_respaldo_excel") {
      const out = await buscarRespaldos(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === "actualizar_respaldo_excel") {
      const out = await actualizarRespaldoExcel(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === "guardar_respaldo_word") {
      const out = await guardarRespaldoWord(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === "listar_respaldos_word") {
      const out = await listarRespaldosWord(db, body);
      if (out && out.status) return res.status(out.status).json(out.json);
      return res.status(200).json(out);
    }
    if (accion === "leer_respaldo_word") {
      const out = await leerRespaldoWord(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === "actualizar_respaldo_word") {
      const out = await actualizarRespaldoWord(db, body);
      return res.status(out.status).json(out.json);
    }

    if (accion === "sec_hoja_iniciar") { const out = await secHojaIniciar(db, body); return res.status(out.status).json(out.json); }
    if (accion === "sec_hoja_bloque")  { const out = await secHojaBloque(db, body);  return res.status(out.status).json(out.json); }
    if (accion === "sec_finalizar")    { const out = await secFinalizar(db, body);   return res.status(out.status).json(out.json); }
    if (accion === "sec_leer")         { const out = await secLeer(db, body);        return res.status(out.status).json(out.json); }
    if (accion === "sec_hoja_leer")    { const out = await secHojaLeer(db, body);    return res.status(out.status).json(out.json); }
    if (accion === "sec_estado")       { const out = await secEstado(db, body);      return res.status(out.status).json(out.json); }
    if (accion === "sec_backup_crear")    { const out = await secBackupCrear(db, body);     return res.status(out.status).json(out.json); }
    if (accion === "sec_backup_listar")   { const out = await secBackupListar(db, body);    return res.status(out.status).json(out.json); }
    if (accion === "sec_backup_restaurar"){ const out = await secBackupRestaurar(db, body); return res.status(out.status).json(out.json); }
    if (accion === "sec_backup_diario")   { const out = await secBackupDiario(db, body);    return res.status(out.status).json(out.json); }

    return res.status(400).json({ ok: false, error: "Acción no reconocida" });
  } catch (e) {
    console.error("RESPALDO_EXCEL_ERROR", e);
    return res.status(500).json({ ok: false, error: "No se pudo completar la operación de documentos." });
  }
}

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: { sizeLimit: "25mb" }
  }
};
