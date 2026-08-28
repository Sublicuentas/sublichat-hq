// detectar_clientes_fusionados.js
//
// 🚨 Script de SOLO LECTURA (no modifica nada) para el incidente de ago-2026:
// clientes de distintos vendedores con el mismo nombre (ej. "Karina Castillo"
// de Geisell y "Karina Castillo" de Relojes) que quedaron fusionados en UN
// SOLO documento de Firestore, porque el ID del documento se generaba solo
// a partir del nombre, sin el vendedor (ver api/renovar.js, función
// findCliente + ficha_upsert, ya corregido).
//
// Cómo detecta candidatos:
//   Antes del fix, un cliente nuevo se guardaba con ID = safeDocId(nombre).
//   Después del fix, un cliente nuevo se guarda con ID = safeDocId(nombre + "-" + vendedor).
//   Entonces, cualquier documento que:
//     (a) tenga un ID que coincide EXACTO con safeDocId(su propio nombre) — es decir,
//         fue creado bajo el esquema viejo, sin vendedor en el ID — Y
//     (b) tenga 2 o más servicios distintos
//   es CANDIDATO a ser una fusión, porque bajo el esquema viejo cualquier
//   vendedor que escribiera ese mismo nombre habría caído en ese mismo
//   documento.
//
// Esto NO es una certeza matemática (un cliente real puede legítimamente
// tener 2+ servicios comprados todos por el mismo vendedor) — es una LISTA
// PARA REVISAR A MANO, priorizada por lo más sospechoso primero. No borra
// ni modifica nada.
//
// Uso:
//   FIREBASE_PROJECT_ID=... FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY=... \
//     node detectar_clientes_fusionados.js
//
// (mismas variables que ya usa api/renovar.js en Vercel)

import admin from "firebase-admin";

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  privateKey = privateKey.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error("❌ Faltan variables de entorno: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.");
    process.exit(1);
  }
  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
}

// Copia exacta de safeDocId() en api/renovar.js — debe coincidir con la real
// para que la comparación de IDs tenga sentido.
function safeDocId(v) {
  const x = String(v || "cliente")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return x || "cliente";
}

function normName(v) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const app = getApp();
  const db = app.firestore();

  console.log("🔎 Escaneando colección 'clientes' (solo lectura)...\n");
  const snap = await db.collection("clientes").get();
  console.log(`Total de documentos: ${snap.size}\n`);

  const candidatos = [];
  const porNombre = new Map(); // nombreNorm -> [docs]

  snap.forEach((doc) => {
    const data = doc.data() || {};
    const nombre = data.nombrePerfil || data.nombre || "";
    const nombreNorm = data.nombre_norm || normName(nombre);
    const servicios = Array.isArray(data.servicios) ? data.servicios : [];
    const idViejoEsperado = safeDocId(nombreNorm);

    if (!porNombre.has(nombreNorm)) porNombre.set(nombreNorm, []);
    porNombre.get(nombreNorm).push({ id: doc.id, vendedor: data.vendedor || "", servicios: servicios.length });

    if (doc.id === idViejoEsperado && servicios.length >= 2) {
      // Señales adicionales para priorizar (no son prueba, solo pistas):
      const correosDistintos = new Set(servicios.map(s => String(s?.correo || "").trim().toLowerCase()).filter(Boolean));
      const plataformasDistintas = new Set(servicios.map(s => String(s?.plataforma || "").trim().toLowerCase()).filter(Boolean));
      const perfilesDistintos = new Set(servicios.map(s => String(s?.perfil || "").trim().toLowerCase()).filter(Boolean));

      candidatos.push({
        docId: doc.id,
        nombre,
        vendedor: data.vendedor || "(sin vendedor)",
        totalServicios: servicios.length,
        plataformas: Array.from(plataformasDistintas).join(", "),
        correosDistintos: correosDistintos.size,
        perfilesDistintosEnServicios: perfilesDistintos.size,
      });
    }
  });

  // También: nombres que hoy aparecen en más de un documento (esto es
  // esperado y CORRECTO después del fix — cada vendedor tiene el suyo
  // separado — pero vale la pena mostrarlo para que se pueda verificar
  // que cada uno tiene el vendedor correcto).
  const nombresRepetidos = Array.from(porNombre.entries()).filter(([, docs]) => docs.length > 1);

  candidatos.sort((a, b) => b.totalServicios - a.totalServicios);

  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`🚨 CANDIDATOS A FICHA FUSIONADA (ID viejo sin vendedor + 2+ servicios): ${candidatos.length}`);
  console.log(`═══════════════════════════════════════════════════════════\n`);

  if (!candidatos.length) {
    console.log("✅ No encontré documentos con ID del esquema viejo Y 2+ servicios.\n");
  } else {
    candidatos.forEach((c, i) => {
      console.log(`${i + 1}) doc: ${c.docId}`);
      console.log(`   Nombre: ${c.nombre}  |  Vendedor actual guardado: ${c.vendedor}`);
      console.log(`   Servicios: ${c.totalServicios}  |  Plataformas: ${c.plataformas}`);
      console.log(`   Correos distintos entre servicios: ${c.correosDistintos}  |  Perfiles distintos: ${c.perfilesDistintosEnServicios}`);
      console.log(`   👉 Revisar a mano: ¿todos esos servicios los vendió "${c.vendedor}", o hay alguno que en realidad es de otro vendedor?\n`);
    });
  }

  console.log(`═══════════════════════════════════════════════════════════`);
  console.log(`ℹ️  Nombres que hoy aparecen en más de un documento: ${nombresRepetidos.length}`);
  console.log(`   (normal y correcto tras el fix, si cada uno es de un vendedor distinto)`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
  nombresRepetidos.slice(0, 30).forEach(([nombreNorm, docs]) => {
    console.log(`• "${nombreNorm}" → ${docs.map(d => `${d.id} (vendedor: ${d.vendedor || "-"}, ${d.servicios} serv.)`).join("  |  ")}`);
  });
  if (nombresRepetidos.length > 30) console.log(`…y ${nombresRepetidos.length - 30} más.`);

  console.log(`\nListo. Este script no modificó nada.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ ERROR:", e.message || e);
  console.error("Verifique las variables FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.");
  process.exit(1);
});
