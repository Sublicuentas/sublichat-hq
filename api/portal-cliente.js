// api/portal-cliente.js · Portal público complementario para las URL de acceso
//
// Este endpoint NO modifica clientes, servicios, fichas, enlaces ni inventario.
// Solo administra y publica promociones segmentadas y métodos de pago.

const admin = require('firebase-admin');

const PROMOS_COLLECTION = 'portal_promociones';
const CONFIG_COLLECTION = 'portal_cliente';
const CONFIG_DOC = 'configuracion';
const MAX_PROMO_IMAGE = 620000;
const MAX_PAYMENT_LOGO = 90000;
const MAX_PAYMENT_LOGOS_TOTAL = 750000;

const LOGO_KEYS = new Set([
  'tigo', 'atlantida', 'bac', 'ficohsa', 'davivienda', 'banpais', 'tengo', 'occidente', 'custom'
]);

const DEFAULT_PAYMENT_METHODS = [
  { id: 'tigo-money', nombre: 'Tigo Money', titular: 'LIBNI DANIELA VELÁSQUEZ BLANCO', cuenta: '98982678', nota: '+6.5% comisión', logoKey: 'tigo', activo: true },
  { id: 'banco-atlantida', nombre: 'Banco Atlántida', titular: 'GEISELL ANABEL VALLE GARCIA', cuenta: '2020602550', nota: '', logoKey: 'atlantida', activo: true },
  { id: 'bac-credomatic', nombre: 'BAC Credomatic', titular: 'NAARA BETZABÉ VELÁSQUEZ BLANCO', cuenta: '724942021', nota: '', logoKey: 'bac', activo: true },
  { id: 'ficohsa', nombre: 'Ficohsa', titular: 'LIBNI DANIELA VELÁSQUEZ BLANCO', cuenta: '200013608678', nota: '', logoKey: 'ficohsa', activo: true },
  { id: 'davivienda', nombre: 'Davivienda', titular: 'LIBNI DANIELA VELÁSQUEZ BLANCO', cuenta: '1061186537', nota: '', logoKey: 'davivienda', activo: true },
  { id: 'banpais', nombre: 'Banpaís', titular: 'LIBNI DANIELA VELÁSQUEZ BLANCO', cuenta: '01-900-030022-6', nota: 'Cuenta de cheques', logoKey: 'banpais', activo: true },
  { id: 'tengo', nombre: 'Tengo', titular: 'NAARA BETZABÉ VELÁSQUEZ BLANCO', cuenta: '32063988', nota: 'Billetera digital móvil', logoKey: 'tengo', activo: true },
  { id: 'banco-occidente', nombre: 'Banco de Occidente', titular: 'LIBNI DANIELA VELÁSQUEZ BLANCO', cuenta: '214430125472', nota: '', logoKey: 'occidente', activo: true }
];

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
  privateKey = privateKey.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Faltan variables de Firebase.');
  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
}

function clean(value, max = 500) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function norm(value) {
  return clean(value, 180).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}

function safeId(value) {
  return clean(value, 120).replace(/[^a-zA-Z0-9_-]/g, '');
}

function uniqueStrings(values, maxItems = 500, maxLen = 160) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(values) ? values : []) {
    const value = clean(raw, maxLen);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= maxItems) break;
  }
  return out;
}

function isSublicuentasUser(user) {
  const usuario = norm(user && (user.usuario || user.name || ''));
  // La identidad sigue la misma regla del RBAC actual: Naara/Sublicuentas es
  // la cuenta propietaria aunque AUTH_USERS_JSON todavía conserve un rol viejo.
  return ['sublicuentas', 'naara'].includes(usuario);
}

async function requireSublicuentas(req, res) {
  const auth = clean(req.headers.authorization || '', 4000);
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ ok: false, error: 'Sesión requerida.' });
    return null;
  }
  try {
    const user = await admin.auth().verifyIdToken(token);
    if (!isSublicuentasUser(user)) {
      res.status(403).json({ ok: false, error: 'Este módulo es exclusivo del usuario Sublicuentas.' });
      return null;
    }
    return user;
  } catch (_) {
    res.status(401).json({ ok: false, error: 'Sesión inválida o vencida.' });
    return null;
  }
}

