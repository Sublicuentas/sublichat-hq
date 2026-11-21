// api/_futbol-dia.js · R200d · Fútbol del día COMPLETO (hora de Honduras) — Sublichat HQ (Vercel)
// Lo usa api/partidos.js en modo "futbol_dia". Fuente: API pública de ESPN, una consulta por competición y día.
// Reglas: horario de Honduras (America/Tegucigalpa); canal SIN inventar → «Canal sin confirmar» (salvo la Copa
// Centroamericana, que sí tiene canal confirmado); nunca se afirma «no hay partidos» si alguna fuente falló;
// se informa cobertura (cuántas competiciones se consultaron, cuántas respondieron, cuáles fallaron o vienen de caché).

export const ZONA_HN = "America/Tegucigalpa";
export const CANAL_SIN_CONFIRMAR = "Canal sin confirmar";
const CANALES_CONFIRMADOS = { "concacaf.central.american.cup": "ESPN / Disney+ Premium (Centroamérica)" };

// slug ESPN · nombre de respaldo (si ESPN no trae el nombre) · país/región · am = juega en horario de América
// (para esas también se consulta el día siguiente: un partido de 11 p. m. en Honduras ya es otro día en EE. UU.).
export const LIGAS_FUTBOL_DIA = [
  // Honduras y Centroamérica
  ["hon.1", "Liga Nacional de Honduras", "Honduras", 1], ["concacaf.central.american.cup", "Copa Centroamericana Concacaf", "Concacaf", 1],
  ["crc.1", "Primera División de Costa Rica", "Costa Rica", 1], ["gua.1", "Liga Nacional de Guatemala", "Guatemala", 1], ["slv.1", "Primera División de El Salvador", "El Salvador", 1],
  // Concacaf y selecciones
  ["concacaf.champions", "Concacaf Champions Cup", "Concacaf", 1], ["concacaf.nations.league", "Concacaf Nations League", "Concacaf", 1], ["concacaf.gold", "Copa Oro Concacaf", "Concacaf", 1],
  ["concacaf.leagues.cup", "Leagues Cup", "Concacaf", 1], ["fifa.worldq.concacaf", "Eliminatorias Concacaf", "Concacaf", 1], ["fifa.world", "Copa Mundial de la FIFA", "Mundial", 1],
  ["fifa.friendly", "Amistosos internacionales", "Mundial", 1], ["fifa.cwc", "Mundial de Clubes", "Mundial", 1], ["fifa.worldq.conmebol", "Eliminatorias Conmebol", "Sudamérica", 1], ["fifa.worldq.uefa", "Eliminatorias UEFA", "Europa", 0],
  ["club.friendly", "Amistosos de clubes", "Mundial", 1],
  // Norteamérica
  ["usa.1", "MLS", "Estados Unidos", 1], ["usa.open", "US Open Cup", "Estados Unidos", 1], ["usa.nwsl", "NWSL (femenil)", "Estados Unidos", 1],
  ["mex.1", "Liga MX", "México", 1], ["mex.2", "Liga de Expansión MX", "México", 1],
  // Sudamérica
  ["conmebol.libertadores", "Copa Libertadores", "Sudamérica", 1], ["conmebol.sudamericana", "Copa Sudamericana", "Sudamérica", 1], ["conmebol.america", "Copa América", "Sudamérica", 1],
  ["arg.1", "Liga Profesional Argentina", "Argentina", 1], ["arg.copa", "Copa Argentina", "Argentina", 1], ["bra.1", "Brasileirão Serie A", "Brasil", 1], ["bra.2", "Brasileirão Serie B", "Brasil", 1], ["bra.copa_do_brazil", "Copa do Brasil", "Brasil", 1],
  ["col.1", "Liga BetPlay Colombia", "Colombia", 1], ["chi.1", "Primera División de Chile", "Chile", 1], ["per.1", "Liga 1 Perú", "Perú", 1], ["uru.1", "Primera División de Uruguay", "Uruguay", 1],
  ["par.1", "Primera División de Paraguay", "Paraguay", 1], ["ecu.1", "LigaPro Ecuador", "Ecuador", 1], ["ven.1", "Liga FUTVE Venezuela", "Venezuela", 1], ["bol.1", "División Profesional de Bolivia", "Bolivia", 1],
  // Europa — competiciones UEFA
  ["uefa.champions", "UEFA Champions League", "Europa", 0], ["uefa.europa", "UEFA Europa League", "Europa", 0], ["uefa.europa.conf", "UEFA Conference League", "Europa", 0],
  ["uefa.nations", "UEFA Nations League", "Europa", 0], ["uefa.wchampions", "Champions League Femenina", "Europa", 0], ["uefa.super_cup", "Supercopa de Europa", "Europa", 0],
  // Inglaterra
  ["eng.1", "Premier League", "Inglaterra", 0], ["eng.2", "EFL Championship", "Inglaterra", 0], ["eng.3", "EFL League One", "Inglaterra", 0], ["eng.4", "EFL League Two", "Inglaterra", 0],
  ["eng.fa", "FA Cup", "Inglaterra", 0], ["eng.league_cup", "Carabao Cup", "Inglaterra", 0], ["eng.w.1", "Women's Super League", "Inglaterra", 0],
  // España, Italia, Alemania, Francia
  ["esp.1", "LaLiga", "España", 0], ["esp.2", "LaLiga Hypermotion", "España", 0], ["esp.copa_del_rey", "Copa del Rey", "España", 0], ["esp.super_cup", "Supercopa de España", "España", 0],
  ["ita.1", "Serie A", "Italia", 0], ["ita.2", "Serie B", "Italia", 0], ["ita.coppa_italia", "Coppa Italia", "Italia", 0],
  ["ger.1", "Bundesliga", "Alemania", 0], ["ger.2", "2. Bundesliga", "Alemania", 0], ["ger.dfb_pokal", "DFB-Pokal", "Alemania", 0],
  ["fra.1", "Ligue 1", "Francia", 0], ["fra.2", "Ligue 2", "Francia", 0], ["fra.coupe_de_france", "Copa de Francia", "Francia", 0],
  // Resto de Europa
  ["ned.1", "Eredivisie", "Países Bajos", 0], ["por.1", "Liga Portugal", "Portugal", 0], ["sco.1", "Scottish Premiership", "Escocia", 0], ["bel.1", "Pro League Bélgica", "Bélgica", 0],
  ["tur.1", "Süper Lig", "Turquía", 0], ["gre.1", "Superliga de Grecia", "Grecia", 0], ["aut.1", "Bundesliga de Austria", "Austria", 0], ["sui.1", "Super League Suiza", "Suiza", 0],
  ["den.1", "Superliga de Dinamarca", "Dinamarca", 0], ["nor.1", "Eliteserien", "Noruega", 0], ["swe.1", "Allsvenskan", "Suecia", 0], ["rus.1", "Liga Premier de Rusia", "Rusia", 0],
  // Asia / Oceanía / África
  ["ksa.1", "Saudi Pro League", "Arabia Saudita", 0], ["jpn.1", "J1 League", "Japón", 0], ["chn.1", "Superliga China", "China", 0], ["aus.1", "A-League", "Australia", 0],
  ["afc.champions", "AFC Champions League", "Asia", 0], ["caf.nations", "Copa Africana de Naciones", "África", 0],
].map(([slug, nombre, pais, am]) => ({ slug, nombre, pais, am: !!am }));

