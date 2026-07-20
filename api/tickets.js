// api/tickets.js · Sublichat Tickets de Auditoría
// Guarda tickets internos en Firestore y envía aviso por Telegram si están configuradas las variables.
// Variables esperadas en Vercel:
// FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
// TELEGRAM_BOT_TOKEN y, opcionalmente, TELEGRAM_CHAT_ID_<PERFIL>.
// Los IDs de respaldo incluidos abajo permiten avisar a todos los vendedores configurados.

const admin = require('firebase-admin');

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
  privateKey = privateKey.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Faltan variables FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY.');
  }
  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
}

function clean(v, max = 1000) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function roleLabel(role) {
  if (role === 'sublicuentas') return 'Sublicuentas';
  if (role === 'relojes') return 'Relojes';
  if (role === 'magdiel') return 'Magdiel';
  if (role === 'yami') return 'Yami';
  if (role === 'jimena') return 'Jimena';
  if (role === 'manuel') return 'Manuel';
  return clean(role || 'Usuario', 40);
}

const DESTINOS_VALIDOS = new Set(['sublicuentas', 'relojes', 'magdiel', 'yami', 'jimena', 'manuel']);

function normalizeDestinos(destino, fromRol = '') {
  const d = clean(destino, 40).toLowerCase();
  const fr = clean(fromRol, 40).toLowerCase();
  if (['sublicuentas_magdiel', 'magdiel_sublicuentas', 'admin_auditor'].includes(d)) return ['sublicuentas', 'magdiel'];
  if (['sublicuentas_relojes', 'relojes_sublicuentas', 'admin_relojes'].includes(d)) return ['sublicuentas', 'relojes'];
  if (d === 'todos' || d === 'all') return ['sublicuentas', 'relojes', 'magdiel', 'yami', 'jimena', 'manuel'];
  if (d === 'both' || d === 'ambos') {
    if (fr === 'relojes') return ['sublicuentas', 'magdiel'];
    if (fr === 'magdiel') return ['sublicuentas', 'relojes'];
    return ['relojes', 'magdiel'];
  }
  if (d === 'sublicuentas' || d === 'naara' || d === 'admin') return ['sublicuentas'];
  if (d === 'relojes' || d === 'libni' || d === 'finanzas') return ['relojes'];
  if (d === 'magdiel' || d === 'auditoria') return ['magdiel'];
  if (d === 'yami') return ['yami'];
  if (d === 'jimena') return ['jimena'];
  if (d === 'manuel') return ['manuel'];
  return ['sublicuentas'];
}

function normalizeDestinosBody(body, fromRol = '') {
  const explicit = Array.isArray(body && body.destinos)
    ? body.destinos.map(v => clean(v, 40).toLowerCase()).filter(v => DESTINOS_VALIDOS.has(v))
    : [];
  if (explicit.length) return [...new Set(explicit)];
  return normalizeDestinos(body && body.destino, fromRol);
}

function destinosLabel(destinos) {
  return (destinos || []).map(roleLabel).join(' + ');
}

// Chat IDs de Telegram por perfil. Se pueden sobreescribir con variables de entorno
// en Vercel (TELEGRAM_CHAT_ID_MAGDIEL, TELEGRAM_CHAT_ID_RELOJES, TELEGRAM_CHAT_ID_SUBLICUENTAS).
// Si no hay variable de entorno, se usa el ID fijo de respaldo.
const CHAT_IDS = {
  magdiel: process.env.TELEGRAM_CHAT_ID_MAGDIEL || '8652640043',
  relojes: process.env.TELEGRAM_CHAT_ID_RELOJES || '411539492',
  sublicuentas: process.env.TELEGRAM_CHAT_ID_SUBLICUENTAS || '5728675990',
  yami: process.env.TELEGRAM_CHAT_ID_YAMI || '7511522045',
  jimena: process.env.TELEGRAM_CHAT_ID_JIMENA || '7844369242',
  manuel: process.env.TELEGRAM_CHAT_ID_MANUEL || '6848826692'
};

function telegramHTML(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendTelegramTo(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
  if (!token || !chatId) return { ok: false, skipped: true, reason: 'telegram_env_missing' };
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) return { ok: false, error: j.description || `Telegram HTTP ${r.status}`, chatId };
  return { ok: true, chatId };
}

