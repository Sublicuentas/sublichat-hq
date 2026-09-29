// api/recordatorios.js
// Más › Recordatorios (APK): respaldo y sincronización de recordatorios PERSONALES.
// Independiente del negocio: no lee ni escribe clientes, ventas, renovaciones, inventario,
// tickets, Bot TG ni Panel de Socios. Cada usuario solo ve lo suyo:
//   recordatorios_personales/{uid del token}/items/{id}
// El dueño SIEMPRE sale del token verificado, nunca del cuerpo de la solicitud.
const admin = require('firebase-admin');

const ALLOWED_ORIGINS = new Set(['https://localhost', 'http://localhost', 'capacitor://localhost']);
const MAX_CAMBIOS = 200;
const MAX_RESPUESTA = 1500;
const CATEGORIAS = new Set(['personal', 'familia', 'trabajo', 'pagos', 'citas', 'compras', 'diligencias', 'pendientes', 'eventos', 'otro']);
const PRIORIDADES = new Set(['normal', 'important', 'urgent']);
const REPETICIONES = new Set(['none', 'daily', 'weekly', 'monthly', 'yearly', 'custom']);
const UNIDADES = new Set(['day', 'week', 'month', 'year']);
const ESTADOS = new Set(['scheduled', 'snoozed', 'completed', 'overdue', 'cancelled']);
const AVISOS = new Set([0, 10, 30, 60, 1440]);

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
  if (!token) { res.status(401).json({ ok: false, error: 'Sesión requerida.' }); return null; }
  try { getApp(); return await admin.auth().verifyIdToken(token, true); }
  catch (_) { res.status(401).json({ ok: false, error: 'Sesión inválida o vencida.' }); return null; }
}

function applyCors(req, res) {
  const origin = String(req.headers?.origin || '');
  const allowed = ALLOWED_ORIGINS.has(origin);
  if (origin) { res.setHeader('Vary', 'Origin'); if (allowed) res.setHeader('Access-Control-Allow-Origin', origin); }
  return { origin, allowed };
}

const txt = (v, max) => String(v ?? '').slice(0, max);
const isoOrNull = v => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };
const fechaOk = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '';
const horaOk = v => /^\d{1,2}:\d{2}$/.test(String(v || '')) ? String(v) : '';

// Solo se guardan los campos del modelo; cualquier otra cosa que llegue se descarta.
function limpiar(r = {}, uid) {
  const id = String(r.id || '');
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) return null;
  const repeatRule = REPETICIONES.has(r.repeatRule) ? r.repeatRule : 'none';
  const c = r.repeatCustom || {};
  return {
    id, ownerUserId: uid,
    title: txt(r.title, 80), note: txt(r.note, 500),
    category: CATEGORIAS.has(r.category) ? r.category : 'otro',
    priority: PRIORIDADES.has(r.priority) ? r.priority : 'normal',
    important: r.important === true,
    fecha: fechaOk(r.fecha), hora: horaOk(r.hora), anchorDay: Math.max(0, Math.min(31, Number(r.anchorDay) || 0)),
    scheduledAt: isoOrNull(r.scheduledAt) || '', timezone: txt(r.timezone, 60),
    repeatRule,
    repeatCustom: repeatRule === 'custom' ? { every: Math.max(1, Math.min(365, Math.round(Number(c.every) || 1))), unit: UNIDADES.has(c.unit) ? c.unit : 'day' } : null,
    alertOffsets: [...new Set((Array.isArray(r.alertOffsets) ? r.alertOffsets : [0]).map(Number).filter(o => AVISOS.has(o)))].slice(0, 5),
    status: ESTADOS.has(r.status) ? r.status : 'scheduled',
    snoozedUntil: isoOrNull(r.snoozedUntil),
    createdAt: isoOrNull(r.createdAt) || new Date().toISOString(),
    updatedAt: isoOrNull(r.updatedAt) || new Date().toISOString(),
    completedAt: isoOrNull(r.completedAt),
    nextOccurrenceAt: isoOrNull(r.nextOccurrenceAt),
    sourceId: r.sourceId ? txt(r.sourceId, 80) : null,
    deleted: r.deleted === true,
  };
}

function publico(d = {}) { const { serverUpdatedMs, ...rest } = d; return rest; }

module.exports = async function recordatorios(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const { allowed } = applyCors(req, res);
  if (req.method === 'OPTIONS') {
    if (!allowed) return res.status(403).end();
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido.' });

  const user = await requireFirebaseUser(req, res);
  if (!user) return;
  const uid = String(user.uid || '');
  if (!uid) return res.status(401).json({ ok: false, error: 'Sesión inválida.' });

  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch (_) { return {}; } })() : (req.body || {});
  const accion = String(body.accion || '').toLowerCase();
  const col = admin.firestore().collection('recordatorios_personales').doc(uid).collection('items');

  try {
    if (accion === 'listar') {
      const snap = await col.limit(MAX_RESPUESTA).get();
      return res.status(200).json({ ok: true, items: snap.docs.map(d => publico(d.data())), ahora: new Date(Date.now() - 2000).toISOString() });
    }
    if (accion !== 'sincronizar') return res.status(400).json({ ok: false, error: 'Acción no válida.' });

    const inicio = Date.now();
    const cambios = (Array.isArray(body.cambios) ? body.cambios : []).slice(0, MAX_CAMBIOS).map(r => limpiar(r, uid)).filter(Boolean);
    if (cambios.length) {
      const refs = cambios.map(r => col.doc(r.id));
      const actuales = await admin.firestore().getAll(...refs);
      const batch = admin.firestore().batch();
      let escritos = 0;
      cambios.forEach((r, i) => {
        const prev = actuales[i].exists ? actuales[i].data() : null;
        // Último cambio gana (por updatedAt del dispositivo). Reenviar lo mismo no duplica nada.
        if (prev && String(prev.updatedAt || '') >= String(r.updatedAt || '')) return;
        batch.set(refs[i], { ...r, serverUpdatedMs: inicio });
        escritos++;
      });
      if (escritos) await batch.commit();
    }

    const desdeMs = body.desde ? new Date(body.desde).getTime() : 0;
    const q = Number.isFinite(desdeMs) && desdeMs > 0 ? col.where('serverUpdatedMs', '>', desdeMs - 1) : col;
    const snap = await q.limit(MAX_RESPUESTA).get();
    return res.status(200).json({
      ok: true,
      items: snap.docs.map(d => publico(d.data())),
      aceptados: cambios.map(r => r.id),
      // Un margen de 2 s para no perder escrituras simultáneas; lo repetido se fusiona sin duplicar.
      ahora: new Date(inicio - 2000).toISOString(),
    });
  } catch (e) {
    console.error('recordatorios', e?.message || e);
    return res.status(500).json({ ok: false, error: 'No se pudo sincronizar los recordatorios.' });
  }
};
