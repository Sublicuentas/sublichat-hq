// api/perfil.js · Sublichat Perfil de Usuario
// Guarda el perfil (nombre, cargo, foto/avatar, etc.) en Firestore para que
// se vea igual en cualquier dispositivo donde el usuario inicie sesión.
// Variables esperadas en Vercel:
// FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

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

// Normaliza el nombre de usuario para usarlo como ID de documento (sin acentos, minúsculas).
function normUser(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]/g, '').trim() || 'usuario';
}

// Las imágenes se guardan en documentos separados para evitar que avatar + banner
// superen juntos el límite de 1 MiB por documento de Firestore.
const MAX_IMAGE_LEN = 850000;

function imageValue(v, label) {
  if (typeof v !== 'string') return { present: false, value: '' };
  if (v && !v.startsWith('data:image/')) {
    return { error: `Formato de ${label} inválido.` };
  }
  if (v.length > MAX_IMAGE_LEN) {
    return { error: `La imagen de ${label} pesa mucho. Use una imagen más pequeña.` };
  }
  return { present: true, value: v };
}

function percent(v, fallback = 50) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback;
}

function zoom(v, fallback = 100) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(100, Math.min(250, Math.round(n))) : fallback;
}

async function guardarPerfil(db, body) {
  const usuario = normUser(body.usuario);
  const ref = db.collection('perfiles_usuario').doc(usuario);
  const media = db.collection('perfiles_usuario_media');
  const now = new Date().toISOString();
  const update = { usuario, updatedAt: now };

  const avatar = imageValue(body.avatar, 'foto');
  const banner = imageValue(body.banner, 'banner');
  if (avatar.error) return { status: 400, json: { ok: false, error: avatar.error } };
  if (banner.error) return { status: 400, json: { ok: false, error: banner.error } };
  if (typeof body.nombre === 'string') update.nombre = clean(body.nombre, 80);
  if (typeof body.cargo === 'string') update.cargo = clean(body.cargo, 120);
  if (typeof body.telefono === 'string') update.telefono = clean(body.telefono, 40);
  if (typeof body.area === 'string') update.area = clean(body.area, 80);
  if (typeof body.funcionesExtra === 'string') update.funcionesExtra = clean(body.funcionesExtra, 500);
  if (typeof body.color === 'string') update.color = clean(body.color, 20);
  if (typeof body.emoji === 'string') update.emoji = clean(body.emoji, 10);
  if (typeof body.tema === 'string') update.tema = clean(body.tema, 30);
  if (typeof body.bannerCropMode === 'string') update.bannerCropMode = body.bannerCropMode === 'custom' ? 'custom' : 'auto';
  update.bannerPosX = percent(body.bannerPosX);
  update.bannerPosY = percent(body.bannerPosY);
  update.heroBannerPosX = percent(body.heroBannerPosX);
  update.heroBannerPosY = percent(body.heroBannerPosY);
  update.bannerZoom = zoom(body.bannerZoom);
  update.heroBannerZoom = zoom(body.heroBannerZoom);
  update.bannerCropUpdatedAt = clean(body.bannerCropUpdatedAt, 50) || now;

  const writes = [ref.set(update, { merge: true })];
  if (avatar.present) writes.push(media.doc(usuario + '_avatar').set({ usuario, tipo: 'avatar', data: avatar.value, updatedAt: now }, { merge: true }));
  if (banner.present) writes.push(media.doc(usuario + '_banner').set({ usuario, tipo: 'banner', data: banner.value, updatedAt: now }, { merge: true }));
  await Promise.all(writes);
  return {
    ok: true,
    usuario,
    encuadre: {
      bannerCropMode: update.bannerCropMode || 'auto',
      bannerPosX: update.bannerPosX,
      bannerPosY: update.bannerPosY,
      bannerZoom: update.bannerZoom,
      heroBannerPosX: update.heroBannerPosX,
      heroBannerPosY: update.heroBannerPosY,
      heroBannerZoom: update.heroBannerZoom,
      bannerCropUpdatedAt: update.bannerCropUpdatedAt
    }
  };
}

async function obtenerPerfil(db, body) {
  const usuario = normUser(body.usuario);
  const media = db.collection('perfiles_usuario_media');
  const [snap, avatarSnap, bannerSnap] = await Promise.all([
    db.collection('perfiles_usuario').doc(usuario).get(),
    media.doc(usuario + '_avatar').get(),
    media.doc(usuario + '_banner').get()
  ]);
  if (!snap.exists) return { ok: true, usuario, perfil: null };
  const perfil = { ...(snap.data() || {}) };
  if (avatarSnap.exists) perfil.avatar = String((avatarSnap.data() || {}).data || '');
  if (bannerSnap.exists) perfil.banner = String((bannerSnap.data() || {}).data || '');
  return { ok: true, usuario, perfil };
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
      return res.status(200).json({ ok: true, msg: 'api/perfil activo', version: 'perfil-banner-encuadre-confirmado-20260721' });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido.' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (!clean(body.usuario, 80)) return res.status(400).json({ ok: false, error: 'Falta usuario.' });
    const accion = clean(body.accion || 'obtener', 30).toLowerCase();
    let out;
    if (accion === 'guardar') out = await guardarPerfil(db, body);
    else if (accion === 'obtener') out = await obtenerPerfil(db, body);
    else out = { status: 400, json: { ok: false, error: 'Acción no soportada: ' + accion } };
    if (out && out.status) return res.status(out.status).json(out.json);
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e && e.message ? e.message : String(e) });
  }
};
