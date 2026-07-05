<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>api/importar.js FIX 500</title><style>body{font-family:Arial,sans-serif;background:#0e1117;color:#e8eef7;padding:20px}pre{white-space:pre-wrap;background:#111827;border:1px solid #334155;border-radius:12px;padding:16px;overflow:auto}button{padding:12px 16px;border:0;border-radius:10px;background:#22c55e;font-weight:bold}</style></head><body><h1>api/importar.js 路 FIX 500</h1><p>Copie solamente el c贸digo del bloque y p茅guelo en <b>api/importar.js</b>.</p><button onclick="navigator.clipboard.writeText(document.querySelector('code').innerText)">Copiar c贸digo</button><pre><code>// api/importar.js 路 Sublichat Archivos de trabajo por usuario
// Versi贸n robusta: guarda Bodega, Auditor铆a y Flujo diario en Firestore por hojas/bloques.
// No toca clientes, servicios, inventario operativo ni bot Telegram.

import admin from &quot;firebase-admin&quot;;

function normalizePrivateKey(key = &quot;&quot;) {
  return String(key || &quot;&quot;).replace(/\\n/g, &quot;\n&quot;);
}

function serviceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || &quot;&quot;;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        projectId: parsed.project_id || parsed.projectId,
        clientEmail: parsed.client_email || parsed.clientEmail,
        privateKey: normalizePrivateKey(parsed.private_key || parsed.privateKey)
      };
    } catch (_) {
      // contin煤a con variables separadas
    }
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY || &quot;&quot;)
  };
}

function getApp() {
  if (admin.apps.length) return admin.app();
  const sa = serviceAccountFromEnv();
  if (!sa.projectId || !sa.clientEmail || !sa.privateKey) {
    throw new Error(&quot;Faltan variables Firebase Admin: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY.&quot;);
  }
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: sa.projectId,
      clientEmail: sa.clientEmail,
      privateKey: sa.privateKey
    })
  });
}

const SEC_COL = &quot;secciones_trabajo&quot;;
const SECCIONES = {
  bodega:       { label: &quot;Bodega&quot;,       kind: &quot;excel&quot;, owner: &quot;sublicuentas&quot;, emoji: &quot;馃摝&quot; },
  auditoria:    { label: &quot;Auditor铆a&quot;,    kind: &quot;excel&quot;, owner: &quot;magdiel&quot;,      emoji: &quot;馃搳&quot; },
  flujo_diario: { label: &quot;Flujo diario&quot;, kind: &quot;word&quot;,  owner: &quot;relojes&quot;,      emoji: &quot;馃Ь&quot; }
};

function ok(res, json = {}) { return res.status(200).json({ ok: true, ...json }); }
function fail(res, error, status = 200, extra = {}) { return res.status(status).json({ ok: false, error: String(error &amp;&amp; error.message ? error.message : error), ...extra }); }
function secOk(s) { return Object.prototype.hasOwnProperty.call(SECCIONES, String(s || &quot;&quot;)); }
function pad(n, w) { return String(Number(n) || 0).padStart(w, &quot;0&quot;); }
function cleanCell(v) { return v == null ? &quot;&quot; : String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, &quot;&quot;).slice(0, 700); }
function cleanFilas(filas) {
  if (!Array.isArray(filas)) return [];
  const out = [];
  for (const r of filas) {
    const arr = (Array.isArray(r) ? r : Object.values(r || {})).slice(0, 180).map(cleanCell);
    if (arr.some(v =&gt; String(v || &quot;&quot;).trim() !== &quot;&quot;)) out.push(arr);
  }
  return out;
}
function safeHojaName(name, index) { return String(name || `Hoja ${index}`).slice(0, 120); }
function uploadId() { return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; }

async function accionEstado(db, res) {
  const secciones = {};
  for (const id of Object.keys(SECCIONES)) {
    const cfg = SECCIONES[id];
    const doc = await db.collection(SEC_COL).doc(id).get();
    if (!doc.exists) {
      secciones[id] = { ...cfg, id, hojas: [], totalHojas: 0, totalFilas: 0, filename: &quot;&quot;, updatedAt: &quot;&quot;, updatedBy: &quot;&quot;, vacio: true };
    } else {
      const d = doc.data() || {};
      secciones[id] = {
        id,
        label: d.label || cfg.label,
        kind: d.kind || cfg.kind,
        owner: d.owner || cfg.owner,
        emoji: d.emoji || cfg.emoji,
        hojas: Array.isArray(d.hojas) ? d.hojas : [],
        totalHojas: Number(d.totalHojas) || 0,
        totalFilas: Number(d.totalFilas) || 0,
        filename: d.filename || &quot;&quot;,
        updatedAt: d.updatedAt || &quot;&quot;,
        updatedBy: d.updatedBy || &quot;&quot;,
        vacio: false
      };
    }
  }
  return ok(res, { secciones, config: SECCIONES });
}

