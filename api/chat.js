// api/chat.js  ·  VERSION 7  (Gemini 2.5 + reglas de clave/PIN por plataforma)
// 1) Sube este archivo en la carpeta /api de tu proyecto en Vercel.
// 2) En Vercel → Settings → Environment Variables agrega:  GEMINI_API_KEY = tu_key
//    (la sacas en https://aistudio.google.com/apikey)
// 3) Listo. El frontend ya le manda la pregunta + el contexto de tus clientes.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).json({ ok: true, version: 7, msg: "chat v7 activo. Usá POST." });

  const { pregunta, hoy, clientes } = req.body || {};
  if (!pregunta) return res.status(400).json({ error: "Falta la pregunta" });

  const API_KEY = (process.env.GEMINI_API_KEY || "").trim();
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
- clave = contraseña/acceso de la cuenta cuando aplique.
- pinPerfil = PIN del perfil cuando aplique.
- Reglas de ficha/CRM:
  * Netflix Premium, HBO Max, Disney Premium, Disney Standard, Crunchyroll, Prime Video y Universal+ llevan correo + clave + PIN.
  * Netflix VIP, Spotify, YouTube, Deezer, Office 365, Oleada e IPTV llevan correo/usuario + clave, sin PIN.
  * ViX+, Canva, Gemini, ChatGPT y Duolingo llevan solo correo, sin clave ni PIN.

DATOS DE LA CARTERA (JSON):
${JSON.stringify(clientes || [])}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: pregunta }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } }
      })
    });
    const data = await r.json();

    // Si Gemini devuelve un error, lo mostramos en vez de quedarnos callados
    if (data.error) {
      return res.status(200).json({ respuesta: "Gemini: " + (data.error.message || "error desconocido") });
    }
    const cand = data?.candidates?.[0];
    const respuesta =
      cand?.content?.parts?.map(p => p.text).join("") ||
      (cand?.finishReason ? "Gemini cortó la respuesta (" + cand.finishReason + ")." : "No obtuve respuesta de Gemini.");
    return res.status(200).json({ respuesta });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error al contactar Gemini: " + (e.message || "") });
  }
}
