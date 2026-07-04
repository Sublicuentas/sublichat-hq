// api/renovar.js  ·  VERSION 8  ·  Renovar + gestionar servicios + ficha CRM/WhatsApp upsert
//
// Usa Firebase Admin con una cuenta de servicio (clave privada), NO el config público.
// Variables en Vercel:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY

import admin from "firebase-admin";

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
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

function normPlat(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normName(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

function normPhone(v) {
  return String(v || "").replace(/\D/g, "");
}

function safeDocId(v) {
  const x = String(v || "cliente")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return x || "cliente";
}

function aFechaFB(f) {
  if (!f) return "";
  const s = String(f);
  if (s.includes("/")) return s;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

function isoNow() {
  return new Date().toISOString();
}

// Ajusta los cupos de una cuenta del inventario buscándola por correo.
// modo "ocupar": suma el cliente y descuenta 1 disponible.
// modo "liberar": quita el cliente y suma 1 disponible.
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
      const ya = clientes.some(c => normName(c.nombre) === normName(nombreCliente) && (!pin || String(c.pin || "") === String(pin || "")));
      if (!ya) {
        const usados = clientes.map(c => Number(c.slot) || 0);
        let slot = 1; while (usados.includes(slot)) slot++;
        clientes.push({ nombre: nombreCliente || "—", pin: pin || "", slot });
      }
    } else if (modo === "liberar") {
      const i = clientes.findIndex(c => (nombreCliente && normName(c.nombre) === normName(nombreCliente)));
      if (i !== -1) clientes.splice(i, 1);
      else if (clientes.length) clientes.pop();
    }

    const ocupados = clientes.length;
    const disponibles = Math.max(0, cap - ocupados);
    const update = {
      clientes,
      ocupados,
      disponibles,
      updatedAt: isoNow()
    };
    if (data.disp != null) update.disp = disponibles;
    await ref.update(update);
    return { tocado: true, ocupados, disponibles };
  } catch (e) {
    return { tocado: false, motivo: e.message };
  }
}

async function findCliente(db, { clienteNorm, telefono, nombrePerfil }) {
  let snap = null;
  const t = normPhone(telefono);
  const n = clienteNorm || normName(nombrePerfil);

  if (n) {
    snap = await db.collection("clientes").where("nombre_norm", "==", n).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }

  if (telefono) {
    snap = await db.collection("clientes").where("telefono", "==", telefono).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }

  if (t) {
    snap = await db.collection("clientes").where("telefono_norm", "==", t).limit(1).get();
    if (!snap.empty) return snap.docs[0];

    // Compatibilidad con bases viejas que no tienen telefono_norm.
    const all = await db.collection("clientes").limit(1200).get();
    const hit = all.docs.find(d => normPhone(d.data().telefono) === t);
    if (hit) return hit;
  }

  return null;
}

function buildServicio(servicio = {}, fichaTexto = "") {
  // Modelo limpio del CRM:
  //   clave     = contraseña/acceso de la cuenta
  //   pinPerfil = PIN del perfil cuando aplique
  // No se vuelve a escribir el campo "pin" para evitar duplicados/confusión.
  const tieneClaveNueva =
    servicio.clave != null || servicio.password != null || servicio.contrasena != null || servicio.pinClave != null;

  const clave = servicio.clave != null
    ? String(servicio.clave || "")
    : String(servicio.password || servicio.contrasena || servicio.pinClave || (!tieneClaveNueva ? servicio.pin || "" : ""));

  const pinPerfil = servicio.pinPerfil != null
    ? String(servicio.pinPerfil || "")
    : String(servicio.pin_perfil || servicio.perfilPin || (tieneClaveNueva && servicio.pin != null ? servicio.pin || "" : ""));

  const out = {
    plataforma: servicio.plataforma || "",
    precio: Number(servicio.precio) || 0,
    fechaRenovacion: aFechaFB(servicio.fechaRenovacion || ""),
    correo: servicio.correo || "",
    clave,
    pinPerfil,
    perfil: servicio.perfil || "",
    updatedAt: isoNow()
  };

  if (fichaTexto) {
    out.fichaTexto = fichaTexto;
    out.fichaActualizadaAt = isoNow();
  }
  return out;
}