function normalizeDate(value) {
  const date = clean(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function todayHonduras() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Tegucigalpa', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function normalizeImage(value) {
  const image = String(value == null ? '' : value).trim();
  if (!image) return '';
  if (image.startsWith('data:image/')) {
    if (image.length > MAX_PROMO_IMAGE) throw new Error('La imagen de la promoción pesa demasiado.');
    return image;
  }
  if (/^https:\/\//i.test(image) && image.length <= 2200) return image;
  throw new Error('La imagen de la promoción no es válida.');
}

function normalizePaymentLogo(value, index = 0) {
  const logo = String(value == null ? '' : value).trim();
  if (!logo) return '';
  if (/^data:image\/(?:png|webp);base64,/i.test(logo)) {
    if (logo.length > MAX_PAYMENT_LOGO) throw new Error(`El logo del método ${index + 1} pesa demasiado.`);
    return logo;
  }
  if (/^https:\/\//i.test(logo) && logo.length <= 2200) return logo;
  throw new Error(`El logo del método ${index + 1} debe ser PNG, WebP o usar una dirección https.`);
}

function normalizeTarget(raw = {}) {
  const type = ['todos', 'vendedores', 'clientes'].includes(clean(raw.tipo, 20))
    ? clean(raw.tipo, 20) : 'todos';
  return {
    tipo: type,
    vendedores: type === 'vendedores' ? uniqueStrings(raw.vendedores, 80).map(norm).filter(Boolean) : [],
    clientes: type === 'clientes' ? uniqueStrings(raw.clientes, 1500) : []
  };
}

function normalizePromotion(raw = {}, previous = {}) {
  const alcance = normalizeTarget(raw.alcance || previous.alcance || {});
  if (alcance.tipo === 'vendedores' && !alcance.vendedores.length) throw new Error('Seleccione al menos un vendedor.');
  if (alcance.tipo === 'clientes' && !alcance.clientes.length) throw new Error('Seleccione al menos un cliente.');
  const titulo = clean(raw.titulo, 100);
  if (!titulo) throw new Error('Escriba el título de la promoción.');
  return {
    titulo,
    descripcion: clean(raw.descripcion, 500),
    etiqueta: clean(raw.etiqueta, 40) || 'PROMOCIÓN',
    precio: clean(raw.precio, 60),
    precioAnterior: clean(raw.precioAnterior, 60),
    imagen: normalizeImage(raw.imagen != null ? raw.imagen : previous.imagen),
    color: /^#[0-9a-fA-F]{6}$/.test(clean(raw.color, 7)) ? clean(raw.color, 7) : '#E2231A',
    ctaTexto: clean(raw.ctaTexto, 50) || 'Solicitar promoción',
    ctaMensaje: clean(raw.ctaMensaje, 300) || `Hola, deseo información sobre la promoción ${titulo}.`,
    fechaInicio: normalizeDate(raw.fechaInicio),
    fechaFin: normalizeDate(raw.fechaFin),
    activa: raw.activa !== false,
    orden: Math.max(0, Math.min(9999, Number(raw.orden) || 0)),
    alcance
  };
}

function normalizePaymentMethod(raw = {}, index = 0) {
  const nombre = clean(raw.nombre, 80);
  const cuenta = clean(raw.cuenta, 100);
  if (!nombre || !cuenta) throw new Error(`Complete el nombre y número del método ${index + 1}.`);
  const logoKey = LOGO_KEYS.has(clean(raw.logoKey, 30)) ? clean(raw.logoKey, 30) : 'custom';
  const logoUrl = normalizePaymentLogo(raw.logoUrl, index);
  return {
    id: safeId(raw.id) || `pago-${Date.now()}-${index + 1}`,
    nombre,
    titular: clean(raw.titular, 130),
    cuenta,
    nota: clean(raw.nota, 120),
    logoKey,
    logoUrl,
    activo: raw.activo !== false,
    orden: index
  };
}

function paymentConfig(data = {}) {
  const methods = Array.isArray(data.metodos) && data.metodos.length
    ? data.metodos.map((item, index) => normalizePaymentMethod(item, index))
    : DEFAULT_PAYMENT_METHODS.map((item, index) => ({ ...item, orden: index }));
  return {
    metodos: methods,
    avisoPago: clean(data.avisoPago, 220) || '¡No escribir en detalle o asunto!',
    updatedAt: data.updatedAt || ''
  };
}

function promotionMatches(promo, clientId, vendorNorm, today) {
  if (!promo || promo.activa === false) return false;
  if (promo.fechaInicio && promo.fechaInicio > today) return false;
  if (promo.fechaFin && promo.fechaFin < today) return false;
  const target = normalizeTarget(promo.alcance || {});
  if (target.tipo === 'clientes') return target.clientes.includes(clientId);
  if (target.tipo === 'vendedores') return target.vendedores.includes(vendorNorm);
  return true;
}

async function publicPortal(db, req, res) {
  const token = clean(req.query && req.query.token, 90);
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(token)) {
    return res.status(400).json({ ok: false, error: 'Enlace inválido.' });
  }
  const pointer = await db.collection('enlaces').doc(token).get();
  if (!pointer.exists || (pointer.data() || {}).activo === false) {
    return res.status(404).json({ ok: false, error: 'Este enlace ya no está disponible.' });
  }
  const clientId = clean((pointer.data() || {}).clienteId, 150);
  if (!clientId) return res.status(404).json({ ok: false, error: 'No se encontró el cliente.' });
  const [clientSnap, promoSnap, configSnap] = await Promise.all([
    db.collection('clientes').doc(clientId).get(),
    db.collection(PROMOS_COLLECTION).limit(100).get(),
    db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).get()
  ]);
  if (!clientSnap.exists) return res.status(404).json({ ok: false, error: 'No se encontró el cliente.' });
  const client = clientSnap.data() || {};
  const vendorNorm = norm(client.vendedor_norm || client.vendedor || '');
  const today = todayHonduras();
  const promociones = promoSnap.docs
    .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(promo => promotionMatches(promo, clientId, vendorNorm, today))
    .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, 20)
    .map(promo => ({
      id: promo.id,
      titulo: clean(promo.titulo, 100), descripcion: clean(promo.descripcion, 500),
      etiqueta: clean(promo.etiqueta, 40), precio: clean(promo.precio, 60),
      precioAnterior: clean(promo.precioAnterior, 60), imagen: String(promo.imagen || ''),
      color: /^#[0-9a-fA-F]{6}$/.test(String(promo.color || '')) ? promo.color : '#E2231A',
      ctaTexto: clean(promo.ctaTexto, 50), ctaMensaje: clean(promo.ctaMensaje, 300),
      fechaFin: normalizeDate(promo.fechaFin)
    }));
  const config = paymentConfig(configSnap.exists ? configSnap.data() : {});
  return res.status(200).json({
    ok: true,
    promociones,
    metodosPago: config.metodos.filter(item => item.activo !== false),
    avisoPago: config.avisoPago
  });
}

