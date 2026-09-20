// api/tickets.js · VERSION 6 · evidencia + avisos múltiples + restricciones por rol + puente Telegram por Render
// Guarda tickets internos en Firestore y envía aviso por Telegram si están configuradas las variables.
// Variables esperadas en Vercel:
// FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
// TELEGRAM_BOT_TOKEN y, opcionalmente, TELEGRAM_CHAT_ID_<PERFIL>.
// Todos los chat IDs deben configurarse como variables privadas de Vercel.

const admin = require('firebase-admin');
const crypto = require('crypto');

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
      : (['geisell_admin', 'geisell', 'geissel'].includes(role) || ['geisell', 'geissel'].includes(usuario)
        ? 'geisell'
        : (['auditor', 'auditoria', 'magdiel'].includes(role) || usuario === 'magdiel' ? 'magdiel' : role || usuario)));
  return { usuario, role: canonicalRole };
}

function clean(v, max = 1000) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function destinationKey(v) {
  const raw = clean(v, 80).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_. -]+/g, '')
    .replace(/\s+/g, ' ').trim();
  if (raw === 'geissel') return 'geisell';
  return raw;
}
function roleLabel(role) {
  const r = destinationKey(role);
  if (r === 'sublicuentas') return 'Sublicuentas';
  if (r === 'relojes') return 'Relojes';
  if (r === 'geisell') return 'Geisell';
  if (r === 'magdiel') return 'Magdiel';
  if (r === 'yami') return 'Yami';
  if (r === 'jimena') return 'Jimena';
  if (r === 'manuel') return 'Manuel';
  return clean(role || 'Usuario', 80);
}

const CORE_DESTINOS = new Set(['sublicuentas', 'relojes', 'geisell', 'magdiel']);

function normalizeDestinos(destino, fromRol = '') {
  const d = destinationKey(destino);
  const fr = destinationKey(fromRol);
  if (['sublicuentas_magdiel', 'magdiel_sublicuentas', 'admin_auditor'].includes(d)) return ['sublicuentas', 'magdiel'];
  if (['sublicuentas_relojes', 'relojes_sublicuentas', 'admin_relojes'].includes(d)) return ['sublicuentas', 'relojes'];
  if (['sublicuentas_geisell', 'geisell_sublicuentas', 'admin_geisell'].includes(d)) return ['sublicuentas', 'geisell'];
  if (d === 'both' || d === 'ambos') {
    if (fr === 'relojes') return ['sublicuentas', 'geisell'];
    if (fr === 'geisell') return ['sublicuentas', 'relojes'];
    if (fr === 'magdiel') return ['sublicuentas', 'relojes'];
    return ['relojes', 'geisell'];
  }
  if (d === 'sublicuentas' || d === 'naara' || d === 'admin') return ['sublicuentas'];
  if (d === 'relojes' || d === 'libni' || d === 'finanzas') return ['relojes'];
  if (d === 'geisell' || d === 'geissel') return ['geisell'];
  if (d === 'magdiel' || d === 'auditoria') return ['magdiel'];
  return d ? [d] : ['sublicuentas'];
}

function normalizeDestinosBody(body, fromRol = '') {
  const explicit = Array.isArray(body && body.destinos)
    ? body.destinos.map(destinationKey).filter(Boolean).slice(0, 100)
    : [];
  if (explicit.length) return [...new Set(explicit)];
  return normalizeDestinos(body && body.destino, fromRol);
}

function destinosLabel(destinos, labels = {}) {
  return (destinos || []).map(k => labels[destinationKey(k)] || roleLabel(k)).join(' + ');
}

