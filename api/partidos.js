// api/partidos.js  ·  VERSION 12  ·  + NBA, MLB y UFC (ESPN, sin key)
//
// v12: se agregan NBA, MLB y UFC usando la API pública de ESPN (site.api.espn.com),
//   sin necesidad de key. Se suman al agregador de "Hoy" y a chips propios.
//
// Qué arregla v11 (se mantiene):
//   La cuenta de API-Football quedó suspendida -> "Hoy" y la búsqueda de equipo
//   tiraban: {"access":"Your account is suspended..."}.
//   Ahora TODO sale de openfootball (gratis, dominio público, sin key):
//     - "Hoy"          -> partidos de hoy (Mundial 2026 + ligas top)
//     - búsqueda equipo -> filtra entre Mundial + ligas top
//     - pestañas ligas  -> openfootball (igual que antes, modo "ofliga")
//     - Mundial 2026    -> openfootball (igual que antes, modo "mundial")
//
//   El modo "liga" por ID (API-Football) queda como opcional: solo se usa si algún
//   día reactivás una key nueva en APIFOOTBALL_KEY. Hoy NINGÚN botón lo llama.
//
// Nota: openfootball cubre Mundial + ligas grandes. Equipos de Liga Nacional de
// Honduras (Olimpia, Motagua, etc.) no están en esa fuente gratuita; para esos
// necesitarías reactivar API-Football con una key nueva.

