// api/partidos.js  ·  VERSION 1  ·  Partidos de fútbol con hora de Honduras
// Usa API-Football (API-Sports). Plan gratis: https://www.api-football.com/
// 1) Creá cuenta gratis en https://dashboard.api-football.com/register
// 2) Copiá tu API key (Dashboard → "API Key")
// 3) En Vercel → Environment Variables agregá: APIFOOTBALL_KEY = tu_key
// 4) Redeploy.
//
// Modos:
//   POST { modo:"hoy" }            -> partidos de hoy (varias ligas top)
//   POST { modo:"equipo", q:"..."} -> próximos/recientes de un equipo

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).json({ ok: true, version: 1, msg: "partidos v1 activo. Usá POST." });

  const KEY = (process.env.APIFOOTBALL_KEY || "").trim();
  if (!KEY) return res.status(500).json({ error: "Falta APIFOOTBALL_KEY en Vercel" });

  const { modo, q } = req.body || {};
  const HOST = "https://v3.football.api-sports.io";
  const headers = { "x-apisports-key": KEY };

  // Mapa orientativo de quién suele transmitir cada liga en Centroamérica/Honduras.
  // NO es garantizado; los derechos cambian por temporada.
  const TV = {
    "UEFA Champions League": "ESPN / Disney+ (aprox.)",
    "La Liga": "Sky / ESPN (aprox.)",
    "Premier League": "ESPN / Disney+ (aprox.)",
    "Serie A": "ESPN / Disney+ (aprox.)",
    "Bundesliga": "Sky (aprox.)",
    "Ligue 1": "ESPN (aprox.)",
    "Liga MX": "TUDN / ViX (aprox.)",
    "MLS": "Apple TV (aprox.)",
    "Liga Nacional de Honduras": "Tigo Sports / TVC Deportes (aprox.)",
    "World Cup": "Televisoras nacionales (aprox.)",
    "CONCACAF Champions League": "Tigo Sports / ESPN (aprox.)"
  };
  const canalDe = liga => TV[liga] || "Consultá en tu proveedor";

  // Ligas top para el modo "hoy" (IDs de API-Football)
  const LIGAS_HOY = [2,3,39,140,135,78,61,253,262,128,265]; // CL, EL, EPL, LaLiga, SerieA, Bundes, Ligue1, MLS, LigaMX, otras

  function fmtPartido(fx) {
    const liga = fx.league?.name || "";
    const fecha = new Date(fx.fixture.date);
    // Hora de Honduras
    const horaHN = fecha.toLocaleString("es-HN", {
      timeZone: "America/Tegucigalpa", weekday: "short", day: "numeric",
      month: "short", hour: "2-digit", minute: "2-digit", hour12: true
    });
    return {
      liga,
      logoLiga: fx.league?.logo || null,
      local: fx.teams?.home?.name, logoLocal: fx.teams?.home?.logo,
      visita: fx.teams?.away?.name, logoVisita: fx.teams?.away?.logo,
      golesLocal: fx.goals?.home, golesVisita: fx.goals?.away,
      estado: fx.fixture?.status?.short, // NS, 1H, HT, 2H, FT, etc.
      horaHN,
      canal: canalDe(liga)
    };
  }

  try {
    let fixtures = [];
    if (modo === "equipo" && q) {
      // 1. buscar el equipo
      const tResp = await fetch(`${HOST}/teams?search=${encodeURIComponent(q)}`, { headers });
      const tData = await tResp.json();
      if (tData.errors && Object.keys(tData.errors).length)
        return res.status(200).json({ error: "API: " + JSON.stringify(tData.errors) });
      const team = tData.response?.[0]?.team;
      if (!team) return res.status(200).json({ partidos: [] });
      // 2. próximos 5 partidos del equipo
      const fResp = await fetch(`${HOST}/fixtures?team=${team.id}&next=8`, { headers });
      const fData = await fResp.json();
      fixtures = fData.response || [];
    } else {
      // modo hoy
      const hoy = new Date().toISOString().slice(0,10);
      const fResp = await fetch(`${HOST}/fixtures?date=${hoy}`, { headers });
      const fData = await fResp.json();
      if (fData.errors && Object.keys(fData.errors).length)
        return res.status(200).json({ error: "API: " + JSON.stringify(fData.errors) });
      fixtures = (fData.response || []).filter(fx => LIGAS_HOY.includes(fx.league?.id));
    }

    const partidos = fixtures.map(fmtPartido);
    return res.status(200).json({ partidos });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error consultando partidos: " + (e.message || "") });
  }
}
