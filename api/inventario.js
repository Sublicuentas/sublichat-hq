// api/inventario.js  ·  VERSION 7  ·  Sacar seguro + claves enlazadas a clientes
//
// Usa la misma cuenta de servicio que renovar.js (mismas env vars en Vercel):
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import admin from "firebase-admin";
import tvDigital from "./_tv-digital.js";
import push from "./_push.js"; // Fase 2 · aviso push de cambios importantes (sin datos de la cuenta)

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
  return ["admin", "administrador", "sublicuentas", "owner", "geisell_admin", "control_admin"].includes(role) ||
    ["naara", "sublicuentas", "geisell", "geissel"].includes(name);
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

// Sin un límite total: tanto la reparación como las claves deben incluir toda
// la cartera. Se pagina por ID para no cargar una sola respuesta enorme.
async function* clientPages(db) {
  let cursor = "";
  for (;;) {
    let query = db.collection("clientes").orderBy("__name__").limit(500);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();
    if (!snap.docs.length) return;
    yield snap.docs;
    cursor = snap.docs[snap.docs.length - 1].id;
    if (snap.docs.length < 500) return;
  }
}

function accountKey(platform, email) {
  return `${canonPlatform(platform)}|${normEmail(email)}`;
}

function renameInventoryLink(link, platform, oldEmail, newEmail) {
  try {
    const value = JSON.parse(link);
    const identity = JSON.parse(value[0]);
    if (identity[1] !== accountKey(platform, oldEmail)) return link;
    identity[1] = accountKey(platform, newEmail);
    return JSON.stringify([JSON.stringify(identity), value[1]]);
  } catch (_) { return link; }
}

