// api/sala-juntas.js · R167 — SubliStudio 3D · Sala de Juntas (Fase 1: panel, convocatorias, antesala).
// POST { accion, ... } con el Bearer de Sublichat. TODA autorización se repite aquí (no basta esconder botones):
//   · solo Naara / Libni / Geisell (por identidad del token, ver _sala-juntas.js) · crear/editar/cancelar/abrir: solo Naara
//   · cada fundadora solo ve las reuniones donde está invitada y solo responde SU invitación.
// Firestore (colecciones nuevas): sala_reuniones, sala_invitaciones, sala_avisos · auditoría en auditoria_eventos.
// Los avisos quedan "pendiente": los envía el bot (Fase 2). El token de tiempo real (LiveKit) es Fase 4.
'use strict';
const admin = require('firebase-admin');
const S = require('./_sala-juntas.js');
const P = require('./_permisos.js');
const { usuariosConfigurados } = require('./permisos.js');
const ETQ_ROL = { admin: 'Supervisor', finanzas: 'Operativo', auditor: 'Auditor', geisell_admin: 'Admin Control' };

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID, clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Faltan credenciales Firebase.');
  return admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}
const C = { ESC: 'sala_escenarios', R: 'sala_reuniones', I: 'sala_invitaciones', A: 'sala_avisos', ACTAS: 'sala_actas', AV: 'sala_avatares', AUD: 'auditoria_eventos',
  SOL: 'sala_solicitudes', /* R181 ingreso tardío */ TG: 'sala_telegram', TGTOK: 'sala_tg_tokens' /* R182 vínculo de Telegram */ };
const err = (status, msg) => Object.assign(new Error(msg), { status, publico: msg });

