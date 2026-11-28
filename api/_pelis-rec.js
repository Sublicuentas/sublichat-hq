// api/_pelis-rec.js · R210 · Pelis y estrenos: recomendaciones del día + cartelera (solo Honduras)
//
// Reglas (orden de trabajo 28/11/2026, punto 04):
//  - Solo se recomienda lo que TMDB/JustWatch confirma DISPONIBLE en Honduras por suscripción o gratis
//    (flatrate / free / ads). Alquiler o compra NO cuentan como «incluida».
//  - Las CORRECCIONES manuales de tmdb.js mandan sobre TMDB.
//  - Selección diaria según la fecha de Honduras: misma lista para todos los usuarios ese día.
//  - La clave TMDB nunca sale al navegador (las carátulas son URLs públicas de image.tmdb.org).
//  - Si TMDB falla, se devuelve error y el buscador sigue funcionando aparte.

export const REGION = "HN";
export const CANTIDAD = 12;      // tarjetas calculadas por día (se muestran 3; «Ver más» abre el resto)
export const VISIBLES = 3;       // propuesta del documento: 3 recomendaciones diarias
const IMG = "https://image.tmdb.org/t/p/";

export function hoyHN(now = new Date()) { return now.toLocaleDateString("en-CA", { timeZone: "America/Tegucigalpa" }); }
export function horaHN(now = new Date()) { return now.toLocaleTimeString("en-GB", { timeZone: "America/Tegucigalpa", hour: "2-digit", minute: "2-digit", hour12: false }); }
export function sumarDias(ymd, n) { const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

// Plataformas HN incluidas (sin alquiler/compra)
export function proveedoresHN(results, region = REGION) {
  const hn = results && results[region];
  if (!hn) return [];
  const flat = [...(hn.flatrate || []), ...(hn.free || []), ...(hn.ads || [])];
  return [...new Set(flat.map((p) => p.provider_name).filter(Boolean))];
}

// Nombre comercial único por plataforma (TMDB trae variantes: «Netflix basic with Ads», «Amazon Prime Video with Ads», «Disney Plus»…)
const ALIAS = [
  [/^netflix/i, "Netflix"], [/prime video|amazon video/i, "Prime Video"], [/^disney/i, "Disney+"], [/^hbo max$|^max$|^max amazon/i, "Max"],
  [/paramount/i, "Paramount+"], [/apple tv/i, "Apple TV+"], [/crunchyroll/i, "Crunchyroll"], [/^vix/i, "ViX"], [/universal\+|universal plus/i, "Universal+"],
  [/mubi/i, "MUBI"], [/tubi/i, "Tubi"], [/pluto/i, "Pluto TV"], [/star\+|star plus/i, "Star+"], [/claro video/i, "Claro video"], [/viki/i, "Viki"],
];
export function nombrePlataforma(n) { const s = String(n || "").trim(); for (const [re, v] of ALIAS) if (re.test(s)) return v; return s; }
export function normalizarPlataformas(lista) { return [...new Set((lista || []).map(nombrePlataforma).filter(Boolean))]; }

// Pseudoaleatorio estable por día (FNV-1a): mismo día ⇒ misma selección en cualquier instancia
export function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/**
 * Elige las recomendaciones del día.
 * candidatos: [{ id, tipo:'movie'|'tv', proveedores:[...], ... }] ya verificados en HN.
 * evitar: Set de claves 'tipo:id' recomendadas en los días anteriores.
 * Mezcla películas y series y reparte plataformas (no 3 de Netflix seguidas si hay otras).
 */
export function elegirDelDia(candidatos, fecha, { cantidad = CANTIDAD, evitar = new Set() } = {}) {
  const validos = candidatos.filter((c) => c && c.proveedores && c.proveedores.length && c.sinopsis && c.poster);
  const frescos = validos.filter((c) => !evitar.has(c.tipo + ":" + c.id));
  // primero lo que no se recomendó en los días anteriores; si no alcanza, se completa con repetidos al final
  if (evitar.size && frescos.length < cantidad && frescos.length < validos.length) {
    const a = elegirDelDia(frescos, fecha, { cantidad });
    return a.concat(elegirDelDia(validos.filter((c) => evitar.has(c.tipo + ":" + c.id)), fecha, { cantidad: cantidad - a.length }));
  }
  const base = frescos;
  const orden = (l) => l.slice().sort((a, z) => hash(fecha + ":" + a.tipo + a.id) - hash(fecha + ":" + z.tipo + z.id));
  const colas = { movie: orden(base.filter((c) => c.tipo === "movie")), tv: orden(base.filter((c) => c.tipo === "tv")) };
  const out = [], usadas = new Map();
  let turno = hash(fecha) % 2 ? "tv" : "movie";
  while (out.length < cantidad && (colas.movie.length || colas.tv.length)) {
    const cola = colas[turno].length ? colas[turno] : colas[turno === "movie" ? "tv" : "movie"];
    // preferir el primero cuya plataforma principal se haya usado menos
    let k = 0, mejor = Infinity;
    for (let i = 0; i < Math.min(cola.length, 6); i++) { const u = usadas.get(cola[i].proveedores[0]) || 0; if (u < mejor) { mejor = u; k = i; } }
    const [x] = cola.splice(k, 1);
    out.push(x); usadas.set(x.proveedores[0], (usadas.get(x.proveedores[0]) || 0) + 1);
    turno = turno === "movie" ? "tv" : "movie";
  }
  return out;
}

// Etiqueta honesta para la cartelera de cines (fecha de estreno de TMDB)
export function estadoCartelera(fechaEstreno, hoy, proximo = false) {
  if (!fechaEstreno) return { estado: "En cartelera", nota: "En cines" };
  if (proximo || fechaEstreno > hoy) { const [y, m, d] = fechaEstreno.split("-"); return { estado: "Próximo estreno", nota: `${d}/${m}/${y}` }; }
  if (fechaEstreno >= sumarDias(hoy, -10)) return { estado: "Nuevo estreno", nota: "En cartelera" };
  if (fechaEstreno >= sumarDias(hoy, -35)) return { estado: "Estreno reciente", nota: "En cartelera" };
  return { estado: "En cartelera", nota: "En cines" };
}

const anioDe = (r) => String(r.release_date || r.first_air_date || "").slice(0, 4);
export function itemBasico(r, tipo, generos = {}) {
  return {
    id: r.id, tipo, tipoTxt: tipo === "movie" ? "Película" : "Serie",
    titulo: r.title || r.name || "", anio: anioDe(r),
    generos: (r.genre_ids || []).map((g) => generos[g]).filter(Boolean).slice(0, 2),
    rating: r.vote_average && (r.vote_count || 0) >= 50 ? Math.round(r.vote_average * 10) / 10 : null,
    sinopsis: String(r.overview || "").trim(),
    poster: r.poster_path ? IMG + "w342" + r.poster_path : null,
  };
}

// Limita concurrencia para no saturar TMDB
export async function enLotes(lista, n, fn) { const out = []; for (let i = 0; i < lista.length; i += n) out.push(...(await Promise.all(lista.slice(i, i + n).map(fn)))); return out; }

/**
 * Calcula el paquete del día con un cliente TMDB inyectado: get(path, params) → JSON.
 * corregir(titulo, anio, lista) aplica las CORRECCIONES manuales.
 */
export async function calcularDelDia({ get, corregir = (t, a, l) => l, fecha = hoyHN(), evitar = new Set(), now = new Date() }) {
  const [gm, gt] = await Promise.all([get("/genre/movie/list", { language: "es-MX" }), get("/genre/tv/list", { language: "es-MX" })]);
  const G = {}; for (const g of [...(gm.genres || []), ...(gt.genres || [])]) G[g.id] = g.name;
  const disc = (tipo, page, minVotos) => get(`/discover/${tipo}`, { language: "es-MX", watch_region: REGION, with_watch_monetization_types: "flatrate|free|ads", sort_by: "popularity.desc", "vote_count.gte": minVotos, include_adult: "false", page });
  const lotes = await Promise.all([disc("movie", 1, 300), disc("movie", 2, 300), disc("tv", 1, 150), disc("tv", 2, 150)]);
  if (lotes.every((l) => !l || !Array.isArray(l.results))) throw new Error((lotes[0] && lotes[0].status_message) || "TMDB no respondió");
  const crudos = [];
  lotes.forEach((l, i) => (l.results || []).forEach((r) => crudos.push(itemBasico(r, i < 2 ? "movie" : "tv", G))));
  // pre-selección estable (sin verificar) para no consultar 80 títulos: 30 candidatos con sinopsis y póster
  const pre = crudos.filter((c) => c.sinopsis && c.poster && !/[぀-ヿ一-鿿가-힯]/.test(c.titulo))
    .sort((a, z) => hash(fecha + "p" + a.tipo + a.id) - hash(fecha + "p" + z.tipo + z.id));
  const prefer = pre.filter((c) => !evitar.has(c.tipo + ":" + c.id));
  const aVerificar = [...prefer, ...pre.filter((c) => evitar.has(c.tipo + ":" + c.id))].slice(0, 30);
  const verificados = await enLotes(aVerificar, 6, async (c) => {
    try { const p = await get(`/${c.tipo}/${c.id}/watch/providers`, {}); return { ...c, proveedores: normalizarPlataformas(corregir(c.titulo, c.anio, proveedoresHN(p && p.results))) }; }
    catch (_) { return { ...c, proveedores: [] }; }
  });
  const recomendaciones = elegirDelDia(verificados, fecha, { evitar });

  // Cartelera de cines en Honduras (si TMDB tiene datos regionales)
  let cartelera = [];
  try {
    const [np, up] = await Promise.all([get("/movie/now_playing", { language: "es-MX", region: REGION, page: 1 }), get("/movie/upcoming", { language: "es-MX", region: REGION, page: 1 })]);
    const vistos = new Set();
    const arma = (r, prox) => { if (vistos.has(r.id) || !r.poster_path) return null; vistos.add(r.id); const e = estadoCartelera(r.release_date, fecha, prox); return { id: r.id, tipo: "movie", titulo: r.title || "", anio: anioDe(r), poster: IMG + "w185" + r.poster_path, fecha: r.release_date || "", ...e }; };
    const ahora = (np.results || []).sort((a, z) => String(z.release_date).localeCompare(String(a.release_date))).map((r) => arma(r, false)).filter(Boolean);
    const prox = (up.results || []).filter((r) => r.release_date > fecha).sort((a, z) => String(a.release_date).localeCompare(String(z.release_date))).map((r) => arma(r, true)).filter(Boolean);
    cartelera = [...ahora.slice(0, 8), ...prox.slice(0, 4)];
  } catch (_) { cartelera = []; }

  return { fecha, generado: now.toISOString(), horaHN: horaHN(now), region: REGION, visibles: VISIBLES, recomendaciones, cartelera };
}

/** Detalle de un título: sinopsis completa, clasificación, duración o temporadas y plataformas HN. */
export async function detalle({ get, corregir = (t, a, l) => l, id, tipo }) {
  if (!/^\d+$/.test(String(id)) || !["movie", "tv"].includes(tipo)) throw new Error("Título no válido");
  const extra = tipo === "movie" ? "release_dates,watch/providers" : "content_ratings,watch/providers";
  const d = await get(`/${tipo}/${id}`, { language: "es-MX", append_to_response: extra });
  if (!d || d.success === false || !d.id) throw new Error((d && d.status_message) || "TMDB no respondió");
  let sinopsis = String(d.overview || "").trim();
  if (!sinopsis) { try { const en = await get(`/${tipo}/${id}`, { language: "es-ES" }); sinopsis = String(en.overview || "").trim(); } catch (_) {} }
  let clasificacion = "";
  if (tipo === "movie") {
    const rs = (d.release_dates && d.release_dates.results) || [];
    for (const pais of [REGION, "MX", "US"]) { const r = rs.find((x) => x.iso_3166_1 === pais); const c = r && (r.release_dates || []).map((x) => x.certification).find(Boolean); if (c) { clasificacion = c + (pais === REGION ? "" : ` (${pais})`); break; } }
  } else {
    const rs = (d.content_ratings && d.content_ratings.results) || [];
    for (const pais of [REGION, "MX", "US"]) { const r = rs.find((x) => x.iso_3166_1 === pais && x.rating); if (r) { clasificacion = r.rating + (pais === REGION ? "" : ` (${pais})`); break; } }
  }
  const titulo = d.title || d.name || "", anio = anioDe(d);
  const provs = d["watch/providers"] && d["watch/providers"].results;
  return {
    id: d.id, tipo, tipoTxt: tipo === "movie" ? "Película" : "Serie", titulo, anio, tagline: d.tagline || "",
    generos: (d.genres || []).map((g) => g.name), sinopsis, clasificacion,
    duracion: tipo === "movie" && d.runtime ? d.runtime : null,
    temporadas: tipo === "tv" ? d.number_of_seasons || null : null, episodios: tipo === "tv" ? d.number_of_episodes || null : null,
    estadoSerie: tipo === "tv" ? ({ "Returning Series": "En emisión", Ended: "Finalizada", Canceled: "Cancelada", "In Production": "En producción" }[d.status] || "") : "",
    rating: d.vote_average && (d.vote_count || 0) >= 50 ? Math.round(d.vote_average * 10) / 10 : null,
    poster: d.poster_path ? IMG + "w342" + d.poster_path : null,
    proveedores: normalizarPlataformas(corregir(titulo, anio, proveedoresHN(provs))),
    soloAlquiler: !proveedoresHN(provs).length && !!(provs && provs[REGION] && ((provs[REGION].rent || []).length || (provs[REGION].buy || []).length)),
  };
}