// Envía el mensaje a cada chat correspondiente a los roles en `destinos`.
// Si no hay destinos (o no matchea ningún perfil conocido), cae a TELEGRAM_CHAT_ID genérico si existe.
async function sendTelegram(text, destinos) {
  const roles = Array.isArray(destinos) ? destinos.filter(r => CHAT_IDS[r]) : [];
  let targets = roles.map(r => CHAT_IDS[r]);
  if (!targets.length) {
    const fallback = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_AUDIT_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID || '';
    if (fallback) targets = [fallback];
  }
  targets = [...new Set(targets)]; // evita duplicados si dos roles comparten chat_id
  if (!targets.length) return { ok: false, skipped: true, reason: 'sin_destinos' };
  const results = await Promise.all(targets.map(id => sendTelegramTo(id, text)));
  const allOk = results.every(r => r.ok);
  return { ok: allOk, results };
}

async function listTickets(db, body) {
  const rol = clean(body.rol || '', 40).toLowerCase();
  const limit = Math.min(Math.max(Number(body.limit) || 80, 1), 150);
  let snap;
  try {
    snap = await db.collection('tickets_auditoria').orderBy('createdAt', 'desc').limit(limit).get();
  } catch (_) {
    snap = await db.collection('tickets_auditoria').limit(limit).get();
  }
  let items = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  if (rol && rol !== 'sublicuentas') {
    items = items.filter(t => {
      const destinos = Array.isArray(t.destinos) ? t.destinos : [];
      return destinos.includes(rol) || String(t.creadoPorRol || '') === rol;
    });
  }
  return { ok: true, items };
}

// Genera un número de ticket secuencial (#1, #2, #3...) usando un contador en Firestore.
async function nextTicketNumero(db) {
  const counterRef = db.collection('contadores').doc('tickets');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const actual = snap.exists ? Number(snap.data().valor || 0) : 0;
    const nuevo = actual + 1;
    tx.set(counterRef, { valor: nuevo }, { merge: true });
    return nuevo;
  });
}

// Estados con etiqueta corta para las alertas.
function estadoLabel(estado) {
  const e = String(estado || '').toLowerCase();
  if (e === 'proceso') return 'En proceso';
  if (e === 'resuelto') return 'Resuelto';
  if (e === 'respondido') return 'Respondido';
  return 'Abierto';
}

async function createTicket(db, body) {
  const now = new Date().toISOString();
  const titulo = clean(body.titulo, 160);
  const detalle = clean(body.detalle, 3000);
  if (!titulo || !detalle) return { status: 400, json: { ok: false, error: 'Falta título o detalle del ticket.' } };
  const creadoRol = clean(body.rol || '', 40).toLowerCase();
  const destinos = normalizeDestinosBody(body, creadoRol);
  const tipo = clean(body.tipo || 'ticket', 30).toLowerCase();
  const numero = await nextTicketNumero(db);
  const item = {
    numero,
    titulo,
    detalle,
    tipo,
    destinos,
    destinosLabel: destinosLabel(destinos),
    prioridad: clean(body.prioridad || 'normal', 30),
    seccion: clean(body.seccion || 'auditoria', 60),
    estado: 'abierto',
    creadoPor: clean(body.usuario || 'Sublichat', 80),
    creadoPorRol: creadoRol,
    createdAt: now,
    updatedAt: now,
    resolucion: '',
    resueltoPor: '',
    resueltoAt: ''
  };
  const ref = await db.collection('tickets_auditoria').add(item);
  const esAviso = tipo === 'aviso' || item.seccion === 'avisos';
  const msg = esAviso ? [
    `📢 <b>Nuevo aviso de ${telegramHTML(roleLabel(creadoRol))}</b>`,
    `<b>Para:</b> ${telegramHTML(item.destinosLabel)}`,
    `<b>${telegramHTML(item.titulo.replace(/^AVISO\s*[·:-]?\s*/i, '') || 'Actualización')}</b>`,
    telegramHTML(item.detalle)
  ].join('\n') : [
    `🎫 <b>${telegramHTML(roleLabel(creadoRol))}</b> te ha enviado un ticket #${numero}`,
    `<b>Motivo:</b> ${telegramHTML(item.titulo)}`,
    `<b>Estado:</b> ${telegramHTML(estadoLabel(item.estado))}`
  ].join('\n');
  const telegram = await sendTelegram(msg, item.destinos).catch(e => ({ ok: false, error: e.message }));
  await ref.set({ id: ref.id, telegramOk: !!telegram.ok, telegramInfo: telegram }, { merge: true });
  return { ok: true, id: ref.id, numero, telegramOk: !!telegram.ok, telegramInfo: telegram };
}


