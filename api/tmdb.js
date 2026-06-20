// api/tmdb.js  ·  VERSION 6  (SOLO datos de Honduras · sin rellenar con otros países)
//
// CORRECCIÓN IMPORTANTE:
//   En v3-v5, si Honduras (HN) no tenía datos, yo rellenaba con México/EE.UU.
//   Eso provocaba errores como "Rosario Tijeras en HBO Max" (en México sí, en
//   Honduras NO). Para orientar clientes eso es inaceptable.
//   v6 muestra EXCLUSIVAMENTE lo que TMDB reporta para Honduras. Si TMDB no tiene
//   dato de HN para un título, se dice "sin datos" en vez de adivinar.
//
//   Se mantiene el reintento contra los cortes intermitentes de TMDB.
//
// Vercel -> Settings -> Environment Variables:  TMDB_API_KEY = tu_key (API Key v3 auth)

export const config = { maxDuration: 60 };

const REGION = "HN"; // SOLO Honduras. No se usa ningún otro país.

const sleep = ms => new Promise(r => setTimeout(r, ms));

function esTransitorio(data) {
  if (!data || typeof data !== "object") return true;
  if (data.success === false || data.status_code) {
    const msg = String(data.status_message || "").toLowerCase();
    if (msg.includes("backend") || msg.includes("connect") ||
        msg.includes("unavailable") || msg.includes("timeout") ||
        msg.includes("temporarily")) return true;
  }
  return false;
}

async function tmdbGet(url, { ms = 9000, intentos = 5 } = {}) {
  let ultimo = null;
  for (let i = 0; i < intentos; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      const data = await r.json().catch(() => null);
      if (!r.ok || esTransitorio(data)) {
        ultimo = data || { status_message: "HTTP " + r.status };
        await sleep(500 + i * 600);
        continue;
      }
      return data;
    } catch (e) {
      ultimo = { status_message: e.message || "abort" };
      await sleep(500 + i * 600);
    } finally {
      clearTimeout(t);
    }
  }
  return ultimo || { success: false, status_message: "sin respuesta tras varios intentos" };
}

// Plataformas SOLO de Honduras. flatrate = suscripción; free/ads = gratis (Tubi, etc.)
// rent/buy (alquiler/compra) se EXCLUYEN a propósito: el negocio vende suscripciones.
function provadoresHN(results) {
  const hn = results && results[REGION];
  if (!hn) return [];
  const flat = [...(hn.flatrate || []), ...(hn.free || []), ...(hn.ads || [])];
  return [...new Set(flat.map(p => p.provider_name))];
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(200).json({ ok: true, version: 6, msg: "tmdb v6 activo (solo HN). Usá POST." });

  const { query } = req.body || {};
  if (!query) return res.status(400).json({ error: "Falta el texto de búsqueda" });

  const KEY = (process.env.TMDB_API_KEY || "").trim();
  if (!KEY) return res.status(500).json({ error: "Falta TMDB_API_KEY en Vercel" });

  try {
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

    const out = await Promise.all(items.map(async r => {
      const type = r.media_type;
      let proveedores = [];
      try {
        const pUrl = `https://api.themoviedb.org/3/${type}/${r.id}/watch/providers?api_key=${KEY}`;
        const pData = await tmdbGet(pUrl, { ms: 7000, intentos: 3 });
        proveedores = provadoresHN(pData && pData.results); // SOLO Honduras
      } catch (e) { /* sin datos de proveedores */ }
      return {
        titulo: r.title || r.name,
        tipo: type === "movie" ? "Película" : "Serie",
        anio: (r.release_date || r.first_air_date || "").slice(0, 4),
        poster: r.poster_path ? `https://image.tmdb.org/t/p/w200${r.poster_path}` : null,
        rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
        sinopsis: r.overview || "",
        proveedores // SIEMPRE datos de Honduras (o vacío si TMDB no tiene)
      };
    }));

    return res.status(200).json({ resultados: out });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ error: "Error consultando TMDB: " + (e.message || "desconocido") });
  }
}
