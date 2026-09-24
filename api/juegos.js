// api/juegos.js · Juegos PRO — puntos reales con autoridad de servidor.
// Sigue la especificacion "Sublichat - Juegos PRO" (v1.0, 21/09/2026): el cliente nunca decide el saldo;
// el servidor recalcula los puntos de cada partida a partir de metricas acotadas, aplica topes diarios,
// es idempotente por roundId y guarda cada partida como un movimiento (ledger) en juegos_resultados.
// Alcance de esta primera entrega: valida rangos de cada metrica y recalcula la formula exacta del PDF;
// NO reconstruye toda la fisica/tablero en servidor (eso queda para una siguiente vuelta si se pide).
// Variables esperadas en Vercel: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.

const admin = require('firebase-admin');

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
  privateKey = privateKey.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Faltan variables FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY.');
  return admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

async function requireFirebaseUser(req, res) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) { res.status(401).json({ ok: false, error: 'Sesión requerida.' }); return null; }
  try {
    const user = await admin.auth().verifyIdToken(token);
    if (!String(user.usuario || user.uid || '').trim()) throw new Error('claims_missing');
    return user;
  } catch (_) { res.status(401).json({ ok: false, error: 'Sesión inválida o vencida.' }); return null; }
}
const playerId = user => String(user?.usuario || user?.uid || 'jugador').toLowerCase();
// R58: en el ranking cada jugador aparece con el nombre de su ACCESO (Sublicuentas, Relojes, Geisell).
// Usuarios internos del mismo acceso (p. ej. naara → Sublicuentas; libni/daniela → Relojes) se suman en una fila.
const ACCESS_OF = Object.freeze({ naara: 'Sublicuentas', sublicuentas: 'Sublicuentas', admin: 'Sublicuentas', libni: 'Relojes', relojes: 'Relojes', daniela: 'Relojes', finanzas: 'Relojes', geisell: 'Geisell', geissel: 'Geisell' });
const ACCESS_BY_ROLE = Object.freeze({ admin: 'Sublicuentas', administrador: 'Sublicuentas', owner: 'Sublicuentas', superadmin: 'Sublicuentas', sublicuentas: 'Sublicuentas', relojes: 'Relojes', finanzas: 'Relojes', geisell_admin: 'Geisell', geisell: 'Geisell' });
// Mapa uid → acceso que se llena en cada lectura/registro (el usuario de login puede ser cualquier clave; el rol decide).
const ACCESS_CACHE = new Map();
const accessName = id => ACCESS_CACHE.get(String(id || '').toLowerCase().trim()) || ACCESS_OF[String(id || '').toLowerCase().trim()] || '';
const accessForUser = user => ACCESS_OF[String(user?.usuario || '').toLowerCase().trim()] || ACCESS_BY_ROLE[String(user?.role || '').toLowerCase().trim()] || '';
const displayName = id => accessName(id) || (id ? id.charAt(0).toUpperCase() + id.slice(1) : 'Jugador');
// Junta filas del mismo acceso y descarta cualquier jugador que no sea de los 3 accesos. mode: 'sum' | 'max'.
function mergeByAccess(entries, uid, mode = 'sum') {
  const map = new Map();
  for (const e of entries) {
    const name = accessName(e.userId); if (!name) continue;
    const prev = map.get(name);
    if (!prev) { map.set(name, { ...e, userId: name.toLowerCase(), displayName: name, ids: [e.userId] }); continue; }
    prev.score = mode === 'max' ? Math.max(prev.score, e.score) : prev.score + e.score;
    if (e.streak != null) prev.streak = Math.max(Number(prev.streak) || 0, Number(e.streak) || 0);
    prev.ids.push(e.userId);
  }
  const list = [...map.values()].sort((a, b) => b.score - a.score);
  if (list.length && list[0].badge != null) list.forEach(r => { r.badge = badgeFor(r.score).name; });
  const meIdx = list.findIndex(r => r.ids.includes(uid));
  return { list: list.map(({ ids, ...r }) => r), meIdx, meRow: meIdx >= 0 ? list[meIdx] : null };
}

