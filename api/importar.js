// api/importar.js · Respaldos Excel Sublichat
// Guarda SOLO respaldos Excel en Firestore, separados del CRM operativo.
// No modifica clientes, servicios, inventario ni bot Telegram.
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
    index: i + 1,
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
    if (accion !== "guardar_respaldo_excel" && accion !== "guardar_importacion") {
      return res.status(400).json({ ok: false, error: "Acción no reconocida" });
    }

    const tipo = safeTipo(body.tipo);
    const filename = String(body.filename || "").trim();
    const usuario = String(body.usuario || "sublicuentas").trim();
    const rol = String(body.rol || "admin").trim();
    const destinoRol = String(body.destinoRol || (tipo === "streaming" ? "auditor" : "admin")).trim();
    const now = new Date().toISOString();

    let sheets = cleanSheets(body.sheets || []);
    if (!sheets.length && Array.isArray(body.rows)) {
      sheets = [{ index: 1, name: "Hoja 1", rows: cleanRows(body.rows) }].filter((s) => s.rows.length);
    }
    const totalFilas = sheets.reduce((sum, s) => sum + s.rows.length, 0);
    if (!totalFilas) return res.status(400).json({ ok: false, error: "No hay filas de Excel para guardar" });

    // Colección separada: NO ES clientes, NO ES servicios, NO ES inventario.
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
      estado: "respaldo_excel_solo_lectura",
      noModificaCRM: true,
      noModificaInventario: true,
      noModificaBotTelegram: true,
      createdAt: now,
      updatedAt: now
    };

    await ref.set(resumen);

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
      usuario,
      rol,
      destinoRol,
      noModificaCRM: true,
      createdAt: now
    });

    return res.status(200).json({ ok: true, id: ref.id, totalHojas: sheets.length, totalFilas, estado: resumen.estado });
  } catch (e) {
    console.error("RESPALDO_EXCEL_ERROR", e);
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}
