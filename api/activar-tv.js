'use strict';
const admin = require('firebase-admin');
const { canUse } = require('../activar-tv-platforms');

function initAdmin() {
  if (admin.apps.length) return;
  const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail } = process.env;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('AUTH_CONFIG');
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

// El operador procede exclusivamente del token firmado por Firebase.
// No se aceptan usuario, rol, URL ni propietario enviados por el navegador.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
  const token = /^Bearer (.+)$/.exec(String(req.headers.authorization || ''))?.[1];
  if (!token) return res.status(401).json({ ok: false, error: 'Inicie sesión en Sublichat.' });
  let user;
  try { initAdmin(); user = await admin.auth().verifyIdToken(token, true); }
  catch (_) { return res.status(401).json({ ok: false, error: 'La sesión de Sublichat venció. Vuelva a ingresar.' }); }
  if (!canUse(user.usuario)) return res.status(403).json({ ok: false, error: 'Este usuario no tiene acceso a Activar TV.' });
  const body = req.body || {};
  const allowed = ['availability', 'start', 'poll', 'interact', 'confirm_account', 'activation_page', 'activate', 'close'];
  if (!allowed.includes(body.action)) return res.status(400).json({ ok: false, error: 'Acción no válida.' });
  if (Buffer.byteLength(JSON.stringify(body)) > 24000) return res.status(413).json({ ok: false, error: 'Solicitud demasiado grande.' });
  const rawUrl = process.env.TV_BROWSER_URL || '';
  const secret = process.env.TV_BROWSER_SECRET || '';
  let endpoint;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('URL');
    endpoint = new URL('/v1/action', url).href;
    if (secret.length < 32) throw new Error('SECRET');
  } catch (_) {
    return res.status(body.action === 'availability' ? 200 : 503).json({
      ok: body.action === 'availability', available: false, code: 'TV_NOT_CONFIGURED',
      error: 'Activar TV está pendiente de conexión. Solicite a Sublicuentas conectar el servicio.',
      platforms: []
    });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const payload = { action: body.action, owner: user.uid };
    for (const field of ['sessionId', 'requestId', 'platform', 'email', 'password', 'code', 'event']) {
      if (Object.prototype.hasOwnProperty.call(body, field)) payload[field] = body[field];
    }
    const response = await fetch(endpoint, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + secret },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    if (text.length > 3000000) throw new Error('RESPONSE_SIZE');
    const data = JSON.parse(text);
    return res.status(response.status).json(data);
  } catch (_) {
    return res.status(503).json({ ok: false, code: 'TV_UNREACHABLE', error: 'No se pudo contactar con Activar TV. Reintente en unos momentos.' });
  } finally { clearTimeout(timeout); }
};