/* ───────────── zona horaria del negocio (América/Tegucigalpa) ───────────── */
const TZ = 'America/Tegucigalpa';
function hnDateStr(d = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
// Lunes 00:00 de la semana de negocio (América/Tegucigalpa) para la fecha dada, como cadena AAAA-MM-DD.
function hnWeekStartStr(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = t => parts.find(p => p.type === t).value;
  const wdMap = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const local = new Date(Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day'))));
  local.setUTCDate(local.getUTCDate() - (wdMap[get('weekday')] ?? 0));
  return local.toISOString().slice(0, 10);
}

/* ───────────── Sopa de Letras PRO (especificación 24/09/2026) ───────────── */
// Balance central (configurable): palabra +20, completar +30, sin pistas +15, rapidez 0..+25, pista −10.
const SOPA_SCORE = Object.freeze({ WORD_FOUND: 20, ROUND_COMPLETE: 30, NO_HINT_BONUS: 15, HINT_COST: 10, MAX_SPEED_BONUS: 25 });
const SOPA_LEVELS = Object.freeze({ atencion: { grid: 6, words: 3, targetMs: 60000 }, intermedio: { grid: 8, words: 5, targetMs: 120000 }, pro: { grid: 10, words: 7, targetMs: 180000 } });
// El servidor vuelve a leer cada trazo en el tablero: solo cuenta palabras objetivo, sin repetir, dentro del grid y en línea recta.
function sopaValidate(raw) {
  const level = SOPA_LEVELS[String(raw.levelId || '')];
  const bad = motivo => ({ pro: true, valid: false, motivo, found: 0, total: 0, hints: 0, elapsedMs: 0, targetMs: 60000 });
  if (!level) return bad('nivel');
  const n = level.grid;
  const grid = raw.grid.slice(0, n + 1).map(r => String(r || '').toUpperCase());
  if (grid.length !== n || grid.some(r => [...r].length !== n || /[^A-ZÑ]/.test(r))) return bad('tablero');
  const rows = grid.map(r => [...r]);
  const words = raw.words.slice(0, level.words + 1).map(w => String(w || '').toUpperCase());
  if (words.length !== level.words || words.some(w => !/^[A-ZÑ]{3,}$/.test(w) || [...w].length > n) || new Set(words).size !== words.length) return bad('palabras');
  const found = new Set();
  for (const sel of raw.selections.slice(0, 20)) {
    const r1 = Math.trunc(Number(sel?.r1)), c1 = Math.trunc(Number(sel?.c1)), r2 = Math.trunc(Number(sel?.r2)), c2 = Math.trunc(Number(sel?.c2));
    if (![r1, c1, r2, c2].every(v => Number.isInteger(v) && v >= 0 && v < n)) continue;
    const dr = r2 - r1, dc = c2 - c1;
    if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) continue;
    const len = Math.max(Math.abs(dr), Math.abs(dc)) + 1, sr = Math.sign(dr), sc = Math.sign(dc);
    let text = ''; for (let i = 0; i < len; i++) text += rows[r1 + sr * i][c1 + sc * i];
    const rev = [...text].reverse().join('');
    const hit = words.find(w => !found.has(w) && (w === text || w === rev));
    if (hit) found.add(hit);
  }
  return { pro: true, valid: true, found: found.size, total: words.length, hints: clamp(Math.trunc(Number(raw.hintsUsed) || 0), 0, 50), elapsedMs: clamp(Number(raw.elapsedMs) || 0, 0, 3600000), targetMs: level.targetMs };
}
function sopaProPoints(m) {
  if (!m.valid || m.found < m.total || m.total === 0) return { rawScore: m.found || 0, awardedPoints: 0, detalle: { motivo: m.valid ? 'ronda_incompleta' : `invalida_${m.motivo}` } };
  const speed = m.elapsedMs > 0 && m.elapsedMs < m.targetMs ? round(SOPA_SCORE.MAX_SPEED_BONUS * (1 - m.elapsedMs / m.targetMs)) : 0;
  const p = m.found * SOPA_SCORE.WORD_FOUND + SOPA_SCORE.ROUND_COMPLETE + (m.hints ? 0 : SOPA_SCORE.NO_HINT_BONUS) + speed - m.hints * SOPA_SCORE.HINT_COST;
  return { rawScore: m.found, awardedPoints: clamp(p, 0, 1000), detalle: { found: m.found, hints: m.hints, elapsedMs: m.elapsedMs, speed } };
}

/* ───────────── Dardos PRO (Sublichat - Dardos PRO v2): geometría y 301 del lado servidor ───────────── */
const DART_NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const DARTS_MAX_ROUNDS = 12;
function dartScore(nx, ny) {
  const x = Number(nx) || 0, y = Number(ny) || 0, r = Math.sqrt(x * x + y * y);
  if (!(r <= 1)) return { number: 0, multiplier: 0, score: 0, zone: 'MISS' };
  if (r <= 0.03735) return { number: 50, multiplier: 1, score: 50, zone: 'BULL' };
  if (r <= 0.09353) return { number: 25, multiplier: 1, score: 25, zone: 'OUTER_BULL' };
  let angle = Math.atan2(x, -y) * 180 / Math.PI; if (angle < 0) angle += 360;
  const number = DART_NUMBERS[Math.floor((angle + 9) / 18) % 20];
  if (r >= 0.58235 && r <= 0.62941) return { number, multiplier: 3, score: number * 3, zone: 'TRIPLE' };
  if (r >= 0.95294) return { number, multiplier: 2, score: number * 2, zone: 'DOUBLE' };
  return { number, multiplier: 1, score: number, zone: 'SINGLE' };
}
// Repite la partida 301 (3 dardos por turno, bust restaura el turno, 0 exacto gana) a partir de las coordenadas.
function dartsReplay(rawThrows, maxRoundsIn) {
  const maxRounds = clamp(maxRoundsIn, 1, 20) || DARTS_MAX_ROUNDS;
  const list = rawThrows.slice(0, maxRounds * 3).map(t => ({ nx: clamp(t?.nx, -1.5, 1.5), ny: clamp(t?.ny, -1.5, 1.5) }));
  let remaining = 301, turnStart = 301, dartsLeft = 3, round = 1, won = false, used = 0, bestTurn = 0, turnValid = 0, validTurns = 0;
  let bulls = 0, triple20s = 0, valid = 0, scored = 0;
  const endTurn = () => { bestTurn = Math.max(bestTurn, turnStart - remaining); if (turnValid === 3) validTurns += 1; turnValid = 0; dartsLeft = 3; turnStart = remaining; round += 1; };
  for (const t of list) {
    if (won || round > maxRounds) break;
    const h = dartScore(t.nx, t.ny); used += 1;
    if (h.zone !== 'MISS') { valid += 1; turnValid += 1; }
    const cand = remaining - h.score;
    if (cand < 0) { remaining = turnStart; turnValid = 0; endTurn(); continue; }
    if (h.zone === 'BULL') bulls += 1;
    if (h.zone === 'TRIPLE' && h.number === 20) triple20s += 1;
    scored += h.score;
    if (cand === 0) { remaining = 0; won = true; bestTurn = Math.max(bestTurn, turnStart); if (turnValid === 3) validTurns += 1; break; }
    remaining = cand; dartsLeft -= 1; if (dartsLeft === 0) endTurn();
  }
  const completed = won || round > maxRounds;
  return { pro: true, won, completed, dartsUsed: used, remaining, bulls, triple20s, validTurns, accuracy: used ? Math.round(valid / used * 100) : 0, scored, bestTurn };
}
// Economía coherente con los otros juegos (tope 1000 por partida, topes diarios iguales). Tabla del PDF escalada:
// completar partida, ganar, eficiencia (301 en 9 dardos o menos = máximo), Bull 50, Triple 20, turnos con 3 aciertos.
function dartsProPoints(m) {
  if (!m.completed) return { rawScore: 0, awardedPoints: 0, detalle: { motivo: 'partida_no_completada' } };
  const p = 100 + (m.won ? 300 : 0)
    + (m.won ? clamp(round(250 * (9 / Math.max(9, m.dartsUsed))), 0, 250) : clamp(round(250 * (301 - m.remaining) / 301), 0, 150))
    + clamp(m.bulls * 40, 0, 160) + clamp(m.triple20s * 60, 0, 180) + clamp(m.validTurns * 20, 0, 100) + round(clamp(m.accuracy, 0, 100) * 0.6);
  return { rawScore: m.won ? 1 : 0, awardedPoints: clamp(p, 0, 1000), detalle: { won: m.won, dartsUsed: m.dartsUsed, remaining: m.remaining, bulls: m.bulls, triple20s: m.triple20s } };
}

/* ───────────── catálogo y presupuestos por juego (números del PDF) ───────────── */
const GAMES = Object.freeze({
  WORD_SEARCH: 'Sopa de letras', HANGMAN: 'El ahorcado', MEMORY_PAIRS: 'Pares de cartas',
  BASKETBALL: 'Básquet', DARTS: 'Dardos', COLOR_CHALLENGE: 'Colorear',
});
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(Number(n)) ? Number(n) : 0));
const round = n => Math.round(n);

