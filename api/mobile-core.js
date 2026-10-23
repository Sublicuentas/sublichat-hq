// api/mobile-core.js
// Core mínimo para la APK Sublicuentas: login CORS + lecturas operativas autenticadas.
const admin = require('firebase-admin');
const loginHandler = require('./login');
const tvDigital = require('./_tv-digital.js');

const ALLOWED_ORIGINS = new Set([
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
]);

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('AUTH_CONFIG');
  return admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

async function requireFirebaseUser(req, res) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ ok:false, error:'Sesión requerida.' });
    return null;
  }
  try {
    getApp();
    return await admin.auth().verifyIdToken(token, true);
  } catch (_) {
    res.status(401).json({ ok:false, error:'Sesión inválida o vencida.' });
    return null;
  }
}

function norm(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function accessFor(user) {
  const usuario = norm(user?.usuario || String(user?.uid || '').replace(/^asesor-/, ''));
  const role = norm(user?.role).replace(/\s+/g, '_');
  const sublicuentas = ['sublicuentas','naara'].includes(usuario) || ['admin','administrador','sublicuentas','owner'].includes(role);
  const relojes = ['relojes','libni','daniela','finanzas'].includes(usuario) || ['relojes','finanzas'].includes(role);
  const geisell = ['geisell','geissel'].includes(usuario) || ['geisell_admin','control_admin'].includes(role);
  return { usuario, role, sublicuentas, relojes, geisell };
}

function canRead(resource, user) {
  const a = accessFor(user);
  if (resource === 'clientes') return a.sublicuentas || a.relojes || a.geisell;
  if (resource === 'inventario') return a.sublicuentas || a.geisell || a.relojes; // Relojes y Geisell ven Inventario en la app (pedido del dueño)
  // `finanzas` = histórico; `finanzas_movimientos` = movimientos actuales. Control financiero (web y app) une las dos.
  if (resource === 'finanzas_movimientos' || resource === 'finanzas') return a.sublicuentas || a.relojes;
  return false;
}

function applyCors(req, res) {
  const origin = String(req.headers?.origin || '');
  const allowed = ALLOWED_ORIGINS.has(origin);
  if (origin) {
    res.setHeader('Vary', 'Origin');
    if (allowed) res.setHeader('Access-Control-Allow-Origin', origin);
  }
  return { origin, allowed };
}

// Compatibilidad con APK ya instalada: la web reconstruye el pie de la ficha
// (teléfono del CLIENTE + vendedor) al abrir una cuenta, pero versiones actuales
// de la APK muestran fichaTexto tal como llega de Firestore. Si una ficha antigua
// quedó guardada sin ese pie, el número desaparece solo en la APK.
//
// Este hotfix NO modifica Firestore ni requiere actualizar la APK: únicamente
// completa fichaTexto en la respuesta /api/mobile-core para el recurso clientes.
function sellerIconForFicha(seller = '') {
  const n = norm(seller).replace(/\s+/g, ' ');
  if (n === 'relojes') return '⌚';
  if (n === 'sublicuentas') return '💻';
  return '🌟';
}

function phoneDigits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function ensureMobileFichaFooter(text = '', telefono = '', vendedor = '') {
  const raw = String(text || '').replace(/\r\n/g, '\n').trimEnd();
  if (!raw.trim()) return raw;

  const lines = raw.split('\n');
  const trimBlanks = () => { while (lines.length && !String(lines[lines.length - 1] || '').trim()) lines.pop(); };
  const isSellerLine = line => /^(?:⌚|💻|🌟)?\s*Vendedor\b/i.test(String(line || '').trim());
  const isPhoneLine = line => /^\+?\d[\d\s().-]{5,}$/.test(String(line || '').trim());

  trimBlanks();

  // Quite únicamente el pie estructurado anterior; no toque el cuerpo de la ficha.
  if (lines.length && isSellerLine(lines[lines.length - 1])) {
    lines.pop();
    trimBlanks();
    if (lines.length && isPhoneLine(lines[lines.length - 1])) {
      lines.pop();
      trimBlanks();
    }
  } else {
    // Si una versión antigua dejó solo el teléfono al final, reemplácelo únicamente
    // cuando coincide exactamente con el teléfono actual del cliente.
    const wanted = phoneDigits(telefono);
    const last = lines.length ? phoneDigits(lines[lines.length - 1]) : '';
    if (wanted && last === wanted && isPhoneLine(lines[lines.length - 1])) {
      lines.pop();
      trimBlanks();
    }
  }

  const base = lines.join('\n').trimEnd();
  const footer = [];
  const phone = String(telefono || '').trim();
  const seller = String(vendedor || '').trim();
  if (phone) footer.push(phone);
  if (seller) footer.push(`${sellerIconForFicha(seller)} Vendedor ${seller}`);
  if (!footer.length) return base;
  return `${base}\n\n${footer.join('\n')}`.trim();
}

// La APK muestra fichaTexto tal como está guardada. Ese texto es una FOTO del
// momento en que se creó la ficha: al renovar (web, bot o APK) o al cambiar
// correo/clave/PIN desde el bot, la fecha y los datos del servicio sí cambian,
// pero el texto viejo seguía mostrando lo anterior ("no me actualiza la ficha").
// Aquí se refrescan SOLO las líneas estructuradas de la plantilla, con los datos
// actuales del servicio. No modifica Firestore. Si una etiqueta aparece más de
// una vez (fichas multiperfil) no se toca, para no mezclar perfiles.
function perfilPrincipalMovil(service = {}) {
  const perfiles = Array.isArray(service.perfiles) ? service.perfiles.filter(p => p && typeof p === 'object') : [];
  return perfiles[0] || {};
}
function reemplazarValorEtiqueta(lines, regex, valor) {
  const v = String(valor ?? '').trim();
  if (!v) return;
  const idx = [];
  lines.forEach((line, i) => { if (regex.test(line)) idx.push(i); });
  if (idx.length !== 1) return;
  const i = idx[0];
  lines[i] = lines[i].replace(/(:\s*)(.*?)(\*?\s*)$/, (_m, sep, _old, tail) => `${sep}${v}${tail}`);
}
function refrescarFichaTextoMovil(texto = '', service = {}, urlTv = '') {
  const raw = String(texto || '');
  if (!raw.trim()) return raw;
  const principal = perfilPrincipalMovil(service);
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const fecha = String(service.fechaRenovacion || '').trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fecha)) {
    reemplazarValorEtiqueta(lines, /📅\s*Renovaci[oó]n\s*:/i, fecha);
    reemplazarValorEtiqueta(lines, /(📅|⏳)\s*Pr[oó]ximo pago\s*:/i, fecha);
  }
  reemplazarValorEtiqueta(lines, /(📧|📩|📨|✉️?)\s*Correo\s*:/i, principal.correo || service.correo);
  // R143: Netflix VIP y otras plantillas dicen "🔑 Contraseña:" (antes solo se refrescaba "🔑 Clave:").
  if (service.maxPlayer !== true) reemplazarValorEtiqueta(lines, /(🔑|🔒)\s*(Clave|Contrase[ñn]a)\s*:/i, principal.clave || service.clave);
  reemplazarValorEtiqueta(lines, /📎\s*Pin\s*:/i, principal.pinPerfil || principal.pin || service.pinPerfil || service.pin);
  // Oct-2026: la URL de TV Digital es editable; la ficha muestra siempre la URL vigente.
  if (urlTv) reemplazarValorEtiqueta(lines, /🧾\s*URL\s*:/i, urlTv);
  return lines.join('\n');
}