async function accionLeer(db, res, body) {
  const seccion = String(body.seccion || &quot;&quot;).trim();
  if (!secOk(seccion)) return fail(res, &quot;Secci贸n no v谩lida&quot;);
  const cfg = SECCIONES[seccion];
  const doc = await db.collection(SEC_COL).doc(seccion).get();
  if (!doc.exists) {
    return ok(res, { seccion, ...cfg, hojas: [], totalHojas: 0, totalFilas: 0, filename: &quot;&quot;, updatedAt: &quot;&quot;, updatedBy: &quot;&quot;, vacio: true });
  }
  const d = doc.data() || {};
  return ok(res, {
    seccion,
    label: d.label || cfg.label,
    kind: d.kind || cfg.kind,
    owner: d.owner || cfg.owner,
    emoji: d.emoji || cfg.emoji,
    hojas: Array.isArray(d.hojas) ? d.hojas : [],
    totalHojas: Number(d.totalHojas) || 0,
    totalFilas: Number(d.totalFilas) || 0,
    filename: d.filename || &quot;&quot;,
    updatedAt: d.updatedAt || &quot;&quot;,
    updatedBy: d.updatedBy || &quot;&quot;,
    vacio: false
  });
}

async function accionHojaIniciar(db, res, body) {
  const seccion = String(body.seccion || &quot;&quot;).trim();
  if (!secOk(seccion)) return fail(res, &quot;Secci贸n no v谩lida&quot;);
  const index = Number(body.index) || 1;
  const now = new Date().toISOString();
  const id = uploadId();
  const rows = Math.max(0, Number(body.rows) || 0);
  const cols = Math.max(0, Number(body.cols) || 0);
  const hojaRef = db.collection(SEC_COL).doc(seccion).collection(&quot;hojas&quot;).doc(pad(index, 3));
  await hojaRef.set({
    index,
    name: safeHojaName(body.name, index),
    rows,
    cols,
    uploadId: id,
    updatedAt: now,
    status: &quot;uploading&quot;
  }, { merge: true });
  return ok(res, { seccion, index, uploadId: id });
}

async function accionHojaBloque(db, res, body) {
  const seccion = String(body.seccion || &quot;&quot;).trim();
  if (!secOk(seccion)) return fail(res, &quot;Secci贸n no v谩lida&quot;);
  const index = Number(body.index) || 1;
  const bloque = Number(body.bloque) || 1;
  const filas = cleanFilas(body.filas || []);
  const hojaRef = db.collection(SEC_COL).doc(seccion).collection(&quot;hojas&quot;).doc(pad(index, 3));
  const hoja = await hojaRef.get();
  if (!hoja.exists) return fail(res, &quot;Primero debe iniciar la hoja antes de subir bloques&quot;);
  const meta = hoja.data() || {};
  const up = meta.uploadId || uploadId();
  const payload = { bloque, total: filas.length, filas, updatedAt: new Date().toISOString() };
  const estimated = Buffer.byteLength(JSON.stringify(payload), &quot;utf8&quot;);
  if (estimated &gt; 850000) {
    return fail(res, `Bloque demasiado grande (${estimated} bytes). Reduzca filas por bloque.`);
  }
  await hojaRef.collection(&quot;uploads&quot;).doc(up).collection(&quot;bloques&quot;).doc(pad(bloque, 4)).set(payload);
  return ok(res, { seccion, index, bloque, filas: filas.length });
}

async function accionFinalizar(db, res, body) {
  const seccion = String(body.seccion || &quot;&quot;).trim();
  if (!secOk(seccion)) return fail(res, &quot;Secci贸n no v谩lida&quot;);
  const cfg = SECCIONES[seccion];
  const now = new Date().toISOString();
  const editor = String(body.editor || body.usuario || &quot;sublicuentas&quot;).trim();
  const filename = String(body.filename || &quot;&quot;).slice(0, 180);
  const hojasRaw = Array.isArray(body.hojas) ? body.hojas : [];
  const hojas = [];

  for (let i = 0; i &lt; hojasRaw.length; i++) {
    const h = hojasRaw[i] || {};
    const index = Number(h.index) || i + 1;
    const hojaRef = db.collection(SEC_COL).doc(seccion).collection(&quot;hojas&quot;).doc(pad(index, 3));
    const hd = await hojaRef.get();
    const hm = hd.exists ? (hd.data() || {}) : {};
    hojas.push({
      index,
      name: safeHojaName(h.name || hm.name, index),
      rows: Number(h.rows || hm.rows) || 0,
      cols: Number(h.cols || hm.cols) || 0,
      uploadId: hm.uploadId || &quot;&quot;
    });
    await hojaRef.set({ status: &quot;ready&quot;, updatedAt: now }, { merge: true });
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
    motivo: String(body.motivo || &quot;migracion&quot;).slice(0, 50),
    noModificaCRM: true,
    noModificaInventario: true,
    noModificaBotTelegram: true
  }, { merge: true });

  await db.collection(&quot;auditoria_eventos&quot;).add({
    tipo: &quot;seccion_guardada&quot;,
    seccion,
    filename,
    totalHojas: hojas.length,
    totalFilas,
    editor,
    createdAt: now,
    noModificaCRM: true
  }).catch(() =&gt; null);

  return ok(res, { seccion, totalHojas: hojas.length, totalFilas, updatedAt: now });
}

