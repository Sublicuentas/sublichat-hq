// api/login.js
// Backend seguro para Sublichat: usuario + clave sin exponer correos ni contraseñas en el HTML.
// Requiere variables de entorno en Vercel:
// FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, AUTH_USERS_JSON
//
// AUTH_USERS_JSON ejemplo:
// {"libni":{"uid":"asesor-libni","role":"asesor","passwordHash":"pbkdf2$120000$SAL$HASH"},"naara":{"uid":"asesor-naara","role":"asesor","passwordHash":"pbkdf2$120000$SAL$HASH"}}

const crypto = require("crypto");
const admin = require("firebase-admin");
const { verificarTurnstile, turnstileConfigPublica, ipCliente } = require("./_turnstile.js"); // R201

const LOGIN_ALLOWED_ORIGINS = new Set([
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
  "https://sublichat.capuchino.lat",
  "https://sublichat-hq.vercel.app",
  "https://sublicuentas.com",
  "https://www.sublicuentas.com",
]);
// R162 · Migración a Render: orígenes extra sin tocar código (ej. https://sublichat-hq.onrender.com,
// https://app.sublicuentas.com). Variable LOGIN_EXTRA_ORIGINS separada por comas; solo https.
for (const o of String(process.env.LOGIN_EXTRA_ORIGINS || "").split(",")) {
  const v = o.trim().replace(/\/+$/, "");
  if (/^https:\/\/[a-z0-9.-]+$/i.test(v)) LOGIN_ALLOWED_ORIGINS.add(v);
}