export const diaHN = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: ZONA_HN }); // YYYY-MM-DD
export const horaHN = (d) => new Date(d).toLocaleTimeString("es-HN", { timeZone: ZONA_HN, hour: "numeric", minute: "2-digit", hour12: true });
const compacto = (ymd) => String(ymd).replace(/-/g, "");
export function sumarDias(ymd, n) { const t = Date.parse(`${ymd}T12:00:00Z`) + n * 86400000; return new Date(t).toISOString().slice(0, 10); }

// Estado del partido según ESPN. Solo es EN VIVO si ESPN dice state="in" y no está suspendido.
export function estadoFutbol(ev) {
  const t = (ev && ev.status && ev.status.type) || (ev && ev.competitions && ev.competitions[0] && ev.competitions[0].status && ev.competitions[0].status.type) || {};
  const name = String(t.name || "").toUpperCase(), state = String(t.state || "");
  const detalle = String(t.shortDetail || t.detail || "");
  if (/POSTPONED/.test(name)) return { estado: "POSP", texto: "Aplazado" };
  if (/CANCEL/.test(name)) return { estado: "CANC", texto: "Cancelado" };
  if (/SUSPEND|ABANDON|DELAY|INTERRUPT/.test(name)) return { estado: "SUSP", texto: "Suspendido" };
  if (state === "in") return { estado: "LIVE", texto: /HALF/.test(name) ? "Medio tiempo" : (ev.status && ev.status.displayClock) || detalle || "En vivo" };
  if (state === "post" || t.completed) return { estado: "FT", texto: /PEN/.test(name) ? "Final (penales)" : /AET|EXTRA/.test(name) ? "Final (prórroga)" : "Final" };
  return { estado: "NS", texto: "Por jugar" };
}

const equipo = (c) => (c && c.team) ? (c.team.shortDisplayName || c.team.displayName || c.team.name || "Por confirmar") : "Por confirmar";
const logo = (c) => (c && c.team && (c.team.logo || (Array.isArray(c.team.logos) && c.team.logos[0] && c.team.logos[0].href))) || null;
const goles = (c) => { if (!c || c.score == null || c.score === "") return null; const v = typeof c.score === "object" ? c.score.value ?? c.score.displayValue : c.score; const n = Number(v); return Number.isFinite(n) ? n : null; };

