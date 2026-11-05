// api/sala-juntas.js · R167 — SubliStudio 3D · Sala de Juntas (Fase 1: panel, convocatorias, antesala).
// POST { accion, ... } con el Bearer de Sublichat. TODA autorización se repite aquí (no basta esconder botones):
//   · solo Naara / Libni / Geisell (por identidad del token, ver _sala-juntas.js) · crear/editar/cancelar/abrir: solo Naara
//   · cada fundadora solo ve las reuniones donde está invitada y solo responde SU invitación.
// Firestore (colecciones nuevas): sala_reuniones, sala_invitaciones, sala_avisos · auditoría en auditoria_eventos.
// Los avisos quedan "pendiente": los envía el bot (Fase 2). El token de tiempo real (LiveKit) es Fase 4.
'use strict';
const admin = require('firebase-admin');
const S = require('./_sala-juntas.js');

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID, clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Faltan credenciales Firebase.');
  return admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}
const C = { R: 'sala_reuniones', I: 'sala_invitaciones', A: 'sala_avisos', ACTAS: 'sala_actas', AV: 'sala_avatares', AUD: 'auditoria_eventos' };
const err = (status, msg) => Object.assign(new Error(msg), { status, publico: msg });

function publica(id, r, invs = {}, ahora = Date.now()) {
  const p = r.inicioMs ? S.partesHN(r.inicioMs) : { fecha: '', hora: '' };
  return {
    id, titulo: r.titulo || '', agenda: r.agenda || [], inicioMs: r.inicioMs || null, fecha: p.fecha, hora: p.hora, tz: S.TZ,
    duracionMin: r.duracionMin || 60, estado: S.estadoVigente(r, ahora), participantes: r.participantes || [],
    recordatorios: r.recordatorios || {}, salaAbierta: !!r.salaAbierta, version: r.version || 1, anfitrion: r.anfitrion || 'naara',
    invitaciones: invs, actualizadoAt: r.actualizadoAt || '',
  };
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
  const s = await db.collection(C.A).where('reunionId', '==', reunionId).where('estado', '==', 'pendiente').get();
  return s.docs.map((d) => ({ ref: d.ref, data: { estado: 'anulado', anuladoAt: ahoraIso } }));
}
// R169 · Personajes guardados de las 3 fundadoras (o el de base si aún no guardó el suyo).
async function avataresDe(db) {
  const out = {};
  for (const f of S.FUNDADORAS) {
    let d = null; try { const s = await db.collection(C.AV).doc(f.id).get(); d = s.exists ? s.data() : null; } catch (_) {}
    out[f.id] = d ? { config: S.limpiarAvatar(d.config, S.AVATAR_BASE[f.id]), version: Number(d.version) || 1, miniatura: S.miniaturaValida(d.miniatura) && d.config && d.config.colorCalzado ? d.miniatura : '', /* R172: miniaturas del muñeco anterior ya no se muestran */ guardado: true, actualizadoAt: d.actualizadoAt || '' }
      : { config: { ...S.AVATAR_BASE[f.id] }, version: 0, miniatura: '', guardado: false };
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
  try { user = await auth().verifyIdToken(token); } catch (_) { return res.status(401).json({ ok: false, error: 'Sesión inválida o vencida.' }); }
  const yo = S.identidad(user);
  if (!yo) return res.status(403).json({ ok: false, error: 'La Sala de Juntas es solo para las socias fundadoras.' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const accion = String(body.accion || 'panel');
  let db; try { db = dbOf(); } catch (_) { return res.status(500).json({ ok: false, error: 'No se pudo conectar con la base de datos.' }); }
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
        fundadoras: S.FUNDADORAS.map(({ id, nombre, cargo, anfitriona, asiento }) => ({ id, nombre, cargo, anfitriona, asiento })),
        avatares: await avataresDe(db), kpis: { reunionesMes: reuniones.filter((x) => x.inicioMs >= mesIni && x.inicioMs < mesFin && x.estado !== 'cancelada' && x.estado !== 'borrador').length, convocatoriasActivas: activas.length, acuerdosPendientes },
        proxima, reuniones, tiempoReal: !!(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET), ahora,
      });
    }

    if (accion === 'crear' || accion === 'editar') {
      if (!S.puede.crear(yo)) throw err(403, 'Solo Naara puede crear, reprogramar o cancelar reuniones.');
      const borrador = body.borrador === true;
      const v = S.validarConvocatoria(body, { programar: !borrador, ahora });
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
        tz: S.TZ, duracionMin: v.datos.duracionMin, participantes: v.datos.participantes, recordatorios: v.datos.recordatorios,
        estado: borrador ? 'borrador' : 'programada', anfitrion: 'naara', salaAbierta: false, roomId: prev?.r.roomId || S.roomIdOpaco(),
        version, actualizadoAt: iso, actualizadoPor: yo.id, ...(prev ? {} : { creadoAt: iso, creadoPor: yo.id }),
      };
      escrituras.push({ ref, data: r, merge: true });
      if (!borrador) {
        for (const u of v.datos.participantes) {
          const invRef = db.collection(C.I).doc(`${ref.id}_${u}`);
          const anterior = prev ? (await invRef.get()) : null;
          const conservar = anterior && anterior.exists && !cambioHora ? anterior.data() : null;
          escrituras.push({ ref: invRef, data: { reunionId: ref.id, usuario: u, estado: u === 'naara' ? 'aceptada' : (conservar?.estado || 'pendiente'), respondidoAt: conservar?.respondidoAt || (u === 'naara' ? iso : ''), canal: conservar?.canal || '', version, actualizadoAt: iso } });
        }
        for (const a of S.planAvisos(ref.id, v.datos, version, ahora)) {
          if (a.usuario === 'naara' && a.tipo === 'invitacion') continue; // la anfitriona no se invita a sí misma
          escrituras.push({ ref: db.collection(C.A).doc(a.id), data: { reunionId: ref.id, usuario: a.usuario, tipo: a.tipo, version, programadoMs: a.programadoMs, estado: 'pendiente', intentos: 0, creadoAt: iso, reprogramada: !!prev } });
        }
      }
      escrituras.push(auditoria(db, yo, borrador ? 'guardar_borrador' : (prev ? 'reprogramar' : 'programar'), ref.id, { titulo: r.titulo, inicioISO: r.inicioISO, version }));
      const b = db.batch(); escrituras.forEach((w) => (w.merge ? b.set(w.ref, w.data, { merge: true }) : b.set(w.ref, w.data, { merge: true }))); await b.commit();
      return res.status(200).json({ ok: true, id: ref.id, estado: r.estado, version });
    }

    if (accion === 'cancelar') {
      const { id, r } = await leerReunion(body.id, { paraEditar: true });
      if (['cancelada', 'finalizada'].includes(S.estadoVigente(r, ahora))) throw err(409, 'Esa reunión ya terminó o fue cancelada.');
      const escrituras = await anularPendientes(db, id, iso);
      escrituras.push({ ref: db.collection(C.R).doc(id), data: { estado: 'cancelada', salaAbierta: false, canceladaAt: iso, motivoCancelacion: String(body.motivo || '').slice(0, 200), actualizadoAt: iso } });
      if (r.estado !== 'borrador') for (const u of (r.participantes || []).filter((x) => x !== 'naara')) {
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
      b.set(ref, { reunionId: id, usuario: yo.id, estado: resp, respondidoAt: iso, canal: 'web', actualizadoAt: iso }, { merge: true });
      const a = auditoria(db, yo, 'rsvp', id, { respuesta: resp, canal: 'web' }); b.set(a.ref, a.data);
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

    if (accion === 'antesala') {
      const { id, r } = await leerReunion(body.id);
      const estado = S.estadoVigente(r, ahora);
      if (['cancelada', 'borrador'].includes(estado)) throw err(409, estado === 'cancelada' ? 'Esta reunión fue cancelada.' : 'Esta reunión todavía es un borrador.');
      const invs = (await invitacionesDe(db, [id]))[id];
      return res.status(200).json({ ok: true, reunion: publica(id, r, invs, ahora), yo: { id: yo.id, nombre: yo.nombre }, tiempoReal: !!(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET) });
    }

    if (accion === 'avatares') return res.status(200).json({ ok: true, avatares: await avataresDe(db), opciones: S.AVATAR_OPC });

    if (accion === 'avatar_guardar') { // cada fundadora SOLO guarda el suyo; control de versión para no pisar otro dispositivo
      const cfg = S.limpiarAvatar(body.config, S.AVATAR_BASE[yo.id]);
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
      if (!r.salaAbierta) {
        if (!S.puede.moderar(yo)) throw err(409, 'Esperando que la anfitriona abra la sala.');
        await db.collection(C.R).doc(id).set({ salaAbierta: true, estado: 'en_curso', abiertaAt: iso, actualizadoAt: iso }, { merge: true }); // Naara entra = abre
      }
      const sala = r.roomId || `sj_${id}`;
      const ttlSeg = Math.min(2 * 3600, Math.floor((v.hasta - ahora) / 1000));
      const token = S.tokenParticipante({ apiKey: env.LIVEKIT_API_KEY, apiSecret: env.LIVEKIT_API_SECRET, identidad: yo.id, nombre: yo.nombre, sala, ttlSeg, anfitriona: S.puede.moderar(yo), ahora });
      const a = auditoria(db, yo, 'entrar_sala', id); await a.ref.set(a.data);
      return res.status(200).json({ ok: true, url: String(env.LIVEKIT_URL).trim(), token, identidad: yo.id, expiraMs: ahora + ttlSeg * 1000 });
    }

    if (accion === 'expulsar') { // solo la anfitriona; lo hace el servidor con la API de LiveKit
      if (!S.puede.moderar(yo)) throw err(403, 'Solo la anfitriona puede sacar a alguien de la sala.');
      const { id, r } = await leerReunion(body.id);
      const quien = String(body.usuario || '');
      if (!S.POR_ID[quien] || quien === yo.id) throw err(400, 'Participante no válido.');
      if (!(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET)) throw err(503, 'Falta configurar LiveKit.');
      const sala = r.roomId || `sj_${id}`;
      const f = deps.fetch || fetch;
      const resp = await f(`${S.httpDeLiveKit(env.LIVEKIT_URL)}/twirp/livekit.RoomService/RemoveParticipant`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${S.tokenServidor({ apiKey: env.LIVEKIT_API_KEY, apiSecret: env.LIVEKIT_API_SECRET, sala, ahora })}` }, body: JSON.stringify({ room: sala, identity: quien }) });
      if (!resp.ok && resp.status !== 404) throw err(502, 'LiveKit no pudo sacar a esa persona. Intente de nuevo.');
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
