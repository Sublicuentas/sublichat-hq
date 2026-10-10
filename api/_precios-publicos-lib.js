// api/_precios-publicos-lib.js · R145 — Lista pública de precios para revendedores.
// ---------------------------------------------------------------------------
// Fuente ÚNICA del precio: la colección "precios" (tarifa general) que ya usa el
// Panel de Socios (la escribe el backend de Render, index_12_admin_panel.js).
// Aquí NO se copia ningún precio: solo se guarda, por ítem, si se muestra en la
// página pública y cómo (categoría, orden, texto, disponible) y la EXCEPCIÓN
// opcional "precio mostrado" (que no toca el precio real de los socios).
//
// Firestore: precios_publicos/config = {
//   borrador:  { items: { <precioId>: {...} }, contacto: {...} },   ← lo que se edita
//   publicado: { items: {...}, contacto: {...} },                   ← lo que ve la página
//   publicadoEn, borradorEn (ms)
// }

export const CATEGORIAS_BASE = Object.freeze(["Streaming", "TV Digital", "Música", "Herramientas"]);
const MAPA_CATEGORIA = Object.freeze({ productividad: "Herramientas", software: "Herramientas", musica: "Música", "tv digital": "TV Digital", streaming: "Streaming" });

const txt = (v, max = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const numONull = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Math.round(Number(v) * 100) / 100);

// Quita emojis/símbolos de la categoría del Panel de Socios: "📺 Streaming" → "Streaming".
export function categoriaLimpia(cat = "") {
  const limpia = String(cat || "").replace(/[^\p{L}\p{N}\s+&/-]/gu, " ").replace(/\s+/g, " ").trim();
  const k = limpia.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return MAPA_CATEGORIA[k] || limpia || "Otros";
}

export function normalizarItem(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    publico: r.publico === true,
    categoria: txt(r.categoria, 40),
    orden: numONull(r.orden),
    texto: txt(r.texto, 90),
    disponible: r.disponible !== false,
    usarPrecioSocio: r.usarPrecioSocio !== false,
    precioMostrado: numONull(r.precioMostrado),
    precioSugerido: numONull(r.precioSugerido), // R147: precio sugerido de venta (independiente; no toca el precio socio)
  };
}

// R147 · Condición comercial editable (compra mínima MENSUAL). El 5 solo es el valor inicial.
export function normalizarCondiciones(raw) {
  const r = raw && typeof raw === "object" ? raw : null;
  const n = r ? Math.round(Number(r.minimoMensual)) : 5;
  return {
    minimoMensual: Number.isFinite(n) && n > 0 ? Math.min(n, 9999) : null,
    mostrar: r ? r.mostrar !== false : true,
    texto: txt(r && r.texto, 400),
    // R149: puntos de la tarjeta de condiciones (uno por línea en Sublichat). Valores iniciales editables.
    puntos: (r && Array.isArray(r.puntos) ? r.puntos : PUNTOS_INICIALES).map((x) => txt(x, 140)).filter(Boolean).slice(0, 8),
  };
}
const PUNTOS_INICIALES = ["Puede combinar diferentes plataformas.", "Precios exclusivos para socios revendedores.", "Entrega de pedido con pago por adelantado."];

export function normalizarContacto(raw = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  let destino = txt(r.destino, 300);
  if (destino && !/^https:\/\//i.test(destino)) destino = destino.replace(/\D/g, "").slice(0, 15);
  if (destino && /^\d{8}$/.test(destino)) destino = "504" + destino; // número hondureño sin código de país
  return { destino, mensaje: txt(r.mensaje || "Hola, quiero ser revendedor de Sublicuentas.", 300) };
}

export function normalizarBorrador(raw = {}, idsValidos = null) {
  const r = raw && typeof raw === "object" ? raw : {};
  const items = {};
  for (const [id, it] of Object.entries(r.items || {})) {
    const limpioId = String(id || "").trim();
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(limpioId)) continue;
    if (idsValidos && !idsValidos.has(limpioId)) continue;
    items[limpioId] = normalizarItem(it);
  }
  return { items, contacto: normalizarContacto(r.contacto), condiciones: normalizarCondiciones(r.condiciones) };
}

