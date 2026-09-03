// Cartera de recuperación · solo Sublicuentas y Relojes.
import admin from "firebase-admin";

function getApp() {
  if (admin.apps.length) return admin.app();
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  privateKey = privateKey.replace(/\\n/g, "\n");
  return admin.initializeApp({ credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey
  }) });
}

async function authorize(req, res) {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) { res.status(401).json({ ok: false, error: "Sesión requerida." }); return null; }
  try {
    const user = await admin.auth().verifyIdToken(token);
    const role = String(user.role || "").toLowerCase();
    const name = String(user.usuario || user.uid || "").toLowerCase();
    const allowed = ["admin", "administrador", "sublicuentas", "owner", "finanzas", "relojes"].includes(role)
      || ["sublicuentas", "naara", "relojes", "libni"].includes(name);
    if (!allowed) { res.status(403).json({ ok: false, error: "Este módulo está disponible para Sublicuentas y Relojes." }); return null; }
    return user;
  } catch (_) { res.status(401).json({ ok: false, error: "Sesión inválida o vencida." }); return null; }
}

function plain(value) {
  if (value == null) return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return value;
}

export default async function handler(req, res) {
  try {
    getApp();
    const user = await authorize(req, res);
    if (!user) return;
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Método no permitido." });
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    const db = admin.firestore();
    const [eventsSnap, historySnap] = await Promise.all([
      db.collection("auditoria_eventos").where("tipo", "==", "cliente_no_renovo").limit(3000).get(),
      db.collection("historial_clientes").limit(3000).get()
    ]);
    const eventos = eventsSnap.docs.map(d => ({ id: d.id, ...plain(d.data()) }));
    const historial = historySnap.docs.map(d => ({ id: d.id, ...plain(d.data()) }));
    return res.status(200).json({ ok: true, eventos, historial, generadoAt: new Date().toISOString() });
  } catch (error) {
    console.error("recuperacion", error);
    return res.status(500).json({ ok: false, error: "No se pudo cargar la cartera de recuperación." });
  }
}
