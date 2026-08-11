// api/acceso.js · VERSION 1
//
// Endpoint público (sin login) que resuelve un token de entrega (/c/{token})
// a los datos que el cliente debe ver. Es de SOLO LECTURA y nunca expone nada
// más del documento del cliente que el servicio puntual al que apunta el token.
//
// Usa Firebase Admin con una cuenta de servicio, igual que renovar.js.
// Variables en Vercel (ya existentes):
//   FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY

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

function normPlat(v) {
  return String(v || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
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
    p.includes("iptv") || p.includes("viki")
  );
}
function servicioNoUsaClave(plataforma) {
  const p = normPlat(plataforma);
  return p.includes("canva") || p.includes("gemini") || p.includes("chatgpt") || p.includes("duolingo");
}
// Regla NUEVA (11-ago-2026): en celular, estas plataformas van SOLO con correo.
function celularSoloCodigo(plataforma) {
  const p = normPlat(plataforma);
  if (p.includes("netflix") && p.includes("vip")) return false;
  return p.includes("disney") || p.includes("hbo") || p === "max" || p.includes("vix") || p.includes("netflix");
}

const VENDEDOR_TELS = { yami: "9687724", jimena: "88501036", heber: "32174922", abner: "94306551", manuel: "87989267" };
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
  const p = normPlat(plataforma);
  if (p === "netflixpremium") return TERMS.netflix;
  if (p === "vipnetflix" || (p.includes("netflix") && p.includes("vip"))) return TERMS.vipnetflix;
  return TERMS[p] || TERMS.default;
}

const PLAT_LABELS = {
  netflix: "Netflix Premium", vipnetflix: "Netflix Premium VIP", hbomax: "HBO Max",
  disneyp: "Disney Premium", disneys: "Disney Standard sin ESPN", primevideo: "Prime Video",
  crunchyroll: "Crunchyroll", universal: "Universal+", vix: "ViX+", paramount: "Paramount+",
  spotify: "Spotify Premium", deezer: "Deezer Premium HiFi", youtube: "YouTube Premium",
  canva: "Canva", gemini: "Gemini", chatgpt: "ChatGPT", duolingo: "Duolingo",
  office: "Office 365", oleada: "Oleada TV", iptv: "IPTV", viki: "Viki Rakuten", appletv: "Apple TV"
};
function platLabel(plataforma) {
  const p = normPlat(plataforma);
  return PLAT_LABELS[p] || String(plataforma || "Servicio");
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Método no permitido." });

  const token = String(req.query.token || "").trim();
  if (!token) return res.status(400).json({ ok: false, error: "Falta el token." });

  try {
    const db = getApp().firestore();

    const puntero = await db.collection("enlaces").doc(token).get();
    if (!puntero.exists || puntero.data().activo === false) {
      return res.status(404).json({ ok: false, error: "Este enlace ya no está disponible. Contacte a su vendedor." });
    }
    const { clienteId, servicioIndex, compraId } = puntero.data();

    const clienteDoc = await db.collection("clientes").doc(clienteId).get();
    if (!clienteDoc.exists) return res.status(404).json({ ok: false, error: "No se encontró la cuenta." });
    const cliente = clienteDoc.data() || {};
    const servicios = Array.isArray(cliente.servicios) ? cliente.servicios : [];

    // El índice puede haber cambiado si se agregaron/quitaron servicios; se
    // revalida contra compraId y si no coincide, se busca por compraId.
    let servicio = servicios[servicioIndex];
    if (!servicio || String(servicio.compraId || "") !== String(compraId || "")) {
      servicio = servicios.find(s => String(s?.compraId || "") === String(compraId || ""));
    }
    if (!servicio) return res.status(404).json({ ok: false, error: "Este servicio ya no existe. Contacte a su vendedor." });

    const plataforma = servicio.plataforma || "";
    const dispositivo = servicio.dispositivo || "";
    const esRoku = !!servicio.esRoku;

    // Resolución de qué mostrar (correo / clave / pin) según la regla confirmada:
    //   TV + Roku            -> correo + clave (+pin si la plataforma lo usa)
    //   TV + no Roku          -> nada de correo/clave, solo perfil + pin
    //   Celular + grupo código-> SOLO correo (Disney Premium/Standard, HBO, Vix, Netflix Premium)
    //   Celular + resto       -> correo + clave (+pin si la plataforma lo usa)
    const platUsaPin = !servicioNoUsaPinPerfil(plataforma);
    const platUsaClave = !servicioNoUsaClave(plataforma);
    let mostrarCorreo = true, mostrarClave = platUsaClave, mostrarPin = platUsaPin, modo = "cred";

    if (dispositivo === "tv") {
      if (esRoku) {
        modo = "cred"; mostrarCorreo = true; mostrarClave = platUsaClave; mostrarPin = platUsaPin;
      } else {
        modo = "perfil"; mostrarCorreo = false; mostrarClave = false; mostrarPin = platUsaPin;
      }
    } else if (dispositivo === "cel") {
      if (platUsaClave && celularSoloCodigo(plataforma)) {
        modo = "codigo"; mostrarCorreo = true; mostrarClave = false; mostrarPin = false;
      } else {
        modo = platUsaClave ? "cred" : "invite";
        mostrarCorreo = true; mostrarClave = platUsaClave; mostrarPin = platUsaPin;
      }
    } else {
      // Sin dispositivo definido (fichas viejas): se comporta como antes de este cambio.
      modo = platUsaClave ? "cred" : "invite";
    }

    const perfilPrincipal = (Array.isArray(servicio.perfiles) && servicio.perfiles[0]) || {};

    const publico = {
      ok: true,
      plataforma,
      plataformaLabel: platLabel(plataforma),
      modo,
      titular: cliente.nombrePerfil || cliente.nombre || perfilPrincipal.nombre || "Cliente",
      perfil: servicio.perfil || perfilPrincipal.nombre || "",
      correo: mostrarCorreo ? (servicio.correo || perfilPrincipal.correo || "") : "",
      clave: mostrarClave ? (servicio.clave || perfilPrincipal.clave || "") : "",
      pin: mostrarPin ? (servicio.pinPerfil || perfilPrincipal.pinPerfil || "") : "",
      fechaRenovacion: servicio.fechaRenovacion || "",
      terminos: termsFor(plataforma),
      vendedor: cliente.vendedor || "",
      vendedorTelefono: cliente.telefono || vendedorTel(cliente.vendedor) || ""
    };

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(publico);
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Error del servidor. Intente de nuevo." });
  }
}