// La APK solo entiende fechas exactas DD/MM/AAAA. La web también acepta
// AAAA-MM-DD, Timestamp de Firebase o "DD/MM/AAAA hora". Un servicio con otro
// formato contaba en la web pero en la APK quedaba "sin fecha" (fuera de
// Vigentes). Se entrega normalizado a la APK sin tocar Firestore.
function fechaDMYMovil(v) {
  if (v == null || v === '') return '';
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => (d instanceof Date && !isNaN(d)) ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '';
  if (typeof v === 'object') {
    const sec = v.seconds ?? v._seconds;
    if (sec != null) {
      const d = new Date(Number(sec) * 1000);
      const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Tegucigalpa', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
      const g = t => p.find(x => x.type === t)?.value || '';
      return `${g('day')}/${g('month')}/${g('year')}`;
    }
    if (typeof v.toDate === 'function') return fmt(v.toDate());
    return '';
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${pad(m[1])}/${pad(m[2])}/${m[3]}`;
  return s;
}

function prepareClientForMobile(client = {}, tv = null) {
  const out = { ...(client || {}) };
  const telefono = String(out.telefono || '').trim();
  const clientSeller = String(out.vendedor || '').trim();
  if (!Array.isArray(out.servicios)) return out;

  out.servicios = out.servicios.map(service => {
    if (!service || typeof service !== 'object') return service;
    const copy = { ...service };
    if (copy.fechaRenovacion != null && copy.fechaRenovacion !== '') copy.fechaRenovacion = fechaDMYMovil(copy.fechaRenovacion);
    const urlTv = tv ? tvDigital.urlTvServicio(copy, tv.urls, tv.cuentas) : '';
    if (urlTv) copy.urlServidorTv = urlTv;
    const fichaTexto = refrescarFichaTextoMovil(String(copy.fichaTexto || ''), copy, urlTv);
    if (!fichaTexto.trim()) return copy;
    const vendedor = String(copy.vendedor || clientSeller || '').trim();
    copy.fichaTexto = ensureMobileFichaFooter(fichaTexto, telefono, vendedor);
    return copy;
  });
  return out;
}

async function listResource(req, res) {
  const user = await requireFirebaseUser(req, res);
  if (!user) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const resource = String(body.resource || '').trim();
  if (!['clientes','inventario','finanzas_movimientos','finanzas'].includes(resource)) {
    return res.status(400).json({ ok:false, error:'Recurso no válido.' });
  }
  if (!canRead(resource, user)) {
    return res.status(403).json({ ok:false, error:'No tiene permiso para consultar este recurso.' });
  }

  const limit = Math.max(25, Math.min(300, Number(body.limit) || 250));
  const cursor = String(body.cursor || '').trim();
  const db = getApp().firestore();
  const ref = db.collection(resource);
  let query = ref.orderBy(admin.firestore.FieldPath.documentId()).limit(limit);
  if (cursor) {
    const cursorSnap = await ref.doc(cursor).get();
    if (cursorSnap.exists) query = query.startAfter(cursorSnap);
  }
  const snap = await query.get();
  const tv = resource === 'clientes' ? { urls: await tvDigital.leerUrlsTv(db), cuentas: await tvDigital.leerUrlsCuentas(db) } : null;
  // Las fichas unidas por la consolidación quedan como alias (consolidadoEn)
  // y la web no las muestra; la APK tampoco debe contarlas. El cursor sigue
  // usando el último documento leído, así la paginación no se altera.
  let items = snap.docs
    .filter(doc => resource !== 'clientes' || !String(doc.get('consolidadoEn') || '').trim())
    .map(doc => {
      const item = { ...(doc.data() || {}), id:doc.id };
      return resource === 'clientes' ? prepareClientForMobile(item, tv) : item;
    });
  if (resource === 'inventario' && items.length) {
    // La APK instalada ya usa esta lectura al sincronizar. Se conserva el
    // formato y cursor; solo se reparan cupos faltantes y sus contadores.
    const { reconciliarInventario } = await import('./inventario.js');
    items = await reconciliarInventario(db, items);
  }
  const nextCursor = snap.docs.length === limit ? snap.docs[snap.docs.length - 1].id : '';
  // Monitoreo de lecturas (Vercel → Logs, buscar "fs_read"): quién descarga qué y cuántos documentos.
  console.log(JSON.stringify({ evt:'fs_read', src:'mobile-core', resource, docs:snap.size, page:cursor ? 'next' : 'first', uid:String(user.uid || '').slice(0, 8) }));
  return res.status(200).json({ ok:true, items, nextCursor });
}

// R69 · Paquete G — configuración remota NO sensible para la APK (sin secretos).
// Fuente: documento Firestore `configuracion_app/android` (editable) sobre valores por defecto; MIN_ANDROID_BUILD por entorno.
const CONFIG_DEFAULTS = Object.freeze({
  configVersion: 1, apiVersion: 2, minAppBuild: 0, syncStaleSeconds: 300, // Auditoría Firestore: antes 15 s → cada vuelta a la app releía TODO
  sellerPhones: { relojes: '32126332', sublicuentas: '89464277', 'sublicuentas 2': '89464328', yami: '96877246', jimena: '88501036', heber: '32174922', abner: '94306551', manuel: '87989267' },
  calculatorBasePrices: {}, tvDigitalRules: {}, featureFlags: {},
});
const CONFIG_ALLOWED = ['configVersion', 'apiVersion', 'minAppBuild', 'syncStaleSeconds', 'sellerPhones', 'calculatorBasePrices', 'tvDigitalRules', 'featureFlags'];
// tvDigitalUrls no es un secreto (la URL la ve el cliente final); se agrega aparte de CONFIG_ALLOWED.
const VENDEDORES_EQUIPO = Object.freeze(['Relojes','Sublicuentas','Sublicuentas 2','Geisell','Yami','Manuel','Heber','Abner','Jimena','Elizabeth','Lucy','WolfTeam']);
function vendedorClave(v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
async function vendedoresParaApp(db, basePhones) {
  const phones = { ...(basePhones && typeof basePhones === 'object' ? basePhones : {}) };
  const sellers = [...VENDEDORES_EQUIPO];
  const vistos = new Set(sellers.map(vendedorClave));
  vistos.add('geissel'); vistos.add('sublicuentas2');
  const snap = await db.collection('revendedores').get();
  const extra = [];
  snap.forEach((doc) => {
    const d = doc.data() || {};
    if (d.activo === false) return;
    const nombre = String(d.nombre || d.usuario || doc.id || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const clave = vendedorClave(nombre);
    if (!clave) return;
    let tel = String(d.telefono || d.whatsapp || '').replace(/\D/g, '').replace(/^00/, '');
    if (tel.length === 11 && tel.startsWith('504')) tel = tel.slice(3); // Honduras sin código; otros países completos
    if (tel.length < 8 || tel.length > 15) tel = '';
    if (tel && !phones[clave]) phones[clave] = tel;
    if (vistos.has(clave) || vistos.has(clave.replace(/\s+/g, ''))) return;
    vistos.add(clave);
    extra.push(nombre);
  });
  extra.sort((x, y) => x.localeCompare(y, 'es'));
  return { sellers: sellers.concat(extra), phones };
}
async function getConfig(req, res) {
  const user = await requireFirebaseUser(req, res);
  if (!user) return;
  let doc = {};
  try { const snap = await getApp().firestore().collection('configuracion_app').doc('android').get(); if (snap.exists) doc = snap.data() || {}; } catch (_) { doc = {}; }
  const config = {};
  for (const k of CONFIG_ALLOWED) config[k] = doc[k] !== undefined ? doc[k] : CONFIG_DEFAULTS[k];
  const envMin = Number(process.env.MIN_ANDROID_BUILD || 0) || 0;
  config.minAppBuild = Math.max(Number(config.minAppBuild) || 0, envMin);
  // Auditoría Firestore (oct-2026): la APK descarga clientes/inventario/finanzas COMPLETOS cada vez que vuelve
  // al frente (WhatsApp ↔ app) si el último refresco tiene más de syncStaleSeconds. Con 15 s eso eran cientos de
  // descargas completas al día por vendedor. Piso de 5 min (los cambios propios se ven al instante igual).
  config.syncStaleSeconds = Math.max(300, Number(config.syncStaleSeconds) || 300);
  try {
    const urls = await tvDigital.leerUrlsTv(getApp().firestore());
    config.tvDigitalUrls = Object.fromEntries(Object.entries(urls).map(([k, v]) => [k, v.url]));
  } catch (_) { /* la APK conserva sus URLs guardadas */ }
  // Vendedores: lista fija del equipo + revendedores activos de Firestore (los mismos que ven la web y el bot).
  // La APK los usa en el selector "Vendedor responsable"; si esto falla, se queda con su lista interna.
  try {
    const vend = await vendedoresParaApp(getApp().firestore(), config.sellerPhones);
    config.sellers = vend.sellers;
    config.sellerPhones = vend.phones;
  } catch (e) { console.error('APP_SELLERS_ERROR', e && e.message || e); }
  if (/token|secret|password|private_key/i.test(JSON.stringify(config))) return res.status(500).json({ ok: false, error: 'Configuración inválida.' });
  return res.status(200).json({ ok: true, config });
}

module.exports = async function mobileCore(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const { origin, allowed } = applyCors(req, res);

  if (req.method === 'OPTIONS') {
    if (!allowed) return res.status(403).end();
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Método no permitido.' });

  const action = String(req.query?.action || req.body?.action || '').trim().toLowerCase();
  if (action === 'login') {
    if (origin && !allowed) return res.status(403).json({ error:'Origen no autorizado' });
    return loginHandler(req, res);
  }
  if (action === 'list') return listResource(req, res);
  if (action === 'config') return getConfig(req, res);
  return res.status(400).json({ ok:false, error:'Acción no válida.' });
};
module.exports.__pruebas = { refrescarFichaTextoMovil }; // R143
