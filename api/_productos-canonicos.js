// api/_productos-canonicos.js · R193 — Catálogo CANÓNICO de productos para Finanzas (APK + Web + Excel).
// Regla contable: normalizar NOMBRES nunca cambia MONTOS. Cada etiqueta original se conserva como evidencia.
// · Netflix Premium (netflix) y Netflix VIP (vipnetflix) son productos DISTINTOS: nunca se unen.
// · Los planes de una misma plataforma (LionTV 2 dispositivos, ICOMPLAY 3 pantallas…) son el MISMO producto.
// · Una etiqueta de texto «Netflix Premium VIP» es AMBIGUA: no se asigna sola a VIP ni a Premium. Se resuelve con
//   la ficha del servicio (compraId) o con un alias confirmado por una persona (finanzas_alias_productos, auditado).
// · Lo que no se reconoce queda en «Pendiente de clasificar», con su monto dentro del total cobrado.

export const PRODUCTOS = Object.freeze({
  netflix: "Netflix Premium", vipnetflix: "Netflix VIP",
  disneyp: "Disney Premium", disneys: "Disney Premium sin ESPN",
  hbomax: "HBO Max", primevideo: "Prime Video", paramount: "Paramount+", crunchyroll: "Crunchyroll", vix: "ViX",
  appletv: "Apple TV", universal: "Universal+", star: "Star+",
  spotify: "Spotify", youtube: "YouTube", deezer: "Deezer",
  canva: "Canva", gemini: "Gemini Pro", chatgpt: "ChatGPT", duolingo: "Duolingo", office: "Office 365", office2021: "Office 2021",
  adobeexpress: "Adobe Express", windows10: "Windows 10", windows11: "Windows 11", eset: "ESET NOD32", viki: "Viki Rakuten",
  stellatv: "Stella TV", oleada: "Oleada TV", latintv: "LatinTV", liontv: "LionTV", evoutouch: "Nanotech", icomplay: "ICOMPLAY", iptv: "IPTV anterior",
});
export const PENDIENTE = "pendiente_clasificar";
export const PENDIENTE_NOMBRE = "Pendiente de clasificar";

// Claves de CATÁLOGO (las que guarda el sistema en servicios y asignaciones). Son inequívocas.
const CLAVES = Object.freeze({
  netflix: "netflix", netflixpremium: "netflix", vipnetflix: "vipnetflix", netflixvip: "vipnetflix", vip: "vipnetflix",
  disneyp: "disneyp", disneypremium: "disneyp", disney: "disneyp", disneys: "disneys", disneystandard: "disneys",
  hbomax: "hbomax", hbo: "hbomax", max: "hbomax", primevideo: "primevideo", prime: "primevideo", paramount: "paramount", paramountp: "paramount",
  crunchyroll: "crunchyroll", vix: "vix", appletv: "appletv", universal: "universal", star: "star",
  spotify: "spotify", youtube: "youtube", deezer: "deezer", canva: "canva", gemini: "gemini", chatgpt: "chatgpt", duolingo: "duolingo",
  office: "office", microsoft: "office", m365: "office", office2021: "office2021", adobeexpress: "adobeexpress", windows10: "windows10", windows11: "windows11", eset: "eset", viki: "viki",
});

export const normAlias = (v = "") => String(v || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// Familia por texto (planes → producto). Devuelve "" si no se reconoce.
function familia(t) {
  if (/^stella/.test(t)) return "stellatv";
  if (/^oleada/.test(t)) return "oleada";
  if (/^latintv/.test(t)) return "latintv";
  if (/^liontv/.test(t)) return "liontv";
  if (/^(evoutouch|nanotech)/.test(t)) return "evoutouch";
  if (/^icomplay/.test(t)) return "icomplay";
  if (/^iptv/.test(t)) return "iptv";
  if (/^office2021/.test(t)) return "office2021";
  if (/^(office|microsoft365|m365)/.test(t)) return "office";
  if (/^windows10/.test(t)) return "windows10";
  if (/^windows11/.test(t)) return "windows11";
  if (/sinespn/.test(t)) return "disneys";
  if (/^disney/.test(t)) return "disneyp";
  if (/^(hbo|max)/.test(t)) return "hbomax";
  if (/^(prime|amazon)/.test(t)) return "primevideo";
  if (/^paramount/.test(t)) return "paramount";
  if (/^crunchy/.test(t)) return "crunchyroll";
  if (/^vix/.test(t)) return "vix";
  if (/^apple/.test(t)) return "appletv";
  if (/^universal/.test(t)) return "universal";
  if (/^spotify/.test(t)) return "spotify";
  if (/^youtube/.test(t)) return "youtube";
  if (/^deezer/.test(t)) return "deezer";
  if (/^canva/.test(t)) return "canva";
  if (/^gemini/.test(t)) return "gemini";
  if (/^(chatgpt|openai)/.test(t)) return "chatgpt";
  if (/^duolingo/.test(t)) return "duolingo";
  if (/^adobe/.test(t)) return "adobeexpress";
  if (/^(eset|nod32)/.test(t)) return "eset";
  if (/^viki/.test(t)) return "viki";
  return "";
}

// raw → { id, nombre, ambiguo, motivo, original }. `confirmados` = { aliasNorm: productoId } revisados por una persona.
export function resolverProducto(raw = "", confirmados = {}) {
  const original = String(raw || "").trim();
  const t = normAlias(original);
  const ok = (id, via) => ({ id, nombre: PRODUCTOS[id], ambiguo: false, motivo: via, original });
  if (!t || t === "sinplataforma" || t === "servicio") return { id: PENDIENTE, nombre: PENDIENTE_NOMBRE, ambiguo: false, motivo: "sin_plataforma", original };
  if (confirmados && PRODUCTOS[confirmados[t]]) return ok(confirmados[t], "alias_confirmado");
  const bajo = original.toLowerCase();
  if (CLAVES[bajo]) return ok(CLAVES[bajo], "clave_catalogo"); // clave exacta del catálogo: inequívoca
  // Texto con «netflix» + «vip»: NO se adivina (puede ser una etiqueta mezclada de perfil + plan).
  if (/netflix/.test(t) && /vip/.test(t) && t !== "vipnetflix" && t !== "netflixvip") return { id: PENDIENTE, nombre: PENDIENTE_NOMBRE, ambiguo: true, motivo: "alias_ambiguo_netflix_vip", original };
  if (CLAVES[t]) return ok(CLAVES[t], "texto_catalogo");
  if (/^netflix/.test(t)) return ok("netflix", "texto_familia");
  const f = familia(t);
  if (f) return ok(f, "texto_familia");
  return { id: PENDIENTE, nombre: PENDIENTE_NOMBRE, ambiguo: false, motivo: "no_reconocido", original };
}
export const esCombinado = (raw = "") => /\s\+\s/.test(String(raw || ""));
// «2 Netflix + Disney Premium» → ["Netflix", "Disney Premium"] (sin el conteo; los montos NO salen de aquí).
export const partesCombinado = (raw = "") => String(raw || "").split(/\s\+\s/).map((x) => x.replace(/^\s*\d+\s+/, "").trim()).filter(Boolean);
