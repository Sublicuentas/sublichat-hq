// api/precios-publicos.js · R145 — Lista PÚBLICA de precios para revendedores (sin login).
// Solo lectura. Devuelve únicamente lo autorizado en Sublichat → Socios → Precios para Revendedores.
// No entrega costos, proveedores, stock, márgenes ni datos de socios, y no da acceso al Panel de Socios.
import admin from "firebase-admin";
import { armarListaPublica, leerPreciosSocios, CONFIG_DOC } from "./_precios-publicos-lib.js";

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("Faltan variables de Firebase.");
  return admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Solo lectura." });
  }
  try {
    const db = getApp().firestore();
    const [cfgSnap, docs] = await Promise.all([db.collection(CONFIG_DOC[0]).doc(CONFIG_DOC[1]).get(), leerPreciosSocios(db)]);
    const cfg = cfgSnap.exists ? cfgSnap.data() || {} : {};
    const publicado = { ...(cfg.publicado || {}), publicadoEn: cfg.publicadoEn || 0 };
    const lista = armarListaPublica(docs, publicado);
    // R146: caché de solo 10 s en el CDN y SIN "stale-while-revalidate" (antes mostraba la lista vieja/vacía
    // varios minutos después de publicar). Leer ~30 documentos por visita es barato.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=10");
    return res.status(200).json({ ok: true, ...lista });
  } catch (e) {
    console.error("PRECIOS_PUBLICOS_ERROR", e && e.message);
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({ ok: false, error: "No se pudo cargar la lista de precios." });
  }
}
