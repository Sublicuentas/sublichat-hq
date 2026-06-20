// api/tmdb.js  ·  VERSION 7  (solo HN + CORRECCIONES manuales que mandan sobre TMDB)
//
// Por qué v7:
//   La v6 ya muestra SOLO datos de Honduras (sin relleno), pero TMDB mismo trae
//   datos que ustedes saben que están mal (ej: Rosario Tijeras 2016 = Netflix + HBO
//   Max en HN, cuando en Honduras es solo Netflix). TMDB usa JustWatch y no siempre
//   está al día. Como esta herramienta orienta clientes, ustedes deben tener la
//   última palabra.
//
//   ==> CORRECCIONES: una lista TUYA que manda por encima de TMDB.
//       - forzar  : reemplaza por completo las plataformas (lista exacta).
//       - excluir : quita SOLO esas plataformas y deja el resto de TMDB.
//   Se identifica por título (sin acentos/mayúsculas) y, opcional, el año para
//   diferenciar versiones (hay 3 "Rosario Tijeras": 2005, 2010, 2016).
//
// Vercel -> Settings -> Environment Variables:  TMDB_API_KEY = tu_key (API Key v3 auth)

export const config = { maxDuration: 60 };

const REGION = "HN"; // SOLO Honduras

// ======================= EDITÁ AQUÍ TUS CORRECCIONES =======================
// Ejemplos de uso:
//   { titulo: "rosario tijeras", anio: "2016", forzar: ["Netflix"] }
//   { titulo: "la reina del sur",                forzar: ["Netflix"] }   // todas las versiones
//   { titulo: "alguna serie",      excluir: ["HBO Max"] }               // quita solo HBO Max
// Escribí el título en minúsculas y sin acentos.
const CORRECCIONES = [
  { titulo: "rosario tijeras", anio: "2016", forzar: ["Netflix"] },
];
// ===========================================================================

const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

function aplicarCorreccion(titulo, anio, lista) {
  const tn = norm(titulo);
  const c = CORRECCIONES.find(x => norm(x.titulo) === tn && (!x.anio || String(x.anio) === String(anio)));
  if (!c) return lista;
  if (Array.isArray(c.forzar)) return c.forzar.slice();
  if (Array.isArray(c.excluir)) {
    const ex = c.excluir.map(norm);
    return lista.filter(p => !ex.includes(norm(p)));
  }
  return lista;
}

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
function provadoresHN(results) {
  const hn = results && results[REGION];
  if (!hn) return [];
  const flat = [...(hn.flatrate || []), ...(hn.free || []), ...(hn.ads || [])];
  return [...new Set(flat.map(p => p.provider_name))];
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(200).json({ ok: true, version: 7, msg: "tmdb v7 activo (HN + correcciones). Usá POST." });

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
      const titulo = r.title || r.name;
      const anio = (r.release_date || r.first_air_date || "").slice(0, 4);
      let proveedores = [];
      try {
        const pUrl = `https://api.themoviedb.org/3/${type}/${r.id}/watch/providers?api_key=${KEY}`;
        const pData = await tmdbGet(pUrl, { ms: 7000, intentos: 3 });
        proveedores = provadoresHN(pData && pData.results); // SOLO Honduras
      } catch (e) { /* sin datos */ }

      // La corrección manual manda por encima de TMDB
      proveedores = aplicarCorreccion(titulo, anio, proveedores);

      return {
        titulo,
        tipo: type === "movie" ? "Película" : "Serie",
        anio,
        poster: r.poster_path ? `https://image.tmdb.org/t/p/w200${r.poster_path}` : null,
        rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
        sinopsis: r.overview || "",
        proveedores
      };
    }));

    return res.status(200).json({ resultados: out });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ error: "Error consultando TMDB: " + (e.message || "desconocido") });
  }
}
