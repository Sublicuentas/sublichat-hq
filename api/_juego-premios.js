/* SUBLICUENTAS · "Atrapa tu Premio" — motor del minijuego (Oct-2026)
   Especificación: Sublicuentas_Atrapa_Tu_Premio_Claude.pdf. Reglas que NO se cambian sin autorización:
   - Las fichas las da un administrador (no se crean solas al renovar). 1 renovación = 1 lote de 1 a 4 fichas.
   - Cada ficha = 1 jugada = 1 premio. Sin repetidos en el lote. Máximo 1 Premium por lote. Tope de costo por lote.
   - El SERVIDOR decide el premio (generador seguro, crypto) y lo guarda ANTES de que el navegador anime.
   - Ficha usada nunca se vuelve a sortear (transacción + id del premio = id de la ficha).
   - Premio "1 mes gratis": NUNCA se aplica solo (30/10/2026, decisión del dueño). Si ya tiene el servicio activo →
     queda "pendiente_entrega" para que un administrador lo entregue; si no → acceso nuevo (reserva cupo y queda
     pendiente de entrega). Solo los "+N días" se suman automáticamente. Netflix NUNCA es premio de 1 mes gratis.
   - Las fichas NO crean, consumen ni modifican el boleto del sorteo mensual.
   - Al cliente nunca se le mandan costos, pesos ni datos internos. */
import { randomInt, createHash } from "node:crypto";

export const COL = Object.freeze({
  config: "juego_config", premios: "juego_premios", lotes: "juego_lotes",
  fichas: "juego_fichas", ganados: "juego_ganados", reservas: "juego_reservas",
});
export const CONFIG_DEFAULT = Object.freeze({
  activo: true, maxPremiumPorLote: 1, topeCostoLote: 200, diasReclamo: 7, maxFichasLote: 4,
});
export const TIERS = Object.freeze(["comun", "medio", "premium"]);
export const TIPOS = Object.freeze(["saldo", "descuento", "dias", "mes_gratis"]);
export const MODOS_INVENTARIO = Object.freeze(["ilimitado", "stock", "bodega"]);
export const ORIGENES = Object.freeze(["renovacion", "fidelidad", "promocion", "compensacion"]);
export const ESTADOS = Object.freeze(["ganado", "reservado", "pendiente_entrega", "entregado", "vencido", "anulado"]);

// Valores iniciales del PDF (sección 6). Son editables desde administración; no son constantes fijas.
export const PREMIOS_INICIALES = Object.freeze([
  { id: "saldo10", nombre: "L10 de saldo para su próxima compra", etiqueta: "L10", tier: "comun", peso: 20, costoHnl: 10, tipo: "saldo", valor: 10, plataforma: "", inventarioModo: "ilimitado", stock: 0, orden: 1 },
  { id: "desc20", nombre: "L20 de descuento", etiqueta: "L20", tier: "comun", peso: 15, costoHnl: 20, tipo: "descuento", valor: 20, plataforma: "", inventarioModo: "ilimitado", stock: 0, orden: 2 },
  { id: "dias3", nombre: "+3 días a su servicio actual", etiqueta: "+3 días", tier: "comun", peso: 15, costoHnl: 6, tipo: "dias", valor: 3, plataforma: "", inventarioModo: "ilimitado", stock: 0, orden: 3 },
  { id: "dias5", nombre: "+5 días a su servicio actual", etiqueta: "+5 días", tier: "comun", peso: 10, costoHnl: 10, tipo: "dias", valor: 5, plataforma: "", inventarioModo: "ilimitado", stock: 0, orden: 4 },
  { id: "saldo50", nombre: "L50 de saldo especial", etiqueta: "L50", tier: "comun", peso: 5, costoHnl: 50, tipo: "saldo", valor: 50, plataforma: "", inventarioModo: "ilimitado", stock: 0, orden: 5 },
  { id: "canva", nombre: "Canva 1 mes gratis", etiqueta: "Canva", tier: "medio", peso: 12, costoHnl: 15, tipo: "mes_gratis", valor: 30, plataforma: "canva", inventarioModo: "stock", stock: 10, orden: 6 },
  { id: "duolingo", nombre: "Duolingo 1 mes gratis", etiqueta: "Duolingo", tier: "medio", peso: 8, costoHnl: 20, tipo: "mes_gratis", valor: 30, plataforma: "duolingo", inventarioModo: "stock", stock: 10, orden: 7 },
  { id: "spotify", nombre: "Spotify 1 mes gratis", etiqueta: "Spotify", tier: "premium", peso: 4, costoHnl: 64, tipo: "mes_gratis", valor: 30, plataforma: "spotify", inventarioModo: "bodega", stock: 0, orden: 8 },
  { id: "prime", nombre: "Prime Video 1 mes gratis", etiqueta: "Prime", tier: "premium", peso: 4, costoHnl: 27, tipo: "mes_gratis", valor: 30, plataforma: "primevideo", inventarioModo: "bodega", stock: 0, orden: 9 },
  { id: "max", nombre: "Max 1 mes gratis", etiqueta: "Max", tier: "premium", peso: 4, costoHnl: 40, tipo: "mes_gratis", valor: 30, plataforma: "hbomax", inventarioModo: "bodega", stock: 0, orden: 10 },
  { id: "crunchy", nombre: "Crunchyroll 1 mes gratis", etiqueta: "Crunchyroll", tier: "premium", peso: 3, costoHnl: 38, tipo: "mes_gratis", valor: 30, plataforma: "crunchyroll", inventarioModo: "bodega", stock: 0, orden: 11 },
]);

