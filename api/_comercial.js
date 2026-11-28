// api/_comercial.js · R209 — GESTIÓN COMERCIAL (lógica pura, sin Firestore ni red: se prueba con datos sintéticos).
// Documento maestro v1.0 (27/11/2026) + decisiones del dueño (27/11/2026):
//   · Sin «Promesas de pago»: esos clientes son Vencidos.
//   · «Por fidelizar» solo con ventas verificables desde el 01/10/2026 (finanzas_movimientos).
//   · Vencidos incluye a quien el sistema archivó «No renovó» en los últimos 90 días y ya no tiene NADA vigente.
//   · Usuarios: Sublicuentas, Relojes y Geisell (ven toda la cartera; cada tarea tiene un responsable).
// Las categorías son VISTAS de la misma ficha (un cliente puede estar en Vencidos y Por fidelizar): nunca copias.
// Nunca se inventan fechas, compras, precios ni vendedores: lo que no existe sale «No verificable» / «Sin asignar».
import { normPlataformaKey } from "./_catalogo-categorias.js";
import { nombrePlataforma } from "./_finanzas-ganancias.js";

export const DESDE_VERIFICABLE = "2026-10-01";
export const DIAS_NO_RENOVO = 90;
export const CATEGORIAS = Object.freeze({
  vencidos: { id: "vencidos", nombre: "Clientes vencidos", hora: "12:00", meta: 15, pasos: [3, 15, 30], ancla: "vencimiento" },
  fidelizar: { id: "fidelizar", nombre: "Clientes por fidelizar", hora: "14:00", meta: 10, pasos: [7, 21, 45], ancla: "fin del primer servicio" },
  potenciales: { id: "potenciales", nombre: "Clientes potenciales", hora: "16:00", meta: 5, pasos: [1, 3, 7], ancla: "cotización" },
});
export const ORDEN_CAT = Object.freeze(["vencidos", "fidelizar", "potenciales"]);
// Sin «promesa_pago» (decisión del dueño): quien prometió pagar sigue en Vencidos con su próxima fecha acordada.
export const ESTADOS = Object.freeze({
  pendiente: { label: "Pendiente de contactar", respondio: false, cierra: false },
  contactado: { label: "Contactado (sin respuesta aún)", respondio: false, cierra: false },
  no_responde: { label: "No responde", respondio: false, cierra: false },
  interesado: { label: "Interesado", respondio: true, cierra: false },
  pendiente_salario: { label: "Pendiente de salario", respondio: true, cierra: false },
  problema_servicio: { label: "Problemas con el servicio", respondio: true, cierra: false },
  no_interesado: { label: "No interesado", respondio: true, cierra: true },
  otro_proveedor: { label: "Contrató con otro proveedor", respondio: true, cierra: true },
  compra_concretada: { label: "Compra concretada", respondio: true, cierra: true },
  no_contactar: { label: "No desea recibir mensajes", respondio: true, cierra: true },
});
export const ETAPAS = Object.freeze({ preparado: "Preparado", abierto: "WhatsApp abierto", enviado: "Enviado (confirmado)" });
export const USUARIOS = Object.freeze({ sublicuentas: "Sublicuentas", relojes: "Relojes", geisell: "Geisell" });
export const META_DEFECTO = Object.freeze({ referencia: 670, objetivo: 800, mes: "2026-12" });

