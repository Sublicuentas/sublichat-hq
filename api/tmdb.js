// api/tmdb.js  ·  VERSION 3  (región flexible HN→MX→US + timeouts anti-cuelgue)
//
// Qué arregla:
// 1) El error "Unexpected token '<'": antes hacía hasta 9 llamadas a TMDB SIN
//    límite de tiempo; si una se colgaba, Vercel cortaba la función y devolvía
//    HTML. Ahora cada llamada tiene timeout (AbortController) y SIEMPRE responde JSON.
// 2) "Dónde la veo": TMDB casi no tiene datos de Honduras (HN). Ahora si HN viene
//    vacío, busca en MX, CR, GT, SV, CO, AR... (mismo catálogo de Latam para
//    Netflix/Disney+/HBO Max/Prime/Vix, etc.) para mostrar SÍ o SÍ en qué plataforma está.
//
// Vercel → Settings → Environment Variables:  TMDB_API_KEY = tu_key  (API Key v3 auth)

const PREF_REGIONS = ["HN", "MX", "CR", "GT", "SV", "NI", "CO", "AR", "CL", "PE", "US", "ES"];

// fetch con timeout: si TMDB tarda demasiado, cortamos y seguimos (nunca se cuelga)
async function jget(url, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// De todos los países que devuelve TMDB, elige el primero (según prioridad) que
// tenga plataformas. Así siempre decimos en qué servicio está, aunque HN venga vacío.
function pickProviders(results) {
  const tryReg = reg => {
    const r = results && results[reg];
    if (!r) return null;
    const flat = [...(r.flatrate || []), ...(r.free || []), ...(r.ads || [])];
    if (!flat.length) return null;
    return { region: reg, lista: [...new Set(flat.map(p => p.provider_name))] };
  };
  for (const reg of PREF_REGIONS) {
    const hit = tryReg(reg);
    if (hit) return hit;
  }
  // si ninguna de las preferidas tiene, agarramos cualquier país con plataforma
  for (const reg of Object.keys(results || {})) {
    const hit = tryReg(reg);
    if (hit) return hit;
  }
  return { region: null, lista: [] };
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(200).json({ ok: true, version: 3, msg: "tmdb v3 activo. Usá POST para buscar." });

  const { query } = req.body || {};
  if (!query) return res.status(400).json({ error: "Falta el texto de búsqueda" });

  const KEY = (process.env.TMDB_API_KEY || "").trim();
  if (!KEY) return res.status(500).json({ error: "Falta TMDB_API_KEY en Vercel" });

  try {
    // 1. Buscar (pelis + series + novelas a la vez)
    const sUrl = `https://api.themoviedb.org/3/search/multi?api_key=${KEY}&language=es-MX&query=${encodeURIComponent(query)}&include_adult=false`;
    const sData = await jget(sUrl, 6000);

    if (sData.success === false || sData.status_code)
      return res.status(200).json({ error: "TMDB: " + (sData.status_message || "clave inválida") });

    const items = (sData.results || [])
      .filter(r => (r.media_type === "movie" || r.media_type === "tv") && (r.title || r.name))
      .slice(0, 6); // 6 (antes 8) para no saturar la función

    if (!items.length) return res.status(200).json({ resultados: [] });

    // 2. Para cada resultado: una sola llamada de proveedores (trae TODOS los países)
    //    y elegimos el mejor país disponible.
    const out = await Promise.all(items.map(async r => {
      const type = r.media_type;
      let proveedores = [], region = null;
      try {
        const pUrl = `https://api.themoviedb.org/3/${type}/${r.id}/watch/providers?api_key=${KEY}`;
        const pData = await jget(pUrl, 4500);
        const pick = pickProviders(pData.results);
        proveedores = pick.lista;
        region = pick.region;
      } catch (e) { /* si falla una, seguimos con las demás */ }
      return {
        titulo: r.title || r.name,
        tipo: type === "movie" ? "Película" : "Serie",
        anio: (r.release_date || r.first_air_date || "").slice(0, 4),
        poster: r.poster_path ? `https://image.tmdb.org/t/p/w200${r.poster_path}` : null,
        rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
        sinopsis: r.overview || "",
        proveedores,
        region // "HN", "MX", etc. (por si querés mostrarlo en el front)
      };
    }));

    return res.status(200).json({ resultados: out });
  } catch (e) {
    console.error(e);
    // 200 (no 500) para que el front SIEMPRE reciba JSON y nunca vea "token '<'"
    return res.status(200).json({ error: "Error consultando TMDB: " + (e.message || "desconocido") });
  }
}