async function availableRecipients(db) {
  const map = new Map([
    ['relojes', { key: 'relojes', label: 'Relojes', kind: 'equipo' }],
    ['geisell', { key: 'geisell', label: 'Geisell', kind: 'equipo' }],
  ]);
  try {
    const snap = await db.collection('revendedores').get();
    snap.forEach(doc => {
      const d = doc.data() || {};
      if (d.activo === false) return;
      const key = destinationKey(d.nombre_norm || doc.id || d.nombre);
      if (!key || key === 'sublicuentas') return;
      const label = clean(d.nombre || d.nombre_norm || doc.id, 100);
      if (!map.has(key)) map.set(key, { key, label, kind: 'socio' });
      else if (map.get(key).kind !== 'equipo' && label) map.set(key, { key, label, kind: 'socio' });
    });
  } catch (e) {
    console.error('TICKET_RECIPIENTS_LIST_ERROR', e && e.message || e);
  }
  return [...map.values()].sort((a,b) => (a.kind === b.kind ? a.label.localeCompare(b.label,'es') : (a.kind === 'equipo' ? -1 : 1)));
}

// Chat IDs de Telegram por perfil. Nunca se incluyen identificadores reales en GitHub.
const CHAT_IDS = {
  magdiel: process.env.TELEGRAM_CHAT_ID_MAGDIEL || '',
  relojes: process.env.TELEGRAM_CHAT_ID_RELOJES || '',
  sublicuentas: process.env.TELEGRAM_CHAT_ID_SUBLICUENTAS || '',
  geisell: process.env.TELEGRAM_CHAT_ID_GEISELL || process.env.TELEGRAM_CHAT_ID_GEISSEL || '',
  yami: process.env.TELEGRAM_CHAT_ID_YAMI || '',
  jimena: process.env.TELEGRAM_CHAT_ID_JIMENA || '',
  manuel: process.env.TELEGRAM_CHAT_ID_MANUEL || ''
};

// Los vendedores ya tienen su Telegram ID guardado en la colección `revendedores`.
// Antes, Tickets y Avisos ignoraba ese valor y dependía únicamente de variables
// TELEGRAM_CHAT_ID_<NOMBRE> de Vercel. Por eso Jimena podía mostrar su TG correcto
// en Catálogo Socios y aun así los avisos fallaban. Las variables de entorno siguen
// teniendo prioridad, pero para vendedores hacemos fallback automático a Firestore.
function telegramRoleKey(v) {
  return String(v == null ? '' : v)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '')
    .trim();
}

async function resolveTelegramChatId(db, role) {
  const r = destinationKey(role);
  const envId = clean(CHAT_IDS[r] || '', 80);
  if (envId) return { chatId: envId, source: 'env' };
  if (!db) return { chatId: '', source: 'missing' };

  try {
    const wanted = telegramRoleKey(r);
    const snap = await db.collection('revendedores').get();
    let found = null;
    snap.forEach((doc) => {
      if (found) return;
      const data = doc.data() || {};
      if (data.activo === false) return;
      const aliases = [doc.id, data.nombre_norm, data.nombre, data.usuario, data.username]
        .flatMap(value => { const full=telegramRoleKey(value); if(!full)return []; const first=full.split(/\s+/)[0]; return first&&first!==full?[full,first]:[full]; })
        .filter(Boolean);
      if (!aliases.includes(wanted)) return;
      const tg = clean(data.telegramId || data.telegramID || data.userId || '', 80);
      if (tg) found = tg;
    });
    return found ? { chatId: found, source: 'revendedores' } : { chatId: '', source: 'missing' };
  } catch (e) {
    console.error('TELEGRAM_CHAT_RESOLVE_ERROR', r, e && e.message || e);
    return { chatId: '', source: 'error' };
  }
}


