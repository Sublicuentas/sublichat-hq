// lib/codigos-imap.js · R77 — Códigos de plataformas leídos del correo del hosting (IMAP), para la APK.
// Es la MISMA lógica del bot de Telegram (sublicuentas-tg-bot/index_07_imap.js, v20): mismos detectores
// por plataforma, misma extracción de códigos y links, mismas variables de entorno. Así la APK tiene su
// propio camino (Vercel) y los códigos siguen saliendo aunque Telegram o Render fallen.
// Las funciones marcadas "del bot" están copiadas tal cual; si se cambian allá, se cambian aquí.
//
// Variables en Vercel (mismos nombres que en Render):
//   EMAIL_ADMIN_USER, EMAIL_ADMIN_PASS, EMAIL_IMAP_HOST, EMAIL_IMAP_PORT (993), EMAIL_IMAP_SECURE (true)
//   Opcionales: IMAP_USER_2 / IMAP_PASS_2 / IMAP_HOST_2 ... (más buzones) o IMAP_ACCOUNTS_JSON.
'use strict';
// R79: las dependencias se cargan al usarlas. Si el deploy no las instaló, el endpoint responde un
// mensaje claro ("falta instalar imapflow") en vez de caerse entero (antes la APK mostraba [object Object]).
let _deps = null;
function deps() {
  if (_deps) return _deps;
  const out = {};
  try { out.ImapFlow = require('imapflow').ImapFlow; } catch (e) { const err = new Error('IMAP_DEPENDENCIA'); err.code = 'IMAP_DEPENDENCIA'; err.dep = 'imapflow'; err.cause = e; throw err; }
  try { out.simpleParser = require('mailparser').simpleParser; } catch (e) { const err = new Error('IMAP_DEPENDENCIA'); err.code = 'IMAP_DEPENDENCIA'; err.dep = 'mailparser'; err.cause = e; throw err; }
  _deps = out; return out;
}
function dependenciasOk() { try { deps(); return { ok: true }; } catch (e) { return { ok: false, falta: e.dep || 'desconocida' }; } }

// ── del bot: index_01_core.js ──
function safeJsonParse(input, fallback = null) {
  try { return JSON.parse(input); } catch (_) { return fallback; }
}

