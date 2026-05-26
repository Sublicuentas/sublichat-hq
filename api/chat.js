const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require("@google/generative-ai");

export default async function handler(req, res) {
  try {
    if (!getApps().length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
      initializeApp({ credential: cert(serviceAccount) });
    }
    const db = getFirestore();
    const { consulta } = req.body;

    // Lógica de búsqueda inteligente
    // Si el usuario pregunta por un nombre, buscamos en la base de datos
    let contexto = "Información general de clientes.";
    const clientesRef = db.collection('clientes');
    const snapshot = await clientesRef.limit(20).get(); 
    
    let datos = [];
    snapshot.forEach(doc => datos.push(doc.data()));
    contexto = "Lista de clientes: " + JSON.stringify(datos);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `Eres Sublichat, secretario de Sublicuentas. 
    Aquí tienes datos de clientes: ${contexto}.
    Responde a la siguiente consulta del Licenciado, siendo muy preciso con los nombres: ${consulta}`;

    const result = await model.generateContent(prompt);
    res.status(200).json({ respuesta: result.response.text() });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
