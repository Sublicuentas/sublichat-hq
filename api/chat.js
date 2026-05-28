// api/chat.js  ·  Función serverless para Vercel (protege tu API key de Gemini)
// 1) Sube este archivo en la carpeta /api de tu proyecto en Vercel.
// 2) En Vercel → Settings → Environment Variables agrega:  GEMINI_API_KEY = tu_key
//    (la sacas en https://aistudio.google.com/apikey)
// 3) Listo. El frontend ya le manda la pregunta + el contexto de tus clientes.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const { pregunta, hoy, clientes } = req.body || {};
  if (!pregunta) return res.status(400).json({ error: "Falta la pregunta" });

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "Falta GEMINI_API_KEY en Vercel" });

  // Contexto: le damos a Gemini los datos reales para que NO invente.
  const systemPrompt = `Eres "Sublichat", el asistente analítico de Sublicuentas, un negocio hondureño
de reventa de suscripciones (Netflix, Disney+, HBO Max, Prime Video, etc.).
Hablas en español de Honduras, claro y directo, usando "usted". La moneda es Lempiras (Lps).
Hoy es ${hoy}. SOLO usas los datos que te paso abajo; nunca inventes clientes ni montos.
Si te piden listados, hazlos ordenados. Si piden finanzas, suma los precios exactos.
Datos de clientes (n=nombre, p=plataforma, $=precio en Lps, d=fecha renovación, e=estado):
${JSON.stringify(clientes || [])}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: pregunta }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 800 }
      })
    });
    const data = await r.json();
    const respuesta =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") ||
      "No obtuve respuesta de Gemini.";
    return res.status(200).json({ respuesta });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error al contactar Gemini" });
  }
}
