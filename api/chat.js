// Este es el puente que conecta su consulta con sus datos
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const OpenAI = require('openai');

// Inicializamos con el .json que usted tiene
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Aquí programamos al asistente con su regla inquebrantable
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  const { consulta } = req.body;
  
  // 1. Consultar a Firebase (Solo lectura)
  const snapshot = await db.collection('clientes').get();
  
  // 2. Enviar a OpenAI con la instrucción de tratar a los clientes de "usted"
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Eres el secretario virtual de Sublicuentas. Siempre redacta mensajes tratanto a los clientes de usted. Tu trabajo es analizar datos de Firebase y buscar información." },
      { role: "user", content: consulta }
    ]
  });

  res.status(200).json({ respuesta: completion.choices[0].message.content });
}