// Repara únicamente cuentas ya existentes. Los cupos manuales se conservan;
// las fichas consolidadas son alias y no generan ocupaciones adicionales.
export async function reconciliarInventario(db, accounts = [], opciones = {}) {
  if (!accounts.length) return [];
  const wanted = new Map(accounts.map(a => [accountKey(a.plataforma, a.correo), []]));
  // accountId inmutable → filas de esa cuenta. Un perfil enlazado por inventarioId pertenece a su
  // cuenta aunque el correo guardado en la ficha esté desactualizado (cambio de correo a medias).
  const porId = new Map(accounts.filter(a => a.id).map(a => [String(a.id), wanted.get(accountKey(a.plataforma, a.correo))]));
  const familiaDe = new Map(accounts.filter(a => a.id).map(a => [String(a.id), canonPlatform(a.plataforma)]));
  for await (const docs of clientPages(db)) {
    for (const doc of docs) {
      const client = doc.data() || {};
      if (String(client.consolidadoEn || "").trim()) continue;
      const titular = String(client.nombrePerfil || client.nombre || "").trim();
      const services = Array.isArray(client.servicios) ? client.servicios : [];
      const occurrences = new Map();
      services.forEach((service) => {
        const profiles = Array.isArray(service?.perfiles) && service.perfiles.length ? service.perfiles : [service];
        profiles.forEach((p, profileIndex) => {
          const correo = p?.correo || service?.correo || "";
          const enlace = String(p?.inventarioId || service?.inventarioId || "");
          let rows = enlace && porId.has(enlace) && familiaDe.get(enlace) === canonPlatform(service?.plataforma) ? porId.get(enlace) : null;
          if (!rows) {
            if (!normEmail(correo)) return;
            rows = wanted.get(accountKey(service?.plataforma, correo));
          }
          if (!rows) return;
          const tercero = service.beneficiarioTipo === "tercero" ? String(service.beneficiarioNombre || service.beneficiario || "").trim() : "";
          const nombre = plainClientValue(p?.nombre || p?.nombrePerfil || p?.perfil || "") || titular || "Cliente";
          // Sin IDs, el vínculo depende del contenido y no de la posición del
          // servicio: borrar otra compra no desplaza ni duplica este perfil.
          const profileId = p?.perfilId || p?.id || "";
          const identity = JSON.stringify([doc.id, service.compraId || (profileId ? canonPlatform(service.plataforma) : accountKey(service.plataforma, correo)), profileId || normText(nombre)]);
          const occurrence = occurrences.get(identity) || 0;
          occurrences.set(identity, occurrence + 1);
          rows.push({ clienteId:doc.id, compraId:String(service.compraId || ""), perfilId:String(p?.perfilId || p?.id || ""),
            vinculoInventario:JSON.stringify([identity, occurrence]),
            nombre:tercero && (profiles.length === 1 || normText(nombre) === normText(titular)) ? tercero : nombre,
            pin:plainClientValue(p?.pinPerfil || p?.pin_perfil || p?.perfilPin || (p !== service ? p?.pin : "") || ""),
            telefono:String(client.telefono || ""), ...(titular && normText(titular) !== normText(nombre) ? { pagadoPor:titular } : {}) });
        });
      });
    }
  }
  const merge = (account, rows) => {
    const exclusions = new Set(Array.isArray(account.exclusionesSincronizacion) ? account.exclusionesSincronizacion : []);
    rows = rows.filter(row => !exclusions.has(row.vinculoInventario));
    const active = new Set(rows.map(row => row.vinculoInventario));
    // Solo se retiran vínculos administrados por esta reparación que ya no
    // existen en las fichas. Las asignaciones manuales nunca se purgan.
    const clients = (Array.isArray(account.clientes) ? account.clientes : [])
      .filter(c => !c.vinculoInventario || active.has(c.vinculoInventario)).map(c => ({...c}));
    const used = new Set();
    for (const row of rows) {
      let index = clients.findIndex((c,i) => !used.has(i) && (
        c.vinculoInventario === row.vinculoInventario ||
        row.perfilId && String(c.perfilId || "") === row.perfilId && (!c.clienteId || c.clienteId === row.clienteId)
      ));
      if (index < 0) {
        const legacy = clients.map((c,i) => ({c,i})).filter(({c,i}) => !used.has(i) &&
          !c.vinculoInventario && !c.perfilId && (!c.clienteId || c.clienteId === row.clienteId) &&
          (!c.compraId || c.compraId === row.compraId) && normText(c.nombre) === normText(row.nombre) &&
          (!c.pin || !row.pin || plainClientValue(c.pin) === row.pin));
        if (legacy.length === 1) index = legacy[0].i;
      }
      if (index < 0) {
        const slots = new Set(clients.map(c => Number(plainClientValue(c.slot))));
        let slot = 1; while (slots.has(slot)) slot++;
        index = clients.length; clients.push({ slot });
      }
      used.add(index);
      const old = clients[index];
      clients[index] = {...old, ...row, pin:row.pin || old.pin || ""};
      if (old.edicionManualInventario) for (const field of ["nombre", "pin", "telefono"]) {
        if (old[field] != null) clients[index][field] = old[field];
      }
    }
    const capacidad = Number(account.capacidad) || 0;
    const disponibles = Math.max(0, capacidad - clients.length);
    return { clientes:clients, ocupados:clients.length, disponibles, ...(account.disp != null ? {disp:disponibles} : {}),
      ...(account.id ? { accountId:String(account.id) } : {}), sobreasignada: capacidad > 0 && clients.length > capacidad };
  };
  // Solo se escriben diferencias y se relee la cuenta dentro de una transacción,
  // para conservar ediciones simultáneas. No se trunca al llegar a capacidad:
  // una sobreasignación real debe seguir siendo visible, con cero libres.
  if (opciones.soloDiagnostico) {
    return accounts.map(account => {
      const rows = wanted.get(accountKey(account.plataforma, account.correo)) || [];
      const patch = merge(account, rows);
      const antes = Array.isArray(account.clientes) ? account.clientes : [];
      const clave = c => c.vinculoInventario || `${c.clienteId || ""}|${c.perfilId || ""}|${normText(c.nombre)}`;
      const antesSet = new Set(antes.map(clave)), despuesSet = new Set(patch.clientes.map(clave));
      return {
        id: account.id, plataforma: account.plataforma || "", correo: account.correo || "",
        capacidad: Number(account.capacidad) || 0,
        ocupadosGuardados: Number.isFinite(Number(account.ocupados)) ? Number(account.ocupados) : antes.length,
        ocupadosReales: patch.clientes.length,
        agregados: patch.clientes.filter(c => !antesSet.has(clave(c))).length,
        retirados: antes.filter(c => !despuesSet.has(clave(c))).length,
        sobreasignada: patch.sobreasignada,
        cambios: !Object.keys(patch).every(key => JSON.stringify(account[key]) === JSON.stringify(patch[key]))
      };
    });
  }
  return Promise.all(accounts.map(async account => {
    const rows = wanted.get(accountKey(account.plataforma, account.correo)) || [];
    const patch = merge(account, rows);
    if (Object.keys(patch).every(key => JSON.stringify(account[key]) === JSON.stringify(patch[key]))) return account;
    return db.runTransaction(async tx => {
      const ref = db.collection("inventario").doc(account.id);
      const snap = await tx.get(ref);
      if (!snap.exists) return account;
      const current = snap.data() || {};
      if (accountKey(current.plataforma, current.correo) !== accountKey(account.plataforma, account.correo)) return {...current, id:account.id};
      const update = merge({...current, id:account.id}, rows);
      tx.update(ref, {...update, updatedAt:new Date().toISOString()});
      return {...current, ...update, id:account.id};
    });
  }));
}

