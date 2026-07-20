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

// El avatar es un dataURL base64 (imagen redimensionada en el navegador antes de subir).
// Límite generoso pero seguro para no chocar con el máximo de 1MB por documento de Firestore.
const MAX_AVATAR_LEN = 700000;

async function guardarPerfil(db, body) {
  const usuario = normUser(body.usuario);
  const ref = db.collection('perfiles_usuario').doc(usuario);
  const now = new Date().toISOString();
  const update = { usuario, updatedAt: now };

  if (typeof body.avatar === 'string') {
    if (body.avatar && !body.avatar.startsWith('data:image/')) {
      return { status: 400, json: { ok: false, error: 'Formato de foto inválido.' } };
    }
    if (body.avatar.length > MAX_AVATAR_LEN) {
      return { status: 400, json: { ok: false, error: 'La foto pesa mucho. Use una imagen más pequeña.' } };
    }
    update.avatar = body.avatar;
  }
  if (typeof body.nombre === 'string') update.nombre = clean(body.nombre, 80);
  if (typeof body.cargo === 'string') update.cargo = clean(body.cargo, 120);
  if (typeof body.telefono === 'string') update.telefono = clean(body.telefono, 40);
  if (typeof body.area === 'string') update.area = clean(body.area, 80);
  if (typeof body.funcionesExtra === 'string') update.funcionesExtra = clean(body.funcionesExtra, 500);
  if (typeof body.color === 'string') update.color = clean(body.color, 20);
  if (typeof body.emoji === 'string') update.emoji = clean(body.emoji, 10);
  if (typeof body.tema === 'string') update.tema = clean(body.tema, 30);

  await ref.set(update, { merge: true });
  return { ok: true, usuario };
}

async function obtenerPerfil(db, body) {
  const usuario = normUser(body.usuario);
  const snap = await db.collection('perfiles_usuario').doc(usuario).get();
  if (!snap.exists) return { ok: true, usuario, perfil: null };
  return { ok: true, usuario, perfil: snap.data() || null };
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
      return res.status(200).json({ ok: true, msg: 'api/perfil activo' });
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