function toBool(v, defaultValue = false) {
  if (typeof v === "boolean") return v;
  const s = String(v || "").trim().toLowerCase();
  if (["1", "true", "yes", "si", "sí", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return defaultValue;
}

function normalizeImapAccount(row = {}) {
  return {
    name: String(row.name || row.alias || row.id || "").trim(),
    user: String(row.user || row.email || "").trim(),
    password: String(row.password || row.pass || "").trim(),
    host: String(row.host || "imap.gmail.com").trim(),
    port: Number(row.port || 993),
    tls: toBool(row.tls, true),
    label: String(row.label || "").trim(),
    provider: String(row.provider || "gmail").trim(),
    enabled: toBool(row.enabled, true),
  };
}

function cuentasJsonEnv() {
  const rows = safeJsonParse(String(process.env.IMAP_ACCOUNTS_JSON || '[]').trim(), []);
  return Array.isArray(rows) ? rows.map(normalizeImapAccount).filter(x => x.enabled && (x.user || x.name)) : [];
}

// ── del bot: index_07_imap.js ──
function normalizarClaveEnv(k = "") {
  return String(k || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function mapaEnvNormalizado() {
  const out = new Map();
  for (const [rawKey, rawValue] of Object.entries(process.env || {})) {
    const key = normalizarClaveEnv(rawKey);
    if (!key) continue;
    const value = String(rawValue ?? "");
    const anterior = out.get(key);
    // Si Render llegara a exponer dos claves equivalentes, preferimos la que
    // tenga contenido. Nunca registramos aquí el valor de un secreto.
    if (!anterior || (!String(anterior.value || "").length && value.length)) {
      out.set(key, { rawKey, value });
    }
  }
  return out;
}

function buscarEnv(aliases = [], matcher = null, { requireEmail = false } = {}) {
  const env = mapaEnvNormalizado();
  for (const alias of aliases) {
    const hit = env.get(normalizarClaveEnv(alias));
    if (!hit) continue;
    const value = String(hit.value ?? "");
    if (!value.length) continue;
    if (requireEmail && !value.includes("@")) continue;
    return { value, key: hit.rawKey };
  }
  if (typeof matcher === "function") {
    for (const [normKey, hit] of env.entries()) {
      const value = String(hit.value ?? "");
      if (!value.length || !matcher(normKey, value)) continue;
      if (requireEmail && !value.includes("@")) continue;
      return { value, key: hit.rawKey };
    }
  }
  return { value: "", key: "" };
}

function valorBool(v, fallback = true) {
  if (v === undefined || v === null || String(v).trim() === "") return fallback;
  const s = String(v).trim().toLowerCase();
  if (["0", "false", "no", "off", "disabled"].includes(s)) return false;
  if (["1", "true", "yes", "si", "sí", "on", "ssl", "tls", "secure"].includes(s)) return true;
  return fallback;
}

function resolverImapBase() {
  const hostHit = buscarEnv(
    ["EMAIL_IMAP_HOST", "IMAP_HOST", "IMAP_HOST_1"],
    (k) => /^(?:EMAIL_)?IMAP_HOST(?:_\d+)?$/.test(k)
  );
  const portHit = buscarEnv(
    ["EMAIL_IMAP_PORT", "IMAP_PORT", "IMAP_PORT_1"],
    (k) => /^(?:EMAIL_)?IMAP_PORT(?:_\d+)?$/.test(k)
  );
  const userHit = buscarEnv(
    [
      "EMAIL_ADMIN_USER", "EMAIL_ADMIN_USERNAME", "EMAIL_ADMIN_EMAIL",
      "EMAIL_IMAP_USER", "EMAIL_IMAP_USERNAME", "IMAP_USER", "IMAP_USER_1",
      "IMAP_USERNAME_1", "IMAP_EMAIL_1"
    ],
    (k, value) => (
      /^(?:EMAIL_ADMIN|EMAIL_IMAP|IMAP)_(?:USER|USERNAME|EMAIL)(?:_\d+)?$/.test(k) && value.includes("@")
    ),
    { requireEmail: true }
  );
  const passHit = buscarEnv(
    [
      "EMAIL_ADMIN_PASS", "EMAIL_ADMIN_PASSWORD", "EMAIL_ADMIN_PWD",
      "EMAIL_IMAP_PASS", "EMAIL_IMAP_PASSWORD", "EMAIL_IMAP_PWD",
      "IMAP_PASS", "IMAP_PASSWORD", "IMAP_PWD",
      "IMAP_PASS_1", "IMAP_PASSWORD_1", "IMAP_PWD_1"
    ],
    (k) => /^(?:EMAIL_ADMIN|EMAIL_IMAP|IMAP)_(?:PASS|PASSWORD|PWD)(?:_\d+)?$/.test(k)
  );
  const secureHit = buscarEnv(
    ["EMAIL_IMAP_SECURE", "IMAP_SECURE", "IMAP_SECURE_1", "IMAP_TLS", "IMAP_TLS_1"],
    (k) => /^(?:EMAIL_)?IMAP_(?:SECURE|TLS)(?:_\d+)?$/.test(k)
  );
  const sourceHit = buscarEnv(
    ["IMAP_SOURCE_1", "IMAP_SOURCE", "EMAIL_IMAP_SOURCE"],
    (k) => /^(?:EMAIL_)?IMAP_(?:SOURCE|NAME|LABEL)(?:_\d+)?$/.test(k)
  );

  const portParsed = Number(portHit.value || 993);
  return {
    name: String(sourceHit.value || "hosting-principal").trim() || "hosting-principal",
    host: String(hostHit.value || "premium48.web-hosting.com").trim(),
    port: Number.isFinite(portParsed) && portParsed > 0 ? portParsed : 993,
    tls: valorBool(secureHit.value, true),
    user: String(userHit.value || "admin@sublicuentas.com").trim(),
    password: String(passHit.value || ""),
    _keys: {
      host: hostHit.key || "(fallback premium48.web-hosting.com)",
      port: portHit.key || "(fallback 993)",
      user: userHit.key || "(fallback admin@sublicuentas.com)",
      password: passHit.key || "(no detectada)",
      secure: secureHit.key || "(fallback true)",
      source: sourceHit.key || "(fallback hosting-principal)",
    },
  };
}

function resolverCuentasImapNumeradas() {
  const env = mapaEnvNormalizado();
  const indices = new Set();
  for (const key of env.keys()) {
    const m = key.match(/^IMAP_(?:USER|USERNAME|EMAIL|PASS|PASSWORD|PWD|HOST|PORT|SECURE|TLS|SOURCE|NAME|LABEL)_(\d+)$/);
    if (m) indices.add(Number(m[1]));
  }
  const base = resolverImapBase();
  const out = [];

  const get = (...keys) => {
    for (const k of keys) {
      const hit = env.get(normalizarClaveEnv(k));
      if (hit && String(hit.value ?? "").length) return { value: String(hit.value), key: hit.rawKey };
    }
    return { value: "", key: "" };
  };

  for (const n of [...indices].sort((a, b) => a - b)) {
    const user = get(`IMAP_USER_${n}`, `IMAP_USERNAME_${n}`, `IMAP_EMAIL_${n}`);
    const pass = get(`IMAP_PASS_${n}`, `IMAP_PASSWORD_${n}`, `IMAP_PWD_${n}`);
    if (!user.value || !pass.value) continue;
    const host = get(`IMAP_HOST_${n}`);
    const port = get(`IMAP_PORT_${n}`);
    const secure = get(`IMAP_SECURE_${n}`, `IMAP_TLS_${n}`);
    const source = get(`IMAP_SOURCE_${n}`, `IMAP_NAME_${n}`, `IMAP_LABEL_${n}`);
    const portNum = Number(port.value || base.port || 993);
    out.push({
      name: String(source.value || `imap-${n}`).trim() || `imap-${n}`,
      host: String(host.value || base.host || "premium48.web-hosting.com").trim(),
      port: Number.isFinite(portNum) && portNum > 0 ? portNum : 993,
      tls: valorBool(secure.value, base.tls),
      user: String(user.value).trim(),
      password: String(pass.value),
      _keys: { user: user.key, password: pass.key, host: host.key || base._keys.host },
    });
  }
  return out;
}

const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));

function normalizarCorreo(c = "") { return String(c||"").trim().toLowerCase(); }

function normalizarTextoBusqueda(v = "") {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodificarEntidadesHtmlBasicas(v = "") {
  return String(v || "")
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, hex) => {
      const cp = Number.parseInt(hex, 16);
      return Number.isInteger(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : " ";
    })
    .replace(/&#([0-9]{1,7});/g, (_, dec) => {
      const cp = Number.parseInt(dec, 10);
      return Number.isInteger(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : " ";
    })
    .replace(/&(?:nbsp|ensp|emsp|thinsp|zwnj|zwj);/gi, " ")
    .replace(/&amp;/gi, "&");
}

function htmlATextoVisible(html = "") {
  return decodificarEntidadesHtmlBasicas(html)
    // Disney deja OTP anteriores dentro de preheaders/bloques ocultos. Esos
    // números existen en el HTML, pero no son el código que ve el usuario.
    .replace(/<([a-z0-9]+)\b[^>]*\b(?:hidden|aria-hidden\s*=\s*["']?true|style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\D|$)|font-size\s*:\s*0|max-height\s*:\s*0)[^"']*["'])[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*\b(?:hidden|aria-hidden\s*=\s*["']?true)[^>]*\/?>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<(?:br|\/p|\/div|\/td|\/tr|\/li|\/h[1-6])\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function emailCodigoVigente(email = {}, minutos = 120) {
  const tsInterno = Number(email.ts || 0);
  const tsCabecera = new Date(email.date || 0).getTime();
  const ts = tsInterno > 0 ? tsInterno : tsCabecera;
  if (!Number.isFinite(ts) || ts <= 0) return true;
  return Date.now() - ts <= Math.max(1, Number(minutos || 0)) * 60 * 1000;
}

function formatearFecha(date) {
  try { return new Date(date).toLocaleString("es-HN",{timeZone:"America/Tegucigalpa",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}); }
  catch(_){ return String(date||""); }
}

function esNetflix(from="",subject=""){
  const f=from.toLowerCase(); const s=subject.toLowerCase();
  return f.includes("netflix") || s.includes("netflix");
}

function esNetflixCodigo(from="",subject=""){
  if(!esNetflix(from,subject)) return false;
  const s=subject.toLowerCase();
  if(s.includes("restablecimiento")||s.includes("reset")||s.includes("password")||
     s.includes("contrase")||s.includes("cambio")||s.includes("actualiza")) return false;
  return s.includes("verificaci")||s.includes("seguridad")||
         s.includes("confirmaci")||s.includes("hogar")||s.includes("household")||
         s.includes("inicio de sesi");
}

function esNetflixReset(from="",subject=""){
  if(!esNetflix(from,subject)) return false;
  const s=subject.toLowerCase();
  return s.includes("restablecimiento")||s.includes("reset")||s.includes("password")||
         s.includes("contrase")||s.includes("cambio")||s.includes("actualiza");
}

function esDisney(from="",subject=""){
  const f=from.toLowerCase(); const s=subject.toLowerCase();
  return f.includes("disney")||s.includes("disneyplus")||s.includes("disney plus")||s.includes("disney+");
}

function esDisneyCodigo(from="", subject="", text="") {
  if (!esDisney(from, subject)) return false;
  const s = normalizarTextoBusqueda(`${subject} ${String(text || "").slice(0, 1200)}`);
  return [
    "codigo", "one-time code", "one time code", "one-time passcode",
    "verification code", "access code", "passcode", "otp",
    // Sueco: "Din engångskod till Disney+"
    "engangskod", "engangskoden",
    // Variantes frecuentes en otros idiomas europeos.
    "einmalcode", "einmaliger code", "code unique", "toegangscode"
  ].some(k => s.includes(k));
}

function esHBO(from="",subject=""){
  const f=from.toLowerCase(); const s=subject.toLowerCase();
  return f.includes("hbo")||f.includes("max.com")||f.includes("hbomax")||
         s.includes("hbo max")||s.includes("hbomax")||
         (s.includes("hbo") && !f.includes("netflix") && !f.includes("disney") && !f.includes("amazon"));
}

function esPrime(from="",subject=""){
  const f=from.toLowerCase(); const s=subject.toLowerCase();
  return f.includes("amazon")||f.includes("primevideo")||
         s.includes("prime video")||s.includes("primevideo")||s.includes("amazon prime")||
         (f.includes("prime") && !f.includes("paramount"));
}

function esParamount(from="",subject=""){
  const f=from.toLowerCase(); const s=subject.toLowerCase();
  return f.includes("paramount")||f.includes("cbs.com")||f.includes("viacom")||
         s.includes("paramount")||s.includes("paramount+");
}

function esUniversal(from="",subject=""){
  const f=from.toLowerCase(); const s=subject.toLowerCase();
  return f.includes("universal")||s.includes("universal")||s.includes("universal+");
}

function esSpotify(from="",subject=""){
  const f=from.toLowerCase(); const s=subject.toLowerCase();
  return f.includes("spotify") || s.includes("spotify");
}

function esNotificacionCuenta(subject = "") {
  const s = normalizarTextoBusqueda(subject);
  return [
    "nuevo inicio de sesion", "inicio de sesion nuevo", "new sign-in", "new sign in", "new login",
    "se ha modificado", "ha sido modificad", "has been updated", "was changed", "se actualizo",
    "te damos la bienvenida", "bienvenid", "welcome to",
    "invited to join", "te invitaron", "invitacion", "mydisney family", "familia mydisney",
    "tu contrasena ha cambiado", "tu contrasena se cambio", "password has been changed", "password was changed",
  ].some(k => s.includes(k));
}

function esReset(subject = "", _text = "") {
  if (esNotificacionCuenta(subject)) return false;
  const s = normalizarTextoBusqueda(subject);
  return s.includes("restablec") || s.includes("reset") || s.includes("recupera") ||
         s.includes("olvidaste") || s.includes("cambiar tu contrasena") || s.includes("cambia tu contrasena") ||
         s.includes("change your password") || s.includes("forgot your password");
}

function esVix(from="",subject=""){
  const f=from.toLowerCase(); const s=subject.toLowerCase();
  return f.includes("vix.com")||f.includes("@vix")||f.includes("vix@")||
         s.includes("vix.com")||
         (s.includes("vix") && (s.includes("acceso")||s.includes("verifica")||
          s.includes("código")||s.includes("codigo")||s.includes("correo")||
          s.includes("contrase")||s.includes("login")||s.includes("inicio")));
}

function esHogar(subject="",text=""){
  const s=subject.toLowerCase(); const t=text.toLowerCase();
  return s.includes("hogar")||s.includes("household")||s.includes("extra member")||t.includes("netflix hogar");
}

function extraerCodigoInteligente(text = "", subject = "", html = "", plataforma = "otro") {
  const basuraAnios = new Set(["2024", "2025", "2026", "2027"]);
  const htmlVisible = htmlATextoVisible(html);
  // El texto plano representa mejor lo que ve el usuario. El HTML queda de respaldo.
  const fuentePrincipal = (subject + " " + text).replace(/\s+/g, " ").trim();
  const fuente = (fuentePrincipal + " " + htmlVisible).replace(/\s+/g, " ");

  // Universal+ usa un OTP numérico de 6 dígitos.
  if (plataforma === "universal") {
    for (const origen of [htmlVisible, fuentePrincipal]) {
      const contexto = origen.match(/(?:c[oó]digo|code|otp|pin|verificaci[oó]n|inicio de sesi[oó]n|acceso)[\s\S]{0,160}?(\d(?:[\s\u00a0]*\d){5})(?!\d)/i);
      if (contexto) return contexto[1].replace(/\s/g, "");
      const codigos = origen.match(/(?<!\d)\d{6}(?!\d)/g) || [];
      const valido = codigos.find(c => !basuraAnios.has(c));
      if (valido) return valido;
    }
    return null;
  }

  function esValido(c = "") {
    const s = c.replace(/\s/g, "");
    if (basuraAnios.has(s)) return null;
    if (["disney", "prime", "hbo", "vix"].includes(plataforma) && s.length !== 6) return null;
    if (plataforma === "spotify" && s.length !== 6) return null;
    if (/^\d{4,6}$/.test(s)) return s;
    return null;
  }

  if (plataforma === "disney") {
    // Disney localiza el mismo correo a muchos idiomas. Normalizamos acentos
    // para reconocer, entre otros, el sueco "engångskod".
    // Primero el HTML visible: el texto plano generado por algunos hostings
    // incluye preheaders ocultos con un OTP viejo (por ejemplo 814644).
    for (const origenOriginal of [htmlVisible, fuentePrincipal]) {
      const origen = normalizarTextoBusqueda(`${subject} ${origenOriginal}`);
      const contextoDisney = origen.match(/(?:codigo(?:\s+(?:de\s+)?(?:acceso|verificacion))?|one[- ]time (?:code|passcode)|verification code|access code|passcode|otp|engangskod(?:en)?|einmal(?:iger )?code|code unique|toegangscode)[^0-9]{0,220}?((?:\d\s*){6})(?!\d)/i);
      if (contextoDisney) {
        const v = esValido(contextoDisney[1]);
        if (v) return v;
      }
      // Algunas plantillas colocan cada dígito en una celda/span diferente.
      const secuencias = origen.match(/(?<!\d)(\d(?:[\s\u00a0\u200b-\u200d\ufeff]*\d){5})(?!\d)/g) || [];
      for (const secuencia of secuencias) {
        const v = esValido(secuencia);
        if (v) return v;
      }
    }
    return null;
  }

  if (plataforma === "spotify") {
    const contextoSpotify = fuentePrincipal.match(/(?:c[oó]digo|code|otp|inicio de sesi[oó]n|log[ -]?in)[\s\S]{0,120}?(\d{6})(?!\d)/i);
    if (contextoSpotify) return contextoSpotify[1];
    const codigos6 = fuentePrincipal.match(/(?<!\d)\d{6}(?!\d)/g) || [];
    for (const c of codigos6) { const v = esValido(c); if (v) return v; }
    return null;
  }

  if (["prime", "hbo", "vix"].includes(plataforma)) {
    const contexto6 = fuentePrincipal.match(/(?:c[oó]digo|code|otp|pin|verificaci[oó]n|inicio de sesi[oó]n)[\s\S]{0,100}?(\d{6})(?!\d)/i);
    if (contexto6) return contexto6[1];
    const codigos6 = fuentePrincipal.match(/(?<!\d)\d{6}(?!\d)/g) || [];
    for (const c of codigos6) { const v = esValido(c); if (v) return v; }
    return null;
  }

  const subjL = String(subject || "").toLowerCase();

  // ✅ Netflix "inicio de sesión" y "acceso temporal" usan 4 dígitos — buscar 4 primero
  const netflixPide4 = plataforma === "netflix" && (
    subjL.includes("inicio de sesi") ||
    subjL.includes("acceso temporal") ||
    subjL.includes("ingresa este c") ||
    subjL.includes("code to sign in") ||
    subjL.includes("sign-in code")
  );

  // ✅ Netflix "verificación" y "confirmación" usan 6 dígitos
  const netflixPide6 = plataforma === "netflix" && (
    subjL.includes("verificaci") ||
    subjL.includes("confirmaci") ||
    subjL.includes("código de verif")
  );

  if (netflixPide4) {
    // Buscar 4 dígitos primero, ignorar 6 dígitos
    const match4 = fuente.match(/(?<!\d)(\d{4})(?!\d)/g);
    if (match4) {
      for (const c of match4) { const v = esValido(c); if (v) return v; }
    }
    return null;
  }

  if (netflixPide6) {
    // Buscar 6 dígitos primero
    const match6 = fuente.match(/(?<!\d)(\d{6})(?!\d)/g);
    if (match6) {
      for (const c of match6) { const v = esValido(c); if (v) return v; }
    }
    // Fallback a 4
    const match4 = fuente.match(/(?<!\d)(\d{4})(?!\d)/g);
    if (match4) {
      for (const c of match4) { const v = esValido(c); if (v) return v; }
    }
    return null;
  }

  // Para otras plataformas y Netflix genérico: probar 4 dígitos cerca de palabras clave primero
  // luego 6, luego 4 general
  const match4cerca = fuente.match(/(?:código|code|clave|pin)[^\d]{0,20}(\d{4})(?!\d)/gi);
  if (match4cerca) {
    for (const m of match4cerca) {
      const nums = m.match(/\d{4}/);
      if (nums) { const v = esValido(nums[0]); if (v) return v; }
    }
  }

  const match6 = fuente.match(/(?<!\d)(\d{6})(?!\d)/g);
  if (match6) {
    for (const c of match6) { const v = esValido(c); if (v) return v; }
  }

  const match4 = fuente.match(/(?<!\d)(\d{4})(?!\d)/g);
  if (match4) {
    for (const c of match4) { const v = esValido(c); if (v) return v; }
  }

  return null;
}

function extraerLink(text="", html="") {
  const fuentes = [html, text].filter(Boolean);
  const pats = [
    /https:\/\/www\.netflix\.com\/password[^\s"<>\]&]+(?:&amp;|&)[^\s"<>\]]*/i,
    /https:\/\/www\.netflix\.com\/password[^\s"<>\]]+/i,
    /https:\/\/www\.netflix\.com\/[^\s"<>\]]*reset[^\s"<>\]]*/i,
    /https:\/\/[^\s"<>\]]*netflix[^\s"<>\]]*password[^\s"<>\]]*/i,
    /https:\/\/[^\s"<>\]]*disneyplus[^\s"<>\]]*(?:reset|password|account)[^\s"<>\]]*/i,
    /https:\/\/[^\s"<>\]]*disney[^\s"<>\]]*account[^\s"<>\]]*/i,
    /https:\/\/[^\s"<>\]]*hbomax[^\s"<>\]]*(?:reset|password|account|verify)[^\s"<>\]]*/i,
    /https:\/\/[^\s"<>\]]*max\.com[^\s"<>\]]*(?:reset|password|account|verify|email)[^\s"<>\]]*/i,
    /https:\/\/[^\s"<>\]]*paramount[^\s"<>\]]*(?:reset|password|account|verify|login|signin)[^\s"<>\]]*/i,
    /https:\/\/[^\s"<>\]]*cbsinteractive[^\s"<>\]]*(?:reset|password|account)[^\s"<>\]]*/i,
    /https:\/\/[^\s"<>\]]*viacomcbs[^\s"<>\]]*(?:reset|password|account)[^\s"<>\]]*/i,
    /https:\/\/[^\s"<>\]]*universal[^\s"<>\]]*(?:reset|password|account|verify)[^\s"<>\]]*/i,
    /https:\/\/[^\s"<>\]]*spotify[^\s"<>\]]*(?:reset|password|account|verify|login)[^\s"<>\]]*/i,
    // Vix
    /https:\/\/[^\s"<>\]]*vix\.com[^\s"<>\]]*(?:reset|password|account|verify|email|confirm)[^\s"<>\]]*/i,
    /https:\/\/[^\s"<>\]]*vix[^\s"<>\]]*(?:reset|password|cuenta|correo|verificar|confirmar)[^\s"<>\]]*/i,
  ];
  for (const f of fuentes) {
    for (const p of pats) {
      const m = f.match(p);
      if (m?.[0]) {
        let url = m[0].replace(/&amp;/g,"&").replace(/["\s>]+$/,"").trim();
        try { url = decodeURIComponent(url.replace(/\+/g," ")); } catch(_) {}
        return url;
      }
    }
  }
  return null;
}

function extraerLinkObtenerCodigo(html="") {
  const pat = /https:\/\/[^"'>]+netflix\.com[^"'>]*(?:travel|verify|temporary|update|account\/travel)[^"'>]*/i;
  const m = html.match(pat);
  if(m) return m[0].replace(/&amp;/g, "&").trim();
  return null;
}

async function scrapearCodigoWeb(url) {
  try {
    if(typeof fetch !== "undefined") {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
      });
      const html = await res.text();
      const m1 = html.match(/>\s*([0-9]{4})\s*</);
      if (m1 && m1[1]) return m1[1];
    }
  } catch(e) {}
  return null;
}

async function buscarEmailsCuenta(correo, limite=15, cuenta={}) {
  const correoBuscar = String(correo||"").trim().toLowerCase();
  const base = resolverImapBase();

  const { ImapFlow } = deps();
  const client = new ImapFlow({
    host:String(cuenta.host||base.host), port:Number(cuenta.port||base.port), secure:cuenta.tls!==false,
    auth:{user:String(cuenta.user||base.user), pass:String(cuenta.password||cuenta.pass||base.password)},
    logger:false,
    connectionTimeout:15000, greetingTimeout:10000, socketTimeout:30000,
    tls:{rejectUnauthorized:false},
  });

  await client.connect();
  const emails = [];

  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const total = client.mailbox?.exists || 0;
      if (!total) return [];

      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - 3);

      // Traer suficientes headers para buzones con bastante tráfico. Solo se
      // descarga el cuerpo de los candidatos, así que sigue siendo liviano.
      const inicio = total;
      const fin    = Math.max(1, total - 199);
      const rango  = `${fin}:${inicio}`;

      // ✅ Paso 1: traer envelope con internalDate — guardar seq + fecha exacta del servidor
      const candidatos = []; // { seq, uid, ts }
      for await (const msg of client.fetch(rango, { envelope: true, internalDate: true, uid: true })) {
        try {
          const fecha = msg.internalDate ? new Date(msg.internalDate) : new Date(0);
          if (fecha < fechaLimite) continue;

          const fromStr = String(msg.envelope?.from?.[0]?.address || msg.envelope?.from?.[0]?.name || "").toLowerCase();
          const subjStr = String(msg.envelope?.subject || "").toLowerCase();

          const esPlatConocida =
            fromStr.includes("netflix") || fromStr.includes("disney") ||
            fromStr.includes("hbo") || fromStr.includes("max.com") ||
            fromStr.includes("amazon") || fromStr.includes("primevideo") ||
            fromStr.includes("paramount") || fromStr.includes("vix") ||
            fromStr.includes("universal") || fromStr.includes("spotify") || fromStr.includes("crunchyroll") ||
            subjStr.includes("netflix") || subjStr.includes("disney") || subjStr.includes("spotify") ||
            subjStr.includes("hbo") || subjStr.includes("amazon") ||
            subjStr.includes("código") || subjStr.includes("codigo") ||
            subjStr.includes("verifica") || subjStr.includes("acceso") ||
            subjStr.includes("contrase") || subjStr.includes("restablec");

          if (esPlatConocida) candidatos.push({ seq: msg.seq, uid: Number(msg.uid || 0), ts: fecha.getTime() });
        } catch(_) {}
      }

      // ✅ Ordenar candidatos: más reciente primero (por internalDate del servidor)
      // Algunos hostings guardan dos OTP reenviados dentro del mismo segundo.
      // En ese caso internalDate empata; UID/sequence más alto es el correo que
      // llegó último y, para Disney, el único código que sigue siendo válido.
      candidatos.sort((a, b) => b.ts - a.ts || b.uid - a.uid || b.seq - a.seq);

      // ✅ Paso 2: descargar source solo de candidatos, del más reciente al más viejo
      for (const { seq, uid, ts } of candidatos) {
        if (emails.length >= limite) break;
        try {
          const data = await client.fetchOne(String(seq), { source: true });
          if (!data?.source) continue;

          const p = await deps().simpleParser(data.source);

          const bodyText = String(p.text    || "").toLowerCase();
          const bodyHtml = String(p.html    || "").toLowerCase();
          const subj     = String(p.subject || "").toLowerCase();
          const toAddr   = (p.to?.text      || "").toLowerCase();
          // En correos reenviados/catch-all, el destinatario original puede
          // aparecer solo en Delivered-To, X-Original-To o Envelope-To. Esos
          // encabezados siguen presentes en el source aunque p.to sea admin@.
          const rawSource = Buffer.isBuffer(data.source) ? data.source.toString("utf8") : String(data.source || "");
          const rawHeaders = rawSource.split(/\r?\n\r?\n/, 1)[0].toLowerCase();
          const allText  = bodyText + " " + bodyHtml + " " + subj + " " + toAddr + " " + rawHeaders;

          if (!allText.includes(correoBuscar)) continue;

          emails.push({
            from:    String(p.from?.text || ""),
            subject: String(p.subject   || ""),
            text:    String(p.text      || ""),
            html:    String(p.html      || ""),
            // Para ordenar y mostrar usamos la llegada real al hosting. La
            // cabecera Date puede repetirse, venir retrasada o faltar.
            date:    ts > 0 ? new Date(ts) : (p.date || new Date(0)),
            ts:      ts || 0,
            uid:     uid || 0,
            seq:     seq || 0,
            mailbox: String(cuenta.name || cuenta.label || cuenta.user || "hosting"),
          });
        } catch(_) {}
      }
    } finally { lock.release(); }
  } catch(err) {
    console.error("[IMAP buscarEmails] Error:", err?.message || err);
    throw err;
  } finally {
    try { await client.logout(); } catch(_) {}
  }

  // Más reciente primero
  // Ordenar por timestamp del servidor (más preciso que p.date)
  return emails.sort((a, b) => (b.ts || 0) - (a.ts || 0) || (b.uid || 0) - (a.uid || 0) || (b.seq || 0) - (a.seq || 0));
}

function cuentasImapCodigos() {
  const base = resolverImapBase();
  const legacy = { name: base.name, host: base.host, port: base.port, tls: base.tls, user: base.user, password: base.password };
  const rows = [legacy, ...resolverCuentasImapNumeradas(), ...cuentasJsonEnv()];
  const seen = new Set();
  return rows.filter(row => {
    const host = String(row?.host || '').trim();
    const user = String(row?.user || '').trim();
    const password = String(row?.password || row?.pass || '');
    const key = `${host.toLowerCase()}|${user.toLowerCase()}`;
    if (!host || !user || !password || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function buscarEmails(correo, limite = 15) {
  const cuentas = cuentasImapCodigos();
  if (!cuentas.length) { const e = new Error('IMAP_SIN_CREDENCIALES'); e.code = 'IMAP_SIN_CREDENCIALES'; throw e; }
  deps(); // R79: si falta imapflow/mailparser se avisa claro, no como "no conecta"
  const results = await Promise.allSettled(cuentas.map(cuenta => buscarEmailsCuenta(correo, limite, cuenta)));
  const emails = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  if (!emails.length && results.every(r => r.status === 'rejected')) {
    const e = new Error('IMAP_NO_CONECTA'); e.code = 'IMAP_NO_CONECTA'; e.cause = results.find(r => r.status === 'rejected')?.reason; throw e;
  }
  return emails.sort((a, b) => (b.ts || 0) - (a.ts || 0) || (b.uid || 0) - (a.uid || 0) || (b.seq || 0) - (a.seq || 0)).slice(0, Math.max(1, limite));
}

// ===============================
// R77 · Resultado ESTRUCTURADO (en vez de mensajes de Telegram). Misma prioridad que /code, /link y /hogar.
// ===============================
const PLAT = Object.freeze({
  netflix: 'Netflix', disney: 'Disney+', hbo: 'HBO Max', prime: 'Prime Video', paramount: 'Paramount+',
  universal: 'Universal+', spotify: 'Spotify', vix: 'ViX', cuenta: 'Cuenta',
});
function plataformaDe(e = {}) {
  const f = e.from || '', s = e.subject || '';
  if (esNetflix(f, s)) return 'netflix';
  if (esDisney(f, s)) return 'disney';
  if (esHBO(f, s)) return 'hbo';
  if (esPrime(f, s)) return 'prime';
  if (esParamount(f, s)) return 'paramount';
  if (esUniversal(f, s)) return 'universal';
  if (esSpotify(f, s)) return 'spotify';
  if (esVix(f, s)) return 'vix';
  return 'cuenta';
}
function base(e, correo, plataforma) {
  return { correo, plataforma, plataformaNombre: PLAT[plataforma] || 'Cuenta', asunto: String(e.subject || ''), fecha: formatearFecha(e.date), ts: Number(e.ts || new Date(e.date || 0).getTime() || 0), uid: Number(e.uid || 0) };
}
const esLinkSeguro = (u = '') => /^https:\/\/[^\s"'<>]+$/i.test(String(u || ''));

/**
 * /code → { tipo:'codigo'|'link'|'hogar_aviso'|'ilegible'|'sin_codigo'|'sin_emails', ... }
 * `yaEntregadoDisney(correo)` devuelve el marcador `${uid}:${codigo}` del último Disney entregado (para avisar si es el mismo).
 */
async function resolverCodigo(emails, correo, { yaEntregadoDisney = () => '', scrap = scrapearCodigoWeb } = {}) {
  if (!emails.length) return { tipo: 'sin_emails', correo };
  for (const e of emails) {
    const fromL = String(e.from || '').toLowerCase();
    const subjL = String(e.subject || '').toLowerCase();
    if (esReset(e.subject, e.text)) {
      if (!emailCodigoVigente(e, 120)) continue;
      const link = extraerLink(e.text, e.html);
      if (link && esLinkSeguro(link)) return { ...base(e, correo, plataformaDe(e)), tipo: 'link', motivo: 'reset', link };
      continue;
    }
    if (fromL.includes('netflix') || esNetflix(e.from, e.subject)) {
      if (!emailCodigoVigente(e, 120)) continue;
      if (subjL.includes('restablecimiento') || subjL.includes('contrase') || subjL.includes('cambio')) continue;
      if (subjL.includes('acceso temporal') || subjL.includes('codigo de acceso') || subjL.includes('temporal')) {
        const linkWeb = extraerLinkObtenerCodigo(e.html);
        if (linkWeb) {
          const codigoWeb = await scrap(linkWeb);
          if (codigoWeb) return { ...base(e, correo, 'netflix'), tipo: 'codigo', codigo: codigoWeb, detalle: 'Código temporal' };
          if (esLinkSeguro(linkWeb)) return { ...base(e, correo, 'netflix'), tipo: 'link', motivo: 'temporal', link: linkWeb };
        }
        continue;
      }
      if (subjL.includes('hogar') || subjL.includes('household') || subjL.includes('extra member')) {
        return { ...base(e, correo, 'netflix'), tipo: 'hogar_aviso' };
      }
      const codigo = extraerCodigoInteligente(e.text, e.subject, e.html, 'netflix');
      if (codigo) return { ...base(e, correo, 'netflix'), tipo: 'codigo', codigo };
      continue;
    }
    if (esDisney(e.from, e.subject)) {
      if (!emailCodigoVigente(e, 30)) continue;
      if (esNotificacionCuenta(e.subject)) continue;
      const codigo = extraerCodigoInteligente(e.text, e.subject, e.html, 'disney');
      if (codigo) {
        const marker = `${Number(e.uid || 0)}:${codigo}`;
        const repetido = String(await yaEntregadoDisney(normalizarCorreo(correo)) || '') === marker;
        return { ...base(e, correo, 'disney'), tipo: 'codigo', codigo, repetido, marcador: marker };
      }
      if (esDisneyCodigo(e.from, e.subject, e.text)) return { ...base(e, correo, 'disney'), tipo: 'ilegible' };
      continue;
    }
    if (esHBO(e.from, e.subject)) {
      if (!emailCodigoVigente(e, 120)) continue;
      if (subjL.includes('restablecimiento') || subjL.includes('reset') || subjL.includes('contrase') || subjL.includes('cambio de correo')) continue;
      const codigo = extraerCodigoInteligente(e.text, e.subject, e.html, 'hbo');
      if (codigo) return { ...base(e, correo, 'hbo'), tipo: 'codigo', codigo };
      continue;
    }
    if (esPrime(e.from, e.subject)) {
      if (!emailCodigoVigente(e, 120)) continue;
      const codigo = extraerCodigoInteligente(e.text, e.subject, e.html, 'prime');
      if (codigo) return { ...base(e, correo, 'prime'), tipo: 'codigo', codigo };
      continue;
    }
    if (esVix(e.from, e.subject)) {
      if (!emailCodigoVigente(e, 120)) continue;
      const codigo = extraerCodigoInteligente(e.text, e.subject, e.html, 'vix');
      if (codigo) return { ...base(e, correo, 'vix'), tipo: 'codigo', codigo };
      const link = extraerLink(e.text, e.html);
      if (link && esLinkSeguro(link)) return { ...base(e, correo, 'vix'), tipo: 'link', motivo: 'vix', link };
      continue;
    }
    if (esUniversal(e.from, e.subject)) {
      if (!emailCodigoVigente(e, 120)) continue;
      const codigo = extraerCodigoInteligente(e.text, e.subject, e.html, 'universal');
      if (codigo) return { ...base(e, correo, 'universal'), tipo: 'codigo', codigo };
      continue;
    }
    if (esSpotify(e.from, e.subject)) {
      if (!emailCodigoVigente(e, 120)) continue;
      const codigo = extraerCodigoInteligente(e.text, e.subject, e.html, 'spotify');
      if (codigo) return { ...base(e, correo, 'spotify'), tipo: 'codigo', codigo };
      continue;
    }
  }
  return { tipo: 'sin_codigo', correo };
}

/** /link → link de restablecimiento (misma prioridad que el bot). */
function resolverLink(emails, correo) {
  if (!emails.length) return { tipo: 'sin_emails', correo };
  for (const e of emails) {
    const isN = esNetflixReset(e.from, e.subject), isD = esDisney(e.from, e.subject), isH = esHBO(e.from, e.subject);
    const isP = esParamount(e.from, e.subject), isU = esUniversal(e.from, e.subject), isV = esVix(e.from, e.subject), isS = esSpotify(e.from, e.subject);
    if (!isN && !isD && !isH && !isP && !isU && !isV && !isS) continue;
    const link = extraerLink(e.text, e.html);
    if (!link || !esLinkSeguro(link)) continue;
    const fromL = String(e.from || '').toLowerCase();
    const plataforma = (isN || fromL.includes('netflix')) ? 'netflix' : (isD || fromL.includes('disney')) ? 'disney'
      : (fromL.includes('amazon') || fromL.includes('prime')) ? 'prime' : (isP || fromL.includes('paramount')) ? 'paramount'
      : (isU || fromL.includes('universal')) ? 'universal' : (isS || fromL.includes('spotify')) ? 'spotify'
      : (isV || fromL.includes('vix')) ? 'vix' : 'hbo';
    return { ...base(e, correo, plataforma), tipo: 'link', motivo: 'reset', link };
  }
  return { tipo: 'sin_link', correo };
}

/** /hogar → código o link de Netflix Hogar. */
async function resolverHogar(emails, correo, { scrap = scrapearCodigoWeb } = {}) {
  if (!emails.length) return { tipo: 'sin_emails', correo };
  for (const e of emails) {
    if (!esNetflix(e.from, e.subject)) continue;
    if (!esHogar(e.subject, e.text)) continue;
    let codigo = extraerCodigoInteligente(e.text, e.subject, e.html, 'netflix');
    const linkWeb = extraerLinkObtenerCodigo(e.html);
    if (!codigo && linkWeb) codigo = await scrap(linkWeb);
    if (codigo) return { ...base(e, correo, 'netflix'), tipo: 'codigo', codigo, detalle: 'Netflix Hogar' };
    if (linkWeb && esLinkSeguro(linkWeb)) return { ...base(e, correo, 'netflix'), tipo: 'link', motivo: 'hogar', link: linkWeb };
    const linkReset = extraerLink(e.text, e.html);
    if (linkReset && esLinkSeguro(linkReset)) return { ...base(e, correo, 'netflix'), tipo: 'link', motivo: 'hogar', link: linkReset };
  }
  return { tipo: 'sin_hogar', correo };
}

/** Consulta completa: lee el hosting y resuelve según el modo ('codigo' | 'link' | 'hogar'). */
async function consultar(correoRaw, modo = 'codigo', opts = {}) {
  const correo = normalizarCorreo(correoRaw);
  const leer = opts.buscar || buscarEmails;
  if (modo === 'link') return resolverLink(await leer(correo), correo);
  if (modo === 'hogar') return resolverHogar(await leer(correo), correo, opts);
  let emails = await leer(correo);
  // Igual que el bot: si hay correo de Disney, se relee a los ~4.5 s por si el OTP nuevo todavía está entrando.
  if (emails.some(e => esDisney(e.from, e.subject))) { await (opts.esperar || esperar)(4500); emails = await leer(correo); }
  return resolverCodigo(emails, correo, opts);
}

function estadoImap() {
  const cuentas = cuentasImapCodigos();
  return { cuentas: cuentas.length, hosts: [...new Set(cuentas.map(c => c.host))].length, dependencias: dependenciasOk(),
    // Solo NOMBRES y host/usuario enmascarado, nunca contraseñas: sirve para revisar la configuración desde la app.
    buzones: cuentas.map(c => ({ fuente: c.name || '', host: c.host, puerto: c.port, usuario: String(c.user || '').replace(/^(.{2}).*(@.*)$/, '$1***$2') })) };
}

module.exports = {
  consultar, resolverCodigo, resolverLink, resolverHogar, buscarEmails, estadoImap, normalizarCorreo, plataformaDe, PLAT,
  // expuestos para pruebas (misma lógica del bot)
  extraerCodigoInteligente, extraerLink, htmlATextoVisible, esReset, esDisney,
};
