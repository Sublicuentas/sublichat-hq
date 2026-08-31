// api/inventario.js  ·  VERSION 6  ·  Sacar asignaciones de forma segura
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
    canva:"canva",gemini:"gemini",chatgpt:"chatgpt",duolingo:"duolingo",office:"office",office2021:"office2021",microsoft:"office",
    stellatv:"stellatv",stella:"stellatv"
  };
  if (aliases[key]) return aliases[key];
  const stella = key.match(/^stella(?:tv)?([123])(?:dispositivos?)?$/);
  if (stella) return `stellatv${stella[1]}`;
  const oleada = key.match(/^oleada(?:tv)?([13])$/);
  if (oleada) return `oleadatv${oleada[1]}`;
  if (/^latintv[1234]$/.test(key) || /^liontv[1235]$/.test(key) || /^iptv[134]$/.test(key)) return key;
  if (key.startsWith("stellatv") || key.startsWith("stella")) return "stellatv";
  if (key.startsWith("oleada")) return "oleada";
  if (key.startsWith("latintv")) return "latintv";
  if (key.startsWith("liontv")) return "liontv";
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

function findInventoryClientIndex(clients, clientIndex, nombreCliente, slot) {
  const rows = Array.isArray(clients) ? clients : [];
  const wantedName = normText(nombreCliente);
  const wantedSlot = normText(plainClientValue(slot));
  const requested = Number(clientIndex);
  const validRequested = Number.isInteger(requested) && requested >= 0 && requested < rows.length;
  const sameName = client => !!wantedName && normText(client && client.nombre) === wantedName;
  const sameSlot = client => !!wantedSlot && normText(plainClientValue(client && client.slot)) === wantedSlot;
  const exact = client => {
    if (!wantedName && !wantedSlot) return false;
    return (!wantedName || sameName(client)) && (!wantedSlot || sameSlot(client));
  };

  // El índice proviene de la misma lectura de Bodega. Si además coincide toda
  // la identidad disponible, es la opción más precisa incluso si hay nombres
  // de perfil repetidos dentro de la cuenta.
  if (validRequested && (!wantedName && !wantedSlot || exact(rows[requested]))) return requested;

  const exactIndexes = rows.map((client, index) => exact(client) ? index : -1).filter(index => index >= 0);
  if (exactIndexes.length === 1) return exactIndexes[0];

  // Algunas cuentas antiguas guardaron slot como objeto y la pantalla lo leyó
  // como texto. En ese caso basta una coincidencia única de nombre o de slot;
  // nunca se elimina si ambos datos apuntan a personas diferentes.
  const nameIndexes = wantedName ? rows.map((client, index) => sameName(client) ? index : -1).filter(index => index >= 0) : [];
  const slotIndexes = wantedSlot ? rows.map((client, index) => sameSlot(client) ? index : -1).filter(index => index >= 0) : [];
  if (wantedName && wantedSlot && nameIndexes.length === 1 && slotIndexes.length === 1 && nameIndexes[0] !== slotIndexes[0]) return -1;
  if (validRequested && ((nameIndexes.length === 1 && nameIndexes[0] === requested) || (slotIndexes.length === 1 && slotIndexes[0] === requested))) return requested;
  const uniqueFallbacks = new Set([
    ...(nameIndexes.length === 1 ? nameIndexes : []),
    ...(slotIndexes.length === 1 ? slotIndexes : [])
  ]);
  return uniqueFallbacks.size === 1 ? [...uniqueFallbacks][0] : -1;
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
      if (canonPlatform(service && service.plataforma) !== platform) return service;
      const perfiles = Array.isArray(service?.perfiles) ? service.perfiles : [];
      if (perfiles.length) {
        let profileChanged = false;
        const nextProfiles = perfiles.map((perfil) => {
          if (normEmail(perfil?.correo ?? service?.correo) !== oldEmail) return perfil;
          references++;
          if (options.countOnly) return perfil;
          const copy = { ...(perfil || {}) };
          if (options.emailProvided) copy.correo = String(options.newEmail || "").trim();
          if (options.passwordProvided) copy.clave = String(options.newPassword == null ? "" : options.newPassword).trim();
          profileChanged = true;updated++;
          return copy;
        });
        if (!profileChanged) return service;
        const copy = { ...service, perfiles: nextProfiles, updatedAt: new Date().toISOString() };
        const principal = nextProfiles[0] || {};
        copy.correo = principal.correo || copy.correo || "";
        copy.clave = principal.clave != null ? String(principal.clave) : String(copy.clave || "");
        changed = true;
        return copy;
      }
      const matches = normEmail(service && service.correo) === oldEmail;
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
    return res.status(200).json({ ok: true, version: 6, msg: "inventario v6 activo (Sacar seguro + sincronización multiperfil + Stella TV). Usá POST." });

  const { accion, docId, correo, clave, plataforma, capacidad, clienteIndex, nombreCliente, slot, confirmarCorreo, nuevoNombre, nuevoPin, nuevoTelefono } = req.body || {};

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
      const index = findInventoryClientIndex(clients, clienteIndex, nombreCliente, slot);
      if (index < 0) return res.status(200).json({ error: "No encontré ese cliente dentro de la cuenta." });
      const removed = clients[index] || {};
      const next = clients.filter((_, i) => i !== index);
      const cap = Math.max(next.length, Number(current.capacidad) || clients.length || 1);
      await ref.update({clientes:next,ocupados:next.length,disponibles:Math.max(0,cap-next.length),updatedAt:new Date().toISOString()});
      await db.collection("auditoria_eventos").add({tipo:"inventario_cliente_retirado",inventarioId:docId,plataforma:current.plataforma||"",correo:current.correo||"",cliente:String(removed.nombre||nombreCliente||""),slot:plainClientValue(removed.slot),usuario:String(authUser.usuario||authUser.uid||"sublicuentas"),createdAt:new Date().toISOString()});
      return res.status(200).json({ok:true,retirado:{nombre:String(removed.nombre||""),slot:plainClientValue(removed.slot)},ocupados:next.length,disponibles:Math.max(0,cap-next.length)});
    }

    if (accion === "editarCliente") {
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
      const before = { ...(clients[index] || {}) };
      const next = clients.slice();
      const updated = { ...next[index] };
      if (nuevoNombre != null) {
        const cleanName = String(nuevoNombre).trim();
        if (!cleanName) return res.status(200).json({ error: "El nombre no puede quedar vacío." });
        updated.nombre = cleanName;
      }
      if (nuevoPin != null) updated.pin = String(nuevoPin).trim();
      if (nuevoTelefono != null) updated.telefono = String(nuevoTelefono).trim();
      next[index] = updated;
      await ref.update({ clientes: next, updatedAt: new Date().toISOString() });
      await db.collection("auditoria_eventos").add({tipo:"inventario_cliente_editado",inventarioId:docId,plataforma:current.plataforma||"",correo:current.correo||"",antes:{nombre:before.nombre||"",pin:plainClientValue(before.pin),telefono:before.telefono||""},despues:{nombre:updated.nombre||"",pin:plainClientValue(updated.pin),telefono:updated.telefono||""},usuario:String(authUser.usuario||authUser.uid||"sublicuentas"),createdAt:new Date().toISOString()});
      return res.status(200).json({ok:true,cliente:{nombre:updated.nombre||"",pin:plainClientValue(updated.pin),telefono:updated.telefono||""}});
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
