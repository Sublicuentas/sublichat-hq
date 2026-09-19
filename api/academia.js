// api/academia.js · Progreso de Aula de clases (unificado con academia-sublicuentas.html)
// Lee/escribe la MISMA colección de Firestore que usa la Academia en la web
// (academia_progreso/{usuario}), para que el progreso de un asesor sea el
// mismo sin importar si abre las lecciones desde la web o desde la APK.
// Variables esperadas en Vercel (las mismas que ya usa api/tickets.js):
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

function progressKey(user) {
  return String(user.usuario || user.uid || '').trim().toLowerCase();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
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
  const body = req.body || {};
  const accion = String(body.accion || 'obtener').toLowerCase();

  try {
    if (accion === 'obtener') {
      const snap = await ref.get();
      const data = snap.exists ? snap.data() || {} : {};
      const progress = Array.isArray(data.progress) ? data.progress : [];
      res.status(200).json({ ok: true, progress });
      return;
    }

    if (accion === 'completar') {
      const leccion = Number(body.leccion);
      if (!Number.isInteger(leccion) || leccion < 0) {
        res.status(400).json({ ok: false, error: 'Lección inválida.' });
        return;
      }
      const snap = await ref.get();
      const data = snap.exists ? snap.data() || {} : {};
      const progress = Array.isArray(data.progress) ? data.progress.slice() : [];
      if (!progress.includes(leccion)) {
        progress.push(leccion);
        progress.sort((a, b) => a - b);
      }
      await ref.set({
        progress,
        name: data.name || user.usuario || key,
        updatedAt: Date.now()
      }, { merge: true });
      res.status(200).json({ ok: true, progress });
      return;
    }

    res.status(400).json({ ok: false, error: `Acción no reconocida: ${accion}` });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'Error al procesar la solicitud.' });
  }
};