// El bot real vive en Render. Sublichat ya usa REV_API_BASE + credenciales de
// administrador para Catálogo Socios, así que Tickets reutiliza ese puente en
// vez de exigir otro TELEGRAM_BOT_TOKEN dentro de Vercel.
const REV_API_BASE_TICKETS = String(process.env.REV_API_BASE || 'https://sublicuentas-panel-api.onrender.com').replace(/\/$/, '');
let revTicketAdminToken = '';
let revTicketAdminTokenAt = 0;
const REV_TICKET_TOKEN_TTL = 5 * 60 * 60 * 1000;
async function getRevTicketAdminToken(force = false) {
  if (!force && revTicketAdminToken && Date.now() - revTicketAdminTokenAt < REV_TICKET_TOKEN_TTL) return revTicketAdminToken;
  const usuario = String(process.env.REV_ADMIN_USER || '').trim();
  const password = String(process.env.REV_ADMIN_PASSWORD || '').trim();
  if (!usuario || !password) throw Object.assign(new Error('Faltan REV_ADMIN_USER / REV_ADMIN_PASSWORD en Vercel.'), { code:'rev_admin_env_missing' });
  const r = await fetch(`${REV_API_BASE_TICKETS}/rev/login`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({usuario,password})
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.token) throw Object.assign(new Error(j.error || `Login Render HTTP ${r.status}`), { code:'rev_admin_login' });
  revTicketAdminToken = j.token;
  revTicketAdminTokenAt = Date.now();
  return revTicketAdminToken;
}
async function sendTelegramViaRender(text, destinos, options = {}, forceLogin = false) {
  const token = await getRevTicketAdminToken(forceLogin);
  const r = await fetch(`${REV_API_BASE_TICKETS}/rev/admin/tickets-telegram`, {
    method:'POST',
    headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
    body:JSON.stringify({ text, destinos, imageUrl:options.imageUrl || '', replyMarkup:options.replyMarkup || undefined })
  });
  if (r.status === 401 && !forceLogin) {
    revTicketAdminToken = '';
    return sendTelegramViaRender(text, destinos, options, true);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.detail || j.error || `Puente Telegram HTTP ${r.status}`), { code:'telegram_bridge_http' });
  return j;
}

function telegramHTML(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendTelegramTo(chatId, text, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
  if (!token || !chatId) return { ok: false, skipped: true, reason: 'telegram_env_missing' };
  const imageUrl = clean(options.imageUrl || '', 1800);
  const replyMarkup = options.replyMarkup && typeof options.replyMarkup === 'object' ? options.replyMarkup : undefined;
  const method = imageUrl ? 'sendPhoto' : 'sendMessage';
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const body = imageUrl
    ? { chat_id: chatId, photo: imageUrl, caption: String(text || '').slice(0, 1000), parse_mode: 'HTML', ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }
    : { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) };
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) return { ok: false, error: j.description || `Telegram HTTP ${r.status}` };
  return { ok: true, messageId: Number(j.result && j.result.message_id) || 0 };
}

