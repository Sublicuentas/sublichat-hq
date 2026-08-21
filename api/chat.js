// api/chat.js  ·  VERSION 9  (Gemini 2.5 + auth + rate limit)
// 1) Sube este archivo en la carpeta /api de tu proyecto en Vercel.
// 2) En Vercel → Settings → Environment Variables agrega:  GEMINI_API_KEY = tu_key
//    (la sacas en https://aistudio.google.com/apikey)
// 3) Listo. El frontend ya le manda la pregunta + el contexto de tus clientes.
//
// ✅ v6: antes este endpoint no exigía sesión — cualquiera con la URL podía
// gastar la cuota de Gemini. Ahora exige el mismo token de Firebase (sesión
// del login) que usan finanzas.js / inventario.js / tickets.js, y limita
// cuántas preguntas puede hacer un mismo usuario por hora.

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
  if (!token) {
    res.status(401).json({ error: "Sesión requerida." });
    return null;
  }
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (_) {
    res.status(401).json({ error: "Sesión inválida o vencida." });
    return null;
  }
}

// Límite por usuario (no por IP): sobrevive a cualquier cantidad de
// instancias serverless porque queda en Firestore, no en memoria.
const CHAT_MAX_POR_HORA = 60;
async function checkChatLimit(db, uid) {
  const ref = db.collection("chat_rate_limit").doc(String(uid || "anon"));
  const now = Date.now();
  const HORA_MS = 60 * 60 * 1000;
  let bloqueado = false, retryAfterSeconds = 0;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists ? (snap.data() || {}) : {};
    const ventanaVencida = !d.desde || (now - d.desde) > HORA_MS;
    const conteo = ventanaVencida ? 1 : Number(d.conteo || 0) + 1;
    const desde = ventanaVencida ? now : d.desde;
    if (conteo > CHAT_MAX_POR_HORA) {
      bloqueado = true;
      retryAfterSeconds = Math.ceil((desde + HORA_MS - now) / 1000);
      return;
    }
    tx.set(ref, { conteo, desde, updatedAt: now }, { merge: true });
  });
  return { blocked: bloqueado, retryAfterSeconds };
}