/* Cada función recibe MÉTRICAS YA ACOTADAS (ver sanitizeMetrics) y devuelve { rawScore, awardedPoints, detalle }.
   Los puntos siguen exactamente las tablas de la sección 7-12 del PDF, con clamp(0,1000) final. */
const FORMULAS = {
  WORD_SEARCH(m) {
    if (m.pro) return sopaProPoints(m);
    const words = clamp(m.foundWords, 0, 12), wrong = clamp(m.wrongSelections, 0, 999), hints = clamp(m.hintsUsed, 0, 12), maxCombo = clamp(m.maxCombo, 0, 12);
    const timeLimit = clamp(m.timeLimitSec, 60, 600) || 240, remain = clamp(m.timeRemainingSec, 0, timeLimit);
    const p = clamp(words * 60, 0, 720) + round(clamp(180 * remain / timeLimit, 0, 180)) + clamp(maxCombo * 20, 0, 100) - wrong * 20 - hints * 50;
    return { rawScore: words, awardedPoints: clamp(p, 0, 1000), detalle: { words, wrong, hints, maxCombo } };
  },
  HANGMAN(m) {
    const solved = clamp(m.solvedWords, 0, 5), totalErrors = clamp(m.totalWrongLetters, 0, 35), hints = clamp(m.hintsUsed, 0, 2);
    const timeLimit = clamp(m.timeLimitSec, 60, 600) || 180, remain = clamp(m.timeRemainingSec, 0, timeLimit);
    const p = solved * 150 + clamp(round(100 * (1 - totalErrors / 35)), 0, 100) + round(clamp(150 * remain / timeLimit, 0, 150)) - hints * 80;
    return { rawScore: solved, awardedPoints: clamp(p, 0, 1000), detalle: { solved, totalErrors, hints } };
  },
  MEMORY_PAIRS(m) {
    const pairs = clamp(m.pairsFound, 0, 12), moves = clamp(m.moves, 12, 999), maxCombo = clamp(m.maxCombo, 0, 12);
    const timeLimit = clamp(m.timeLimitSec, 30, 600) || 120, remain = clamp(m.timeRemainingSec, 0, timeLimit);
    const eff = clamp(round(200 * (12 / Math.max(12, moves))), 0, 200);
    const p = pairs * 50 + eff + round(clamp(150 * remain / timeLimit, 0, 150)) + clamp(maxCombo * 10, 0, 50);
    return { rawScore: pairs, awardedPoints: clamp(p, 0, 1000), detalle: { pairs, moves, maxCombo } };
  },
  BASKETBALL(m) {
    const made = clamp(m.made, 0, 5), swish = clamp(m.swish, 0, made), bestStreak = clamp(m.bestStreak, 0, 5), avgAcc = clamp(m.avgAccuracy, 0, 100);
    const p = made * 100 + swish * 30 + clamp(round(30 * bestStreak), 0, 150) + round(clamp(2 * avgAcc, 0, 200));
    return { rawScore: made, awardedPoints: clamp(p, 0, 1000), detalle: { made, swish, bestStreak } };
  },
  DARTS(m) {
    if (m.pro) return dartsProPoints(m);
    const finished = m.finished ? 400 : 0, dartsUsed = clamp(m.dartsUsed, 3, 30), avgAcc = clamp(m.avgAccuracy, 0, 100), bonus = clamp(m.bonusHits, 0, 10);
    const eff = m.finished ? clamp(round(300 * (9 / Math.max(9, dartsUsed))), 0, 300) : 0;
    const p = finished + eff + round(clamp(2 * avgAcc, 0, 200)) + clamp(bonus * 10, 0, 100);
    return { rawScore: finished ? 1 : 0, awardedPoints: clamp(p, 0, 1000), detalle: { finished: Boolean(m.finished), dartsUsed } };
  },
  COLOR_CHALLENGE(m) {
    const completed = m.completed ? 400 : 0, precision = clamp(m.precisionPct, 0, 100), wrong = clamp(m.wrongChanges, 0, 999), fine = m.finePremium ? 100 : 0;
    const p = completed + round(4 * precision) + clamp(round(100 * (1 - wrong / 20)), 0, 100) + fine;
    return { rawScore: precision, awardedPoints: precision < 70 ? 0 : clamp(p, 0, 1000), detalle: { precision, wrong } };
  },
};