function publica(id, r, invs = {}, ahora = Date.now()) {
  const p = r.inicioMs ? S.partesHN(r.inicioMs) : { fecha: '', hora: '' };
  return {
    id, titulo: r.titulo || '', agenda: r.agenda || [], inicioMs: r.inicioMs || null, fecha: p.fecha, hora: p.hora, tz: S.TZ,
    duracionMin: r.duracionMin || 60, estado: S.estadoVigente(r, ahora), participantes: r.participantes || [],
    recordatorios: r.recordatorios || {}, salaAbierta: !!r.salaAbierta, version: r.version || 1, anfitrion: r.anfitrion || 'naara',
    invitaciones: invs, actualizadoAt: r.actualizadoAt || '', escenario: r.escenario || 'sala-c', presetId: r.presetId || '',
    tipo: r.tipo || 'junta', sugerido: r.sugerido || '', estiloUsado: r.estiloUsado || null,
  };
}
// R177 · copia del estilo del preset elegido (null si usa el oficial/base/sugerido)
async function fotoEstilo(db, escenario, presetId) {
  if (!presetId) return null;
  try { const d = await db.collection(C.ESC).doc(escenario).get(); const p = d.exists ? (d.data().presets || []).find((x) => x.id === presetId) : null; return p ? S.estiloEscenario(escenario, p.estilo) : null; } catch (_) { return null; }
}
async function invitacionesDe(db, ids) {
  const out = {};
  for (const id of ids) {
    out[id] = {};
    const s = await db.collection(C.I).where('reunionId', '==', id).get();
    s.docs.forEach((d) => { const x = d.data() || {}; out[id][x.usuario] = { estado: x.estado || 'pendiente', respondidoAt: x.respondidoAt || '', canal: x.canal || '' }; });
  }
  return out;
}
async function anularPendientes(db, reunionId, ahoraIso) {
  const out = [];
  for (const e of ['pendiente', 'sin_vinculo']) { const s = await db.collection(C.A).where('reunionId', '==', reunionId).where('estado', '==', e).get(); s.docs.forEach((d) => out.push({ ref: d.ref, data: { estado: 'anulado', anuladoAt: ahoraIso } })); }
  return out;
}
// R182 · estado de Telegram por usuario: 'listo' (vinculado y verificado por el bot, o fundadora con chat configurado
// en Vercel), 'pendiente' (generó enlace, falta /start), 'bloqueado' (bloqueó al bot), 'sin_vincular'.
const ENV_TG = { naara: ['TELEGRAM_CHAT_ID_SUBLICUENTAS', 'SUPER_ADMIN'], libni: ['TELEGRAM_CHAT_ID_RELOJES'], geisell: ['TELEGRAM_CHAT_ID_GEISELL', 'TELEGRAM_CHAT_ID_GEISSEL'] };
async function telegramDe(db, env, usuarios) {
  const out = {};
  for (const u of usuarios) {
    let d = null; try { const s = await db.collection(C.TG).doc(u).get(); d = s.exists ? s.data() : null; } catch (_) {}
    const porEnv = (ENV_TG[u] || []).some((k) => String(env[k] || '').trim());
    if (d && d.estado === 'listo') out[u] = { estado: 'listo', fuente: 'bot', verificadoAt: d.verificadoAt || '' };
    else if (d && d.estado === 'bloqueado') out[u] = { estado: 'bloqueado', fuente: 'bot', error: d.error || '' };
    else if (porEnv) out[u] = { estado: 'listo', fuente: 'vercel' };
    else out[u] = { estado: d ? (d.estado || 'pendiente') : 'sin_vincular', fuente: '' };
  }
  return out;
}
// R179 · quién puede estar en la Sala: las fundadoras (si Sublicuentas no les quitó el módulo) + todo usuario de Sublichat
// al que Sublicuentas le activó el módulo "Sala de Juntas" en Permisos. Naara siempre (anfitriona).
async function miembrosDe(db, env) {
  let config = {}; try { config = await P.leerConfig(db, { fresco: true }); } catch (_) { config = {}; } // R180: fresco = el retiro aplica al instante
  const out = [];
  for (const f of S.FUNDADORAS) if (f.anfitriona || (!f.cuentas.some((c) => P.esRetirado(config, { usuario: c })) && f.cuentas.every((c) => P.efectivos({ usuario: c, role: 'asesor' }, config)['sala-juntas'] === true))) out.push(f);
  const ya = new Set(S.FUNDADORAS.flatMap((f) => f.cuentas));
  for (const u of usuariosConfigurados(env)) {
    if (ya.has(u.usuario) || P.esSupervisor(u) || P.esRetirado(config, u)) continue;
    if (P.efectivos(u, config)['sala-juntas']) out.push(S.identidadInvitado(u.usuario, ETQ_ROL[P.rolDe(u)] || ''));
  }
  // usuarios con el módulo activado pero que no están en AUTH_USERS_JSON (ej.: creados aparte)
  for (const [u, v] of Object.entries(config.usuarios || {})) { const k = P.claveUsuario({ usuario: u }); if (!ya.has(k) && !out.some((x) => x.id === k) && !P.esRetirado(config, { usuario: k }) && v && v.modulos && v.modulos['sala-juntas'] === true && /^[a-z0-9._-]{2,40}$/.test(k)) out.push(S.identidadInvitado(k)); }
  return out;
}
// R180 · baja de un usuario en la Sala (la llama api/permisos.js → retirar). No toca reuniones pasadas ni actas (historial).
async function retirarDeSala(db, usuario, { borrarDatos = false, env = process.env, fetch: f = null } = {}) {
  const u = String(usuario || ''); const ahora = new Date().toISOString(); const out = { reuniones: 0, invitaciones: 0, avisos: 0, solicitudes: 0, telegram: false, personaje: false, expulsado: 0 };
  if (!u || u === 'naara') return out;
  const rs = await db.collection(C.R).where('participantes', 'array-contains', u).get();
  for (const d of rs.docs) {
    const r = d.data() || {}; const est = S.estadoVigente(r, Date.now());
    if (!['programada', 'borrador', 'en_curso'].includes(est)) continue; // finalizadas / canceladas: historial intacto
    await d.ref.set({ participantes: (r.participantes || []).filter((x) => x !== u), retiradosSala: [...new Set([...(r.retiradosSala || []), u])], actualizadoAt: ahora }, { merge: true }); out.reuniones++;
    const iRef = db.collection(C.I).doc(`${d.id}_${u}`); const is = await iRef.get(); if (is.exists) { await iRef.set({ estado: 'retirado', actualizadoAt: ahora }, { merge: true }); out.invitaciones++; }
    if (est === 'en_curso' && r.salaAbierta && env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET) { // si está dentro, sale ya
      try { await (f || fetch)(`${S.httpDeLiveKit(env.LIVEKIT_URL)}/twirp/livekit.RoomService/RemoveParticipant`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${S.tokenServidor({ apiKey: env.LIVEKIT_API_KEY, apiSecret: env.LIVEKIT_API_SECRET, sala: r.roomId || `sj_${d.id}` })}` }, body: JSON.stringify({ room: r.roomId || `sj_${d.id}`, identity: u }) }); out.expulsado++; } catch (_) {}
    }
  }
  const av = await db.collection(C.A).where('usuario', '==', u).get();
  for (const d of av.docs) if (['pendiente', 'enviando', 'sin_vinculo'].includes((d.data() || {}).estado)) { await d.ref.set({ estado: 'anulado', motivo: 'usuario_retirado', anuladoAt: ahora }, { merge: true }); out.avisos++; }
  const so = await db.collection(C.SOL).where('usuario', '==', u).get();
  for (const d of so.docs) if ((d.data() || {}).estado === 'pendiente') { await d.ref.set({ estado: 'cancelada', motivo: 'usuario_retirado', resueltaAt: ahora }, { merge: true }); out.solicitudes++; }
  const tg = db.collection(C.TG).doc(u); if ((await tg.get()).exists) { await tg.delete(); out.telegram = true; }
  const tk = await db.collection(C.TGTOK).where('usuario', '==', u).get(); for (const d of tk.docs) await d.ref.delete();
  if (borrarDatos) { const a = db.collection(C.AV).doc(u); if ((await a.get()).exists) { await a.delete(); out.personaje = true; } }
  const a = { tipo: 'sala_juntas', modulo: 'sala-juntas', accion: 'retirar_usuario_sala', actorUsuario: 'sublicuentas', objetivo: u, detalle: out, resultado: 'ok', createdAt: ahora };
  await db.collection(C.AUD).doc().set(a);
  return out;
}
// R169 · Personajes guardados de las 3 fundadoras (o el de base si aún no guardó el suyo).
async function avataresDe(db, miembros = S.FUNDADORAS) {
  const out = {};
  for (const f of miembros) {
    let d = null; try { const s = await db.collection(C.AV).doc(f.id).get(); d = s.exists ? s.data() : null; } catch (_) {}
    const base = S.AVATAR_BASE[f.id] || S.AVATAR_BASE.invitado;
    out[f.id] = d ? { config: S.limpiarAvatar(d.config, base), version: Number(d.version) || 1, miniatura: S.miniaturaValida(d.miniatura) && d.config && d.config.colorCalzado ? d.miniatura : '', /* R172: miniaturas del muñeco anterior ya no se muestran */ guardado: true, actualizadoAt: d.actualizadoAt || '' }
      : { config: { ...base, nombre: '' }, version: 0, miniatura: '', guardado: false };
  }
  return out;
}
function auditoria(db, yo, accion, objetivo, extra = {}) {
  return { ref: db.collection(C.AUD).doc(), data: { tipo: 'sala_juntas', modulo: 'sala-juntas', accion, actorUsuario: yo.id, objetivo, resultado: 'ok', createdAt: new Date().toISOString(), ...extra } };
}

async function handler(req, res, deps = {}) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Método no permitido.' }); }
  const auth = deps.auth || (() => { getApp(); return admin.auth(); });
  const dbOf = deps.db || (() => { getApp(); return admin.firestore(); });
  const env = deps.env || process.env;
  const ahora = deps.ahora ? deps.ahora() : Date.now();
  if (String(env.SALA_JUNTAS_ENABLED ?? '1') === '0') return res.status(503).json({ ok: false, error: 'La Sala de Juntas está apagada.' });

  const header = String(req.headers?.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return res.status(401).json({ ok: false, error: 'Sesión requerida.' });
  let user;
  try { user = await auth().verifyIdToken(token, true); } catch (_) { return res.status(401).json({ ok: false, error: 'Sesión inválida, vencida o dada de baja.' }); } // R180: rechaza sesiones revocadas
  let db; try { db = dbOf(); } catch (_) { return res.status(500).json({ ok: false, error: 'No se pudo conectar con la base de datos.' }); }
  // R179 · acceso = módulo "Sala de Juntas" en Permisos (fundadoras por defecto; Sublicuentas lo activa o quita a cualquiera)
  const miembros = await miembrosDe(db, env);
  const clave = S.claveUsuario(user);
  const yo = S.identidad(user) ? miembros.find((m) => m.id === S.identidad(user).id) || null : miembros.find((m) => m.id === clave) || null;
  if (!yo) return res.status(403).json({ ok: false, error: 'No tiene acceso a la Sala de Juntas. Sublicuentas lo activa en Permisos.' });
  const idsMiembros = miembros.map((m) => m.id);

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const accion = String(body.accion || 'panel');
  const iso = new Date(ahora).toISOString();

  const leerReunion = async (id, { paraEditar = false } = {}) => {
    const rid = String(id || '').trim(); if (!/^[A-Za-z0-9_-]{6,60}$/.test(rid)) throw err(400, 'Reunión no válida.');
    const s = await db.collection(C.R).doc(rid).get();
    if (!s.exists) throw err(404, 'Esa reunión no existe.');
    const r = s.data() || {};
    if (!(r.participantes || []).includes(yo.id)) throw err(403, 'No está invitada a esa reunión.');
    if (paraEditar && !S.puede.crear(yo)) throw err(403, 'Solo Naara puede crear, reprogramar o cancelar reuniones.');
    return { id: rid, r };
  };

  try {
    if (accion === 'panel') {
      const s = await db.collection(C.R).where('participantes', 'array-contains', yo.id).get();
      let docs = s.docs.map((d) => ({ id: d.id, r: d.data() || {} }));
      if (!S.puede.crear(yo)) docs = docs.filter((x) => x.r.estado !== 'borrador'); // los borradores son de Naara
      docs.sort((a, b) => (b.r.inicioMs || 0) - (a.r.inicioMs || 0));
      docs = docs.slice(0, 60);
      const invs = await invitacionesDe(db, docs.map((x) => x.id));
      const reuniones = docs.map((x) => publica(x.id, x.r, invs[x.id], ahora));
      if (S.puede.moderar(yo)) { // R168 · Naara ve qué avisos de Telegram salieron, cuáles faltan y cuáles fallaron
        for (const r of reuniones.filter((x) => ['programada', 'en_curso', 'cancelada'].includes(x.estado)).slice(0, 12)) {
          const a = await db.collection(C.A).where('reunionId', '==', r.id).get(); const res = { enviado: 0, pendiente: 0, fallido: 0, fallas: [] };
          res.porUsuario = {}; // R182 · estado de la convocatoria por persona (lo que respondió la API de Telegram)
          a.docs.forEach((d) => { const x = d.data() || {}; if ((x.tipo === 'invitacion' || x.tipo === 'cancelacion') && (Number(x.version || 1) === Number(r.version || 1) || x.tipo === 'cancelacion')) res.porUsuario[x.usuario] = { estado: x.estado, error: String(x.error || '').slice(0, 120), enviadoAt: x.enviadoAt || '' }; });
          a.docs.forEach((d) => { const x = d.data() || {}; if (x.estado === 'sin_vinculo' && Number(x.version || 1) === Number(r.version || 1)) { res.sinVinculo = (res.sinVinculo || 0) + 1; } });
          a.docs.forEach((d) => { const x = d.data() || {}; if (Number(x.version || 1) !== Number(r.version || 1) && x.tipo !== 'cancelacion') return;
            if (x.estado === 'enviado') res.enviado++; else if (x.estado === 'pendiente' || x.estado === 'enviando') res.pendiente++; else if (x.estado === 'fallido') { res.fallido++; res.fallas.push({ usuario: x.usuario, tipo: x.tipo, error: String(x.error || '').slice(0, 120) }); } });
          r.avisos = res;
        }
      }
      const d = new Date(ahora - 6 * 3600000), mesIni = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) + 6 * 3600000;
      const mesFin = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) + 6 * 3600000;
      const activas = reuniones.filter((x) => ['programada', 'en_curso'].includes(x.estado));
      const proxima = activas.filter((x) => x.estado === 'en_curso' || x.inicioMs >= ahora - (x.duracionMin + 30) * 60000).sort((a, b) => a.inicioMs - b.inicioMs)[0] || null;
      let acuerdosPendientes = 0;
      try { const a = await db.collection(C.ACTAS).where('participantes', 'array-contains', yo.id).get(); a.docs.forEach((x) => { (x.data().acuerdos || []).forEach((k) => { if (k && k.estado !== 'cumplido') acuerdosPendientes++; }); }); } catch (_) {}
      return res.status(200).json({
        ok: true, yo: { id: yo.id, nombre: yo.nombre, anfitriona: yo.anfitriona },
        permisos: { crear: S.puede.crear(yo), moderar: S.puede.moderar(yo) },
        fundadoras: miembros.map(({ id, nombre, cargo, anfitriona, asiento, invitado }) => ({ id, nombre, cargo, anfitriona, asiento, invitado: !!invitado })),
        avatares: await avataresDe(db, miembros), kpis: { reunionesMes: reuniones.filter((x) => x.inicioMs >= mesIni && x.inicioMs < mesFin && x.estado !== 'cancelada' && x.estado !== 'borrador').length, convocatoriasActivas: activas.length, acuerdosPendientes },
        proxima, reuniones, tiempoReal: !!(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET), ahora,
        telegram: S.puede.moderar(yo) ? await telegramDe(db, env, idsMiembros) : { [yo.id]: (await telegramDe(db, env, [yo.id]))[yo.id] }, botTelegram: !!String(env.TELEGRAM_BOT_USERNAME || '').trim(),
      });
    }

    // ---------- R174 · escenarios y presets de estilo ----------
    if (accion === 'escenarios') {
      if (!S.puede.ver(yo)) throw err(403, 'Sin acceso.');
      const docs = {}; for (const id of Object.keys(S.ESCENARIOS)) { const d = await db.collection(C.ESC).doc(id).get(); const x = d.exists ? d.data() : {}; docs[id] = { presets: x.presets || [], predeterminado: x.predeterminado || '', version: x.version || 0 }; }
      return res.status(200).json({ ok: true, escenarios: docs });
    }
    if (accion === 'preset_guardar' || accion === 'preset_borrar' || accion === 'preset_oficial') {
      if (!S.puede.ver(yo)) throw err(403, 'Sin acceso.');
      const esc = String(body.escenario || ''); if (!S.escenarioValido(esc)) throw err(400, 'Escenario no válido.');
      const ref = db.collection(C.ESC).doc(esc);
      const out = await db.runTransaction(async (tx) => {
        const d = await tx.get(ref); const x = d.exists ? d.data() : { presets: [], predeterminado: '', version: 0 };
        const presets = [...(x.presets || [])]; let pred = x.predeterminado || '';
        const pid = String(body.presetId || ''); const i = presets.findIndex((p) => p.id === pid);
        if (accion === 'preset_guardar') {
          const nombre = String(body.nombre || '').replace(/[ -]/g, '').trim().slice(0, 40);
          if (nombre.length < 2) throw err(400, 'Póngale un nombre al estilo (por ejemplo "Junta mensual").');
          const estilo = S.estiloEscenario(esc, body.estilo || {});
          if (i >= 0) {
            if (presets[i].creadoPor !== yo.id && !S.puede.moderar(yo)) throw err(403, 'Solo quien lo creó o la anfitriona pueden cambiar este estilo.');
            presets[i] = { ...presets[i], nombre, estilo, actualizadoAt: iso, actualizadoPor: yo.id };
          } else {
            if (presets.filter((p) => p.creadoPor === yo.id).length >= S.MAX_PRESETS) throw err(409, `Ya tiene ${S.MAX_PRESETS} estilos guardados en este escenario. Borre alguno.`);
            if (presets.some((p) => p.nombre.toLowerCase() === nombre.toLowerCase())) throw err(409, 'Ya hay un estilo con ese nombre.');
            presets.push({ id: require('crypto').randomBytes(5).toString('hex'), nombre, estilo, creadoPor: yo.id, creadoAt: iso, actualizadoAt: iso, actualizadoPor: yo.id });
          }
        } else if (accion === 'preset_borrar') {
          if (i < 0) throw err(404, 'Ese estilo ya no existe.');
          if (presets[i].creadoPor !== yo.id && !S.puede.moderar(yo)) throw err(403, 'Solo quien lo creó o la anfitriona pueden borrarlo.');
          presets.splice(i, 1); if (pred === pid) pred = '';
        } else {
          if (!S.puede.moderar(yo)) throw err(403, 'Solo la anfitriona aprueba el estilo oficial.');
          if (pid && i < 0) throw err(404, 'Ese estilo ya no existe.');
          pred = pid;
        }
        const nuevo = { presets, predeterminado: pred, version: (x.version || 0) + 1, actualizadoAt: iso, actualizadoPor: yo.id };
        tx.set(ref, nuevo); const a = auditoria(db, yo, accion, esc, { preset: pid || (presets[presets.length - 1] || {}).id || '' }); tx.set(a.ref, a.data);
        return nuevo;
      });
      return res.status(200).json({ ok: true, escenario: esc, ...out });
    }

    if (accion === 'crear' || accion === 'editar') {
      if (!S.puede.crear(yo)) throw err(403, 'Solo Naara puede crear, reprogramar o cancelar reuniones.');
      const borrador = body.borrador === true;
      const v = S.validarConvocatoria(body, { programar: !borrador, ahora, miembros: idsMiembros });
      if (!v.ok) return res.status(400).json({ ok: false, error: v.errores[0], errores: v.errores });
      const editar = accion === 'editar';
      const prev = editar ? await leerReunion(body.id, { paraEditar: true }) : null;
      if (prev && ['cancelada', 'finalizada'].includes(S.estadoVigente(prev.r, ahora))) throw err(409, 'Esa reunión ya terminó o fue cancelada.');
      const ref = prev ? db.collection(C.R).doc(prev.id) : db.collection(C.R).doc();
      const version = prev ? (Number(prev.r.version) || 1) + 1 : 1;
      const cambioHora = prev && prev.r.inicioMs !== v.datos.inicioMs;
      const escrituras = [];
      if (prev) escrituras.push(...await anularPendientes(db, prev.id, iso));
      const r = {
        titulo: v.datos.titulo, agenda: v.datos.agenda, inicioMs: v.datos.inicioMs, inicioISO: v.datos.inicioMs ? new Date(v.datos.inicioMs).toISOString() : '',
        tz: S.TZ, duracionMin: v.datos.duracionMin, participantes: v.datos.participantes, recordatorios: v.datos.recordatorios, escenario: v.datos.escenario, presetId: v.datos.presetId, tipo: v.datos.tipo, sugerido: v.datos.sugerido,
        estiloUsado: await fotoEstilo(db, v.datos.escenario, v.datos.presetId), // R177: copia del estilo para reabrir igual aunque el preset cambie
        estado: borrador ? 'borrador' : 'programada', anfitrion: 'naara', salaAbierta: false, roomId: prev?.r.roomId || S.roomIdOpaco(),
        version, actualizadoAt: iso, actualizadoPor: yo.id, ...(prev ? {} : { creadoAt: iso, creadoPor: yo.id }),
      };
      escrituras.push({ ref, data: r, merge: true });
      let sinVinculo = [];
      if (!borrador) {
        for (const u of v.datos.participantes) {
          const invRef = db.collection(C.I).doc(`${ref.id}_${u}`);
          const anterior = prev ? (await invRef.get()) : null;
          const conservar = anterior && anterior.exists && !cambioHora ? anterior.data() : null;
          escrituras.push({ ref: invRef, data: { reunionId: ref.id, usuario: u, estado: u === 'naara' ? 'aceptada' : (conservar?.estado || 'pendiente'), respondidoAt: conservar?.respondidoAt || (u === 'naara' ? iso : ''), canal: conservar?.canal || '', version, actualizadoAt: iso } });
        }
        // R182 · Telegram para TODOS los invitados. Quien no tiene Telegram vinculado queda "sin_vinculo" (el bot no lo toma);
        // al vincularse, el bot reactiva sus avisos. Nunca se marca "enviado" sin respuesta real de la API de Telegram.
        const tg = await telegramDe(db, env, v.datos.participantes); sinVinculo = v.datos.participantes.filter((u) => u !== 'naara' && tg[u].estado !== 'listo');
        for (const a of S.planAvisos(ref.id, v.datos, version, ahora)) {
          if (a.usuario === 'naara' && a.tipo === 'invitacion') continue; // la anfitriona no se invita a sí misma
          escrituras.push({ ref: db.collection(C.A).doc(a.id), data: { reunionId: ref.id, usuario: a.usuario, tipo: a.tipo, version, programadoMs: a.programadoMs, estado: tg[a.usuario].estado === 'listo' ? 'pendiente' : 'sin_vinculo', intentos: 0, creadoAt: iso, reprogramada: !!prev } });
        }
      }
      escrituras.push(auditoria(db, yo, borrador ? 'guardar_borrador' : (prev ? 'reprogramar' : 'programar'), ref.id, { titulo: r.titulo, inicioISO: r.inicioISO, version }));
      const b = db.batch(); escrituras.forEach((w) => (w.merge ? b.set(w.ref, w.data, { merge: true }) : b.set(w.ref, w.data, { merge: true }))); await b.commit();
      return res.status(200).json({ ok: true, id: ref.id, estado: r.estado, version, envioIncompleto: sinVinculo });
    }

    if (accion === 'cancelar') {
      const { id, r } = await leerReunion(body.id, { paraEditar: true });
      if (['cancelada', 'finalizada'].includes(S.estadoVigente(r, ahora))) throw err(409, 'Esa reunión ya terminó o fue cancelada.');
      const escrituras = await anularPendientes(db, id, iso);
      escrituras.push({ ref: db.collection(C.R).doc(id), data: { estado: 'cancelada', salaAbierta: false, canceladaAt: iso, motivoCancelacion: String(body.motivo || '').slice(0, 200), actualizadoAt: iso } });
      if (r.estado !== 'borrador') for (const u of (r.participantes || []).filter((x) => x !== 'naara')) { // R182: también invitados (si no tienen Telegram queda sin_vinculo)
        escrituras.push({ ref: db.collection(C.A).doc(`${id}_${u}_cancelacion`), data: { reunionId: id, usuario: u, tipo: 'cancelacion', version: r.version || 1, programadoMs: ahora, estado: 'pendiente', intentos: 0, creadoAt: iso } });
      }
      escrituras.push(auditoria(db, yo, 'cancelar', id, { titulo: r.titulo }));
      const b = db.batch(); escrituras.forEach((w) => b.set(w.ref, w.data, { merge: true })); await b.commit();
      return res.status(200).json({ ok: true, id, estado: 'cancelada' });
    }

    if (accion === 'rsvp') {
      const { id, r } = await leerReunion(body.id);
      const resp = String(body.respuesta || '');
      if (!['aceptada', 'rechazada'].includes(resp)) throw err(400, 'Respuesta no válida.');
      if (!['programada', 'en_curso'].includes(S.estadoVigente(r, ahora))) throw err(409, 'Esa reunión ya no recibe confirmaciones.');
      const ref = db.collection(C.I).doc(`${id}_${yo.id}`); // solo SU invitación
      const b = db.batch();
      const canal = body.origen === 'android' ? 'android' : 'web'; // R189 · la APK responde por el mismo servidor
      b.set(ref, { reunionId: id, usuario: yo.id, estado: resp, respondidoAt: iso, canal, actualizadoAt: iso }, { merge: true });
      const a = auditoria(db, yo, 'rsvp', id, { respuesta: resp, canal }); b.set(a.ref, a.data);
      await b.commit();
      return res.status(200).json({ ok: true, id, estado: resp });
    }

    if (accion === 'abrir_sala' || accion === 'cerrar_sala') {
      const { id, r } = await leerReunion(body.id);
      if (!S.puede.moderar(yo)) throw err(403, 'Solo la anfitriona abre o cierra la sala.');
      const abrir = accion === 'abrir_sala';
      if (abrir && !['programada', 'en_curso'].includes(S.estadoVigente(r, ahora))) throw err(409, 'Esa reunión no se puede abrir.');
      const b = db.batch();
      b.set(db.collection(C.R).doc(id), abrir ? { salaAbierta: true, estado: 'en_curso', abiertaAt: iso, actualizadoAt: iso } : { salaAbierta: false, estado: 'finalizada', cerradaAt: iso, actualizadoAt: iso }, { merge: true });
      const a = auditoria(db, yo, accion, id); b.set(a.ref, a.data);
      await b.commit();
      if (!abrir && env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET) { // cerrar = termina la llamada para todas
        const sala = r.roomId || `sj_${id}`;
        try { await (deps.fetch || fetch)(`${S.httpDeLiveKit(env.LIVEKIT_URL)}/twirp/livekit.RoomService/DeleteRoom`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${S.tokenServidor({ apiKey: env.LIVEKIT_API_KEY, apiSecret: env.LIVEKIT_API_SECRET, sala, ahora })}` }, body: JSON.stringify({ room: sala }) }); } catch (_) {}
      }
      return res.status(200).json({ ok: true, id, salaAbierta: abrir });
    }

    // ---------- R173 · acta y acuerdos ----------
    async function datosActa(id, r) {
      const aud = await db.collection(C.AUD).where('objetivo', '==', id).get();
      const asistentes = [...new Set(aud.docs.map((d) => d.data()).filter((x) => x.accion === 'entrar_sala').map((x) => x.actorUsuario))].filter((u) => (r.participantes || []).includes(u));
      const ini = Date.parse(r.abiertaAt || '') || 0, fin = Date.parse(r.cerradaAt || '') || 0;
      const grab = aud.docs.map((d) => d.data()).filter((x) => x.accion === 'grabacion_fin');
      return { asistentes, duracionMin: ini && fin && fin > ini ? Math.round((fin - ini) / 60000) : null, grabada: grab.length > 0, grabacionSeg: grab.reduce((t, x) => t + (x.duracionSeg || 0), 0) };
    }
    if (accion === 'grabacion') { // R175 · solo registro: el archivo queda en el equipo de la anfitriona, no se sube
      if (!S.puede.moderar(yo)) throw err(403, 'Solo la anfitriona puede grabar.');
      const { id } = await leerReunion(body.id);
      const estado = body.estado === 'fin' ? 'fin' : 'inicio';
      const a = auditoria(db, yo, 'grabacion_' + estado, id, estado === 'fin' ? { duracionSeg: Math.max(0, Math.min(6 * 3600, Math.round(Number(body.duracionSeg) || 0))) } : {});
      await a.ref.set(a.data); return res.status(200).json({ ok: true });
    }
    if (accion === 'acta') {
      const { id, r } = await leerReunion(body.id);
      if (!(r.participantes || []).includes(yo.id) && !S.puede.moderar(yo)) throw err(403, 'No participó en esa reunión.');
      const d = await db.collection(C.ACTAS).doc(id).get();
      return res.status(200).json({ ok: true, acta: d.exists ? d.data() : null, ...(await datosActa(id, r)), reunion: { id, titulo: r.titulo, inicioMs: r.inicioMs, participantes: r.participantes, estado: S.estadoVigente(r, ahora) } });
    }
    if (accion === 'acta_guardar') {
      if (!S.puede.moderar(yo)) throw err(403, 'Solo la anfitriona redacta el acta.');
      const { id, r } = await leerReunion(body.id);
      if (!['finalizada', 'en_curso'].includes(S.estadoVigente(r, ahora))) throw err(409, 'El acta se escribe cuando la reunión ya empezó o terminó.');
      const v = S.validarActa(body, r.participantes || []);
      const extra = await datosActa(id, r);
      const ref = db.collection(C.ACTAS).doc(id);
      const out = await db.runTransaction(async (tx) => {
        const d = await tx.get(ref); const prev = d.exists ? d.data() : null;
        const ver = prev ? Number(prev.version || 1) : 0;
        if (prev && Number(body.version) !== ver) throw err(409, 'Alguien cambió el acta mientras la editaba. Vuelva a abrirla.');
        const doc = { reunionId: id, titulo: r.titulo, inicioMs: r.inicioMs, participantes: r.participantes, ...extra, ...v, version: ver + 1, creadoPor: prev ? prev.creadoPor : yo.id, creadoAt: prev ? prev.creadoAt : iso, actualizadoPor: yo.id, actualizadoAt: iso };
        tx.set(ref, doc); const a = auditoria(db, yo, prev ? 'acta_editar' : 'acta_crear', id, { acuerdos: v.acuerdos.length }); tx.set(a.ref, a.data);
        return doc;
      });
      return res.status(200).json({ ok: true, acta: out });
    }
    if (accion === 'acuerdo_estado') { // la responsable o la anfitriona marcan un acuerdo como cumplido
      const { id, r } = await leerReunion(body.id);
      const ref = db.collection(C.ACTAS).doc(id); const kid = String(body.acuerdo || ''); const estado = body.estado === 'cumplido' ? 'cumplido' : 'pendiente';
      const out = await db.runTransaction(async (tx) => {
        const d = await tx.get(ref); if (!d.exists) throw err(404, 'Esa reunión no tiene acta.');
        const acta = d.data(); const k = (acta.acuerdos || []).find((x) => x.id === kid); if (!k) throw err(404, 'Acuerdo no encontrado.');
        if (k.responsable !== yo.id && !S.puede.moderar(yo)) throw err(403, 'Solo la responsable o la anfitriona pueden marcarlo.');
        k.estado = estado; k.cambiadoPor = yo.id; k.cambiadoAt = iso;
        tx.set(ref, { acuerdos: acta.acuerdos, actualizadoAt: iso }, { merge: true }); const a = auditoria(db, yo, 'acuerdo_' + estado, id, { acuerdo: kid }); tx.set(a.ref, a.data);
        return acta.acuerdos;
      });
      void r; return res.status(200).json({ ok: true, acuerdos: out });
    }
    if (accion === 'actas') {
      const q = S.puede.moderar(yo) ? db.collection(C.ACTAS) : db.collection(C.ACTAS).where('participantes', 'array-contains', yo.id);
      const l = (await q.get()).docs.map((d) => { const x = d.data(); return { reunionId: x.reunionId, titulo: x.titulo, inicioMs: x.inicioMs, acuerdos: (x.acuerdos || []).length, pendientes: (x.acuerdos || []).filter((k) => k.estado !== 'cumplido').length, misPendientes: (x.acuerdos || []).filter((k) => k.estado !== 'cumplido' && k.responsable === yo.id).length }; });
      return res.status(200).json({ ok: true, actas: l });
    }

    if (accion === 'antesala') {
      const { id, r } = await leerReunion(body.id);
      const estado = S.estadoVigente(r, ahora);
      if (['cancelada', 'borrador'].includes(estado)) throw err(409, estado === 'cancelada' ? 'Esta reunión fue cancelada.' : 'Esta reunión todavía es un borrador.');
      const invs = (await invitacionesDe(db, [id]))[id];
      return res.status(200).json({ ok: true, reunion: publica(id, r, invs, ahora), yo: { id: yo.id, nombre: yo.nombre }, tiempoReal: !!(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET) });
    }

    if (accion === 'avatares') return res.status(200).json({ ok: true, avatares: await avataresDe(db, miembros), opciones: S.AVATAR_OPC });

    if (accion === 'avatar_guardar') { // cada fundadora SOLO guarda el suyo; control de versión para no pisar otro dispositivo
      const cfg = S.limpiarAvatar(body.config, S.AVATAR_BASE[yo.id] || S.AVATAR_BASE.invitado);
      const mini = S.miniaturaValida(body.miniatura) ? body.miniatura : '';
      const ref = db.collection(C.AV).doc(yo.id);
      let nueva = 0, conflicto = false;
      await db.runTransaction(async (tx) => {
        const s = await tx.get(ref); const actual = s.exists ? Number(s.data().version) || 1 : 0;
        if (body.version != null && Number(body.version) !== actual) { conflicto = true; return; }
        nueva = actual + 1;
        tx.set(ref, { usuario: yo.id, modelRef: 'glb:quaternius-modular:20261105-r172', config: cfg, miniatura: mini, version: nueva, actualizadoAt: iso }, { merge: false });
        const a = auditoria(db, yo, 'avatar_guardar', yo.id, { version: nueva }); tx.set(a.ref, a.data);
      });
      if (conflicto) return res.status(409).json({ ok: false, error: 'Su personaje se cambió desde otro dispositivo. Recargue para ver la versión más reciente.' });
      return res.status(200).json({ ok: true, config: cfg, version: nueva });
    }

    if (accion === 'token_tiempo_real') { // R170 · entrar a la sala con audio (LiveKit)
      if (!(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET)) throw err(503, 'Falta configurar el audio en tiempo real (LiveKit).');
      const { id, r } = await leerReunion(body.id);
      const estado = S.estadoVigente(r, ahora);
      if (!['programada', 'en_curso'].includes(estado)) throw err(409, estado === 'cancelada' ? 'Esta reunión fue cancelada.' : 'Esta reunión ya terminó.');
      const v = S.ventanaSala(r);
      if (ahora < v.desde) throw err(409, 'La sala se puede abrir desde 30 minutos antes de la hora de inicio.');
      if (ahora > v.hasta) throw err(409, 'Se pasó el tiempo de esta reunión.');
      const inv = await db.collection(C.I).doc(`${id}_${yo.id}`).get();
      if (!inv.exists) throw err(403, 'No está invitada a esa reunión.');
      const solRef = db.collection(C.SOL).doc(`${id}_${yo.id}`);
      if (!r.salaAbierta) {
        if (!S.puede.moderar(yo)) { // R181 · quien espera ANTES de la hora queda registrado como "a tiempo"
          if (ahora < Number(r.inicioMs || 0)) { const x = (await solRef.get()).data(); if (!x || x.estado !== 'a_tiempo') await solRef.set({ reunionId: id, usuario: yo.id, estado: 'a_tiempo', esperaAt: iso, actualizadoAt: iso }, { merge: true }); }
          throw err(409, 'Esperando que la anfitriona abra la sala.');
        }
        await db.collection(C.R).doc(id).set({ salaAbierta: true, estado: 'en_curso', abiertaAt: iso, actualizadoAt: iso }, { merge: true }); // Naara entra = abre
        r.abiertaAt = iso; r.salaAbierta = true;
      }
      // R181 · ADMISIÓN TARDÍA: si la reunión ya empezó (sala abierta y pasó la hora), nadie más que la anfitriona entra
      // sin aprobación. No se entrega token de LiveKit hasta que Sublicuentas acepte. La aprobación vale para ESTA sesión.
      const sesion = r.abiertaAt || '';
      if (!S.puede.moderar(yo)) {
        const x = (await solRef.get()).data() || null;
        const aTiempo = x && x.estado === 'a_tiempo' && Date.parse(x.esperaAt || '') < Number(r.inicioMs || 0);
        const admitido = x && x.estado === 'aprobada' && x.sesion === sesion;
        const iniciada = ahora >= Number(r.inicioMs || 0);
        if (iniciada && !admitido && !aTiempo) {
          const vigente = x && x.estado === 'pendiente' && Number(x.expiraMs || 0) > ahora;
          return res.status(200).json({ ok: true, espera: true, solicitud: x ? { estado: vigente ? 'pendiente' : (x.estado === 'pendiente' ? 'vencida' : x.estado), requestId: x.requestId || '', expiraMs: x.expiraMs || 0, motivo: x.motivo || '' } : null });
        }
        if (!admitido) await solRef.set({ reunionId: id, usuario: yo.id, estado: 'aprobada', motivo: aTiempo || !iniciada ? 'a_tiempo' : 'aprobada', sesion, resueltaAt: iso, actualizadoAt: iso }, { merge: true }); // reconexión breve en la misma sesión
      }
      const sala = r.roomId || `sj_${id}`;
      const ttlSeg = Math.min(S.puede.moderar(yo) ? 2 * 3600 : 3600, Math.floor((v.hasta - ahora) / 1000)); // R181: invitados, credencial corta
      const token = S.tokenParticipante({ apiKey: env.LIVEKIT_API_KEY, apiSecret: env.LIVEKIT_API_SECRET, identidad: yo.id, nombre: yo.nombre, sala, ttlSeg, anfitriona: S.puede.moderar(yo), ahora });
      const a = auditoria(db, yo, 'entrar_sala', id); await a.ref.set(a.data);
      return res.status(200).json({ ok: true, url: String(env.LIVEKIT_URL).trim(), token, identidad: yo.id, expiraMs: ahora + ttlSeg * 1000 });
    }

    // ---------- R182 · vincular Telegram (enlace de un solo uso al bot existente de Render) ----------
    if (accion === 'telegram_vincular') {
      const bot = String(env.TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, '');
      if (!/^[A-Za-z0-9_]{5,40}$/.test(bot)) throw err(503, 'Falta configurar TELEGRAM_BOT_USERNAME (nombre del bot de Sublicuentas) en Vercel.');
      const token = require('crypto').randomBytes(18).toString('base64url');
      const viejos = await db.collection(C.TGTOK).where('usuario', '==', yo.id).get(); for (const d of viejos.docs) await d.ref.delete(); // un enlace vivo por persona
      await db.collection(C.TGTOK).doc(token).set({ usuario: yo.id, expiraMs: ahora + 15 * 60000, creadoAt: iso, usado: false });
      const ref = db.collection(C.TG).doc(yo.id); const prev = (await ref.get()).data();
      if (!prev || prev.estado !== 'listo') await ref.set({ usuario: yo.id, estado: 'pendiente', solicitadoAt: iso }, { merge: true });
      const a = auditoria(db, yo, 'telegram_enlace', yo.id); await a.ref.set(a.data);
      return res.status(200).json({ ok: true, url: `https://t.me/${bot}?start=sj_${token}`, expiraMs: ahora + 15 * 60000 });
    }
    if (accion === 'telegram_estado') return res.status(200).json({ ok: true, telegram: (await telegramDe(db, env, [yo.id]))[yo.id] });
    if (accion === 'telegram_desvincular') {
      await db.collection(C.TG).doc(yo.id).delete(); const a = auditoria(db, yo, 'telegram_desvincular', yo.id); await a.ref.set(a.data);
      return res.status(200).json({ ok: true });
    }
    if (accion === 'reintentar_avisos') { // Naara: reactiva los avisos "sin_vinculo" de quienes ya vincularon su Telegram
      if (!S.puede.moderar(yo)) throw err(403, 'Solo la anfitriona.');
      const { id, r } = await leerReunion(body.id);
      const q = await db.collection(C.A).where('reunionId', '==', id).where('estado', '==', 'sin_vinculo').get();
      const tg = await telegramDe(db, env, [...new Set(q.docs.map((d) => d.data().usuario))]); let n = 0, faltan = new Set();
      for (const d of q.docs) { const x = d.data(); if (tg[x.usuario]?.estado === 'listo') { await d.ref.set({ estado: 'pendiente', ...(x.tipo === 'invitacion' || x.tipo === 'cancelacion' ? { programadoMs: Math.max(Number(x.programadoMs || 0), ahora) } : {}), reactivadoAt: iso }, { merge: true }); n++; /* recordatorios conservan su hora (el bot vence los viejos) */ } else faltan.add(x.usuario); }
      return res.status(200).json({ ok: true, reactivados: n, faltan: [...faltan], version: r.version || 1 });
    }

    // ---------- R181 · solicitudes de ingreso tardío ----------
    const SOL_VENCE_MS = 2 * 60000;
    if (accion === 'solicitar_ingreso') {
      if (S.puede.moderar(yo)) throw err(400, 'La anfitriona entra directo.');
      const { id, r } = await leerReunion(body.id);
      if (S.estadoVigente(r, ahora) !== 'en_curso' || !r.salaAbierta) throw err(409, 'La reunión no está en curso.');
      const inv = await db.collection(C.I).doc(`${id}_${yo.id}`).get(); if (!inv.exists || (inv.data() || {}).estado === 'retirado') throw err(403, 'No está invitada a esa reunión.');
      const ref = db.collection(C.SOL).doc(`${id}_${yo.id}`);
      const out = await db.runTransaction(async (tx) => {
        const d = await tx.get(ref); const x = d.exists ? d.data() : null;
        if (x && x.estado === 'pendiente' && Number(x.expiraMs || 0) > ahora) return { ...x, nueva: false }; // recargas: no duplica
        if (x && x.estado === 'expulsado' && x.sesion === r.abiertaAt) throw err(403, 'La anfitriona lo sacó de esta reunión.');
        const sol = { reunionId: id, usuario: yo.id, nombre: yo.nombre, estado: 'pendiente', requestId: require('crypto').randomBytes(9).toString('base64url'), creadaMs: ahora, expiraMs: ahora + SOL_VENCE_MS, sesion: r.abiertaAt || '', actualizadoAt: iso };
        tx.set(ref, sol);
        tx.set(db.collection(C.A).doc(`${id}_naara_solicitud_${sol.requestId}`), { reunionId: id, usuario: 'naara', tipo: 'solicitud', solicitante: yo.id, solicitanteNombre: yo.nombre, requestId: sol.requestId, version: r.version || 1, programadoMs: ahora, estado: 'pendiente', intentos: 0, creadoAt: iso });
        return { ...sol, nueva: true };
      });
      if (out.nueva) { const a = auditoria(db, yo, 'solicitar_ingreso', id, { requestId: out.requestId }); await a.ref.set(a.data); }
      return res.status(200).json({ ok: true, solicitud: { estado: 'pendiente', requestId: out.requestId, expiraMs: out.expiraMs } });
    }
    if (accion === 'solicitud_estado') {
      const { id } = await leerReunion(body.id);
      const x = (await db.collection(C.SOL).doc(`${id}_${yo.id}`).get()).data() || null;
      if (!x || (body.requestId && x.requestId && x.requestId !== body.requestId && x.estado === 'pendiente')) return res.status(200).json({ ok: true, solicitud: null });
      const estado = x.estado === 'pendiente' && Number(x.expiraMs || 0) <= ahora ? 'vencida' : x.estado;
      return res.status(200).json({ ok: true, solicitud: { estado, requestId: x.requestId || '', expiraMs: x.expiraMs || 0 } });
    }
    if (accion === 'solicitudes') { // panel de la anfitriona: solicitudes vigentes de una reunión
      if (!S.puede.moderar(yo)) throw err(403, 'Solo Sublicuentas ve las solicitudes de ingreso.');
      const { id } = await leerReunion(body.id);
      const q = await db.collection(C.SOL).where('reunionId', '==', id).get();
      const lista = q.docs.map((d) => d.data() || {}).filter((x) => x.estado === 'pendiente' && Number(x.expiraMs || 0) > ahora).map((x) => ({ usuario: x.usuario, nombre: x.nombre || x.usuario, requestId: x.requestId, expiraMs: x.expiraMs, creadaMs: x.creadaMs }));
      return res.status(200).json({ ok: true, solicitudes: lista });
    }
    if (accion === 'resolver_solicitud') { // EXCLUSIVO de Sublicuentas / Naara (anfitriona); validado aquí, no en la pantalla
      if (!S.puede.moderar(yo) || yo.id !== 'naara') throw err(403, 'Solo Sublicuentas puede aceptar o rechazar el ingreso.');
      const { id, r } = await leerReunion(body.id);
      const quien = String(body.usuario || ''); const aprobar = body.aprobar === true;
      const ref = db.collection(C.SOL).doc(`${id}_${quien}`);
      const res2 = await db.runTransaction(async (tx) => {
        const d = await tx.get(ref); const x = d.exists ? d.data() : null;
        if (!x || x.estado !== 'pendiente' || x.requestId !== String(body.requestId || '')) return 'no_existe';
        if (Number(x.expiraMs || 0) <= ahora) { tx.set(ref, { estado: 'vencida', actualizadoAt: iso }, { merge: true }); return 'vencida'; }
        tx.set(ref, { estado: aprobar ? 'aprobada' : 'rechazada', sesion: r.abiertaAt || '', resueltaPor: yo.id, resueltaAt: iso, actualizadoAt: iso }, { merge: true });
        return 'ok';
      });
      if (res2 === 'no_existe') throw err(409, 'Esa solicitud ya no está pendiente.');
      if (res2 === 'vencida') throw err(409, 'La solicitud venció (2 minutos). La persona debe pedir de nuevo.');
      const a = auditoria(db, yo, aprobar ? 'aprobar_ingreso' : 'rechazar_ingreso', id, { usuario: quien, requestId: String(body.requestId) }); await a.ref.set(a.data);
      return res.status(200).json({ ok: true, estado: aprobar ? 'aprobada' : 'rechazada' });
    }

    if (accion === 'expulsar') { // solo la anfitriona; lo hace el servidor con la API de LiveKit
      if (!S.puede.moderar(yo)) throw err(403, 'Solo la anfitriona puede sacar a alguien de la sala.');
      const { id, r } = await leerReunion(body.id);
      const quien = String(body.usuario || '');
      if (!(r.participantes || []).includes(quien) || quien === yo.id) throw err(400, 'Participante no válido.');
      if (!(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET)) throw err(503, 'Falta configurar LiveKit.');
      const sala = r.roomId || `sj_${id}`;
      const f = deps.fetch || fetch;
      const resp = await f(`${S.httpDeLiveKit(env.LIVEKIT_URL)}/twirp/livekit.RoomService/RemoveParticipant`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${S.tokenServidor({ apiKey: env.LIVEKIT_API_KEY, apiSecret: env.LIVEKIT_API_SECRET, sala, ahora })}` }, body: JSON.stringify({ room: sala, identity: quien }) });
      if (!resp.ok && resp.status !== 404) throw err(502, 'LiveKit no pudo sacar a esa persona. Intente de nuevo.');
      await db.collection(C.SOL).doc(`${id}_${quien}`).set({ reunionId: id, usuario: quien, estado: 'expulsado', sesion: r.abiertaAt || '', resueltaPor: yo.id, resueltaAt: iso, actualizadoAt: iso }, { merge: true }); // R181: no vuelve a entrar sin nueva aprobación
      const a = auditoria(db, yo, 'expulsar', id, { usuario: quien }); await a.ref.set(a.data);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: 'Acción no reconocida.' });
  } catch (e) {
    if (e.publico) return res.status(e.status || 400).json({ ok: false, error: e.publico });
    console.error('SALA_JUNTAS_ERROR', e?.message || e);
    return res.status(500).json({ ok: false, error: 'No se pudo completar la acción.' });
  }
}

module.exports = handler;
module.exports.handler = handler;
module.exports.retirarDeSala = retirarDeSala;
