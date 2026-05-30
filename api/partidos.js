// api/partidos.js  ·  VERSION 6  ·  Partidos de fútbol con hora de Honduras
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
  if (req.method !== "POST") return res.status(200).json({ ok: true, version: 6, msg: "partidos v6 activo. Usá POST." });

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
    if (modo === "mundial") {
      // Calendario completo del Mundial 2026 desde openfootball (gratis, sin key, dominio público)
      const r = await fetch("https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json");
      if (!r.ok) return res.status(200).json({ error: "No pude cargar el calendario del Mundial (intentá más tarde)." });
      const data = await r.json();
      const ahora = new Date(Date.now() - 3*60*60*1000);
      const matches = (data.matches || []);
      // separar próximos (incluye hoy/en curso) y mostrar primero esos; si no hay, mostrar todos
      const conFecha = matches.map(m => {
        // time viene como "13:00 UTC-6" o "20:00 UTC-4"; tomamos HH:MM y el offset
        const tm = (m.time||"").match(/(\d{1,2}):(\d{2})\s*UTC([+-]\d+)?/);
        let iso = m.date + "T" + (tm ? `${tm[1].padStart(2,"0")}:${tm[2]}` : "12:00") + ":00";
        // offset del dato (ej -6 o -4); construimos fecha UTC real
        const off = tm && tm[3] ? parseInt(tm[3],10) : -6;
        const dObj = new Date(`${m.date}T${tm?`${tm[1].padStart(2,"0")}:${tm[2]}`:"12:00"}:00${off<0?"-":"+"}${String(Math.abs(off)).padStart(2,"0")}:00`);
        return { m, dObj };
      });
      const futuros = conFecha.filter(x => x.dObj >= ahora).sort((a,b)=>a.dObj-b.dObj);
      const lista = (futuros.length ? futuros : conFecha.sort((a,b)=>a.dObj-b.dObj));
      const partidos = lista.slice(0, 60).map(({m,dObj}) => {
        const horaHN = dObj.toLocaleString("es-HN", {
          timeZone:"America/Tegucigalpa", weekday:"short", day:"numeric",
          month:"short", hour:"2-digit", minute:"2-digit", hour12:true
        });
        return {
          liga: "Mundial 2026 · " + (m.group || m.round || ""),
          logoLiga: null,
          local: m.team1, logoLocal: null,
          visita: m.team2, logoVisita: null,
          golesLocal: (m.score1!=null?m.score1:null), golesVisita:(m.score2!=null?m.score2:null),
          estado: "NS",
          horaHN: horaHN + (m.ground ? " · " + m.ground : ""),
          canal: "Televisoras nacionales / FIFA+ (aprox.)"
        };
      });
      return res.status(200).json({ partidos });
    } else if (modo === "liga" && liga) {
      // Plan gratis: next/last son de pago, pero league+season SÍ funciona.
      // Traemos toda la temporada y filtramos a los próximos (calendario completo).
      const year = new Date().getFullYear();
      let resp = await fetch(`${HOST}/fixtures?league=${liga}&season=${year}`, { headers });
      let data = await resp.json();
      if ((data.errors && Object.keys(data.errors).length) || !(data.response||[]).length) {
        // probar temporada anterior (ligas europeas cruzan año, ej 2025/26)
        const r2 = await fetch(`${HOST}/fixtures?league=${liga}&season=${year-1}`, { headers });
        const d2 = await r2.json();
        if (!(d2.errors && Object.keys(d2.errors).length)) data = d2;
      }
      if (data.errors && Object.keys(data.errors).length)
        return res.status(200).json({ error: "API: " + JSON.stringify(data.errors) });
      const ahora = new Date(Date.now() - 3*60*60*1000); // incluye partidos de hace 3h (en curso)
      fixtures = (data.response || [])
        .filter(fx => new Date(fx.fixture.date) >= ahora)
        .sort((a,b)=> new Date(a.fixture.date) - new Date(b.fixture.date))
        .slice(0, 40);
      const partidos = fixtures.map(fmtPartido);
      return res.status(200).json({ partidos });
    } else if (modo === "equipo" && q) {
      const tResp = await fetch(`${HOST}/teams?search=${encodeURIComponent(q)}`, { headers });
      const tData = await tResp.json();
      if (tData.errors && Object.keys(tData.errors).length)
        return res.status(200).json({ error: "API: " + JSON.stringify(tData.errors) });
      const team = tData.response?.[0]?.team;
      if (!team) return res.status(200).json({ partidos: [] });
      // Plan gratis: por temporada (next/last son de pago). Traemos la temporada actual y filtramos a futuros.
      const year = new Date().getFullYear();
      const fResp = await fetch(`${HOST}/fixtures?team=${team.id}&season=${year}`, { headers });
      const fData = await fResp.json();
      if (fData.errors && Object.keys(fData.errors).length) {
        // intentar temporada anterior (ligas que cruzan año)
        const f2 = await fetch(`${HOST}/fixtures?team=${team.id}&season=${year-1}`, { headers });
        const d2 = await f2.json();
        fixtures = d2.response || [];
      } else {
        fixtures = fData.response || [];
      }
      const ahora = new Date();
      fixtures = fixtures
        .filter(fx => new Date(fx.fixture.date) >= new Date(ahora.getTime() - 3*60*60*1000))
        .sort((a,b)=> new Date(a.fixture.date) - new Date(b.fixture.date))
        .slice(0, 20);
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
