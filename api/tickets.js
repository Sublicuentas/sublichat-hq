// api/tickets.js · VERSION 3 · avisos parciales sin ocultar el fallo del destinatario
// Guarda tickets internos en Firestore y envía aviso por Telegram si están configuradas las variables.
// Variables esperadas en Vercel:
// FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
// TELEGRAM_BOT_TOKEN y, opcionalmente, TELEGRAM_CHAT_ID_<PERFIL>.
// Todos los chat IDs deben configurarse como variables privadas de Vercel.

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

async function requireFirebaseUser(req, res) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ ok: false, error: 'Sesión requerida.' });
    return null;
  }
  try {
    const user = await admin.auth().verifyIdToken(token);
    if (!String(user.usuario || '').trim() || !String(user.role || '').trim()) throw new Error('claims_missing');
    return user;
  } catch (_) {
    res.status(401).json({ ok: false, error: 'Sesión inválida o vencida.' });
    return null;
  }
}

function ticketIdentity(user) {
  const role = String(user && user.role || '').toLowerCase();
  const usuario = String(user && (user.usuario || user.uid) || 'sublichat').toLowerCase();
  const canonicalRole = ['admin', 'administrador', 'sublicuentas', 'owner'].includes(role) || ['naara', 'sublicuentas'].includes(usuario)
    ? 'sublicuentas'
    : (['finanzas', 'relojes'].includes(role) || ['libni', 'relojes'].includes(usuario)
      ? 'relojes'
      : (['auditor', 'auditoria', 'magdiel'].includes(role) || usuario === 'magdiel' ? 'magdiel' : role || usuario));
  return { usuario, role: canonicalRole };
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

// Chat IDs de Telegram por perfil. Nunca se incluyen identificadores reales en GitHub.
const CHAT_IDS = {
  magdiel: process.env.TELEGRAM_CHAT_ID_MAGDIEL || '',
  relojes: process.env.TELEGRAM_CHAT_ID_RELOJES || '',
  sublicuentas: process.env.TELEGRAM_CHAT_ID_SUBLICUENTAS || '',
  yami: process.env.TELEGRAM_CHAT_ID_YAMI || '',
  jimena: process.env.TELEGRAM_CHAT_ID_JIMENA || '',
  manuel: process.env.TELEGRAM_CHAT_ID_MANUEL || ''
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
  if (!r.ok || !j.ok) return { ok: false, error: j.description || `Telegram HTTP ${r.status}` };
  return { ok: true };
}

// Envía el mensaje a cada chat correspondiente a los roles en `destinos`.
// Si no hay destinos (o no matchea ningún perfil conocido), cae a TELEGRAM_CHAT_ID genérico si existe.
async function sendTelegram(text, destinos) {
  const requested = [...new Set((Array.isArray(destinos) ? destinos : [])
    .map(r => clean(r, 40).toLowerCase()).filter(r => DESTINOS_VALIDOS.has(r)))];
  const targets = new Map();
  const results = [];

  requested.forEach((role) => {
    const chatId = CHAT_IDS[role];
    if (!chatId) {
      results.push({ ok: false, skipped: true, reason: 'chat_id_missing', roles: [role] });
      return;
    }
    const old = targets.get(chatId) || { roles: [] };
    old.roles.push(role);
    targets.set(chatId, old);
  });

  const fallback = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_AUDIT_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID || '';
  if (!targets.size && fallback) targets.set(fallback, { roles: requested.slice(), fallback: true });

  const configuredResults = await Promise.all([...targets.entries()].map(async ([chatId, meta]) => {
    try {
      return { ...(await sendTelegramTo(chatId, text)), roles: meta.roles, fallback: meta.fallback === true };
    } catch (e) {
      return { ok: false, error: clean(e && e.message || 'Error de conexión con Telegram', 240), roles: meta.roles, fallback: meta.fallback === true };
    }
  }));
  results.push(...configuredResults);

  // Si un chat específico (por ejemplo, Jimena) devuelve error, no lo
  // sustituimos silenciosamente por el chat general: eso haría parecer que la
  // persona recibió el aviso cuando en realidad su chat sigue mal configurado.

  const delivered = new Set();
  results.filter(r => r.ok).forEach(r => (r.roles || []).forEach(role => delivered.add(role)));
  const deliveredRoles = requested.filter(role => delivered.has(role));
  const failedRoles = requested.filter(role => !delivered.has(role));
  const ok = requested.length ? failedRoles.length === 0 : results.some(r => r.ok);
  const partial = deliveredRoles.length > 0 && failedRoles.length > 0;
  if (!results.length) return { ok: false, skipped: true, reason: 'sin_destinos', deliveredRoles, failedRoles };
  return { ok, partial, results, deliveredRoles, failedRoles };
}

// Nunca devuelve ni conserva chat_id en respuestas accesibles al navegador.
// También limpia documentos históricos que todavía puedan contenerlos.
function safeTelegramInfo(info) {
  if (!info || typeof info !== 'object') return { ok: false };
  const safeResult = (raw) => {
    const value = raw && typeof raw === 'object' ? raw : {};
    const out = { ok: value.ok === true };
    if (value.skipped === true) out.skipped = true;
    if (value.reason) out.reason = clean(value.reason, 80);
    if (value.error) out.error = clean(value.error, 240);
    if (value.fallback === true) out.fallback = true;
    if (Array.isArray(value.roles)) out.roles = value.roles
      .map(r => clean(r, 40).toLowerCase()).filter(r => DESTINOS_VALIDOS.has(r)).slice(0, 20);
    return out;
  };
  const out = safeResult(info);
  if (info.partial === true) out.partial = true;
  if (Array.isArray(info.deliveredRoles)) out.deliveredRoles = info.deliveredRoles
    .map(r => clean(r, 40).toLowerCase()).filter(r => DESTINOS_VALIDOS.has(r)).slice(0, 20);
  if (Array.isArray(info.failedRoles)) out.failedRoles = info.failedRoles
    .map(r => clean(r, 40).toLowerCase()).filter(r => DESTINOS_VALIDOS.has(r)).slice(0, 20);
  if (Array.isArray(info.results)) out.results = info.results.slice(0, 20).map(safeResult);
  return out;
}

function safeTicketForClient(item) {
  const out = { ...(item || {}) };
  ['telegramInfo', 'telegramProcessInfo', 'telegramResolvedInfo', 'telegramReplyInfo'].forEach((key) => {
    if (out[key]) out[key] = safeTelegramInfo(out[key]);
  });
  return out;
}

function canAccessTicket(ticket, role) {
  const actor = clean(role, 40).toLowerCase();
  if (actor === 'sublicuentas') return true;
  const destinos = Array.isArray(ticket && ticket.destinos) ? ticket.destinos.map(v => clean(v, 40).toLowerCase()) : [];
  return destinos.includes(actor) || clean(ticket && ticket.creadoPorRol, 40).toLowerCase() === actor;
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
  return { ok: true, items: items.map(safeTicketForClient) };
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

function creationTelegramMessage(item = {}) {
  const esAviso = String(item.tipo || '').toLowerCase() === 'aviso' || item.seccion === 'avisos';
  return esAviso ? [
    `📢 <b>Nuevo aviso de ${telegramHTML(roleLabel(item.creadoPorRol))}</b>`,
    `<b>Para:</b> ${telegramHTML(item.destinosLabel || destinosLabel(item.destinos))}`,
    `<b>${telegramHTML(String(item.titulo || '').replace(/^AVISO\s*[·:-]?\s*/i, '') || 'Actualización')}</b>`,
    telegramHTML(item.detalle)
  ].join('\n') : [
    `🎫 <b>${telegramHTML(roleLabel(item.creadoPorRol))}</b> te ha enviado un ticket #${item.numero || '—'}`,
    `<b>Motivo:</b> ${telegramHTML(item.titulo)}`,
    `<b>Estado:</b> ${telegramHTML(estadoLabel(item.estado))}`
  ].join('\n');
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
  const msg = creationTelegramMessage(item);
  const telegram = await sendTelegram(msg, item.destinos).catch(e => ({ ok: false, error: e.message }));
  const telegramInfo = safeTelegramInfo(telegram);
  await ref.set({ id: ref.id, telegramOk: !!telegram.ok, telegramInfo }, { merge: true });
  return { ok: true, id: ref.id, numero, telegramOk: !!telegram.ok, telegramInfo };
}

async function retryTelegramTicket(db, body) {
  const id = clean(body.id, 120);
  if (!id) return { status: 400, json: { ok: false, error: 'Falta id del aviso.' } };
  const ref = db.collection('tickets_auditoria').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { status: 404, json: { ok: false, error: 'No encontré ese aviso.' } };
  const old = snap.data() || {};
  if (clean(body.rol, 40).toLowerCase() !== 'sublicuentas' && !canAccessTicket(old, body.rol)) {
    return { status: 403, json: { ok: false, error: 'No tiene permiso para reenviar este aviso.' } };
  }
  const telegram = await sendTelegram(creationTelegramMessage(old), old.destinos).catch(e => ({ ok: false, error: e.message }));
  const telegramInfo = safeTelegramInfo(telegram);
  await ref.set({
    telegramOk: !!telegram.ok,
    telegramInfo,
    telegramRetriedAt: new Date().toISOString(),
    telegramRetriedBy: clean(body.usuario || 'Sublichat', 80)
  }, { merge: true });
  return { ok: true, id, telegramOk: !!telegram.ok, telegramInfo };
}


async function setProcesoTicket(db, body) {
  const id = clean(body.id, 120);
  if (!id) return { status: 400, json: { ok: false, error: 'Falta id del ticket.' } };
  const ref = db.collection('tickets_auditoria').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { status: 404, json: { ok: false, error: 'No encontré ese ticket.' } };
  const old = snap.data() || {};
  if (!canAccessTicket(old, body.rol)) return { status: 403, json: { ok: false, error: 'No tiene permiso para modificar ese ticket.' } };
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
    `🔄 <b>Ticket #${old.numero || id.slice(-4)}</b> · ${estadoLabel(update.estado)}`,
    `<b>${telegramHTML(old.titulo || 'Sin título')}</b>`,
    `De: ${telegramHTML(old.creadoPor || roleLabel(old.creadoPorRol))} · Para: ${telegramHTML(old.destinosLabel || '—')}`,
    `Lo puso en proceso: ${telegramHTML(update.procesoPor || '—')}`
  ].join('\n');
  const telegram = await sendTelegram(msg, old.destinos).catch(e => ({ ok: false, error: e.message }));
  const telegramInfo = safeTelegramInfo(telegram);
  await ref.set({ telegramProcessOk: !!telegram.ok, telegramProcessInfo: telegramInfo }, { merge: true });
  return { ok: true, id, telegramOk: !!telegram.ok, telegramInfo };
}

async function resolveTicket(db, body) {
  const id = clean(body.id, 120);
  const resolucion = clean(body.resolucion, 3000);
  if (!id || !resolucion) return { status: 400, json: { ok: false, error: 'Falta id o resolución.' } };
  const ref = db.collection('tickets_auditoria').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { status: 404, json: { ok: false, error: 'No encontré ese ticket.' } };
  const old = snap.data() || {};
  if (!canAccessTicket(old, body.rol)) return { status: 403, json: { ok: false, error: 'No tiene permiso para modificar ese ticket.' } };
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
    `✅ <b>Ticket #${old.numero || id.slice(-4)}</b> · Resuelto`,
    `<b>${telegramHTML(old.titulo || 'Sin título')}</b>`,
    `De: ${telegramHTML(old.creadoPor || roleLabel(old.creadoPorRol))} · Para: ${telegramHTML(old.destinosLabel || '—')}`,
    `Resuelto por: ${telegramHTML(update.resueltoPor || '—')}`,
    `<b>Resolución:</b> ${telegramHTML(resolucion)}`
  ].join('\n');
  const telegram = await sendTelegram(msg, old.destinos).catch(e => ({ ok: false, error: e.message }));
  const telegramInfo = safeTelegramInfo(telegram);
  await ref.set({ telegramResolvedOk: !!telegram.ok, telegramResolvedInfo: telegramInfo }, { merge: true });
  return { ok: true, id, telegramOk: !!telegram.ok, telegramInfo };
}

