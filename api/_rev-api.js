// api/_rev-api.js · R158 — Llamadas de servidor a servidor hacia el backend del bot (Render · server_api.js) con el
// token de ADMIN del Panel de Socios. Mismas variables que api/revendedores-admin.js (REV_ADMIN_USER,
// REV_ADMIN_PASSWORD, REV_API_BASE). El token nunca llega al navegador.
const REV_API_BASE = String(process.env.REV_API_BASE || "https://sublicuentas-panel-api.onrender.com").replace(/\/$/, "");
const TOKEN_TTL_MS = 25 * 24 * 60 * 60 * 1000;
let cachedToken = null, cachedAt = 0;

async function token(force = false) {
  if (!force && cachedToken && Date.now() - cachedAt < TOKEN_TTL_MS) return cachedToken;
  const usuario = process.env.REV_ADMIN_USER || "", password = process.env.REV_ADMIN_PASSWORD || "";
  if (!usuario || !password) throw new Error("Faltan REV_ADMIN_USER / REV_ADMIN_PASSWORD en Vercel.");
  const r = await fetch(`${REV_API_BASE}/rev/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario, password }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.token) throw new Error(j.error || "No se pudo conectar con el backend del bot.");
  cachedToken = j.token; cachedAt = Date.now();
  return cachedToken;
}

// GET a /rev/admin/<ruta>; reintenta una vez si el token venció.
export async function revAdminGet(ruta, params = {}, actor = "") {
  const url = new URL(`${REV_API_BASE}/rev/admin/${ruta}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let intento = 0; intento < 2; intento++) {
    const t = await token(intento > 0);
    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${t}`, ...(actor ? { "X-Sublichat-Actor": actor } : {}) } });
    if (r.status === 401 && intento === 0) continue;
    const data = await r.json().catch(() => ({ ok: false, error: "respuesta_invalida" }));
    return { status: r.status, data };
  }
  return { status: 401, data: { ok: false, error: "sin_sesion" } };
}