// Descarta cualquier campo desconocido o de tipo incorrecto; nunca confía en awardedPoints/rawScore enviados por el cliente.
function sanitizeMetrics(gameCode, raw = {}) {
  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const bool = v => Boolean(v);
  switch (gameCode) {
    case 'WORD_SEARCH': if (Array.isArray(raw.selections) && Array.isArray(raw.grid) && Array.isArray(raw.words)) return sopaValidate(raw);
      return { foundWords: num(raw.foundWords), wrongSelections: num(raw.wrongSelections), hintsUsed: num(raw.hintsUsed), maxCombo: num(raw.maxCombo), timeLimitSec: num(raw.timeLimitSec, 240), timeRemainingSec: num(raw.timeRemainingSec) };
    case 'HANGMAN': return { solvedWords: num(raw.solvedWords), totalWrongLetters: num(raw.totalWrongLetters), hintsUsed: num(raw.hintsUsed), timeLimitSec: num(raw.timeLimitSec, 180), timeRemainingSec: num(raw.timeRemainingSec) };
    case 'MEMORY_PAIRS': return { pairsFound: num(raw.pairsFound), moves: num(raw.moves, 12), maxCombo: num(raw.maxCombo), timeLimitSec: num(raw.timeLimitSec, 120), timeRemainingSec: num(raw.timeRemainingSec) };
    case 'BASKETBALL': return { made: num(raw.made), swish: num(raw.swish), bestStreak: num(raw.bestStreak), avgAccuracy: num(raw.avgAccuracy) };
    case 'DARTS': {
      // Dardos PRO: si llegan coordenadas, el servidor RECALCULA todo (zona, puntaje, 301, bust) y no confía en nada más.
      if (Array.isArray(raw.throws) && raw.throws.length) {
        const m = dartsReplay(raw.throws, num(raw.maxRounds, DARTS_MAX_ROUNDS));
        // R62 · contrarreloj: si se acabó el tiempo (2 min por defecto), la partida cuenta como perdida.
        const limit = clamp(num(raw.timeLimitMs, 120000), 30000, 600000), elapsed = num(raw.elapsedMs, 0);
        if (m.won && (raw.timeUp === true || elapsed > limit + 3000)) { m.won = false; m.timeUp = true; }
        if (!m.won && (raw.timeUp === true || elapsed >= limit) && m.dartsUsed >= 3) m.completed = true; // jugó hasta que se acabó el reloj
        return m;
      }
      return { finished: bool(raw.finished), dartsUsed: num(raw.dartsUsed, 9), avgAccuracy: num(raw.avgAccuracy), bonusHits: num(raw.bonusHits) };
    }
    case 'COLOR_CHALLENGE': return { completed: bool(raw.completed), precisionPct: num(raw.precisionPct), wrongChanges: num(raw.wrongChanges), finePremium: bool(raw.finePremium) };
    default: return null;
  }
}

