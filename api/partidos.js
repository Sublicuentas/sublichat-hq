// api/partidos.js  ·  VERSION 13  ·  Todo sobre ESPN (sin key) + Fútbol ampliado + Tenis + F1
//
// v13 — cambios:
//   - Se quitó "Mundial 2026" como pestaña/fuente por pedido explícito.
//   - Fútbol deja de depender de openfootball (5 ligas fijas, JSON estático que
//     había que actualizar cada temporada) y pasa 100% a ESPN: ahora cubre
//     Honduras, MLS, Liga MX, Champions, Europa League, Libertadores,
//     Sudamericana, Copa América, Concacaf Naciones/Gold Cup/Champions,
//     Argentina, Brasil + las 5 grandes de Europa. Ver LIGAS_FUTBOL abajo.
//   - Se agregan Tenis (ATP + WTA) y F1, también vía ESPN.
//   - NBA, MLB y UFC (agregados en v12) se mantienen igual.
//   - "Hoy" ahora mezcla TODO: fútbol (todas las ligas de LIGAS_FUTBOL) + NBA +
//     MLB + UFC + Tenis + F1, ordenado por hora.
//
// Todo sale de la API pública de ESPN (site.api.espn.com) — sin key, sin costo.
// Es una API no oficial: si algún día ESPN cambia el formato, esta función
// puede empezar a fallar; no depende de ningún env var para funcionar.

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  // CORS (para que el catálogo en otro dominio también pueda consultar)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST" && req.method !== "GET")
    return res.status(200).json({ ok: true, version: 13, msg: "partidos v13 activo (fútbol ampliado + tenis + F1)." });

  const src = (req.method === "GET") ? (req.query || {}) : (req.body || {});
  const { modo, q, liga } = src;

  // ---------- utilidades ----------
  const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const fmtHN = d => d.toLocaleString("es-HN", {
    timeZone: "America/Tegucigalpa", weekday: "short", day: "numeric",
    month: "short", hour: "2-digit", minute: "2-digit", hour12: true
  });
  const diaHN = d => d.toLocaleDateString("en-CA", { timeZone: "America/Tegucigalpa" }); // YYYY-MM-DD

  const canalDe = ligaKey => {
    const l = (ligaKey || "").toLowerCase();
    if (l.includes("premier")) return "ESPN / Disney+ (aprox.)";
    if (l.includes("la liga") || l.includes("primera") && l.includes("espa")) return "Sky / ESPN (aprox.)";
    if (l.includes("serie a")) return "ESPN / Disney+ (aprox.)";
    if (l.includes("bundesliga")) return "Sky (aprox.)";
    if (l.includes("ligue 1") || l.includes("ligue1")) return "ESPN (aprox.)";
    if (l.includes("champions")) return "ESPN / Disney+ (aprox.)";
    if (l.includes("europa league")) return "ESPN (aprox.)";
    if (l.includes("honduras")) return "Televisoras nacionales HN (aprox.)";
    if (l.includes("mls")) return "Apple TV MLS Season Pass (aprox.)";
    if (l.includes("liga mx")) return "TUDN / Sky (aprox.)";
    if (l.includes("libertadores") || l.includes("sudamericana") || l.includes("recopa")) return "ESPN / Disney+ (aprox.)";
    if (l.includes("copa américa") || l.includes("copa america")) return "Televisoras nacionales / DirecTV (aprox.)";
    if (l.includes("concacaf")) return "Televisoras nacionales HN / Fox Sports (aprox.)";
    if (l.includes("argentina")) return "ESPN / Disney+ (aprox.)";
    if (l.includes("brasil") || l.includes("brasileirão") || l.includes("brasileirao")) return "ESPN / Disney+ (aprox.)";
    if (l.includes("nba")) return "ESPN / Disney+ (aprox.)";
    if (l.includes("mlb")) return "ESPN / ESPN Deportes (aprox.)";
    if (l.includes("ufc")) return "ESPN / TNT Sports (aprox.)";
    if (l.includes("atp") || l.includes("wta") || l.includes("tenis")) return "ESPN / Tennis Channel (aprox.)";
    if (l.includes("f1") || l.includes("fórmula") || l.includes("formula")) return "ESPN / Fox Sports (aprox.)";
    return "Consultá en tu proveedor";
  };

  // fetch con timeout: nunca cuelga la función
  async function jget(url, opt = {}) {
    const ms = opt.ms || 6000;
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

  // ===== ESPN — API pública, sin key =====
  const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";
  const ymdCompact = d => diaHN(d).replace(/-/g, "");

  async function espnScoreboardRango(path, diasAdelante = 7) {
    const start = new Date();
    const end = new Date(Date.now() + diasAdelante * 86400000);
    const url = `${ESPN_BASE}/${path}/scoreboard?dates=${ymdCompact(start)}-${ymdCompact(end)}&limit=300`;
    const d = await jget(url, { ms: 6000 });
    return (d && d.events) || [];
  }

  function estadoEspn(ev) {
    const st = ev && ev.status && ev.status.type && ev.status.type.state;
    if (st === "in") return "LIVE";
    if (st === "post") return "FT";
    return "NS";
  }

  const nombreCompetidor = c => {
    if (!c) return "Por confirmar";
    if (c.team) return c.team.shortDisplayName || c.team.displayName || c.team.name || "Equipo";
    if (c.athlete) return c.athlete.shortName || c.athlete.displayName || "Jugador";
    return "Por confirmar";
  };
  const logoCompetidor = c => {
    if (!c) return null;
    if (c.team && c.team.logo) return c.team.logo;
    if (c.athlete && c.athlete.headshot && c.athlete.headshot.href) return c.athlete.headshot.href;
    if (c.athlete && c.athlete.flag && c.athlete.flag.href) return c.athlete.flag.href;
    return null;
  };
  const scoreDe = c => {
    if (c && c.score != null && c.score !== "") { const n = Number(c.score); return Number.isFinite(n) ? n : null; }
    return null;
  };

  // Sirve para fútbol, NBA, MLB, UFC (peleadores) y tenis (jugadores): siempre
  // hay 2 "competitors" (equipo o athlete) en la competición.
  function parseEspnGeneric(ev, ligaLabel, canalTxt) {
    const comp = ev && ev.competitions && ev.competitions[0];
    if (!comp) return null;
    const competidores = comp.competitors || [];
    const home = competidores.find(c => c.homeAway === "home") || competidores[0] || {};
    const away = competidores.find(c => c.homeAway === "away") || competidores[1] || {};
    const dObj = new Date(ev.date || comp.date);
    const estado = estadoEspn(ev);
    const cardTxt = (comp.type && comp.type.text) ? " · " + comp.type.text : "";
    return {
      dObj,
      p: {
        liga: ligaLabel,
        logoLiga: null,
        local: nombreCompetidor(home), logoLocal: logoCompetidor(home),
        visita: nombreCompetidor(away), logoVisita: logoCompetidor(away),
        golesLocal: estado === "NS" ? null : scoreDe(home),
        golesVisita: estado === "NS" ? null : scoreDe(away),
        estado,
        horaHN: fmtHN(dObj) + cardTxt,
        canal: canalTxt
      }
    };
  }

  // F1: no es cara a cara (es una carrera con parrilla completa) — se muestra
  // como una fila con el nombre del GP y el circuito.
  function parseEspnF1(ev, canalTxt) {
    const comp = ev && ev.competitions && ev.competitions[0];
    const dObj = new Date((comp && comp.date) || ev.date);
    const estado = estadoEspn(ev);
    const nombreCarrera = ev.shortName || ev.name || "Gran Premio";
    const circuito = (comp && comp.venue && (comp.venue.fullName || (comp.venue.address && comp.venue.address.city))) || "Circuito por confirmar";
    return {
      dObj,
      p: {
        liga: "Fórmula 1",
        logoLiga: null,
        local: nombreCarrera, logoLocal: null,
        visita: circuito, logoVisita: null,
        golesLocal: null, golesVisita: null,
        estado,
        horaHN: fmtHN(dObj),
        canal: canalTxt
      }
    };
  }

  async function cargarNBA(dias) {
    const evs = await espnScoreboardRango("basketball/nba", dias);
    return evs.map(ev => parseEspnGeneric(ev, "NBA", canalDe("nba"))).filter(Boolean);
  }
  async function cargarMLB(dias) {
    const evs = await espnScoreboardRango("baseball/mlb", dias);
    return evs.map(ev => parseEspnGeneric(ev, "MLB", canalDe("mlb"))).filter(Boolean);
  }
  async function cargarUFC(dias) {
    const evs = await espnScoreboardRango("mma/ufc", dias);
    return evs.map(ev => parseEspnGeneric(ev, "UFC" + (ev.shortName ? " · " + ev.shortName : ""), canalDe("ufc"))).filter(Boolean);
  }
  async function cargarTenis(dias) {
    const [atp, wta] = await Promise.all([
      espnScoreboardRango("tennis/atp", dias).catch(() => []),
      espnScoreboardRango("tennis/wta", dias).catch(() => [])
    ]);
    return [
      ...atp.map(ev => parseEspnGeneric(ev, "ATP" + (ev.shortName ? " · " + ev.shortName : ""), canalDe("tenis"))),
      ...wta.map(ev => parseEspnGeneric(ev, "WTA" + (ev.shortName ? " · " + ev.shortName : ""), canalDe("tenis")))
    ].filter(Boolean);
  }
  async function cargarF1(dias) {
    const evs = await espnScoreboardRango("racing/f1", dias);
    return evs.map(ev => parseEspnF1(ev, canalDe("f1"))).filter(Boolean);
  }

  // ===== FÚTBOL — todas las ligas/copas (slug ESPN, sin key) =====
  // Agregá una línea acá para sumar otra liga/copa; el slug es el que usa ESPN
  // (ej. https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard).
  const LIGAS_FUTBOL = [
    { slug: "hon.1", nombre: "Liga Nacional de Honduras" },
    { slug: "usa.1", nombre: "MLS" },
    { slug: "mex.1", nombre: "Liga MX" },
    { slug: "eng.1", nombre: "Premier League" },
    { slug: "esp.1", nombre: "La Liga" },
    { slug: "ita.1", nombre: "Serie A" },
    { slug: "ger.1", nombre: "Bundesliga" },
    { slug: "fra.1", nombre: "Ligue 1" },
    { slug: "uefa.champions", nombre: "Champions League" },
    { slug: "uefa.europa", nombre: "Europa League" },
    { slug: "conmebol.libertadores", nombre: "Copa Libertadores" },
    { slug: "conmebol.sudamericana", nombre: "Copa Sudamericana" },
    { slug: "conmebol.america", nombre: "Copa América" },
    { slug: "concacaf.nations.league", nombre: "Concacaf Nations League" },
    { slug: "concacaf.gold", nombre: "Concacaf Gold Cup" },
    { slug: "concacaf.champions", nombre: "Concacaf Champions Cup" },
    { slug: "arg.1", nombre: "Liga Argentina" },
    { slug: "bra.1", nombre: "Brasileirão" }
  ];

  async function cargarLigaFutbol(entry, dias) {
    const evs = await espnScoreboardRango("soccer/" + entry.slug, dias);
    return evs.map(ev => parseEspnGeneric(ev, entry.nombre, canalDe(entry.nombre))).filter(Boolean);
  }

  // Carga TODAS las ligas de fútbol + NBA + MLB + UFC + Tenis + F1 en paralelo.
  // La usan "Hoy" y la búsqueda de equipo/jugador.
  async function cargarTodo() {
    const jobs = [];
    for (const lg of LIGAS_FUTBOL) jobs.push(cargarLigaFutbol(lg, 4).catch(() => []));
    jobs.push(cargarNBA(4).catch(() => []));
    jobs.push(cargarMLB(4).catch(() => []));
    jobs.push(cargarUFC(10).catch(() => []));
    jobs.push(cargarTenis(4).catch(() => []));
    jobs.push(cargarF1(14).catch(() => []));
    const arrs = await Promise.all(jobs);
    return arrs.flat().filter(x => x && x.dObj && !isNaN(x.dObj));
  }

  // Arma la respuesta de una lista ya cargada: prioriza próximos, si no hay
  // muestra los más recientes para no dejar la pantalla en blanco.
  function responder(res, todos, limite) {
    if (!todos.length) return res.status(200).json({ error: "No pude cargar el calendario ahora (intentá más tarde)." });
    const ahora = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const fut = todos.filter(x => x.dObj >= ahora).sort((a, b) => a.dObj - b.dObj);
    const lista = (fut.length ? fut : todos.sort((a, b) => b.dObj - a.dObj)).slice(0, limite);
    return res.status(200).json({ partidos: lista.map(x => x.p) });
  }

  try {
    // ===== FÚTBOL — liga específica (chips dentro de la carpeta "Fútbol") =====
    if (modo === "futliga" && liga) {
      const entry = LIGAS_FUTBOL.find(l => l.slug === liga) || { slug: liga, nombre: "Fútbol" };
      const todos = await cargarLigaFutbol(entry, 12);
      return responder(res, todos, 30);
    }

    // ===== NBA / MLB (chips directos) =====
    if (modo === "nba" || modo === "mlb") {
      const todos = modo === "nba" ? await cargarNBA(10) : await cargarMLB(10);
      return responder(res, todos, 40);
    }

    // ===== UFC (chip directo) =====
    if (modo === "ufc") {
      const todos = await cargarUFC(45); // eventos UFC no son diarios, ventana más amplia
      return responder(res, todos, 40);
    }

    // ===== TENIS — ATP + WTA (chip directo) =====
    if (modo === "tenis") {
      const todos = await cargarTenis(10);
      return responder(res, todos, 40);
    }

    // ===== F1 (chip directo) =====
    if (modo === "f1") {
      const todos = await cargarF1(30);
      return responder(res, todos, 20);
    }

    // ===== BÚSQUEDA DE EQUIPO / JUGADOR (sin key) =====
    if (modo === "equipo" && q) {
      const qn = norm(q);
      const todo = await cargarTodo();
      const ahora = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const match = todo.filter(x => norm(x.p.local).includes(qn) || norm(x.p.visita).includes(qn));
      const fut = match.filter(x => x.dObj >= ahora).sort((a, b) => a.dObj - b.dObj);
      const lista = (fut.length ? fut : match.sort((a, b) => b.dObj - a.dObj)).slice(0, 25);
      return res.status(200).json({ partidos: lista.map(x => x.p) });
    }

    // ===== LIGA por ID (API-Football) — legado, solo si reactivás una key =====
    if (modo === "liga" && liga) {
      const KEY = (process.env.APIFOOTBALL_KEY || "").trim();
      if (!KEY)
        return res.status(200).json({ error: "Esa liga usa API-Football y no hay key activa. Usá las pestañas gratis." });
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

    // ===== HOY (pestaña por defecto) — mezcla todo =====
    const hoy = diaHN(new Date());
    const todo = await cargarTodo();
    const ahora = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const hoyList = todo.filter(x => diaHN(x.dObj) === hoy).sort((a, b) => a.dObj - b.dObj);
    let lista;
    if (hoyList.length) {
      lista = hoyList.slice(0, 60);
    } else {
      // si hoy no hay nada, mostramos los próximos para no dejar la pantalla en blanco
      lista = todo.filter(x => x.dObj >= ahora).sort((a, b) => a.dObj - b.dObj).slice(0, 30);
    }
    return res.status(200).json({ partidos: lista.map(x => x.p) });

  } catch (e) {
    console.error(e);
    return res.status(200).json({ error: "Error consultando partidos: " + (e.message || "") });
  }
}
