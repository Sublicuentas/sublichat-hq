// api/inventario.js  ·  VERSION 1  ·  Editar cuentas del inventario en Firestore
//
// Usa la misma cuenta de servicio que renovar.js (mismas env vars en Vercel):
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import admin from "firebase-admin";

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  privateKey = privateKey.replace(/\\n/g, "\n");
  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(200).json({ ok: true, version: 1, msg: "inventario v1 activo. Usá POST." });

  const { accion, docId, correo, clave } = req.body || {};
  if (!docId) return res.status(200).json({ error: "Falta el ID de la cuenta." });

  try {
    const db = getApp().firestore();
    const ref = db.collection("inventario").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(200).json({ error: "No encontré esa cuenta." });

    if (accion === "editarCuenta") {
      const update = { updatedAt: new Date().toISOString() };
      if (correo != null) update.correo = correo;
      if (clave != null) update.clave = clave;
      await ref.update(update);
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ error: "Acción no reconocida." });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ error: "Error: " + (e.message || "") });
  }
}
