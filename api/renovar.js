// api/renovar.js  ·  VERSION 1  ·  Renueva la fecha de un servicio en Firestore (escritura segura)
//
// Usa Firebase Admin con una cuenta de servicio (clave privada), NO el config público.
// Así el navegador nunca escribe directo: solo este servidor puede modificar datos.
//
// CONFIGURAR EN VERCEL (Environment Variables):
//   FIREBASE_PROJECT_ID      = sublicuentasbot
//   FIREBASE_CLIENT_EMAIL    = (del JSON de cuenta de servicio)
//   FIREBASE_PRIVATE_KEY     = (del JSON; pegar con los \n tal cual)
//   RENOVAR_SECRET           = una contraseña inventada por vos (ej: subli-renovar-2026)
//
// Cómo obtener la cuenta de servicio:
//   Firebase Console → ⚙️ Configuración del proyecto → Cuentas de servicio
//   → "Generar nueva clave privada" → descarga un JSON con project_id, client_email, private_key.

import admin from "firebase-admin";

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  // En Vercel la private key suele venir con \n escapados
  privateKey = privateKey.replace(/\\n/g, "\n");
  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
}

// Suma días a una fecha en formato DD/MM/YYYY y devuelve igual DD/MM/YYYY
function sumarDias(fechaStr, dias) {
  const [d, m, y] = String(fechaStr).split("/").map(n => parseInt(n, 10));
  const base = new Date(y, m - 1, d);
  base.setDate(base.getDate() + dias);
  const dd = String(base.getDate()).padStart(2, "0");
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${base.getFullYear()}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(200).json({ ok: true, version: 1, msg: "renovar v1 activo. Usá POST." });

  const { secret, clienteNorm, telefono, plataforma, dias, fechaActual } = req.body || {};

  // Seguridad: solo quien tenga el secreto puede renovar
  if (!process.env.RENOVAR_SECRET || secret !== process.env.RENOVAR_SECRET)
    return res.status(200).json({ error: "No autorizado." });

  if (!clienteNorm && !telefono)
    return res.status(200).json({ error: "Falta identificar el cliente." });
  if (!plataforma || !dias)
    return res.status(200).json({ error: "Faltan datos (plataforma o días)." });

  try {
    const db = getApp().firestore();
    // Buscar el cliente por nombre_norm o teléfono
    let query = db.collection("clientes");
    let snap;
    if (clienteNorm) {
      snap = await query.where("nombre_norm", "==", clienteNorm).get();
    }
    if ((!snap || snap.empty) && telefono) {
      snap = await query.where("telefono", "==", telefono).get();
    }
    if (!snap || snap.empty)
      return res.status(200).json({ error: "No encontré ese cliente en la base." });

    const docRef = snap.docs[0].ref;
    const data = snap.docs[0].data();
    const servicios = Array.isArray(data.servicios) ? data.servicios : [];

    // Renovar el/los servicio(s) de esa plataforma
    let cambiados = 0;
    const nuevos = servicios.map(s => {
      if (s.plataforma === plataforma) {
        cambiados++;
        const base = s.fechaRenovacion || fechaActual;
        return { ...s, fechaRenovacion: sumarDias(base, parseInt(dias, 10)) };
      }
      return s;
    });

    if (!cambiados)
      return res.status(200).json({ error: "No encontré esa plataforma en el cliente." });

    await docRef.update({ servicios: nuevos, updatedAt: new Date().toISOString() });
    return res.status(200).json({ ok: true, cambiados });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ error: "Error al renovar: " + (e.message || "") });
  }
}
