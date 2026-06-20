// api/tmdb.js  ·  VERSION 4  (timeouts más amplios + reintento + maxDuration)
//
// v3 ya está corriendo (el error pasó de "token '<'" a "operation was aborted"),
// pero TMDB estaba tardando >6s desde Vercel (arranque en frío / lentitud) y el
// timeout la cortaba. v4:
//   - Sube el timeout de la búsqueda a 12s y reintenta 1 vez si se corta.
//   - Da hasta 60s de duración a la función (maxDuration).
//   - Si los proveedores fallan, igual muestra el título (no rompe todo).
//   - Región flexible HN->MX->CR->GT->... para decir SI o SI dónde está.
//
// Vercel -> Settings -> Environment Variables:  TMDB_API_KEY = tu_key  (API Key v3 auth)

export const config = { maxDuration: 60 };

const PREF_REGIONS = ["HN", "MX", "CR", "GT", "SV", "NI", "CO", "AR", "CL", "PE", "US", "ES"];

// fetch con timeout
async function jget(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// fetch con timeout + 1 reintento (para la búsqueda, que es la crítica)
async function jgetRetry(url, ms, intentos = 2) {
  let ultimoError;
  for (let i = 0; i < intentos; i++) {
    try {
      return await jget(url, ms);
    } catch (e) {
      ultimoError = e;
      await new Promise(r => setTimeout(r, 400));
    }
  }
  throw ultimoError;
}

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
  for (const reg of Object.keys(results || {})) {
    const hit = tryReg(reg);
    if (hit) return hit;
  }
  return { region: null, lista: [] };
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(200).json({ ok: true, version: 4, msg: "tmdb v4 activo. Usá POST para buscar." });

  const { query } = req.body || {};
  if (!query) return res.status(400).json({ error: "Falta el texto de búsqueda" });

  const KEY = (process.env.TMDB_API_KEY || "").trim();
  if (!KEY) return res.status(500).json({ error: "Falta TMDB_API_KEY en Vercel" });

  try {
    // 1. Buscar (pelis + series + novelas) — con reintento
    const sUrl = `https://api.themoviedb.org/3/search/multi?api_key=${KEY}&language=es-MX&query=${encodeURIComponent(query)}&include_adult=false`;
    let sData;
    try {
      sData = await jgetRetry(sUrl, 12000, 2);
    } catch (e) {
      return res.status(200).json({
        error: "TMDB no respondió a tiempo (probá de nuevo en unos segundos). Si sigue, puede ser que TMDB esté bloqueando el servidor."
      });
    }

    if (sData.success === false || sData.status_code)
      return res.status(200).json({ error: "TMDB: " + (sData.status_message || "clave inválida") });

    const items = (sData.results || [])
      .filter(r => (r.media_type === "movie" || r.media_type === "tv") && (r.title || r.name))
      .slice(0, 6);

    if (!items.length) return res.status(200).json({ resultados: [] });

    // 2. Proveedores (una llamada por título, trae todos los países). Best-effort:
    //    si una se corta, ese título sale sin plataforma pero NO rompe la lista.
    const out = await Promise.all(items.map(async r => {
      const type = r.media_type;
      let proveedores = [], region = null;
      try {
        const pUrl = `https://api.themoviedb.org/3/${type}/${r.id}/watch/providers?api_key=${KEY}`;
        const pData = await jget(pUrl, 7000);
        const pick = pickProviders(pData.results);
        proveedores = pick.lista;
        region = pick.region;
      } catch (e) { /* sin proveedores para este título */ }
      return {
        titulo: r.title || r.name,
        tipo: type === "movie" ? "Película" : "Serie",
        anio: (r.release_date || r.first_air_date || "").slice(0, 4),
        poster: r.poster_path ? `https://image.tmdb.org/t/p/w200${r.poster_path}` : null,
        rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
        sinopsis: r.overview || "",
        proveedores,
        region
      };
    }));

    return res.status(200).json({ resultados: out });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ error: "Error consultando TMDB: " + (e.message || "desconocido") });
  }
}
