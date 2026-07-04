// api/finanzas.js · VERSION 1 · Movimientos financieros para Sublichat RBAC
// Guarda cobros, egresos y cierres en Firebase para que Sublichat y el bot de Telegram
// lean la misma base.
//
// Variables de entorno requeridas en Vercel:
// FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import admin from "firebase-admin";

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  privateKey = privateKey.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltan variables FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY.");
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
}

function isoNow() {
  return new Date().toISOString();
}

function cleanText(v) {
  return String(v || "").trim();
}

function cleanMoney(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normPhone(s) {
  return String(s || "").replace(/\D/g, "");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, version: 1, msg: "finanzas v1 activo. Usá POST." });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Método no permitido" });

  try {
    const db = getApp().firestore();
    const body = req.body || {};
    const accion = cleanText(body.accion || body.tipoAccion);
    const now = isoNow();

    if (accion === "registrar_cobro") {
      const monto = cleanMoney(body.monto);
      if (!monto) return res.status(200).json({ ok: false, error: "Falta el monto del cobro." });

      const movimiento = {
        tipo: "ingreso",
        subtipo: "cobro_cliente",
        clienteNombre: cleanText(body.clienteNombre || body.nombrePerfil || body.nombre),
        clienteNorm: cleanText(body.clienteNorm) || normName(body.clienteNombre || body.nombrePerfil || body.nombre),
        telefono: cleanText(body.telefono),
        telefono_norm: normPhone(body.telefono),
        plataforma: cleanText(body.plataforma),
        monto,
        metodoPago: cleanText(body.metodoPago || body.metodo || "No especificado"),
        cobradoPor: cleanText(body.cobradoPor || body.registradoPor),
        vendedor: cleanText(body.vendedor),
        rol: cleanText(body.rol),
        fechaPago: cleanText(body.fechaPago) || now.slice(0, 10),
        createdAt: now,
        updatedAt: now
      };

      const movRef = await db.collection("finanzas_movimientos").add(movimiento);
      await db.collection("cobros").doc(movRef.id).set({ ...movimiento, movimientoId: movRef.id }, { merge: true });
      return res.status(200).json({ ok: true, accion, movimientoId: movRef.id });
    }

    if (accion === "registrar_egreso") {
      const monto = cleanMoney(body.monto);
      const motivo = cleanText(body.motivo || body.descripcion);
      if (!motivo || !monto) return res.status(200).json({ ok: false, error: "Falta motivo o monto del egreso." });

      const movimiento = {
        tipo: "egreso",
        subtipo: cleanText(body.subtipo || "egreso_operativo"),
        motivo,
        descripcion: cleanText(body.descripcion || motivo),
        monto,
        banco: cleanText(body.banco),
        registradoPor: cleanText(body.registradoPor),
        rol: cleanText(body.rol),
        fecha: cleanText(body.fecha) || now.slice(0, 10),
        createdAt: now,
        updatedAt: now
      };

      const movRef = await db.collection("finanzas_movimientos").add(movimiento);
      await db.collection("egresos").doc(movRef.id).set({ ...movimiento, movimientoId: movRef.id }, { merge: true });
      return res.status(200).json({ ok: true, accion, movimientoId: movRef.id });
    }

    if (accion === "guardar_cierre") {
      const cierre = {
        tipo: "cierre_caja",
        fechaInicio: cleanText(body.fechaInicio),
        fechaFin: cleanText(body.fechaFin),
        ingresos: cleanMoney(body.ingresos),
        egresos: cleanMoney(body.egresos),
        neto: cleanMoney(body.neto),
        registradoPor: cleanText(body.registradoPor),
        rol: cleanText(body.rol),
        nota: cleanText(body.nota),
        createdAt: now,
        updatedAt: now
      };

      const id = `${cierre.fechaInicio || now.slice(0,10)}_${cierre.registradoPor || "sublichat"}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      await db.collection("cierres_caja").doc(id).set(cierre, { merge: true });
      await db.collection("auditoria_eventos").add({
        tipo: "cierre_caja_guardado",
        cierreId: id,
        registradoPor: cierre.registradoPor,
        rol: cierre.rol,
        createdAt: now
      });
      return res.status(200).json({ ok: true, accion, cierreId: id });
    }

    return res.status(200).json({ ok: false, error: "Acción no reconocida." });
  } catch (e) {
    console.error("FINANZAS_ERROR", e);
    return res.status(200).json({ ok: false, error: "Error: " + (e.message || "") });
  }
}