// Representación estable para saber si de verdad cambió algo (la fecha de
// "Última actualización" solo se mueve con un cambio real, nunca por visitas).
export function firmaBorrador(b = {}) {
  const n = normalizarBorrador(b);
  const items = Object.keys(n.items).sort().filter((id) => n.items[id].publico).map((id) => [id, n.items[id]]);
  return JSON.stringify({ items, contacto: n.contacto, condiciones: n.condiciones });
}

export function enlaceContacto(contacto = {}, texto = "") {
  const c = normalizarContacto(contacto);
  if (!c.destino) return "";
  if (/^https:\/\//i.test(c.destino)) return c.destino;
  return `https://wa.me/${c.destino}?text=${encodeURIComponent(texto || c.mensaje)}`;
}

const msDe = (v) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  const s = v.seconds ?? v._seconds;
  if (s != null) return Number(s) * 1000;
  const d = Date.parse(v);
  return Number.isFinite(d) ? d : 0;
};

/**
 * Arma la lista que ve el público. `docs` = [{id, ...datos de precios/<id>}].
 * Nunca devuelve costos, proveedores, stock, detalle interno ni datos de socios.
 */
export function armarListaPublica(docs = [], estado = {}) {
  const items = (estado && estado.items) || {};
  const salida = [];
  let ultima = msDe(estado.publicadoEn);
  for (const d of docs) {
    const cfg = items[d.id];
    if (!cfg || cfg.publico !== true) continue;
    if (d.activo === false) continue; // si se apaga en el Panel de Socios, también sale de la lista pública
    const it = normalizarItem(cfg);
    const precioSocio = d.precio === null || d.precio === undefined || d.precio === "" ? null : Number(d.precio);
    const precio = it.usarPrecioSocio ? (Number.isFinite(precioSocio) ? precioSocio : null) : it.precioMostrado;
    const precioSugerido = it.precioSugerido;
    // Ganancia sugerida = venta sugerida − precio revendedor (margen del socio; nunca la utilidad de Sublicuentas).
    const gananciaSugerida = precio != null && precioSugerido != null && precioSugerido > precio ? Math.round((precioSugerido - precio) * 100) / 100 : null;
    salida.push({
      id: d.id,
      nombre: txt(d.nombre, 80),
      texto: it.texto || txt([d.variante, d.categoriaSub].filter(Boolean).join(" · "), 90),
      categoria: it.categoria || categoriaLimpia(d.categoria),
      precio,
      precioSugerido,
      gananciaSugerida,
      disponible: it.disponible,
      _orden: it.orden ?? (Number(d.categoriaOrden) || 999) * 1000 + (Number(d.orden) || 999),
    });
    ultima = Math.max(ultima, msDe(d.updatedAt));
  }
  const ordenCat = (c) => { const i = CATEGORIAS_BASE.indexOf(c); return i < 0 ? 100 : i; };
  salida.sort((a, b) => ordenCat(a.categoria) - ordenCat(b.categoria) || a.categoria.localeCompare(b.categoria, "es") || a._orden - b._orden || a.nombre.localeCompare(b.nombre, "es"));
  const categorias = [];
  for (const it of salida) {
    let g = categorias.find((c) => c.nombre === it.categoria);
    if (!g) { g = { nombre: it.categoria, productos: [] }; categorias.push(g); }
    const { _orden, categoria, ...pub } = it;
    g.productos.push(pub);
  }
  const contacto = normalizarContacto(estado.contacto);
  const cond = normalizarCondiciones(estado.condiciones);
  return {
    condiciones: cond.mostrar && (cond.minimoMensual || cond.texto || cond.puntos.length) ? { minimoMensual: cond.minimoMensual, puntos: cond.puntos, texto: cond.texto } : null,
    categorias,
    total: salida.length,
    actualizadoEn: ultima || null,
    contacto: { enlace: enlaceContacto(contacto), mensaje: contacto.mensaje, destino: contacto.destino ? (/^https:/i.test(contacto.destino) ? "web" : "whatsapp") : "" },
  };
}

// Docs de la tarifa GENERAL del Panel de Socios (la especial vive en otra colección).
export async function leerPreciosSocios(db) {
  const snap = await db.collection("precios").get();
  return snap.docs.map((d) => ({ ...(d.data() || {}), id: d.id }))
    .filter((d) => !d.tarifaId || d.tarifaId === "general");
}

export const CONFIG_DOC = ["precios_publicos", "config"];
// R148: versión del servidor, para que la pantalla avise si Vercel no publicó la actualización.
export const VERSION_PRECIOS_PUBLICOS = "r149";
