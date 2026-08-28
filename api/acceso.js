// api/acceso.js · VERSION 8 · URL permanente + soporte de vendedor completo
//
// Endpoint público (sin login) que resuelve un token de entrega (/c/{token})
// a los datos que el cliente debe ver. Es de SOLO LECTURA y agrupa únicamente
// los servicios asignados al mismo beneficiario.
//
// Usa Firebase Admin con una cuenta de servicio, igual que renovar.js.
// Variables en Vercel (ya existentes):
//   FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY

import admin from "firebase-admin";

const accessUsage = new Map();

function setPublicSecretHeaders(res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

function allowRequest(req) {
  const ip = String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0].trim().slice(0, 120);
  const now = Date.now();
  const old = accessUsage.get(ip) || { startedAt: now, count: 0 };
  const state = now - old.startedAt >= 60_000 ? { startedAt: now, count: 0 } : old;
  state.count += 1;
  accessUsage.set(ip, state);
  if (accessUsage.size > 1000) {
    for (const [key, value] of accessUsage) if (now - value.startedAt > 120_000) accessUsage.delete(key);
  }
  return state.count <= 120;
}

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

function normPlat(v) {
  return String(v || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Convierte también etiquetas antiguas al código real. Así el nombre público
// no depende de si Firestore guardó "disneys", "Disney Premium sin ESPN" o la etiqueta
// completa "Disney Premium sin ESPN".
function canonPlat(v) {
  const p = normPlat(v);
  const aliases = {
    netflixpremium: "netflix", netflixpremiumvip: "vipnetflix", vip: "vipnetflix",
    disneypremium: "disneyp", disneystandard: "disneys", disneystandardsinespn: "disneys",
    hbo: "hbomax", max: "hbomax", prime: "primevideo", paramountplus: "paramount",
    universalplus: "universal", universalp: "universal", rakutenviki: "viki",
    office365: "office", office2021: "office2021", win10: "windows10", win11: "windows11",
    adobe: "adobeexpress", esetnod32: "eset"
  };
  if (aliases[p]) return aliases[p];
  if (p.includes("disney") && (p.includes("standard") || p.includes("sinespn"))) return "disneys";
  if (p.includes("disney") && p.includes("premium")) return "disneyp";
  const oleada = p.match(/^oleada(?:tv)?([13])$/);
  if (oleada) return `oleadatv${oleada[1]}`;
  if (/^latintv[1234]$/.test(p) || /^liontv[1235]$/.test(p) || /^iptv[134]$/.test(p)) return p;
  if (p.startsWith("latintv")) return "latintv";
  if (p.startsWith("liontv")) return "liontv";
  return p;
}

// Mismo criterio que api/renovar.js (mantener sincronizado si cambian las reglas).
function servicioNoUsaPinPerfil(plataforma) {
  const p = normPlat(plataforma);
  return (
    (p.includes("netflix") && p.includes("vip")) ||
    p.includes("spotify") || p.includes("deezer") || p.includes("youtube") ||
    p.includes("office") || p.includes("paramount") || p.includes("appletv") ||
    p.includes("vix") || p.includes("canva") || p.includes("gemini") ||
    p.includes("chatgpt") || p.includes("duolingo") || p.includes("oleada") ||
    p.includes("latintv") || p.includes("liontv") || p.includes("iptv") || p.includes("viki") || p.includes("windows") ||
    p.includes("adobe") || p.includes("eset")
  );
}
function servicioNoUsaClave(plataforma) {
  const p = normPlat(plataforma);
  return p.includes("canva") || p.includes("gemini") || p.includes("chatgpt") ||
    p.includes("duolingo") || p.includes("adobeexpress");
}
function servicioEsSerial(plataforma) {
  const p = normPlat(plataforma);
  return p === "windows10" || p === "windows11" || p === "eset";
}
function servicioCredencialesSiempre(plataforma) {
  const p = normPlat(plataforma);
  if (p.includes("netflix") && p.includes("vip")) return true;
  if (p.startsWith("oleada") || p.startsWith("latintv") || p.startsWith("liontv") || p.startsWith("iptv")) return true;
  return ["vipnetflix", "spotify", "youtube", "viki", "deezer", "crunchyroll"].includes(p);
}
function servicioUsaSelectorDispositivo(plataforma) {
  const p = normPlat(plataforma);
  if (p.includes("netflix") && !p.includes("vip")) return true;
  return p.includes("disney") || p.includes("hbo") || p === "max" ||
    p.includes("vix") || p.includes("universal") || p.includes("prime");
}
// Regla NUEVA (11-ago-2026): en celular, estas plataformas van SOLO con correo.
function celularSoloCodigo(plataforma) {
  const p = normPlat(plataforma);
  if (p.includes("netflix") && p.includes("vip")) return false;
  return p.includes("disney") || p.includes("hbo") || p === "max" || p.includes("vix") || p.includes("universal") || p.includes("netflix");
}

const VENDEDOR_TELS = { relojes: "32126332", sublicuentas: "89464277", sublicuentas2: "89464328", yami: "96877246", jimena: "88501036", heber: "32174922", abner: "94306551", manuel: "87989267" };
function vendedorTel(v) {
  const n = normPlat(v);
  return VENDEDOR_TELS[n] || "";
}

// Condiciones EXACTAS tomadas de FICHA_TEMPLATES en index.html. Si cambia el
// texto allá, hay que replicarlo aquí — no hay import compartido entre funciones.
const TERMS = {
  default: ["No se modifica perfil", "Acceso solo para un dispositivo", "Uso solo en Honduras", "No usar vpn", "Garantía vigente"],
  netflix: ["Acceso solo para un dispositivo.", "El perfil no debe ser modificado.", "Servicio exclusivo para Honduras.", "Cuenta con garantía total activa."],
  vipnetflix: ["Puede iniciar sesión en el dispositivo que prefiera (celular, TV, tablet, etc.), pero la reproducción es en UNO a la vez — no se puede ver en varios dispositivos al mismo tiempo.", "Garantía activa por todo el periodo contratado."],
  disneyp: ["Acceso solo para un dispositivo.", "No se modifica el perfil.", "Uso exclusivo en Honduras (No usar VPN)."],
  disneys: ["No se modifica perfil", "Acceso solo para un dispositivo", "Uso solo en Honduras", "No usar vpn", "Garantía vigente"],
  hbomax: ["Acceso solo para un dispositivo.", "No se modifica perfil.", "Conexión válida únicamente para Honduras.", "Garantía vigente durante todo el periodo adquirido."],
  primevideo: ["No modificar perfil", "Acceso solo para un dispositivo", "Uso solo en Honduras", "Garantía vigente", "Compras y rentas de películas no disponible.", "Acceso exclusivo al catálogo oficial de Prime Video."],
  crunchyroll: ["Acceso solo para un dispositivo", "Uso solo en Honduras", "No usar vpn", "Garantía vigente"],
  universal: ["Válido para 1 dispositivo.", "No se modifica el perfil.", "Conexión válida únicamente para Honduras.", "Garantía vigente durante todo el periodo adquirido."],
  vix: ["Acceso solo para un dispositivo.", "Acceso a Pelis, Series y Novelas.", "Deportes (Válido únicamente en USA/MX).", "Compatible con TV, Celular, Tablet y Web.", "Garantía vigente durante todo el periodo adquirido."],
  spotify: ["Reproduce música sin anuncios ni interrupciones.", "Descargas y reproducción sin conexión.", "Creación de playlists incluida.", "Un dispositivo a la vez por acceso."],
  youtube: ["No cambiar datos de la cuenta", "Uso solo en Honduras", "No usar VPN", "Garantía vigente"],
  deezer: ["No cambiar el correo ni la contraseña.", "Uso exclusivo: solo un dispositivo a la vez, puede usarlo en el de su preferencia."],
  office: ["ESTRICTAMENTE PROHIBIDO: no se debe cambiar la contraseña ni alterar la información de la cuenta.", "Compatible con Windows, Mac, Android e iOS.", "Garantía vigente durante todo el año adquirido, sujeta al cumplimiento de estas normativas."],
  canva: ["Acceso vinculado únicamente al correo indicado.", "Garantía vigente durante todo el periodo adquirido."],
  gemini: ["Acceso vinculado únicamente al correo indicado.", "Recuerde aceptar la invitación de Google en su correo para activar las funciones avanzadas.", "Garantía vigente durante todo el periodo adquirido."],
  chatgpt: ["Acceso únicamente para el correo indicado", "No modificar datos internos", "Garantía vigente durante su tiempo adquirido"],
  duolingo: ["Cada persona debe aceptar la invitación enviada a su correo para activar las funciones Plus.", "La garantía permanece vigente durante el periodo adquirido."],
  oleada: ["No compartir usuario ni clave.", "Garantía vigente durante su tiempo adquirido."],
  iptv: ["Compatible con TV, Celular (iPhone o Android), Smarters Pro y SmartOne.", "Ingrese manualmente la lista, usuario, contraseña y URL proporcionados.", "No comparta sus accesos fuera de los dispositivos contratados."]
};
function termsFor(plataforma) {
  const p = canonPlat(plataforma);
  if (p === "netflixpremium") return TERMS.netflix;
  if (p === "vipnetflix" || (p.includes("netflix") && p.includes("vip"))) return TERMS.vipnetflix;
  if (p.startsWith("latintv") || p.startsWith("liontv") || p.startsWith("iptv")) return TERMS.iptv;
  if (p.startsWith("oleada")) return TERMS.oleada;
  if (p === "office2021") return TERMS.office;
  return TERMS[p] || TERMS.default;
}

const PLAT_LABELS = {
  netflix: "Netflix Premium", vipnetflix: "⭐ Netflix Premium VIP", hbomax: "HBO Max",
  disneyp: "Disney Premium", disneys: "Disney Premium sin ESPN", primevideo: "Prime Video",
  crunchyroll: "Crunchyroll", universal: "Universal+", vix: "ViX+", paramount: "Paramount+",
  spotify: "Spotify Premium", deezer: "Deezer Premium HiFi", youtube: "YouTube Premium",
  canva: "Canva", gemini: "Gemini Pro", chatgpt: "ChatGPT", duolingo: "Duolingo",
  office: "Office 365", office2021: "Office 2021", oleada: "Oleada TV", oleadatv1: "Oleada TV (1 dispositivo)", oleadatv3: "Oleada TV (3 dispositivos)",
  latintv: "LatinTV", latintv1: "LatinTV (1 dispositivo)", latintv2: "LatinTV (2 dispositivos)", latintv3: "LatinTV (3 dispositivos)", latintv4: "LatinTV (4 dispositivos)",
  liontv: "LionTV", liontv1: "LionTV (1 dispositivo)", liontv2: "LionTV (2 dispositivos)", liontv3: "LionTV (3 dispositivos)", liontv5: "LionTV (5 dispositivos)",
  iptv: "IPTV anterior", iptv1: "IPTV anterior (1)", iptv3: "IPTV anterior (3)", iptv4: "IPTV anterior (4)", viki: "Viki Rakuten", appletv: "Apple TV",
  windows10: "Windows 10", windows11: "Windows 11", adobeexpress: "Adobe Express", eset: "ESET NOD32"
};
function platLabel(plataforma) {
  const p = canonPlat(plataforma);
  return PLAT_LABELS[p] || String(plataforma || "Servicio");
}

// La ficha permanece vinculada al mismo token, pero las credenciales dejan de
// exponerse al día siguiente de la fecha de renovación. La comparación usa la
// fecha local de Honduras para que el cambio no ocurra seis horas antes.
function fechaPartes(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    const d = value.toDate();
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  }
  const s = String(value || "").trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { y: Number(m[3]), m: Number(m[2]), d: Number(m[1]) };
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  return null;
}

function hoyHonduras() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Tegucigalpa", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const get = type => Number(parts.find(p => p.type === type)?.value || 0);
  return { y: get("year"), m: get("month"), d: get("day") };
}

