// api/partidos.js  ·  VERSION 4  ·  Partidos de fútbol con hora de Honduras
// Usa API-Football (API-Sports). Plan gratis: https://www.api-football.com/
// 1) Creá cuenta gratis en https://dashboard.api-football.com/register
// 2) Account → My Access → copiá tu API key
// 3) En Vercel → Environment Variables agregá: APIFOOTBALL_KEY = tu_key
// 4) Redeploy.
//
// Modos:
//   POST { modo:"liga", liga:2 }   -> últimos + próximos de esa liga
//   POST { modo:"equipo", q:"..."} -> próximos de un equipo
//   POST { modo:"hoy" }            -> partidos de hoy (ligas top)

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).json({ ok: true, version: 4, msg: "partidos v4 activo. Usá POST." });

  const KEY = (process.env.APIFOOTBALL_KEY || "").trim();
  if (!KEY) return res.status(500).json({ error: "Falta APIFOOTBALL_KEY en Vercel" });

  const { modo, q, liga } = req.body || {};
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
    "Liga Nacional de Honduras": "Tigo Sports / Deportes TVC (aprox.)",
    "Honduras": "Tigo Sports / Deportes TVC (aprox.)",
    "World Cup": "Televisoras nacionales / FIFA+ (aprox.)",
    "World Cup - Qualification CONCACAF": "Tigo Sports / ESPN (aprox.)",
    "CONCACAF Champions League": "Tigo Sports / ESPN (aprox.)",
    "CONCACAF Gold Cup": "Tigo Sports / TUDN (aprox.)"
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
    if (modo === "liga" && liga) {
      // Plan gratis: solo "next" (el parámetro "last" es de pago). Próximos 30.
      const nextResp = await fetch(`${HOST}/fixtures?league=${liga}&next=30`, { headers });
      const nextData = await nextResp.json();
      if (nextData.errors && Object.keys(nextData.errors).length)
        return res.status(200).json({ error: "API: " + JSON.stringify(nextData.errors) });
      fixtures = (nextData.response || [])
        .sort((a,b)=> new Date(a.fixture.date) - new Date(b.fixture.date));
    } else if (modo === "equipo" && q) {
      const tResp = await fetch(`${HOST}/teams?search=${encodeURIComponent(q)}`, { headers });
      const tData = await tResp.json();
      if (tData.errors && Object.keys(tData.errors).length)
        return res.status(200).json({ error: "API: " + JSON.stringify(tData.errors) });
      const team = tData.response?.[0]?.team;
      if (!team) return res.status(200).json({ partidos: [] });
      // Plan gratis: solo próximos (sin "last")
      const nextResp = await fetch(`${HOST}/fixtures?team=${team.id}&next=15`, { headers });
      const nextData = await nextResp.json();
      fixtures = (nextData.response || [])
        .sort((a,b)=> new Date(a.fixture.date) - new Date(b.fixture.date));
    } else {
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
