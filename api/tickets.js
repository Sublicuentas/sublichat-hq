// api/tickets.js · Sublichat Tickets de Auditoría
// Guarda tickets internos en Firestore y envía aviso por Telegram si están configuradas las variables.
// Variables esperadas en Vercel:
// FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
// TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID  (o TELEGRAM_AUDIT_CHAT_ID / TELEGRAM_ADMIN_CHAT_ID)

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
  return clean(role || 'Usuario', 40);
}

function normalizeDestinos(destino, fromRol = '') {
  const d = clean(destino, 40).toLowerCase();
  const fr = clean(fromRol, 40).toLowerCase();
  if (['sublicuentas_magdiel', 'magdiel_sublicuentas', 'admin_auditor'].includes(d)) return ['sublicuentas', 'magdiel'];
  if (['sublicuentas_relojes', 'relojes_sublicuentas', 'admin_relojes'].includes(d)) return ['sublicuentas', 'relojes'];
  if (d === 'todos' || d === 'all') return ['sublicuentas', 'relojes', 'magdiel'];
  if (d === 'both' || d === 'ambos') {
    if (fr === 'relojes') return ['sublicuentas', 'magdiel'];
    if (fr === 'magdiel') return ['sublicuentas', 'relojes'];
    return ['relojes', 'magdiel'];
  }
  if (d === 'sublicuentas' || d === 'naara' || d === 'admin') return ['sublicuentas'];
  if (d === 'relojes' || d === 'libni' || d === 'finanzas') return ['relojes'];
  if (d === 'magdiel' || d === 'auditoria') return ['magdiel'];
  return ['sublicuentas'];
}

function destinosLabel(destinos) {
  return (destinos || []).map(roleLabel).join(' + ');
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_AUDIT_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID || '';
  if (!token || !chatId) return { ok: false, skipped: true, reason: 'telegram_env_missing' };
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) return { ok: false, error: j.description || `Telegram HTTP ${r.status}` };
  return { ok: true };
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

async function createTicket(db, body) {
  const now = new Date().toISOString();
  const titulo = clean(body.titulo, 160);
  const detalle = clean(body.detalle, 3000);
  if (!titulo || !detalle) return { status: 400, json: { ok: false, error: 'Falta título o detalle del ticket.' } };
  const creadoRol = clean(body.rol || '', 40).toLowerCase();
  const destinos = normalizeDestinos(body.destino || body.destinos || 'sublicuentas', creadoRol);
  const item = {
    titulo,
    detalle,
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
  const msg = [
    '🎫 <b>Nuevo ticket de auditoría</b>',
    `<b>Para:</b> ${item.destinosLabel}`,
    `<b>Prioridad:</b> ${item.prioridad}`,
    `<b>Creado por:</b> ${item.creadoPor}`,
    `<b>Título:</b> ${item.titulo}`,
    `<b>Detalle:</b> ${item.detalle}`,
    '',
    'Entrar a Sublichat para revisar y marcar resuelto.'
  ].join('\n');
  const telegram = await sendTelegram(msg).catch(e => ({ ok: false, error: e.message }));
  await ref.set({ id: ref.id, telegramOk: !!telegram.ok, telegramInfo: telegram }, { merge: true });
  return { ok: true, id: ref.id, telegramOk: !!telegram.ok, telegramInfo: telegram };
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
    '🔄 <b>Ticket en proceso</b>',
    `<b>Ticket:</b> ${clean(old.titulo || id, 160)}`,
    `<b>Tomado por:</b> ${update.procesoPor}`
  ].join('\n');
  const telegram = await sendTelegram(msg).catch(e => ({ ok: false, error: e.message }));
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
    '✅ <b>Ticket resuelto</b>',
    `<b>Ticket:</b> ${clean(old.titulo || id, 160)}`,
    `<b>Resuelto por:</b> ${update.resueltoPor}`,
    `<b>Acción realizada:</b> ${resolucion}`
  ].join('\n');
  const telegram = await sendTelegram(msg).catch(e => ({ ok: false, error: e.message }));
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
    '💬 <b>Nueva respuesta en ticket</b>',
    `<b>Ticket:</b> ${clean(old.titulo || id, 160)}`,
    `<b>Respondió:</b> ${entry.por}`,
    `<b>Mensaje:</b> ${respuesta}`
  ].join('\n');
  const telegram = await sendTelegram(msg).catch(e => ({ ok: false, error: e.message }));
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
      return res.status(200).json({ ok: true, msg: 'api/tickets activo', version: 'tickets-bandeja-responder-20260705' });
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