function limpiarServicioCRM(servicio = {}) {
  const s = { ...servicio };
  const tieneClave = s.clave != null && String(s.clave) !== "";

  if ((s.pinPerfil == null || s.pinPerfil === "") && s.pin_perfil != null) s.pinPerfil = s.pin_perfil;
  if ((s.pinPerfil == null || s.pinPerfil === "") && s.perfilPin != null) s.pinPerfil = s.perfilPin;

  // Bases antiguas: "pin" era la clave. Versiones intermedias: "pin" pudo ser PIN de perfil.
  if (!tieneClave && s.pin != null) s.clave = String(s.pin || "");
  if (tieneClave && (s.pinPerfil == null || s.pinPerfil === "") && s.pin != null) s.pinPerfil = String(s.pin || "");

  if (s.pinPerfil == null) s.pinPerfil = "";
  delete s.pin;
  delete s.pin_perfil;
  delete s.perfilPin;
  delete s.pinClave;
  return s;
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(200).json({ ok: true, version: 9, msg: "renovar v9 activo. Usá POST." });

  const body = req.body || {};
  const { accion, clienteNorm, telefono, plataforma } = body;
  const acc = accion || "renovar";

  if (!clienteNorm && !telefono && acc !== "ficha_upsert")
    return res.status(200).json({ error: "Falta identificar el cliente." });

  try {
    const db = getApp().firestore();

    // NUEVO: crear o actualizar cliente + servicio desde el panel de entrega de ficha.
    if (acc === "ficha_upsert") {
      const cliente = body.cliente || {};
      const servicio = body.servicio || {};
      const nombrePerfil = cliente.nombrePerfil || cliente.nombre || body.nombrePerfil || "";
      const tel = cliente.telefono || telefono || "";
      const vendedor = cliente.vendedor || body.vendedor || "";
      const nNorm = cliente.nombre_norm || clienteNorm || normName(nombrePerfil);
      const tNorm = normPhone(tel);

      if (!nombrePerfil && !tel) return res.status(200).json({ error: "Ponga nombre o teléfono del cliente." });
      if (!servicio.plataforma) return res.status(200).json({ error: "Falta la plataforma de la ficha." });

      let doc = await findCliente(db, { clienteNorm: nNorm, telefono: tel, nombrePerfil });
      let docRef, data = {}, created = false;

      if (doc) {
        docRef = doc.ref;
        data = doc.data() || {};
      } else {
        created = true;
        const idBase = tNorm ? `tel-${tNorm}` : safeDocId(nNorm || nombrePerfil);
        docRef = db.collection("clientes").doc(idBase);
        const existing = await docRef.get();
        if (existing.exists) {
          created = false;
          data = existing.data() || {};
        }
      }

      let servicios = Array.isArray(data.servicios) ? data.servicios.map(limpiarServicioCRM) : [];
      const nuevo = buildServicio(servicio, body.fichaTexto || "");
      const pNorm = normPlat(nuevo.plataforma);
      const correoNorm = String(nuevo.correo || "").trim().toLowerCase();

      let idx = servicios.findIndex(s =>
        normPlat(s.plataforma) === pNorm &&
        (!correoNorm || String(s.correo || "").trim().toLowerCase() === correoNorm)
      );
      if (idx === -1) idx = servicios.findIndex(s => normPlat(s.plataforma) === pNorm);

      if (idx >= 0) servicios[idx] = { ...servicios[idx], ...nuevo };
      else servicios.push(nuevo);

      const update = {
        nombrePerfil: nombrePerfil || data.nombrePerfil || data.nombre || "—",
        nombre: nombrePerfil || data.nombre || data.nombrePerfil || "—",
        nombre_norm: nNorm || data.nombre_norm || normName(nombrePerfil),
        telefono: tel || data.telefono || "",
        telefono_norm: tNorm || data.telefono_norm || "",
        vendedor: vendedor || data.vendedor || "",
        servicios: servicios.map(limpiarServicioCRM),
        updatedAt: isoNow()
      };
      if (created) update.createdAt = isoNow();

      await docRef.set(update, { merge: true });

      return res.status(200).json({
        ok: true,
        accion: acc,
        created,
        clienteId: docRef.id,
        totalServicios: servicios.length,
        servicioActualizado: idx >= 0
      });
    }

    let query = db.collection("clientes");
    let snap;
    if (clienteNorm) snap = await query.where("nombre_norm", "==", clienteNorm).limit(1).get();
    if ((!snap || snap.empty) && telefono) snap = await query.where("telefono", "==", telefono).limit(1).get();
    if (!snap || snap.empty) {
      const doc = await findCliente(db, { clienteNorm, telefono });
      if (doc) snap = { empty: false, docs: [doc] };
    }
    if (!snap || snap.empty)
      return res.status(200).json({ error: "No encontré ese cliente en la base." });

    const docRef = snap.docs[0].ref;
    const data = snap.docs[0].data();
    let servicios = Array.isArray(data.servicios) ? data.servicios : [];
    let invResult = null;

    if (acc === "renovar") {
      const { dias, fechaActual, fechaExacta } = body;
      if (!plataforma || (!dias && !fechaExacta))
        return res.status(200).json({ error: "Faltan datos (plataforma o fecha)." });

      let cambiados = 0;
      const platBuscada = normPlat(plataforma);
      servicios = servicios.map(s => {
        if (normPlat(s.plataforma) === platBuscada) {
          cambiados++;
          const nuevaFecha = fechaExacta ? aFechaFB(fechaExacta) : sumarDias(s.fechaRenovacion || fechaActual, parseInt(dias, 10));
          return { ...s, fechaRenovacion: nuevaFecha, updatedAt: isoNow() };
        }
        return s;
      });
      if (!cambiados) return res.status(200).json({ error: "No encontré esa plataforma en el cliente." });

    } else if (acc === "eliminar") {
      if (!plataforma) return res.status(200).json({ error: "Falta la plataforma a eliminar." });
      const platElim = normPlat(plataforma);
      const idx = servicios.findIndex(s => normPlat(s.plataforma) === platElim);
      if (idx === -1) return res.status(200).json({ error: "No encontré esa plataforma en el cliente." });

      const servEliminado = servicios[idx];
      servicios = servicios.filter((_, i) => i !== idx);

      invResult = await ajustarInventario(db, {
        modo: "liberar",
        correo: servEliminado.correo,
        nombreCliente: data.nombrePerfil || data.nombre || ""
      });

    } else if (acc === "agregar") {
      const { servicio } = body;
      if (!servicio || !servicio.plataforma) return res.status(200).json({ error: "Faltan datos del servicio nuevo." });

      const nuevo = buildServicio(servicio, "");
      servicios = [...servicios, nuevo];

      invResult = await ajustarInventario(db, {
        modo: "ocupar",
        correo: nuevo.correo,
        nombreCliente: data.nombrePerfil || data.nombre || "",
        pin: nuevo.pinPerfil || ""
      });

    } else if (acc === "editar") {
      const { plataformaOriginal, servicio } = body;
      const buscar = plataformaOriginal || plataforma;
      if (!buscar || !servicio) return res.status(200).json({ error: "Faltan datos para editar." });

      const platEdit = normPlat(buscar);
      const idx = servicios.findIndex(s => normPlat(s.plataforma) === platEdit);
      if (idx === -1) return res.status(200).json({ error: "No encontré ese servicio." });

      const nuevo = buildServicio({
        plataforma: servicio.plataforma || servicios[idx].plataforma,
        precio: servicio.precio != null ? servicio.precio : servicios[idx].precio,
        fechaRenovacion: servicio.fechaRenovacion ? servicio.fechaRenovacion : servicios[idx].fechaRenovacion,
        correo: servicio.correo != null ? servicio.correo : (servicios[idx].correo || ""),
        clave: servicio.clave != null ? servicio.clave : (servicios[idx].clave || servicios[idx].pin || ""),
        pinPerfil: servicio.pinPerfil != null ? servicio.pinPerfil : (servicios[idx].pinPerfil || servicios[idx].pin_perfil || servicios[idx].perfilPin || "")
      }, servicio.fichaTexto || servicios[idx].fichaTexto || "");

      servicios[idx] = { ...servicios[idx], ...nuevo };

    } else {
      return res.status(200).json({ error: "Acción no reconocida." });
    }

    await docRef.update({ servicios: servicios.map(limpiarServicioCRM), updatedAt: isoNow() });
    return res.status(200).json({ ok: true, accion: acc, totalServicios: servicios.length, inventario: invResult });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ error: "Error: " + (e.message || "") });
  }
}
