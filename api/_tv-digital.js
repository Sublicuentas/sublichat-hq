// api/_tv-digital.js · Oct-2026 · Fuente única de URLs de TV Digital / IPTV.
// Las URLs dejan de estar fijas en el código: viven en Firestore
// (configuracion_tv_digital/urls) y se editan desde Sublichat Web (Bodega → URLs TV Digital).
// Estos valores son SOLO el respaldo si el documento todavía no existe.
// Orden de resolución de una entrega: URL propia de la cuenta (override en Bodega) → URL del proveedor → respaldo.
// CommonJS a propósito: lo usan mobile-core.js (CommonJS) y acceso.js / inventario.js (ESM).
const URLS_POR_DEFECTO = Object.freeze({
  latintv: { nombre: "LatinTV", url: "http://latgt.com:8080" },
  latintv2: { nombre: "LatinTV 2", url: "http://enlatv.com" },
  liontv: { nombre: "LionTV", url: "http://liontv.es:80" },
  evoutouch: { nombre: "Nanotech", url: "http://smarterstv99.dyndns.tv:25461/" },
  icomplay: { nombre: "ICOMPLAY MAX", url: "http://latinostream.xyz:80" }
});
const CONFIG_COL = "configuracion_tv_digital";
const CONFIG_DOC = "urls";

function normKey(v) {
  return String(v == null ? "" : v).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
}

// Proveedor de una plataforma IPTV (la plataforma manda; el texto libre solo distingue LatinTV 2).
function proveedorTv(plataforma, proveedorTexto) {
  const p = normKey(plataforma);
  const t = normKey(proveedorTexto);
  if (p.startsWith("icomplay") || /icomplay/.test(t)) return "icomplay";
  if (p.startsWith("evoutouch") || /nano|evou|smarter/.test(t)) return "evoutouch";
  if (p.startsWith("liontv") || /lion/.test(t)) return "liontv";
  if (p.startsWith("stellatv") || p.startsWith("oleada")) return "";
  if (p.startsWith("latintv") || p.startsWith("iptv") || /latin|latgt|enlatv/.test(t)) {
    return /enlatv|latintv2|latin2/.test(t) ? "latintv2" : "latintv";
  }
  return "";
}

// Solo http(s); se acepta HTTP y cualquier puerto (ICOMPLAY usa http://…:80).
function validarUrlTv(url) {
  const s = String(url == null ? "" : url).trim();
  if (!s) return "";
  let u;
  try { u = new URL(s); } catch (_) { return null; }
  if (!["http:", "https:"].includes(u.protocol) || !u.hostname) return null;
  if (s.length > 300 || /[\s<>"'`]/.test(s)) return null;
  return s;
}

let cache = { at: 0, data: null };
async function leerUrlsTv(db, { fresco = false } = {}) {
  if (!fresco && cache.data && Date.now() - cache.at < 60 * 1000) return cache.data;
  const out = {};
  for (const [k, v] of Object.entries(URLS_POR_DEFECTO)) out[k] = { ...v };
  try {
    const snap = await db.collection(CONFIG_COL).doc(CONFIG_DOC).get();
    const guardado = snap.exists ? (snap.data() || {}).proveedores || {} : {};
    for (const [k, v] of Object.entries(guardado)) {
      const url = validarUrlTv(v && v.url);
      if (!url) continue;
      out[k] = { nombre: String((v && v.nombre) || (out[k] && out[k].nombre) || k).slice(0, 60), url, updatedAt: v.updatedAt || "", updatedBy: v.updatedBy || "" };
    }
  } catch (_) { /* sin documento: valores por defecto */ }
  cache = { at: Date.now(), data: out };
  return out;
}

function urlTvPara(servicio = {}, urls = URLS_POR_DEFECTO, cuenta = null) {
  const propia = cuenta && validarUrlTv(cuenta.url || cuenta.serverUrl);
  if (propia) return propia;
  const prov = proveedorTv(servicio.plataforma || "", servicio.iptvProveedor || "");
  if (!prov) return "";
  return (urls[prov] && urls[prov].url) || (URLS_POR_DEFECTO[prov] && URLS_POR_DEFECTO[prov].url) || "";
}

// URLs propias por cuenta de Bodega (override). Solo se leen las cuentas que tienen url.
let cacheCuentas = { at: 0, data: null };
async function leerUrlsCuentas(db) {
  if (cacheCuentas.data && Date.now() - cacheCuentas.at < 60 * 1000) return cacheCuentas.data;
  const map = new Map();
  try {
    const snap = await db.collection("inventario").where("url", ">", "").get();
    snap.forEach((d) => { const u = validarUrlTv((d.data() || {}).url); if (u) map.set(d.id, u); });
  } catch (_) { /* sin índice o sin cuentas con URL propia */ }
  cacheCuentas = { at: Date.now(), data: map };
  return map;
}

function urlTvServicio(servicio = {}, urls, urlsCuentas) {
  const perfiles = Array.isArray(servicio.perfiles) ? servicio.perfiles : [];
  const id = String((perfiles[0] && perfiles[0].inventarioId) || servicio.inventarioId || "");
  const propia = id && urlsCuentas && urlsCuentas.get(id);
  return propia || urlTvPara(servicio, urls || URLS_POR_DEFECTO);
}

async function guardarUrlTv(db, { proveedor, url, nombre, usuario }) {
  const prov = normKey(proveedor);
  if (!prov || prov.length > 30) throw new Error("Proveedor inválido.");
  const limpia = validarUrlTv(url);
  if (!limpia) throw new Error("URL inválida. Use http:// o https:// (ejemplo: http://latinostream.xyz:80).");
  const ref = db.collection(CONFIG_COL).doc(CONFIG_DOC);
  const ahora = new Date().toISOString();
  let anterior = "";
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() || {} : {};
    const proveedores = { ...(data.proveedores || {}) };
    anterior = (proveedores[prov] && proveedores[prov].url) || (URLS_POR_DEFECTO[prov] && URLS_POR_DEFECTO[prov].url) || "";
    proveedores[prov] = { nombre: String(nombre || (proveedores[prov] && proveedores[prov].nombre) || (URLS_POR_DEFECTO[prov] && URLS_POR_DEFECTO[prov].nombre) || prov).slice(0, 60),
      url: limpia, updatedAt: ahora, updatedBy: String(usuario || "") };
    tx.set(ref, { proveedores, version: Number(data.version || 0) + 1, updatedAt: ahora }, { merge: true });
  });
  // Historial: URL anterior y nueva (no es un secreto: la ve el cliente final).
  await db.collection("auditoria_eventos").add({ tipo: "tv_digital_url_cambiada", proveedor: prov, urlAnterior: anterior, urlNueva: limpia, usuario: String(usuario || ""), createdAt: ahora });
  cache = { at: 0, data: null };
  return { proveedor: prov, url: limpia, urlAnterior: anterior };
}

exports.URLS_POR_DEFECTO = URLS_POR_DEFECTO;
exports.proveedorTv = proveedorTv;
exports.validarUrlTv = validarUrlTv;
exports.leerUrlsTv = leerUrlsTv;
exports.urlTvPara = urlTvPara;
exports.guardarUrlTv = guardarUrlTv;
exports.leerUrlsCuentas = leerUrlsCuentas;
exports.urlTvServicio = urlTvServicio;
exports.limpiarCacheCuentas = () => { cacheCuentas = { at: 0, data: null }; };
