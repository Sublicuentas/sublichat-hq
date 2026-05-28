// api/tmdb.js  ·  Buscador de películas/series con disponibilidad de streaming
// 1) Sacá tu API key gratis en https://www.themoviedb.org/settings/api
//    (Crear cuenta → Settings → API → "API Read Access Token" NO; usá la "API Key (v3 auth)")
// 2) En Vercel → Settings → Environment Variables agregá: TMDB_API_KEY = tu_key
// 3) Redeploy. Listo.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });
  const { query } = req.body || {};
  if (!query) return res.status(400).json({ error: "Falta el texto de búsqueda" });

  const KEY = (process.env.TMDB_API_KEY || "").trim();
  if (!KEY) return res.status(500).json({ error: "Falta TMDB_API_KEY en Vercel" });

  const REGION = "HN"; // Honduras
  try {
    // 1. Buscar (pelis + series a la vez)
    const sUrl = `https://api.themoviedb.org/3/search/multi?api_key=${KEY}&language=es-ES&query=${encodeURIComponent(query)}&include_adult=false`;
    const sResp = await fetch(sUrl);
    const sData = await sResp.json();

    // Si TMDB rechaza la key, avisamos con el detalle real
    if (sData.success === false || sData.status_code) {
      return res.status(200).json({ error: "TMDB: " + (sData.status_message || "clave inválida") });
    }

    const items = (sData.results || [])
      .filter(r => (r.media_type === "movie" || r.media_type === "tv") && (r.title || r.name))
      .slice(0, 8);

    if (!items.length) return res.status(200).json({ resultados: [] });

    // 2. Para cada resultado, dónde verlo en HN
    const out = await Promise.all(items.map(async r => {
      const type = r.media_type;
      let proveedores = [];
      try {
        const pUrl = `https://api.themoviedb.org/3/${type}/${r.id}/watch/providers?api_key=${KEY}`;
        const pData = await (await fetch(pUrl)).json();
        const hn = pData.results?.[REGION];
        if (hn) {
          const flat = [...(hn.flatrate||[]), ...(hn.free||[]), ...(hn.ads||[])];
          proveedores = [...new Set(flat.map(p => p.provider_name))];
        }
      } catch(e){}
      return {
        titulo: r.title || r.name,
        tipo: type === "movie" ? "Película" : "Serie",
        anio: (r.release_date || r.first_air_date || "").slice(0,4),
        poster: r.poster_path ? `https://image.tmdb.org/t/p/w200${r.poster_path}` : null,
        rating: r.vote_average ? Math.round(r.vote_average*10)/10 : null,
        sinopsis: r.overview || "",
        proveedores
      };
    }));

    return res.status(200).json({ resultados: out });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error consultando TMDB: " + (e.message || "desconocido") });
  }
}
