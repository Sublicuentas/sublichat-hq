// api/comercial.js · R209 — GESTIÓN COMERCIAL (Web y APK). POST { accion, ... } con el Bearer de Sublichat.
// · Acceso: módulo «comercial» de Permisos (Sublicuentas, Relojes y Geisell por defecto). El servidor lo valida SIEMPRE.
// · SOLO LEE clientes, ventas (finanzas_movimientos) y el archivo «No renovó» (auditoria_eventos). No escribe en ellos:
//   Control Maestro, Cobros, Recordatorios, Finanzas, regalías y fechas quedan intactos.
// · Escribe únicamente en colecciones nuevas: gc_seguimiento, gc_eventos, gc_oportunidades, gc_plantillas,
//   gc_instantaneas, gc_config (+ auditoria_eventos). Quitar el módulo = borrar estas colecciones; nada depende de ellas.
// · Nunca envía mensajes: el vendedor abre WhatsApp y CONFIRMA que envió. Nunca registra ventas: «Compra concretada»
//   solo VINCULA una venta que ya existe en Finanzas.
import admin from "firebase-admin";
import PERMISOS from "./_permisos.js";
import * as G from "./_comercial.js";
import { BIBLIOTECA } from "./_comercial-plantillas.js";

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID, clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("Faltan credenciales Firebase.");
  return admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}
const errU = (msg, status = 200) => Object.assign(new Error(msg), { publico: msg, status });
const txt = (v, n = 200) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const C = { SEG: "gc_seguimiento", EV: "gc_eventos", OP: "gc_oportunidades", PL: "gc_plantillas", SNAP: "gc_instantaneas", CFG: "gc_config" };

// ------------------------------------------------------------------ base (lectura con caché corta por instancia)
// Una sola lectura de clientes/ventas/archivo cada 5 minutos por instancia, no por usuario ni por pantalla.
const CACHE_MS = 5 * 60e3;
let base = { at: 0, hoy: "", clientes: [], movs: [], noRenovo: [] };
async function leerBase(db, fresco = false) {
  const hoy = G.hoyHN();
  if (!fresco && base.at && Date.now() - base.at < CACHE_MS && base.hoy === hoy) return base;
  const qc = db.collection("clientes");
  const [cs, ms, nr] = await Promise.all([
    (typeof qc.select === "function" ? qc.select("nombrePerfil", "nombre", "telefono", "whatsapp", "telefono_norm", "servicios", "consolidadoEn", "eliminado") : qc).get(),
    db.collection("finanzas_movimientos").where("fechaPago", ">=", G.DESDE_VERIFICABLE).get(),
    db.collection("auditoria_eventos").where("tipo", "==", "cliente_no_renovo").get(),
  ]);
  base = { at: Date.now(), hoy, clientes: cs.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })), movs: ms.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })), noRenovo: nr.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })) };
  return base;
}
async function leerSeg(db) { const s = await db.collection(C.SEG).get(); return new Map(s.docs.map((d) => [d.id, d.data() || {}])); }
async function leerOps(db) { const s = await db.collection(C.OP).get(); return s.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })); }
async function leerCfg(db) { try { const s = await db.collection(C.CFG).doc("general").get(); return { meta: { ...G.META_DEFECTO }, metasDiarias: { vencidos: 15, fidelizar: 10, potenciales: 5 }, ...(s.exists ? s.data() : {}) }; } catch (_) { return { meta: { ...G.META_DEFECTO }, metasDiarias: { vencidos: 15, fidelizar: 10, potenciales: 5 } }; } }

async function todasLasFichas(db, { fresco = false } = {}) {
  const [b, seg, ops] = await Promise.all([leerBase(db, fresco), leerSeg(db), leerOps(db)]);
  const hoy = G.hoyHN();
  const fichas = G.construirFichas({ clientes: b.clientes, movimientos: b.movs, noRenovo: b.noRenovo, seguimientos: seg, hoy });
  const ventas = G.ventasPorCliente(b.movs);
  const porTel = new Map(); for (const c of b.clientes) { const t = G.normTel(c.telefono || c.whatsapp || c.telefono_norm); if (t && !String(c.consolidadoEn || "").trim()) (porTel.get(t) || porTel.set(t, []).get(t)).push(c); }
  const opsF = ops.map((o) => { const f = G.fichaOportunidad(o, seg.get("o_" + o.id) || {}, hoy);
    // sugerencia de conversión: primera venta (compra nueva) del cliente con ese teléfono, después de la cotización
    if (f.estadoOportunidad === "abierta") { const cands = [o.clienteId, ...(porTel.get(f.telefono) || []).map((c) => c.id)].filter(Boolean);
      for (const cid of cands) { const v = (ventas.get(cid) || []).find((x) => x.subtipo === "compra_nueva" && x.fecha >= (G.ymdDe(o.creadoAt) || "")); if (v) { f.ventaSugerida = { ...v, clienteId: cid }; break; } } }
    return f; });
  return { hoy, base: b, seg, fichas: [...fichas, ...opsF], ventas, porTel };
}
async function asegurarFoto(db, hoy, clientes) {
  const ref = db.collection(C.SNAP).doc(hoy);
  try { const s = await ref.get(); if (s.exists) return s.data(); const activos = G.activosDe(clientes, hoy); const d = { fecha: hoy, activos, total: activos.length, creadoAt: new Date().toISOString(), nota: "Foto de apertura del día (primera consulta del módulo)." }; await ref.create(d); return d; }
  catch (_) { return null; }
}