const BADGES = [[30000, 'LEYENDA', 'Leyenda'], [15000, 'MAESTRO', 'Maestro'], [7500, 'EXPERTO', 'Experto'], [2500, 'AVANZADO', 'Avanzado'], [0, 'EXPLORADOR', 'Explorador']];
function badgeFor(totalPoints) { const hit = BADGES.find(([min]) => totalPoints >= min); return { code: hit[1], name: hit[2] }; }
const DAILY_GLOBAL_CAP = 6000, DAILY_GAME_CAP = 1500;

function computeStreak(prev = {}, todayStr) {
  const last = String(prev.lastActiveDate || '');
  if (last === todayStr) return { current: clamp(prev.current, 1, 99999), best: clamp(prev.best, 1, 99999) };
  const yest = hnDateStr(new Date(Date.parse(todayStr + 'T12:00:00Z') - 86400000));
  const current = last === yest ? clamp(prev.current, 0, 99999) + 1 : 1;
  return { current, best: Math.max(current, clamp(prev.best, 0, 99999)), lastActiveDate: todayStr };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  try { getApp(); } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
  const user = await requireFirebaseUser(req, res); if (!user) return;
  const uid = playerId(user);
  const myAccess = accessForUser(user);
  if (myAccess) ACCESS_CACHE.set(uid, myAccess);
  const db = admin.firestore();
  const { accion } = req.body || {};

  try {
    if (accion === 'resumen') {
      const doc = await db.collection('juegos_puntos').doc(uid).get();
      if (myAccess && doc.exists && doc.data()?.access !== myAccess) { try { await db.collection('juegos_puntos').doc(uid).set({ access: myAccess }, { merge: true }); } catch (_) {} }
      const data = doc.exists ? doc.data() : {};
      const totalPoints = Number(data.totalPoints) || 0;
      return res.status(200).json({ ok: true, catalogo: GAMES, jugador: uid, totalPoints, byGame: data.byGame || {}, streak: data.streak || { current: 0, best: 0 }, badge: badgeFor(totalPoints) });
    }

    if (accion === 'registrar') {
      const { gameCode, roundId, metrics } = req.body || {};
      if (!GAMES[gameCode]) return res.status(400).json({ ok: false, error: 'Juego no reconocido.' });
      if (!roundId || typeof roundId !== 'string' || roundId.length > 100) return res.status(400).json({ ok: false, error: 'Falta roundId.' });
      const clean = sanitizeMetrics(gameCode, metrics);
      const todayStr = hnDateStr();
      const resultRef = db.collection('juegos_resultados').doc(roundId);
      const userRef = db.collection('juegos_puntos').doc(uid);

      const out = await db.runTransaction(async tx => {
        const existing = await tx.get(resultRef);
        const userSnap0 = await tx.get(userRef);
        if (existing.exists) { const stored = existing.data(); const cur = userSnap0.exists ? userSnap0.data() : {}; return { ...stored, totalPoints: Number(cur.totalPoints) || 0, streak: cur.streak || { current: 0, best: 0 }, repetido: true }; } // idempotente: ya se acreditó, se devuelve el mismo resultado + el saldo actual
        const prev = userSnap0.exists ? userSnap0.data() : {};
        // Tope diario: se calcula sobre lo ya otorgado hoy (guardado en el propio doc de usuario, por fecha).
        const todayTotals = prev.dailyDate === todayStr ? (prev.daily || {}) : {};
        const usedGlobalToday = Number(todayTotals.global) || 0;
        const usedGameToday = Number(todayTotals[gameCode]) || 0;
        const { awardedPoints: rawAward, rawScore } = FORMULAS[gameCode](clean);
        const globalRemaining = Math.max(0, DAILY_GLOBAL_CAP - usedGlobalToday);
        const gameRemaining = Math.max(0, DAILY_GAME_CAP - usedGameToday);
        const awardedPoints = Math.max(0, Math.min(rawAward, globalRemaining, gameRemaining));
        const totalPoints = (Number(prev.totalPoints) || 0) + awardedPoints;
        const streak = awardedPoints > 0 ? computeStreak(prev.streak || {}, todayStr) : (prev.streak || { current: 0, best: 0 });
        const byGame = { ...(prev.byGame || {}) }; byGame[gameCode] = (Number(byGame[gameCode]) || 0) + awardedPoints;
        const daily = { ...(prev.dailyDate === todayStr ? prev.daily : {}) };
        daily.global = usedGlobalToday + awardedPoints; daily[gameCode] = usedGameToday + awardedPoints;
        tx.set(resultRef, { uid, gameCode, roundId, rawScore, awardedPoints, metrics: clean, createdAt: new Date().toISOString(), localDate: todayStr });
        const extra = {};
        if (gameCode === 'DARTS' && clean && clean.pro) { // estadísticas propias de Dardos (el ranking sigue usando el total global de SP)
          const st = { ...((prev.stats || {}).darts || {}) };
          st.matchesPlayed = (Number(st.matchesPlayed) || 0) + 1; st.matchesWon = (Number(st.matchesWon) || 0) + (clean.won ? 1 : 0);
          st.bulls = (Number(st.bulls) || 0) + clean.bulls; st.triple20s = (Number(st.triple20s) || 0) + clean.triple20s;
          st.totalDartsThrown = (Number(st.totalDartsThrown) || 0) + clean.dartsUsed; st.totalScoreScored = (Number(st.totalScoreScored) || 0) + clean.scored;
          st.bestTurnScore = Math.max(Number(st.bestTurnScore) || 0, clean.bestTurn);
          extra.stats = { ...(prev.stats || {}), darts: st };
        }
        tx.set(userRef, { totalPoints, byGame, streak, dailyDate: todayStr, daily, ...extra, ...(myAccess ? { access: myAccess } : {}), updatedAt: new Date().toISOString() }, { merge: true });
        return { uid, gameCode, roundId, rawScore, awardedPoints, totalPoints, streak, badge: badgeFor(totalPoints), repetido: false };
      });
      const totalPoints = Number(out.totalPoints) || 0;
      return res.status(200).json({ ok: true, repetido: Boolean(out.repetido), rawScore: out.rawScore, awardedPoints: out.awardedPoints, totalPoints, streak: out.streak, badge: out.badge || badgeFor(totalPoints) });
    }

    if (accion === 'ranking') {
      // Carga el acceso guardado de cada jugador (Sublicuentas / Relojes / Geisell) para nombrar y agrupar el ranking.
      try { const acc = await db.collection('juegos_puntos').get(); acc.forEach(d => { const a = d.data()?.access; if (a) ACCESS_CACHE.set(d.id, a); }); } catch (_) {}
      const scope = String(req.body?.scope || 'general');
      const limit = Math.min(50, Math.max(1, Number(req.body?.limit) || 10));
      if (scope === 'semanal') {
        const weekStart = hnWeekStartStr();
        const snap = await db.collection('juegos_resultados').where('localDate', '>=', weekStart).get();
        const best = new Map(); // key uid|gameCode|localDate -> mejor awardedPoints ese día (evita sumar repeticiones infinitas)
        snap.forEach(d => { const r = d.data(); const k = `${r.uid}|${r.gameCode}|${r.localDate}`; best.set(k, Math.max(best.get(k) || 0, Number(r.awardedPoints) || 0)); });
        const totals = new Map();
        for (const [k, pts] of best) { const uidKey = k.split('|')[0]; totals.set(uidKey, (totals.get(uidKey) || 0) + pts); }
        const m = mergeByAccess([...totals.entries()].map(([id, score]) => ({ userId: id, displayName: displayName(id), score })), uid, 'sum');
        return res.status(200).json({ ok: true, scope, period: { from: weekStart }, me: { rank: m.meIdx >= 0 ? m.meIdx + 1 : null, score: m.meRow ? m.meRow.score : (totals.get(uid) || 0) }, entries: m.list.slice(0, limit) });
      }
      if (scope === 'porJuego') {
        const gameCode = String(req.body?.gameCode || '');
        if (!GAMES[gameCode]) return res.status(400).json({ ok: false, error: 'Juego no reconocido.' });
        const snap = await db.collection('juegos_resultados').where('gameCode', '==', gameCode).get();
        const best = new Map(); snap.forEach(d => { const r = d.data(); best.set(r.uid, Math.max(best.get(r.uid) || 0, Number(r.awardedPoints) || 0)); });
        const m = mergeByAccess([...best.entries()].map(([id, score]) => ({ userId: id, displayName: displayName(id), score })), uid, 'max');
        return res.status(200).json({ ok: true, scope, gameCode, me: { rank: m.meIdx >= 0 ? m.meIdx + 1 : null, score: m.meRow ? m.meRow.score : (best.get(uid) || 0) }, entries: m.list.slice(0, limit) });
      }
      // general (lifetime)
      const snap = await db.collection('juegos_puntos').get();
      const entries = []; snap.forEach(d => { const v = d.data(); entries.push({ userId: d.id, displayName: displayName(d.id), score: Number(v.totalPoints) || 0, streak: Number(v.streak?.current) || 0, badge: badgeFor(Number(v.totalPoints) || 0).name }); });
      const m = mergeByAccess(entries, uid, 'sum');
      return res.status(200).json({ ok: true, scope: 'general', total: m.list.length, me: m.meRow ? { ...m.list[m.meIdx], rank: m.meIdx + 1 } : { rank: null, score: 0 }, entries: m.list.slice(0, limit) });
    }

    return res.status(400).json({ ok: false, error: 'Acción no reconocida.' });
  } catch (e) {
    console.error('[api/juegos]', e);
    return res.status(500).json({ ok: false, error: 'Error interno: ' + (e.message || '') });
  }
};

module.exports.__internal = { sopaValidate, sopaProPoints, SOPA_SCORE, dartScore, dartsReplay, dartsProPoints, mergeByAccess, accessName, FORMULAS, sanitizeMetrics, badgeFor, computeStreak, hnDateStr, hnWeekStartStr, GAMES, DAILY_GLOBAL_CAP, DAILY_GAME_CAP };
