// api/sorteos-eventos.js
// Puente entre "se registró una compra/renovación" y "se emiten boletos de sorteo".
// Es el equivalente exacto de index_14_sorteos.js (el bot de Telegram), portado a
// ESM para poder llamarlo desde api/renovar.js. Usa las MISMAS colecciones de
// Firestore (sorteos, sorteo_boletos, sorteo_eventos, fidelidad_eventos) que el
// bot, así que ambos sistemas quedan sincronizados sin duplicar boletos: el
// candado contra duplicados es el documento sorteo_eventos/{hash}, y la
// numeración de boletos se asigna dentro de una transacción sobre el mismo
// documento sorteos/{drawId} sin importar si la escritura viene de Vercel o de
// Render — Firestore serializa ambas.
//
// Nunca debe impedir la operación principal (compra/renovación) si este módulo
// falla: toda función pública atrapa sus propios errores y devuelve
// {ok:false, error} en vez de lanzar.

import admin from "firebase-admin";
import { createHash } from "node:crypto";
import {
  reglasSorteo, sorteoClean, sorteoEventoId, sorteoNorm, sorteoSafeId,
  sorteoVendorElegible, sorteoVendorGroup
} from "./sorteos-lib.js";

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  privateKey = privateKey.replace(/\\n/g, "\n");
  return admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

function hash(value, length = 40) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, length);
}