// ===== Sincronización total · diagnóstico y reparación idempotente (oct-2026) =====
// accountId = ID del documento de Bodega. Nunca cambia aunque cambie el correo/usuario.
// Diagnóstico: solo lee. Reparación: enlaza perfiles por accountId, corrige correos/claves de perfiles
// enlazados a una cuenta cuyo correo cambió, recalcula ocupados reales y marca accountId.
// Correrlo dos veces seguidas debe dar 0 cambios la segunda vez (salvo datos nuevos).
function transformarEnlacesCliente(client, ctx) {
  const stats = { perfiles: 0, sinEnlace: 0, enlazados: 0, correoActualizado: 0, enlacesRotos: 0, huerfanos: [] };
  const servicios = Array.isArray(client.servicios) ? client.servicios : [];
  let changed = false;
  const next = servicios.map((s) => {
    if (!s || typeof s !== "object") return s;
    const plat = canonPlatform(s.plataforma);
    if (!ctx.plataformasConBodega.has(plat)) return s;
    const perfiles = Array.isArray(s.perfiles) && s.perfiles.length ? s.perfiles : null;
    const lista = perfiles || [s];
    let local = false;
    const nuevos = lista.map((p) => {
      const correo = String(p?.correo || s.correo || "");
      if (!normEmail(correo)) return p;
      stats.perfiles++;
      const actual = String(p?.inventarioId || (perfiles ? "" : s.inventarioId) || "").trim();
      const enlazada = actual ? ctx.cuentaPorId.get(actual) : null;
      if (actual && !enlazada) stats.enlacesRotos++;
      const porCorreo = ctx.cuentaPorClave.get(accountKey(s.plataforma, correo));
      if (enlazada && canonPlatform(enlazada.plataforma) === plat && (!porCorreo || porCorreo.id === enlazada.id)) {
        if (normEmail(enlazada.correo) === normEmail(correo)) return p;
        // Enlazado por ID pero con el correo viejo (y ese correo ya no es de otra cuenta): la cuenta manda.
        stats.correoActualizado++; local = true;
        const copia = { ...p, correo: String(enlazada.correo || "").trim() };
        if (enlazada.clave != null && String(enlazada.clave).trim() && !s.sinClave && s.maxPlayer !== true) copia.clave = String(enlazada.clave).trim();
        return copia;
      }
      const esperada = porCorreo;
      if (!esperada) {
        if (!actual) stats.sinEnlace++;
        stats.huerfanos.push({ plataforma: String(s.plataforma || ""), correo, cliente: String(client.nombrePerfil || client.nombre || "") });
        return p;
      }
      if (!actual) stats.sinEnlace++;
      stats.enlazados++; local = true;
      return { ...p, inventarioId: esperada.id };
    });
    if (!local) return s;
    changed = true;
    if (perfiles) {
      const principal = nuevos[0] || {};
      return { ...s, perfiles: nuevos, inventarioId: principal.inventarioId || s.inventarioId || "",
        correo: principal.correo || s.correo || "", ...(principal.clave != null ? { clave: principal.clave } : {}) };
    }
    return { ...s, ...nuevos[0] };
  });
  return { changed, servicios: next, stats };
}

