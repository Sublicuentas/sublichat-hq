// api/academia.js · Progreso de Aula de clases (unificado con academia-sublicuentas.html)
// Lee/escribe la MISMA colección de Firestore que usa la Academia en la web
// (academia_progreso/{usuario}), para que el progreso de un asesor sea el mismo
// sin importar si abre las lecciones desde la web o desde la app Android.
// Variables en Vercel (las mismas que usa api/tickets.js):
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

async function requireFirebaseUser(req, res) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ ok: false, error: 'Sesión requerida.' });
    return null;
  }
  try {
    const user = await admin.auth().verifyIdToken(token);
    if (!String(user.usuario || '').trim()) throw new Error('claims_missing');
    return user;
  } catch (_) {
    res.status(401).json({ ok: false, error: 'Sesión inválida o vencida.' });
    return null;
  }
}

// La Academia web guarda el progreso por persona: libni, naara, geisell.
// Si alguien entra con otro alias de la misma persona, se usa la misma llave
// para que el avance no se parta en dos documentos.
const PROGRESS_KEY_ALIASES = Object.freeze({
  sublicuentas: 'naara',
  admin: 'naara',
  relojes: 'libni',
  finanzas: 'libni',
  geissel: 'geisell',
});

function progressKey(user) {
  const raw = String(user.usuario || user.uid || '').trim().toLowerCase();
  return PROGRESS_KEY_ALIASES[raw] || raw;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'Método no permitido.' });
    return;
  }
  try {
    getApp();
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
    return;
  }
  const user = await requireFirebaseUser(req, res);
  if (!user) return;
  const key = progressKey(user);
  if (!key) {
    res.status(400).json({ ok: false, error: 'No se pudo identificar al usuario.' });
    return;
  }

  const db = admin.firestore();
  const ref = db.collection('academia_progreso').doc(key);
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const accion = String(body.accion || 'obtener').toLowerCase();

  try {
    if (accion === 'obtener') {
      const snap = await ref.get();
      const data = snap.exists ? snap.data() || {} : {};
      const progress = Array.isArray(data.progress) ? data.progress : [];
      // avatar / mascota elegidos en la Academia (mismos números que usa la web; null = por defecto)
      const avatar = Number.isInteger(data.avatar) ? data.avatar : null;
      const mascot = Number.isInteger(data.mascot) ? data.mascot : null;
      res.status(200).json({ ok: true, progress, avatar, mascot });
      return;
    }

    if (accion === 'ajustes') {
      const avatar = Number(body.avatar);
      const mascot = Number(body.mascot);
      const valid = (n) => Number.isInteger(n) && n >= 0 && n < 64;
      if (!valid(avatar) || !valid(mascot)) {
        res.status(400).json({ ok: false, error: 'Avatar o mascota inválidos.' });
        return;
      }
      const snap = await ref.get();
      const data = snap.exists ? snap.data() || {} : {};
      await ref.set({ avatar, mascot, name: data.name || user.usuario || key, updatedAt: Date.now() }, { merge: true });
      res.status(200).json({ ok: true, avatar, mascot });
      return;
    }

    if (accion === 'completar') {
      const leccion = Number(body.leccion);
      if (!Number.isInteger(leccion) || leccion < 0) {
        res.status(400).json({ ok: false, error: 'Lección inválida.' });
        return;
      }
      // Transacción: web y app pueden completar lecciones a la vez sin pisarse.
      const progress = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() || {} : {};
        const list = Array.isArray(data.progress) ? data.progress.slice() : [];
        if (!list.includes(leccion)) {
          list.push(leccion);
          list.sort((a, b) => a - b);
        }
        tx.set(ref, {
          progress: list,
          name: data.name || user.usuario || key,
          updatedAt: Date.now()
        }, { merge: true });
        return list;
      });
      res.status(200).json({ ok: true, progress });
      return;
    }

    res.status(400).json({ ok: false, error: `Acción no reconocida: ${accion}` });
  } catch (e) {
    console.error('ACADEMIA_ERROR', e);
    res.status(500).json({ ok: false, error: 'No se pudo procesar la solicitud de Academia.' });
  }
};
