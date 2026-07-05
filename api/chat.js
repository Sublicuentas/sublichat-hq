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

    return res.status(400).json({ ok: false, error: "Acción no reconocida" });
  } catch (e) {
    console.error("RESPALDO_EXCEL_ERROR", e);
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}
