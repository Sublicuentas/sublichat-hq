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
const accessName = id => ACCESS_OF[String(id || '').toLowerCase().trim()] || '';
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
    case 'WORD_SEARCH': return { foundWords: num(raw.foundWords), wrongSelections: num(raw.wrongSelections), hintsUsed: num(raw.hintsUsed), maxCombo: num(raw.maxCombo), timeLimitSec: num(raw.timeLimitSec, 240), timeRemainingSec: num(raw.timeRemainingSec) };
    case 'HANGMAN': return { solvedWords: num(raw.solvedWords), totalWrongLetters: num(raw.totalWrongLetters), hintsUsed: num(raw.hintsUsed), timeLimitSec: num(raw.timeLimitSec, 180), timeRemainingSec: num(raw.timeRemainingSec) };
    case 'MEMORY_PAIRS': return { pairsFound: num(raw.pairsFound), moves: num(raw.moves, 12), maxCombo: num(raw.maxCombo), timeLimitSec: num(raw.timeLimitSec, 120), timeRemainingSec: num(raw.timeRemainingSec) };
    case 'BASKETBALL': return { made: num(raw.made), swish: num(raw.swish), bestStreak: num(raw.bestStreak), avgAccuracy: num(raw.avgAccuracy) };
    case 'DARTS': return { finished: bool(raw.finished), dartsUsed: num(raw.dartsUsed, 9), avgAccuracy: num(raw.avgAccuracy), bonusHits: num(raw.bonusHits) };
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
  const db = admin.firestore();
  const { accion } = req.body || {};

  try {
    if (accion === 'resumen') {
      const doc = await db.collection('juegos_puntos').doc(uid).get();
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
        tx.set(userRef, { totalPoints, byGame, streak, dailyDate: todayStr, daily, updatedAt: new Date().toISOString() }, { merge: true });
        return { uid, gameCode, roundId, rawScore, awardedPoints, totalPoints, streak, badge: badgeFor(totalPoints), repetido: false };
      });
      const totalPoints = Number(out.totalPoints) || 0;
      return res.status(200).json({ ok: true, repetido: Boolean(out.repetido), rawScore: out.rawScore, awardedPoints: out.awardedPoints, totalPoints, streak: out.streak, badge: out.badge || badgeFor(totalPoints) });
    }

    if (accion === 'ranking') {
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

module.exports.__internal = { mergeByAccess, accessName, FORMULAS, sanitizeMetrics, badgeFor, computeStreak, hnDateStr, hnWeekStartStr, GAMES, DAILY_GLOBAL_CAP, DAILY_GAME_CAP };
