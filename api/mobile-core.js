// api/mobile-core.js
// Core mínimo para la APK Sublicuentas: login CORS + lecturas operativas autenticadas.
const admin = require('firebase-admin');
const loginHandler = require('./login');

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
  const items = snap.docs.map(doc => ({ id:doc.id, ...(doc.data() || {}) }));
  const nextCursor = snap.docs.length === limit ? snap.docs[snap.docs.length - 1].id : '';
  return res.status(200).json({ ok:true, items, nextCursor });
}

// R69 · Paquete G — configuración remota NO sensible para la APK (sin secretos).
// Fuente: documento Firestore `configuracion_app/android` (editable) sobre valores por defecto; MIN_ANDROID_BUILD por entorno.
const CONFIG_DEFAULTS = Object.freeze({
  configVersion: 1, apiVersion: 2, minAppBuild: 0, syncStaleSeconds: 15,
  sellerPhones: { relojes: '32126332', sublicuentas: '89464277', 'sublicuentas 2': '89464328', yami: '96877246', jimena: '88501036', heber: '32174922', abner: '94306551', manuel: '87989267' },
  calculatorBasePrices: {}, tvDigitalRules: {}, featureFlags: {},
});
const CONFIG_ALLOWED = ['configVersion', 'apiVersion', 'minAppBuild', 'syncStaleSeconds', 'sellerPhones', 'calculatorBasePrices', 'tvDigitalRules', 'featureFlags'];
async function getConfig(req, res) {
  const user = await requireFirebaseUser(req, res);
  if (!user) return;
  let doc = {};
  try { const snap = await getApp().firestore().collection('configuracion_app').doc('android').get(); if (snap.exists) doc = snap.data() || {}; } catch (_) { doc = {}; }
  const config = {};
  for (const k of CONFIG_ALLOWED) config[k] = doc[k] !== undefined ? doc[k] : CONFIG_DEFAULTS[k];
  const envMin = Number(process.env.MIN_ANDROID_BUILD || 0) || 0;
  config.minAppBuild = Math.max(Number(config.minAppBuild) || 0, envMin);
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
