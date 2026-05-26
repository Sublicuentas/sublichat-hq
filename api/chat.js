const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require("@google/generative-ai");

export default async function handler(req, res) {
  try {
    // 1. Carga segura de credenciales
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
    if (!global.firebaseApp) {
      initializeApp({ credential: cert(serviceAccount) });
    }
    const db = getFirestore();
    
    // 2. Configuración Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // 3. Ejecución
    const result = await model.generateContent("Hola, Sublichat, confirma que estás activo.");
    res.status(200).json({ respuesta: "Sistema activo, Lic. Esperando sus órdenes." });
    
  } catch (error) {
    // Esto es lo que nos dirá el error real en pantalla
    res.status(500).json({ error: "Error de conexión: " + error.message });
  }
}