async function accionHojaLeer(db, res, body) {
  const seccion = String(body.seccion || &quot;&quot;).trim();
  if (!secOk(seccion)) return fail(res, &quot;Secci贸n no v谩lida&quot;);
  const index = Number(body.index) || 1;
  const maxRows = Math.min(Math.max(Number(body.maxRows) || 5000, 50), 25000);
  const hojaRef = db.collection(SEC_COL).doc(seccion).collection(&quot;hojas&quot;).doc(pad(index, 3));
  const hd = await hojaRef.get();
  if (!hd.exists) return fail(res, &quot;No encontr茅 esa hoja&quot;, 200, { vacio: true });
  const meta = hd.data() || {};
  const up = meta.uploadId || &quot;&quot;;
  if (!up) return ok(res, { seccion, index, name: meta.name || `Hoja ${index}`, rows: meta.rows || 0, cols: meta.cols || 0, filas: [], vacio: true });
  const snap = await hojaRef.collection(&quot;uploads&quot;).doc(up).collection(&quot;bloques&quot;).orderBy(&quot;bloque&quot;, &quot;asc&quot;).get();
  let filas = [];
  snap.docs.forEach(d =&gt; { filas = filas.concat((d.data() || {}).filas || []); });
  const recortado = filas.length &gt; maxRows;
  filas = filas.slice(0, maxRows);
  return ok(res, {
    seccion,
    index,
    name: meta.name || `Hoja ${index}`,
    rows: Number(meta.rows) || filas.length,
    cols: Number(meta.cols) || (filas[0] ? filas[0].length : 0),
    filas,
    recortado
  });
}

// Compatibilidad m铆nima con nombres anteriores. No debe usarse para los nuevos m贸dulos.
async function accionLegacyListar(db, res, body) {
  const tipo = String(body.tipo || &quot;&quot;).toLowerCase();
  const seccion = tipo.includes(&quot;stream&quot;) ? &quot;auditoria&quot; : tipo.includes(&quot;invent&quot;) ? &quot;bodega&quot; : &quot;bodega&quot;;
  const doc = await db.collection(SEC_COL).doc(seccion).get();
  if (!doc.exists) return ok(res, { items: [] });
  const d = doc.data() || {};
  return ok(res, { items: [{ id: seccion, tipo, filename: d.filename || &quot;&quot;, totalHojas: d.totalHojas || 0, totalFilas: d.totalFilas || 0, hojas: d.hojas || [], createdAt: d.updatedAt || &quot;&quot;, updatedAt: d.updatedAt || &quot;&quot; }] });
}

export default async function handler(req, res) {
  res.setHeader(&quot;Access-Control-Allow-Origin&quot;, &quot;*&quot;);
  res.setHeader(&quot;Access-Control-Allow-Methods&quot;, &quot;GET,POST,OPTIONS&quot;);
  res.setHeader(&quot;Access-Control-Allow-Headers&quot;, &quot;Content-Type&quot;);
  if (req.method === &quot;OPTIONS&quot;) return res.status(200).end();
  if (req.method === &quot;GET&quot;) return res.status(200).json({ ok: true, version: &quot;archivos-trabajo-robusto-20260705&quot;, acciones: [&quot;sec_estado&quot;, &quot;sec_leer&quot;, &quot;sec_hoja_iniciar&quot;, &quot;sec_hoja_bloque&quot;, &quot;sec_finalizar&quot;, &quot;sec_hoja_leer&quot;] });
  if (req.method !== &quot;POST&quot;) return fail(res, &quot;M茅todo no permitido&quot;);

  try {
    const body = req.body || {};
    const accion = String(body.accion || &quot;sec_estado&quot;);
    const db = getApp().firestore();

    if (accion === &quot;sec_estado&quot;) return accionEstado(db, res);
    if (accion === &quot;sec_leer&quot;) return accionLeer(db, res, body);
    if (accion === &quot;sec_hoja_iniciar&quot;) return accionHojaIniciar(db, res, body);
    if (accion === &quot;sec_hoja_bloque&quot;) return accionHojaBloque(db, res, body);
    if (accion === &quot;sec_finalizar&quot;) return accionFinalizar(db, res, body);
    if (accion === &quot;sec_hoja_leer&quot;) return accionHojaLeer(db, res, body);
    if (accion === &quot;listar_respaldos_excel&quot;) return accionLegacyListar(db, res, body);

    return fail(res, `Acci贸n no reconocida: ${accion}`);
  } catch (e) {
    console.error(&quot;IMPORTAR_API_ERROR&quot;, e);
    // Respondo 200 para que el navegador muestre el mensaje real en vez de solo HTTP 500.
    return fail(res, e, 200, { source: &quot;api/importar.js&quot;, version: &quot;archivos-trabajo-robusto-20260705&quot; });
  }
}
</code></pre></body></html>
