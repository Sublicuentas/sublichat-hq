// api/importar.js · Respaldos Excel Sublichat
// Guarda, lista, abre y busca tablas de Excel guardadas en Firestore.
// No modifica clientes, servicios, inventario operativo ni bot Telegram.
// Requiere variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import admin from "firebase-admin";

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
  const items = snap.docs.map(d => {
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Método no permitido" });

  try {
    const db = getApp().firestore();
    const body = req.body || {};
    const accion = body.accion || "guardar_respaldo_excel";

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
      return res.status(200).json(await listarRespaldosWord(db, body));
    }
    if (accion === "leer_respaldo_word") {
      const out = await leerRespaldoWord(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === "actualizar_respaldo_word") {
      const out = await actualizarRespaldoWord(db, body);
      return res.status(out.status).json(out.json);
    }

    return res.status(400).json({ ok: false, error: "Acción no reconocida" });
  } catch (e) {
    console.error("RESPALDO_EXCEL_ERROR", e);
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}
