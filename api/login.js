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

module.exports = async function handler(req, res){
  if(req.method !== "POST"){
    return res.status(405).json({ error:"Método no permitido" });
  }

  try{
    initAdmin();

    const { usuario, clave } = req.body || {};
    const key = String(usuario || "").trim().toLowerCase();

    if(!key || !clave){
      return res.status(400).json({ error:"Usuario y clave requeridos" });
    }

    const users = JSON.parse(process.env.AUTH_USERS_JSON || "{}");
    const record = users[key];

    if(!record || !verifyPassword(clave, record.passwordHash)){
      // Misma respuesta para usuario inexistente o clave mala.
      return res.status(401).json({ error:"Acceso no autorizado" });
    }

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
