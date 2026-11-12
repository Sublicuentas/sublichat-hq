// api/permisos.js · R162 — Módulos por usuario (los define Sublicuentas).
//   POST { accion: 'mis_permisos' }                       → cualquier usuario con sesión: sus módulos y pantallas.
//   POST { accion: 'listar' }                             → solo Sublicuentas: todos los usuarios con sus módulos.
//   POST { accion: 'guardar', usuario, modulos: {id: true|false|null} } → solo Sublicuentas. null = volver a lo de siempre.
//   POST { accion: 'retirar', usuario, confirmar, borrarDatosSala }  → R180 · solo Sublicuentas: baja del usuario (ver abajo).
//   POST { accion: 'reactivar', usuario }                            → R180 · solo Sublicuentas.
// Los usuarios salen de AUTH_USERS_JSON (+ Geisell configurada aparte): un usuario nuevo aparece aquí solo.
// Nunca se devuelven claves ni hashes. Cada cambio queda en auditoria_eventos.
'use strict';
const admin = require('firebase-admin');
const P = require('./_permisos.js');

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID, clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Faltan credenciales Firebase.');
  return admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

// Usuarios de Sublichat (solo nombre y rol). Los alias de Sublicuentas (naara) se muestran como supervisor.
function usuariosConfigurados(env = process.env) {
  let users = {};
  try { users = JSON.parse(env.AUTH_USERS_JSON || '{}') || {}; } catch (_) { users = {}; }
  const out = new Map();
  for (const [k, r] of Object.entries(users)) {
    const usuario = P.claveUsuario({ usuario: k });
    if (!usuario) continue;
    out.set(usuario, { usuario, role: String(r && r.role || 'asesor') });
  }
  if (!out.has('geisell') && (env.GEISELL_PASSWORD_HASH || env.GEISELL_PASSWORD)) out.set('geisell', { usuario: 'geisell', role: 'geisell_admin' });
  return [...out.values()];
}
// UID real de Firebase del usuario (el mismo que usa api/login.js al crear el token)
function uidDe(env, usuario) {
  let users = {}; try { users = JSON.parse(env.AUTH_USERS_JSON || '{}') || {}; } catch (_) {}
  const r = users[usuario] || Object.entries(users).find(([k]) => P.claveUsuario({ usuario: k }) === usuario)?.[1];
  if (r && r.uid) return String(r.uid);
  return usuario === 'geisell' ? 'admin-geisell' : `asesor-${usuario}`;
}
const ETIQUETA_ROL = { admin: 'Supervisor', finanzas: 'Operativo · Finanzas', auditor: 'Auditor', geisell_admin: 'Admin Control' };

