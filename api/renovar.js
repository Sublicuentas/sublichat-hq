// api/renovar.js  ·  VERSION 5  ·  Renueva la fecha de un servicio en Firestore (escritura segura)
//
// Usa Firebase Admin con una cuenta de servicio (clave privada), NO el config público.
// Así el navegador nunca escribe directo: solo este servidor puede modificar datos.
//
// CONFIGURAR EN VERCEL (Environment Variables):
//   FIREBASE_PROJECT_ID      = sublicuentasbot
//   FIREBASE_CLIENT_EMAIL    = (del JSON de cuenta de servicio)
//   FIREBASE_PRIVATE_KEY     = (del JSON; pegar con los \n tal cual)
//
// Cómo obtener la cuenta de servicio:
//   Firebase Console → ⚙️ Configuración del proyecto → Cuentas de servicio
//   → "Generar nueva clave privada" → descarga un JSON con project_id, client_email, private_key.

import admin from "firebase-admin";

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  // En Vercel la private key suele venir con \n escapados
  privateKey = privateKey.replace(/\\n/g, "\n");
  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
}

// Suma días a una fecha en formato DD/MM/YYYY y devuelve igual DD/MM/YYYY
function sumarDias(fechaStr, dias) {
  const [d, m, y] = String(fechaStr).split("/").map(n => parseInt(n, 10));
  const base = new Date(y, m - 1, d);
  base.setDate(base.getDate() + dias);
  const dd = String(base.getDate()).padStart(2, "0");
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${base.getFullYear()}`;
}

// Ajusta los cupos de una cuenta del inventario buscándola por correo.
// modo "ocupar": suma el cliente y descuenta 1 disponible.
// modo "liberar": quita el cliente y suma 1 disponible.
// Si el correo no existe en inventario (ej: IPTV/Oleada/Canva creados al momento), no hace nada.
async function ajustarInventario(db, { modo, correo, nombreCliente, pin }) {
  if (!correo) return { tocado: false, motivo: "sin correo" };
  try {
    const invSnap = await db.collection("inventario").where("correo", "==", correo).get();
    if (invSnap.empty) return { tocado: false, motivo: "correo no está en inventario" };
    const ref = invSnap.docs[0].ref;
    const data = invSnap.docs[0].data();
    let clientes = Array.isArray(data.clientes) ? [...data.clientes] : [];
    const cap = Number(data.capacidad) || 0;

    if (modo === "ocupar") {
      // siguiente slot libre
      const usados = clientes.map(c => Number(c.slot) || 0);
      let slot = 1; while (usados.includes(slot)) slot++;
      clientes.push({ nombre: nombreCliente || "—", pin: pin || "", slot });
    } else if (modo === "liberar") {
      // saca la primera coincidencia por nombre (o por pin si coincide)
      const i = clientes.findIndex(c => (nombreCliente && c.nombre === nombreCliente));
      if (i !== -1) clientes.splice(i, 1);
      else if (clientes.length) clientes.pop(); // fallback: saca el último
    }

    const ocupados = clientes.length;
    const disponibles = Math.max(0, cap - ocupados);
    const update = {
      clientes,
      ocupados,
      disponibles,
      updatedAt: new Date().toISOString()
    };
    if (data.disp != null) update.disp = disponibles; // mantener campo alterno si existe
    await ref.update(update);
    return { tocado: true, ocupados, disponibles };
  } catch (e) {
    return { tocado: false, motivo: e.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(200).json({ ok: true, version: 5, msg: "renovar v5 activo. Usá POST." });

  const body = req.body || {};
  const { accion, clienteNorm, telefono, plataforma } = body;
  const acc = accion || "renovar"; // compatibilidad: sin accion = renovar

  if (!clienteNorm && !telefono)
    return res.status(200).json({ error: "Falta identificar el cliente." });

  try {
    const db = getApp().firestore();
    let query = db.collection("clientes");
    let snap;
    if (clienteNorm) snap = await query.where("nombre_norm", "==", clienteNorm).get();
    if ((!snap || snap.empty) && telefono) snap = await query.where("telefono", "==", telefono).get();
    if (!snap || snap.empty)
      return res.status(200).json({ error: "No encontré ese cliente en la base." });

    const docRef = snap.docs[0].ref;
    const data = snap.docs[0].data();
    let servicios = Array.isArray(data.servicios) ? data.servicios : [];

    // Convierte YYYY-MM-DD (calendario) -> DD/MM/YYYY (formato Firebase)
    const aFechaFB = f => { if(!f) return ""; if(f.includes("/")) return f; const [y,m,d]=f.split("-"); return `${d}/${m}/${y}`; };

    let invResult = null;

    if (acc === "renovar") {
      const { dias, fechaActual, fechaExacta } = body;
      if (!plataforma || (!dias && !fechaExacta))
        return res.status(200).json({ error: "Faltan datos (plataforma o fecha)." });
      let cambiados = 0;
      servicios = servicios.map(s => {
        if (s.plataforma === plataforma) {
          cambiados++;
          let nuevaFecha = fechaExacta ? aFechaFB(fechaExacta) : sumarDias(s.fechaRenovacion || fechaActual, parseInt(dias, 10));
          return { ...s, fechaRenovacion: nuevaFecha };
        }
        return s;
      });
      if (!cambiados) return res.status(200).json({ error: "No encontré esa plataforma en el cliente." });

    } else if (acc === "eliminar") {
      if (!plataforma) return res.status(200).json({ error: "Falta la plataforma a eliminar." });
      // elimina solo la primera coincidencia de esa plataforma (por si hay varias)
      const idx = servicios.findIndex(s => s.plataforma === plataforma);
      if (idx === -1) return res.status(200).json({ error: "No encontré esa plataforma en el cliente." });
      const servEliminado = servicios[idx];
      servicios = servicios.filter((_, i) => i !== idx);
      // liberar cupo en inventario si ese servicio tenía correo
      invResult = await ajustarInventario(db, {
        modo: "liberar",
        correo: servEliminado.correo,
        nombreCliente: data.nombrePerfil || data.nombre || ""
      });

    } else if (acc === "agregar") {
      const { servicio } = body;
      if (!servicio || !servicio.plataforma) return res.status(200).json({ error: "Faltan datos del servicio nuevo." });
      const nuevo = {
        plataforma: servicio.plataforma,
        precio: Number(servicio.precio) || 0,
        fechaRenovacion: aFechaFB(servicio.fechaRenovacion || ""),
        correo: servicio.correo || "",
        pin: servicio.pin || ""
      };
      servicios = [...servicios, nuevo];
      // ocupar cupo en inventario si el correo existe ahí
      invResult = await ajustarInventario(db, {
        modo: "ocupar",
        correo: nuevo.correo,
        nombreCliente: data.nombrePerfil || data.nombre || "",
        pin: nuevo.pin
      });

    } else if (acc === "editar") {
      const { plataformaOriginal, servicio } = body;
      const buscar = plataformaOriginal || plataforma;
      if (!buscar || !servicio) return res.status(200).json({ error: "Faltan datos para editar." });
      const idx = servicios.findIndex(s => s.plataforma === buscar);
      if (idx === -1) return res.status(200).json({ error: "No encontré ese servicio." });
      servicios[idx] = {
        plataforma: servicio.plataforma || servicios[idx].plataforma,
        precio: servicio.precio != null ? Number(servicio.precio) : servicios[idx].precio,
        fechaRenovacion: servicio.fechaRenovacion ? aFechaFB(servicio.fechaRenovacion) : servicios[idx].fechaRenovacion,
        correo: servicio.correo != null ? servicio.correo : (servicios[idx].correo || ""),
        pin: servicio.pin != null ? servicio.pin : (servicios[idx].pin || "")
      };

    } else {
      return res.status(200).json({ error: "Acción no reconocida." });
    }

    await docRef.update({ servicios, updatedAt: new Date().toISOString() });
    return res.status(200).json({ ok: true, accion: acc, totalServicios: servicios.length, inventario: invResult });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ error: "Error: " + (e.message || "") });
  }
}
