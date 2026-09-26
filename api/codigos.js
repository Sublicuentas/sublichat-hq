// api/codigos.js · R77 — Códigos de plataformas para la APK (respaldo independiente de Telegram/Render).
// Lee el correo del hosting por IMAP con la MISMA lógica del bot (lib/codigos-imap.js).
//
// Seguridad:
//  · Sublicuentas, Relojes y Geisell (R79: los tres ven Códigos igual).
//  · Los códigos NO se guardan en ningún lado. En la bitácora (actividad_usuarios) queda quién consultó
//    qué correo, la plataforma y el resultado, nunca el código ni el link.
//  · Máximo 12 consultas por minuto por usuario, para no saturar el hosting.
//
// Variables en Vercel (mismos nombres que en Render): EMAIL_ADMIN_USER, EMAIL_ADMIN_PASS,
// EMAIL_IMAP_HOST, EMAIL_IMAP_PORT (993), EMAIL_IMAP_SECURE (true) · y las FIREBASE_* de siempre.
'use strict';
const admin = require('firebase-admin');
const imap = require('../lib/codigos-imap.js');

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Faltan credenciales Firebase.');
  return admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

const norm = v => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function accessFor(user = {}) {
  const usuario = norm(user.usuario || String(user.uid || '').replace(/^asesor-/, ''));
  const role = norm(user.role).replace(/\s+/g, '_');
  const sublicuentas = ['sublicuentas', 'naara'].includes(usuario) || ['admin', 'administrador', 'sublicuentas', 'owner'].includes(role);
  const relojes = ['relojes', 'libni', 'daniela', 'finanzas'].includes(usuario) || ['relojes', 'finanzas'].includes(role);
  const geisell = ['geisell', 'geissel'].includes(usuario) || ['geisell_admin', 'control_admin'].includes(role); // R79: Geisell también
  const actorLabel = sublicuentas ? 'Sublicuentas' : relojes ? 'Relojes' : geisell ? 'Geisell' : (usuario || 'usuario');
  return { usuario, role, sublicuentas, relojes, geisell, actorLabel, puede: sublicuentas || relojes || geisell };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MODOS = new Set(['codigo', 'link', 'hogar']);
const LIMITE_MIN = 12;
const uso = global.__SUBLI_CODIGOS_USO__ || new Map();
global.__SUBLI_CODIGOS_USO__ = uso;
function permitido(usuario, ahora = Date.now()) {
  const lista = (uso.get(usuario) || []).filter(t => ahora - t < 60000);
  if (lista.length >= LIMITE_MIN) { uso.set(usuario, lista); return false; }
  lista.push(ahora); uso.set(usuario, lista); return true;
}

async function bitacora(db, user, me, modo, correo, resultado) {
  try {
    await db.collection('actividad_usuarios').add({
      usuario: me.usuario, actorLabel: me.actorLabel, rol: me.role, uid: user.uid || '',
      modulo: 'Códigos', accion: modo === 'link' ? 'Consultar link de restablecimiento' : modo === 'hogar' ? 'Consultar Netflix Hogar' : 'Consultar código',
      metodo: 'POST', ruta: '/api/codigos', origen: 'Android',
      detalle: { cuenta: correo, plataforma: resultado.plataformaNombre || '', resultado: resultado.tipo || '' },
      detalleTexto: `cuenta: ${correo}${resultado.plataformaNombre ? ` · plataforma: ${resultado.plataformaNombre}` : ''} · resultado: ${resultado.tipo || ''}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(), createdAtIso: new Date().toISOString(),
    });
  } catch (e) { console.error('CODIGOS_BITACORA', e?.message || e); }
}

async function handler(req, res, deps = {}) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Método no permitido.' }); }
  const auth = deps.auth || (() => { getApp(); return admin.auth(); });
  const dbOf = deps.db || (() => { getApp(); return admin.firestore(); });
  const lib = deps.imap || imap;

  const header = String(req.headers?.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return res.status(401).json({ ok: false, error: 'Sesión requerida.' });
  let user;
  try { user = await auth().verifyIdToken(token, true); } catch (_) { return res.status(401).json({ ok: false, error: 'Sesión inválida o vencida.' }); }
  const me = accessFor(user);
  if (!me.puede) return res.status(403).json({ ok: false, error: 'Los códigos solo están disponibles para Sublicuentas, Relojes y Geisell.' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const accion = String(body.accion || 'buscar').toLowerCase();
  if (accion === 'estado' || accion === 'diagnostico') {
    // R79: revisar la configuración desde la app (sin contraseñas): buzones, hosts y dependencias.
    const st = lib.estadoImap();
    return res.status(200).json({ ok: true, configurado: st.cuentas > 0, cuentas: st.cuentas, buzones: st.buzones || [], dependencias: st.dependencias || { ok: true } });
  }
  if (accion !== 'buscar') return res.status(400).json({ ok: false, error: 'Acción no reconocida.' });

  const correo = lib.normalizarCorreo(body.correo);
  const modo = MODOS.has(String(body.modo || 'codigo')) ? String(body.modo || 'codigo') : 'codigo';
  if (!EMAIL_RE.test(correo) || correo.length > 160) return res.status(400).json({ ok: false, error: 'Escriba un correo válido.' });
  if (!permitido(me.usuario || user.uid)) return res.status(429).json({ ok: false, error: 'Demasiadas consultas seguidas. Espere un minuto.' });

  let db = null; try { db = dbOf(); } catch (_) { db = null; }
  const marcas = db ? db.collection('codigos_entregados') : null;
  try {
    const resultado = await lib.consultar(correo, modo, {
      yaEntregadoDisney: async key => { if (!marcas) return ''; try { const s = await marcas.doc(key).get(); return s.exists ? String(s.data()?.marcador || '') : ''; } catch (_) { return ''; } },
    });
    if (resultado.tipo === 'codigo' && resultado.plataforma === 'disney' && !resultado.repetido && marcas) {
      // Igual que el bot: se recuerda el último OTP de Disney entregado (sin guardar el código visible en la bitácora).
      await marcas.doc(correo).set({ marcador: resultado.marcador, por: me.actorLabel, at: new Date().toISOString() }, { merge: true }).catch(() => {});
    }
    delete resultado.marcador; delete resultado.uid;
    if (db) await bitacora(db, user, me, modo, correo, resultado);
    return res.status(200).json({ ok: true, modo, resultado });
  } catch (e) {
    if (e?.code === 'IMAP_SIN_CREDENCIALES') return res.status(503).json({ ok: false, error: 'Falta configurar el correo del hosting en Vercel (EMAIL_ADMIN_USER y EMAIL_ADMIN_PASS).' });
    if (e?.code === 'IMAP_DEPENDENCIA') return res.status(503).json({ ok: false, error: `Falta instalar "${e.dep}" en Vercel. Suba package.json y package-lock.json del R77/R79 y haga Redeploy.` });
    console.error('CODIGOS_ERROR', e?.code || '', e?.cause?.message || e?.message || e);
    return res.status(502).json({ ok: false, error: 'No se pudo abrir el correo del hosting. Intente de nuevo en unos segundos.' });
  }
}

// R79: nunca dejar que un error inesperado tumbe la función (Vercel respondería un objeto y la app vería "[object Object]").
module.exports = async (req, res) => {
  try { return await handler(req, res); }
  catch (e) {
    console.error('CODIGOS_FATAL', e?.stack || e?.message || e);
    if (!res.headersSent) return res.status(500).json({ ok: false, error: `Error interno de Códigos: ${String(e?.message || e).slice(0, 160)}` });
  }
};
module.exports.handler = handler;
module.exports.accessFor = accessFor;
