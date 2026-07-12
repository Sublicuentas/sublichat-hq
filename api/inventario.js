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
    return res.status(200).json({ ok: true, version: 2, msg: "inventario v2 activo. Usá POST." });

  const { accion, docId, correo, clave, plataforma, capacidad } = req.body || {};

  try {
    const db = getApp().firestore();

    if (accion === "crearCuenta") {
      if (!plataforma) return res.status(200).json({ error: "Falta la plataforma." });
      if (!correo) return res.status(200).json({ error: "Falta el correo." });
      const cap = Math.max(1, Number(capacidad) || 1);
      const nuevaCuenta = {
        plataforma: String(plataforma).toLowerCase().trim(),
        correo: String(correo).trim(),
        clave: clave != null ? String(clave).trim() : "",
        capacidad: cap,
        disponibles: cap,
        ocupados: 0,
        clientes: [],
        estado: "activa",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const ref = await db.collection("inventario").add(nuevaCuenta);
      return res.status(200).json({ ok: true, id: ref.id });
    }

    if (!docId) return res.status(200).json({ error: "Falta el ID de la cuenta." });
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
