<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>api/importar.js para copiar</title><style>body{font-family:Arial,sans-serif;background:#0b1020;color:#eef;padding:18px}button{position:sticky;top:10px;background:#25d366;border:0;border-radius:10px;padding:12px 16px;font-weight:800}pre{white-space:pre-wrap;background:#111827;border:1px solid #334155;border-radius:14px;padding:16px;overflow:auto}code{font-family:Consolas,monospace;font-size:13px}</style></head><body><button onclick="navigator.clipboard.writeText(document.querySelector('code').innerText).then(()=>this.textContent='Copiado')">Copiar todo</button><h1>api/importar.js</h1><pre><code>// api/importar.js · Respaldos Excel Sublichat
// Guarda, lista, abre y busca tablas de Excel guardadas en Firestore.
// No modifica clientes, servicios, inventario operativo ni bot Telegram.
// Requiere variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import admin from &quot;firebase-admin&quot;;

export const config = { api: { bodyParser: { sizeLimit: &quot;50mb&quot; } } };

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || &quot;&quot;;
  privateKey = privateKey.replace(/\\n/g, &quot;\n&quot;);
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(&quot;Faltan variables FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY.&quot;);
  }
  return admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i &lt; arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function chunkString(str, size) {
  const s = String(str || &quot;&quot;);
  const out = [];
  for (let i = 0; i &lt; s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

function cleanRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) =&gt; {
    const o = {};
    Object.keys(row || {}).forEach((k) =&gt; {
      const key = String(k || &quot;&quot;).trim().slice(0, 80) || &quot;campo&quot;;
      const v = row[k];
      o[key] = v == null ? &quot;&quot; : String(v).trim();
    });
    return o;
  }).filter((r) =&gt; Object.values(r).some((v) =&gt; String(v || &quot;&quot;).trim() !== &quot;&quot;));
}

function cleanSheets(sheets) {
  if (!Array.isArray(sheets)) return [];
  return sheets.map((s, i) =&gt; ({
    index: Number(s &amp;&amp; s.index) || i + 1,
    name: String(s &amp;&amp; s.name ? s.name : `Hoja ${i + 1}`).trim().slice(0, 80),
    rows: cleanRows((s &amp;&amp; s.rows) || [])
  })).filter((s) =&gt; s.rows.length);
}

function safeTipo(tipo) {
  const t = String(tipo || &quot;&quot;).trim().toLowerCase();
  if (t === &quot;streaming&quot;) return &quot;streaming&quot;;
  if (t === &quot;inventario&quot;) return &quot;inventario&quot;;
  return &quot;general&quot;;
}

function labelTipo(tipo) {
  if (tipo === &quot;streaming&quot;) return &quot;Sublicuentas streaming / Magdiel&quot;;
  if (tipo === &quot;inventario&quot;) return &quot;Inventario de sublicuentas / Admin&quot;;
  return &quot;Respaldo Excel&quot;;
}

function normalizeText(s) {
  return String(s || &quot;&quot;).toLowerCase().normalize(&quot;NFD&quot;).replace(/[\u0300-\u036f]/g, &quot;&quot;);
}

function rowMatches(row, q) {
  const nq = normalizeText(q);
  if (!nq) return true;
  return normalizeText(Object.values(row || {}).join(&quot; &quot;)).includes(nq);
}

