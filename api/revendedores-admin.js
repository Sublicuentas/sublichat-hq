// api/revendedores-admin.js · Puente hacia el Panel de Socios (revendedores)
// ---------------------------------------------------------------------------
// Deja editar precios, vendedores y clientes de TODA la red de revendedores
// desde Sublichat, sin entrar al panel aparte ni usar comandos de Telegram.
// Llama al backend en Render (server_api.js + index_12_admin_panel.js del
// repo sublicuentas-tg-bot) usando el token de ADMIN de ese panel — nunca
// se expone al navegador, se guarda como env var acá en Vercel.
//
// 🔒 Candado: mismo criterio que ya usan api/finanzas.js y api/tickets.js
// para el rol canónico "sublicuentas" — pero acá NO se abre a otros roles
// (finanzas/relojes/magdiel etc.) como en esos archivos, porque esta
// categoría toca precios y cuentas de TODA la red, no solo lo propio.
//
// Variables de entorno requeridas en Vercel:
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//   REV_ADMIN_USER, REV_ADMIN_PASSWORD   (las mismas ADMIN_USER/ADMIN_PASSWORD
//                                         que ya están en Render)
//   REV_API_BASE  (opcional; por defecto https://sublicuentas-panel-api.onrender.com)

import admin from "firebase-admin";

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  privateKey = privateKey.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltan variables FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY.");
  }
  return admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

async function requireFirebaseUser(req, res) {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) { res.status(401).json({ ok: false, error: "Sesión requerida." }); return null; }
  try { return await admin.auth().verifyIdToken(token); }
  catch (_) { res.status(401).json({ ok: false, error: "Sesión inválida o vencida." }); return null; }
}

// Mismo cálculo que authIdentity() en finanzas.js — "sublicuentas" es el rol
// canónico del dueño del negocio (Libni/Naara).
function esUsuarioSublicuentas(user) {
  const role = String((user && user.role) || "").toLowerCase();
  const usuario = String((user && (user.usuario || user.uid)) || "").toLowerCase();
  return ["admin", "administrador", "sublicuentas", "owner"].includes(role) ||
    ["naara", "sublicuentas"].includes(usuario);
}

const REV_API_BASE = String(process.env.REV_API_BASE || "https://sublicuentas-panel-api.onrender.com").replace(/\/$/, "");

// El token de admin del Panel de Socios dura 30 días (ver index_09_api_auth.js
// del bot) — lo cacheamos en memoria mientras la función siga "caliente" en
// Vercel para no loguearse de nuevo en cada click. Si arranca fría, se
// vuelve a loguear solo y el usuario no nota nada.
let cachedToken = null;
let cachedAt = 0;
const TOKEN_TTL_MS = 25 * 24 * 60 * 60 * 1000;

async function getRevAdminToken(force = false) {
  if (!force && cachedToken && (Date.now() - cachedAt) < TOKEN_TTL_MS) return cachedToken;
  const usuario = process.env.REV_ADMIN_USER || "";
  const password = process.env.REV_ADMIN_PASSWORD || "";
  if (!usuario || !password) {
    throw new Error("Faltan REV_ADMIN_USER / REV_ADMIN_PASSWORD en Vercel.");
  }
  const r = await fetch(`${REV_API_BASE}/rev/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, password }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.token) throw new Error(j.error || "No se pudo iniciar sesión en el Panel de Socios.");
  cachedToken = j.token;
  cachedAt = Date.now();
  return cachedToken;
}

// Solo estos 3 recursos existen bajo /rev/admin/ — evita que esto se use
// como proxy abierto hacia cualquier URL.
const RECURSOS_VALIDOS = new Set(["precios", "revendedores", "clientes"]);

async function reenviar(pathSegments, queryParams, method, body, token) {
  const target = pathSegments.map(encodeURIComponent).join("/");
  const url = new URL(`${REV_API_BASE}/rev/admin/${target}`);
  for (const [k, v] of queryParams) url.searchParams.set(k, String(v));

  const opts = {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  };
  if (method !== "GET" && method !== "DELETE" && body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  const r = await fetch(url.toString(), opts);
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch (_) { data = { ok: r.ok, raw: text }; }
  return { status: r.status, data };
}

export default async function handler(req, res) {
  try {
    getApp();
    const user = await requireFirebaseUser(req, res);
    if (!user) return; // requireFirebaseUser ya respondió

    if (!esUsuarioSublicuentas(user)) {
      return res.status(403).json({ ok: false, error: "Esta sección es solo para el usuario sublicuentas." });
    }

    const rutaCruda = String(req.query.ruta || "").replace(/^\/+/, "").trim();
    const pathSegments = rutaCruda.split("/").filter(Boolean);
    const primerSegmento = pathSegments[0] || "";
    if (!rutaCruda || !RECURSOS_VALIDOS.has(primerSegmento) || rutaCruda.length > 300 || /[?#]|\.\.|:\/\//.test(rutaCruda)) {
      return res.status(400).json({ ok: false, error: "Ruta inválida." });
    }

    // Filtros de querystring (ej. clientes?q=... o clientes?vendedor=...) se
    // reenvían tal cual, aparte del propio "ruta".
    const extras = Object.entries(req.query || {}).filter(([k]) => k !== "ruta");
    const method = req.method || "GET";

    let token;
    try { token = await getRevAdminToken(); }
    catch (e) { return res.status(502).json({ ok: false, error: e.message }); }

    let { status, data } = await reenviar(pathSegments, extras, method, req.body, token);

    // Si el token del panel venció, reintenta UNA vez con uno nuevo.
    if (status === 401) {
      token = await getRevAdminToken(true);
      ({ status, data } = await reenviar(pathSegments, extras, method, req.body, token));
    }

    return res.status(status).json(data);
  } catch (err) {
    console.error("REVENDEDORES_ADMIN_ERROR", err);
    return res.status(500).json({ ok: false, error: err.message || "Error interno." });
  }
}
