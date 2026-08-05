// api/inventario.js  ·  VERSION 3  ·  Editar, vaciar y eliminar cuentas del inventario
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

async function requireFirebaseUser(req, res) {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ ok: false, error: "Sesión requerida." });
    return null;
  }
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (_) {
    res.status(401).json({ ok: false, error: "Sesión inválida o vencida." });
    return null;
  }
}

function isAdminUser(user) {
  const role = String(user && user.role || "").toLowerCase();
  const name = String(user && user.usuario || "").toLowerCase();
  return ["admin", "administrador", "sublicuentas", "owner"].includes(role) ||
    ["naara", "sublicuentas"].includes(name);
}

function normText(value) {
  return String(value == null ? "" : value).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normEmail(value) {
  return String(value == null ? "" : value).trim().toLowerCase().replace(/\s+/g, "");
}

function canonPlatform(value) {
  const key = normText(value).replace(/[^a-z0-9]/g, "");
  const aliases = {
    netflix:"netflix",netflixpremium:"netflix",vipnetflix:"vipnetflix",netflixvip:"vipnetflix",vip:"vipnetflix",
    disneyp:"disney",disneypremium:"disney",disneys:"disney",disneystandard:"disney",disney:"disney",
    hbomax:"hbomax",hbo:"hbomax",max:"hbomax",prime:"primevideo",primevideo:"primevideo",
    paramount:"paramount",paramountp:"paramount",crunchy:"crunchyroll",crunchyroll:"crunchyroll",
    vix:"vix",viki:"viki",universal:"universal",universalp:"universal",spotify:"spotify",youtube:"youtube",
    canva:"canva",gemini:"gemini",chatgpt:"chatgpt",duolingo:"duolingo",office:"office",microsoft:"office"
  };
  if (aliases[key]) return aliases[key];
  if (key.startsWith("oleada")) return "oleada";
  if (key.startsWith("iptv")) return "iptv";
  return key;
}

function plainClientValue(value) {
  if (value == null) return "";
  if (typeof value !== "object") return String(value).trim();
  for (const key of ["perfil","slot","nombre","name","label","value","numero","index","id"]) {
    if (value[key] != null && typeof value[key] !== "object") return String(value[key]).trim();
  }
  return "";
}

async function inspectOrUpdateAccountServices(db, options = {}) {
  const platform = canonPlatform(options.platform);
  const oldEmail = normEmail(options.oldEmail);
  if (!platform || !oldEmail) return { references: 0, documents: 0, updated: 0 };
  if (!options.countOnly && !options.emailProvided && !options.passwordProvided) return { references: 0, documents: 0, updated: 0 };
  const snap = await db.collection("clientes").limit(5000).get();
  let references = 0, documents = 0, updated = 0, operations = 0;
  let batch = db.batch();
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const services = Array.isArray(data.servicios) ? data.servicios : [];
    let changed = false;
    const next = services.map((service) => {
      const matches = canonPlatform(service && service.plataforma) === platform && normEmail(service && service.correo) === oldEmail;
      if (!matches) return service;
      references++;
      if (options.countOnly) return service;
      const copy = { ...service };
      if (options.emailProvided) copy.correo = String(options.newEmail || "").trim();
      if (options.passwordProvided) copy.clave = String(options.newPassword == null ? "" : options.newPassword).trim();
      copy.updatedAt = new Date().toISOString();
      changed = true;updated++;
      return copy;
    });
    if (changed) {
      batch.update(doc.ref, { servicios: next, updatedAt: new Date().toISOString() });
      documents++;operations++;
      if (operations >= 400) { await batch.commit();batch = db.batch();operations = 0; }
    }
  }
  if (operations) await batch.commit();
  return { references, documents, updated };
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(200).json({ ok: true, version: 3, msg: "inventario v3 activo. Usá POST." });

  const { accion, docId, correo, clave, plataforma, capacidad, clienteIndex, nombreCliente, slot, confirmarCorreo } = req.body || {};

  try {
    const db = getApp().firestore();
    const authUser = await requireFirebaseUser(req, res);
    if (!authUser) return;
    if (!isAdminUser(authUser)) {
      return res.status(403).json({ ok: false, error: "No tiene permiso para modificar el inventario." });
    }

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
    const current = snap.data() || {};

    if (accion === "editarCuenta") {
      const update = { updatedAt: new Date().toISOString() };
      const clients = Array.isArray(current.clientes) ? current.clientes : [];
      if (correo != null) {
        const cleanEmail = String(correo || "").trim();
        if (!cleanEmail) return res.status(200).json({ error: "El correo no puede quedar vacío." });
        update.correo = cleanEmail;
      }
      if (clave != null) update.clave = String(clave).trim();
      if (capacidad != null) {
        const cap = Math.max(1, Math.round(Number(capacidad) || 0));
        if (cap < clients.length) return res.status(200).json({ error: `La capacidad no puede ser menor que los ${clients.length} clientes asignados.` });
        update.capacidad = cap;
        update.ocupados = clients.length;
        update.disponibles = Math.max(0, cap - clients.length);
      }
      await ref.update(update);
      const sync = await inspectOrUpdateAccountServices(db, {
        platform: current.plataforma,
        oldEmail: current.correo,
        emailProvided: correo != null && normEmail(correo) !== normEmail(current.correo),
        newEmail: correo,
        passwordProvided: clave != null && String(clave) !== String(current.clave || ""),
        newPassword: clave
      });
      await db.collection("auditoria_eventos").add({tipo:"inventario_cuenta_editada",inventarioId:docId,plataforma:current.plataforma||"",correoAnterior:current.correo||"",correoNuevo:update.correo||current.correo||"",serviciosActualizados:sync.updated,usuario:String(authUser.usuario||authUser.uid||"sublicuentas"),createdAt:new Date().toISOString()});
      return res.status(200).json({ ok: true, serviciosActualizados: sync.updated, documentosActualizados: sync.documents });
    }

    if (accion === "quitarCliente") {
      const clients = Array.isArray(current.clientes) ? current.clientes : [];
      const wantedName = normText(nombreCliente);
      const wantedSlot = normText(plainClientValue(slot));
      let index = Number.isInteger(Number(clienteIndex)) ? Number(clienteIndex) : -1;
      const matches = (client) => {
        if (wantedName && normText(client && client.nombre) !== wantedName) return false;
        if (wantedSlot && normText(plainClientValue(client && client.slot)) !== wantedSlot) return false;
        return !!(wantedName || wantedSlot);
      };
      if (index < 0 || index >= clients.length || !matches(clients[index])) index = clients.findIndex(matches);
      if (index < 0) return res.status(200).json({ error: "No encontré ese cliente dentro de la cuenta." });
      const removed = clients[index] || {};
      const next = clients.filter((_, i) => i !== index);
      const cap = Math.max(next.length, Number(current.capacidad) || clients.length || 1);
      await ref.update({clientes:next,ocupados:next.length,disponibles:Math.max(0,cap-next.length),updatedAt:new Date().toISOString()});
      await db.collection("auditoria_eventos").add({tipo:"inventario_cliente_retirado",inventarioId:docId,plataforma:current.plataforma||"",correo:current.correo||"",cliente:String(removed.nombre||nombreCliente||""),slot:plainClientValue(removed.slot),usuario:String(authUser.usuario||authUser.uid||"sublicuentas"),createdAt:new Date().toISOString()});
      return res.status(200).json({ok:true,retirado:{nombre:String(removed.nombre||""),slot:plainClientValue(removed.slot)},ocupados:next.length,disponibles:Math.max(0,cap-next.length)});
    }

    if (accion === "eliminarCuenta") {
      if (normEmail(confirmarCorreo) !== normEmail(current.correo)) return res.status(200).json({ error: "La confirmación del correo no coincide." });
      const clients = Array.isArray(current.clientes) ? current.clientes : [];
      if (clients.length) return res.status(200).json({ error: `La cuenta todavía tiene ${clients.length} cliente${clients.length===1?"":"s"} asignado${clients.length===1?"":"s"}. Sáquelos primero.` });
      const refs = await inspectOrUpdateAccountServices(db,{platform:current.plataforma,oldEmail:current.correo,countOnly:true});
      if (refs.references) return res.status(200).json({ error: `La cuenta todavía está vinculada a ${refs.references} servicio${refs.references===1?"":"s"} en Clientes. Elimínelos o muévalos primero.` });
      await ref.delete();
      await db.collection("auditoria_eventos").add({tipo:"inventario_cuenta_eliminada",inventarioId:docId,plataforma:current.plataforma||"",correo:current.correo||"",usuario:String(authUser.usuario||authUser.uid||"sublicuentas"),createdAt:new Date().toISOString()});
      return res.status(200).json({ok:true,eliminada:true,id:docId});
    }

    return res.status(200).json({ error: "Acción no reconocida." });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ error: "Error: " + (e.message || "") });
  }
}
