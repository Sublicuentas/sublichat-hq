// api/chat.js  ·  VERSION 12  (Gemini + reescritura breve + auth + rate limit)
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

// ───────────── Cifras exactas + formato limpio ─────────────
// El modelo NO debe sumar ni contar a ojo (se equivocaba y mezclaba el desorden): las cifras vienen calculadas aquí.
const TZ_HN = "America/Tegucigalpa";
function fechaHN(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ_HN, year: "numeric", month: "2-digit", day: "2-digit" }).format(d); // AAAA-MM-DD
}
function fechaLargaHN(iso) {
  const d = new Date(iso + "T12:00:00Z");
  return new Intl.DateTimeFormat("es-HN", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
}
const fmtLps = n => "Lps. " + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function diasEntre(hoyISO, iso) {
  const a = Date.parse(hoyISO + "T12:00:00Z"), b = Date.parse(String(iso || "").slice(0, 10) + "T12:00:00Z");
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86400000) : null;
}
function buildResumen(clientes, hoyISO) {
  const cuentas = [];
  const clientesSet = new Set();
  for (const c of Array.isArray(clientes) ? clientes : []) {
    clientesSet.add(String(c?.nombre || "") + "|" + String(c?.tel || ""));
    for (const q of Array.isArray(c?.cuentas) ? c.cuentas : []) {
      cuentas.push({ vendedor: String(q?.vendedor || c?.vendedor || "Sin vendedor"), plataforma: String(q?.plataforma || "—"), precio: Number(q?.precio) || 0, dias: diasEntre(hoyISO, q?.renueva) });
    }
  }
  const suma = l => l.reduce((t, x) => t + x.precio, 0);
  const bloque = l => ({ servicios: l.length, total: fmtLps(suma(l)) });
  const conFecha = cuentas.filter(x => x.dias !== null);
  const mesActual = hoyISO.slice(0, 7);
  const isoDe = dias => new Date(Date.parse(hoyISO + "T12:00:00Z") + dias * 86400000).toISOString().slice(0, 10);
  const delMes = conFecha.filter(x => isoDe(x.dias).slice(0, 7) === mesActual);
  const porClave = (fn, max) => {
    const m = new Map();
    for (const x of cuentas) { const k = fn(x); const e = m.get(k) || { servicios: 0, suma: 0 }; e.servicios++; e.suma += x.precio; m.set(k, e); }
    return [...m.entries()].sort((a, b) => b[1].suma - a[1].suma).slice(0, max).map(([nombre, e]) => ({ nombre, servicios: e.servicios, total: fmtLps(e.suma) }));
  };
  const proximosDias = [];
  for (let i = 0; i <= 7; i++) {
    const f = isoDe(i);
    proximosDias.push({ fecha: f, dia: fechaLargaHN(f), ...bloque(conFecha.filter(x => x.dias === i)) });
  }
  return {
    hoy: hoyISO,
    clientes: clientesSet.size,
    servicios: cuentas.length,
    vencen_hoy: bloque(conFecha.filter(x => x.dias === 0)),
    vencen_manana: bloque(conFecha.filter(x => x.dias === 1)),
    vencen_proximos_7_dias_sin_hoy: bloque(conFecha.filter(x => x.dias >= 1 && x.dias <= 7)),
    vencen_de_hoy_a_7_dias: bloque(conFecha.filter(x => x.dias >= 0 && x.dias <= 7)),
    vencidos_sin_renovar: bloque(conFecha.filter(x => x.dias < 0)),
    esperado_este_mes: bloque(delMes),
    por_dia_proximos_7_dias: proximosDias,
    por_plataforma_top: porClave(x => x.plataforma, 12),
    por_vendedor: porClave(x => x.vendedor, 15),
  };
}
// Deja la respuesta lista para pintarse: viñetas "- ", sin saltos de más.
function normalizarRespuesta(t) {
  return String(t || "")
    .replace(/\r\n?/g, "\n")
    .replace(/^[ \t]*[•·]\s+/gm, "- ")
    .replace(/^([ \t]*)\*(?!\*)\s+/gm, "$1- ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

    const model = process.env.GEMINI_REWRITE_MODEL || "gemini-3.1-flash-lite";
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
    version: 12,
    msg: "chat v12 activo. Use POST. Use ?test=1 para probar Gemini.",
    geminiConfigured: Boolean(API_KEY),
    defaultModel: process.env.GEMINI_MODEL || "gemini-3.5-flash",
    rewriteModel: process.env.GEMINI_REWRITE_MODEL || "gemini-3.1-flash-lite"
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

  const isRewrite = String(mode || "").toLowerCase() === "rewrite";
  // La fecha viene del servidor (Honduras): el teléfono/navegador mandaba la fecha UTC y desde las 6 p. m. ya era "mañana".
  const hoyISO = fechaHN();
  const resumen = isRewrite ? null : buildResumen(clientes, hoyISO);
  // Contexto: le damos a Gemini los datos reales para que NO invente.
  const systemPrompt = isRewrite ? `Eres especialista en mensajes breves de renovación para Sublicuentas.
Tu única tarea es reescribir un mensaje de entretenimiento premium para WhatsApp.

REGLAS OBLIGATORIAS:
- Devuelva exactamente 2 líneas cortas y no más de 300 caracteres en total.
- Use "usted", español natural de Honduras, tono cordial y comercial.
- Incluya de 2 a 4 emojis y negrita de WhatsApp con asteriscos.
- Conserve exactamente cliente, servicios, fecha y costo indicados por el usuario.
- No invente promociones ni datos.
- Nunca agregue cuentas bancarias, transferencias, depósitos, tarjetas, comprobantes, instrucciones ni métodos de pago.
- Devuelva únicamente el mensaje, sin título, explicación, lista ni saludo adicional.` : `Eres "Subli", el asistente de operaciones de Sublicuentas, un negocio hondureño
de reventa de suscripciones (Netflix, Disney+, HBO Max, Prime Video, etc.).
Hablas en español de Honduras, claro y directo, usando "usted". La moneda es Lempiras (Lps).
Hoy es ${fechaLargaHN(hoyISO)} (${hoyISO}).

REGLAS IMPORTANTES:
- Eres una herramienta interna privada para el dueño del negocio. Los datos de abajo son del PROPIO negocio (su cartera de clientes). Por lo tanto SÍ puedes y DEBES dar teléfonos, correos, fechas y montos cuando te los pidan: son datos del negocio, no de terceros.
- Cuando te pregunten por un cliente por su nombre (aunque lo escriban incompleto o con acento distinto), búscalo de forma flexible: coincidencias parciales y sin distinguir mayúsculas/acentos. Por ejemplo "Heidy" debe encontrar "Heidy Martínez".
- Si encuentras varias coincidencias, lístalas todas con su teléfono para que el asesor elija.
- SOLO usas los datos que te paso abajo; nunca inventes clientes, teléfonos ni montos. Si de verdad no está, dilo.
- Para finanzas y conteos usa SIEMPRE las cifras del RESUMEN PRECALCULADO de abajo: ya están calculadas con exactitud. No las recalcules ni las cambies.
- Para listados, ordénalos (por fecha de renovación y luego por nombre).

FORMATO DE RESPUESTA (obligatorio; se lee en un teléfono, debe verse profesional y ordenado):
1. Primera línea: el resultado clave en **negrita** (ej.: **8 cuentas vencen hoy** · total **Lps. 1,050.00**).
2. Después una lista con viñetas "- ". Si conviene, agrupe con encabezados "### " (por día, plataforma o vendedor) indicando cuántas cuentas y cuánto suman.
3. Cada cuenta en UNA sola viñeta corta: **Nombre** · 8798-9267 · Netflix Premium VIP · Lps. 110.00. Nada de asteriscos sueltos ni texto repetido.
4. Máximo 15 viñetas por lista. Si hay más, muestre las 15 primeras y cierre con "… y N más. ¿Desea el detalle por vendedor o por día?".
5. Sin tablas, sin bloques de código, sin repetir la pregunta y sin disculpas. Breve: máximo ~150 palabras salvo que pidan detalle.
6. Si la pregunta es ambigua (por ejemplo "esta semana" sin fechas), asuma los próximos 7 días desde hoy, dígalo en una frase y responda igual.

Cada cliente trae: nombre, tel (teléfono), vendedor (socio a cargo), y cuentas[] donde cada cuenta tiene:
plataforma, precio (Lps), renueva (fecha de renovación AAAA-MM-DD), estado, correo, clave y pinPerfil.
- clave = contraseña/acceso de la cuenta.
- pinPerfil = PIN del perfil cuando aplique.

RESUMEN PRECALCULADO (cifras exactas, JSON):
${JSON.stringify(resumen)}

DATOS DE LA CARTERA (JSON):
${JSON.stringify(clientes || [])}`;

  try {
    const model = isRewrite
      ? (process.env.GEMINI_REWRITE_MODEL || "gemini-3.1-flash-lite")
      : (process.env.GEMINI_MODEL || "gemini-3.5-flash");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), isRewrite ? 8000 : 20000);

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
            temperature: isRewrite ? 1.0 : 0.4,
            maxOutputTokens: isRewrite ? 160 : 2048,
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
    return res.status(200).json({ respuesta: isRewrite ? respuesta : normalizarRespuesta(respuesta) });
  } catch (e) {
    console.error("[api/chat]", e);
    if (e && e.name === "AbortError") {
      return res.status(504).json({ error: "Gemini tardó demasiado en responder. Intente nuevamente.", provider: "gemini" });
    }
    return res.status(500).json({ error: "Error al contactar Gemini: " + (e.message || "") });
  }
}
