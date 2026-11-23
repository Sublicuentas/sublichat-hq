// R201 · Protocolo de seguridad (Sublichat HQ): Turnstile, 3 fallos → 30 min, 12 h sin uso, cabeceras.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { verificarTurnstile, turnstileConfigPublica } = require("../api/_turnstile.js");
const leer = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
test("Turnstile: apagado sin clave; navegador sin token → 400; token válido → ok; falla cerrada si Cloudflare no responde", async () => {
  delete process.env.TURNSTILE_SECRET_KEY;
  assert.equal((await verificarTurnstile({ headers: { origin: "https://sublichat.capuchino.lat" } }, {})).ok, true);
  process.env.TURNSTILE_SECRET_KEY = "secreta-prueba"; process.env.TURNSTILE_SITE_KEY = "publica-prueba";
  const web = { headers: { origin: "https://sublichat.capuchino.lat" } };
  assert.equal((await verificarTurnstile(web, {})).status, 400);
  assert.equal((await verificarTurnstile(web, { token: "t", fetchImpl: async () => ({ json: async () => ({ success: true, action: "login" }) }) })).ok, true);
  assert.equal((await verificarTurnstile(web, { token: "t", fetchImpl: async () => { throw new Error("x"); } })).status, 503);
  assert.equal((await verificarTurnstile({ headers: {} }, {})).ok, true, "modo web: la APK actual sigue entrando hasta pasar a modo all");
  assert.ok(!JSON.stringify(turnstileConfigPublica()).includes("secreta"));
  delete process.env.TURNSTILE_SECRET_KEY;
});
test("login.js: 3 fallos / 15 min → 30 min, 429 con Retry-After, Turnstile antes de revisar la clave", () => {
  const s = leer("api/login.js");
  assert.match(s, /const LOGIN_MAX_FALLOS = 3;/); assert.match(s, /LOGIN_VENTANA_MS = 15 \* 60 \* 1000/); assert.match(s, /LOGIN_BLOQUEO_MS = 30 \* 60 \* 1000/);
  assert.match(s, /setHeader\("Retry-After"/);
  assert.ok(s.indexOf("verificarTurnstile(req") < s.indexOf("checkThrottle(db, key, ip)") && s.indexOf("checkThrottle(db, key, ip)") < s.lastIndexOf("verifyPassword(clave"));
  assert.doesNotMatch(s, /TURNSTILE_SECRET_KEY/, "la secreta solo se lee en _turnstile.js");
});
test("Web: cierre automático a las 12 h sin uso y la secreta de Turnstile nunca en el frontend", () => {
  const app = leer("sublichat-app.js");
  assert.match(app, /SUBLI_INACTIVIDAD_MS=12\*60\*60\*1000/); assert.match(app, /subliCerrarPorInactividad/);
  for (const f of ["index.html", "sublichat-app.js"]) assert.doesNotMatch(leer(f), /TURNSTILE_SECRET|0x4AAAAAAA[A-Za-z0-9_-]{10,}/);
});
test("Cabeceras: HSTS de 1 año en todas las rutas", () => {
  const v = JSON.parse(leer("vercel.json")); const g = v.headers.find((h) => h.source.startsWith("/((?!turnstile"));
  const hsts = g.headers.find((h) => h.key === "Strict-Transport-Security").value;
  assert.ok(Number(/max-age=(\d+)/.exec(hsts)[1]) >= 31536000);
});