export default async function handler(req, res) {
  // CORS (para que el catálogo en otro dominio también pueda consultar)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST" && req.method !== "GET")
    return res.status(200).json({ ok: true, version: 12, msg: "partidos v12 activo (+ NBA/MLB/UFC)." });

  const src = (req.method === "GET") ? (req.query || {}) : (req.body || {});
  const { modo, q, liga } = src;

  // ---------- utilidades ----------
  const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const fmtHN = d => d.toLocaleString("es-HN", {
    timeZone: "America/Tegucigalpa", weekday: "short", day: "numeric",
    month: "short", hour: "2-digit", minute: "2-digit", hour12: true
  });
  const diaHN = d => d.toLocaleDateString("en-CA", { timeZone: "America/Tegucigalpa" }); // YYYY-MM-DD

  const canalDe = ligaName => {
    const l = (ligaName || "").toLowerCase();
    if (l.includes("premier")) return "ESPN / Disney+ (aprox.)";
    if (l.includes("la liga") || l.includes("primera")) return "Sky / ESPN (aprox.)";
    if (l.includes("serie a")) return "ESPN / Disney+ (aprox.)";
    if (l.includes("bundesliga")) return "Sky (aprox.)";
    if (l.includes("ligue 1") || l.includes("ligue1")) return "ESPN (aprox.)";
    if (l.includes("champions")) return "ESPN / Disney+ (aprox.)";
    if (l.includes("mundial") || l.includes("world cup")) return "Televisoras nacionales / FIFA+ (aprox.)";
    if (l.includes("nba")) return "ESPN / Disney+ (aprox.)";
    if (l.includes("mlb")) return "ESPN / ESPN Deportes (aprox.)";
    if (l.includes("ufc")) return "ESPN / TNT Sports (aprox.)";
    return "Consultá en tu proveedor";
  };

  // fetch con timeout: nunca cuelga la función
  async function jget(url, opt = {}) {
    const ms = opt.ms || 7000;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers: opt.headers || {} });
      if (!r.ok && !opt.allowNotOk) return null;
      return await r.json();
    } catch (e) {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  // Banderas de selecciones (Mundial) -> flagcdn
  const ISO = {
    "Mexico": "mx", "Canada": "ca", "USA": "us", "United States": "us", "Argentina": "ar", "Brazil": "br", "France": "fr",
    "England": "gb-eng", "Spain": "es", "Germany": "de", "Portugal": "pt", "Netherlands": "nl", "Belgium": "be", "Italy": "it",
    "Croatia": "hr", "Uruguay": "uy", "Colombia": "co", "Paraguay": "py", "Ecuador": "ec", "Peru": "pe", "Chile": "cl",
    "Japan": "jp", "South Korea": "kr", "Korea Republic": "kr", "Australia": "au", "Iran": "ir", "Saudi Arabia": "sa",
    "Qatar": "qa", "Morocco": "ma", "Senegal": "sn", "Tunisia": "tn", "Ghana": "gh", "Cameroon": "cm", "Nigeria": "ng",
    "Egypt": "eg", "Algeria": "dz", "Ivory Coast": "ci", "South Africa": "za", "Switzerland": "ch", "Denmark": "dk",
    "Poland": "pl", "Serbia": "rs", "Austria": "at", "Czech Republic": "cz", "Turkey": "tr", "Ukraine": "ua", "Scotland": "gb-sct",
    "Wales": "gb-wls", "Norway": "no", "Sweden": "se", "Greece": "gr", "Russia": "ru", "Costa Rica": "cr", "Panama": "pa",
    "Honduras": "hn", "Jamaica": "jm", "New Zealand": "nz", "Uzbekistan": "uz", "Jordan": "jo", "Bosnia & Herzegovina": "ba",
    "Bosnia and Herzegovina": "ba", "Cape Verde": "cv", "Curacao": "cw", "Curaçao": "cw", "Haiti": "ht", "Venezuela": "ve",
    "Bolivia": "bo", "Guatemala": "gt", "El Salvador": "sv", "Trinidad & Tobago": "tt", "Suriname": "sr", "DR Congo": "cd"
  };
  const bandera = nombre => {
    if (!nombre) return null;
    const code = ISO[(nombre || "").trim()];
    return code ? `https://flagcdn.com/w80/${code}.png` : null;
  };

  // ===== ESPN (NBA · MLB · UFC) — API pública, sin key =====
  const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

  const ymdCompact = d => diaHN(d).replace(/-/g, "");

  async function espnScoreboardRango(path, diasAdelante = 7) {
    const start = new Date();
    const end = new Date(Date.now() + diasAdelante * 86400000);
    const url = `${ESPN_BASE}/${path}/scoreboard?dates=${ymdCompact(start)}-${ymdCompact(end)}&limit=300`;
    const d = await jget(url, { ms: 8000 });
    return (d && d.events) || [];
  }

  function estadoEspn(ev) {
    const st = ev && ev.status && ev.status.type && ev.status.type.state;
    if (st === "in") return "LIVE";
    if (st === "post") return "FT";
    return "NS";
  }

  // Partido de deporte de equipos (NBA, MLB) -> mismo formato que fútbol
  function parseEspnEquipo(ev, ligaLabel, canalTxt) {
    const comp = ev && ev.competitions && ev.competitions[0];
    if (!comp) return null;
    const competidores = comp.competitors || [];
    const home = competidores.find(c => c.homeAway === "home") || competidores[0] || {};
    const away = competidores.find(c => c.homeAway === "away") || competidores[1] || {};
    const dObj = new Date(ev.date || comp.date);
    const estado = estadoEspn(ev);
    return {
      dObj,
      p: {
        liga: ligaLabel,
        logoLiga: null,
        local: (home.team && (home.team.shortDisplayName || home.team.displayName)) || "Local",
        logoLocal: (home.team && home.team.logo) || null,
        visita: (away.team && (away.team.shortDisplayName || away.team.displayName)) || "Visita",
        logoVisita: (away.team && away.team.logo) || null,
        golesLocal: estado === "NS" ? null : (home.score != null ? Number(home.score) : null),
        golesVisita: estado === "NS" ? null : (away.score != null ? Number(away.score) : null),
        estado,
        horaHN: fmtHN(dObj),
        canal: canalTxt
      }
    };
  }

  // Pelea de UFC -> peleador vs peleador (no hay goles, se muestra el card)
  function parseEspnUFC(ev, canalTxt) {
    const comp = ev && ev.competitions && ev.competitions[0];
    if (!comp) return null;
    const c1 = (comp.competitors || [])[0] || {};
    const c2 = (comp.competitors || [])[1] || {};
    const dObj = new Date(ev.date || comp.date);
    const estado = estadoEspn(ev);
    const nombreDe = c => (c.athlete && (c.athlete.shortName || c.athlete.displayName)) || "Por confirmar";
    const cardTxt = (comp.type && comp.type.text) ? " · " + comp.type.text : "";
    return {
      dObj,
      p: {
        liga: "UFC" + (ev.shortName ? " · " + ev.shortName : ""),
        logoLiga: null,
        local: nombreDe(c1), logoLocal: (c1.athlete && c1.athlete.headshot && c1.athlete.headshot.href) || null,
        visita: nombreDe(c2), logoVisita: (c2.athlete && c2.athlete.headshot && c2.athlete.headshot.href) || null,
        golesLocal: null, golesVisita: null,
        estado,
        horaHN: fmtHN(dObj) + cardTxt,
        canal: canalTxt
      }
    };
  }

  async function cargarNBA(dias) {
    const evs = await espnScoreboardRango("basketball/nba", dias);
    return evs.map(ev => parseEspnEquipo(ev, "NBA", canalDe("nba"))).filter(Boolean);
  }
  async function cargarMLB(dias) {
    const evs = await espnScoreboardRango("baseball/mlb", dias);
    return evs.map(ev => parseEspnEquipo(ev, "MLB", canalDe("mlb"))).filter(Boolean);
  }
  async function cargarUFC(dias) {
    const evs = await espnScoreboardRango("mma/ufc", dias);
    return evs.map(ev => parseEspnUFC(ev, canalDe("ufc"))).filter(Boolean);
  }

  // Fuentes openfootball
  const OF_BASE = "https://raw.githubusercontent.com/openfootball/football.json/master/";
  const WC_URL = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

  // Ligas que se incluyen en "Hoy" y en la búsqueda de equipo
  const LIGAS_OF = [
    { archivo: "2025-26/en.1.json", nombre: "Premier League" },
    { archivo: "2025-26/es.1.json", nombre: "La Liga" },
    { archivo: "2025-26/it.1.json", nombre: "Serie A" },
    { archivo: "2025-26/de.1.json", nombre: "Bundesliga" },
    { archivo: "2025-26/fr.1.json", nombre: "Ligue 1" }
  ];

  // Convierte un partido de liga (football.json) al formato del front
  function parseLeague(m, ligaName) {
    const t = (m.time && /^\d{1,2}:\d{2}$/.test(m.time)) ? m.time : "15:00";
    const hh = t.length === 5 ? t : ("0" + t);
    const dObj = new Date(`${m.date}T${hh}:00-06:00`); // asumimos hora local HN si no hay tz
    const ft = m.score && m.score.ft;
    return {
      dObj,
      p: {
        liga: ligaName + (m.round ? " · " + m.round : ""),
        logoLiga: null,
        local: m.team1, logoLocal: null,
        visita: m.team2, logoVisita: null,
        golesLocal: ft ? ft[0] : null, golesVisita: ft ? ft[1] : null,
        estado: ft ? "FT" : "NS",
        horaHN: fmtHN(dObj),
        canal: canalDe(ligaName)
      }
    };
  }

  // Convierte un partido del Mundial (worldcup.json) al formato del front
  function parseWC(m) {
    const tm = (m.time || "").match(/(\d{1,2}):(\d{2})\s*UTC([+-]\d+)?/);
    const off = tm && tm[3] ? parseInt(tm[3], 10) : -6;
    const hh = tm ? `${tm[1].padStart(2, "0")}:${tm[2]}` : "12:00";
    const dObj = new Date(`${m.date}T${hh}:00${off < 0 ? "-" : "+"}${String(Math.abs(off)).padStart(2, "0")}:00`);
    return {
      dObj,
      p: {
        liga: "Mundial 2026 · " + (m.group || m.round || ""),
        logoLiga: null,
        local: m.team1, logoLocal: bandera(m.team1),
        visita: m.team2, logoVisita: bandera(m.team2),
        golesLocal: m.score1 != null ? m.score1 : null,
        golesVisita: m.score2 != null ? m.score2 : null,
        estado: (m.score1 != null) ? "FT" : "NS",
        horaHN: fmtHN(dObj) + (m.ground ? " · " + m.ground : ""),
        canal: "Televisoras nacionales / FIFA+ (aprox.)"
      }
    };
  }

  // Carga Mundial + todas las ligas + NBA + MLB + UFC en paralelo y devuelve una sola lista
  async function cargarTodo() {
    const jobs = [];
    jobs.push((async () => {
      const d = await jget(WC_URL, { ms: 7000 });
      return (d && d.matches ? d.matches : []).map(parseWC);
    })());
    for (const lg of LIGAS_OF) {
      jobs.push((async () => {
        const d = await jget(OF_BASE + lg.archivo, { ms: 7000 });
        const name = (d && d.name) || lg.nombre;
        return (d && d.matches ? d.matches : []).map(m => parseLeague(m, name));
      })());
    }
    jobs.push(cargarNBA(4).catch(() => []));
    jobs.push(cargarMLB(4).catch(() => []));
    jobs.push(cargarUFC(10).catch(() => []));
    const arrs = await Promise.all(jobs);
    return arrs.flat().filter(x => x && x.dObj && !isNaN(x.dObj));
  }

  try {
    // ===== MUNDIAL 2026 =====
    if (modo === "mundial") {
      const d = await jget(WC_URL, { ms: 8000 });
      if (!d) return res.status(200).json({ error: "No pude cargar el calendario del Mundial (intentá más tarde)." });
      const ahora = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const todos = (d.matches || []).map(parseWC);
      const fut = todos.filter(x => x.dObj >= ahora).sort((a, b) => a.dObj - b.dObj);
      const lista = (fut.length ? fut : todos.sort((a, b) => a.dObj - b.dObj)).slice(0, 60);
      return res.status(200).json({ partidos: lista.map(x => x.p) });
    }

    // ===== LIGA por archivo (chips Premier / La Liga / Serie A / ...) =====
    if (modo === "ofliga" && src.archivo) {
      const d = await jget(OF_BASE + src.archivo, { ms: 8000 });
      if (!d) return res.status(200).json({ error: "Esta liga no está disponible ahora (datos aún no publicados)." });
      const name = d.name || "Liga";
      const ahora = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const todos = (d.matches || []).map(m => parseLeague(m, name));
      const fut = todos.filter(x => x.dObj >= ahora).sort((a, b) => a.dObj - b.dObj);
      const lista = (fut.length ? fut : todos.sort((a, b) => b.dObj - a.dObj)).slice(0, 30);
      return res.status(200).json({ partidos: lista.map(x => x.p) });
    }

    // ===== BÚSQUEDA DE EQUIPO (sin key) =====
    if (modo === "equipo" && q) {
      const qn = norm(q);
      const todo = await cargarTodo();
      const ahora = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const match = todo.filter(x => norm(x.p.local).includes(qn) || norm(x.p.visita).includes(qn));
      const fut = match.filter(x => x.dObj >= ahora).sort((a, b) => a.dObj - b.dObj);
      const lista = (fut.length ? fut : match.sort((a, b) => b.dObj - a.dObj)).slice(0, 25);
      return res.status(200).json({ partidos: lista.map(x => x.p) });
    }

    // ===== LIGA por ID (API-Football) — solo si reactivás una key nueva =====
    if (modo === "liga" && liga) {
      const KEY = (process.env.APIFOOTBALL_KEY || "").trim();
      if (!KEY)
        return res.status(200).json({ error: "Esa liga usa API-Football y no hay key activa. Usá las pestañas de ligas (gratis)." });
      const HOST = "https://v3.football.api-sports.io";
      const headers = { "x-apisports-key": KEY };
      const year = new Date().getFullYear();
      let data = await jget(`${HOST}/fixtures?league=${liga}&season=${year}`, { headers, allowNotOk: true });
      if (!data || (data.errors && Object.keys(data.errors).length) || !(data.response || []).length) {
        const d2 = await jget(`${HOST}/fixtures?league=${liga}&season=${year - 1}`, { headers, allowNotOk: true });
        if (d2 && !(d2.errors && Object.keys(d2.errors).length)) data = d2;
      }
      if (!data || (data.errors && Object.keys(data.errors).length))
        return res.status(200).json({ error: "API: " + JSON.stringify(data ? data.errors : "sin respuesta") });
      const ahora = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const fixtures = (data.response || [])
        .filter(fx => new Date(fx.fixture.date) >= ahora)
        .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))
        .slice(0, 40);
      const partidos = fixtures.map(fx => {
        const ligaN = fx.league?.name || "";
        const fecha = new Date(fx.fixture.date);
        return {
          liga: ligaN,
          logoLiga: fx.league?.logo || null,
          local: fx.teams?.home?.name, logoLocal: fx.teams?.home?.logo,
          visita: fx.teams?.away?.name, logoVisita: fx.teams?.away?.logo,
          golesLocal: fx.goals?.home, golesVisita: fx.goals?.away,
          estado: fx.fixture?.status?.short,
          horaHN: fmtHN(fecha),
          canal: canalDe(ligaN)
        };
      });
      return res.status(200).json({ partidos });
    }

    // ===== NBA / MLB (chips directos) =====
    if (modo === "nba" || modo === "mlb") {
      const todos = modo === "nba" ? await cargarNBA(10) : await cargarMLB(10);
      if (!todos.length) return res.status(200).json({ error: "No pude cargar el calendario ahora (intentá más tarde)." });
      const ahora = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const fut = todos.filter(x => x.dObj >= ahora).sort((a, b) => a.dObj - b.dObj);
      const lista = (fut.length ? fut : todos.sort((a, b) => b.dObj - a.dObj)).slice(0, 40);
      return res.status(200).json({ partidos: lista.map(x => x.p) });
    }

    // ===== UFC (chip directo) =====
    if (modo === "ufc") {
      const todos = await cargarUFC(45); // eventos UFC no son diarios, ventana más amplia
      if (!todos.length) return res.status(200).json({ error: "No pude cargar la cartelera de UFC ahora (intentá más tarde)." });
      const ahora = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const fut = todos.filter(x => x.dObj >= ahora).sort((a, b) => a.dObj - b.dObj);
      const lista = (fut.length ? fut : todos.sort((a, b) => b.dObj - a.dObj)).slice(0, 40);
      return res.status(200).json({ partidos: lista.map(x => x.p) });
    }

    // ===== HOY (pestaña por defecto) — sin key =====
    const hoy = diaHN(new Date());
    const todo = await cargarTodo();
    const ahora = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const hoyList = todo.filter(x => diaHN(x.dObj) === hoy).sort((a, b) => a.dObj - b.dObj);
    let lista;
    if (hoyList.length) {
      lista = hoyList.slice(0, 50);
    } else {
      // si hoy no hay nada, mostramos los próximos para no dejar la pantalla en blanco
      lista = todo.filter(x => x.dObj >= ahora).sort((a, b) => a.dObj - b.dObj).slice(0, 25);
    }
    return res.status(200).json({ partidos: lista.map(x => x.p) });

  } catch (e) {
    console.error(e);
    return res.status(200).json({ error: "Error consultando partidos: " + (e.message || "") });
  }
}