// ------------------------------------------------------------------ vistas
function filaLista(f, cat) {
  const ci = (f.ciclos && f.ciclos[cat]) || {};
  return { key: f.key, tipo: f.tipo, id: f.id, nombre: f.nombre, saludo: f.saludo, telefono: f.telefono, categorias: f.categorias, servicios: f.servicios, archivados: f.archivados || [],
    vigentes: f.vigentes, compras: f.compras, vendedores: f.vendedores, responsable: f.responsable, estado: f.estado, noContactar: f.noContactar, ultimoContacto: f.ultimoContacto, contactos: f.contactos,
    ciclo: ci, inactivo: f.inactivo || "", primeraCompra: f.primeraCompra || null, precioCotizado: f.precioCotizado ?? null, estadoOportunidad: f.estadoOportunidad || "", creadoAt: f.creadoAt || "", creadoPor: f.creadoPor || "",
    ventaSugerida: f.ventaSugerida || null, notas: f.notas || "",
    diasMax: Math.max(-1, ...[...(f.servicios || []), ...(f.archivados || [])].filter((s) => s.estado === "vencido" || s.estado === "no_renovo").map((s) => s.dias ?? -1)) };
}
function filtrar(filas, b = {}, usuario) {
  const q = G.ymdDe ? String(b.q || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim() : "";
  const qd = q.replace(/\D/g, "");
  return filas.filter((f) => {
    if (b.filtro === "hoy" && !(f.ciclo.elegible)) return false;
    if (b.filtro === "programados" && f.ciclo.estado !== "programado") return false;
    if (b.filtro === "vigente" && f.ciclo.estado !== "vigente") return false;
    if (b.filtro === "cerrados" && !["cerrado", "revision"].includes(f.ciclo.estado)) return false;
    if (b.filtro === "bloqueados" && !f.noContactar) return false;
    if (b.filtro === "mios" && f.responsable !== usuario) return false;
    if (b.filtro === "sin_asignar" && f.responsable) return false;
    if (b.dias && !(f.diasMax >= Number(b.dias))) return false;
    if (b.responsable && (b.responsable === "_sin" ? f.responsable : f.responsable !== b.responsable)) return false;
    if (b.plataforma && ![...f.servicios, ...f.archivados].some((s) => s.plataforma === b.plataforma)) return false;
    if (b.vendedor && !f.vendedores.includes(b.vendedor)) return false;
    if (b.estado && f.estado !== b.estado) return false;
    if (q) { const h = (f.nombre + " " + f.telefono + " " + [...f.servicios, ...f.archivados].map((s) => s.servicio + " " + s.plataforma).join(" ")).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (!h.includes(q) && !(qd.length >= 4 && f.telefono.replace(/\D/g, "").includes(qd))) return false; }
    return true;
  });
}
const ORDEN = (a, b) => (b.ciclo.elegible - a.ciclo.elegible) || (a.ciclo.acordada ? -1 : 0) - (b.ciclo.acordada ? -1 : 0) || String(a.ciclo.sugerida || "9").localeCompare(String(b.ciclo.sugerida || "9")) || (b.diasMax - a.diasMax);

// ------------------------------------------------------------------ handler
export function _reiniciarCache() { base = { at: 0, hoy: "", clientes: [], movs: [], noRenovo: [] }; }
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST." });
  let db, user;
  try {
    db = getApp().firestore();
    const auth = String(req.headers.authorization || ""); const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) return res.status(401).json({ ok: false, error: "Sesión requerida." });
    try { user = await admin.auth().verifyIdToken(token); } catch (_) { return res.status(401).json({ ok: false, error: "Sesión inválida o vencida." }); }
  } catch (e) { return res.status(500).json({ ok: false, error: "Servidor sin configurar." }); }
  return handleComercial(db, user, req.body || {}, res);
}
// Núcleo sin red (las pruebas lo llaman con Firestore simulado y un usuario ficticio).
export async function handleComercial(db, user, b, res) {
  const usuario = G.claveUsuario(user.usuario || String(user.uid || "").replace(/^(asesor|admin)-/, ""));
  const puede = await PERMISOS.decidir(db, user, "comercial", ["sublicuentas", "relojes", "geisell"].includes(usuario));
  if (!puede) return res.status(403).json({ ok: false, error: "Su usuario no tiene Gestión comercial. Sublicuentas lo activa en Permisos." });
  const esAdmin = PERMISOS.esSupervisor(user);
  const accion = txt(b.accion, 40); const ahora = new Date().toISOString();
  const ok = (d) => res.status(200).json({ ok: true, ...d });
  const audit = (tx, ev) => tx.set(db.collection("auditoria_eventos").doc(), { modulo: "comercial", actorUsuario: usuario, origen: txt(b.origen || "web", 10), createdAt: ahora, ...ev });
  try {
    // ---------------------------------------------------------------- PANEL (meta, 3 tarjetas, agenda, rendimiento de hoy)
    if (accion === "panel") {
      const [{ hoy, base: bb, fichas }, cfg] = await Promise.all([todasLasFichas(db, { fresco: b.fresco === true }), leerCfg(db)]);
      const activos = G.activosDe(bb.clientes, hoy); const foto = await asegurarFoto(db, hoy, bb.clientes);
      const evs = (await db.collection(C.EV).where("fecha", "==", hoy).get()).docs.map((d) => d.data());
      const yo = G.rendimiento(evs, { desde: hoy, hasta: hoy }); const mio = yo.find((r) => r.usuario === usuario) || { enviados: 0, porCat: { vencidos: 0, fidelizar: 0, potenciales: 0 }, ventas: 0 };
      const eq = yo.reduce((a, r) => ({ enviados: a.enviados + r.enviados, ventas: a.ventas + r.ventas }), { enviados: 0, ventas: 0 });
      const nuevosHoy = new Set(); for (const [cid, v] of G.ventasPorCliente(bb.movs)) if (v[0] && v[0].subtipo === "compra_nueva" && v[0].fecha === hoy) nuevosHoy.add(cid);
      const mov = foto ? G.movimientosCartera(foto.activos || [], activos, nuevosHoy) : null;
      const cnt = (cat) => fichas.filter((f) => f.categorias.includes(cat) && !(cat === "potenciales" && f.estadoOportunidad !== "abierta")).length;
      const toca = (cat) => fichas.filter((f) => f.categorias.includes(cat) && f.ciclos[cat] && f.ciclos[cat].elegible && (!f.responsable || f.responsable === usuario)).length;
      const agenda = G.ORDEN_CAT.map((cat) => ({ cat, nombre: G.CATEGORIAS[cat].nombre, hora: G.CATEGORIAS[cat].hora, meta: cfg.metasDiarias[cat] ?? G.CATEGORIAS[cat].meta, pendientes: toca(cat), hechos: mio.porCat[cat] || 0 }));
      const metaDia = agenda.reduce((a, x) => a + Math.min(x.meta, x.pendientes + x.hechos), 0);
      return ok({ hoy, usuario, nombreUsuario: G.USUARIOS[usuario] || usuario, esAdmin, meta: { ...cfg.meta, actual: activos.length }, conteos: { vencidos: cnt("vencidos"), fidelizar: cnt("fidelizar"), potenciales: cnt("potenciales"), activos: activos.length },
        agenda, hoyRend: { contactos: mio.enviados, metaNominal: agenda.reduce((a, x) => a + x.meta, 0), metaDisponible: metaDia, recuperados: mov ? mov.recuperados.length : null, nuevos: mov ? mov.nuevos.length : null, perdidos: mov ? mov.perdidos.length : null, ventas: mio.ventas, equipo: eq },
        fotoApertura: foto ? { fecha: foto.fecha, total: foto.total, creadoAt: foto.creadoAt } : null, desdeVerificable: G.DESDE_VERIFICABLE, estados: G.ESTADOS, categorias: G.CATEGORIAS, usuarios: G.USUARIOS });
    }
    // ---------------------------------------------------------------- LISTAS (Vencidos / Por fidelizar / Potenciales)
    if (accion === "lista") {
      const cat = G.CATEGORIAS[b.cat] ? b.cat : "vencidos";
      const { hoy, fichas } = await todasLasFichas(db);
      let filas = fichas.filter((f) => f.categorias.includes(cat)).map((f) => filaLista(f, cat));
      if (cat === "potenciales" && b.filtro !== "cerrados" && b.filtro !== "todas") filas = filas.filter((f) => f.estadoOportunidad === "abierta");
      const conteo = { todos: filas.length, hoy: filas.filter((f) => f.ciclo.elegible).length, programados: filas.filter((f) => f.ciclo.estado === "programado").length, mios: filas.filter((f) => f.responsable === usuario).length,
        sin_asignar: filas.filter((f) => !f.responsable).length, cerrados: filas.filter((f) => ["cerrado", "revision"].includes(f.ciclo.estado)).length, bloqueados: filas.filter((f) => f.noContactar).length, vigente: filas.filter((f) => f.ciclo.estado === "vigente").length };
      const plataformas = [...new Set(filas.flatMap((f) => [...f.servicios, ...f.archivados].map((s) => s.plataforma)).filter(Boolean))].sort();
      const vendedores = [...new Set(filas.flatMap((f) => f.vendedores))].filter(Boolean).sort();
      filas = filtrar(filas, b, usuario).sort(ORDEN);
      const por = Math.min(Math.max(Number(b.porPagina) || 30, 10), 3000); const pag = Math.max(1, Number(b.pagina) || 1);
      return ok({ hoy, cat, total: filas.length, pagina: pag, paginas: Math.max(1, Math.ceil(filas.length / por)), filas: filas.slice((pag - 1) * por, pag * por), conteo, plataformas, vendedores, usuario, esAdmin });
    }
    // ---------------------------------------------------------------- FICHA + historial
    if (accion === "ficha") {
      const key = txt(b.key, 120); const { hoy, fichas, ventas } = await todasLasFichas(db);
      let f = fichas.find((x) => x.key === key);
      if (!f && key.startsWith("c_")) { // cliente sin categoría hoy (renovó / ya fue fidelizado): ficha mínima para su historial
        const s = await db.collection("clientes").doc(key.slice(2)).get(); if (!s.exists) throw errU("Esa ficha ya no existe.");
        const d = s.data() || {}; f = { tipo: "cliente", id: s.id, key, nombre: txt(d.nombrePerfil || d.nombre, 80), telefono: G.normTel(d.telefono || d.whatsapp), servicios: (d.servicios || []).map((x) => G.servicioComercial(x, hoy)), archivados: [], categorias: [], ciclos: {}, compras: (ventas.get(s.id) || []).length || null, ventas: (ventas.get(s.id) || []).slice(-10) };
      }
      if (!f) throw errU("Esa ficha ya no existe.");
      const ev = (await db.collection(C.EV).where("sujeto", "==", key).get()).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, z) => String(z.at).localeCompare(String(a.at)));
      const cidV = f.tipo === "cliente" ? f.id : (f.ventaSugerida && f.ventaSugerida.clienteId) || f.clienteId;
      const ventasCliente = cidV ? (ventas.get(cidV) || []).filter((v) => v.fecha >= G.sumarDias(hoy, -60)) : [];
      return ok({ hoy, ficha: f, historial: ev.slice(0, 80), ventasVinculables: ventasCliente, estados: G.ESTADOS, etapas: G.ETAPAS });
    }
    // ---------------------------------------------------------------- REGISTRAR CONTACTO / RESULTADO
    if (accion === "evento") {
      const key = txt(b.key, 120), cat = G.CATEGORIAS[b.categoria] ? b.categoria : "";
      const etapa = ["preparado", "abierto", "enviado", "respuesta"].includes(b.etapa) ? b.etapa : "";
      const resultado = b.resultado ? (G.ESTADOS[b.resultado] ? b.resultado : "") : "";
      if (!key || !cat || !etapa) throw errU("Faltan datos del contacto.");
      if (b.resultado && !resultado) throw errU("Resultado no válido.");
      const proximo = b.proximo ? G.ymdDe(b.proximo) : "";
      if (b.proximo && !proximo) throw errU("Fecha de próximo seguimiento inválida.");
      const { hoy, fichas, ventas } = await todasLasFichas(db);
      if (proximo && proximo < hoy) throw errU("La próxima fecha no puede ser anterior a hoy.");
      const f = fichas.find((x) => x.key === key); if (!f || !f.categorias.includes(cat)) throw errU("Esa ficha ya no está en esa categoría (puede que ya renovó). Actualice la lista.");
      let venta = null;
      if (resultado === "compra_concretada") {
        const cid = f.tipo === "cliente" ? f.id : (b.clienteId || (f.ventaSugerida && f.ventaSugerida.clienteId) || f.clienteId);
        venta = (ventas.get(cid) || []).find((v) => v.id === txt(b.ventaId, 120));
        if (!venta) throw errU("«Compra concretada» necesita una venta ya registrada en Finanzas. Elija la venta de la lista; un mensaje copiado no es una venta.");
        venta = { ...venta, clienteId: cid };
      }
      const texto = etapa === "enviado" ? txt(b.texto, 1500) : "";
      const pl = txt(b.plantillaId, 40);
      if (etapa === "enviado" && pl && /\{\{[^}]+\}\}/.test(texto)) throw errU("El mensaje todavía tiene variables sin resolver ({{…}}).");
      const segRef = db.collection(C.SEG).doc(key), evRef = db.collection(C.EV).doc();
      const r = await db.runTransaction(async (tx) => {
        const ss = await tx.get(segRef); const s = ss.exists ? ss.data() || {} : {};
        const opRef = f.tipo === "oportunidad" ? db.collection(C.OP).doc(f.id) : null; const opS = opRef ? await tx.get(opRef) : null;
        if (s.noContactar && ["abierto", "enviado"].includes(etapa)) throw errU("Este contacto pidió no recibir mensajes. Está bloqueado.");
        if (s.responsable && s.responsable !== usuario && !esAdmin && ["abierto", "enviado"].includes(etapa)) throw errU(`Este seguimiento lo atiende ${G.USUARIOS[s.responsable] || s.responsable}.`);
        if (etapa === "enviado" && s.ultimoEnvio === hoy && b.forzar !== true) throw errU("A este cliente ya se le escribió hoy (aunque esté en otra categoría). No se duplica el contacto.");
        const ancla = (f.ciclos[cat] && f.ciclos[cat].ancla) || "";
        const ci = { ...(((s.ciclos || {})[cat]) || {}) }; if (ci.ancla !== ancla) { ci.ancla = ancla; ci.paso = 0; ci.cerrado = false; ci.motivo = ""; ci.proximo = ""; }
        const n = { actualizadoAt: ahora, actualizadoPor: usuario, sujetoTipo: f.tipo, sujetoId: f.id };
        if (etapa === "enviado") { ci.paso = Number(ci.paso || 0) + 1; ci.ultimoEnvio = hoy; n.ultimoEnvio = hoy; n.ultimoEnvioAt = ahora; n.contactos = Number(s.contactos || 0) + 1; if (!s.responsable) n.responsable = usuario; }
        if (resultado) { n.estado = resultado; n.estadoAt = ahora; if (G.ESTADOS[resultado].cierra) { ci.cerrado = true; ci.motivo = resultado; } }
        if (resultado === "no_contactar") { n.noContactar = true; n.noContactarAt = ahora; n.noContactarPor = usuario; }
        ci.proximo = proximo || (etapa === "enviado" || resultado ? "" : ci.proximo || "");
        if (b.notas != null) n.notas = txt(b.notas, 500);
        n.ciclos = { ...(s.ciclos || {}), [cat]: ci };
        tx.set(segRef, n, { merge: true });
        if (opRef && opS && opS.exists && resultado && G.ESTADOS[resultado].cierra) tx.set(opRef, { estado: resultado === "compra_concretada" ? "convertida" : "cerrada", motivo: resultado, cerradoAt: ahora, cerradoPor: usuario, ...(venta ? { ventaId: venta.id, clienteId: venta.clienteId, montoVenta: venta.monto } : {}) }, { merge: true });
        tx.set(evRef, { sujeto: key, sujetoTipo: f.tipo, sujetoId: f.id, nombre: f.nombre || "", categoria: cat, servicio: txt(b.servicio, 60), plantillaId: pl, plantillaVersion: Number(b.plantillaVersion) || null,
          texto, etapa, resultado, notas: txt(b.notas, 500), proximo, autor: usuario, at: ahora, fecha: hoy, ...(venta ? { ventaId: venta.id, monto: venta.monto, ventaFecha: venta.fecha, clienteVenta: venta.clienteId } : {}) });
        if (resultado === "compra_concretada" || resultado === "no_contactar") audit(tx, { accion: "gc_" + resultado, targetType: f.tipo, targetId: f.id, detalle: venta ? `Venta ${venta.id} vinculada` : "Baja comercial" });
        return { paso: ci.paso, ultimoEnvio: n.ultimoEnvio || s.ultimoEnvio || "" };
      });
      return ok({ eventoId: evRef.id, ...r });
    }
    // ---------------------------------------------------------------- ASIGNACIÓN (transaccional: solo uno se queda la tarea)
    if (accion === "tomar" || accion === "soltar" || accion === "asignar") {
      const keys = (accion === "asignar" ? (Array.isArray(b.keys) ? b.keys : []) : [b.key]).map((k) => txt(k, 120)).filter(Boolean).slice(0, 200);
      const para = accion === "tomar" ? usuario : accion === "soltar" ? "" : G.claveUsuario(b.usuario);
      if (accion === "asignar" && !esAdmin) throw errU("Solo Sublicuentas reasigna seguimientos.");
      if (accion === "asignar" && para && !G.USUARIOS[para]) throw errU("Usuario no válido.");
      if (!keys.length) throw errU("Elija al menos un cliente.");
      const hechos = [], ocupados = [];
      for (const key of keys) {
        const ref = db.collection(C.SEG).doc(key);
        // el resultado sale del intento que CONFIRMA (Firestore reintenta la transacción si otro se adelantó)
        const r = await db.runTransaction(async (tx) => {
          const s = await tx.get(ref); const d = s.exists ? s.data() || {} : {};
          if (accion === "tomar" && d.responsable && d.responsable !== usuario) return { ocupado: G.USUARIOS[d.responsable] || d.responsable };
          if (accion === "soltar" && d.responsable && d.responsable !== usuario && !esAdmin) return { ocupado: G.USUARIOS[d.responsable] || d.responsable };
          const hist = [...(Array.isArray(d.asignaciones) ? d.asignaciones : []), { de: d.responsable || "", a: para, por: usuario, at: ahora, accion }].slice(-20);
          tx.set(ref, { responsable: para, asignadoAt: ahora, asignadoPor: usuario, asignaciones: hist }, { merge: true });
          if (accion === "asignar" && d.responsable && d.responsable !== para) audit(tx, { accion: "gc_reasignar", targetType: "seguimiento", targetId: key, detalle: `${d.responsable} → ${para || "sin asignar"}` });
          return { ok: true };
        });
        if (r && r.ok) hechos.push(key); else ocupados.push({ key, responsable: r.ocupado });
      }
      if (accion === "tomar" && ocupados.length && !hechos.length) throw errU(`Ya lo tomó ${ocupados[0].responsable}.`);
      return ok({ hechos, ocupados });
    }
    if (accion === "no_contactar") {
      const key = txt(b.key, 120), valor = b.valor !== false;
      if (!valor && !esAdmin) throw errU("Solo Sublicuentas puede quitar el bloqueo «No contactar».");
      await db.runTransaction(async (tx) => { const ref = db.collection(C.SEG).doc(key); tx.set(ref, { noContactar: valor, noContactarAt: ahora, noContactarPor: usuario, ...(valor ? { estado: "no_contactar" } : {}) }, { merge: true }); audit(tx, { accion: valor ? "gc_no_contactar" : "gc_quitar_no_contactar", targetType: "seguimiento", targetId: key }); });
      return ok({ key, noContactar: valor });
    }
    // ---------------------------------------------------------------- POTENCIALES (alta rápida: teléfono + servicio)
    if (accion === "oportunidad_crear" || accion === "oportunidad_editar") {
      const tel = G.normTel(b.telefono); if (!tel) throw errU("Escriba un teléfono válido (con código de país si no es de Honduras).");
      const servicios = (Array.isArray(b.servicios) ? b.servicios : String(b.servicios || "").split(",")).map((x) => txt(x, 40)).filter(Boolean).slice(0, 8);
      if (!servicios.length) throw errU("Elija al menos un servicio cotizado.");
      const precio = b.precio === "" || b.precio == null ? null : Number(b.precio); if (precio != null && !(precio > 0 && precio < 100000)) throw errU("Precio cotizado inválido.");
      const proximo = b.proximo ? G.ymdDe(b.proximo) : ""; if (b.proximo && !proximo) throw errU("Fecha inválida.");
      const { base: bb, ventas, porTel } = await todasLasFichas(db);
      const id = accion === "oportunidad_editar" ? txt(b.id, 60) : "";
      const abiertas = (await db.collection(C.OP).where("tel", "==", tel).get()).docs.filter((d) => d.id !== id && (d.data() || {}).estado === "abierta");
      if (abiertas.length) throw errU(`Ya hay una oportunidad abierta con ese teléfono (${txt(abiertas[0].data().nombre || "sin nombre", 40)}). Ábrala en lugar de duplicarla.`);
      let clienteId = "";
      const mismos = porTel.get(tel) || [];
      for (const c of mismos) {
        const tiene = (c.servicios || []).length || (ventas.get(c.id) || []).length;
        if (tiene && b.confirmarCliente !== true) return ok({ duplicado: true, cliente: { id: c.id, nombre: txt(c.nombrePerfil || c.nombre, 60) }, aviso: "Ese teléfono ya es de un cliente con servicios o compras. No es un potencial: búsquelo en Vencidos / Por fidelizar o en Clientes." });
        clienteId = c.id;
      }
      const datos = { tel, telefono: txt(b.telefono, 30), nombre: txt(b.nombre, 80), servicios, precio, notas: txt(b.notas, 500), proximo, clienteId, actualizadoAt: ahora, actualizadoPor: usuario };
      if (accion === "oportunidad_crear") {
        const ref = db.collection(C.OP).doc();
        await db.runTransaction(async (tx) => { tx.set(ref, { ...datos, estado: "abierta", creadoAt: ahora, creadoPor: usuario, responsable: usuario });
          tx.set(db.collection(C.SEG).doc("o_" + ref.id), { responsable: usuario, sujetoTipo: "oportunidad", sujetoId: ref.id, ...(proximo ? { ciclos: { potenciales: { ancla: G.ymdDe(ahora), paso: 0, proximo } } } : {}), actualizadoAt: ahora }, { merge: true }); });
        return ok({ id: ref.id, clienteId, vinculado: !!clienteId });
      }
      const ref = db.collection(C.OP).doc(id); const s = await ref.get(); if (!s.exists) throw errU("Esa oportunidad ya no existe.");
      await ref.set(datos, { merge: true });
      return ok({ id, clienteId });
    }
    if (accion === "oportunidad_cerrar") {
      const id = txt(b.id, 60); const motivo = ["no_interesado", "otro_proveedor", "no_contactar"].includes(b.motivo) ? b.motivo : "no_interesado";
      const ref = db.collection(C.OP).doc(id); const s = await ref.get(); if (!s.exists) throw errU("Esa oportunidad ya no existe.");
      await db.runTransaction(async (tx) => { tx.set(ref, { estado: "cerrada", motivo, cerradoAt: ahora, cerradoPor: usuario }, { merge: true });
        const segRef = db.collection(C.SEG).doc("o_" + id); tx.set(segRef, { estado: motivo, ...(motivo === "no_contactar" ? { noContactar: true } : {}), actualizadoAt: ahora }, { merge: true });
        tx.set(db.collection(C.EV).doc(), { sujeto: "o_" + id, sujetoTipo: "oportunidad", sujetoId: id, nombre: (s.data() || {}).nombre || "", categoria: "potenciales", etapa: "respuesta", resultado: motivo, autor: usuario, at: ahora, fecha: G.hoyHN(), notas: txt(b.notas, 300) }); });
      return ok({ id, estado: "cerrada" });
    }
    // ---------------------------------------------------------------- BIBLIOTECA
    if (accion === "plantillas") {
      const s = await db.collection(C.PL).get(); const loc = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      const lista = loc.length ? loc : BIBLIOTECA.plantillas.map((p) => ({ ...p, version: 1, origen: "biblioteca", importada: false }));
      // variantes usadas recientemente con este cliente (para ofrecer otra)
      let recientes = []; if (b.key) recientes = (await db.collection(C.EV).where("sujeto", "==", txt(b.key, 120)).get()).docs.map((d) => d.data()).filter((e) => e.plantillaId && e.etapa === "enviado").map((e) => ({ id: e.plantillaId, fecha: e.fecha }));
      return ok({ plantillas: lista.sort((a, z) => a.id.localeCompare(z.id)), importadas: loc.length > 0, totalOrigen: BIBLIOTECA.plantillas.length, recientes, situaciones: situaciones(lista) });
    }
    if (accion === "plantillas_importar") {
      if (!esAdmin) throw errU("Solo Sublicuentas importa la biblioteca.");
      const s = await db.collection(C.PL).get(); const ex = new Map(s.docs.map((d) => [d.id, d.data()]));
      const plan = G.planImportacion(BIBLIOTECA.plantillas, ex);
      const escribir = [...plan.crear, ...(b.actualizar === true ? plan.actualizar : [])];
      for (let i = 0; i < escribir.length; i += 400) {
        const batch = db.batch();
        for (const p of escribir.slice(i, i + 400)) { const e = ex.get(p.id); batch.set(db.collection(C.PL).doc(p.id), { ...p, version: e ? Number(e.version || 1) + 1 : 1, origen: "biblioteca", editadaLocal: false, importadaAt: ahora, importadaPor: usuario,
          historial: [...((e && e.historial) || []), { version: e ? Number(e.version || 1) + 1 : 1, at: ahora, por: usuario, accion: e ? "actualizada_desde_biblioteca" : "importada" }].slice(-20) }); }
        await batch.commit();
      }
      await db.collection("auditoria_eventos").add({ modulo: "comercial", accion: "gc_importar_plantillas", actorUsuario: usuario, createdAt: ahora, detalle: `${plan.crear.length} nuevas · ${plan.igual.length} iguales · ${plan.conCambiosLocales.length} con cambios locales (no tocadas)` });
      return ok({ nuevas: plan.crear.length, iguales: plan.igual.length, conCambiosLocales: plan.conCambiosLocales, pendientesActualizar: b.actualizar === true ? 0 : plan.actualizar.length, total: ex.size + plan.crear.length });
    }
    if (accion === "plantilla_guardar") {
      if (!esAdmin) throw errU("Solo Sublicuentas edita la biblioteca.");
      const cat = G.CATEGORIAS[b.categoria] ? b.categoria : ""; if (!cat) throw errU("Elija la categoría.");
      const mensaje = String(b.mensaje || "").replace(/\r/g, "").trim().slice(0, 1200); if (mensaje.length < 10) throw errU("Escriba el mensaje.");
      const situacion = txt(b.situacion, 40).toLowerCase().replace(/[^a-z_]/g, "_") || "general";
      let id = txt(b.id, 40); const ref = id ? db.collection(C.PL).doc(id) : null;
      const r = await db.runTransaction(async (tx) => {
        let prev = null; if (ref) { const s = await tx.get(ref); prev = s.exists ? s.data() : null; }
        if (!ref || !prev || b.duplicar === true) { const n = (await tx.get(db.collection(C.PL).where("categoria", "==", cat))).size + 1; id = `GC-${cat.toUpperCase()}-L${String(n).padStart(3, "0")}-${Date.now().toString(36).slice(-4)}`; prev = null; }
        const version = prev ? Number(prev.version || 1) + 1 : 1;
        const vars = [...new Set((mensaje.match(/\{\{\s*([a-z_]+)\s*\}\}/g) || []).map((x) => x.replace(/[{}\s]/g, "")))];
        tx.set(db.collection(C.PL).doc(id), { id, categoria: cat, situacion, situacion_label: txt(b.situacion_label || (prev && prev.situacion_label) || situacion, 60), mensaje, variables_requeridas: vars, activa: b.activa !== false, version,
          origen: prev ? prev.origen || "local" : "local", editadaLocal: true, actualizadoAt: ahora, actualizadoPor: usuario, historial: [...((prev && prev.historial) || []), { version, at: ahora, por: usuario, accion: prev ? "editada" : b.duplicar ? "duplicada" : "creada", anterior: prev ? String(prev.mensaje || "").slice(0, 400) : "" }].slice(-20) });
        return { id, version };
      });
      return ok(r);
    }
    // ---------------------------------------------------------------- META y REPORTES
    if (accion === "meta_guardar") {
      if (!esAdmin) throw errU("Solo Sublicuentas cambia la meta.");
      const ref = Number(b.referencia), obj = Number(b.objetivo); if (!(obj > 0)) throw errU("Escriba la meta de clientes.");
      const md = {}; for (const c of G.ORDEN_CAT) { const v = Number((b.metasDiarias || {})[c]); if (v >= 0 && v <= 200) md[c] = v; }
      await db.collection(C.CFG).doc("general").set({ meta: { referencia: ref > 0 ? ref : null, objetivo: obj, mes: txt(b.mes, 7) }, ...(Object.keys(md).length ? { metasDiarias: md } : {}), actualizadoAt: ahora, actualizadoPor: usuario }, { merge: true });
      return ok({});
    }
    if (accion === "reporte") {
      const desde = G.ymdDe(b.desde), hasta = G.ymdDe(b.hasta); if (!desde || !hasta || desde > hasta) throw errU("Elija un período válido.");
      const filtroU = b.usuario ? G.claveUsuario(b.usuario) : "", filtroP = txt(b.plataforma, 30), filtroC = G.CATEGORIAS[b.categoria] ? b.categoria : "";
      const [{ hoy, base: bb, fichas }, cfg] = await Promise.all([todasLasFichas(db), leerCfg(db)]);
      const evs = (await db.collection(C.EV).where("fecha", ">=", desde).get()).docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => e.fecha <= hasta && (!filtroU || G.claveUsuario(e.autor) === filtroU) && (!filtroC || e.categoria === filtroC));
      const fotos = (await db.collection(C.SNAP).where("fecha", ">=", G.sumarDias(desde, -1)).get()).docs.map((d) => d.data()).filter((x) => x.fecha <= hasta).sort((a, z) => a.fecha.localeCompare(z.fecha));
      const ventasCli = G.ventasPorCliente(bb.movs);
      const primeras = new Map(); for (const [cid, v] of ventasCli) if (v[0] && v[0].subtipo === "compra_nueva") primeras.set(cid, v[0].fecha);
      const crecimiento = []; for (let i = 1; i < fotos.length; i++) { const nu = new Set([...primeras].filter(([, f]) => f > fotos[i - 1].fecha && f <= fotos[i].fecha).map(([c]) => c)); const m = G.movimientosCartera(fotos[i - 1].activos || [], fotos[i].activos || [], nu); crecimiento.push({ fecha: fotos[i].fecha, activos: fotos[i].total, nuevos: m.nuevos.length, recuperados: m.recuperados.length, perdidos: m.perdidos.length, neto: m.neto }); }
      if (hasta >= hoy && fotos.length) { const ult = fotos[fotos.length - 1]; const act = G.activosDe(bb.clientes, hoy); const nu = new Set([...primeras].filter(([, f]) => f >= ult.fecha).map(([c]) => c)); const m = G.movimientosCartera(ult.activos || [], act, nu); crecimiento.push({ fecha: hoy + " (ahora)", activos: act.length, nuevos: m.nuevos.length, recuperados: m.recuperados.length, perdidos: m.perdidos.length, neto: m.neto }); }
      const rend = G.rendimiento(evs, { desde, hasta });
      const ventasVinc = new Map(); for (const e of evs) if (e.resultado === "compra_concretada" && e.ventaId && !ventasVinc.has(e.ventaId)) ventasVinc.set(e.ventaId, { ventaId: e.ventaId, monto: Number(e.monto) || 0, fecha: e.ventaFecha || e.fecha, categoria: e.categoria, autor: G.USUARIOS[G.claveUsuario(e.autor)] || e.autor, sujeto: e.sujeto, nombre: e.nombre });
      const conPlat = (f) => !filtroP || [...(f.servicios || []), ...(f.archivados || [])].some((s) => s.plataforma === filtroP);
      const conVend = (f) => !filtroU || f.responsable === filtroU || (f.vendedores || []).includes(G.USUARIOS[filtroU]);
      const lista = (cat) => fichas.filter((f) => f.categorias.includes(cat) && conPlat(f) && conVend(f)).map((f) => filaLista(f, cat));
      const motivos = {}; for (const e of evs) if (e.resultado) motivos[e.resultado] = (motivos[e.resultado] || 0) + 1;
      // efectividad por plantilla: usos confirmados, respuestas y ventas asociadas (la última plantilla enviada antes del resultado)
      const ult = new Map(), efect = {};
      for (const e of [...evs].sort((a, z) => String(a.at).localeCompare(String(z.at)))) {
        if (e.etapa === "enviado" && e.plantillaId) { ult.set(e.sujeto, e.plantillaId); const x = efect[e.plantillaId] || (efect[e.plantillaId] = { plantillaId: e.plantillaId, categoria: e.categoria, usos: 0, respuestas: new Set(), ventas: new Set(), ingresos: 0 }); x.usos++; }
        const pid = ult.get(e.sujeto); if (!pid || !e.resultado || !efect[pid]) continue;
        if (G.ESTADOS[e.resultado] && G.ESTADOS[e.resultado].respondio) efect[pid].respuestas.add(e.sujeto);
        if (e.resultado === "compra_concretada" && e.ventaId && !efect[pid].ventas.has(e.ventaId)) { efect[pid].ventas.add(e.ventaId); efect[pid].ingresos += Number(e.monto) || 0; }
      }
      const porPlat = {}; for (const m of bb.movs) { if (!G.esVentaValida(m)) continue; const f = G.ymdDe(m.fechaPago) || G.ymdDe(m.fecha); if (!f || f < desde || f > hasta) continue; const p = String(m.plataforma || "sin_plataforma"); if (filtroP && p !== filtroP) continue; const x = porPlat[p] || (porPlat[p] = { plataforma: p, compras: 0, renovaciones: 0, ingresos: 0, vencidosAhora: 0 }); m.subtipo === "compra_nueva" ? x.compras++ : x.renovaciones++; x.ingresos += Number(m.monto) || 0; }
      for (const f of fichas) if (f.categorias.includes("vencidos")) for (const s of [...f.servicios.filter((s) => s.estado === "vencido"), ...(f.archivados || [])]) { if (filtroP && s.plataforma !== filtroP) continue; const x = porPlat[s.plataforma] || (porPlat[s.plataforma] = { plataforma: s.plataforma, compras: 0, renovaciones: 0, ingresos: 0, vencidosAhora: 0 }); x.vencidosAhora++; }
      const contactados = new Set(evs.filter((e) => e.etapa === "enviado").map((e) => e.sujeto));
      const totC = crecimiento.reduce((a, x) => ({ nuevos: a.nuevos + x.nuevos, recuperados: a.recuperados + x.recuperados, perdidos: a.perdidos + x.perdidos }), { nuevos: 0, recuperados: 0, perdidos: 0 });
      return ok({ generadoAt: ahora, zona: "America/Tegucigalpa", moneda: "HNL", filtros: { desde, hasta, usuario: filtroU, plataforma: filtroP, categoria: filtroC }, hoy,
        resumen: { meta: { ...cfg.meta, actual: G.activosDe(bb.clientes, hoy).length }, ...totC, neto: totC.nuevos + totC.recuperados - totC.perdidos, contactosConfirmados: evs.filter((e) => e.etapa === "enviado").length, personasContactadas: contactados.size,
          respondieron: new Set(evs.filter((e) => e.resultado && G.ESTADOS[e.resultado] && G.ESTADOS[e.resultado].respondio).map((e) => e.sujeto)).size, ventasVinculadas: ventasVinc.size, ingresosVinculados: [...ventasVinc.values()].reduce((a, v) => a + v.monto, 0),
          conversion: contactados.size ? Math.round((new Set([...ventasVinc.values()].map((v) => v.sujeto)).size / contactados.size) * 1000) / 10 : null, denominador: contactados.size, fotosDisponibles: fotos.length, desdeVerificable: G.DESDE_VERIFICABLE },
        vencidos: filtroC && filtroC !== "vencidos" ? [] : lista("vencidos"), fidelizar: filtroC && filtroC !== "fidelizar" ? [] : lista("fidelizar"), potenciales: filtroC && filtroC !== "potenciales" ? [] : lista("potenciales"),
        rendimiento: rend.map((r) => ({ ...r, ventaIds: undefined, metas: cfg.metasDiarias })), historial: evs.sort((a, z) => String(z.at).localeCompare(String(a.at))).slice(0, 5000), motivos,
        crecimiento, efectividad: Object.values(efect).map((x) => ({ ...x, respuestas: x.respuestas.size, ventas: x.ventas.size })), plataformas: Object.values(porPlat).map((x) => ({ ...x, nombre: G.nombreServicio(x.plataforma) || x.plataforma })), ventasVinculadas: [...ventasVinc.values()] });
    }
    return res.status(400).json({ ok: false, error: "Acción no reconocida." });
  } catch (e) {
    if (e && e.publico) return res.status(e.status || 200).json({ ok: false, error: e.publico });
    console.error("comercial", accion, e);
    return res.status(500).json({ ok: false, error: "No se pudo completar. Intente de nuevo." });
  }
}
function situaciones(lista) { const m = {}; for (const p of lista) { const k = p.categoria + ":" + p.situacion; if (!m[k]) m[k] = { categoria: p.categoria, situacion: p.situacion, label: p.situacion_label || p.situacion, n: 0 }; m[k].n++; } return Object.values(m); }