export default async function handler(req, res) {
  const API_KEY = (process.env.GEMINI_API_KEY || "").trim();

  // Diagnóstico real: /api/chat?test=1
  if (req.method === "GET" && String(req.query?.test || "") === "1") {
    if (!API_KEY) {
      return res.status(500).json({
        ok: false,
        test: true,
        geminiConfigured: false,
        error: "GEMINI_API_KEY no está configurada."
      });
    }

    const model = process.env.GEMINI_REWRITE_MODEL || "gemini-2.5-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const startedAt = Date.now();

    try {
      const r = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY
        },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: "Responda únicamente: OK" }]
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 20,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      });

      let data = {};
      try { data = await r.json(); } catch (_) {}

      const latencyMs = Date.now() - startedAt;
      const text = (data?.candidates?.[0]?.content?.parts || [])
        .map(p => p?.text || "")
        .join("")
        .trim();

      if (!r.ok || data?.error) {
        return res.status(r.status || 502).json({
          ok: false,
          test: true,
          provider: "gemini",
          model,
          status: r.status || null,
          latencyMs,
          errorCode: data?.error?.code || null,
          errorStatus: data?.error?.status || null,
          error: data?.error?.message || `Gemini HTTP ${r.status}`
        });
      }

      return res.status(200).json({
        ok: true,
        test: true,
        provider: "gemini",
        model,
        status: r.status,
        latencyMs,
        response: text || "(sin texto)"
      });
    } catch (e) {
      const latencyMs = Date.now() - startedAt;
      if (e && e.name === "AbortError") {
        return res.status(504).json({
          ok: false,
          test: true,
          provider: "gemini",
          model,
          status: 504,
          latencyMs,
          error: "Timeout: Gemini no respondió dentro de 15 segundos."
        });
      }
      return res.status(500).json({
        ok: false,
        test: true,
        provider: "gemini",
        model,
        status: 500,
        latencyMs,
        error: e?.message || "Error desconocido al probar Gemini."
      });
    } finally {
      clearTimeout(timeout);
    }
  }


  // GET normal: solo muestra configuración/version.
  if (req.method !== "POST") return res.status(200).json({
    ok: true,
    version: 9,
    msg: "chat v9 activo. Use POST. Use ?test=1 para probar Gemini.",
    geminiConfigured: Boolean(API_KEY),
    defaultModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    rewriteModel: process.env.GEMINI_REWRITE_MODEL || "gemini-2.5-flash-lite"
  });

  let db;
  try {
    db = getApp().firestore();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const authUser = await requireFirebaseUser(req, res);
  if (!authUser) return; // requireFirebaseUser ya mandó la respuesta 401

  const limite = await checkChatLimit(db, authUser.uid);
  if (limite.blocked) {
    return res.status(429).json({ error: "Alcanzaste el límite de preguntas por hora. Probá de nuevo más tarde.", retryAfterSeconds: limite.retryAfterSeconds });
  }

  const { pregunta, hoy, clientes, mode } = req.body || {};
  if (!pregunta) return res.status(400).json({ error: "Falta la pregunta" });

  if (!API_KEY) return res.status(500).json({ error: "Falta GEMINI_API_KEY en Vercel" });

  // Contexto: le damos a Gemini los datos reales para que NO invente.
  const systemPrompt = `Eres "Subli", el asistente de operaciones de Sublicuentas, un negocio hondureño
de reventa de suscripciones (Netflix, Disney+, HBO Max, Prime Video, etc.).
Hablas en español de Honduras, claro y directo, usando "usted". La moneda es Lempiras (Lps).
Hoy es ${hoy}.

REGLAS IMPORTANTES:
- Eres una herramienta interna privada para el dueño del negocio. Los datos de abajo son del PROPIO negocio (su cartera de clientes). Por lo tanto SÍ puedes y DEBES dar teléfonos, correos, fechas y montos cuando te los pidan: son datos del negocio, no de terceros.
- Cuando te pregunten por un cliente por su nombre (aunque lo escriban incompleto o con acento distinto), búscalo de forma flexible: coincidencias parciales y sin distinguir mayúsculas/acentos. Por ejemplo "Heidy" debe encontrar "Heidy Martínez".
- Si encuentras varias coincidencias, lístalas todas con su teléfono para que el asesor elija.
- SOLO usas los datos que te paso abajo; nunca inventes clientes, teléfonos ni montos. Si de verdad no está, dilo.
- Para finanzas, suma los precios exactos. Para listados, ordénalos.

Cada cliente trae: nombre, tel (teléfono), vendedor (socio a cargo), y cuentas[] donde cada cuenta tiene:
plataforma, precio (Lps), renueva (fecha de renovación AAAA-MM-DD), estado, correo, clave y pinPerfil.
- clave = contraseña/acceso de la cuenta.
- pinPerfil = PIN del perfil cuando aplique.

DATOS DE LA CARTERA (JSON):
${JSON.stringify(clientes || [])}`;

  try {
    const isRewrite = String(mode || "").toLowerCase() === "rewrite";
    const model = isRewrite
      ? (process.env.GEMINI_REWRITE_MODEL || "gemini-2.5-flash-lite")
      : (process.env.GEMINI_MODEL || "gemini-2.5-flash");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), isRewrite ? 12000 : 20000);

    let r;
    try {
      r = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: pregunta }] }],
          generationConfig: {
            temperature: isRewrite ? 0.85 : 0.4,
            maxOutputTokens: isRewrite ? 600 : 2048,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      });
    } finally {
      clearTimeout(timeout);
    }

    let data = {};
    try { data = await r.json(); } catch (_) {}

    if (!r.ok || data.error) {
      const detail = data?.error?.message || `Gemini HTTP ${r.status}`;
      console.error("[api/chat] Gemini error:", { model, status: r.status, detail });
      return res.status(502).json({ error: detail, provider: "gemini", model });
    }
    const cand = data?.candidates?.[0];
    const respuesta =
      cand?.content?.parts?.map(p => p.text).join("") ||
      (cand?.finishReason ? "Gemini cortó la respuesta (" + cand.finishReason + ")." : "No obtuve respuesta de Gemini.");
    return res.status(200).json({ respuesta });
  } catch (e) {
    console.error("[api/chat]", e);
    if (e && e.name === "AbortError") {
      return res.status(504).json({ error: "Gemini tardó demasiado en responder. Intente nuevamente.", provider: "gemini" });
    }
    return res.status(500).json({ error: "Error al contactar Gemini: " + (e.message || "") });
  }
}