export async function auditarInventario(db, { aplicar = false, usuario = "" } = {}) {
  const invSnap = await db.collection("inventario").get();
  const cuentas = invSnap.docs.map((d) => ({ ...(d.data() || {}), id: d.id }));
  const porClave = new Map();
  cuentas.forEach((c) => {
    if (!normEmail(c.correo)) return;
    const k = accountKey(c.plataforma, c.correo);
    if (!porClave.has(k)) porClave.set(k, []);
    porClave.get(k).push(c.id);
  });
  const duplicados = [...porClave.entries()].filter(([, ids]) => ids.length > 1).map(([clave, ids]) => ({ clave, ids }));
  const idsDuplicados = new Set(duplicados.flatMap((d) => d.ids));
  const ctx = {
    cuentaPorId: new Map(cuentas.map((c) => [c.id, c])),
    cuentaPorClave: new Map(cuentas.filter((c) => normEmail(c.correo) && !idsDuplicados.has(c.id)).map((c) => [accountKey(c.plataforma, c.correo), c])),
    plataformasConBodega: new Set(cuentas.map((c) => canonPlatform(c.plataforma)).filter(Boolean))
  };
  const total = { perfiles: 0, sinEnlace: 0, enlazados: 0, correoActualizado: 0, enlacesRotos: 0, huerfanos: 0 };
  const ejemplosHuerfanos = [];
  const fichasACorregir = [];
  for await (const docs of clientPages(db)) for (const doc of docs) {
    const client = doc.data() || {};
    if (String(client.consolidadoEn || "").trim()) continue;
    const r = transformarEnlacesCliente(client, ctx);
    for (const k of ["perfiles", "sinEnlace", "enlazados", "correoActualizado", "enlacesRotos"]) total[k] += r.stats[k];
    total.huerfanos += r.stats.huerfanos.length;
    for (const h of r.stats.huerfanos) if (ejemplosHuerfanos.length < 30) ejemplosHuerfanos.push({ clienteId: doc.id, ...h });
    if (r.changed) fichasACorregir.push(doc.ref);
  }
  let fichasCorregidas = 0;
  if (aplicar) {
    for (const ref of fichasACorregir) {
      const ok = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return false;
        const r = transformarEnlacesCliente(snap.data() || {}, ctx);
        if (!r.changed) return false;
        tx.update(ref, { servicios: r.servicios, updatedAt: new Date().toISOString() });
        return true;
      });
      if (ok) fichasCorregidas++;
    }
  }
  // Recalcular cupos (después de enlazar, para que el conteo use los enlaces nuevos).
  const cuentasConciliables = cuentas.filter((c) => normEmail(c.correo) && !idsDuplicados.has(c.id));
  const diag = await reconciliarInventario(db, cuentasConciliables, { soloDiagnostico: true });
  const cuentasConCambios = diag.filter((d) => d.cambios);
  let cuentasCorregidas = 0;
  if (aplicar && cuentasConCambios.length) {
    const ids = new Set(cuentasConCambios.map((d) => d.id));
    const res = await reconciliarInventario(db, cuentasConciliables.filter((c) => ids.has(c.id)));
    cuentasCorregidas = res.length;
  }
  const resumen = {
    modo: aplicar ? "reparacion" : "diagnostico",
    cuentas: cuentas.length,
    cuentasSinAccountId: cuentas.filter((c) => c.accountId !== c.id).length,
    cuentasDuplicadas: duplicados,
    capacidadIncoherente: cuentas.filter((c) => !(Number(c.capacidad) > 0)).map((c) => ({ id: c.id, plataforma: c.plataforma || "", correo: c.correo || "" })),
    sobreasignadas: diag.filter((d) => d.sobreasignada).map((d) => ({ id: d.id, plataforma: d.plataforma, correo: d.correo, ocupados: d.ocupadosReales, capacidad: d.capacidad })),
    cuentasConConteoIncorrecto: cuentasConCambios.length,
    perfilesFaltantesEnBodega: diag.reduce((s, d) => s + d.agregados, 0),
    perfilesSobrantesEnBodega: diag.reduce((s, d) => s + d.retirados, 0),
    perfilesEnFichas: total.perfiles,
    perfilesSinAccountId: total.sinEnlace,
    perfilesAEnlazar: total.enlazados,
    perfilesConCorreoViejo: total.correoActualizado,
    enlacesRotos: total.enlacesRotos,
    clientesHuerfanos: total.huerfanos,
    ejemplosHuerfanos,
    ejemplos: cuentasConCambios.slice(0, 30),
    fichasCorregidas, cuentasCorregidas
  };
  if (aplicar) {
    await db.collection("auditoria_eventos").add({ tipo: "inventario_reparado", usuario: String(usuario || "sublicuentas"),
      resumen: { fichasCorregidas, cuentasCorregidas, perfilesAEnlazar: total.enlazados, perfilesConCorreoViejo: total.correoActualizado,
        cuentasDuplicadas: duplicados.length, clientesHuerfanos: total.huerfanos }, createdAt: new Date().toISOString() });
  }
  return resumen;
}

