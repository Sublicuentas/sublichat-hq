// api/renovar.js  ·  VERSION 22  ·  URL permanente + reglas reales de entrega
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
  office: "office", microsoft: "office", star: "star",
  viki: "viki", rakutenviki: "viki",
  windows10: "windows10", win10: "windows10",
  windows11: "windows11", win11: "windows11",
  adobeexpress: "adobeexpress", adobe: "adobeexpress",
  eset: "eset", esetnod32: "eset"
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

function familiaInventario(v) {
  const p = canonPlat(v);
  return ["disneyp", "disneys", "disney"].includes(p) ? "disney" : p;
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
    p.includes("paramount") ||
    p.includes("appletv") ||
    p.includes("vix") ||
    p.includes("canva") ||
    p.includes("gemini") ||
    p.includes("chatgpt") ||
    p.includes("duolingo") ||
    p.includes("oleada") ||
    p.includes("iptv") ||
    p.includes("viki") ||
    p.includes("windows") ||
    p.includes("adobe") ||
    p.includes("eset")
  );
}

function servicioNoUsaClave(plataforma) {
  const p = normPlat(plataforma).replace(/\s+/g, "");
  return (
    p.includes("canva") ||
    p.includes("gemini") ||
    p.includes("chatgpt") ||
    p.includes("duolingo") ||
    p.includes("adobeexpress")
  );
}

function servicioEsSerial(plataforma) {
  const p = canonPlat(plataforma);
  return p === "windows10" || p === "windows11" || p === "eset";
}

function servicioCredencialesSiempre(plataforma) {
  const p = canonPlat(plataforma);
  if (p.includes("netflix") && p.includes("vip")) return true;
  return [
    "vipnetflix", "spotify", "youtube", "oleada", "iptv",
    "viki", "deezer", "crunchyroll"
  ].includes(p);
}

function servicioUsaSelectorDispositivo(plataforma) {
  const p = canonPlat(plataforma);
  return ["netflix", "disneyp", "disneys", "hbomax", "vix", "universal", "primevideo"].includes(p);
}

