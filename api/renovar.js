// api/renovar.js  ·  VERSION 16  ·  renovación por documento/servicio exactos y verificación posterior
//
// Usa Firebase Admin con una cuenta de servicio (clave privada), NO el config público.
// Variables en Vercel:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY

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

function parseFechaDMY(fechaStr) {
  const m = String(fechaStr || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]), mes = Number(m[2]), y = Number(m[3]);
  const fecha = new Date(y, mes - 1, d);
  if (fecha.getFullYear() !== y || fecha.getMonth() !== mes - 1 || fecha.getDate() !== d) return null;
  return fecha;
}

// Suma días a una fecha en formato DD/MM/YYYY y devuelve igual DD/MM/YYYY.
function sumarDias(fechaStr, dias) {
  const base = parseFechaDMY(fechaStr);
  const cantidad = Number(dias);
  if (!base || !Number.isInteger(cantidad) || cantidad <= 0) return "";
  base.setDate(base.getDate() + cantidad);
  const dd = String(base.getDate()).padStart(2, "0");
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${base.getFullYear()}`;
}

function normPlat(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

// Clave "dura": quita todo lo que no sea letra/número (espacios, +, -, /, etc.)
// para poder comparar valores guardados con distinto formato (código interno de la
// ficha vs. etiqueta importada de Excel/bot viejo) sin que un simple espacio o un
// "+" rompan la coincidencia.
function normPlatKey(v) {
  return normPlat(v).replace(/[^a-z0-9]/g, "");
}

// Alias conocidos: distintas formas en que puede haber quedado guardada la misma
// plataforma según de dónde vino el dato (ficha nueva, Excel importado, bot viejo).
const PLAT_ALIASES = {
  netflix: "netflix", netflixpremium: "netflix",
  vipnetflix: "vipnetflix", vip: "vipnetflix",
  disneyp: "disneyp", disneypremium: "disneyp",
  disneys: "disneys", disneystandard: "disneys",
  disney: "disney",
  hbomax: "hbomax", hbo: "hbomax", max: "hbomax",
  primevideo: "primevideo", prime: "primevideo",
  paramount: "paramount", paramountp: "paramount",
  crunchyroll: "crunchyroll",
  vix: "vix",
  appletv: "appletv", apple: "appletv",
  universal: "universal", universalp: "universal",
  spotify: "spotify", youtube: "youtube", deezer: "deezer", duolingo: "duolingo",
  canva: "canva", gemini: "gemini", chatgpt: "chatgpt",
  office: "office", microsoft: "office", star: "star"
};
function canonPlat(v) {
  const key = normPlatKey(v);
  if (PLAT_ALIASES[key]) return PLAT_ALIASES[key];
  // oleada/iptv traen variantes con número de dispositivos (oleada1, iptv3, etc.):
  // se agrupan por el prefijo para no perder la coincidencia por esa cifra.
  if (key.startsWith("oleada")) return "oleada";
  if (key.startsWith("iptv")) return "iptv";
  return key;
}

// Busca el índice del servicio dentro del array guardado en Firestore. El índice
// explícito solo se acepta si también coincide con plataforma/correo; así un índice
// válido pero perteneciente a otra ficha no puede renovar el servicio equivocado.
function normCorreo(v) {
  return String(v || "").trim().toLowerCase();
}

function servicioCoincide(servicio, { plataforma, correo } = {}) {
  const tienePlataforma = !!String(plataforma || "").trim();
  const tieneCorreo = !!normCorreo(correo);
  if (tienePlataforma && canonPlat(servicio && servicio.plataforma) !== canonPlat(plataforma)) return false;
  if (tieneCorreo && normCorreo(servicio && servicio.correo) !== normCorreo(correo)) return false;
  return true;
}

function resolveServicioIndex(servicios, { servicioIndex, plataforma, correo } = {}) {
  const lista = Array.isArray(servicios) ? servicios : [];
  const tieneCriterio = !!String(plataforma || "").trim() || !!normCorreo(correo);
  if (servicioIndex != null && Number.isInteger(Number(servicioIndex))) {
    const i = Number(servicioIndex);
    if (i >= 0 && i < lista.length && (!tieneCriterio || servicioCoincide(lista[i], { plataforma, correo }))) return i;
  }
  if (tieneCriterio) {
    const idx = lista.findIndex(s => servicioCoincide(s, { plataforma, correo }));
    if (idx !== -1) return idx;
  }
  if (lista.length === 1 && (!tieneCriterio || servicioCoincide(lista[0], { plataforma, correo }))) return 0;
  return -1;
}

function servicioNoUsaPinPerfil(plataforma) {
  const p = normPlat(plataforma).replace(/\s+/g, "");
  return (
    p.includes("netflixvip") ||
    (p.includes("netflix") && p.includes("vip")) ||
    p.includes("spotify") ||
    p.includes("deezer") ||
    p.includes("youtube") ||
    p.includes("office") ||
    p.includes("vix") ||
    p.includes("canva") ||
    p.includes("gemini") ||
    p.includes("chatgpt") ||
    p.includes("duolingo") ||
    p.includes("oleada") ||
    p.includes("iptv")
  );
}

function servicioNoUsaClave(plataforma) {
  const p = normPlat(plataforma).replace(/\s+/g, "");
  return (
    p.includes("universal") ||
    p.includes("canva") ||
    p.includes("gemini") ||
    p.includes("chatgpt") ||
    p.includes("duolingo")
  );
}

function normName(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

function normPhone(v) {
  return String(v || "").replace(/\D/g, "");
}

function safeDocId(v) {
  const x = String(v || "cliente")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return x || "cliente";
}

// Valida un ID recibido desde una fila ya cargada. No lo transforma: debe
// apuntar exactamente al documento de Firestore que el usuario está viendo.
function cleanExistingDocId(v) {
  const id = String(v || "").trim();
  return id && id.length <= 1500 && !id.includes("/") ? id : "";
}

function aFechaFB(f) {
  if (!f) return "";
  const s = String(f);
  if (s.includes("/")) return s;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

function isoNow() {
  return new Date().toISOString();
}

function parseMoney(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const clean = String(v).replace(/Lps\.?/gi, "").replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}

// Ajusta los cupos de una cuenta del inventario buscándola por correo.
// modo "ocupar": suma el cliente y descuenta 1 disponible.
// modo "liberar": quita el cliente y suma 1 disponible.
//
// ⚠️ FIX: antes, "ya existe" se checaba por nombre + PIN exactos. Si el PIN
// guardado no coincidía letra por letra con el que llegaba en la renovación
// (ej: uno vacío "" y el otro "0000"), el cliente se consideraba "nuevo" y se
// duplicaba en el arreglo — cada renovación con un PIN levemente distinto
// agregaba otra copia. Ahora la identidad es SOLO por nombre; si el PIN
// cambió, se actualiza en el mismo registro en vez de crear uno nuevo.
// También se agregó el tope de capacidad, que antes no existía acá (por eso
// una cuenta de 5 cupos podía terminar con 15 "clientes").
async function ajustarInventario(db, { modo, correo, nombreCliente, pin }) {
  if (!correo) return { tocado: false, motivo: "sin correo" };
  try {
    const invSnap = await db.collection("inventario").where("correo", "==", correo).get();
    if (invSnap.empty) return { tocado: false, motivo: "correo no está en inventario" };
    const ref = invSnap.docs[0].ref;
    const data = invSnap.docs[0].data();
    let clientes = Array.isArray(data.clientes) ? [...data.clientes] : [];
    const cap = Number(data.capacidad) || 0;

    if (modo === "ocupar") {
      const idxExiste = clientes.findIndex(c => normName(c.nombre) === normName(nombreCliente));
      const pinNorm = String(pin || "").trim();
      if (idxExiste !== -1) {
        // Ya está: si el PIN cambió, se actualiza en el mismo registro (nunca duplica).
        if (pinNorm && String(clientes[idxExiste].pin || "") !== pinNorm) {
          clientes[idxExiste] = { ...clientes[idxExiste], pin: pinNorm };
        }
      } else if (cap > 0 && clientes.length >= cap) {
        return { tocado: false, motivo: "cuenta llena", ocupados: clientes.length, capacidad: cap };
      } else {
        const usados = clientes.map(c => Number(c.slot) || 0);
        let slot = 1; while (usados.includes(slot)) slot++;
        clientes.push({ nombre: nombreCliente || "—", pin: pinNorm, slot });
      }
    } else if (modo === "liberar") {
      const i = clientes.findIndex(c => (nombreCliente && normName(c.nombre) === normName(nombreCliente)));
      if (i !== -1) clientes.splice(i, 1);
      else if (clientes.length) clientes.pop();
    }

    const ocupados = clientes.length;
    const disponibles = Math.max(0, cap - ocupados);
    const update = {
      clientes,
      ocupados,
      disponibles,
      updatedAt: isoNow()
    };
    if (data.disp != null) update.disp = disponibles;
    await ref.update(update);
    return { tocado: true, ocupados, disponibles };
  } catch (e) {
    return { tocado: false, motivo: e.message };
  }
}

async function findCliente(db, { clienteNorm, telefono, nombrePerfil }) {
  // ✅ FIX: ya NO se busca/empareja por teléfono. El teléfono que llega en la
  // ficha muchas veces es el número de contacto del vendedor (autocompletado
  // por el panel, o simplemente el mismo número que cada asesor escribe por
  // costumbre) — NO identifica a un cliente en particular. Usarlo para
  // encontrar/crear el documento hacía que distintos clientes del mismo
  // vendedor cayeran en el MISMO documento de Firestore y se pisaran el
  // nombre entre ellos. El teléfono se sigue guardando (para mostrarlo en el
  // bot), pero el nombre es la única llave real de identidad del cliente.
  const n = clienteNorm || normName(nombrePerfil);

  if (n) {
    const snap = await db.collection("clientes").where("nombre_norm", "==", n).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }

  return null;
}

function buildServicio(servicio = {}, fichaTexto = "") {
  // Modelo limpio del CRM:
  //   clave     = contraseña/acceso de la cuenta cuando aplique
  //   pinPerfil = PIN del perfil cuando aplique
  // Reglas principales:
  //   Netflix Premium, HBO Max, Disney Premium/Standard, Crunchyroll, Prime Video y Universal+ llevan correo + clave + PIN.
  //   Netflix VIP, Spotify, YouTube, Deezer, Office 365, Oleada e IPTV llevan clave, pero no PIN.
  //   ViX+, Canva, Gemini, ChatGPT y Duolingo son solo correo.
  const tieneClaveNueva =
    servicio.clave != null || servicio.password != null || servicio.contrasena != null || servicio.pinClave != null;
  const sinPinPerfil = servicio.sinPinPerfil === true || servicio.removePinPerfil === true || servicio.pinPerfil === null || servicioNoUsaPinPerfil(servicio.plataforma);
  const sinClave = servicio.sinClave === true || servicio.removeClave === true || servicioNoUsaClave(servicio.plataforma);

  const clave = sinClave ? "" : (servicio.clave != null
    ? String(servicio.clave || "")
    : String(servicio.password || servicio.contrasena || servicio.pinClave || (!tieneClaveNueva ? servicio.pin || "" : "")));

  const pinPerfil = sinPinPerfil ? "" : (servicio.pinPerfil != null
    ? String(servicio.pinPerfil || "")
    : String(servicio.pin_perfil || servicio.perfilPin || servicio.pinDePerfil || servicio.pin_de_perfil || (tieneClaveNueva && servicio.pin != null ? servicio.pin || "" : "")));

  const out = {
    plataforma: servicio.plataforma || "",
    precio: parseMoney(servicio.precio || servicio.precioLps || servicio.pago || servicio.monto),
    fechaRenovacion: aFechaFB(servicio.fechaRenovacion || ""),
    correo: servicio.correo || "",
    clave,
    perfil: servicio.perfil || "",
    updatedAt: isoNow()
  };

  if (sinClave) out.sinClave = true;
  if (sinPinPerfil) out.sinPinPerfil = true;
  else if (pinPerfil) out.pinPerfil = pinPerfil;

  if (fichaTexto) {
    out.fichaTexto = fichaTexto;
    out.fichaActualizadaAt = isoNow();
  }
  return out;
}

function limpiarServicioCRM(servicio = {}) {
  const s = { ...servicio };
  const tieneClave = s.clave != null && String(s.clave) !== "";

  if ((s.pinPerfil == null || s.pinPerfil === "") && s.pin_perfil != null) s.pinPerfil = s.pin_perfil;
  if ((s.pinPerfil == null || s.pinPerfil === "") && s.perfilPin != null) s.pinPerfil = s.perfilPin;

  // Bases antiguas: "pin" era la clave. Versiones intermedias: "pin" pudo ser PIN de perfil.
  if (!tieneClave && s.pin != null) s.clave = String(s.pin || "");
  if (tieneClave && (s.pinPerfil == null || s.pinPerfil === "") && s.pin != null) s.pinPerfil = String(s.pin || "");

  if (servicioNoUsaClave(s.plataforma)) s.clave = "";
  if (servicioNoUsaPinPerfil(s.plataforma)) delete s.pinPerfil;
  if (s.pinPerfil == null || s.pinPerfil === "") delete s.pinPerfil;
  delete s.pin;
  delete s.pin_perfil;
  delete s.perfilPin;
  delete s.pinClave;
  delete s.sinClave;
  delete s.removeClave;
  delete s.sinPinPerfil;
  delete s.removePinPerfil;
  return s;
}

function aplicarNuevoServicio(servicioAnterior, nuevo) {
  const merged = { ...(servicioAnterior || {}), ...nuevo };
  if (nuevo && nuevo.sinClave) {
    merged.clave = "";
    delete merged.password;
    delete merged.contrasena;
    delete merged.pinClave;
  }
  if (nuevo && nuevo.sinPinPerfil) {
    delete merged.pinPerfil;
    delete merged.pin_perfil;
    delete merged.perfilPin;
    delete merged.pin;
  }
  delete merged.sinClave;
  delete merged.removeClave;
  delete merged.sinPinPerfil;
  delete merged.removePinPerfil;
  return limpiarServicioCRM(merged);
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(200).json({ ok: true, version: 16, msg: "renovar v16 activo (documento exacto + verificación Firebase). Usá POST." });

  const body = req.body || {};
  const { accion, clienteId, clienteNorm, telefono, plataforma, correo } = body;
  const acc = accion || "renovar";

  if (!clienteId && !clienteNorm && !telefono && acc !== "ficha_upsert")
    return res.status(200).json({ error: "Falta identificar el cliente." });

  try {
    const db = getApp().firestore();
    const authUser = await requireFirebaseUser(req, res);
    if (!authUser) return;

    // NUEVO: crear o actualizar cliente + servicio desde el panel de entrega de ficha.
    if (acc === "ficha_upsert") {
      const cliente = body.cliente || {};
      const servicio = body.servicio || {};
      const nombrePerfil = cliente.nombrePerfil || cliente.nombre || body.nombrePerfil || "";
      const tel = cliente.telefono || telefono || ""; // se guarda tal cual, solo para mostrar — ya no identifica al cliente
      const vendedor = cliente.vendedor || body.vendedor || "";
      const nNorm = cliente.nombre_norm || clienteNorm || normName(nombrePerfil);
      const tNorm = normPhone(tel);

      if (!nombrePerfil && !tel) return res.status(200).json({ error: "Ponga nombre o teléfono del cliente." });
      if (!servicio.plataforma) return res.status(200).json({ error: "Falta la plataforma de la ficha." });

      // Si la ficha se abrió desde una fila existente, actualiza exactamente
      // ese documento. El nombre queda solo como compatibilidad para fichas nuevas.
      const exactId = cleanExistingDocId(clienteId);
      if (clienteId && !exactId) return res.status(200).json({ error: "El identificador del cliente no es válido." });
      let doc = null;
      if (exactId) {
        const exactDoc = await db.collection("clientes").doc(exactId).get();
        if (!exactDoc.exists) return res.status(200).json({ error: "La ficha seleccionada ya no existe. Recargue la lista." });
        doc = exactDoc;
      } else {
        doc = await findCliente(db, { clienteNorm: nNorm, nombrePerfil });
      }
      let docRef, data = {}, created = false;

      if (doc) {
        docRef = doc.ref;
        data = doc.data() || {};
      } else {
        created = true;
        // ✅ El ID del documento nuevo se basa SIEMPRE en el nombre, nunca en
        // el teléfono (antes "tel-<numero>" hacía que dos clientes distintos
        // con el mismo teléfono compartido cayeran en el mismo documento).
        const idBase = safeDocId(nNorm || nombrePerfil);
        docRef = db.collection("clientes").doc(idBase);
        const existing = await docRef.get();
        if (existing.exists) {
          created = false;
          data = existing.data() || {};
        }
      }

      let servicios = Array.isArray(data.servicios) ? data.servicios.map(limpiarServicioCRM) : [];
      const nuevo = buildServicio(servicio, body.fichaTexto || "");
      const pNorm = normPlat(nuevo.plataforma);
      const correoNorm = String(nuevo.correo || "").trim().toLowerCase();

      // Match estricto: misma plataforma + mismo correo = es el mismo servicio (se actualiza).
      let idx = servicios.findIndex(s =>
        normPlat(s.plataforma) === pNorm &&
        String(s.correo || "").trim().toLowerCase() === correoNorm
      );
      // Solo si NO hay correo (ej. algunas cuentas IPTV) caemos a emparejar por plataforma,
      // y únicamente contra otro servicio que tampoco tenga correo — así nunca se pisa un
      // servicio de la misma plataforma que sí tiene su propio correo (multi-perfil).
      if (idx === -1 && !correoNorm) {
        idx = servicios.findIndex(s =>
          normPlat(s.plataforma) === pNorm && !String(s.correo || "").trim()
        );
      }

      const correoAnterior = idx >= 0 ? String(servicios[idx].correo || "").trim().toLowerCase() : "";

      if (idx >= 0) servicios[idx] = aplicarNuevoServicio(servicios[idx], nuevo);
      else servicios.push(aplicarNuevoServicio({}, nuevo));

      const nombreFinal = nombrePerfil || data.nombrePerfil || data.nombre || "—";

      const update = {
        nombrePerfil: nombreFinal,
        nombre: nombreFinal,
        nombre_norm: nNorm || data.nombre_norm || normName(nombrePerfil),
        telefono: tel || data.telefono || "",
        telefono_norm: tNorm || data.telefono_norm || "",
        vendedor: vendedor || data.vendedor || "",
        servicios: servicios.map(limpiarServicioCRM),
        updatedAt: isoNow()
      };
      if (created) update.createdAt = isoNow();

      await docRef.set(update, { merge: true });

      // Sincroniza el cupo en inventario (esto antes NO se hacía en ficha_upsert,
      // por eso el correo aparecía "sin perfiles" aunque la ficha se hubiera guardado).
      let invResult = null;
      try {
        if (correoAnterior && correoAnterior !== correoNorm) {
          // Cambió de correo/cuenta: libera el cupo viejo y ocupa el nuevo.
          await ajustarInventario(db, { modo: "liberar", correo: correoAnterior, nombreCliente: nombreFinal });
        }
        if (correoNorm) {
          invResult = await ajustarInventario(db, {
            modo: "ocupar",
            correo: nuevo.correo,
            nombreCliente: nombreFinal,
            pin: nuevo.pinPerfil || ""
          });
        }
      } catch (e) {
        invResult = { tocado: false, motivo: e.message };
      }

      return res.status(200).json({
        ok: true,
        accion: acc,
        created,
        clienteId: docRef.id,
        totalServicios: servicios.length,
        servicioActualizado: idx >= 0,
        inventario: invResult
      });
    }

    const query = db.collection("clientes");
    let snap;
    const exactId = cleanExistingDocId(clienteId);
    if (clienteId && !exactId) return res.status(200).json({ error: "El identificador del cliente no es válido." });
    if (exactId) {
      const exactDoc = await query.doc(exactId).get();
      if (!exactDoc.exists) return res.status(200).json({ error: "La ficha seleccionada ya no existe. Recargue la lista." });
      snap = { empty: false, docs: [exactDoc] };
    } else {
      if (clienteNorm) snap = await query.where("nombre_norm", "==", clienteNorm).limit(5).get();
      if ((!snap || snap.empty) && telefono) snap = await query.where("telefono", "==", telefono).limit(5).get();
      if (!snap || snap.empty) {
        const doc = await findCliente(db, { clienteNorm, telefono });
        if (doc) snap = { empty: false, docs: [doc] };
      }
    }
    if (!snap || snap.empty)
      return res.status(200).json({ error: "No encontré ese cliente en la base." });

    // ⚠️ FIX: si hay dos fichas distintas con el mismo nombre_norm (una
    // colisión — el mismo cliente quedó duplicado en dos documentos), antes
    // se tomaba SIEMPRE la primera que devolviera Firestore, sin fijarse si
    // esa era la ficha que realmente tenía el servicio que se quería renovar.
    // Eso hacía que "renovar" pareciera no hacer nada: el cambio se guardaba
    // en la ficha duplicada equivocada, no en la que el usuario veía en
    // pantalla. Ahora, si hay más de una coincidencia, se elige la que sí
    // tiene el servicio pedido (por plataforma o índice).
    let elegido = snap.docs[0];
    if (snap.docs.length > 1) {
      const conServicio = snap.docs.find(d => {
        const servs = Array.isArray(d.data().servicios) ? d.data().servicios : [];
        return resolveServicioIndex(servs, { servicioIndex: body.servicioIndex, plataforma, correo }) !== -1;
      });
      if (conServicio) elegido = conServicio;
    }

    const docRef = elegido.ref;
    const data = elegido.data();
    let servicios = Array.isArray(data.servicios) ? data.servicios : [];
    let invResult = null;

    let fechaAnterior = null, fechaNueva = null, touchedIndex = null;

    if (acc === "renovar") {
      const { dias, fechaActual, fechaExacta, servicioIndex } = body;
      if (!plataforma && servicioIndex == null)
        return res.status(200).json({ error: "Faltan datos (plataforma o fecha)." });
      if (!dias && !fechaExacta)
        return res.status(200).json({ error: "Faltan datos (plataforma o fecha)." });

      const idx = resolveServicioIndex(servicios, { servicioIndex, plataforma, correo });
      if (idx === -1) return res.status(200).json({ error: "No encontré esa plataforma en el cliente." });

      const s = servicios[idx];
      // 🔎 DIAGNÓSTICO: de qué fecha REALMENTE está partiendo el servidor
      // (la que ya está guardada en Firestore para este servicio), para poder
      // compararla con la que se ve en pantalla.
      fechaAnterior = s.fechaRenovacion || fechaActual || null;
      const nuevaFecha = fechaExacta ? aFechaFB(fechaExacta) : sumarDias(s.fechaRenovacion || fechaActual, parseInt(dias, 10));
      if (!parseFechaDMY(nuevaFecha)) return res.status(200).json({ error: "La fecha de renovación no es válida." });
      fechaNueva = nuevaFecha;
      touchedIndex = idx;
      servicios[idx] = { ...s, fechaRenovacion: nuevaFecha, updatedAt: isoNow() };

    } else if (acc === "eliminar") {
      const { servicioIndex } = body;
      if (!plataforma && servicioIndex == null) return res.status(200).json({ error: "Falta la plataforma a eliminar." });
      const idx = resolveServicioIndex(servicios, { servicioIndex, plataforma, correo });
      if (idx === -1) return res.status(200).json({ error: "No encontré esa plataforma en el cliente." });

      const servEliminado = servicios[idx];
      servicios = servicios.filter((_, i) => i !== idx);

      invResult = await ajustarInventario(db, {
        modo: "liberar",
        correo: servEliminado.correo,
        nombreCliente: data.nombrePerfil || data.nombre || ""
      });

    } else if (acc === "agregar") {
      const { servicio } = body;
      if (!servicio || !servicio.plataforma) return res.status(200).json({ error: "Faltan datos del servicio nuevo." });

      const nuevo = buildServicio(servicio, "");
      servicios = [...servicios, nuevo];

      invResult = await ajustarInventario(db, {
        modo: "ocupar",
        correo: nuevo.correo,
        nombreCliente: data.nombrePerfil || data.nombre || "",
        pin: nuevo.pinPerfil || ""
      });

    } else if (acc === "editar") {
      const { plataformaOriginal, correoOriginal, servicio, servicioIndex } = body;
      const buscar = plataformaOriginal || plataforma;
      if (!buscar && servicioIndex == null) return res.status(200).json({ error: "Faltan datos para editar." });
      if (!servicio) return res.status(200).json({ error: "Faltan datos para editar." });

      const idx = resolveServicioIndex(servicios, { servicioIndex, plataforma: buscar, correo: correoOriginal || correo });
      if (idx === -1) return res.status(200).json({ error: "No encontré ese servicio." });

      const nuevo = buildServicio({
        plataforma: servicio.plataforma || servicios[idx].plataforma,
        precio: servicio.precio != null ? servicio.precio : servicios[idx].precio,
        fechaRenovacion: servicio.fechaRenovacion ? servicio.fechaRenovacion : servicios[idx].fechaRenovacion,
        correo: servicio.correo != null ? servicio.correo : (servicios[idx].correo || ""),
        clave: servicio.clave != null ? servicio.clave : (servicios[idx].clave || servicios[idx].pin || ""),
        pinPerfil: servicio.pinPerfil != null ? servicio.pinPerfil : (servicios[idx].pinPerfil || servicios[idx].pin_perfil || servicios[idx].perfilPin || "")
      }, servicio.fichaTexto || servicios[idx].fichaTexto || "");

      servicios[idx] = aplicarNuevoServicio(servicios[idx], nuevo);

    } else {
      return res.status(200).json({ error: "Acción no reconocida." });
    }

    await docRef.update({ servicios: servicios.map(limpiarServicioCRM), updatedAt: isoNow() });

    // Una respuesta de escritura no basta: vuelve a leer el documento y solo
    // confirma la renovación si Firebase devuelve la fecha nueva en el mismo índice.
    const persistedDoc = await docRef.get();
    if (!persistedDoc.exists) return res.status(200).json({ error: "Firebase no devolvió la ficha después de guardarla." });
    const persistedData = persistedDoc.data() || {};
    const persistedServices = Array.isArray(persistedData.servicios) ? persistedData.servicios : [];
    let verified = true;
    if (acc === "renovar") {
      const persisted = touchedIndex == null ? null : persistedServices[touchedIndex];
      verified = !!persisted &&
        servicioCoincide(persisted, { plataforma, correo }) &&
        String(persisted.fechaRenovacion || "") === String(fechaNueva || "");
      if (!verified) return res.status(200).json({
        ok: false,
        verified: false,
        error: "Firebase no confirmó la nueva fecha. Recargue e intente nuevamente.",
        clienteId: docRef.id,
        servicioIndex: touchedIndex,
        fechaAnterior,
        fechaNueva
      });
    }

    const serviciosResumen = persistedServices.map((s, i) => `${i}:${s.plataforma || "?"}=${s.fechaRenovacion || "?"}`);
    return res.status(200).json({
      ok: true,
      verified,
      accion: acc,
      totalServicios: persistedServices.length,
      inventario: invResult,
      clienteId: docRef.id,
      servicioIndex: touchedIndex,
      fechaAnterior,
      fechaNueva,
      serviciosResumen
    });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ error: "Error: " + (e.message || "") });
  }
}