function applyLoginCors(req, res){
  const origin = String((req.headers && req.headers.origin) || "");
  if(origin){
    res.setHeader("Vary", "Origin");
    if(LOGIN_ALLOWED_ORIGINS.has(origin)){
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  }
  return { origin, allowed: !origin || LOGIN_ALLOWED_ORIGINS.has(origin) };
}

function initAdmin(){
  if(admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if(!projectId || !clientEmail || !privateKey){
    throw new Error("Faltan variables FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY.");
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
}

function safeEqual(a,b){
  const ab = Buffer.from(String(a || ""), "hex");
  const bb = Buffer.from(String(b || ""), "hex");
  if(ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function verifyPassword(clave, storedHash){
  if(!storedHash || !storedHash.startsWith("pbkdf2$")) return false;
  const [, iterStr, salt, hash] = storedHash.split("$");
  const iterations = Number(iterStr || 120000);
  const derived = crypto.pbkdf2Sync(String(clave), salt, iterations, 32, "sha256").toString("hex");
  return safeEqual(derived, hash);
}

/* ✅ RATE LIMITING — respaldado en Firestore (no en memoria) porque esta
   función corre en Vercel serverless: cada instancia tiene su propia
   memoria, así que un Map local NO frena nada de forma confiable entre
   instancias. Bloquea por USUARIO (no por IP) tras varios fallos seguidos,
   así rotar de IP no le sirve de nada a quien intente adivinar la clave. */
// R201 · Protocolo de seguridad: 3 fallos del usuario en 15 min → 30 min bloqueado (429).
// Por IP: LOGIN_MAX_FALLOS_IP (10 por defecto) porque Tigo/Claro comparten una IP entre muchas personas.
const LOGIN_MAX_FALLOS = 3;
const LOGIN_MAX_FALLOS_IP = Math.max(3, Math.min(Number(process.env.LOGIN_MAX_FALLOS_IP) || 10, 50));
const LOGIN_VENTANA_MS = 15 * 60 * 1000;
const LOGIN_BLOQUEO_MS = 30 * 60 * 1000;
function ipKey(ip){ return "sublichat_ip_" + crypto.createHash("sha256").update(String(ip || "sin_ip")).digest("hex").slice(0, 32); }

function throttleKey(usuario){
  const k = String(usuario || "").trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "_").slice(0, 120);
  return "sublichat_" + (k || "desconocido");
}

async function checkThrottle(db, usuario, ip){
  const ids = [throttleKey(usuario)]; if(ip) ids.push(ipKey(ip));
  const snaps = await Promise.all(ids.map((id) => db.collection("login_attempts").doc(id).get()));
  const now = Date.now(); let hasta = 0;
  for(const snap of snaps) if(snap.exists) hasta = Math.max(hasta, Number((snap.data() || {}).bloqueadoHasta) || 0);
  if(hasta > now) return { blocked:true, retryAfterSeconds: Math.ceil((hasta - now) / 1000) };
  return { blocked:false };
}

async function registerFailure(db, usuario, ip){
  await registrarFallo(db, db.collection("login_attempts").doc(throttleKey(usuario)), LOGIN_MAX_FALLOS);
  if(ip) await registrarFallo(db, db.collection("login_attempts").doc(ipKey(ip)), LOGIN_MAX_FALLOS_IP);
}
async function registrarFallo(db, ref, maximo){
  try{
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const d = snap.exists ? (snap.data() || {}) : {};
      const ventanaVencida = !d.primerFalloEn || (now - d.primerFalloEn) > LOGIN_VENTANA_MS;
      const fallos = ventanaVencida ? 1 : Number(d.fallos || 0) + 1;
      const primerFalloEn = ventanaVencida ? now : d.primerFalloEn;
      const patch = { fallos, primerFalloEn, updatedAt: now };
      if(fallos >= maximo) patch.bloqueadoHasta = now + LOGIN_BLOQUEO_MS;
      tx.set(ref, patch, { merge:true });
    });
  }catch(_){ /* el throttle nunca debe tumbar el login por un error transitorio */ }
}

async function clearThrottle(db, usuario){
  await db.collection("login_attempts").doc(throttleKey(usuario)).delete().catch(() => {});
}

module.exports = async function handler(req, res){
  const cors = applyLoginCors(req, res);
  if(req.method === "OPTIONS"){
    if(!cors.allowed) return res.status(403).end();
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.setHeader("Access-Control-Max-Age", "600");
    return res.status(204).end();
  }
  if(!cors.allowed) return res.status(403).json({ error:"Origen no autorizado" });
  if(req.method === "GET"){ res.setHeader("Cache-Control","no-store"); return res.status(200).json(turnstileConfigPublica()); } // R201 · solo la clave PÚBLICA de Turnstile
  if(req.method !== "POST"){
    return res.status(405).json({ error:"Método no permitido" });
  }

  try{
    initAdmin();
    const db = admin.firestore();

    const { usuario, clave } = req.body || {};
    const enteredKey = String(usuario || "").trim().toLowerCase();
    const key = enteredKey === 'geissel' ? 'geisell' : enteredKey;

    if(!key || !clave){
      return res.status(400).json({ error:"Usuario y clave requeridos" });
    }
    if(typeof usuario !== "string" || typeof clave !== "string" || key.length > 80 || clave.length > 200){
      return res.status(400).json({ error:"Acceso no autorizado" }); // R201 · solo texto y de largo acotado
    }

    // R201 · Turnstile se valida ANTES de tocar la base de datos o revisar la clave.
    const ts = await verificarTurnstile(req, { token: (req.body || {}).turnstileToken, accion: "login" });
    if(!ts.ok){
      const msg = { verificacion_requerida:"Confirme la verificación de seguridad.", verificacion_fallida:"La verificación de seguridad no pasó. Intente de nuevo.", verificacion_no_disponible:"La verificación de seguridad no responde. Intente en un minuto." }[ts.error];
      return res.status(ts.status).json({ error: msg || "Verificación requerida", codigo: ts.error });
    }
    const ip = ipCliente(req);

    const throttle = await checkThrottle(db, key, ip);
    if(throttle.blocked){
      res.setHeader("Retry-After", String(throttle.retryAfterSeconds));
      return res.status(429).json({ error:"Demasiados intentos fallidos. Por seguridad, espere " + Math.ceil(throttle.retryAfterSeconds / 60) + " minutos.", retryAfterSeconds: throttle.retryAfterSeconds });
    }

    const users = JSON.parse(process.env.AUTH_USERS_JSON || "{}");
    let record = users[key] || users[enteredKey];

    // Geisell usa un rol administrativo limitado en Sublichat. Puede vivir
    // dentro de AUTH_USERS_JSON como cualquier otro usuario o, para facilitar
    // el alta inicial, puede configurarse con GEISELL_PASSWORD_HASH o
    // GEISELL_PASSWORD en Vercel. Ninguna de esas claves llega al navegador.
    if(!record && key === 'geisell'){
      const envHash = String(process.env.GEISELL_PASSWORD_HASH || '').trim();
      const envPlain = String(process.env.GEISELL_PASSWORD || '');
      if(envHash) record = { uid:'admin-geisell', role:'geisell_admin', passwordHash:envHash };
      else if(envPlain) record = { uid:'admin-geisell', role:'geisell_admin', plainPassword:envPlain };
    }

    const validHash = !!(record && record.passwordHash && verifyPassword(clave, record.passwordHash));
    const validPlain = !!(record && typeof record.plainPassword === 'string' && (()=>{
      const a=Buffer.from(String(clave)); const b=Buffer.from(String(record.plainPassword));
      return a.length===b.length && crypto.timingSafeEqual(a,b);
    })());
    if(!record || (!validHash && !validPlain)){
      await registerFailure(db, key, ip);
      // Misma respuesta para usuario inexistente o clave mala.
      return res.status(401).json({ error:"Acceso no autorizado" });
    }

    await clearThrottle(db, key);
    // R180 · usuario retirado por Sublicuentas (Permisos → Retirar): no vuelve a entrar aunque siga en AUTH_USERS_JSON.
    try {
      const cfg = await db.collection('config').doc('sublichat_permisos').get();
      const ret = cfg.exists ? ((cfg.data() || {}).retirados || {})[key] : null;
      if(ret && !ret.reactivadoAt && !['sublicuentas','naara'].includes(key)) return res.status(403).json({ error:"Este usuario fue dado de baja. Consulte con Sublicuentas." });
    }catch(e){ console.error("LOGIN_RETIRADO_CHECK", e && e.message || e); }
    const uid = record.uid || `asesor-${key}`;
    const token = await admin.auth().createCustomToken(uid, {
      usuario:key,
      role:(key==='geisell' ? 'geisell_admin' : (record.role || "asesor"))
    });

    return res.status(200).json({ token, usuario:key, role:(key==='geisell' ? 'geisell_admin' : (record.role || "asesor")) });
  }catch(err){
    console.error("LOGIN_ERROR", err);
    return res.status(500).json({ error:"Error interno de autenticación" });
  }
};