function iso(value) {
  const date = new Date(sorteoClean(value, 40));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function monthHonduras() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}`;
}

function activeDraw(draw = {}, now = Date.now()) {
  if (draw.estado !== "activo") return false;
  const start = iso(draw.fechaInicio), end = iso(draw.fechaFin);
  return !(start && new Date(start).getTime() > now) && !(end && new Date(end).getTime() < now);
}

function scopeAllows(scope, vendor) {
  const target = sorteoNorm(scope || "sublicuentas"), group = sorteoVendorGroup(vendor);
  return target === "ambos" ? ["sublicuentas", "relojes"].includes(group) : target === group;
}

function categoryAllows(category, eventType) {
  const target = sorteoNorm(category || "general");
  if (eventType === "oro") return target === "oro" || target === "general";
  if (target === "general") return ["compra", "renovacion"].includes(eventType);
  return target === eventType || (target === "compras" && eventType === "compra") || (target === "renovaciones" && eventType === "renovacion");
}

async function updateLoyalty(db, event) {
  const clientId = sorteoSafeId(event.clientId);
  if (!clientId) return { ciclos: 0, nivel: "regular", oro: false };
  const clientRef = db.collection("clientes").doc(clientId), month = monthHonduras();
  const loyaltyRef = db.collection("fidelidad_eventos").doc(hash(`ciclo|${clientId}|${month}`));
  return db.runTransaction(async transaction => {
    const [clientSnap, eventSnap] = await Promise.all([transaction.get(clientRef), transaction.get(loyaltyRef)]);
    if (!clientSnap.exists) return { ciclos: 0, nivel: "regular", oro: false };
    const client = clientSnap.data() || {};
    let cycles = Math.max(0, Number(client.fidelidadCiclos) || 0);
    if (event.tipo === "renovacion" && !eventSnap.exists) {
      cycles += 1;
      transaction.set(loyaltyRef, { clientId, mes: month, tipo: "renovacion", eventoId: sorteoClean(event.eventoId, 300), createdAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    const goldAt = Math.max(1, Number(event.ciclosOro) || reglasSorteo({}).ciclosOro);
    const gold = client.clienteOro === true || sorteoNorm(client.nivelCliente) === "oro" || cycles >= goldAt;
    transaction.set(clientRef, { fidelidadCiclos: cycles, nivelCliente: gold ? "oro" : "regular", fidelidadUpdatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { ciclos: cycles, nivel: gold ? "oro" : "regular", oro: gold };
  });
}

async function currentTicketCount(db, drawId, clientId) {
  const snap = await db.collection("sorteo_boletos").where("clientId", "==", clientId).get();
  return snap.docs.reduce((sum, doc) => sum + (String((doc.data() || {}).sorteoId) === drawId ? 1 : 0), 0);
}

async function createEventTickets(db, draw, event, quantity) {
  const drawId = sorteoSafeId(draw.id), clientId = sorteoSafeId(event.clientId), eventId = sorteoClean(event.eventoId, 500);
  if (!drawId || !clientId || !eventId || quantity <= 0) return { creados: 0, duplicado: false };
  const drawRules = reglasSorteo(draw.reglas || {}), existing = await currentTicketCount(db, drawId, clientId);
  const key = hash(`${drawId}|${event.tipo}|${clientId}|${eventId}`);
  const eventRef = db.collection("sorteo_eventos").doc(key), drawRef = db.collection("sorteos").doc(drawId);
  const counterRef = db.collection("sorteo_contadores").doc(hash(`${drawId}|${clientId}`));
  return db.runTransaction(async transaction => {
    const [eventSnap, drawSnap, counterSnap] = await Promise.all([
      transaction.get(eventRef), transaction.get(drawRef), transaction.get(counterRef)
    ]);
    if (eventSnap.exists) return { creados: 0, duplicado: true };
    if (!drawSnap.exists || !activeDraw(drawSnap.data() || {})) return { creados: 0, cerrado: true };
    const counted = counterSnap.exists ? Math.max(0, Number((counterSnap.data() || {}).total) || 0) : existing;
    const total = Math.min(Math.max(0, Number(quantity) || 0), Math.max(0, drawRules.limitePorCliente - counted));
    if (!total) {
      transaction.set(eventRef, { sorteoId: drawId, clientId, tipo: event.tipo, eventoId: eventId, cantidad: 0, limitado: true, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      transaction.set(counterRef, { sorteoId: drawId, clientId, total: counted, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return { creados: 0, limite: true };
    }
    const latest = drawSnap.data() || {}, start = Math.max(0, Number(latest.ultimoNumero) || 0) + 1, codes = [];
    for (let index = 0; index < total; index += 1) {
      const number = start + index, code = `SOR-${String(drawId).slice(-4).toUpperCase()}-${String(number).padStart(5, "0")}`;
      transaction.set(db.collection("sorteo_boletos").doc(`${drawId}_${String(number).padStart(8, "0")}`), {
        sorteoId: drawId, numero: number, codigo: code, clientId, clienteNombre: sorteoClean(event.clienteNombre, 120), telefono: sorteoClean(event.telefono, 40),
        vendedor: sorteoClean(event.vendedor, 80), vendedorNorm: sorteoNorm(event.vendedorNorm || event.vendedor), tipo: event.tipo, origen: sorteoClean(event.origen || event.tipo, 80),
        eventoId: eventId, activo: true, createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      codes.push(code);
    }
    transaction.set(eventRef, { sorteoId: drawId, clientId, tipo: event.tipo, eventoId: eventId, cantidad: total, codigos: codes, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    transaction.set(counterRef, { sorteoId: drawId, clientId, total: counted + total, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(drawRef, { ultimoNumero: start + total - 1, totalBoletos: admin.firestore.FieldValue.increment(total), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { creados: total, codigos: codes, duplicado: false };
  });
}

export async function registrarEventoSorteos(rawEvent = {}) {
  const db = getApp().firestore();
  const type = ["compra", "renovacion"].includes(sorteoNorm(rawEvent.tipo)) ? sorteoNorm(rawEvent.tipo) : "";
  const clientId = sorteoSafeId(rawEvent.clientId), eventId = sorteoEventoId(rawEvent, type);
  if (!type || !clientId || !eventId) return { ok: false, omitido: "evento_incompleto", creados: 0 };
  const clientSnap = await db.collection("clientes").doc(clientId).get();
  if (!clientSnap.exists) return { ok: false, omitido: "cliente_no_existe", creados: 0 };
  const client = clientSnap.data() || {}, vendor = sorteoClean(client.vendedor || rawEvent.vendedor, 80);
  const vendorNorm = sorteoVendorGroup(client.vendedor_norm || client.vendedor || rawEvent.vendedorNorm || rawEvent.vendedor);
  if (!sorteoVendorElegible(vendorNorm)) {
    return { ok: true, omitido: "vendedor_no_elegible", creados: 0 };
  }
  const event = {
    tipo: type, clientId, eventoId: eventId, clienteNombre: sorteoClean(rawEvent.clienteNombre || client.nombrePerfil || client.nombre || "Cliente", 120),
    telefono: sorteoClean(rawEvent.telefono || client.telefono, 40), vendedor: vendor, vendedorNorm: vendorNorm, origen: sorteoClean(rawEvent.origen || "Sublichat", 80)
  };
  const currentCycles = Math.max(0, Number(client.fidelidadCiclos) || 0);
  const currentGoldAt = Math.max(1, Number(rawEvent.ciclosOro) || reglasSorteo({}).ciclosOro);
  const loyalty = rawEvent.omitirFidelidad === true
    ? {
      ciclos: currentCycles,
      nivel: client.clienteOro === true || sorteoNorm(client.nivelCliente) === "oro" || currentCycles >= currentGoldAt ? "oro" : "regular",
      oro: client.clienteOro === true || sorteoNorm(client.nivelCliente) === "oro" || currentCycles >= currentGoldAt
    }
    : await updateLoyalty(db, { ...event, ciclosOro: rawEvent.ciclosOro });
  const requestedDrawId = sorteoSafeId(rawEvent.sorteoId);
  const drawDocs = requestedDrawId
    ? [await db.collection("sorteos").doc(requestedDrawId).get()]
    : (await db.collection("sorteos").where("estado", "==", "activo").limit(100).get()).docs;
  const draws = drawDocs.filter(doc => doc.exists).map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(draw => activeDraw(draw) && scopeAllows(draw.alcance, vendorNorm));
  const results = [];
  for (const draw of draws) {
    const drawRules = reglasSorteo(draw.reglas || {});
    if (categoryAllows(draw.categoria, type)) results.push({ sorteoId: draw.id, tipo: type, ...await createEventTickets(db, draw, event, type === "compra" ? drawRules.compra : drawRules.renovacion) });
    if (loyalty.oro && categoryAllows(draw.categoria, "oro")) results.push({ sorteoId: draw.id, tipo: "oro", ...await createEventTickets(db, draw, { ...event, tipo: "oro", eventoId: `oro:${clientId}:${draw.id}`, origen: "Cliente Oro" }, drawRules.oro) });
  }
  return { ok: true, creados: results.reduce((sum, item) => sum + Number(item.creados || 0), 0), fidelidad: loyalty, resultados: results };
}

export async function registrarEventoSorteosSeguro(event = {}) {
  try { return await registrarEventoSorteos(event); }
  catch (error) { console.error("SORTEOS_EVENT_ERROR", error?.message || error); return { ok: false, creados: 0, error: String(error?.message || error || "Error de sorteos") }; }
}