const ERR = (msg, status = 400) => Object.assign(new Error(msg), { status });
export function clean(v, max = 200) { return String(v == null ? "" : v).replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max); }
export function norm(v) { return clean(v, 160).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
const sha = (s) => createHash("sha256").update(String(s)).digest("hex").slice(0, 32);
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

// ---------- Fichas sugeridas por meses renovados (sección 3) ----------
export function fichasSugeridas(meses) {
  const m = Math.max(1, Math.round(num(meses, 1)));
  if (m <= 1) return 1;
  if (m <= 3) return 2;
  if (m <= 6) return 3;
  return 4; // 7–12 meses (o más): máximo 4. Ej.: IPTV 12 meses → 4, NO 12.
}

// ---------- Familia de plataforma ----------
export function familiaPlataforma(v) {
  const k = norm(v).replace(/[^a-z0-9]/g, "");
  if (!k) return "";
  if (/^(vip)?netflix/.test(k)) return "netflix";
  if (/^(hbo|max)/.test(k)) return "hbomax";
  if (/^prime/.test(k)) return "primevideo";
  if (/^disney/.test(k)) return "disney";
  if (/^crunchy/.test(k)) return "crunchyroll";
  if (/^spotify/.test(k)) return "spotify";
  if (/^canva/.test(k)) return "canva";
  if (/^duolingo/.test(k)) return "duolingo";
  return k.replace(/\d+$/, "");
}

// ---------- Fechas (dd/mm/yyyy, día local de Honduras) ----------
export function hoyDMY(now = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [y, m, d] = p.split("-");
  return `${d}/${m}/${y}`;
}
export function dmyTs(v) {
  const s = clean(v, 30);
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return NaN;
}
export function sumarDiasDMY(base, dias) {
  const d = new Date(dmyTs(base) + num(dias) * 86400000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}
// Vigente → se suma desde su vencimiento; vencido → desde hoy (misma regla que Renovar).
export function extenderFecha(fechaActual, dias, hoy = hoyDMY()) {
  const ts = dmyTs(fechaActual);
  const base = Number.isFinite(ts) && ts >= dmyTs(hoy) ? fechaActual : hoy;
  return sumarDiasDMY(base, dias);
}
function fechaDMY(v) { const ts = dmyTs(v); return Number.isFinite(ts) ? sumarDiasDMY(v, 0) : ""; }

// ---------- Premios ----------
export function validarPremio(p = {}) {
  const out = {
    id: clean(p.id, 40).toLowerCase().replace(/[^a-z0-9_-]/g, ""),
    nombre: clean(p.nombre, 80), etiqueta: clean(p.etiqueta || p.nombre, 18),
    tier: TIERS.includes(p.tier) ? p.tier : "comun",
    activo: p.activo !== false, peso: Math.max(0, num(p.peso)), costoHnl: Math.max(0, num(p.costoHnl)),
    tipo: TIPOS.includes(p.tipo) ? p.tipo : "saldo", valor: Math.max(0, num(p.valor)),
    plataforma: familiaPlataforma(p.plataforma), inventarioModo: MODOS_INVENTARIO.includes(p.inventarioModo) ? p.inventarioModo : "ilimitado",
    stock: Math.max(0, Math.floor(num(p.stock))), orden: num(p.orden, 99),
  };
  if (!out.id || !out.nombre) throw ERR("El premio necesita id y nombre.");
  if (out.tipo === "mes_gratis") {
    if (!out.plataforma) throw ERR("Elija la plataforma del mes gratis.");
    if (out.plataforma === "netflix") throw ERR("Netflix nunca se entrega como 1 mes gratis.");
    out.valor = 30;
  }
  if (out.tipo === "dias" && !(out.valor >= 1 && out.valor <= 31)) throw ERR("Días entre 1 y 31.");
  return out;
}
// Lo que puede ver el cliente (sin costos, pesos ni inventario).
export function premioPublico(p = {}) {
  return { id: p.id, nombre: p.nombre, etiqueta: p.etiqueta, tier: p.tier, tipo: p.tipo, valor: p.valor, plataforma: p.plataforma };
}

/* Candidatos válidos para UNA jugada (sección 12, pasos 5–8). Función pura.
   disponibilidadBodega: { [plataforma]: cupos libres - reservas } ; clienteTiene(plataforma) → bool */
export function candidatos({ premios = [], lote = {}, config = CONFIG_DEFAULT, disponibilidadBodega = {}, clienteTiene = () => false } = {}) {
  const ganados = new Set(lote.premiosGanados || []);
  const premiumLleno = num(lote.premiumGanados) >= num(config.maxPremiumPorLote, 1);
  const restante = num(config.topeCostoLote, Infinity) - num(lote.costoTotal);
  return premios.filter((p) => {
    if (!p || p.activo === false || !(num(p.peso) > 0)) return false;
    if (p.tipo === "mes_gratis" && familiaPlataforma(p.plataforma) === "netflix") return false;  // Netflix nunca
    if (ganados.has(p.id)) return false;                                                          // sin repetidos
    if (premiumLleno && p.tier === "premium") return false;                                       // máx. 1 Premium
    if (num(p.costoHnl) > restante) return false;                                                 // tope de costo
    if (p.inventarioModo === "stock" && !(num(p.stock) > 0)) return false;                        // sin inventario
    if (p.inventarioModo === "bodega" && !clienteTiene(p.plataforma) && !(num(disponibilidadBodega[p.plataforma]) > 0)) return false;
    return true;
  });
}
// Azar ponderado con generador seguro del servidor. Los pesos se recalculan SOLO entre los válidos.
export function elegirPonderado(lista = [], rnd = (n) => randomInt(n)) {
  if (!lista.length) return null;
  const pesos = lista.map((p) => Math.max(1, Math.round(num(p.peso) * 1000)));
  const total = pesos.reduce((a, b) => a + b, 0);
  let r = rnd(total);
  for (let i = 0; i < lista.length; i++) { if (r < pesos[i]) return lista[i]; r -= pesos[i]; }
  return lista[lista.length - 1];
}

// ---------- Cliente / servicios ----------
export function claveBeneficiario(servicio = {}) {
  const saved = clean(servicio?.beneficiarioKey, 160);
  if (saved) return saved;
  if (norm(servicio?.beneficiarioTipo) !== "tercero") return "titular";
  const n = norm(servicio?.beneficiarioNombre || servicio?.beneficiario).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "persona";
  return `tercero-${n}`;
}
// Servicio ACTIVO de esa plataforma (vence hoy o después) para el mismo beneficiario.
export function servicioActivo(cliente = {}, plataforma = "", beneficiarioKey = "titular", hoy = hoyDMY()) {
  const fam = familiaPlataforma(plataforma), h = dmyTs(hoy);
  const servicios = Array.isArray(cliente.servicios) ? cliente.servicios : [];
  let mejor = -1;
  servicios.forEach((s, i) => {
    if (!s || familiaPlataforma(s.plataforma) !== fam) return;
    if (claveBeneficiario(s) !== (beneficiarioKey || "titular")) return;
    const ts = dmyTs(s.fechaRenovacion);
    if (!(ts >= h)) return;
    if (mejor < 0 || ts < dmyTs(servicios[mejor].fechaRenovacion)) mejor = i;
  });
  return mejor;
}
// Servicio al que van los "+N días": el que se renovó (compraId del lote) o el que vence primero.
export function servicioParaDias(cliente = {}, compraId = "", beneficiarioKey = "titular") {
  const servicios = Array.isArray(cliente.servicios) ? cliente.servicios : [];
  if (compraId) { const i = servicios.findIndex((s) => s && String(s.compraId || "") === String(compraId)); if (i >= 0) return i; }
  let mejor = -1;
  servicios.forEach((s, i) => {
    if (!s || claveBeneficiario(s) !== (beneficiarioKey || "titular") || !Number.isFinite(dmyTs(s.fechaRenovacion))) return;
    if (mejor < 0 || dmyTs(s.fechaRenovacion) < dmyTs(servicios[mejor].fechaRenovacion)) mejor = i;
  });
  return mejor;
}

// Cupos libres reales de Bodega por plataforma (capacidad - clientes asignados). Caché 60 s.
let cacheBodega = { at: 0, data: null };
export function limpiarCacheBodega() { cacheBodega = { at: 0, data: null }; }
export async function cuposLibresBodega(db) {
  if (cacheBodega.data && Date.now() - cacheBodega.at < 60000) return cacheBodega.data;
  const out = {};
  const snap = await db.collection("inventario").get();
  snap.forEach((d) => {
    const x = d.data() || {};
    if (x.activo === false || x.disponible === false) return;
    const fam = familiaPlataforma(x.plataforma);
    const cap = num(x.capacidad || x.total, 0);
    const ocupados = Array.isArray(x.clientes) ? x.clientes.length : num(x.ocupados);
    out[fam] = (out[fam] || 0) + Math.max(0, cap - ocupados);
  });
  cacheBodega = { at: Date.now(), data: out };
  return out;
}

// ---------- Configuración y premios (lectura) ----------
export async function leerConfig(db, tx = null) {
  const ref = db.collection(COL.config).doc("global");
  const snap = tx ? await tx.get(ref) : await ref.get();
  return { ...CONFIG_DEFAULT, ...(snap.exists ? snap.data() || {} : {}) };
}
export async function leerPremios(db) {
  const snap = await db.collection(COL.premios).get();
  const out = [];
  snap.forEach((d) => out.push({ ...(d.data() || {}), id: d.id }));
  if (!out.length) return PREMIOS_INICIALES.map((p) => ({ ...p, activo: true }));
  return out.sort((a, b) => num(a.orden, 99) - num(b.orden, 99));
}
// Primera vez: guarda los premios iniciales (idempotente).
export async function sembrarPremios(db) {
  const snap = await db.collection(COL.premios).get();
  if (snap.docs ? snap.docs.length : snap.size) return false;
  for (const p of PREMIOS_INICIALES) await db.collection(COL.premios).doc(p.id).set({ ...p, activo: true });
  return true;
}

// ---------- Otorgar fichas (admin) ----------
// Idempotente: la misma renovación (o el mismo requestId) nunca crea 2 lotes.
export async function otorgarFichas(db, { clienteId, beneficiarioKey = "titular", fichas, origen = "renovacion", motivo = "", renovacion = null, requestId = "", actor = "", permisoEspecial = false, ahora = new Date() } = {}) {
  const cid = clean(clienteId, 120);
  if (!cid) throw ERR("Falta el cliente.");
  const config = await leerConfig(db);
  const n = Math.floor(num(fichas));
  if (!(n >= 1)) throw ERR("Elija de 1 a 4 fichas.");
  if (n > num(config.maxFichasLote, 4) && !permisoEspecial) throw ERR(`Máximo ${config.maxFichasLote} fichas por lote (solo Sublicuentas puede dar más con permiso especial).`);
  if (n > 10) throw ERR("Máximo 10 fichas por lote.");
  const org = ORIGENES.includes(origen) ? origen : "promocion";
  let loteId, ren = null;
  if (org === "renovacion") {
    const key = clean(renovacion?.key, 300);
    if (!key) throw ERR("Falta la renovación confirmada.");
    ren = { key, compraId: clean(renovacion?.compraId, 120), meses: Math.max(1, Math.round(num(renovacion?.meses, 1))), pagoOperacionId: clean(renovacion?.pagoOperacionId, 120) };
    loteId = `ren_${sha(`${cid}|${key}`)}`;
  } else {
    const rid = clean(requestId, 120);
    if (!rid) throw ERR("Falta el identificador de la solicitud.");
    if (clean(motivo, 300).length < 4) throw ERR("Escriba el motivo.");
    loteId = `man_${sha(`${cid}|${rid}`)}`;
  }
  const loteRef = db.collection(COL.lotes).doc(loteId);
  const clienteRef = db.collection("clientes").doc(cid);
  let resultado;
  await db.runTransaction(async (tx) => {
    const [ya, cli] = [await tx.get(loteRef), await tx.get(clienteRef)];
    if (ya.exists) { resultado = { duplicado: true, loteId, ...(ya.data() || {}) }; return; }
    if (!cli.exists) throw ERR("No se encontró el cliente.", 404);
    const c = cli.data() || {};
    if (ren && ren.compraId && !(Array.isArray(c.servicios) ? c.servicios : []).some((s) => String(s?.compraId || "") === ren.compraId)) throw ERR("Esa renovación no pertenece a este cliente.");
    const lote = {
      clienteId: cid, clienteNombre: clean(c.nombrePerfil || c.nombre, 80), beneficiarioKey: clean(beneficiarioKey, 160) || "titular",
      origen: org, motivo: clean(motivo, 300) || (org === "renovacion" ? "Renovación confirmada" : ""), renovacion: ren,
      fichasSugeridas: ren ? fichasSugeridas(ren.meses) : null, fichas: n, fichasUsadas: 0,
      premiosGanados: [], premiumGanados: 0, costoTotal: 0,
      otorgadoPor: clean(actor, 60), otorgadoAt: ahora.toISOString(),
    };
    tx.set(loteRef, lote);
    for (let i = 1; i <= n; i++) {
      tx.set(db.collection(COL.fichas).doc(`${loteId}_${i}`), { loteId, clienteId: cid, beneficiarioKey: lote.beneficiarioKey, n: i, estado: "disponible", createdAt: ahora.toISOString() });
    }
    tx.set(db.collection("auditoria_eventos").doc(), { tipo: "juego_fichas_otorgadas", modulo: "juego", loteId, clienteId: cid, fichas: n, origen: org, motivo: lote.motivo, renovacion: ren, usuario: lote.otorgadoPor, createdAt: lote.otorgadoAt });
    resultado = { duplicado: false, loteId, ...lote };
  });
  return resultado;
}

// ---------- Jugar (cliente) · sección 12 ----------
export async function jugar(db, { clienteId, beneficiarioKey = "titular", fichaId, ip = "", rnd, ahora = new Date() } = {}) {
  const fid = clean(fichaId, 160);
  if (!fid) throw ERR("Falta la ficha.");
  const config = await leerConfig(db);
  if (config.activo === false) throw ERR("El juego está en pausa en este momento. Su ficha sigue guardada.", 409);
  const premiosLista = await leerPremios(db);
  const usaBodega = premiosLista.some((p) => p.inventarioModo === "bodega");
  const libres = usaBodega ? await cuposLibresBodega(db) : {};
  const fichaRef = db.collection(COL.fichas).doc(fid);
  const ganadoRef = db.collection(COL.ganados).doc(fid); // id del premio = id de la ficha → idempotente
  let salida;
  await db.runTransaction(async (tx) => {
    const fichaSnap = await tx.get(fichaRef);                                                       // 1–2 validar + lock
    if (!fichaSnap.exists) throw ERR("Esa ficha no existe.", 404);
    const ficha = fichaSnap.data() || {};
    if (ficha.clienteId !== clienteId || (ficha.beneficiarioKey || "titular") !== (beneficiarioKey || "titular")) throw ERR("Esa ficha no es suya.", 403);
    if (ficha.estado === "anulada") throw ERR("Esa ficha fue anulada.", 409);
    if (ficha.estado !== "disponible") {                                                            // 3 ya usada → mismo resultado
      const g = await tx.get(ganadoRef);
      salida = { repetido: true, ganado: g.exists ? { id: g.id, ...(g.data() || {}) } : null };
      return;
    }
    const loteRef = db.collection(COL.lotes).doc(ficha.loteId);
    const loteSnap = await tx.get(loteRef);                                                         // 4 lote + ganados
    if (!loteSnap.exists) throw ERR("Lote no encontrado.", 404);
    const lote = loteSnap.data() || {};
    const premiosRefs = premiosLista.map((p) => db.collection(COL.premios).doc(p.id));
    const premiosSnaps = await Promise.all(premiosRefs.map((r) => tx.get(r)));
    const premios = premiosSnaps.map((s, i) => (s.exists ? { ...(s.data() || {}), id: s.id } : premiosLista[i]));
    const bodegaPlats = [...new Set(premios.filter((p) => p.inventarioModo === "bodega").map((p) => familiaPlataforma(p.plataforma)))];
    const reservasSnaps = await Promise.all(bodegaPlats.map((pl) => tx.get(db.collection(COL.reservas).doc(pl))));
    const reservas = Object.fromEntries(bodegaPlats.map((pl, i) => [pl, num(reservasSnaps[i].exists ? (reservasSnaps[i].data() || {}).reservados : 0)]));
    const disponibilidad = Object.fromEntries(bodegaPlats.map((pl) => [pl, num(libres[pl]) - num(reservas[pl])]));
    const clienteSnap = await tx.get(db.collection("clientes").doc(clienteId));
    const cliente = clienteSnap.exists ? clienteSnap.data() || {} : {};
    const tiene = (pl) => servicioActivo(cliente, pl, beneficiarioKey) >= 0;
    const lista = candidatos({ premios, lote, config, disponibilidadBodega: disponibilidad, clienteTiene: tiene }); // 5–8
    const premio = elegirPonderado(lista, rnd);                                                    // 9
    if (!premio) throw ERR("En este momento no hay premios disponibles. Su ficha sigue guardada; intente más tarde.", 409);
    const plat = familiaPlataforma(premio.plataforma);
    const esNuevo = premio.tipo === "mes_gratis" && !tiene(plat);
    let estado = "ganado";
    if (premio.tipo === "saldo" || premio.tipo === "descuento" || premio.tipo === "mes_gratis") estado = "pendiente_entrega";
    if (esNuevo) estado = "reservado";
    const expira = new Date(ahora.getTime() + num(config.diasReclamo, 7) * 86400000).toISOString();
    if (premio.inventarioModo === "stock") tx.set(db.collection(COL.premios).doc(premio.id), { ...premio, stock: num(premio.stock) - 1 }); // 10 reservar inventario
    if (esNuevo && premio.inventarioModo === "bodega") tx.set(db.collection(COL.reservas).doc(plat), { plataforma: plat, reservados: num(reservas[plat]) + 1, updatedAt: ahora.toISOString() });
    const ganado = {
      fichaId: fid, loteId: ficha.loteId, clienteId, clienteNombre: lote.clienteNombre || "", beneficiarioKey: beneficiarioKey || "titular",
      premioId: premio.id, premio: premioPublico({ ...premio, plataforma: plat }), tier: premio.tier, costoHnl: num(premio.costoHnl),
      estado, entregaModo: premio.tipo === "dias" ? "automatica" : "admin",
      reservaBodega: esNuevo && premio.inventarioModo === "bodega" ? plat : "",
      ganadoAt: ahora.toISOString(), expiraAt: estado === "entregado" ? "" : expira, ip: clean(ip, 60),
    };
    tx.set(ganadoRef, ganado);                                                                     // 11 premio + ficha usada (atómico)
    tx.update(fichaRef, { estado: "usada", usadaAt: ahora.toISOString(), ganadoId: fid });
    tx.update(loteRef, {
      fichasUsadas: num(lote.fichasUsadas) + 1, premiosGanados: [...(lote.premiosGanados || []), premio.id],
      premiumGanados: num(lote.premiumGanados) + (premio.tier === "premium" ? 1 : 0), costoTotal: num(lote.costoTotal) + num(premio.costoHnl),
    });
    tx.set(db.collection("auditoria_eventos").doc(), { tipo: "juego_jugada", modulo: "juego", fichaId: fid, loteId: ficha.loteId, clienteId, premioId: premio.id, tier: premio.tier, costoHnl: num(premio.costoHnl), estado, ip: clean(ip, 60), createdAt: ahora.toISOString() });
    salida = { repetido: false, ganado: { id: fid, ...ganado } };
  });                                                                                               // 12 commit
  if (!salida.repetido && salida.ganado && salida.ganado.entregaModo === "automatica") {           // 14 entrega automática
    try { salida.ganado = await entregarAutomatico(db, fid, { ahora }); }
    catch (e) { salida.ganado.entregaError = String(e && e.message || e).slice(0, 200); }      // queda "ganado": admin reintenta
  }
  return salida;
}

// +N días reales al servicio. Automático solo para "+3/+5 días". El "1 mes gratis" de un servicio que ya tiene
// únicamente llega aquí si un administrador lo pide (acción "reintentar"/aplicar desde administración).
export async function entregarAutomatico(db, ganadoId, { ahora = new Date(), actor = "sistema" } = {}) {
  const gRef = db.collection(COL.ganados).doc(ganadoId);
  let out;
  await db.runTransaction(async (tx) => {
    const gSnap = await tx.get(gRef);
    if (!gSnap.exists) throw ERR("Premio no encontrado.", 404);
    const g = gSnap.data() || {};
    if (g.estado === "entregado") { out = { id: gSnap.id, ...g }; return; }                       // ya entregado: no duplicar días
    const cRef = db.collection("clientes").doc(g.clienteId);
    const cSnap = await tx.get(cRef);
    if (!cSnap.exists) throw ERR("Cliente no encontrado.", 404);
    const cliente = cSnap.data() || {};
    const servicios = Array.isArray(cliente.servicios) ? cliente.servicios.slice() : [];
    let idx = -1, dias = 0;
    if (g.premio?.tipo === "dias") {
      const loteSnap = await tx.get(db.collection(COL.lotes).doc(g.loteId));
      const compraId = loteSnap.exists ? (loteSnap.data() || {}).renovacion?.compraId || "" : "";
      idx = servicioParaDias(cliente, compraId, g.beneficiarioKey); dias = num(g.premio.valor);
    } else if (g.premio?.tipo === "mes_gratis") {
      idx = servicioActivo(cliente, g.premio.plataforma, g.beneficiarioKey); dias = 30;
    }
    if (idx < 0) throw ERR("El cliente no tiene un servicio activo para aplicar el premio.");
    const s = servicios[idx];
    const fechaAnterior = fechaDMY(s.fechaRenovacion) || s.fechaRenovacion || "";
    const fechaNueva = extenderFecha(fechaAnterior, dias, hoyDMY(ahora));
    servicios[idx] = { ...s, fechaRenovacion: fechaNueva, ultimoPremioJuego: { ganadoId, premio: g.premio.nombre, dias, fechaAnterior, fechaNueva, at: ahora.toISOString() }, updatedAt: ahora.toISOString() };
    tx.update(cRef, { servicios, updatedAt: ahora.toISOString() });
    const entrega = { modo: "automatica", compraId: String(s.compraId || ""), plataforma: String(s.plataforma || ""), dias, fechaAnterior, fechaNueva, por: actor };
    tx.update(gRef, { estado: "entregado", entregadoAt: ahora.toISOString(), expiraAt: "", entrega });
    tx.set(db.collection("auditoria_eventos").doc(), { tipo: "juego_premio_entregado", modulo: "juego", ganadoId, clienteId: g.clienteId, premioId: g.premioId, entrega, usuario: actor, createdAt: ahora.toISOString() });
    out = { id: gSnap.id, ...g, estado: "entregado", entregadoAt: ahora.toISOString(), expiraAt: "", entrega };
  });
  return out;
}

// Admin: marcar entregado (acceso nuevo creado / saldo o descuento aplicado). Libera la reserva de Bodega.
export async function marcarEntregado(db, ganadoId, { actor = "", nota = "", ahora = new Date() } = {}) {
  const gRef = db.collection(COL.ganados).doc(clean(ganadoId, 160));
  let out;
  await db.runTransaction(async (tx) => {
    const gSnap = await tx.get(gRef);
    if (!gSnap.exists) throw ERR("Premio no encontrado.", 404);
    const g = gSnap.data() || {};
    if (g.estado === "entregado") { out = { id: gSnap.id, ...g }; return; }
    let resRef = null, res = null;
    if (g.reservaBodega) { resRef = db.collection(COL.reservas).doc(g.reservaBodega); const r = await tx.get(resRef); res = r.exists ? r.data() || {} : {}; }
    if (resRef) tx.set(resRef, { plataforma: g.reservaBodega, reservados: Math.max(0, num(res.reservados) - 1), updatedAt: ahora.toISOString() });
    const entrega = { modo: "admin", nota: clean(nota, 200), por: clean(actor, 60) };
    tx.update(gRef, { estado: "entregado", entregadoAt: ahora.toISOString(), expiraAt: "", entrega, reservaBodega: "" });
    tx.set(db.collection("auditoria_eventos").doc(), { tipo: "juego_premio_entregado", modulo: "juego", ganadoId: gSnap.id, clienteId: g.clienteId, premioId: g.premioId, entrega, usuario: clean(actor, 60), createdAt: ahora.toISOString() });
    out = { id: gSnap.id, ...g, estado: "entregado", entrega };
  });
  return out;
}

// Premios no entregados después de la fecha límite → VENCIDO (libera reserva y devuelve stock).
export async function vencerPremios(db, { ahora = new Date() } = {}) {
  const snap = await db.collection(COL.ganados).get();
  let vencidos = 0;
  for (const d of snap.docs || []) {
    const g = d.data() || {};
    if (!["reservado", "pendiente_entrega"].includes(g.estado) || !g.expiraAt || Date.parse(g.expiraAt) > ahora.getTime()) continue;
    await db.runTransaction(async (tx) => {
      const s = await tx.get(d.ref || db.collection(COL.ganados).doc(d.id));
      const x = s.data() || {};
      if (!["reservado", "pendiente_entrega"].includes(x.estado)) return;
      if (x.reservaBodega) {
        const rRef = db.collection(COL.reservas).doc(x.reservaBodega); const r = await tx.get(rRef);
        tx.set(rRef, { plataforma: x.reservaBodega, reservados: Math.max(0, num(r.exists ? (r.data() || {}).reservados : 0) - 1), updatedAt: ahora.toISOString() });
      }
      tx.update(db.collection(COL.ganados).doc(d.id), { estado: "vencido", vencidoAt: ahora.toISOString(), reservaBodega: "" });
      vencidos++;
    });
  }
  return vencidos;
}

// Admin (solo Sublicuentas): ANULAR un lote dado por error o de prueba. No borra nada (queda auditado):
// fichas → "anulada", premios → "anulado" (desaparecen del portal), libera cupo de Bodega y devuelve stock.
// Si un premio automático ya sumó días a un servicio, NO se resta solo: se avisa para corregir la fecha a mano.
export async function anularLote(db, loteId, { actor = "", motivo = "", ahora = new Date() } = {}) {
  const lid = clean(loteId, 160);
  if (!lid) throw ERR("Falta el lote.");
  if (clean(motivo, 300).length < 4) throw ERR("Escriba el motivo de la anulación.");
  const loteRef = db.collection(COL.lotes).doc(lid);
  let out;
  await db.runTransaction(async (tx) => {
    const lSnap = await tx.get(loteRef);
    if (!lSnap.exists) throw ERR("Lote no encontrado.", 404);
    const lote = lSnap.data() || {};
    if (lote.estado === "anulado") { out = { loteId: lid, yaAnulado: true, avisos: [] }; return; }
    const n = Math.max(0, Math.floor(num(lote.fichas)));
    const fRefs = [], gRefs = [];
    for (let i = 1; i <= n; i++) { fRefs.push(db.collection(COL.fichas).doc(`${lid}_${i}`)); gRefs.push(db.collection(COL.ganados).doc(`${lid}_${i}`)); }
    const fSnaps = []; for (const r of fRefs) fSnaps.push(await tx.get(r));
    const gSnaps = []; for (const r of gRefs) gSnaps.push(await tx.get(r));
    // Lecturas extra (reservas y stock) antes de cualquier escritura
    const reservas = {}, stock = {};
    for (const g of gSnaps) {
      if (!g.exists) continue; const x = g.data() || {};
      if (["entregado", "anulado", "vencido"].includes(x.estado)) continue;
      if (x.reservaBodega && !(x.reservaBodega in reservas)) { const r = await tx.get(db.collection(COL.reservas).doc(x.reservaBodega)); reservas[x.reservaBodega] = num(r.exists ? (r.data() || {}).reservados : 0); }
      if (x.premioId && !(x.premioId in stock)) { const p = await tx.get(db.collection(COL.premios).doc(x.premioId)); stock[x.premioId] = p.exists ? (p.data() || {}) : null; }
    }
    const avisos = [], cuando = ahora.toISOString(), quien = clean(actor, 60), porque = clean(motivo, 300);
    gSnaps.forEach((g) => {
      if (!g.exists) return; const x = g.data() || {};
      if (x.estado === "anulado") return;
      if (x.estado === "entregado" && x.entregaModo === "automatica" && x.entrega?.fechaNueva)
        avisos.push(`${x.premio?.nombre || x.premioId}: ya se sumó a ${x.entrega.plataforma || "su servicio"} (quedó en ${x.entrega.fechaNueva}). Corrija esa fecha a mano si no corresponde.`);
      else if (x.estado === "entregado") avisos.push(`${x.premio?.nombre || x.premioId}: ya estaba marcado como entregado.`);
      if (!["entregado", "vencido"].includes(x.estado)) {
        if (x.reservaBodega) reservas[x.reservaBodega] = Math.max(0, reservas[x.reservaBodega] - 1);
        const pr = stock[x.premioId]; if (pr && pr.inventarioModo === "stock") pr.stock = num(pr.stock) + 1;
      }
      tx.update(g.ref || db.collection(COL.ganados).doc(g.id), { estado: "anulado", estadoAnterior: x.estado, anuladoAt: cuando, anuladoPor: quien, motivoAnulacion: porque, reservaBodega: "" });
    });
    for (const [plat, val] of Object.entries(reservas)) tx.set(db.collection(COL.reservas).doc(plat), { plataforma: plat, reservados: val, updatedAt: cuando });
    for (const [pid, pr] of Object.entries(stock)) if (pr && pr.inventarioModo === "stock") tx.set(db.collection(COL.premios).doc(pid), pr);
    fSnaps.forEach((f) => { if (f.exists && (f.data() || {}).estado !== "anulada") tx.update(f.ref || db.collection(COL.fichas).doc(f.id), { estado: "anulada", estadoAnterior: (f.data() || {}).estado, anuladaAt: cuando }); });
    tx.update(loteRef, { estado: "anulado", anuladoAt: cuando, anuladoPor: quien, motivoAnulacion: porque });
    tx.set(db.collection("auditoria_eventos").doc(), { tipo: "juego_lote_anulado", modulo: "juego", loteId: lid, clienteId: lote.clienteId, motivo: porque, avisos, usuario: quien, createdAt: cuando });
    out = { loteId: lid, yaAnulado: false, avisos };
  });
  return out;
}

// Vista del cliente (portal): fichas, premios visibles en la máquina e historial. Sin datos internos.
export async function estadoCliente(db, { clienteId, beneficiarioKey = "titular" } = {}) {
  const config = await leerConfig(db);
  const [fichasSnap, ganadosSnap, premios] = await Promise.all([
    db.collection(COL.fichas).where("clienteId", "==", clienteId).get(),
    db.collection(COL.ganados).where("clienteId", "==", clienteId).get(),
    leerPremios(db),
  ]);
  const bk = beneficiarioKey || "titular";
  const fichas = []; fichasSnap.forEach((d) => { const x = d.data() || {}; if ((x.beneficiarioKey || "titular") === bk && x.estado !== "anulada") fichas.push({ id: d.id, estado: x.estado, n: x.n, loteId: x.loteId, createdAt: x.createdAt || "" }); });
  const historial = []; ganadosSnap.forEach((d) => { const x = d.data() || {}; if ((x.beneficiarioKey || "titular") !== bk || x.estado === "anulado") return;
    const vencido = ["reservado", "pendiente_entrega"].includes(x.estado) && x.expiraAt && Date.parse(x.expiraAt) < Date.now();
    historial.push({ id: d.id, premio: x.premio, estado: vencido ? "vencido" : x.estado, ganadoAt: x.ganadoAt, expiraAt: x.expiraAt || "", entregadoAt: x.entregadoAt || "",
      entrega: x.entrega ? { fechaNueva: x.entrega.fechaNueva || "", plataforma: x.entrega.plataforma || "", dias: x.entrega.dias || 0 } : null }); });
  historial.sort((a, b) => String(b.ganadoAt).localeCompare(String(a.ganadoAt)));
  fichas.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.n - b.n);
  return {
    activo: config.activo !== false,
    fichas, disponibles: fichas.filter((f) => f.estado === "disponible").length,
    premios: premios.filter((p) => p.activo !== false).map(premioPublico),
    historial,
  };
}

// Panel administrativo: KPIs, configuración completa, lotes, pendientes y auditoría.
export async function cargarAdmin(db, { ahora = new Date() } = {}) {
  await vencerPremios(db, { ahora });
  const [config, premios, lotesSnap, fichasSnap, ganadosSnap] = await Promise.all([
    leerConfig(db), leerPremios(db), db.collection(COL.lotes).get(), db.collection(COL.fichas).get(), db.collection(COL.ganados).get(),
  ]);
  const mes = ahora.toISOString().slice(0, 7);
  const lotes = []; lotesSnap.forEach((d) => lotes.push({ id: d.id, ...(d.data() || {}) }));
  const ganados = []; ganadosSnap.forEach((d) => ganados.push({ id: d.id, ...(d.data() || {}) }));
  let fichasActivas = 0; fichasSnap.forEach((d) => { if ((d.data() || {}).estado === "disponible") fichasActivas++; });
  lotes.sort((a, b) => String(b.otorgadoAt).localeCompare(String(a.otorgadoAt)));
  ganados.sort((a, b) => String(b.ganadoAt).localeCompare(String(a.ganadoAt)));
  const delMes = ganados.filter((g) => String(g.ganadoAt).slice(0, 7) === mes);
  return {
    config, premios,
    kpis: {
      fichasActivas,
      pendientes: ganados.filter((g) => ["ganado", "reservado", "pendiente_entrega"].includes(g.estado)).length,
      premiumEntregadosMes: delMes.filter((g) => g.tier === "premium" && g.estado === "entregado").length,
      costoMes: delMes.filter((g) => g.estado !== "vencido" && g.estado !== "anulado").reduce((t, g) => t + num(g.costoHnl), 0),
    },
    lotes: lotes.slice(0, 80), ganados: ganados.slice(0, 150),
  };
}

export async function guardarConfig(db, body = {}, { actor = "" } = {}) {
  const c = {
    activo: body.activo !== false,
    maxPremiumPorLote: Math.max(0, Math.min(4, Math.floor(num(body.maxPremiumPorLote, 1)))),
    topeCostoLote: Math.max(0, num(body.topeCostoLote, CONFIG_DEFAULT.topeCostoLote)),
    diasReclamo: Math.max(1, Math.min(60, Math.floor(num(body.diasReclamo, 7)))),
    maxFichasLote: 4,
    updatedAt: new Date().toISOString(), updatedBy: clean(actor, 60),
  };
  await db.collection(COL.config).doc("global").set(c, { merge: true });
  await db.collection("auditoria_eventos").add({ tipo: "juego_config", modulo: "juego", config: c, usuario: clean(actor, 60), createdAt: c.updatedAt });
  return c;
}
export async function guardarPremio(db, body = {}, { actor = "" } = {}) {
  await sembrarPremios(db);
  const p = validarPremio(body);
  await db.collection(COL.premios).doc(p.id).set({ ...p, updatedAt: new Date().toISOString(), updatedBy: clean(actor, 60) });
  await db.collection("auditoria_eventos").add({ tipo: "juego_premio_editado", modulo: "juego", premio: p, usuario: clean(actor, 60), createdAt: new Date().toISOString() });
  return p;
}