// ------------------------------------------------------------------------------------------------ fechas (Honduras)
export function hoyHN(d = new Date()) { return new Date(d.getTime() - 6 * 3600e3).toISOString().slice(0, 10); } // UTC−6 todo el año
export function ymdDe(v) {
  if (!v) return "";
  if (typeof v === "object") {
    const ms = typeof v.toMillis === "function" ? v.toMillis() : v._seconds ? v._seconds * 1000 : v.seconds ? v.seconds * 1000 : v instanceof Date ? v.getTime() : NaN;
    return Number.isFinite(ms) ? hoyHN(new Date(ms)) : "";
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return valida(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return valida(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})T/); if (m) return hoyHN(new Date(s));
  return "";
}
function valida(y, mo, d) { const t = new Date(Date.UTC(y, mo - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` : ""; }
export function diasEntre(a, b) { if (!a || !b) return null; return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5); }
export function sumarDias(ymd, n) { if (!ymd) return ""; const t = new Date(Date.parse(ymd + "T00:00:00Z") + n * 864e5); return t.toISOString().slice(0, 10); }

// ------------------------------------------------------------------------------------------------ personas
const SIN_ACENTO = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
export function normTel(v) {
  let d = String(v || "").replace(/\D/g, ""); if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 8) d = "504" + d; // número hondureño sin código
  return d.length >= 8 && d.length <= 15 ? "+" + d : "";
}
// Primer nombre verificado: letras, 2+ caracteres, sin números ni marcas («cliente», «x», «.»). Si es dudoso, vacío.
export function primerNombre(v) {
  const t = String(v || "").trim().split(/\s+/)[0] || "";
  const limpio = t.replace(/[^\p{L}'-]/gu, "");
  if (limpio.length < 2 || limpio.length !== t.length) return "";
  if (/^(cliente|client|sin|nombre|na|n\/a|xx+|desconocido|usuario)$/i.test(SIN_ACENTO(limpio))) return "";
  return limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase();
}
export function claveUsuario(raw) {
  const k = SIN_ACENTO(raw).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["naara", "sublicuentas", "sublicuentas2", "admin"].includes(k)) return "sublicuentas";
  if (["libni", "daniela", "relojes", "libnidaniela"].includes(k)) return "relojes";
  if (["geisell", "geissel"].includes(k)) return "geisell";
  return k;
}
// «Atendido por»: nunca los nombres personales de las fundadoras (Naara → Sublicuentas, Libni → Relojes).
export function vendedorVisible(v) {
  const s = String(v || "").trim(); if (!s) return "";
  const k = claveUsuario(s); if (USUARIOS[k]) return USUARIOS[k];
  return /naara|libni/i.test(s) ? (/libni/i.test(s) ? "Relojes" : "Sublicuentas") : s.slice(0, 40);
}
export function nombreServicio(p) { const k = normPlataformaKey(p) || String(p || "").toLowerCase(); return k ? nombrePlataforma(k) : ""; }

// ------------------------------------------------------------------------------------------------ ventas verificables
// Una VENTA = un movimiento tipo «venta» (compra_nueva | renovacion) no anulado ni reversado, desde el 01/10/2026.
// Un pedido con varias líneas es UNA operación (operacionId / operationId), no N compras.
export function esVentaValida(m = {}) {
  if (String(m.tipo || "") !== "venta") return false;
  if (m.reversaDe || ["anulado", "corregido"].includes(String(m.estadoFinanciero || "")) || m.anulado === true) return false;
  return ["compra_nueva", "renovacion"].includes(String(m.subtipo || ""));
}
export function ventasPorCliente(movs = [], desde = DESDE_VERIFICABLE) {
  const out = new Map();
  for (const m of movs) {
    if (!esVentaValida(m)) continue;
    const cid = String(m.clienteId || "").trim(); if (!cid) continue;
    const fecha = ymdDe(m.fechaPago) || ymdDe(m.fecha) || ymdDe(m.fechaTS); if (!fecha || fecha < desde) continue;
    const op = String(m.operacionId || m.operationId || m.movimientoId || m.id || "");
    const l = out.get(cid) || out.set(cid, new Map()).get(cid);
    const prev = l.get(op);
    const v = { id: String(m.movimientoId || m.id || op), op, fecha, subtipo: m.subtipo, monto: Number(m.monto) || 0, compraId: String(m.compraId || ""), plataforma: String(m.plataforma || ""), fechaNueva: ymdDe(m.fechaNueva) };
    if (!prev) l.set(op, v); else { prev.monto += v.monto; if (v.fecha < prev.fecha) prev.fecha = v.fecha; }
  }
  const res = new Map();
  for (const [cid, l] of out) res.set(cid, [...l.values()].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id)));
  return res;
}

// ------------------------------------------------------------------------------------------------ ciclo de seguimiento
// paso = contactos CONFIRMADOS (enviado) en el ciclo actual de esa categoría. Se reinicia si cambia el ancla
// (nuevo vencimiento / nueva cotización). La fecha ACORDADA con el cliente manda sobre los intervalos.
export function cicloDe(cat, ancla, seg = {}, hoy) {
  const C = CATEGORIAS[cat]; const s = (seg.ciclos && seg.ciclos[cat]) || {};
  const mismo = s.ancla && s.ancla === ancla;
  const paso = mismo ? Number(s.paso || 0) : 0;
  const cerrado = mismo && !!s.cerrado;
  const acordada = mismo && s.proximo ? s.proximo : "";
  if (seg.noContactar) return { paso, total: C.pasos.length, estado: "bloqueado", sugerida: "", elegible: false };
  if (!ancla) return { paso, total: C.pasos.length, estado: "no_verificable", sugerida: "", elegible: false };
  if (cerrado) return { paso, total: C.pasos.length, estado: "cerrado", motivo: s.motivo || "", sugerida: "", elegible: false };
  if (acordada) return { paso, total: C.pasos.length, estado: acordada <= hoy ? "toca" : "programado", sugerida: acordada, acordada: true, elegible: acordada <= hoy };
  if (paso >= C.pasos.length) return { paso, total: C.pasos.length, estado: "revision", sugerida: "", elegible: false }; // tras el 3.er contacto: revisión manual
  const sugerida = sumarDias(ancla, C.pasos[paso]);
  // no se repite el mismo día ni antes de lo que manda el intervalo
  const ult = mismo ? String(s.ultimoEnvio || "") : "";
  const elegible = sugerida <= hoy && ult !== hoy;
  return { paso, total: C.pasos.length, estado: elegible ? "toca" : "programado", sugerida, elegible };
}

// ------------------------------------------------------------------------------------------------ fichas
const PRIV = /correo|clave|pass|contra|pin|perfil|token|email/i; // la ficha comercial NUNCA lleva accesos
export function servicioComercial(sv = {}, hoy) {
  const vence = ymdDe(sv.fechaRenovacion);
  const dias = vence ? diasEntre(vence, hoy) : null;
  const plataforma = normPlataformaKey(sv.plataforma) || String(sv.plataforma || "");
  const precio = Number(sv.precio);
  return { plataforma, servicio: nombreServicio(sv.plataforma), vence, dias, estado: !vence ? "sin_fecha" : dias > 0 ? "vencido" : "vigente",
    precio: Number.isFinite(precio) && precio > 0 ? precio : null, vendedor: vendedorVisible(sv.vendedor), compraId: String(sv.compraId || "") };
}
export function construirFichas({ clientes = [], movimientos = [], noRenovo = [], seguimientos = new Map(), hoy = hoyHN() } = {}) {
  const ventas = ventasPorCliente(movimientos);
  const archivados = new Map(); const desdeNR = sumarDias(hoy, -DIAS_NO_RENOVO);
  for (const e of noRenovo) {
    const cid = String(e.clienteId || ""); const at = ymdDe(e.createdAt) || ymdDe(e.at) || ymdDe(e.fecha);
    if (!cid || !at || at < desdeNR) continue;
    const s = e.servicio || {};
    const x = servicioComercial({ plataforma: e.plataforma || s.plataforma, fechaRenovacion: e.fechaRenovacion || s.fechaRenovacion, precio: e.precio ?? s.precio, vendedor: e.vendedor || s.vendedor, compraId: e.compraId || s.compraId }, hoy);
    x.estado = "no_renovo"; x.noRenovoAt = at;
    (archivados.get(cid) || archivados.set(cid, []).get(cid)).push(x);
  }
  const fichas = [];
  for (const c of clientes) {
    if (!c || !c.id || String(c.consolidadoEn || "").trim() || c.eliminado === true) continue;
    const servicios = (Array.isArray(c.servicios) ? c.servicios : []).filter(Boolean).map((s) => servicioComercial(s, hoy));
    const vigentes = servicios.filter((s) => s.estado === "vigente").length;
    const vencidosF = servicios.filter((s) => s.estado === "vencido");
    const arch = vigentes ? [] : (archivados.get(c.id) || []).sort((a, b) => b.noRenovoAt.localeCompare(a.noRenovoAt));
    const v = ventas.get(c.id) || [];
    const nombre = String(c.nombrePerfil || c.nombre || "").trim().slice(0, 80);
    const tel = normTel(c.telefono || c.whatsapp || c.telefono_norm);
    const seg = seguimientos.get("c_" + c.id) || {};
    const cats = []; const ciclos = {};
    // VENCIDOS: algún servicio vencido en la ficha, o archivado «No renovó» (90 días) sin nada vigente.
    if (vencidosF.length || arch.length) {
      const fechas = [...vencidosF.map((s) => s.vence), ...arch.map((s) => s.vence || s.noRenovoAt)].filter(Boolean).sort();
      const ancla = fechas.length ? fechas[fechas.length - 1] : ""; // el vencimiento más reciente sin renovar
      cats.push("vencidos"); ciclos.vencidos = { ancla, ...cicloDe("vencidos", ancla, seg, hoy) };
    }
    // POR FIDELIZAR: exactamente UNA venta verificable y fue compra nueva (una renovación implica historia previa).
    let primera = null;
    if (v.length === 1 && v[0].subtipo === "compra_nueva") {
      primera = v[0];
      const svc = servicios.find((s) => s.compraId && s.compraId === primera.compraId);
      const fin = (svc && svc.vence) || primera.fechaNueva || "";
      cats.push("fidelizar");
      const vigente = fin && fin >= hoy;
      ciclos.fidelizar = vigente ? { ancla: fin, paso: 0, total: 3, estado: "vigente", sugerida: sumarDias(fin, 7), elegible: false } : { ancla: fin, ...cicloDe("fidelizar", fin, seg, hoy) };
    }
    if (!cats.length) continue;
    fichas.push({ tipo: "cliente", id: c.id, key: "c_" + c.id, nombre, saludo: primerNombre(nombre), telefono: tel, telefonoValido: !!tel,
      servicios, archivados: arch, vigentes, compras: v.length ? v.length : null, comprasDesde: DESDE_VERIFICABLE, primeraCompra: primera, ventas: v.slice(-10),
      vendedores: [...new Set([...servicios, ...arch].map((s) => s.vendedor).filter(Boolean))], categorias: cats, ciclos,
      responsable: seg.responsable || "", estado: seg.estado || "pendiente", noContactar: !!seg.noContactar, ultimoContacto: seg.ultimoEnvio || "",
      contactos: Number(seg.contactos || 0), notas: String(seg.notas || "").slice(0, 500), inactivo: vigentes ? "" : inactividad(servicios, arch, hoy) });
  }
  return fichas;
}
function inactividad(servicios, arch, hoy) {
  const f = [...servicios, ...arch].map((s) => s.vence).filter(Boolean).sort().pop();
  if (!f) return "";
  const d = diasEntre(f, hoy); return d >= 90 ? "inactivo_prolongado" : d >= 30 ? "inactivo" : "";
}
export function fichaOportunidad(o = {}, seg = {}, hoy = hoyHN()) {
  const ancla = ymdDe(o.creadoAt) || "";
  const ciclo = o.estado && o.estado !== "abierta" ? { ancla, paso: 0, total: 3, estado: "cerrado", motivo: o.estado, elegible: false } : { ancla, ...cicloDe("potenciales", ancla, seg, hoy) };
  return { tipo: "oportunidad", id: o.id, key: "o_" + o.id, nombre: String(o.nombre || "").slice(0, 80), saludo: primerNombre(o.nombre), telefono: o.tel || normTel(o.telefono), telefonoValido: !!(o.tel || normTel(o.telefono)),
    servicios: (o.servicios || []).map((p) => ({ plataforma: normPlataformaKey(p) || p, servicio: nombreServicio(p) || String(p), estado: "cotizado", precio: null })),
    precioCotizado: Number(o.precio) > 0 ? Number(o.precio) : null, clienteId: o.clienteId || "", estadoOportunidad: o.estado || "abierta", ventaId: o.ventaId || "",
    creadoAt: o.creadoAt || "", creadoPor: USUARIOS[claveUsuario(o.creadoPor)] || o.creadoPor || "", categorias: ["potenciales"], ciclos: { potenciales: ciclo },
    responsable: seg.responsable || o.responsable || "", estado: seg.estado || "pendiente", noContactar: !!seg.noContactar, ultimoContacto: seg.ultimoEnvio || "",
    contactos: Number(seg.contactos || 0), notas: String(o.notas || seg.notas || "").slice(0, 500), compras: 0, vigentes: 0, vendedores: [] };
}

// ------------------------------------------------------------------------------------------------ plantillas
export function resolverPlantilla(texto, { nombre = "", servicio = "" } = {}) {
  const n = primerNombre(nombre);
  let t = String(texto || "").replace(/\{\{\s*saludo\s*\}\}/g, n ? `¡Hola, ${n}! 👋` : "¡Hola! 👋");
  if (/\{\{\s*servicio\s*\}\}/.test(t)) { if (!String(servicio || "").trim()) return { ok: false, texto: t, falta: ["servicio"] }; t = t.replace(/\{\{\s*servicio\s*\}\}/g, String(servicio).trim()); }
  const quedan = t.match(/\{\{[^}]+\}\}/g);
  return quedan ? { ok: false, texto: t, falta: quedan } : { ok: true, texto: t };
}
// Importación idempotente: por ID original. No duplica, no pisa ediciones locales (version > 1 o editada) sin confirmar.
export function planImportacion(origen = [], existentes = new Map()) {
  const crear = [], igual = [], conCambiosLocales = [], actualizar = [];
  for (const p of origen) {
    const e = existentes.get(p.id);
    if (!e) crear.push(p);
    else if (e.editadaLocal) conCambiosLocales.push(p.id);
    else if (e.mensaje === p.mensaje && e.categoria === p.categoria && e.situacion === p.situacion) igual.push(p.id);
    else actualizar.push(p);
  }
  return { crear, igual, conCambiosLocales, actualizar };
}

// ------------------------------------------------------------------------------------------------ cartera / métricas
export function activosDe(clientes = [], hoy = hoyHN()) {
  const out = [];
  for (const c of clientes) {
    if (!c || !c.id || String(c.consolidadoEn || "").trim() || c.eliminado === true) continue;
    if ((c.servicios || []).some((s) => { const v = ymdDe(s && s.fechaRenovacion); return v && v >= hoy; })) out.push(c.id);
  }
  return out;
}
export function movimientosCartera(antes = [], ahora = [], nuevosIds = new Set()) {
  const A = new Set(antes), B = new Set(ahora); const nuevos = [], recuperados = [], perdidos = [];
  for (const id of B) if (!A.has(id)) (nuevosIds.has(id) ? nuevos : recuperados).push(id);
  for (const id of A) if (!B.has(id)) perdidos.push(id);
  return { nuevos, recuperados, perdidos, neto: nuevos.length + recuperados.length - perdidos.length };
}
export function rendimiento(eventos = [], { desde, hasta, usuario = "" } = {}) {
  const por = {};
  for (const e of eventos) {
    const f = ymdDe(e.at); if (!f || (desde && f < desde) || (hasta && f > hasta)) continue;
    const u = claveUsuario(e.autor); if (usuario && u !== usuario) continue;
    const r = por[u] || (por[u] = { usuario: u, nombre: USUARIOS[u] || u, enviados: 0, abiertos: 0, unicos: new Set(), respondieron: new Set(), ventas: new Set(), porCat: { vencidos: 0, fidelizar: 0, potenciales: 0 } });
    if (e.etapa === "enviado") { r.enviados++; r.unicos.add(e.sujeto); if (r.porCat[e.categoria] != null) r.porCat[e.categoria]++; }
    if (e.etapa === "abierto") r.abiertos++;
    if (e.resultado && ESTADOS[e.resultado] && ESTADOS[e.resultado].respondio) r.respondieron.add(e.sujeto);
    if (e.resultado === "compra_concretada" && e.ventaId) r.ventas.add(e.ventaId);
  }
  return Object.values(por).map((r) => ({ ...r, unicos: r.unicos.size, respondieron: r.respondieron.size, ventas: r.ventas.size, ventaIds: [...r.ventas] }));
}
// Excel: celdas de texto que empiezan con = + - @ se exportan como texto (sin fórmulas inyectadas).
export function celdaSegura(v) { return typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? "'" + v : v; }
export function sinAccesos(obj = {}) { const o = {}; for (const [k, v] of Object.entries(obj || {})) if (!PRIV.test(k)) o[k] = v; return o; }