async function guardarRespaldo(db, body) {
  const tipo = safeTipo(body.tipo);
  const filename = String(body.filename || &quot;&quot;).trim();
  const usuario = String(body.usuario || &quot;sublicuentas&quot;).trim();
  const rol = String(body.rol || &quot;admin&quot;).trim();
  const destinoRol = String(body.destinoRol || (tipo === &quot;streaming&quot; ? &quot;auditor&quot; : &quot;admin&quot;)).trim();
  const archivoOriginal = body.archivoOriginal &amp;&amp; typeof body.archivoOriginal === &quot;object&quot; ? body.archivoOriginal : null;
  const archivoBase64 = archivoOriginal &amp;&amp; archivoOriginal.base64 ? String(archivoOriginal.base64) : &quot;&quot;;
  const now = new Date().toISOString();

  let sheets = cleanSheets(body.sheets || []);
  if (!sheets.length &amp;&amp; Array.isArray(body.rows)) {
    sheets = [{ index: 1, name: &quot;Hoja 1&quot;, rows: cleanRows(body.rows) }].filter((s) =&gt; s.rows.length);
  }
  const totalFilas = sheets.reduce((sum, s) =&gt; sum + s.rows.length, 0);
  if (!totalFilas) return { status: 400, json: { ok: false, error: &quot;No hay filas de Excel para guardar&quot; } };

  const ref = db.collection(&quot;respaldos_excel&quot;).doc();
  const resumenHojas = sheets.map((s) =&gt; ({ index: s.index, name: s.name, totalFilas: s.rows.length }));
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
      filename: String((archivoOriginal &amp;&amp; archivoOriginal.filename) || filename || &quot;respaldo.xlsx&quot;).slice(0, 180),
      size: Number((archivoOriginal &amp;&amp; archivoOriginal.size) || 0),
      mime: String((archivoOriginal &amp;&amp; archivoOriginal.mime) || &quot;application/octet-stream&quot;).slice(0, 120),
      ext: String((archivoOriginal &amp;&amp; archivoOriginal.ext) || &quot;&quot;).slice(0, 20),
      base64Length: archivoBase64.length,
      chunks: Math.ceil(archivoBase64.length / 450000)
    } : null,
    estado: &quot;excel_guardado_completo_solo_respaldo&quot;,
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
    for (let i = 0; i &lt; chunksArchivo.length; i++) {
      const cRef = ref.collection(&quot;archivo_original&quot;).doc(String(i + 1).padStart(4, &quot;0&quot;));
      batchFile.set(cRef, {
        index: i + 1,
        totalChunks: chunksArchivo.length,
        base64: chunksArchivo[i],
        filename: String((archivoOriginal &amp;&amp; archivoOriginal.filename) || filename || &quot;respaldo.xlsx&quot;).slice(0, 180),
        createdAt: now
      });
      opsFile++;
      if (opsFile &gt;= 400) { await batchFile.commit(); batchFile = db.batch(); opsFile = 0; }
    }
    if (opsFile) await batchFile.commit();
  }

  for (const sheet of sheets) {
    const sheetRef = ref.collection(&quot;hojas&quot;).doc(String(sheet.index).padStart(3, &quot;0&quot;));
    await sheetRef.set({ index: sheet.index, name: sheet.name, totalFilas: sheet.rows.length, createdAt: now });
    const chunks = chunkArray(sheet.rows, 300);
    let batch = db.batch();
    let ops = 0;
    for (let i = 0; i &lt; chunks.length; i++) {
      const cRef = sheetRef.collection(&quot;filas&quot;).doc(String(i + 1).padStart(4, &quot;0&quot;));
      batch.set(cRef, { index: i + 1, total: chunks[i].length, rows: chunks[i], createdAt: now });
      ops++;
      if (ops &gt;= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
    }
    if (ops) await batch.commit();
  }

  await db.collection(&quot;auditoria_eventos&quot;).add({
    tipo: &quot;respaldo_excel_guardado&quot;,
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
  let q = db.collection(&quot;respaldos_excel&quot;);
  if (tipo !== &quot;general&quot;) q = q.where(&quot;tipo&quot;, &quot;==&quot;, tipo);
  // Evita depender de índices compuestos: si falla orderBy, hacemos fallback sin orden.
  let snap;
  try { snap = await q.orderBy(&quot;createdAt&quot;, &quot;desc&quot;).limit(limit).get(); }
  catch (_) { snap = await q.limit(limit).get(); }
  const items = snap.docs.map(d =&gt; {
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
  }).sort((a,b)=&gt;String(b.createdAt||&quot;&quot;).localeCompare(String(a.createdAt||&quot;&quot;)));
  return { ok: true, items };
}

async function leerRespaldo(db, body) {
  const id = String(body.id || &quot;&quot;).trim();
  if (!id) return { status: 400, json: { ok: false, error: &quot;Falta id del respaldo&quot; } };
  const doc = await db.collection(&quot;respaldos_excel&quot;).doc(id).get();
  if (!doc.exists) return { status: 404, json: { ok: false, error: &quot;No encontré ese respaldo Excel&quot; } };
  const meta = doc.data() || {};
  const hojas = Array.isArray(meta.hojas) ? meta.hojas : [];
  const sheetIndex = Number(body.sheetIndex) || Number(hojas[0]?.index) || 1;
  const sheetId = String(sheetIndex).padStart(3, &quot;0&quot;);
  const sheetRef = doc.ref.collection(&quot;hojas&quot;).doc(sheetId);
  const sheetDoc = await sheetRef.get();
  let sheetName = hojas.find(h =&gt; Number(h.index) === Number(sheetIndex))?.name || `Hoja ${sheetIndex}`;
  if (sheetDoc.exists &amp;&amp; sheetDoc.data()?.name) sheetName = sheetDoc.data().name;
  const chunkSnap = await sheetRef.collection(&quot;filas&quot;).orderBy(&quot;index&quot;, &quot;asc&quot;).limit(30).get();
  let rows = [];
  chunkSnap.docs.forEach(c =&gt; { rows = rows.concat((c.data() || {}).rows || []); });
  const maxRows = Math.min(Math.max(Number(body.maxRows) || 1000, 50), 9000);
  rows = rows.slice(0, maxRows);
  return { status: 200, json: { ok: true, id: doc.id, ...meta, hojas, sheetIndex, sheetName, rows, maxRows } };
}

async function buscarRespaldos(db, body) {
  const tipo = safeTipo(body.tipo);
  const q = String(body.q || &quot;&quot;).trim();
  if (!q) return { status: 400, json: { ok: false, error: &quot;Escriba algo para buscar&quot; } };
  const limit = Math.min(Math.max(Number(body.limit) || 200, 20), 300);
  const list = await listarRespaldos(db, { tipo, limit: 12 });
  const results = [];
  for (const item of list.items || []) {
    if (results.length &gt;= limit) break;
    const ref = db.collection(&quot;respaldos_excel&quot;).doc(item.id);
    const hojas = Array.isArray(item.hojas) ? item.hojas : [];
    for (const h of hojas) {
      if (results.length &gt;= limit) break;
      const sheetIndex = Number(h.index) || 1;
      const sheetRef = ref.collection(&quot;hojas&quot;).doc(String(sheetIndex).padStart(3, &quot;0&quot;));
      const chunks = await sheetRef.collection(&quot;filas&quot;).orderBy(&quot;index&quot;, &quot;asc&quot;).limit(60).get();
      for (const ch of chunks.docs) {
        if (results.length &gt;= limit) break;
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
            if (results.length &gt;= limit) break;
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
    snap.docs.forEach((doc) =&gt; batch.delete(doc.ref));
    await batch.commit();
    if (snap.size &lt; batchSize) break;
  }
}

async function actualizarRespaldoExcel(db, body) {
  const id = String(body.id || &quot;&quot;).trim();
  if (!id) return { status: 400, json: { ok: false, error: &quot;Falta id del Excel&quot; } };
  const sheetIndex = Number(body.sheetIndex) || 1;
  const rows = cleanRows(body.rows || []);
  const usuario = String(body.usuario || &quot;sublicuentas&quot;).trim();
  const rol = String(body.rol || &quot;admin&quot;).trim();
  const now = new Date().toISOString();
  const ref = db.collection(&quot;respaldos_excel&quot;).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return { status: 404, json: { ok: false, error: &quot;No encontré ese Excel guardado&quot; } };
  const meta = doc.data() || {};
  const hojasMeta = Array.isArray(meta.hojas) ? meta.hojas : [];
  const sheetId = String(sheetIndex).padStart(3, &quot;0&quot;);
  const sheetName = hojasMeta.find(h =&gt; Number(h.index) === Number(sheetIndex))?.name || `Hoja ${sheetIndex}`;
  const sheetRef = ref.collection(&quot;hojas&quot;).doc(sheetId);
  await deleteCollectionInBatches(sheetRef.collection(&quot;filas&quot;));
  await sheetRef.set({ index: sheetIndex, name: sheetName, totalFilas: rows.length, updatedAt: now, editable: true }, { merge: true });
  const chunks = chunkArray(rows, 300);
  let batch = db.batch();
  let ops = 0;
  for (let i = 0; i &lt; chunks.length; i++) {
    const cRef = sheetRef.collection(&quot;filas&quot;).doc(String(i + 1).padStart(4, &quot;0&quot;));
    batch.set(cRef, { index: i + 1, total: chunks[i].length, rows: chunks[i], updatedAt: now });
    ops++;
    if (ops &gt;= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
  }
  if (ops) await batch.commit();
  const newHojas = hojasMeta.map(h =&gt; Number(h.index) === Number(sheetIndex) ? { ...h, totalFilas: rows.length } : h);
  const totalFilas = newHojas.reduce((sum, h) =&gt; sum + Number(h.totalFilas || 0), 0);
  await ref.update({ hojas: newHojas, totalFilas, updatedAt: now, editable: true, ultimoEditor: usuario, ultimoRol: rol });
  await db.collection(&quot;auditoria_eventos&quot;).add({ tipo: &quot;respaldo_excel_editado&quot;, respaldoExcelId: id, sheetIndex, totalFilasHoja: rows.length, usuario, rol, createdAt: now, noModificaCRM: true });
  return { status: 200, json: { ok: true, id, sheetIndex, totalFilasHoja: rows.length, totalFilas, updatedAt: now } };
}

function cleanWordRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) =&gt; ({
    Fecha: String(r.Fecha || r.fecha || &quot;&quot;).trim(),
    Nombre: String(r.Nombre || r.nombre || &quot;&quot;).trim(),
    Plataforma: String(r.Plataforma || r.plataforma || &quot;&quot;).trim(),
    Precio: String(r.Precio || r.precio || &quot;&quot;).trim(),
    &quot;Teléfono&quot;: String(r[&quot;Teléfono&quot;] || r.Telefono || r.telefono || &quot;&quot;).trim(),
    Detalle: String(r.Detalle || r.detalle || &quot;&quot;).trim()
  })).filter((r) =&gt; Object.values(r).some((v) =&gt; String(v || &quot;&quot;).trim() !== &quot;&quot;));
}

async function guardarRespaldoWord(db, body) {
  const filename = String(body.filename || &quot;LISTA RELOJES.docx&quot;).trim();
  const usuario = String(body.usuario || &quot;sublicuentas&quot;).trim();
  const rol = String(body.rol || &quot;admin&quot;).trim();
  const rawText = String(body.rawText || &quot;&quot;);
  const rows = cleanWordRows(body.rows || []);
  const archivoOriginal = body.archivoOriginal &amp;&amp; typeof body.archivoOriginal === &quot;object&quot; ? body.archivoOriginal : null;
  const archivoBase64 = archivoOriginal &amp;&amp; archivoOriginal.base64 ? String(archivoOriginal.base64) : &quot;&quot;;
  const now = new Date().toISOString();
  if (!rows.length &amp;&amp; !rawText.trim()) return { status: 400, json: { ok: false, error: &quot;No hay datos del Word para guardar&quot; } };
  const ref = db.collection(&quot;respaldos_word&quot;).doc();
  await ref.set({
    filename,
    tipo: &quot;word_relojes&quot;,
    tipoLabel: &quot;Word Relojes / Cobros&quot;,
    usuario,
    rol,
    totalFilas: rows.length,
    editable: true,
    archivoGuardado: !!archivoBase64,
    archivoOriginal: archivoBase64 ? {
      filename: String((archivoOriginal &amp;&amp; archivoOriginal.filename) || filename).slice(0, 180),
      size: Number((archivoOriginal &amp;&amp; archivoOriginal.size) || 0),
      mime: String((archivoOriginal &amp;&amp; archivoOriginal.mime) || &quot;application/octet-stream&quot;).slice(0, 120),
      ext: &quot;docx&quot;,
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
    for (let i = 0; i &lt; chunksArchivo.length; i++) {
      const cRef = ref.collection(&quot;archivo_original&quot;).doc(String(i + 1).padStart(4, &quot;0&quot;));
      batchFile.set(cRef, { index: i + 1, totalChunks: chunksArchivo.length, base64: chunksArchivo[i], filename, createdAt: now });
      opsFile++;
      if (opsFile &gt;= 400) { await batchFile.commit(); batchFile = db.batch(); opsFile = 0; }
    }
    if (opsFile) await batchFile.commit();
  }
  const rawChunks = chunkString(rawText, 450000);
  let rawBatch = db.batch(); let rawOps = 0;
  for (let i = 0; i &lt; rawChunks.length; i++) {
    const cRef = ref.collection(&quot;texto_original&quot;).doc(String(i + 1).padStart(4, &quot;0&quot;));
    rawBatch.set(cRef, { index: i + 1, text: rawChunks[i], createdAt: now });
    rawOps++;
    if (rawOps &gt;= 400) { await rawBatch.commit(); rawBatch = db.batch(); rawOps = 0; }
  }
  if (rawOps) await rawBatch.commit();
  await guardarWordRows(ref, rows, now);
  await db.collection(&quot;auditoria_eventos&quot;).add({ tipo: &quot;respaldo_word_guardado&quot;, respaldoWordId: ref.id, filename, totalFilas: rows.length, usuario, rol, createdAt: now, noModificaCRM: true });
  return { status: 200, json: { ok: true, id: ref.id, totalFilas: rows.length, archivoGuardado: !!archivoBase64, updatedAt: now } };
}

async function guardarWordRows(ref, rows, now) {
  await deleteCollectionInBatches(ref.collection(&quot;filas&quot;));
  const chunks = chunkArray(rows, 300);
  let batch = ref.firestore.batch(); let ops = 0;
  for (let i = 0; i &lt; chunks.length; i++) {
    const cRef = ref.collection(&quot;filas&quot;).doc(String(i + 1).padStart(4, &quot;0&quot;));
    batch.set(cRef, { index: i + 1, total: chunks[i].length, rows: chunks[i], updatedAt: now });
    ops++;
    if (ops &gt;= 400) { await batch.commit(); batch = ref.firestore.batch(); ops = 0; }
  }
  if (ops) await batch.commit();
}

async function listarRespaldosWord(db, body) {
  const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 50);
  let snap;
  try { snap = await db.collection(&quot;respaldos_word&quot;).orderBy(&quot;createdAt&quot;, &quot;desc&quot;).limit(limit).get(); }
  catch (_) { snap = await db.collection(&quot;respaldos_word&quot;).limit(limit).get(); }
  const items = snap.docs.map(d =&gt; {
    const x = d.data() || {};
    return { id: d.id, filename: x.filename, tipo: x.tipo, tipoLabel: x.tipoLabel, totalFilas: x.totalFilas || 0, editable: !!x.editable, archivoGuardado: !!x.archivoGuardado, usuario: x.usuario, rol: x.rol, createdAt: x.createdAt, updatedAt: x.updatedAt };
  }).sort((a,b)=&gt;String(b.createdAt||&quot;&quot;).localeCompare(String(a.createdAt||&quot;&quot;)));
  return { ok: true, items };
}

async function leerRespaldoWord(db, body) {
  const id = String(body.id || &quot;&quot;).trim();
  if (!id) return { status: 400, json: { ok: false, error: &quot;Falta id del Word&quot; } };
  const doc = await db.collection(&quot;respaldos_word&quot;).doc(id).get();
  if (!doc.exists) return { status: 404, json: { ok: false, error: &quot;No encontré ese Word guardado&quot; } };
  const meta = doc.data() || {};
  const maxRows = Math.min(Math.max(Number(body.maxRows) || 1000, 50), 9000);
  const chunks = await doc.ref.collection(&quot;filas&quot;).orderBy(&quot;index&quot;, &quot;asc&quot;).limit(60).get();
  let rows = [];
  chunks.docs.forEach(c =&gt; { rows = rows.concat((c.data() || {}).rows || []); });
  rows = rows.slice(0, maxRows);
  return { status: 200, json: { ok: true, id: doc.id, ...meta, rows, maxRows } };
}

async function actualizarRespaldoWord(db, body) {
  const id = String(body.id || &quot;&quot;).trim();
  if (!id) return { status: 400, json: { ok: false, error: &quot;Falta id del Word&quot; } };
  const rows = cleanWordRows(body.rows || []);
  const usuario = String(body.usuario || &quot;sublicuentas&quot;).trim();
  const rol = String(body.rol || &quot;admin&quot;).trim();
  const now = new Date().toISOString();
  const ref = db.collection(&quot;respaldos_word&quot;).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return { status: 404, json: { ok: false, error: &quot;No encontré ese Word guardado&quot; } };
  await guardarWordRows(ref, rows, now);
  await ref.update({ totalFilas: rows.length, updatedAt: now, ultimoEditor: usuario, ultimoRol: rol, editable: true });
  await db.collection(&quot;auditoria_eventos&quot;).add({ tipo: &quot;respaldo_word_editado&quot;, respaldoWordId: id, totalFilas: rows.length, usuario, rol, createdAt: now, noModificaCRM: true });
  return { status: 200, json: { ok: true, id, totalFilas: rows.length, updatedAt: now } };
}


async function iniciarRespaldoExcel(db, body) {
  const tipo = safeTipo(body.tipo);
  const filename = String(body.filename || &quot;respaldo.xlsx&quot;).trim();
  const usuario = String(body.usuario || &quot;sublicuentas&quot;).trim();
  const rol = String(body.rol || &quot;admin&quot;).trim();
  const destinoRol = String(body.destinoRol || (tipo === &quot;streaming&quot; ? &quot;auditor&quot; : &quot;admin&quot;)).trim();
  const now = new Date().toISOString();
  const hojasRaw = Array.isArray(body.hojas) ? body.hojas : [];
  const hojas = hojasRaw.map((h, i) =&gt; ({
    index: Number(h &amp;&amp; h.index) || i + 1,
    name: String((h &amp;&amp; h.name) || `Hoja ${i + 1}`).slice(0, 80),
    totalFilas: Number(h &amp;&amp; h.totalFilas) || 0
  })).filter(h =&gt; h.totalFilas &gt; 0);
  const totalFilas = Number(body.totalFilas) || hojas.reduce((a, h) =&gt; a + Number(h.totalFilas || 0), 0);
  if (!hojas.length || !totalFilas) return { status: 400, json: { ok: false, error: &quot;No hay hojas/filas para iniciar respaldo&quot; } };
  const ref = db.collection(&quot;respaldos_excel&quot;).doc();
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
    estado: &quot;subiendo_por_partes&quot;,
    noModificaCRM: true,
    noModificaInventario: true,
    noModificaBotTelegram: true,
    createdAt: now,
    updatedAt: now
  });
  return { status: 200, json: { ok: true, id: ref.id, totalHojas: hojas.length, totalFilas, estado: &quot;subiendo_por_partes&quot; } };
}

async function guardarRespaldoExcelChunk(db, body) {
  const id = String(body.id || &quot;&quot;).trim();
  if (!id) return { status: 400, json: { ok: false, error: &quot;Falta id del Excel&quot; } };
  const sheetIndex = Number(body.sheetIndex) || 1;
  const sheetName = String(body.sheetName || `Hoja ${sheetIndex}`).slice(0, 80);
  const chunkIndex = Number(body.chunkIndex) || 1;
  const totalChunks = Number(body.totalChunks) || 1;
  const rows = cleanRows(body.rows || []);
  const now = new Date().toISOString();
  const ref = db.collection(&quot;respaldos_excel&quot;).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return { status: 404, json: { ok: false, error: &quot;No encontré ese respaldo iniciado&quot; } };
  const sheetRef = ref.collection(&quot;hojas&quot;).doc(String(sheetIndex).padStart(3, &quot;0&quot;));
  await sheetRef.set({ index: sheetIndex, name: sheetName, updatedAt: now, editable: true }, { merge: true });
  await sheetRef.collection(&quot;filas&quot;).doc(String(chunkIndex).padStart(4, &quot;0&quot;)).set({
    index: chunkIndex,
    totalChunks,
    total: rows.length,
    rows,
    updatedAt: now
  });
  await ref.update({ updatedAt: now, estado: &quot;subiendo_por_partes&quot; });
  return { status: 200, json: { ok: true, id, sheetIndex, chunkIndex, total: rows.length } };
}

async function finalizarRespaldoExcel(db, body) {
  const id = String(body.id || &quot;&quot;).trim();
  if (!id) return { status: 400, json: { ok: false, error: &quot;Falta id del Excel&quot; } };
  const usuario = String(body.usuario || &quot;sublicuentas&quot;).trim();
  const rol = String(body.rol || &quot;admin&quot;).trim();
  const now = new Date().toISOString();
  const ref = db.collection(&quot;respaldos_excel&quot;).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return { status: 404, json: { ok: false, error: &quot;No encontré ese respaldo Excel&quot; } };
  const meta = doc.data() || {};
  await ref.update({ estado: &quot;guardado_editable&quot;, editable: true, updatedAt: now, ultimoEditor: usuario, ultimoRol: rol });
  await db.collection(&quot;auditoria_eventos&quot;).add({
    tipo: &quot;respaldo_excel_guardado_por_partes&quot;,
    respaldoExcelId: id,
    filename: meta.filename || &quot;&quot;,
    respaldoTipo: meta.tipo || &quot;&quot;,
    totalHojas: meta.totalHojas || 0,
    totalFilas: meta.totalFilas || 0,
    usuario,
    rol,
    noModificaCRM: true,
    createdAt: now
  });
  return { status: 200, json: { ok: true, id, estado: &quot;guardado_editable&quot;, totalHojas: meta.totalHojas || 0, totalFilas: meta.totalFilas || 0 } };
}



/* ============================================================
   MÓDULOS DE TRABAJO POR SECCIÓN · HOJA DE CÁLCULO COMPLETA
   Todo el archivo entra a Sublichat (todas las hojas, todas las celdas)
   y se trabaja aquí dentro. Guarda valores (los gráficos/fórmulas de
   Excel se regeneran al exportar). No toca CRM, inventario ni el bot.
       bodega       -&gt; Sublicuentas (Excel inventario)
       auditoria    -&gt; Magdiel      (Excel streaming)
       flujo_diario -&gt; Relojes       (Word)
   Estructura Firestore:
     secciones_trabajo/{sec}                         (meta + lista de hojas)
     secciones_trabajo/{sec}/hojas/{NNN}             (meta de hoja)
     secciones_trabajo/{sec}/hojas/{NNN}/bloques/{CCCC}  (filas en bloques)
   ============================================================ */
const SEC_COL = &quot;secciones_trabajo&quot;;
const SECCIONES = {
  bodega:       { label: &quot;Bodega&quot;,       kind: &quot;excel&quot;, owner: &quot;sublicuentas&quot;, emoji: &quot;📦&quot; },
  auditoria:    { label: &quot;Auditoría&quot;,    kind: &quot;excel&quot;, owner: &quot;magdiel&quot;,      emoji: &quot;📊&quot; },
  flujo_diario: { label: &quot;Flujo diario&quot;, kind: &quot;word&quot;,  owner: &quot;relojes&quot;,       emoji: &quot;🧾&quot; }
};
function secOk(s) { return Object.prototype.hasOwnProperty.call(SECCIONES, String(s || &quot;&quot;)); }
function secPad(n, w) { return String(n).padStart(w, &quot;0&quot;); }
function secCleanCell(v) { return v == null ? &quot;&quot; : String(v).slice(0, 900); }
function secCleanFilas(filas) {
  if (!Array.isArray(filas)) return [];
  return filas.slice(0, 2000).map((r) =&gt; (Array.isArray(r) ? r : []).slice(0, 250).map(secCleanCell));
}

async function secHojaIniciar(db, body) {
  const seccion = String(body.seccion || &quot;&quot;).trim();
  if (!secOk(seccion)) return { status: 400, json: { ok: false, error: &quot;Sección no válida&quot; } };
  const index = Number(body.index) || 1;
  const name = String(body.name || (&quot;Hoja &quot; + index)).slice(0, 120);
  const rows = Number(body.rows) || 0;
  const cols = Number(body.cols) || 0;
  const now = new Date().toISOString();
  const hojaRef = db.collection(SEC_COL).doc(seccion).collection(&quot;hojas&quot;).doc(secPad(index, 3));
  await deleteCollectionInBatches(hojaRef.collection(&quot;bloques&quot;));
  await hojaRef.set({ index, name, rows, cols, updatedAt: now });
  return { status: 200, json: { ok: true, seccion, index, name } };
}
async function secHojaBloque(db, body) {
  const seccion = String(body.seccion || &quot;&quot;).trim();
  if (!secOk(seccion)) return { status: 400, json: { ok: false, error: &quot;Sección no válida&quot; } };
  const index = Number(body.index) || 1;
  const bloque = Number(body.bloque) || 1;
  const filas = secCleanFilas(body.filas || []);
  const hojaRef = db.collection(SEC_COL).doc(seccion).collection(&quot;hojas&quot;).doc(secPad(index, 3));
  await hojaRef.collection(&quot;bloques&quot;).doc(secPad(bloque, 4)).set({ bloque, total: filas.length, filas });
  return { status: 200, json: { ok: true, seccion, index, bloque, filas: filas.length } };
}
async function secFinalizar(db, body) {
  const seccion = String(body.seccion || &quot;&quot;).trim();
  if (!secOk(seccion)) return { status: 400, json: { ok: false, error: &quot;Sección no válida&quot; } };
  const cfg = SECCIONES[seccion];
  const hojasRaw = Array.isArray(body.hojas) ? body.hojas : [];
  const hojas = hojasRaw.map((h, i) =&gt; ({ index: Number(h &amp;&amp; h.index) || i + 1, name: String((h &amp;&amp; h.name) || (&quot;Hoja &quot; + (i + 1))).slice(0, 120), rows: Number(h &amp;&amp; h.rows) || 0, cols: Number(h &amp;&amp; h.cols) || 0 }));
  const totalFilas = hojas.reduce((a, h) =&gt; a + (h.rows || 0), 0);
  const editor = String(body.editor || body.usuario || &quot;sublicuentas&quot;).trim();
  const filename = String(body.filename || &quot;&quot;).slice(0, 180);
  const motivo = String(body.motivo || &quot;migracion&quot;).slice(0, 40);
  const now = new Date().toISOString();
  await db.collection(SEC_COL).doc(seccion).set({
    id: seccion, label: cfg.label, kind: cfg.kind, owner: cfg.owner, emoji: cfg.emoji,
    hojas, totalHojas: hojas.length, totalFilas, filename, motivo,
    updatedAt: now, updatedBy: editor,
    noModificaCRM: true, noModificaInventario: true, noModificaBotTelegram: true
  });
  await db.collection(&quot;auditoria_eventos&quot;).add({ tipo: &quot;seccion_&quot; + motivo, seccion, totalHojas: hojas.length, totalFilas, editor, filename, createdAt: now, noModificaCRM: true });
  return { status: 200, json: { ok: true, seccion, totalHojas: hojas.length, totalFilas, updatedAt: now } };
}
async function secLeer(db, body) {
  const seccion = String(body.seccion || &quot;&quot;).trim();
  if (!secOk(seccion)) return { status: 400, json: { ok: false, error: &quot;Sección no válida&quot; } };
  const cfg = SECCIONES[seccion];
  const doc = await db.collection(SEC_COL).doc(seccion).get();
  if (!doc.exists) return { status: 200, json: { ok: true, seccion, label: cfg.label, kind: cfg.kind, emoji: cfg.emoji, owner: cfg.owner, hojas: [], totalHojas: 0, totalFilas: 0, filename: &quot;&quot;, updatedAt: &quot;&quot;, updatedBy: &quot;&quot;, vacio: true } };
  const m = doc.data() || {};
  return { status: 200, json: { ok: true, seccion, label: m.label || cfg.label, kind: m.kind || cfg.kind, emoji: m.emoji || cfg.emoji, owner: m.owner || cfg.owner, hojas: m.hojas || [], totalHojas: m.totalHojas || 0, totalFilas: m.totalFilas || 0, filename: m.filename || &quot;&quot;, updatedAt: m.updatedAt || &quot;&quot;, updatedBy: m.updatedBy || &quot;&quot;, vacio: false } };
}
async function secHojaLeer(db, body) {
  const seccion = String(body.seccion || &quot;&quot;).trim();
  if (!secOk(seccion)) return { status: 400, json: { ok: false, error: &quot;Sección no válida&quot; } };
  const index = Number(body.index) || 1;
  const hojaRef = db.collection(SEC_COL).doc(seccion).collection(&quot;hojas&quot;).doc(secPad(index, 3));
  const hd = await hojaRef.get();
  if (!hd.exists) return { status: 404, json: { ok: false, error: &quot;No encontré esa hoja&quot; } };
  const meta = hd.data() || {};
  const maxRows = Math.min(Math.max(Number(body.maxRows) || 5000, 50), 50000);
  const snap = await hojaRef.collection(&quot;bloques&quot;).orderBy(&quot;bloque&quot;, &quot;asc&quot;).get();
  let filas = [];
  snap.docs.forEach((d) =&gt; { filas = filas.concat((d.data() || {}).filas || []); });
  const recortado = filas.length &gt; maxRows;
  filas = filas.slice(0, maxRows);
  return { status: 200, json: { ok: true, seccion, index, name: meta.name || (&quot;Hoja &quot; + index), rows: meta.rows || filas.length, cols: meta.cols || 0, filas, recortado } };
}
async function secEstado(db) {
  const out = {};
  for (const s of Object.keys(SECCIONES)) {
    const cfg = SECCIONES[s];
    const doc = await db.collection(SEC_COL).doc(s).get();
    if (doc.exists) { const m = doc.data() || {}; out[s] = { label: m.label || cfg.label, kind: m.kind || cfg.kind, emoji: m.emoji || cfg.emoji, owner: m.owner || cfg.owner, totalHojas: m.totalHojas || 0, totalFilas: m.totalFilas || 0, filename: m.filename || &quot;&quot;, updatedAt: m.updatedAt || &quot;&quot;, updatedBy: m.updatedBy || &quot;&quot;, vacio: false }; }
    else out[s] = { label: cfg.label, kind: cfg.kind, emoji: cfg.emoji, owner: cfg.owner, totalHojas: 0, totalFilas: 0, filename: &quot;&quot;, updatedAt: &quot;&quot;, updatedBy: &quot;&quot;, vacio: true };
  }
  return { status: 200, json: { ok: true, secciones: out, config: SECCIONES } };
}

export default async function handler(req, res) {
  res.setHeader(&quot;Access-Control-Allow-Origin&quot;, &quot;*&quot;);
  res.setHeader(&quot;Access-Control-Allow-Methods&quot;, &quot;POST,OPTIONS&quot;);
  res.setHeader(&quot;Access-Control-Allow-Headers&quot;, &quot;Content-Type&quot;);
  if (req.method === &quot;OPTIONS&quot;) return res.status(200).end();
  if (req.method !== &quot;POST&quot;) return res.status(405).json({ ok: false, error: &quot;Método no permitido&quot; });

  try {
    const db = getApp().firestore();
    const body = req.body || {};
    const accion = body.accion || &quot;guardar_respaldo_excel&quot;;

    if (accion === &quot;iniciar_respaldo_excel&quot;) {
      const out = await iniciarRespaldoExcel(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === &quot;guardar_respaldo_excel_chunk&quot;) {
      const out = await guardarRespaldoExcelChunk(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === &quot;finalizar_respaldo_excel&quot;) {
      const out = await finalizarRespaldoExcel(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === &quot;guardar_respaldo_excel&quot; || accion === &quot;guardar_importacion&quot;) {
      const out = await guardarRespaldo(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === &quot;listar_respaldos_excel&quot;) {
      return res.status(200).json(await listarRespaldos(db, body));
    }
    if (accion === &quot;leer_respaldo_excel&quot;) {
      const out = await leerRespaldo(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === &quot;buscar_respaldo_excel&quot;) {
      const out = await buscarRespaldos(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === &quot;actualizar_respaldo_excel&quot;) {
      const out = await actualizarRespaldoExcel(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === &quot;guardar_respaldo_word&quot;) {
      const out = await guardarRespaldoWord(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === &quot;listar_respaldos_word&quot;) {
      return res.status(200).json(await listarRespaldosWord(db, body));
    }
    if (accion === &quot;leer_respaldo_word&quot;) {
      const out = await leerRespaldoWord(db, body);
      return res.status(out.status).json(out.json);
    }
    if (accion === &quot;actualizar_respaldo_word&quot;) {
      const out = await actualizarRespaldoWord(db, body);
      return res.status(out.status).json(out.json);
    }

    if (accion === &quot;sec_hoja_iniciar&quot;) { const out = await secHojaIniciar(db, body); return res.status(out.status).json(out.json); }
    if (accion === &quot;sec_hoja_bloque&quot;)  { const out = await secHojaBloque(db, body);  return res.status(out.status).json(out.json); }
    if (accion === &quot;sec_finalizar&quot;)    { const out = await secFinalizar(db, body);   return res.status(out.status).json(out.json); }
    if (accion === &quot;sec_leer&quot;)         { const out = await secLeer(db, body);        return res.status(out.status).json(out.json); }
    if (accion === &quot;sec_hoja_leer&quot;)    { const out = await secHojaLeer(db, body);    return res.status(out.status).json(out.json); }
    if (accion === &quot;sec_estado&quot;)       { const out = await secEstado(db);            return res.status(out.status).json(out.json); }

    return res.status(400).json({ ok: false, error: &quot;Acción no reconocida&quot; });
  } catch (e) {
    console.error(&quot;RESPALDO_EXCEL_ERROR&quot;, e);
    return res.status(500).json({ ok: false, error: String((e &amp;&amp; e.message) || e) });
  }
}
</code></pre></body></html>