async function loadAdmin(db) {
  const [promoSnap, configSnap, clientsSnap] = await Promise.all([
    db.collection(PROMOS_COLLECTION).limit(100).get(),
    db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).get(),
    db.collection('clientes').limit(5000).get()
  ]);
  const promociones = promoSnap.docs
    .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
    .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const clientes = clientsSnap.docs.map(doc => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      nombre: clean(data.nombrePerfil || data.nombre || 'Cliente', 100),
      telefono: clean(data.telefono, 40),
      vendedor: clean(data.vendedor, 80),
      vendedorNorm: norm(data.vendedor_norm || data.vendedor || '')
    };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const vendorMap = new Map();
  clientes.forEach(client => {
    if (client.vendedorNorm && !vendorMap.has(client.vendedorNorm)) {
      vendorMap.set(client.vendedorNorm, client.vendedor || client.vendedorNorm);
    }
  });
  const config = paymentConfig(configSnap.exists ? configSnap.data() : {});
  return {
    ok: true,
    promociones,
    metodosPago: config.metodos,
    avisoPago: config.avisoPago,
    clientes,
    vendedores: [...vendorMap.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).json({ ok: true });
  try {
    const db = getApp().firestore();
    if (req.method === 'GET') return publicPortal(db, req, res);
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido.' });
    const user = await requireSublicuentas(req, res);
    if (!user) return;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const action = clean(body.accion || 'cargar', 40).toLowerCase();
    if (action === 'cargar') return res.status(200).json(await loadAdmin(db));

    if (action === 'guardar_promocion') {
      const id = safeId(body.id);
      const ref = id ? db.collection(PROMOS_COLLECTION).doc(id) : db.collection(PROMOS_COLLECTION).doc();
      const previousSnap = id ? await ref.get() : null;
      const previous = previousSnap && previousSnap.exists ? previousSnap.data() || {} : {};
      const now = new Date().toISOString();
      const promotion = normalizePromotion(body.promocion || {}, previous);
      await ref.set({
        ...promotion,
        createdAt: previous.createdAt || now,
        updatedAt: now,
        updatedBy: clean(user.usuario || user.uid || 'sublicuentas', 80)
      }, { merge: false });
      return res.status(200).json({ ok: true, id: ref.id, promocion: { id: ref.id, ...promotion } });
    }

    if (action === 'eliminar_promocion') {
      const id = safeId(body.id);
      if (!id) return res.status(400).json({ ok: false, error: 'Promoción inválida.' });
      await db.collection(PROMOS_COLLECTION).doc(id).delete();
      return res.status(200).json({ ok: true, eliminada: id });
    }

    if (action === 'guardar_metodos') {
      const rawMethods = Array.isArray(body.metodosPago) ? body.metodosPago : [];
      if (!rawMethods.length) return res.status(400).json({ ok: false, error: 'Agregue al menos un método de pago.' });
      if (rawMethods.length > 30) return res.status(400).json({ ok: false, error: 'El máximo es de 30 métodos de pago.' });
      const methods = rawMethods.map(normalizePaymentMethod);
      if (methods.reduce((total, method) => total + method.logoUrl.length, 0) > MAX_PAYMENT_LOGOS_TOTAL) {
        return res.status(400).json({ ok: false, error: 'Los logos juntos pesan demasiado. Use imágenes PNG más pequeñas.' });
      }
      const now = new Date().toISOString();
      await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).set({
        metodos: methods,
        avisoPago: clean(body.avisoPago, 220) || '¡No escribir en detalle o asunto!',
        updatedAt: now,
        updatedBy: clean(user.usuario || user.uid || 'sublicuentas', 80)
      }, { merge: true });
      return res.status(200).json({ ok: true, metodosPago: methods, updatedAt: now });
    }

    return res.status(400).json({ ok: false, error: 'Acción no soportada.' });
  } catch (error) {
    console.error('PORTAL_CLIENTE_ERROR', error);
    return res.status(500).json({ ok: false, error: error && error.message ? error.message : 'No se pudo completar la operación.' });
  }
};
