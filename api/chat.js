const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inicialización segura de Firebase
if (!global.firebaseApp) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
  global.firebaseApp = initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

// Inicialización de Gemini Pro
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Solo POST');

  const { consulta } = req.body;

  try {
    // 1. Extraer contexto de clientes (Solo Lectura)
    const snapshot = await db.collection('clientes').limit(50).get();
    let contextoClientes = "Cartera de clientes actual:\n";
    snapshot.forEach(doc => {
      const d = doc.data();
      contextoClientes += `- ${d.nombre}: Vence ${d.vencimiento}, Pagado: ${d.total_pagado} Lps\n`;
    });

    // 2. Ejecutar IA con Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `Eres Sublichat, el secretario virtual de Sublicuentas. 
    REGLA DE ORO: Siempre trata a los clientes de "Usted" en tus respuestas.
    Contexto de la empresa: ${contextoClientes}
    Orden del Licenciado: ${consulta}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    res.status(200).json({ respuesta: response.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