async function responderTicket(db, body) {
  const id = clean(body.id, 120);
  const respuesta = clean(body.respuesta, 3000);
  if (!id || !respuesta) return { status: 400, json: { ok: false, error: 'Falta id o respuesta.' } };
  const ref = db.collection('tickets_auditoria').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { status: 404, json: { ok: false, error: 'No encontré ese ticket.' } };
  const old = snap.data() || {};
  if (!canAccessTicket(old, body.rol)) return { status: 403, json: { ok: false, error: 'No tiene permiso para modificar ese ticket.' } };
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
    `💬 <b>Ticket #${old.numero || id.slice(-4)}</b> · ${estadoLabel(update.estado)}`,
    `<b>${telegramHTML(old.titulo || 'Sin título')}</b>`,
    `De: ${telegramHTML(old.creadoPor || roleLabel(old.creadoPorRol))} · Para: ${telegramHTML(old.destinosLabel || '—')}`,
    `Respondió: ${telegramHTML(entry.por)}`,
    telegramHTML(respuesta)
  ].join('\n');
  const telegram = await sendTelegram(msg, old.destinos).catch(e => ({ ok: false, error: e.message }));
  const telegramInfo = safeTelegramInfo(telegram);
  await ref.set({ telegramReplyOk: !!telegram.ok, telegramReplyInfo: telegramInfo }, { merge: true });
  return { ok: true, id, telegramOk: !!telegram.ok, telegramInfo };
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    getApp();
    const db = admin.firestore();
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'Método no permitido.' });
    }
    const authUser = await requireFirebaseUser(req, res);
    if (!authUser) return;
    const identity = ticketIdentity(authUser);
    const body = req.body && typeof req.body === 'object' ? { ...req.body } : {};
    body.usuario = identity.usuario;
    body.rol = identity.role;
    const accion = clean(body.accion || 'listar', 50).toLowerCase();
    let out;
    if (accion === 'listar') out = await listTickets(db, body);
    else if (accion === 'crear') out = await createTicket(db, body);
    else if (accion === 'reenviar_telegram') out = await retryTelegramTicket(db, body);
    else if (accion === 'proceso') out = await setProcesoTicket(db, body);
    else if (accion === 'responder') out = await responderTicket(db, body);
    else if (accion === 'resolver') out = await resolveTicket(db, body);
    else out = { status: 400, json: { ok: false, error: 'Acción no soportada: ' + accion } };
    if (out && out.status) return res.status(out.status).json(out.json);
    return res.status(200).json(out);
  } catch (e) {
    console.error('TICKETS_ERROR', e);
    return res.status(500).json({ ok: false, error: 'No se pudo completar la operación de tickets.' });
  }
};
