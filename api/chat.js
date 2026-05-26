const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require("@google/generative-ai");

export default async function handler(req, res) {
  try {
    // 1. Inicialización segura de Firebase (el "seguro" contra errores)
    if (!getApps().length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
      initializeApp({ credential: cert(serviceAccount) });
    }
    const db = getFirestore();
    
    // 2. Configuración de Gemini actualizada (modelo activo)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 3. Ejecución
    const { consulta } = req.body;
    const result = await model.generateContent("Eres Sublichat. Responde brevemente y siempre de usted: " + consulta);
    const response = await result.response;
    
    res.status(200).json({ respuesta: response.text() });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