async function handler(req, res, deps = {}) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Método no permitido.' }); }
  const auth = deps.auth || (() => { getApp(); return admin.auth(); });
  const dbOf = deps.db || (() => { getApp(); return admin.firestore(); });
  const env = deps.env || process.env;

  const header = String(req.headers?.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return res.status(401).json({ ok: false, error: 'Sesión requerida.' });
  let user;
  try { user = await auth().verifyIdToken(token, true); } catch (_) { return res.status(401).json({ ok: false, error: "Sesión inválida, vencida o dada de baja." }); } // R180: true = rechaza sesiones revocadas o cuentas deshabilitadas

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const accion = String(body.accion || 'mis_permisos');
  let db;
  try { db = dbOf(); } catch (e) { return res.status(500).json({ ok: false, error: 'No se pudo conectar con la base de datos.' }); }
  const catalogo = P.MODULOS.map(({ id, label, grupo, fijo, servidor }) => ({ id, label, grupo, fijo: !!fijo, servidor: !!servidor }));

  try {
    if (accion === 'mis_permisos') {
      let config = {};
      try { config = await P.leerConfig(db); } catch (_) { config = {}; }
      const retirado = P.esRetirado(config, user);
      return res.status(200).json({ ok: true, usuario: P.claveUsuario(user), supervisor: P.esSupervisor(user), retirado, modulos: P.efectivos(user, config), pantallas: P.pantallasVisibles(user, config), catalogo });
    }
    if (!P.esSupervisor(user)) return res.status(403).json({ ok: false, error: 'Solo Sublicuentas administra los módulos de los usuarios.' });

    if (accion === 'listar') {
      const config = await P.leerConfig(db, { fresco: true });
      const ret = config.retirados || {};
      const retirados = Object.entries(ret).filter(([, v]) => v && !v.reactivadoAt).map(([usuario, v]) => ({ usuario, retiradoAt: v.retiradoAt || '', por: v.por || '' }));
      const usuarios = usuariosConfigurados(env).filter((u) => !P.esRetirado(config, u)).map((u) => {
        const ux = { usuario: u.usuario, role: u.role };
        const supervisor = P.esSupervisor(ux);
        return { usuario: u.usuario, rol: ETIQUETA_ROL[P.rolDe(ux)] || 'Usuario', supervisor, porDefecto: P.porDefecto(ux), cambios: supervisor ? {} : P.overridesDe(config, u.usuario), modulos: P.efectivos(ux, config) };
      }).sort((a, b) => Number(b.supervisor) - Number(a.supervisor) || a.usuario.localeCompare(b.usuario));
      return res.status(200).json({ ok: true, catalogo, usuarios, retirados, actualizado: config.updatedAt || '', actualizadoPor: config.updatedBy || '' });
    }

    if (accion === 'guardar') {
      const usuario = P.claveUsuario({ usuario: body.usuario });
      const conocido = usuariosConfigurados(env).find((u) => u.usuario === usuario);
      if (!usuario || !conocido) return res.status(400).json({ ok: false, error: 'Ese usuario no existe en Sublichat.' });
      if (P.esSupervisor({ usuario, role: conocido.role })) return res.status(400).json({ ok: false, error: 'Sublicuentas tiene siempre todos los módulos.' });
      if (P.esRetirado(await P.leerConfig(db, { fresco: true }), { usuario })) return res.status(409).json({ ok: false, error: 'Ese usuario está retirado. Reactívelo primero.' });
      const cambios = P.limpiarCambios(body.modulos);
      if (!Object.keys(cambios).length) return res.status(400).json({ ok: false, error: 'No hay cambios para guardar.' });
      const ref = db.collection(P.DOC[0]).doc(P.DOC[1]);
      const ahora = new Date().toISOString(), actor = P.claveUsuario(user);
      const final = await db.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        const data = s.exists ? (s.data() || {}) : {};
        const usuarios = { ...(data.usuarios || {}) };
        const actuales = { ...((usuarios[usuario] || {}).modulos || {}) };
        for (const [k, v] of Object.entries(cambios)) { if (v === null) delete actuales[k]; else actuales[k] = v; }
        usuarios[usuario] = { modulos: actuales, updatedAt: ahora, updatedBy: actor };
        tx.set(ref, { ...data, usuarios, updatedAt: ahora, updatedBy: actor }, { merge: false }); // R180: conserva `retirados`
        tx.set(db.collection('auditoria_eventos').doc(), { tipo: 'permisos_modulos', modulo: 'permisos', accion: 'guardar_permisos', actorUsuario: actor, objetivo: usuario, cambios, resultado: 'ok', createdAt: ahora });
        return { usuarios };
      });
      P.invalidar();
      const ux = { usuario, role: conocido.role };
      return res.status(200).json({ ok: true, usuario, cambios: P.overridesDe(final, usuario), modulos: P.efectivos(ux, final) });
    }
    // ---------- R180 · baja de usuario (una sola fuente: config/sublichat_permisos.retirados) ----------
    // 1) se identifica por clave + UID de Firebase (de AUTH_USERS_JSON), nunca por nombre; 2) se marca retirado y se revoca:
    //    tokens de Firebase (refresh revocado + cuenta deshabilitada), login bloqueado, módulos y pantallas en cero;
    // 3) Sala de Juntas: sale de convocatorias futuras, invitaciones, avisos de Telegram, solicitudes y vínculo de Telegram;
    // 4) NO se borra nada del negocio (ventas, pagos, clientes, contabilidad, auditoría, actas pasadas). Idempotente.
    if (accion === 'retirar' || accion === 'reactivar') {
      const usuario = P.claveUsuario({ usuario: body.usuario });
      const conocido = usuariosConfigurados(env).find((u) => u.usuario === usuario);
      const cfg0 = await P.leerConfig(db, { fresco: true });
      if (!usuario || (!conocido && !(cfg0.retirados || {})[usuario])) return res.status(400).json({ ok: false, error: 'Ese usuario no existe en Sublichat.' });
      if (P.esSupervisor({ usuario, role: conocido ? conocido.role : 'asesor' })) return res.status(400).json({ ok: false, error: 'La cuenta Sublicuentas no se puede retirar.' });
      if (accion === 'retirar' && String(body.confirmar || '').trim().toLowerCase() !== usuario) return res.status(400).json({ ok: false, error: `Para confirmar escriba el usuario exacto: ${usuario}` });
      const uid = uidDe(env, usuario);
      const ref = db.collection(P.DOC[0]).doc(P.DOC[1]);
      const ahora = new Date().toISOString(), actor = P.claveUsuario(user);
      await db.runTransaction(async (tx) => {
        const s = await tx.get(ref); const data = s.exists ? (s.data() || {}) : {};
        const retirados = { ...(data.retirados || {}) };
        retirados[usuario] = accion === 'retirar' ? { retiradoAt: ahora, por: actor, uid } : { ...(retirados[usuario] || {}), reactivadoAt: ahora, reactivadoPor: actor };
        tx.set(ref, { ...data, retirados, updatedAt: ahora, updatedBy: actor }, { merge: false });
        tx.set(db.collection('auditoria_eventos').doc(), { tipo: 'usuarios', modulo: 'permisos', accion: accion === 'retirar' ? 'retirar_usuario' : 'reactivar_usuario', actorUsuario: actor, objetivo: usuario, uid, resultado: 'ok', createdAt: ahora });
      });
      P.invalidar();
      const informe = { usuario, uid, firebase: 'sin_cambios', sala: null };
      try { // Firebase Auth: revoca sesiones y deshabilita (o habilita al reactivar). Si la cuenta nunca inició sesión, no existe aún.
        const a = auth();
        if (accion === 'retirar') { await a.revokeRefreshTokens(uid); await a.updateUser(uid, { disabled: true }); informe.firebase = 'revocado_y_deshabilitado'; }
        else { await a.updateUser(uid, { disabled: false }); informe.firebase = 'habilitado'; }
      } catch (e) { informe.firebase = /no user record|user-not-found/i.test(String(e?.code || e?.message)) ? 'sin_cuenta_firebase' : 'error: ' + String(e?.message || e).slice(0, 120); }
      if (accion === 'retirar') { try { informe.sala = await require('./sala-juntas.js').retirarDeSala(db, usuario, { borrarDatos: !!body.borrarDatosSala, env, fetch: deps.fetch }); } catch (e) { informe.sala = { error: String(e?.message || e).slice(0, 160) }; } }
      return res.status(200).json({ ok: true, accion, informe });
    }
    return res.status(400).json({ ok: false, error: 'Acción no reconocida.' });
  } catch (e) {
    console.error('PERMISOS_ERROR', e?.message || e);
    return res.status(500).json({ ok: false, error: 'No se pudieron leer o guardar los permisos.' });
  }
}

module.exports = handler;
module.exports.handler = handler;
module.exports.usuariosConfigurados = usuariosConfigurados;
module.exports.uidDe = uidDe;