// Envía el mensaje a cada destinatario. Para vendedores/revendedores busca el
// telegramId directamente en Firestore; así no hace falta crear una variable
// de Vercel por cada socio nuevo.
async function sendTelegram(db, text, destinos, options = {}) {
  const requested = [...new Set((Array.isArray(destinos) ? destinos : []).map(destinationKey).filter(Boolean))];
  if (!requested.length) return { ok:false, skipped:true, reason:'sin_destinos', deliveredRoles:[], failedRoles:[] };

  try {
  // Camino principal: el bot de Render. Ahí ya existe BOT_TOKEN y el mismo
  // directorio de revendedores; además devuelve el motivo real si Telegram
  // rechaza a una persona. Si el puente todavía no está desplegado, conservamos
  // el envío directo de Vercel como compatibilidad temporal.
  try {
    if (process.env.REV_ADMIN_USER && process.env.REV_ADMIN_PASSWORD) {
      const viaRender = await sendTelegramViaRender(text, requested, options);
      if (viaRender && Array.isArray(viaRender.results)) return viaRender;
    }
  } catch (e) {
    console.error('TICKET_TELEGRAM_RENDER_BRIDGE', e && e.message || e);
  }

  const targets = new Map();
  const results = [];

  for (const role of requested) {
    const resolved = await resolveTelegramChatId(db, role);
    const chatId = resolved.chatId;
    if (!chatId) {
      results.push({ ok: false, skipped: true, reason: 'chat_id_missing', roles: [role] });
      continue;
    }
    const old = targets.get(chatId) || { roles: [] };
    old.roles.push(role);
    targets.set(chatId, old);
  }

  const fallback = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_AUDIT_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID || '';
  if (!targets.size && fallback) targets.set(fallback, { roles: requested.slice(), fallback: true });

  const configuredResults = await Promise.all([...targets.entries()].map(async ([chatId, meta]) => {
    try {
      return { ...(await sendTelegramTo(chatId, text, options)), chatId: String(chatId), roles: meta.roles, fallback: meta.fallback === true };
    } catch (e) {
      return { ok: false, error: clean(e && e.message || 'Error de conexión con Telegram', 240), chatId: String(chatId), roles: meta.roles, fallback: meta.fallback === true };
    }
  }));
  results.push(...configuredResults);

  const delivered = new Set();
  results.filter(r => r.ok).forEach(r => (r.roles || []).forEach(role => delivered.add(role)));
  const deliveredRoles = requested.filter(role => delivered.has(role));
  const failedRoles = requested.filter(role => !delivered.has(role));
  const ok = requested.length ? failedRoles.length === 0 : results.some(r => r.ok);
  const partial = deliveredRoles.length > 0 && failedRoles.length > 0;
  if (!results.length) return { ok: false, skipped: true, reason: 'sin_destinos', deliveredRoles, failedRoles };
  return { ok, partial, results, deliveredRoles, failedRoles };
  } catch (e) {
    // Red de seguridad: así el llamador siempre recibe una forma reconocible
    // (con results/deliveredRoles/failedRoles) y el motivo real queda tanto en
    // los logs de Vercel como en el campo "error" que ve el usuario, en vez de
    // perderse en un "falló para X" sin ningún detalle.
    console.error('TICKET_TELEGRAM_SEND_UNCAUGHT', e && e.message || e);
    return { ok:false, error: clean((e && e.message) || 'Error inesperado al enviar por Telegram.', 240), results:[], deliveredRoles:[], failedRoles:requested };
  }
}

