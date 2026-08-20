// api/login.js
// Backend seguro para Sublichat: usuario + clave sin exponer correos ni contraseñas en el HTML.
// Requiere variables de entorno en Vercel:
// FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, AUTH_USERS_JSON
//
// AUTH_USERS_JSON ejemplo:
// {"libni":{"uid":"asesor-libni","role":"asesor","passwordHash":"pbkdf2$120000$SAL$HASH"},"naara":{"uid":"asesor-naara","role":"asesor","passwordHash":"pbkdf2$120000$SAL$HASH"}}

const crypto = require("crypto");
const admin = require("firebase-admin");

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
const LOGIN_MAX_FALLOS = 8;
const LOGIN_VENTANA_MS = 15 * 60 * 1000;
const LOGIN_BLOQUEO_MS = 15 * 60 * 1000;

function throttleKey(usuario){
  const k = String(usuario || "").trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "_").slice(0, 120);
  return "sublichat_" + (k || "desconocido");
}

async function checkThrottle(db, usuario){
  const snap = await db.collection("login_attempts").doc(throttleKey(usuario)).get();
  if(!snap.exists) return { blocked:false };
  const d = snap.data() || {};
  const now = Date.now();
  if((d.bloqueadoHasta || 0) > now){
    return { blocked:true, retryAfterSeconds: Math.ceil((d.bloqueadoHasta - now) / 1000) };
  }
  return { blocked:false };
}

async function registerFailure(db, usuario){
  const ref = db.collection("login_attempts").doc(throttleKey(usuario));
  try{
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const d = snap.exists ? (snap.data() || {}) : {};
      const ventanaVencida = !d.primerFalloEn || (now - d.primerFalloEn) > LOGIN_VENTANA_MS;
      const fallos = ventanaVencida ? 1 : Number(d.fallos || 0) + 1;
      const primerFalloEn = ventanaVencida ? now : d.primerFalloEn;
      const patch = { fallos, primerFalloEn, updatedAt: now };
      if(fallos >= LOGIN_MAX_FALLOS) patch.bloqueadoHasta = now + LOGIN_BLOQUEO_MS;
      tx.set(ref, patch, { merge:true });
    });
  }catch(_){ /* el throttle nunca debe tumbar el login por un error transitorio */ }
}

async function clearThrottle(db, usuario){
  await db.collection("login_attempts").doc(throttleKey(usuario)).delete().catch(() => {});
}

module.exports = async function handler(req, res){
  if(req.method !== "POST"){
    return res.status(405).json({ error:"Método no permitido" });
  }

  try{
    initAdmin();
    const db = admin.firestore();

    const { usuario, clave } = req.body || {};
    const key = String(usuario || "").trim().toLowerCase();

    if(!key || !clave){
      return res.status(400).json({ error:"Usuario y clave requeridos" });
    }

    const throttle = await checkThrottle(db, key);
    if(throttle.blocked){
      return res.status(429).json({ error:"Demasiados intentos. Probá de nuevo en unos minutos.", retryAfterSeconds: throttle.retryAfterSeconds });
    }

    const users = JSON.parse(process.env.AUTH_USERS_JSON || "{}");
    const record = users[key];

    if(!record || !verifyPassword(clave, record.passwordHash)){
      await registerFailure(db, key);
      // Misma respuesta para usuario inexistente o clave mala.
      return res.status(401).json({ error:"Acceso no autorizado" });
    }

    await clearThrottle(db, key);
    const uid = record.uid || `asesor-${key}`;
    const token = await admin.auth().createCustomToken(uid, {
      usuario:key,
      role:record.role || "asesor"
    });

    return res.status(200).json({ token, usuario:key, role:record.role || "asesor" });
  }catch(err){
    console.error("LOGIN_ERROR", err);
    return res.status(500).json({ error:"Error interno de autenticación" });
  }
};