function servicioRequiereCorreo(plataforma) {
  return !servicioEsSerial(plataforma);
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

// Un cliente puede comprar para sí mismo o para terceros. Cada persona que
// realmente usa las cuentas recibe una sola URL permanente, aunque sus
// plataformas y fechas de renovación sean diferentes.
function datosBeneficiario(servicio = {}, nombreTitular = "") {
  const tipoGuardado = String(servicio.beneficiarioTipo || "").trim().toLowerCase();
  const tipo = tipoGuardado === "tercero" ? "tercero" : "titular";
  const nombreTercero = String(servicio.beneficiarioNombre || servicio.beneficiario || "").trim();
  const nombre = tipo === "tercero" ? nombreTercero : String(nombreTitular || "Cliente").trim();
  const key = tipo === "tercero" ? `tercero-${safeDocId(normName(nombre) || "persona")}` : "titular";
  return { tipo, nombre: nombre || String(nombreTitular || "Cliente").trim(), key };
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

function recordId(prefix = "id") {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

// VERSION 20 · token público para la ficha del cliente (/c/{token}).
// Alfabeto sin caracteres ambiguos (0/O, 1/l/I) por si alguien lo transcribe a mano.
function genToken(len = 11) {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function prepararAccesosBeneficiarios({ servicios = [], registroAnterior = {}, nombreTitular = "", tokenTitularAnterior = "" } = {}) {
  const lista = Array.isArray(servicios) ? servicios : [];
  const anterior = registroAnterior && typeof registroAnterior === "object" && !Array.isArray(registroAnterior)
    ? registroAnterior : {};
  const registro = {};
  const grupos = new Map();
  lista.forEach(servicio => {
    const b = datosBeneficiario(servicio, nombreTitular);
    servicio.beneficiarioTipo = b.tipo;
    servicio.beneficiarioNombre = b.nombre;
    servicio.beneficiarioKey = b.key;
    if (!grupos.has(b.key)) grupos.set(b.key, { beneficiario: b, servicios: [] });
    grupos.get(b.key).servicios.push(servicio);
  });

  const activos = new Set(grupos.keys());
  const propietarioAnterior = new Map();
  Object.entries(anterior).forEach(([key, value]) => {
    const token = String(value?.token || "").trim();
    if (token) propietarioAnterior.set(token, key);
  });
  const usados = new Set();
  const elegirToken = (key, serviciosGrupo = []) => {
    const candidatos = [
      anterior[key]?.token,
      key === "titular" ? tokenTitularAnterior : "",
      ...serviciosGrupo.map(s => s?.token)
    ].map(x => String(x || "").trim()).filter(Boolean);
    for (const token of candidatos) {
      const propietario = propietarioAnterior.get(token);
      if (usados.has(token)) continue;
      if (propietario && propietario !== key && activos.has(propietario)) continue;
      usados.add(token);
      return token;
    }
    let token = genToken();
    while (usados.has(token)) token = genToken();
    usados.add(token);
    return token;
  };

  // Titular primero para conservar el enlace histórico del cliente siempre
  // que todavía tenga al menos un servicio propio.
  const orden = [...grupos.keys()].sort((a, b) => a === "titular" ? -1 : b === "titular" ? 1 : a.localeCompare(b));
  orden.forEach(key => {
    const grupo = grupos.get(key);
    const b = grupo.beneficiario;
    const token = elegirToken(key, grupo.servicios);
    registro[b.key] = {
      ...(anterior[b.key] || {}),
      tipo: b.tipo,
      nombre: b.nombre,
      token,
      updatedAt: isoNow()
    };
  });

  // Se conserva una raíz para compatibilidad del CRM; si el titular aún no
  // tiene servicios, su URL no se publica y por eso no expone ningún acceso.
  const tokenTitular = String(
    registro.titular?.token || tokenTitularAnterior || anterior.titular?.token || genToken()
  ).trim();
  return { registro, tokenTitular };
}

async function sincronizarEnlacesPublicos(db, { clienteId, servicios = [], registro = {} } = {}) {
  const tokensGrupo = new Set(
    Object.values(registro).map(x => String(x?.token || "").trim()).filter(Boolean)
  );
  const batch = db.batch();

  // Los tokens antiguos que no fueron elegidos como URL unificada siguen
  // resolviendo su servicio puntual, para no romper mensajes ya enviados.
  servicios.forEach((servicio, servicioIndex) => {
    const token = String(servicio?.token || "").trim();
    if (!token || tokensGrupo.has(token)) return;
    batch.set(db.collection("enlaces").doc(token), {
      tipo: "servicio",
      clienteId,
      servicioIndex,
      compraId: String(servicio?.compraId || ""),
      plataforma: servicio?.plataforma || "",
      activo: true,
      updatedAt: isoNow()
    }, { merge: true });
  });

  Object.entries(registro).forEach(([beneficiarioKey, acceso]) => {
    const token = String(acceso?.token || "").trim();
    if (!token) return;
    batch.set(db.collection("enlaces").doc(token), {
      tipo: "beneficiario",
      clienteId,
      beneficiarioKey,
      beneficiarioNombre: String(acceso?.nombre || ""),
      activo: true,
      updatedAt: isoNow()
    }, { merge: true });
  });

  await batch.commit();
}

// VERSION 20 · Regla NUEVA confirmada (11-ago-2026): en celular, estas plataformas
// se entregan SOLO con correo — el cliente inicia sesión con "código", no con clave.
// No confundir con servicioNoUsaClave/servicioNoUsaPinPerfil, que rigen lo que se
// GUARDA en el CRM (la clave real sigue guardándose como respaldo interno). Esta
// regla solo controla qué se muestra en la ficha pública /c/{token} y en el
// mensaje corto de WhatsApp.
function celularSoloCodigo(plataforma) {
  const p = normPlat(plataforma).replace(/\s+/g, "");
  if (p.includes("netflix") && p.includes("vip")) return false; // Netflix VIP no entra aquí
  return (
    p.includes("disney") ||
    p.includes("hbo") || p === "max" ||
    p.includes("vix") ||
    p.includes("universal") ||
    p.includes("netflix")
  );
}

function perfilPinRaw(perfil = {}) {
  return String(
    perfil.pinPerfil ?? perfil.pin_perfil ?? perfil.perfilPin ?? perfil.pin ?? ""
  ).trim();
}

function perfilesOperativos(servicio = {}, nombreTitular = "") {
  const lista = Array.isArray(servicio.perfiles) && servicio.perfiles.length
    ? servicio.perfiles
    : [{
        perfilId: servicio.perfilId || "",
        nombre: servicio.nombrePerfil || servicio.perfil || nombreTitular || "Cliente",
        perfil: servicio.perfil || servicio.nombrePerfil || nombreTitular || "",
        correo: servicio.correo || "",
        clave: servicio.clave || servicio.password || servicio.contrasena || servicio.pin || "",
        pinPerfil: servicio.pinPerfil || servicio.pin_perfil || servicio.perfilPin || ""
      }];

  return lista.map((p, index) => ({
    perfilId: String(p?.perfilId || p?.id || ""),
    nombre: String(p?.nombre || p?.nombrePerfil || p?.cliente || p?.perfil || nombreTitular || `Perfil ${index + 1}`).trim(),
    perfil: String(p?.perfil || p?.nombrePerfil || p?.nombre || "").trim(),
    correo: String(p?.correo ?? servicio.correo ?? "").trim(),
    clave: String(p?.clave ?? p?.password ?? p?.contrasena ?? servicio.clave ?? servicio.password ?? servicio.contrasena ?? "").trim(),
    pinPerfil: perfilPinRaw(p) || (index === 0 ? perfilPinRaw(servicio) : "")
  }));
}

function normalizarPerfilesServicio(servicio = {}, anterior = {}, nombreTitular = "") {
  const tieneListaNueva = Array.isArray(servicio.perfiles);
  let base;
  if (tieneListaNueva && servicio.perfiles.length) base = servicio.perfiles;
  else if (!tieneListaNueva && Array.isArray(anterior.perfiles) && anterior.perfiles.length) base = anterior.perfiles;
  else base = perfilesOperativos({ ...anterior, ...servicio }, nombreTitular);

  const prev = perfilesOperativos(anterior, nombreTitular);
  const plataforma = servicio.plataforma || anterior.plataforma || "";
  const sinClave = servicioNoUsaClave(plataforma);
  const sinPin = servicioNoUsaPinPerfil(plataforma);

  return base.map((raw = {}, index) => {
    const previo = prev.find((p) => p.perfilId && p.perfilId === String(raw.perfilId || raw.id || "")) || prev[index] || {};
    const topCorreo = index === 0 && servicio.correo != null ? servicio.correo : undefined;
    const topClave = index === 0 && (servicio.clave != null || servicio.password != null || servicio.contrasena != null)
      ? (servicio.clave ?? servicio.password ?? servicio.contrasena ?? "")
      : undefined;
    const topPin = index === 0 && (servicio.pinPerfil != null || servicio.pin_perfil != null || servicio.perfilPin != null)
      ? (servicio.pinPerfil ?? servicio.pin_perfil ?? servicio.perfilPin ?? "")
      : undefined;
    const topNombre = index === 0 && servicio.perfil != null ? servicio.perfil : undefined;
    const nombre = String(topNombre ?? raw.nombre ?? raw.nombrePerfil ?? raw.cliente ?? raw.perfil ?? previo.nombre ?? nombreTitular ?? `Perfil ${index + 1}`).trim();
    const out = {
      perfilId: String(raw.perfilId || raw.id || previo.perfilId || recordId("perfil")),
      nombre,
      perfil: String(topNombre ?? raw.perfil ?? raw.nombrePerfil ?? raw.nombre ?? previo.perfil ?? nombre).trim(),
      correo: String(topCorreo ?? raw.correo ?? previo.correo ?? servicio.correo ?? anterior.correo ?? "").trim(),
      clave: sinClave ? "" : String(topClave ?? raw.clave ?? raw.password ?? raw.contrasena ?? previo.clave ?? servicio.clave ?? anterior.clave ?? "").trim()
    };
    const pin = sinPin ? "" : String(
      topPin ?? raw.pinPerfil ?? raw.pin_perfil ?? raw.perfilPin ?? raw.pin ?? previo.pinPerfil ?? ""
    ).trim();
    if (pin) out.pinPerfil = pin;
    return out;
  });
}

async function sincronizarInventarioServicio(db, { anterior = null, nuevo = null, nombreTitular = "" } = {}) {
  const antes = anterior ? perfilesOperativos(anterior, nombreTitular) : [];
  const despues = nuevo ? perfilesOperativos(nuevo, nombreTitular) : [];
  const plataformaAnterior = anterior?.plataforma || nuevo?.plataforma || "";
  const plataformaNueva = nuevo?.plataforma || anterior?.plataforma || "";
  const key = (p, plataforma) => `${familiaInventario(plataforma)}|${normCorreo(p.correo)}|${normName(p.nombre)}`;
  const nuevas = new Set(despues.map((p) => key(p, plataformaNueva)));
  const resultados = [];

  for (const p of antes) {
    if (!nuevas.has(key(p, plataformaAnterior))) {
      resultados.push(await ajustarInventario(db, {
        modo: "liberar", plataforma: plataformaAnterior, correo: p.correo, nombreCliente: p.nombre || nombreTitular, pin: p.pinPerfil || ""
      }));
    }
  }
  for (const p of despues) {
    resultados.push(await ajustarInventario(db, {
      modo: "ocupar", plataforma: plataformaNueva, correo: p.correo, nombreCliente: p.nombre || nombreTitular, pin: p.pinPerfil || ""
    }));
  }

  const ultimo = [...resultados].reverse().find((x) => x && x.tocado) || {};
  return {
    tocado: resultados.some((x) => x?.tocado),
    perfiles: despues.length,
    ocupados: ultimo.ocupados,
    disponibles: ultimo.disponibles,
    resultados,
    advertencias: resultados.filter((x) => x && !x.tocado && x.motivo).map((x) => x.motivo)
  };
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
async function ajustarInventario(db, { modo, plataforma, correo, nombreCliente, pin }) {
  if (!correo) return { tocado: false, motivo: "sin correo" };
  try {
    const correoOriginal = String(correo || "").trim();
    const correoNormalizado = normCorreo(correoOriginal);
    let invSnap = await db.collection("inventario").where("correo", "==", correoOriginal).get();
    if (invSnap.empty && correoNormalizado !== correoOriginal) {
      invSnap = await db.collection("inventario").where("correo", "==", correoNormalizado).get();
    }
    if (invSnap.empty) return { tocado: false, motivo: "correo no está en inventario" };
    const familiaBuscada = familiaInventario(plataforma);
    let cuenta = invSnap.docs.find((d) => familiaInventario(d.data()?.plataforma) === familiaBuscada) || null;
    // Compatibilidad con una cuenta antigua sin plataforma: solo es seguro usarla
    // cuando el correo devuelve un único documento.
    if (!cuenta && invSnap.docs.length === 1 && !String(invSnap.docs[0].data()?.plataforma || "").trim()) cuenta = invSnap.docs[0];
    if (!cuenta) return { tocado: false, motivo: `correo no está en inventario para ${familiaBuscada || "esa plataforma"}` };
    const ref = cuenta.ref;
    const data = cuenta.data();
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
    return { tocado: true, plataforma: familiaBuscada, ocupados, disponibles };
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

function buildServicio(servicio = {}, fichaTexto = "", anterior = {}, nombreTitular = "") {
  // Modelo limpio del CRM:
  //   clave     = contraseña/acceso de la cuenta cuando aplique
  //   pinPerfil = PIN del perfil cuando aplique
  // Reglas principales:
  //   Netflix Premium, HBO Max, Disney Premium/Standard, Crunchyroll, Prime Video y Universal+ llevan correo + clave + PIN.
  //   Netflix VIP, Paramount+, ViX+, Spotify, YouTube, Deezer, Office 365, Oleada e IPTV llevan clave, pero no PIN.
  //   Canva, Gemini, ChatGPT y Duolingo son solo correo.
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

  const perfiles = normalizarPerfilesServicio(servicio, anterior, nombreTitular);
  const principal = perfiles[0] || {};
  const beneficiario = datosBeneficiario({
    beneficiarioTipo: servicio.beneficiarioTipo != null ? servicio.beneficiarioTipo : anterior.beneficiarioTipo,
    beneficiarioNombre: servicio.beneficiarioNombre != null ? servicio.beneficiarioNombre : anterior.beneficiarioNombre,
    beneficiario: servicio.beneficiario != null ? servicio.beneficiario : anterior.beneficiario
  }, nombreTitular);
  const plataformaFinal = servicio.plataforma || anterior.plataforma || "";
  const usaDispositivo = servicioUsaSelectorDispositivo(plataformaFinal);
  const dispositivoFinal = usaDispositivo
    ? String(servicio.dispositivo != null ? servicio.dispositivo : (anterior.dispositivo || ""))
    : "";
  const out = {
    schemaVersion: 2,
    compraId: String(servicio.compraId || anterior.compraId || recordId("compra")),
    modalidad: perfiles.length > 1 ? "multiperfil" : "individual",
    plataforma: plataformaFinal,
    precio: parseMoney(servicio.precio || servicio.precioLps || servicio.pago || servicio.monto),
    fechaRenovacion: aFechaFB(servicio.fechaRenovacion || ""),
    correo: principal.correo || servicio.correo || "",
    clave: sinClave ? "" : (principal.clave || clave),
    perfil: principal.perfil || servicio.perfil || principal.nombre || "",
    perfiles,
    beneficiarioTipo: beneficiario.tipo,
    beneficiarioNombre: beneficiario.nombre,
    beneficiarioKey: beneficiario.key,
    // Solo las plataformas cuyo método cambia entre TV y celular conservan
    // esta selección. Netflix VIP y las cuentas con credenciales directas no
    // deben heredar por accidente la regla "TV ya vinculada".
    dispositivo: dispositivoFinal,       // "tv" | "cel" | ""
    esRoku: dispositivoFinal === "tv" ? !!servicio.esRoku : false,
    // Token de la ficha pública /c/{token}. Se genera una sola vez y se conserva
    // en renovaciones/ediciones para que el link que ya tiene el cliente no cambie.
    token: anterior.token || servicio.token || genToken(),
    updatedAt: isoNow()
  };

  if (sinClave) out.sinClave = true;
  if (sinPinPerfil) out.sinPinPerfil = true;
  else if (principal.pinPerfil || pinPerfil) out.pinPerfil = principal.pinPerfil || pinPerfil;

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
  if (Array.isArray(s.perfiles) && s.perfiles.length) {
    s.perfiles = s.perfiles.map((perfil, index) => {
      const p = { ...(perfil || {}) };
      p.perfilId = String(p.perfilId || p.id || recordId("perfil"));
      p.nombre = String(p.nombre || p.nombrePerfil || p.perfil || `Perfil ${index + 1}`).trim();
      p.perfil = String(p.perfil || p.nombrePerfil || p.nombre || "").trim();
      p.correo = String(p.correo ?? s.correo ?? "").trim();
      p.clave = servicioNoUsaClave(s.plataforma) ? "" : String(p.clave ?? p.password ?? p.contrasena ?? s.clave ?? "").trim();
      const pPin = servicioNoUsaPinPerfil(s.plataforma) ? "" : perfilPinRaw(p);
      if (pPin) p.pinPerfil = pPin;
      else delete p.pinPerfil;
      delete p.id; delete p.nombrePerfil; delete p.pin; delete p.pin_perfil; delete p.perfilPin;
      delete p.password; delete p.contrasena;
      return p;
    });
    s.modalidad = s.perfiles.length > 1 ? "multiperfil" : "individual";
    if (!s.compraId) s.compraId = recordId("compra");
    const principal = s.perfiles[0];
    s.correo = principal.correo || s.correo || "";
    s.clave = servicioNoUsaClave(s.plataforma) ? "" : (principal.clave || s.clave || "");
    s.perfil = principal.perfil || principal.nombre || s.perfil || "";
    if (principal.pinPerfil) s.pinPerfil = principal.pinPerfil;
    else delete s.pinPerfil;
  }
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
    return res.status(200).json({ ok: true, version: 22, msg: "renovar v22 activo (URL permanente y entrega por plataforma). Usá POST." });

  const body = req.body || {};
  const { accion, clienteId, clienteNorm, telefono, plataforma, correo } = body;
  const acc = accion || "renovar";

  if (!clienteId && !clienteNorm && !telefono && acc !== "ficha_upsert")
    return res.status(200).json({ error: "Falta identificar el cliente." });

  try {
    const db = getApp().firestore();
    const authUser = await requireFirebaseUser(req, res);
    if (!authUser) return;

    // Permite recuperar/generar las URLs de clientes antiguos desde
    // Clientes → Acciones, sin obligar a editar ni volver a guardar sus datos.
    if (acc === "asegurar_enlaces") {
      const exactId = cleanExistingDocId(clienteId);
      if (!exactId) return res.status(200).json({ error: "Falta identificar exactamente al cliente." });
      const docRef = db.collection("clientes").doc(exactId);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(200).json({ error: "La ficha seleccionada ya no existe. Recargue la lista." });
      const data = doc.data() || {};
      const nombreTitular = data.nombrePerfil || data.nombre || "Cliente";
      const servicios = Array.isArray(data.servicios) ? data.servicios.map(limpiarServicioCRM) : [];
      if (!servicios.length) return res.status(200).json({ error: "Este cliente todavía no tiene servicios para publicar." });

      const accesos = prepararAccesosBeneficiarios({
        servicios,
        registroAnterior: data.accesosBeneficiarios,
        nombreTitular,
        tokenTitularAnterior: data.tokenAcceso
      });
      const serviciosLimpios = servicios.map(limpiarServicioCRM);
      await docRef.update({
        servicios: serviciosLimpios,
        tokenAcceso: accesos.tokenTitular,
        accesosBeneficiarios: accesos.registro,
        updatedAt: isoNow()
      });
      await sincronizarEnlacesPublicos(db, {
        clienteId: docRef.id,
        servicios: serviciosLimpios,
        registro: accesos.registro
      });

      const solicitado = String(body.beneficiarioKey || "").trim();
      const key = accesos.registro[solicitado]
        ? solicitado
        : (accesos.registro.titular ? "titular" : Object.keys(accesos.registro)[0]);
      const token = String(accesos.registro[key]?.token || "");
      const enlaces = Object.fromEntries(Object.entries(accesos.registro).map(([beneficiarioKey, acceso]) => [beneficiarioKey, {
        nombre: String(acceso?.nombre || ""),
        linkPublico: acceso?.token ? `/c/${acceso.token}` : ""
      }]));
      return res.status(200).json({
        ok: true,
        accion: acc,
        clienteId: docRef.id,
        beneficiarioKey: key,
        linkPublico: token ? `/c/${token}` : "",
        enlaces
      });
    }

    // NUEVO: crear o actualizar cliente + servicio desde el panel de entrega de ficha.
    if (acc === "ficha_upsert") {
      const cliente = body.cliente || {};
      const servicio = body.servicio || {};
      const nombrePerfil = cliente.nombrePerfil || cliente.nombre || body.nombrePerfil || "";
      const tel = cliente.telefono || telefono || ""; // se guarda tal cual, solo para mostrar — ya no identifica al cliente
      const vendedor = cliente.vendedor || body.vendedor || "";
      const vendedorTelefonoPresente = cliente.vendedorTelefono != null || body.vendedorTelefono != null;
      const vendedorTelefono = cliente.vendedorTelefono || body.vendedorTelefono || "";
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
      const pNorm = normPlat(servicio.plataforma);
      const correoEntrada = Array.isArray(servicio.perfiles) && servicio.perfiles.length
        ? (servicio.perfiles[0]?.correo ?? servicio.correo ?? "")
        : (servicio.correo || "");
      const correoNorm = String(correoEntrada || "").trim().toLowerCase();

      // Una ficha abierta desde el CRM trae el índice real del servicio. Se valida
      // también contra sus datos originales para impedir que un índice viejo edite
      // otra ficha por accidente. Esto permite tener dos Netflix VIP (incluso con la
      // misma plataforma) y modificar exactamente el que el usuario seleccionó.
      const tieneIndice = body.servicioIndex !== null && body.servicioIndex !== undefined && body.servicioIndex !== "";
      let idx = -1;
      if (tieneIndice) {
        const solicitado = Number(body.servicioIndex);
        if (!Number.isInteger(solicitado) || solicitado < 0 || solicitado >= servicios.length) {
          return res.status(200).json({ error: "La ficha seleccionada cambió de posición. Recargue el cliente y vuelva a intentarlo." });
        }
        const plataformaOriginal = body.plataformaOriginal || servicios[solicitado].plataforma || "";
        const correoOriginal = body.correoOriginal != null ? body.correoOriginal : (servicios[solicitado].correo || "");
        if (!servicioCoincide(servicios[solicitado], { plataforma: plataformaOriginal, correo: correoOriginal })) {
          return res.status(200).json({ error: "La ficha seleccionada ya no coincide con Firebase. Recargue antes de guardar." });
        }
        idx = solicitado;
      } else {
        // Ficha nueva o cliente antiguo sin índice: misma plataforma + mismo correo.
        idx = servicios.findIndex(s =>
          normPlat(s.plataforma) === pNorm &&
          String(s.correo || "").trim().toLowerCase() === correoNorm
        );
        // Sin correo (algunas cuentas IPTV), solo empareja otra ficha también sin correo.
        if (idx === -1 && !correoNorm) {
          idx = servicios.findIndex(s =>
            normPlat(s.plataforma) === pNorm && !String(s.correo || "").trim()
          );
        }
      }

      const servicioActualizado = idx >= 0;
      const nombreFinal = nombrePerfil || data.nombrePerfil || data.nombre || "—";
      const servicioAnterior = idx >= 0 ? { ...servicios[idx] } : null;
      if (String(servicio.beneficiarioTipo || "").toLowerCase() === "tercero" && !String(servicio.beneficiarioNombre || "").trim()) {
        return res.status(200).json({ error: "Falta el nombre de la persona que usará este acceso." });
      }
      if (servicioUsaSelectorDispositivo(servicio.plataforma) && !["tv", "cel"].includes(String(servicio.dispositivo || ""))) {
        return res.status(200).json({ error: "Seleccione si esta cuenta se usará en TV o celular." });
      }
      const nuevo = buildServicio(servicio, body.fichaTexto || "", servicioAnterior || {}, nombreFinal);
      const entregaSoloPerfil = servicioUsaSelectorDispositivo(nuevo.plataforma) && nuevo.dispositivo === "tv" && nuevo.esRoku !== true;
      for (let i = 0; i < nuevo.perfiles.length; i++) {
        const p = nuevo.perfiles[i] || {};
        if (!String(p.nombre || "").trim()) return res.status(200).json({ error: `Falta el nombre del perfil ${i + 1}.` });
        if (!entregaSoloPerfil && servicioRequiereCorreo(nuevo.plataforma) && !String(p.correo || "").trim()) return res.status(200).json({ error: `Falta el correo o usuario del perfil ${i + 1}.` });
        if (!entregaSoloPerfil && !servicioNoUsaClave(nuevo.plataforma) && !String(p.clave || "").trim()) return res.status(200).json({ error: `Falta la clave del perfil ${i + 1}.` });
        if (!servicioNoUsaPinPerfil(nuevo.plataforma) && !String(p.pinPerfil || "").trim()) return res.status(200).json({ error: `Falta el PIN individual del perfil ${i + 1}.` });
      }

      if (idx >= 0) servicios[idx] = aplicarNuevoServicio(servicios[idx], nuevo);
      else {
        idx = servicios.length;
        servicios.push(aplicarNuevoServicio({}, nuevo));
      }

      const accesos = prepararAccesosBeneficiarios({
        servicios,
        registroAnterior: data.accesosBeneficiarios,
        nombreTitular: nombreFinal,
        tokenTitularAnterior: data.tokenAcceso
      });
      const serviciosLimpios = servicios.map(limpiarServicioCRM);
      const beneficiarioActual = datosBeneficiario(servicios[idx], nombreFinal);
      const tokenPublico = String(accesos.registro[beneficiarioActual.key]?.token || accesos.tokenTitular || "");

      const update = {
        nombrePerfil: nombreFinal,
        nombre: nombreFinal,
        nombre_norm: nNorm || data.nombre_norm || normName(nombrePerfil),
        telefono: tel || data.telefono || "",
        telefono_norm: tNorm || data.telefono_norm || "",
        vendedor: vendedor || data.vendedor || "",
        vendedorTelefono: vendedorTelefonoPresente ? vendedorTelefono : (data.vendedorTelefono || ""),
        servicios: serviciosLimpios,
        tokenAcceso: accesos.tokenTitular,
        accesosBeneficiarios: accesos.registro,
        updatedAt: isoNow()
      };
      if (created) update.createdAt = isoNow();

      await docRef.set(update, { merge: true });

      // Crea una URL permanente por beneficiario y conserva, como enlaces
      // puntuales, los tokens antiguos que no fueron elegidos para la fusión.
      try {
        await sincronizarEnlacesPublicos(db, {
          clienteId: docRef.id,
          servicios: serviciosLimpios,
          registro: accesos.registro
        });
      } catch (e) {
        // El CRM queda guardado; un nuevo guardado reintentará crear los punteros.
      }

      // Cada perfil de una compra ocupa su propio cupo. El precio y la fecha,
      // en cambio, siguen guardados una sola vez en el servicio/compra.
      let invResult = null;
      try {
        invResult = await sincronizarInventarioServicio(db, {
          anterior: servicioAnterior,
          nuevo: servicios[idx],
          nombreTitular: nombreFinal
        });
      } catch (e) {
        invResult = { tocado: false, motivo: e.message };
      }

      const perfilesGuardados = perfilesOperativos(servicios[idx], nombreFinal);

      return res.status(200).json({
        ok: true,
        accion: acc,
        guardadoEnFirebase: true,
        schemaVersion: Number(servicios[idx]?.schemaVersion) || 2,
        compraId: String(servicios[idx]?.compraId || nuevo.compraId || ""),
        created,
        clienteId: docRef.id,
        totalServicios: servicios.length,
        totalPerfiles: perfilesGuardados.length,
        perfilesGuardados: perfilesGuardados.map((p) => ({
          perfilId: p.perfilId,
          nombre: p.nombre,
          correo: p.correo,
          tieneClave: !!p.clave,
          tienePin: !!p.pinPerfil
        })),
        servicioActualizado,
        servicioIndex: idx,
        inventario: invResult,
        beneficiarioTipo: beneficiarioActual.tipo,
        beneficiarioNombre: beneficiarioActual.nombre,
        token: tokenPublico,
        linkPublico: tokenPublico ? `/c/${tokenPublico}` : ""
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
    let servicios = Array.isArray(data.servicios) ? data.servicios.map(limpiarServicioCRM) : [];
    let invResult = null;
    const nombreTitular = data.nombrePerfil || data.nombre || "";

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

      invResult = await sincronizarInventarioServicio(db, {
        anterior: servEliminado,
        nuevo: null,
        nombreTitular
      });

    } else if (acc === "eliminar_perfil") {
      const { servicioIndex, perfilIndex, perfilId } = body;
      const idx = resolveServicioIndex(servicios, { servicioIndex, plataforma });
      if (idx === -1) return res.status(200).json({ error: "No encontré esa compra en el cliente." });
      const anterior = servicios[idx];
      const perfiles = perfilesOperativos(anterior, nombreTitular);
      let pidx = Number.isInteger(Number(perfilIndex)) ? Number(perfilIndex) : -1;
      if (perfilId) pidx = perfiles.findIndex((p) => String(p.perfilId || "") === String(perfilId));
      if (pidx < 0 || pidx >= perfiles.length) return res.status(200).json({ error: "No encontré ese perfil en la compra." });
      const eliminado = perfiles[pidx];
      const restantes = perfiles.filter((_, i) => i !== pidx);
      if (!restantes.length) {
        servicios = servicios.filter((_, i) => i !== idx);
        invResult = await sincronizarInventarioServicio(db, { anterior, nuevo: null, nombreTitular });
      } else {
        const actualizado = buildServicio({
          ...anterior,
          perfiles: restantes,
          correo: restantes[0].correo,
          clave: restantes[0].clave,
          pinPerfil: restantes[0].pinPerfil,
          perfil: restantes[0].perfil
        }, anterior.fichaTexto || "", anterior, nombreTitular);
        servicios[idx] = aplicarNuevoServicio(anterior, actualizado);
        invResult = await sincronizarInventarioServicio(db, { anterior, nuevo: servicios[idx], nombreTitular });
        touchedIndex = idx;
      }
      invResult = { ...(invResult || {}), perfilEliminado: eliminado.nombre || eliminado.perfil || "Perfil" };

    } else if (acc === "agregar") {
      const { servicio } = body;
      if (!servicio || !servicio.plataforma) return res.status(200).json({ error: "Faltan datos del servicio nuevo." });

      const nuevo = buildServicio(servicio, "", {}, nombreTitular);
      for (let i = 0; i < nuevo.perfiles.length; i++) {
        const p = nuevo.perfiles[i] || {};
        if (!p.nombre || (servicioRequiereCorreo(nuevo.plataforma) && !p.correo)) return res.status(200).json({ error: `Complete los datos requeridos del perfil ${i + 1}.` });
        if (!servicioNoUsaClave(nuevo.plataforma) && !p.clave) return res.status(200).json({ error: `Falta la clave del perfil ${i + 1}.` });
        if (!servicioNoUsaPinPerfil(nuevo.plataforma) && !p.pinPerfil) return res.status(200).json({ error: `Falta el PIN individual del perfil ${i + 1}.` });
      }
      servicios = [...servicios, nuevo];

      invResult = await sincronizarInventarioServicio(db, { anterior: null, nuevo, nombreTitular });

    } else if (acc === "editar") {
      const { plataformaOriginal, correoOriginal, servicio, servicioIndex } = body;
      const buscar = plataformaOriginal || plataforma;
      if (!buscar && servicioIndex == null) return res.status(200).json({ error: "Faltan datos para editar." });
      if (!servicio) return res.status(200).json({ error: "Faltan datos para editar." });

      const idx = resolveServicioIndex(servicios, { servicioIndex, plataforma: buscar, correo: correoOriginal || correo });
      if (idx === -1) return res.status(200).json({ error: "No encontré ese servicio." });

      const anterior = servicios[idx];
      const nuevo = buildServicio({
        plataforma: servicio.plataforma || servicios[idx].plataforma,
        precio: servicio.precio != null ? servicio.precio : servicios[idx].precio,
        fechaRenovacion: servicio.fechaRenovacion ? servicio.fechaRenovacion : servicios[idx].fechaRenovacion,
        correo: servicio.correo != null ? servicio.correo : (servicios[idx].correo || ""),
        clave: servicio.clave != null ? servicio.clave : (servicios[idx].clave || servicios[idx].pin || ""),
        pinPerfil: servicio.pinPerfil != null ? servicio.pinPerfil : (servicios[idx].pinPerfil || servicios[idx].pin_perfil || servicios[idx].perfilPin || ""),
        perfil: servicio.perfil != null ? servicio.perfil : (servicios[idx].perfil || nombreTitular),
        perfiles: Array.isArray(servicio.perfiles) ? servicio.perfiles : undefined,
        compraId: servicio.compraId || servicios[idx].compraId || "",
        beneficiarioTipo: servicio.beneficiarioTipo != null ? servicio.beneficiarioTipo : servicios[idx].beneficiarioTipo,
        beneficiarioNombre: servicio.beneficiarioNombre != null ? servicio.beneficiarioNombre : servicios[idx].beneficiarioNombre
      }, servicio.fichaTexto || servicios[idx].fichaTexto || "", anterior, nombreTitular);

      servicios[idx] = aplicarNuevoServicio(servicios[idx], nuevo);
      invResult = await sincronizarInventarioServicio(db, { anterior, nuevo: servicios[idx], nombreTitular });

    } else {
      return res.status(200).json({ error: "Acción no reconocida." });
    }

    const accesos = prepararAccesosBeneficiarios({
      servicios,
      registroAnterior: data.accesosBeneficiarios,
      nombreTitular,
      tokenTitularAnterior: data.tokenAcceso
    });
    const serviciosLimpios = servicios.map(limpiarServicioCRM);
    await docRef.update({
      servicios: serviciosLimpios,
      tokenAcceso: accesos.tokenTitular,
      accesosBeneficiarios: accesos.registro,
      updatedAt: isoNow()
    });
    try {
      await sincronizarEnlacesPublicos(db, {
        clienteId: docRef.id,
        servicios: serviciosLimpios,
        registro: accesos.registro
      });
    } catch (e) {
      // El próximo guardado vuelve a intentar el enlace sin revertir la operación.
    }

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