export function parseFutbol(ev, liga, nombreLiga) {
  const comp = ev && ev.competitions && ev.competitions[0];
  if (!comp || !ev.date) return null;
  const cs = comp.competitors || [];
  const home = cs.find((c) => c.homeAway === "home") || cs[0], away = cs.find((c) => c.homeAway === "away") || cs[1];
  const ts = Date.parse(ev.date || comp.date); if (!Number.isFinite(ts)) return null;
  const st = estadoFutbol(ev);
  const jugado = st.estado === "LIVE" || st.estado === "FT" || st.estado === "SUSP";
  return {
    id: String(ev.id || ev.uid || `${liga.slug}|${ts}|${equipo(home)}|${equipo(away)}`),
    liga: nombreLiga || liga.nombre, ligaSlug: liga.slug, pais: liga.pais,
    local: equipo(home), visita: equipo(away), logoLocal: logo(home), logoVisita: logo(away),
    golesLocal: jugado ? goles(home) : null, golesVisita: jugado ? goles(away) : null,
    estado: st.estado, estadoTxt: st.texto,
    horaHN: horaHN(ts), ts, dia: diaHN(ts),
    sede: (comp.venue && (comp.venue.fullName || (comp.venue.address && comp.venue.address.city))) || "",
    canal: CANALES_CONFIRMADOS[liga.slug] || CANAL_SIN_CONFIRMAR, canalConfirmado: !!CANALES_CONFIRMADOS[liga.slug],
  };
}

// Carga todas las competiciones para el día `fecha` (YYYY-MM-DD, Honduras). `jget(url, opt)` devuelve JSON, null si falló
// (y llama opt.falla), y opt.enCache() si usó una copia guardada. 404 = sin calendario (no es falla).
export async function cargarFutbolDia({ fecha, jget, base = "https://site.api.espn.com/apis/site/v2/sports", lote = 20, topeMs = 18000, hoy = diaHN(Date.now()), ligas = LIGAS_FUTBOL_DIA }) {
  const t0 = Date.now();
  const fresco = fecha === hoy ? 60 * 1000 : fecha < hoy ? 30 * 60 * 1000 : 10 * 60 * 1000; // hoy: marcadores al minuto
  const tareas = [];
  for (const lg of ligas) {
    tareas.push({ lg, ymd: fecha });
    if (lg.am) tareas.push({ lg, ymd: sumarDias(fecha, 1) });
  }
  const estado = new Map(ligas.map((l) => [l.slug, { slug: l.slug, nombre: l.nombre, pais: l.pais, ok: 0, falla: "", cache: false, n: 0 }]));
  const vistos = new Set(), partidos = [];
  let sinTiempo = 0;
  for (let i = 0; i < tareas.length; i += lote) {
    if (Date.now() - t0 > topeMs) { sinTiempo += tareas.length - i; for (const t of tareas.slice(i)) { const e = estado.get(t.lg.slug); if (!e.ok && !e.falla) e.falla = "sin tiempo"; } break; }
    await Promise.all(tareas.slice(i, i + lote).map(async ({ lg, ymd }) => {
      const e = estado.get(lg.slug);
      let fallo = "";
      const d = await jget(`${base}/soccer/${lg.slug}/scoreboard?dates=${compacto(ymd)}`, { ms: 6000, tries: 2, fresco, falla: (x) => { fallo = x; }, enCache: () => { e.cache = true; } }).catch((err) => { fallo = (err && err.message) || "error"; return null; });
      if (!d) { if (fallo) e.falla = e.falla || fallo; else e.ok++; /* 404: sin calendario */ return; }
      e.ok++;
      const nombre = (Array.isArray(d.leagues) && d.leagues[0] && (d.leagues[0].name || d.leagues[0].abbreviation)) || "";
      if (nombre) e.nombre = nombre;
      for (const ev of d.events || []) {
        const p = parseFutbol(ev, lg, nombre || lg.nombre);
        if (!p || p.dia !== fecha || vistos.has(p.id)) continue;
        vistos.add(p.id); partidos.push(p); e.n++;
      }
    }));
  }
  partidos.sort((a, b) => a.ts - b.ts || a.liga.localeCompare(b.liga));
  const lista = [...estado.values()];
  const fallidas = lista.filter((e) => e.falla && !e.ok);
  const cobertura = { consultadas: lista.length, respondieron: lista.filter((e) => e.ok).length, conPartidos: lista.filter((e) => e.n).length, fallidas: fallidas.map((e) => ({ nombre: e.nombre, motivo: e.falla })), desdeCache: lista.filter((e) => e.cache).map((e) => e.nombre), sinTiempo };
  const competiciones = lista.filter((e) => e.n).map((e) => ({ slug: e.slug, nombre: e.nombre, pais: e.pais, n: e.n })).sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre));
  const verificado = !fallidas.length && !sinTiempo;
  const conteo = { NS: 0, LIVE: 0, FT: 0, POSP: 0, SUSP: 0, CANC: 0 }; for (const p of partidos) conteo[p.estado] = (conteo[p.estado] || 0) + 1;
  const aviso = partidos.length ? (verificado ? "" : `${fallidas.length + (sinTiempo ? 1 : 0)} fuente(s) no respondieron: puede haber más partidos.`)
    : verificado ? `Las ${lista.length} competiciones consultadas no tienen partidos este día.` : "No se pudo verificar el calendario completo de este día. Intente de nuevo en unos minutos.";
  return { fecha, zona: ZONA_HN, partidos, total: partidos.length, conteo, competiciones, cobertura, verificado, aviso, generado: new Date().toISOString() };
}