function refreshAccountFicha(service) {
  if (!service.fichaTexto) return service;
  const profiles = Array.isArray(service.perfiles) && service.perfiles.length ? service.perfiles : [service];
  let text = String(service.fichaTexto);
  const replace = (labels, field) => {
    const regex = new RegExp(`^([ \\t]*\\*?[^\\p{L}\\p{N}\\n]{0,8}(?:${labels})[ \\t]*:[ \\t]*)([^*\\n]*?)([ \\t]*\\*?[ \\t]*)$`, "gimu");
    if ([...text.matchAll(regex)].length !== profiles.length) return;
    let index = 0;
    text = text.replace(regex, (match, start, old, end) => {
      const p = profiles[index++];
      const value = p[field] ?? service[field];
      if (value == null || /[\r\n*]/.test(String(value))) return match;
      return `${start}${value}${end}`;
    });
  };
  replace("Correo|Usuario", "correo");
  if (!service.sinClave && service.maxPlayer !== true) replace("Contraseña|Contrasena|Clave", "clave");
  return {...service, fichaTexto:text};
}

async function inspectOrUpdateAccountServices(db, options = {}) {
  const platform = canonPlatform(options.platform);
  const oldEmail = normEmail(options.oldEmail);
  if (!platform || !oldEmail) return { references: 0, documents: 0, updated: 0 };
  if (!options.countOnly && !options.emailProvided && !options.passwordProvided) return { references: 0, documents: 0, updated: 0 };
  const assignments = (Array.isArray(options.assignments) ? options.assignments : []).map((item) => ({
    clientId: String(item?.clienteId || item?.clientId || "").trim(),
    compraId: String(item?.compraId || "").trim(),
    perfilId: String(item?.perfilId || "").trim()
  })).filter((item) => item.clientId || item.compraId || item.perfilId);
  let references = 0, documents = 0, updated = 0;
  const transform = (data, clientId) => {
    let localReferences = 0, localUpdated = 0;
    const services = Array.isArray(data.servicios) ? data.servicios : [];
    const linkedToClient = assignments.filter((item) => !item.clientId || item.clientId === clientId);
    let changed = false;
    const next = services.map((service) => {
      if (canonPlatform(service && service.plataforma) !== platform) return service;
      const perfiles = Array.isArray(service?.perfiles) ? service.perfiles : [];
      const compraId = String(service?.compraId || "").trim();
      const serviceLinked = linkedToClient.some((item) =>
        (item.compraId && compraId && item.compraId === compraId) ||
        (item.perfilId && perfiles.some((perfil) => String(perfil?.perfilId || perfil?.id || "").trim() === item.perfilId))
      );
      if (perfiles.length) {
        let profileChanged = false;
        const nextProfiles = perfiles.map((perfil) => {
          // En fichas antiguas `perfil.correo` suele existir como cadena vacía.
          // Con `??` esa cadena impedía heredar `service.correo`, por lo que la
          // clave cambiaba en Bodega pero nunca llegaba a la URL del cliente.
          const inheritedEmail = perfil?.correo || service?.correo || "";
          const perfilId = String(perfil?.perfilId || perfil?.id || "").trim();
          // Una compra puede incluir varios correos. Su ID NO identifica la
          // cuenta de todos los perfiles. Un correo explícito distinto manda.
          const profileLinked = linkedToClient.some((item) => item.perfilId && perfilId && item.perfilId === perfilId);
          const accountLinked = options.accountId && perfil?.inventarioId === options.accountId &&
            normEmail(inheritedEmail) === normEmail(options.emailProvided ? options.newEmail : options.oldEmail);
          if (!accountLinked && normEmail(inheritedEmail) !== oldEmail && !(profileLinked && !normEmail(inheritedEmail))) return perfil;
          localReferences++;
          if (options.countOnly) return perfil;
          const copy = { ...(perfil || {}) };
          if (options.accountId) copy.inventarioId = options.accountId;
          if (options.emailProvided) copy.correo = String(options.newEmail || "").trim();
          if (options.passwordProvided) copy.clave = String(options.newPassword == null ? "" : options.newPassword).trim();
          profileChanged = true;localUpdated++;
          return copy;
        });
        if (!profileChanged) return service;
        const copy = { ...service, perfiles: nextProfiles, updatedAt: new Date().toISOString() };
        const principal = nextProfiles[0] || {};
        copy.correo = principal.correo || copy.correo || "";
        copy.clave = principal.clave != null ? String(principal.clave) : String(copy.clave || "");
        changed = true;
        return refreshAccountFicha(copy);
      }
      const alreadyUpdated = options.accountId && service?.inventarioId === options.accountId &&
        normEmail(service?.correo) === normEmail(options.emailProvided ? options.newEmail : options.oldEmail);
      const matches = alreadyUpdated || normEmail(service && service.correo) === oldEmail || (serviceLinked && !normEmail(service?.correo));
      if (!matches) return service;
      localReferences++;
      if (options.countOnly) return service;
      const copy = { ...service };
      if (options.accountId) copy.inventarioId = options.accountId;
      if (options.emailProvided) copy.correo = String(options.newEmail || "").trim();
      if (options.passwordProvided) copy.clave = String(options.newPassword == null ? "" : options.newPassword).trim();
      copy.updatedAt = new Date().toISOString();
      changed = true;localUpdated++;
      return refreshAccountFicha(copy);
    });
    return { references:localReferences, updated:localUpdated, documents:changed ? 1 : 0, servicios:next };
  };
  for await (const docs of clientPages(db)) for (const doc of docs) {
    const preview = transform(doc.data() || {}, doc.id);
    const result = !preview.documents ? preview : await db.runTransaction(async tx => {
      const latest = await tx.get(doc.ref);
      const current = transform(latest.data() || {}, doc.id);
      if (current.documents) tx.update(doc.ref, {servicios:current.servicios, updatedAt:new Date().toISOString()});
      return current;
    });
    references += result.references; updated += result.updated; documents += result.documents;
  }
  return { references, documents, updated };
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(200).json({ ok: true, version: 7, msg: "inventario v7 activo (Sacar seguro + claves enlazadas a fichas + Stella TV). Usá POST." });

  const { accion, docId, correo, clave, plataforma, capacidad, clienteIndex, nombreCliente, slot, confirmarCorreo, nuevoNombre, nuevoPin, nuevoTelefono, url, tipoEntrega } = req.body || {};

  try {
    const db = getApp().firestore();
    const authUser = await requireFirebaseUser(req, res);
    if (!authUser) return;
    // Lectura de URLs de TV Digital: cualquier usuario con sesión (las entregas las necesitan).
    if (accion === "tvUrls") {
      return res.status(200).json({ ok: true, urls: await tvDigital.leerUrlsTv(db) });
    }
    if (!isAdminUser(authUser)) {
      return res.status(403).json({ ok: false, error: "No tiene permiso para modificar el inventario." });
    }

    const usuarioAccion = String(authUser.usuario || authUser.uid || "sublicuentas");

    // Diagnóstico (solo lee) y reparación idempotente de Bodega ↔ fichas.
    if (accion === "diagnosticarInventario" || accion === "repararInventario") {
      const resumen = await auditarInventario(db, { aplicar: accion === "repararInventario", usuario: usuarioAccion });
      return res.status(200).json({ ok: true, resumen });
    }
    // URLs de TV Digital editables (proveedor). La APK y el portal las leen al momento de entregar.
    if (accion === "guardarTvUrl") {
      try {
        const out = await tvDigital.guardarUrlTv(db, { proveedor: req.body.proveedor, url, nombre: req.body.nombre, usuario: usuarioAccion });
        return res.status(200).json({ ok: true, ...out });
      } catch (e) { return res.status(200).json({ error: e.message }); }
    }

    if (accion === "crearCuenta") {
      if (!plataforma) return res.status(200).json({ error: "Falta la plataforma." });
      if (!correo) return res.status(200).json({ error: "Falta el correo." });
      // No crear una cuenta paralela: misma plataforma + mismo correo/usuario = misma cuenta.
      const dupSnap = await db.collection("inventario").where("plataforma", "==", String(plataforma).toLowerCase().trim()).get();
      if (dupSnap.docs.some(d => normEmail(d.data()?.correo) === normEmail(correo)))
        return res.status(200).json({ error: "Ya existe esa cuenta en Bodega para esa plataforma." });
      const urlCuenta = url != null && String(url).trim() ? tvDigital.validarUrlTv(url) : "";
      if (urlCuenta === null) return res.status(200).json({ error: "URL inválida. Use http:// o https://." });
      const cap = Math.max(1, Number(capacidad) || 1);
      const nuevaCuenta = {
        ...(urlCuenta ? { url: urlCuenta } : {}),
        ...(tipoEntrega ? { tipoEntrega: String(tipoEntrega).slice(0, 20) } : {}),
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
      const ref = db.collection("inventario").doc();
      await ref.set({ ...nuevaCuenta, accountId: ref.id });
      await db.collection("auditoria_eventos").add({tipo:"inventario_cuenta_creada",inventarioId:ref.id,plataforma:nuevaCuenta.plataforma,correo:nuevaCuenta.correo,capacidad:cap,usuario:usuarioAccion,createdAt:new Date().toISOString()});
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
      if (url != null) {
        const limpia = String(url).trim() ? tvDigital.validarUrlTv(url) : "";
        if (limpia === null) return res.status(200).json({ error: "URL inválida. Use http:// o https:// (ejemplo: http://latinostream.xyz:80)." });
        update.url = limpia;
      }
      update.accountId = docId;
      if (capacidad != null) {
        const cap = Math.max(1, Math.round(Number(capacidad) || 0));
        if (cap < clients.length) return res.status(200).json({ error: `La capacidad no puede ser menor que los ${clients.length} clientes asignados.` });
        update.capacidad = cap;
        update.ocupados = clients.length;
        update.disponibles = Math.max(0, cap - clients.length);
      }
      const sync = await inspectOrUpdateAccountServices(db, {
        platform: current.plataforma,
        oldEmail: current.correo,
        accountId: docId,
        assignments: clients,
        emailProvided: correo != null,
        newEmail: correo,
        passwordProvided: clave != null,
        newPassword: clave
      });
      // La cuenta se guarda al terminar la réplica. Si falla a mitad, conserva
      // el correo anterior y repetir Guardar vuelve a encontrar los pendientes.
      await db.runTransaction(async tx => {
        const latest = await tx.get(ref);
        const account = latest.data() || {};
        const patch = {...update};
        if (update.correo && normEmail(update.correo) !== normEmail(current.correo)) {
          const rename = link => renameInventoryLink(link, current.plataforma, current.correo, update.correo);
          // Mantiene retiros y ediciones incluso en compras legacy sin IDs,
          // cuyo vínculo depende del correo. Se relee para conservar cambios
          // simultáneos del inventario durante la réplica de fichas.
          patch.clientes = (Array.isArray(account.clientes) ? account.clientes : []).map(c =>
            c.vinculoInventario ? {...c, vinculoInventario:rename(c.vinculoInventario)} : c);
          if (Array.isArray(account.exclusionesSincronizacion)) patch.exclusionesSincronizacion = account.exclusionesSincronizacion.map(rename);
        }
        tx.update(ref, patch);
      });
      await db.collection("auditoria_eventos").add({tipo:"inventario_cuenta_editada",inventarioId:docId,plataforma:current.plataforma||"",correoAnterior:current.correo||"",correoNuevo:update.correo||current.correo||"",
        ...(update.capacidad != null ? {capacidadAnterior:Number(current.capacidad)||0,capacidadNueva:update.capacidad} : {}),
        ...(update.url != null ? {urlAnterior:String(current.url||""),urlNueva:update.url} : {}),
        claveCambiada: clave != null,serviciosActualizados:sync.updated,usuario:usuarioAccion,createdAt:new Date().toISOString()});
      const cambioCorreo = update.correo && normEmail(update.correo) !== normEmail(current.correo);
      if (clave != null || cambioCorreo) {
        // Fase 2 · el resto del equipo se entera de que la ficha cambió (el aviso NO trae correo ni clave).
        await push.avisar(db, admin, { todos: true, excluir: usuarioAccion,
          titulo: `🔑 Cuenta ${String(current.plataforma || "").toUpperCase()} actualizada`,
          cuerpo: `${cambioCorreo && clave != null ? "Cambió correo y clave" : cambioCorreo ? "Cambió el correo" : "Cambió la clave"} · ${sync.updated} ficha(s) ya actualizadas.`,
          data: { tipo: "cuenta", ir: "clientes" } });
      }
      return res.status(200).json({ ok: true, serviciosActualizados: sync.updated, documentosActualizados: sync.documents });
    }

    if (accion === "quitarCliente") {
      const [linked] = await reconciliarInventario(db, [{...current, id:docId}]);
      const clients = Array.isArray(linked.clientes) ? linked.clientes : [];
      const index = findInventoryClientIndex(clients, clienteIndex, nombreCliente, slot);
      if (index < 0) return res.status(200).json({ error: "No encontré ese cliente dentro de la cuenta." });
      const removed = clients[index] || {};
      const next = clients.filter((_, i) => i !== index);
      const cap = Math.max(next.length, Number(current.capacidad) || clients.length || 1);
      const exclusions = Array.isArray(linked.exclusionesSincronizacion) ? linked.exclusionesSincronizacion : [];
      if (removed.vinculoInventario && !exclusions.includes(removed.vinculoInventario)) exclusions.push(removed.vinculoInventario);
      await ref.update({clientes:next,exclusionesSincronizacion:exclusions,ocupados:next.length,disponibles:Math.max(0,cap-next.length),updatedAt:new Date().toISOString()});
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
      updated.edicionManualInventario = true;
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
