// api/tmdb.js  ·  VERSION 5  (reintento contra los bloqueos intermitentes de TMDB)
//
// Diagnóstico real: TMDB (detrás de CloudFront/openresty) rechaza de forma
// INTERMITENTE las IPs de datacenter de Vercel y devuelve en su JSON:
//   {"success":false,"status_message":"Couldn't connect to the backend server."}
// No es timeout ni la key. La cura para un fallo intermitente es REINTENTAR.
//
// v5:
//   - tmdbGet() reintenta hasta 5 veces cuando: (a) la conexión se corta/aborta,
//     o (b) TMDB responde con un error transitorio (success:false / "backend" /
//     "unavailable" / "connect" / status 5xx). Backoff creciente entre intentos.
//   - 60s de duración (maxDuration) para tener margen.
//   - Región flexible HN->MX->CR->GT->... para decir SI o SI en qué plataforma está.
//
// Vercel -> Settings -> Environment Variables:  TMDB_API_KEY = tu_key (API Key v3 auth)

export const config = { maxDuration: 60 };

const PREF_REGIONS = ["HN", "MX", "CR", "GT", "SV", "NI", "CO", "AR", "CL", "PE", "US", "ES"];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ¿La respuesta de TMDB es un error transitorio que vale la pena reintentar?
function esTransitorio(data) {
  if (!data || typeof data !== "object") return true;          // sin JSON válido
  if (data.success === false || data.status_code) {
    const msg = String(data.status_message || "").toLowerCase();
    if (msg.includes("backend") || msg.includes("connect") ||
        msg.includes("unavailable") || msg.includes("timeout") ||
        msg.includes("temporarily")) return true;
    // status_code 7 (key inválida) o 34 (no encontrado) NO se reintentan
  }
  return false;
}

// GET a TMDB con timeout + reintentos contra fallos intermitentes
async function tmdbGet(url, { ms = 9000, intentos = 5 } = {}) {
  let ultimo = null;
  for (let i = 0; i < intentos; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      const data = await r.json().catch(() => null);
      // si vino un error transitorio (o 5xx), reintentamos
      if (!r.ok || esTransitorio(data)) {
        ultimo = data || { status_message: "HTTP " + r.status };
        await sleep(500 + i * 600);
        continue;
      }
      return data; // OK
    } catch (e) {
      ultimo = { status_message: e.message || "abort" };
      await sleep(500 + i * 600);
    } finally {
      clearTimeout(t);
    }
  }
  // se agotaron los intentos: devolvemos el último error para reportarlo
  return ultimo || { success: false, status_message: "sin respuesta tras varios intentos" };
}

function pickProviders(results) {
  const tryReg = reg => {
    const r = results && results[reg];
    if (!r) return null;
    const flat = [...(r.flatrate || []), ...(r.free || []), ...(r.ads || [])];
    if (!flat.length) return null;
    return { region: reg, lista: [...new Set(flat.map(p => p.provider_name))] };
  };
  for (const reg of PREF_REGIONS) { const h = tryReg(reg); if (h) return h; }
  for (const reg of Object.keys(results || {})) { const h = tryReg(reg); if (h) return h; }
  return { region: null, lista: [] };
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(200).json({ ok: true, version: 5, msg: "tmdb v5 activo. Usá POST para buscar." });

  const { query } = req.body || {};
  if (!query) return res.status(400).json({ error: "Falta el texto de búsqueda" });

  const KEY = (process.env.TMDB_API_KEY || "").trim();
  if (!KEY) return res.status(500).json({ error: "Falta TMDB_API_KEY en Vercel" });

  try {
    // 1. Buscar (pelis + series + novelas) — con reintentos
    const sUrl = `https://api.themoviedb.org/3/search/multi?api_key=${KEY}&language=es-MX&query=${encodeURIComponent(query)}&include_adult=false`;
    const sData = await tmdbGet(sUrl, { ms: 9000, intentos: 5 });

    if (!sData || sData.success === false || sData.status_code) {
      const msg = sData && sData.status_message ? sData.status_message : "no respondió";
      return res.status(200).json({ error: "TMDB: " + msg + " (reintenté varias veces; si persiste, TMDB está bloqueando la IP de Vercel)." });
    }

    const items = (sData.results || [])
      .filter(r => (r.media_type === "movie" || r.media_type === "tv") && (r.title || r.name))
      .slice(0, 6);

    if (!items.length) return res.status(200).json({ resultados: [] });

    // 2. Proveedores (best-effort, con reintentos cortos). Si falla, el título igual sale.
    const out = await Promise.all(items.map(async r => {
      const type = r.media_type;
      let proveedores = [], region = null;
      try {
        const pUrl = `https://api.themoviedb.org/3/${type}/${r.id}/watch/providers?api_key=${KEY}`;
        const pData = await tmdbGet(pUrl, { ms: 7000, intentos: 3 });
        const pick = pickProviders(pData && pData.results);
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