function fechaClave(p) {
  return p ? (p.y * 10000 + p.m * 100 + p.d) : 0;
}

function servicioVencido(fechaRenovacion) {
  const vence = fechaPartes(fechaRenovacion);
  return !!vence && fechaClave(vence) < fechaClave(hoyHonduras());
}

function normName(v) {
  return String(v || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
}

function keyBeneficiario(servicio = {}) {
  if (String(servicio.beneficiarioKey || "").trim()) return String(servicio.beneficiarioKey).trim();
  if (String(servicio.beneficiarioTipo || "").toLowerCase() !== "tercero") return "titular";
  const key = normName(servicio.beneficiarioNombre || servicio.beneficiario)
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "persona";
  return `tercero-${key}`;
}

function perfilesOperativos(servicio = {}, nombreTitular = "") {
  const lista = Array.isArray(servicio.perfiles) && servicio.perfiles.length
    ? servicio.perfiles
    : [{
        nombre: servicio.nombrePerfil || servicio.perfil || nombreTitular || "Cliente",
        perfil: servicio.perfil || servicio.nombrePerfil || nombreTitular || "",
        correo: servicio.correo || "",
        clave: servicio.clave || servicio.password || servicio.contrasena || "",
        pinPerfil: servicio.pinPerfil || servicio.pin_perfil || servicio.perfilPin || ""
      }];
  const usaDispositivo = servicioUsaSelectorDispositivo(servicio.plataforma);
  return lista.map((p, index) => {
    const dispositivoRaw = p?.dispositivo != null ? p.dispositivo : servicio.dispositivo;
    const dispositivo = usaDispositivo && ["tv", "cel"].includes(String(dispositivoRaw || ""))
      ? String(dispositivoRaw)
      : "";
    const esRokuRaw = p?.esRoku != null ? p.esRoku : servicio.esRoku;
    return {
      nombre: String(p?.nombre || p?.nombrePerfil || p?.cliente || p?.perfil || nombreTitular || `Perfil ${index + 1}`).trim(),
      perfil: String(p?.perfil || p?.nombrePerfil || p?.nombre || "").trim(),
      correo: String(p?.correo ?? servicio.correo ?? "").trim(),
      clave: String(p?.clave ?? p?.password ?? p?.contrasena ?? servicio.clave ?? "").trim(),
      pinPerfil: String(p?.pinPerfil ?? p?.pin_perfil ?? p?.perfilPin ?? (index === 0 ? (servicio.pinPerfil || servicio.pin_perfil || servicio.perfilPin || "") : "")).trim(),
      dispositivo,
      esRoku: dispositivo === "tv" && esRokuRaw === true
    };
  });
}

function resolverModo(servicio = {}) {
  const plataforma = servicio.plataforma || "";
  const dispositivo = servicio.dispositivo || "";
  const esRoku = !!servicio.esRoku;
  const platUsaPin = !servicioNoUsaPinPerfil(plataforma);
  const platUsaClave = !servicioNoUsaClave(plataforma);
  let mostrarCorreo = true, mostrarClave = platUsaClave, mostrarPin = platUsaPin, modo = "cred";

  // Windows y ESET son licencias: nunca se presentan como correo/contraseña.
  if (servicioEsSerial(plataforma)) {
    return { modo: "serial", mostrarCorreo: false, mostrarClave: true, mostrarPin: false };
  }

  // Estas plataformas siempre entregan correo/usuario + clave, sin importar
  // si antes quedó guardado por error TV/celular en un registro antiguo.
  if (servicioCredencialesSiempre(plataforma)) {
    return { modo: "cred", mostrarCorreo: true, mostrarClave: true, mostrarPin: platUsaPin };
  }

  // En plataformas cuyo método cambia según TV/celular no se adivina. Las
  // fichas antiguas quedan protegidas hasta que el vendedor elija el destino.
  if (servicioUsaSelectorDispositivo(plataforma) && !dispositivo) {
    return { modo: "pendiente", mostrarCorreo: false, mostrarClave: false, mostrarPin: false };
  }

  if (dispositivo === "tv") {
    if (esRoku) {
      modo = "cred";
    } else {
      modo = "perfil"; mostrarCorreo = false; mostrarClave = false;
    }
  } else if (dispositivo === "cel") {
    if (platUsaClave && celularSoloCodigo(plataforma)) {
      // En celular la contraseña se sustituye por el código temporal, pero el
      // PIN individual del perfil sigue siendo parte obligatoria del acceso.
      modo = "codigo"; mostrarCorreo = true; mostrarClave = false; mostrarPin = platUsaPin;
    } else {
      modo = platUsaClave ? "cred" : "invite";
    }
  } else {
    modo = platUsaClave ? "cred" : "invite";
  }

  return { modo, mostrarCorreo, mostrarClave, mostrarPin };
}

const VISIBILIDAD_URL_MODOS = new Set(["plataforma", "todos", "correo_clave", "solo_correo", "solo_pin", "personalizado"]);
function aplicarVisibilidadUrl(servicio = {}, camposAutomaticos = {}) {
  const raw = servicio.visibilidadUrl;
  const fuente = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : { modo: raw };
  const modo = VISIBILIDAD_URL_MODOS.has(String(fuente?.modo || "")) ? String(fuente.modo) : "plataforma";
  if (modo === "plataforma") return { ...camposAutomaticos, visibilidadModo: modo };

  let elegidos = { correo: false, clave: false, pin: false };
  if (modo === "todos") elegidos = { correo: true, clave: true, pin: true };
  else if (modo === "correo_clave") elegidos = { correo: true, clave: true, pin: false };
  else if (modo === "solo_correo") elegidos = { correo: true, clave: false, pin: false };
  else if (modo === "solo_pin") elegidos = { correo: false, clave: false, pin: true };
  else if (modo === "personalizado") {
    const c = fuente.campos && typeof fuente.campos === "object" && !Array.isArray(fuente.campos) ? fuente.campos : fuente;
    elegidos = { correo: c.correo === true, clave: c.clave === true, pin: c.pin === true };
  }

  return {
    ...camposAutomaticos,
    mostrarCorreo: !servicioEsSerial(servicio.plataforma) && elegidos.correo,
    mostrarClave: !servicioNoUsaClave(servicio.plataforma) && elegidos.clave,
    mostrarPin: !servicioNoUsaPinPerfil(servicio.plataforma) && elegidos.pin,
    visibilidadModo: modo
  };
}

function servicioPublico(cliente = {}, servicio = {}, { beneficiarioKey = "", beneficiarioNombre = "", limitarPerfil = false } = {}) {
  const plataforma = servicio.plataforma || "";
  const fechaRenovacion = servicio.fechaRenovacion || "";
  const vencido = servicioVencido(fechaRenovacion);
  const titularCliente = cliente.nombrePerfil || cliente.nombre || "Cliente";
  let perfiles = perfilesOperativos(servicio, titularCliente);

  // Cuando el enlace pertenece a un tercero, solo muestra su perfil si el
  // nombre coincide. Si la ficha vieja no tiene esa relación, limita al primer
  // perfil para no exponer los accesos de otras personas por accidente.
  if (limitarPerfil || (beneficiarioKey && beneficiarioKey !== "titular")) {
    const buscado = normName(beneficiarioNombre || servicio.beneficiarioNombre);
    const exactos = buscado ? perfiles.filter(p => normName(p.nombre) === buscado) : [];
    perfiles = exactos.length ? exactos : perfiles.slice(0, 1);
  }

  const perfilesPublicos = perfiles.map(p => {
    const campos = aplicarVisibilidadUrl(
      servicio,
      resolverModo({ ...servicio, dispositivo: p.dispositivo, esRoku: p.esRoku })
    );
    return {
      nombre: p.nombre || p.perfil || beneficiarioNombre || titularCliente,
      perfil: p.perfil || p.nombre || "",
      correo: !vencido && campos.mostrarCorreo ? p.correo : "",
      clave: !vencido && campos.mostrarClave ? p.clave : "",
      pin: !vencido && campos.mostrarPin ? p.pinPerfil : "",
      usaPin: campos.mostrarPin === true,
      modo: campos.modo,
      visibilidadModo: campos.visibilidadModo || "plataforma",
      dispositivo: p.dispositivo || "",
      esRoku: p.dispositivo === "tv" && p.esRoku === true
    };
  });
  const principal = perfilesPublicos[0] || {};
  const vendedorRaw = String(servicio.vendedor || cliente.vendedor || "").trim();
  const vendedor = normName(vendedorRaw) === "geissel" ? "Geisell" : vendedorRaw;
  const vendedorNorm = normName(vendedor);
  const clienteVendedorNorm = normName(cliente.vendedor || cliente.vendedor_norm || "");
  const mismoVendedor = ["geissel", "geisell"].includes(vendedorNorm)
    ? ["geissel", "geisell"].includes(clienteVendedorNorm)
    : vendedorNorm === clienteVendedorNorm;
  const vendedorTelefono = String(
    servicio.vendedorTelefono ||
    (mismoVendedor ? cliente.vendedorTelefono : "") ||
    vendedorTel(vendedor) || ""
  ).trim();

  return {
    plataforma,
    plataformaLabel: platLabel(plataforma),
    modo: principal.modo || resolverModo(servicio).modo,
    vencido,
    titular: beneficiarioNombre || servicio.beneficiarioNombre || titularCliente,
    perfil: principal.perfil || principal.nombre || "",
    correo: principal.correo || "",
    clave: principal.clave || "",
    pin: principal.pin || "",
    usaPin: principal.usaPin === true,
    visibilidadModo: principal.visibilidadModo || "plataforma",
    perfiles: perfilesPublicos,
    fechaRenovacion,
    terminos: termsFor(plataforma),
    vendedor,
    vendedorTelefono
  };
}

function ordenarServiciosPublicos(a, b) {
  if (!!a.vencido !== !!b.vencido) return a.vencido ? 1 : -1;
  const fa = fechaClave(fechaPartes(a.fechaRenovacion)) || Number.MAX_SAFE_INTEGER;
  const fb = fechaClave(fechaPartes(b.fechaRenovacion)) || Number.MAX_SAFE_INTEGER;
  if (fa !== fb) return fa - fb;
  return String(a.plataformaLabel || "").localeCompare(String(b.plataformaLabel || ""), "es");
}

export default async function handler(req, res) {
  setPublicSecretHeaders(res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Método no permitido." });
  }
  if (!allowRequest(req)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ ok: false, error: "Demasiadas consultas. Intente nuevamente en un minuto." });
  }

  const token = String(req.query.token || "").trim();
  // Admite enlaces históricos y los nuevos tokens criptográficos base64url.
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(token)) {
    return res.status(400).json({ ok: false, error: "Enlace inválido." });
  }

  try {
    const db = getApp().firestore();

    const puntero = await db.collection("enlaces").doc(token).get();
    if (!puntero.exists || puntero.data().activo === false) {
      return res.status(404).json({ ok: false, error: "Este enlace ya no está disponible. Contacte a su vendedor." });
    }
    const enlace = puntero.data() || {};
    const { clienteId, servicioIndex, compraId } = enlace;

    const clienteDoc = await db.collection("clientes").doc(clienteId).get();
    if (!clienteDoc.exists) return res.status(404).json({ ok: false, error: "No se encontró la cuenta." });
    const cliente = clienteDoc.data() || {};
    const servicios = Array.isArray(cliente.servicios) ? cliente.servicios : [];

    // URL unificada: devuelve todas las plataformas de la misma persona, cada
    // una con su propia vigencia. Los servicios vencidos permanecen visibles
    // como referencia, pero nunca exponen credenciales.
    if (enlace.tipo === "beneficiario") {
      const beneficiarioKey = String(enlace.beneficiarioKey || "titular");
      const registro = cliente.accesosBeneficiarios && typeof cliente.accesosBeneficiarios === "object"
        ? cliente.accesosBeneficiarios : {};
      const beneficiarioNombre = String(
        enlace.beneficiarioNombre || registro[beneficiarioKey]?.nombre ||
        (beneficiarioKey === "titular" ? (cliente.nombrePerfil || cliente.nombre || "Cliente") : "Cliente")
      );
      const filtrados = servicios.filter(s => keyBeneficiario(s) === beneficiarioKey);
      if (!filtrados.length) {
        return res.status(404).json({ ok: false, error: "Esta persona no tiene servicios disponibles en este enlace." });
      }
      const publicos = filtrados
        .map(s => servicioPublico(cliente, s, {
          beneficiarioKey,
          beneficiarioNombre,
          limitarPerfil: beneficiarioKey !== "titular"
        }))
        .sort(ordenarServiciosPublicos);
      const activos = publicos.filter(s => !s.vencido).length;
      const vendedores = [...new Map(publicos.filter(s => s.vendedor).map(s => [normName(s.vendedor), {
        vendedor: s.vendedor,
        vendedorTelefono: s.vendedorTelefono || ""
      }])).values()];
      return res.status(200).json({
        ok: true,
        multi: true,
        titular: beneficiarioNombre,
        comprador: cliente.nombrePerfil || cliente.nombre || beneficiarioNombre,
        servicios: publicos,
        totalServicios: publicos.length,
        totalActivos: activos,
        totalVencidos: publicos.length - activos,
        vendedores,
        clienteCompartido: vendedores.length > 1,
        vendedor: vendedores.length === 1 ? vendedores[0].vendedor : "",
        vendedorTelefono: vendedores.length === 1 ? vendedores[0].vendedorTelefono : ""
      });
    }

    // El índice puede haber cambiado si se agregaron/quitaron servicios; se
    // revalida contra compraId y si no coincide, se busca por compraId.
    let servicio = servicios[servicioIndex];
    if (!servicio || String(servicio.compraId || "") !== String(compraId || "")) {
      servicio = servicios.find(s => String(s?.compraId || "") === String(compraId || ""));
    }
    if (!servicio) return res.status(404).json({ ok: false, error: "Este servicio ya no existe. Contacte a su vendedor." });
    const publico = servicioPublico(cliente, servicio, { limitarPerfil: true });
    if (publico.vencido) {
      return res.status(410).json({
        ok: false,
        ...publico,
        error: "Este servicio está vencido. Renueve con su vendedor para reactivar el mismo enlace."
      });
    }
    return res.status(200).json({ ok: true, ...publico });
  } catch (e) {
    console.error("ACCESO_ERROR", e);
    return res.status(500).json({ ok: false, error: "Error del servidor. Intente de nuevo." });
  }
}