async function saveTelegramMessageLinks(db, ticketId, telegram) {
  const rows = Array.isArray(telegram && telegram.results) ? telegram.results.filter(r => r && r.ok && r.chatId && r.messageId) : [];
  if (!rows.length) return;
  const batch = db.batch();
  rows.forEach(row => {
    const safeChat = String(row.chatId).replace(/[^0-9-]/g, '').slice(0, 40);
    const key = `${safeChat}_${Number(row.messageId)}`;
    batch.set(db.collection('ticket_telegram_messages').doc(key), {
      ticketId,
      chatId: safeChat,
      messageId: Number(row.messageId),
      roles: Array.isArray(row.roles) ? row.roles.map(destinationKey).filter(Boolean) : [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  await batch.commit().catch(e => console.error('TICKET_TG_LINK_SAVE', e && e.message || e));
}

function ticketReplyMarkup(id, numero, tipo = 'ticket') {
  return { inline_keyboard: [[{ text: tipo === 'aviso' ? '💬 Responder / consultar' : `💬 Responder ticket #${numero || ''}`.trim(), callback_data: `tk:reply:${id}` }]] };
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
      .map(destinationKey).filter(Boolean).slice(0, 100);
    return out;
  };
  const out = safeResult(info);
  if (info.partial === true) out.partial = true;
  if (Array.isArray(info.deliveredRoles)) out.deliveredRoles = info.deliveredRoles
    .map(destinationKey).filter(Boolean).slice(0, 100);
  if (Array.isArray(info.failedRoles)) out.failedRoles = info.failedRoles
    .map(destinationKey).filter(Boolean).slice(0, 100);
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
  const actor = destinationKey(role);
  if (actor === 'sublicuentas') return true;
  const destinos = Array.isArray(ticket && ticket.destinos) ? ticket.destinos.map(destinationKey).filter(Boolean) : [];
  return destinos.includes(actor) || destinationKey(ticket && ticket.creadoPorRol) === actor;
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
      const destinos = Array.isArray(t.destinos) ? t.destinos.map(destinationKey) : [];
      return destinos.includes(destinationKey(rol)) || destinationKey(t.creadoPorRol) === destinationKey(rol);
    });
  }
  const recipients = await availableRecipients(db);
  return { ok: true, items: items.map(safeTicketForClient), recipients };
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

function ticketStorageCandidates() {
  const projectId = process.env.FIREBASE_PROJECT_ID || '';
  return [...new Set([
    process.env.TICKETS_FIREBASE_STORAGE_BUCKET,
    process.env.FIREBASE_STORAGE_BUCKET,
    process.env.CATALOGO_FIREBASE_STORAGE_BUCKET,
    projectId ? `${projectId}.firebasestorage.app` : '',
    projectId ? `${projectId}.appspot.com` : '',
  ].map(v => String(v || '').trim()).filter(Boolean))];
}
async function uploadTicketImage(dataUri, folder = 'tickets') {
  const rawInput = String(dataUri || '').trim();
  if (!rawInput) return { imageUrl: '' };
  const m = rawInput.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);
  if (!m) throw Object.assign(new Error('Formato de imagen no permitido.'), { publicError: 'imagen_invalida' });
  const mime = m[1].toLowerCase();
  const buffer = Buffer.from(m[2].replace(/\s+/g,''), 'base64');
  if (!buffer.length || buffer.length > 4 * 1024 * 1024) throw Object.assign(new Error('La imagen supera 4 MB.'), { publicError: 'imagen_muy_grande' });
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const token = crypto.randomBytes(18).toString('hex');
  const path = `tickets/${clean(folder,40)}/${Date.now()}-${token.slice(0,12)}.${ext}`;
  getApp();
  let lastError = null;
  for (const bucketName of ticketStorageCandidates()) {
    try {
      const bucket = admin.storage().bucket(bucketName);
      const file = bucket.file(path);
      await file.save(buffer, { resumable:false, validation:false, metadata:{ contentType:mime, cacheControl:'public,max-age=31536000,immutable', metadata:{ firebaseStorageDownloadTokens:token } } });
      const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(path)}?alt=media&token=${encodeURIComponent(token)}`;
      return { imageUrl, bucket:bucket.name, path };
    } catch (e) { lastError = e; }
  }
  throw Object.assign(new Error(`No se pudo subir la evidencia. ${String(lastError && lastError.message || 'Storage no configurado.')}`), { publicError:'imagen_storage' });
}
function ticketConversationTargets(ticket, actorRole) {
  const actor = destinationKey(actorRole);
  const all = new Set((Array.isArray(ticket && ticket.destinos) ? ticket.destinos : []).map(destinationKey).filter(Boolean));
  const creator = destinationKey(ticket && ticket.creadoPorRol);
  if (creator) all.add(creator);
  if (actor) all.delete(actor);
  return [...all];
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

  const creadoRol = destinationKey(body.rol || '');
  let destinos = normalizeDestinosBody(body, creadoRol);
  const recipients = await availableRecipients(db);
  const recipientLabels = Object.fromEntries(recipients.map(r => [destinationKey(r.key), r.label]));
  if (String(body.destino || '').toLowerCase() === 'todos' && !(Array.isArray(body.destinos) && body.destinos.length)) {
    destinos = recipients.map(r => destinationKey(r.key)).filter(Boolean);
  }
  destinos = [...new Set(destinos.map(destinationKey).filter(Boolean))];
  if (!destinos.length) return { status: 400, json: { ok:false, error:'Seleccione al menos un destinatario.' } };

  const tipo = clean(body.tipo || 'ticket', 30).toLowerCase();

  // Reglas de operación: los avisos masivos son exclusivos de Sublicuentas.
  // Geisell participa en Tickets y Avisos, pero al CREAR tickets solo puede
  // comunicarse con Sublicuentas o Relojes. Se valida en servidor para que
  // la restricción no dependa únicamente de la interfaz.
  if (tipo === 'aviso' && creadoRol !== 'sublicuentas') {
    return { status: 403, json: { ok:false, error:'Solo Sublicuentas puede publicar avisos.' } };
  }
  if (creadoRol === 'geisell') {
    const permitidos = new Set(['sublicuentas', 'relojes']);
    const invalidos = destinos.filter(d => !permitidos.has(destinationKey(d)));
    if (invalidos.length) {
      return { status: 403, json: { ok:false, error:'Geisell solo puede enviar tickets a Sublicuentas o Relojes.' } };
    }
  }

  let numero = 0;
  try {
    numero = await nextTicketNumero(db);
  } catch (e) {
    // El contador nunca debe impedir que se cree el ticket.
    console.error('TICKET_COUNTER_ERROR', e && e.message || e);
    numero = Number(String(Date.now()).slice(-7));
  }

  let imagenUrl = '';
  if (body.imagen) {
    try {
      imagenUrl = (await uploadTicketImage(body.imagen, tipo === 'aviso' ? 'avisos' : 'tickets')).imageUrl;
    } catch (e) {
      console.error('TICKET_IMAGE_ERROR', e && e.message || e);
      return { status: 400, json: { ok:false, error: e.publicError === 'imagen_muy_grande' ? 'La foto supera el tamaño permitido.' : (e.publicError === 'imagen_invalida' ? 'La foto no tiene un formato válido.' : 'No se pudo subir la evidencia. Intente otra foto.') } };
    }
  }

  const item = {
    numero, titulo, detalle, tipo, destinos,
    destinosLabel: destinosLabel(destinos, recipientLabels),
    prioridad: clean(body.prioridad || 'normal', 30),
    seccion: clean(body.seccion || 'auditoria', 60),
    estado: 'abierto',
    creadoPor: clean(body.usuario || 'Sublichat', 80),
    creadoPorRol: creadoRol,
    imagenUrl,
    createdAt: now, updatedAt: now,
    resolucion: '', resueltoPor: '', resueltoAt: ''
  };

  // La única parte que debe impedir la operación es no poder guardar el ticket.
  let ref;
  try {
    ref = await db.collection('tickets_auditoria').add(item);
  } catch (e) {
    console.error('TICKET_CREATE_FIRESTORE_ERROR', e && e.message || e);
    return { status: 500, json: { ok:false, error:'No se pudo guardar el ticket en la bandeja. Intente nuevamente.' } };
  }

  // Telegram es un canal adicional. Si Telegram, el vínculo de respuesta o el
  // registro auxiliar falla, el ticket YA guardado sigue siendo válido.
  let telegram = { ok:false, skipped:true, reason:'telegram_no_intentado', deliveredRoles:[], failedRoles:destinos.slice() };
  try {
    const msg = creationTelegramMessage(item);
    telegram = await sendTelegram(db, msg, item.destinos, { imageUrl, replyMarkup: ticketReplyMarkup(ref.id, numero, tipo) });
  } catch (e) {
    console.error('TICKET_TELEGRAM_CREATE_ERROR', e && e.message || e);
    telegram = { ok:false, error:clean(e && e.message || 'Error de Telegram', 240), deliveredRoles:[], failedRoles:destinos.slice() };
  }

  try { await saveTelegramMessageLinks(db, ref.id, telegram); }
  catch (e) { console.error('TICKET_LINK_SAVE_ERROR', e && e.message || e); }

  const telegramInfo = safeTelegramInfo(telegram);
  try {
    await ref.set({ id: ref.id, telegramOk: !!telegram.ok, telegramInfo, updatedAt: now }, { merge: true });
  } catch (e) {
    console.error('TICKET_META_SAVE_ERROR', e && e.message || e);
  }

  return {
    ok: true, id: ref.id, numero, imageUrl: imagenUrl,
    telegramOk: !!telegram.ok, telegramInfo,
    destinos, destinosLabel: item.destinosLabel,
    creadoPor: item.creadoPor, creadoPorRol: item.creadoPorRol
  };
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
  const telegram = await sendTelegram(db, creationTelegramMessage(old), old.destinos, { imageUrl:old.imagenUrl||'', replyMarkup:ticketReplyMarkup(id, old.numero, old.tipo) }).catch(e => ({ ok: false, error: e.message }));
  await saveTelegramMessageLinks(db, id, telegram);
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
  const telegram = await sendTelegram(db, msg, ticketConversationTargets(old, body.rol), { replyMarkup:ticketReplyMarkup(id, old.numero, old.tipo) }).catch(e => ({ ok: false, error: e.message }));
  await saveTelegramMessageLinks(db, id, telegram);
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
  const telegram = await sendTelegram(db, msg, ticketConversationTargets(old, body.rol), { replyMarkup:ticketReplyMarkup(id, old.numero, old.tipo) }).catch(e => ({ ok: false, error: e.message }));
  await saveTelegramMessageLinks(db, id, telegram);
  const telegramInfo = safeTelegramInfo(telegram);
  await ref.set({ telegramResolvedOk: !!telegram.ok, telegramResolvedInfo: telegramInfo }, { merge: true });
  return { ok: true, id, telegramOk: !!telegram.ok, telegramInfo };
}

async function responderTicket(db, body) {
  const id = clean(body.id, 120);
  const respuesta = clean(body.respuesta, 3000);
  if (!id || (!respuesta && !body.imagen)) return { status: 400, json: { ok: false, error: 'Falta id o respuesta.' } };
  const ref = db.collection('tickets_auditoria').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { status: 404, json: { ok: false, error: 'No encontré ese ticket.' } };
  const old = snap.data() || {};
  if (!canAccessTicket(old, body.rol)) return { status: 403, json: { ok: false, error: 'No tiene permiso para modificar ese ticket.' } };
  const now = new Date().toISOString();
  let imagenUrl = '';
  if (body.imagen) imagenUrl = (await uploadTicketImage(body.imagen, 'respuestas')).imageUrl;
  const entry = {
    texto: respuesta || (imagenUrl ? 'Evidencia adjunta' : ''),
    por: clean(body.usuario || 'Sublichat', 80),
    porRol: destinationKey(body.rol || ''),
    imagenUrl,
    origen: 'sublichat',
    at: now
  };
  const respuestas = Array.isArray(old.respuestas) ? old.respuestas.slice() : [];
  respuestas.push(entry);
  const update = {
    respuestas,
    ultimaRespuesta: entry.texto,
    ultimaRespuestaPor: entry.por,
    estado: String(old.estado || 'abierto') === 'resuelto' ? 'resuelto' : 'respondido',
    updatedAt: now
  };
  await ref.set(update, { merge: true });
  const msg = [
    `💬 <b>${String(old.tipo||'').toLowerCase()==='aviso'?'Respuesta al aviso':`Ticket #${old.numero || id.slice(-4)}`} · ${telegramHTML(estadoLabel(update.estado))}</b>`,
    `<b>${telegramHTML(old.titulo || 'Sin título')}</b>`,
    `Respondió: ${telegramHTML(entry.por)}`,
    respuesta ? telegramHTML(respuesta) : '📎 Evidencia adjunta'
  ].join('\n');
  const telegram = await sendTelegram(db, msg, ticketConversationTargets(old, body.rol), { imageUrl, replyMarkup:ticketReplyMarkup(id, old.numero, old.tipo) }).catch(e => ({ ok: false, error: e.message }));
  await saveTelegramMessageLinks(db, id, telegram);
  const telegramInfo = safeTelegramInfo(telegram);
  await ref.set({ telegramReplyOk: !!telegram.ok, telegramReplyInfo: telegramInfo }, { merge: true });
  return { ok: true, id, imageUrl, telegramOk: !!telegram.ok, telegramInfo };
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
    const publicError = clean(e && e.publicError || '', 120);
    return res.status(500).json({ ok: false, error: publicError || 'No se pudo completar la operación de tickets. Revise la conexión e intente otra vez.' });
  }
};