async function setProcesoTicket(db, body) {
  const id = clean(body.id, 120);
  if (!id) return { status: 400, json: { ok: false, error: 'Falta id del ticket.' } };
  const ref = db.collection('tickets_auditoria').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { status: 404, json: { ok: false, error: 'No encontré ese ticket.' } };
  const old = snap.data() || {};
  if (String(old.estado || 'abierto') === 'resuelto') return { ok: true, id, alreadyResolved: true };
  const now = new Date().toISOString();
  const update = {
    estado: 'proceso',
    procesoPor: clean(body.usuario || 'Sublichat', 80),
    procesoPorRol: clean(body.rol || '', 40).toLowerCase(),
    procesoAt: now,
    updatedAt: now
  };
  await ref.set(update, { merge: true });
  const msg = [
    `🔄 Ticket #${old.numero || id.slice(-4)}`,
    `<b>Estado:</b> ${estadoLabel(update.estado)}`
  ].join('\n');
  const telegram = await sendTelegram(msg, old.destinos).catch(e => ({ ok: false, error: e.message }));
  await ref.set({ telegramProcessOk: !!telegram.ok, telegramProcessInfo: telegram }, { merge: true });
  return { ok: true, id, telegramOk: !!telegram.ok, telegramInfo: telegram };
}

async function resolveTicket(db, body) {
  const id = clean(body.id, 120);
  const resolucion = clean(body.resolucion, 3000);
  if (!id || !resolucion) return { status: 400, json: { ok: false, error: 'Falta id o resolución.' } };
  const ref = db.collection('tickets_auditoria').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { status: 404, json: { ok: false, error: 'No encontré ese ticket.' } };
  const old = snap.data() || {};
  const now = new Date().toISOString();
  const update = {
    estado: 'resuelto',
    resolucion,
    resueltoPor: clean(body.usuario || 'Sublichat', 80),
    resueltoPorRol: clean(body.rol || '', 40).toLowerCase(),
    resueltoAt: now,
    updatedAt: now
  };
  await ref.set(update, { merge: true });
  const msg = [
    `✅ Ticket #${old.numero || id.slice(-4)}`,
    `<b>Estado:</b> ${estadoLabel(update.estado)}`
  ].join('\n');
  const telegram = await sendTelegram(msg, old.destinos).catch(e => ({ ok: false, error: e.message }));
  await ref.set({ telegramResolvedOk: !!telegram.ok, telegramResolvedInfo: telegram }, { merge: true });
  return { ok: true, id, telegramOk: !!telegram.ok, telegramInfo: telegram };
}

async function responderTicket(db, body) {
  const id = clean(body.id, 120);
  const respuesta = clean(body.respuesta, 3000);
  if (!id || !respuesta) return { status: 400, json: { ok: false, error: 'Falta id o respuesta.' } };
  const ref = db.collection('tickets_auditoria').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { status: 404, json: { ok: false, error: 'No encontré ese ticket.' } };
  const old = snap.data() || {};
  const now = new Date().toISOString();
  const entry = {
    texto: respuesta,
    por: clean(body.usuario || 'Sublichat', 80),
    porRol: clean(body.rol || '', 40).toLowerCase(),
    at: now
  };
  const respuestas = Array.isArray(old.respuestas) ? old.respuestas.slice() : [];
  respuestas.push(entry);
  const update = {
    respuestas,
    ultimaRespuesta: respuesta,
    ultimaRespuestaPor: entry.por,
    estado: String(old.estado || 'abierto') === 'resuelto' ? 'resuelto' : 'respondido',
    updatedAt: now
  };
  await ref.set(update, { merge: true });
  const msg = [
    `💬 Ticket #${old.numero || id.slice(-4)}`,
    `<b>Estado:</b> ${estadoLabel(update.estado)}`
  ].join('\n');
  const telegram = await sendTelegram(msg, old.destinos).catch(e => ({ ok: false, error: e.message }));
  await ref.set({ telegramReplyOk: !!telegram.ok, telegramReplyInfo: telegram }, { merge: true });
  return { ok: true, id, telegramOk: !!telegram.ok, telegramInfo: telegram };
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });
  try {
    getApp();
    const db = admin.firestore();
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, msg: 'api/tickets activo', version: 'tickets-avisos-vendedores-20260720' });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido.' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const accion = clean(body.accion || 'listar', 50).toLowerCase();
    let out;
    if (accion === 'listar') out = await listTickets(db, body);
    else if (accion === 'crear') out = await createTicket(db, body);
    else if (accion === 'proceso') out = await setProcesoTicket(db, body);
    else if (accion === 'responder') out = await responderTicket(db, body);
    else if (accion === 'resolver') out = await resolveTicket(db, body);
    else out = { status: 400, json: { ok: false, error: 'Acción no soportada: ' + accion } };
    if (out && out.status) return res.status(out.status).json(out.json);
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e && e.message ? e.message : String(e) });
  }
};
