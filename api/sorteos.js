import admin from "firebase-admin";
import { randomInt, randomBytes } from "node:crypto";
import {
  reglasSorteo, sorteoClean, sorteoNorm, sorteoSafeId,
  sorteoVendorElegible, sorteoVendorGroup
} from "./sorteos-lib.js";
import { registrarEventoSorteosSeguro } from "./sorteos-eventos.js";

const PREMIOS_COLLECTION = "premios_digitales";
const SORTEOS_COLLECTION = "sorteos";
const BOLETOS_COLLECTION = "sorteo_boletos";
const ENTREGAS_COLLECTION = "premios_entregas";
const CARGAS_COLLECTION = "sorteo_cargas";
const CARGA_AGOSTO_2026 = "2026-08";
const CARGA_CHUNK = 8;
const TIPOS_PREMIO = new Set([
  "perfil", "descuento_porcentaje", "descuento_fijo", "cine",
  "recarga", "dias_extra", "personalizado"
]);
const ESTADOS_SORTEO = new Set(["borrador", "activo", "cerrado", "finalizado"]);
const CATEGORIAS = new Set(["general", "compras", "renovaciones", "oro"]);
const ALCANCES = new Set(["sublicuentas", "relojes", "ambos"]);

function getApp() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  privateKey = privateKey.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("Faltan variables de Firebase.");
  return admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

function setHeaders(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function editorKind(user) {
  const usuario = sorteoNorm(user && (user.usuario || user.name || ""));
  if (["sublicuentas", "naara"].includes(usuario)) return "admin";
  if (["relojes", "libni"].includes(usuario)) return "relojes";
  return "";
}

async function requireEditor(req, res) {
  const auth = sorteoClean(req.headers.authorization || "", 4000);
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) { res.status(401).json({ ok: false, error: "Sesión requerida." }); return null; }
  try {
    const user = await admin.auth().verifyIdToken(token);
    const kind = editorKind(user);
    if (!kind) { res.status(403).json({ ok: false, error: "Sorteos está disponible únicamente para Sublicuentas y Relojes." }); return null; }
    return { user, kind, actor: sorteoNorm(user.usuario || user.name || kind) };
  } catch (_) {
    res.status(401).json({ ok: false, error: "Sesión inválida o vencida." });
    return null;
  }
}

function iso(value) {
  const raw = sorteoClean(value, 40);
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function timeMs(value) {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  const seconds = Number(value._seconds ?? value.seconds);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function historicalDateMs(value) {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  const seconds = Number(value._seconds ?? value.seconds);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const raw = sorteoClean(value, 80);
  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = new Date(dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}T12:00:00Z` : (ymd ? `${raw}T12:00:00Z` : raw));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function historicalMonth(value) {
  const milliseconds = historicalDateMs(value);
  if (!milliseconds) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Tegucigalpa", year: "numeric", month: "2-digit"
  }).formatToParts(new Date(milliseconds));
  const get = type => parts.find(part => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}`;
}

function historicalEventType(record = {}) {
  const type = sorteoNorm(record.tipo).replace(/[\s-]+/g, "_");
  if (type === "crm_ficha_upsert") return record.creado === true || record.servicioActualizado === false ? "compra" : "";
  if (["servicio_agregado", "compra", "compra_nueva", "nueva_compra", "servicio_comprado"].includes(type)) return "compra";
  if (["servicio_renovado", "servicios_renovados", "renovacion", "renovacion_confirmada", "cliente_renovado"].includes(type)) return "renovacion";
  return "";
}

function color(value, fallback = "#E2231A") {
  const text = sorteoClean(value, 7);
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

function uniqueIds(values, max = 8) {
  return [...new Set((Array.isArray(values) ? values : []).map(sorteoSafeId).filter(Boolean))].slice(0, max);
}

function normalizeCodes(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(/\r?\n/);
  return [...new Set(source.map(item => sorteoClean(item, 300)).filter(Boolean))].slice(0, 500);
}

function normalizePrize(raw = {}, previous = {}) {
  const tipo = TIPOS_PREMIO.has(sorteoNorm(raw.tipo)) ? sorteoNorm(raw.tipo) : "personalizado";
  const nombre = sorteoClean(raw.nombre, 120);
  if (!nombre) throw new Error("Escriba el nombre del premio.");
  const valor = Math.max(0, Number(raw.valor) || 0);
  if (tipo !== "personalizado" && valor <= 0) throw new Error("El valor del premio debe ser mayor que cero.");
  if (tipo === "descuento_porcentaje" && valor > 100) throw new Error("El descuento porcentual no puede superar el 100%.");
  const stock = Math.max(0, Math.min(9999, Math.round(Number(raw.stock != null ? raw.stock : previous.stock) || 0)));
  const codigosNuevos = normalizeCodes(raw.codigos);
  const codigosAnteriores = Array.isArray(previous.codigosDisponibles) ? previous.codigosDisponibles.map(item => sorteoClean(item, 300)).filter(Boolean) : [];
  const codigosDisponibles = raw.reemplazarCodigos === true ? codigosNuevos : [...new Set([...codigosAnteriores, ...codigosNuevos])];
  const entregaModo = ["manual", "codigo", "cupon"].includes(sorteoNorm(raw.entregaModo))
    ? sorteoNorm(raw.entregaModo) : (tipo.startsWith("descuento") ? "cupon" : (tipo === "cine" ? "codigo" : "manual"));
  const activo = raw.activo !== false;
  const reservados = Math.max(0, Number(previous.reservados) || 0);
  const entregados = Math.max(0, Number(previous.entregados) || 0);
  if (activo && entregaModo === "codigo" && !codigosDisponibles.length) throw new Error("Agregue al menos un código digital o deje el premio oculto.");
  if (activo && entregaModo === "manual" && stock - reservados - entregados <= 0) throw new Error("Agregue existencias o deje el premio oculto.");
  return {
    nombre,
    descripcion: sorteoClean(raw.descripcion, 500),
    tipo,
    valor,
    unidad: sorteoClean(raw.unidad, 40),
    plataforma: sorteoClean(raw.plataforma, 100),
    entregaModo,
    instrucciones: sorteoClean(raw.instrucciones, 500),
    stock: entregaModo === "codigo" ? codigosDisponibles.length : stock,
    reservados,
    entregados,
    codigosDisponibles,
    activo,
    color: color(raw.color, previous.color || "#E2231A")
  };
}

function normalizeDraw(raw = {}, previous = {}, editor = {}) {
  const titulo = sorteoClean(raw.titulo, 140);
  if (!titulo) throw new Error("Escriba el nombre del sorteo.");
  const premioIds = uniqueIds(raw.premioIds, 5);
  if (premioIds.length < 2) throw new Error("Seleccione al menos dos premios para que el ganador pueda elegir.");
  const categoria = CATEGORIAS.has(sorteoNorm(raw.categoria)) ? sorteoNorm(raw.categoria) : "general";
  let alcance = ALCANCES.has(sorteoNorm(raw.alcance)) ? sorteoNorm(raw.alcance) : "sublicuentas";
  if (editor.kind === "relojes") alcance = "relojes";
  const estado = ESTADOS_SORTEO.has(sorteoNorm(raw.estado)) ? sorteoNorm(raw.estado) : "borrador";
  const fechaInicio = iso(raw.fechaInicio) || new Date().toISOString();
  const fechaFin = iso(raw.fechaFin);
  if (!fechaFin) throw new Error("Seleccione la fecha final del sorteo.");
  if (new Date(fechaFin).getTime() <= new Date(fechaInicio).getTime()) throw new Error("La fecha final debe ser posterior al inicio.");
  return {
    titulo,
    descripcion: sorteoClean(raw.descripcion, 600),
    categoria,
    alcance,
    estado,
    fechaInicio,
    fechaFin,
    premioModo: "elegir",
    premioIds,
    reglas: reglasSorteo(raw.reglas || previous.reglas || {}),
    totalBoletos: Math.max(0, Number(previous.totalBoletos) || 0),
    ultimoNumero: Math.max(0, Number(previous.ultimoNumero) || 0),
    ganador: previous.ganador || null,
    color: color(raw.color, previous.color || "#E2231A")
  };
}

function sameValues(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertDrawEditAllowed(previous = {}, next = {}, hasId = false) {
  if (!["borrador", "activo"].includes(next.estado)) throw new Error("Use los botones de cerrar y girar para finalizar un sorteo.");
  if (!hasId) return;
  if (["cerrado", "finalizado"].includes(sorteoNorm(previous.estado))) throw new Error("Un sorteo cerrado ya no puede editarse.");
  const issued = Math.max(0, Number(previous.totalBoletos) || 0);
  if (!issued) return;
  const eligibilityChanged = ["categoria", "alcance", "fechaInicio", "fechaFin"].some(field => String(previous[field] || "") !== String(next[field] || ""));
  const prizesChanged = !sameValues(uniqueIds(previous.premioIds, 5).sort(), uniqueIds(next.premioIds, 5).sort());
  const rulesChanged = !sameValues(reglasSorteo(previous.reglas || {}), reglasSorteo(next.reglas || {}));
  if (eligibilityChanged || prizesChanged || rulesChanged) {
    throw new Error("Ya existen boletos. Para proteger la transparencia no puede cambiar participantes, reglas ni premios.");
  }
  if (next.estado === "borrador") throw new Error("Un sorteo con boletos no puede volver a borrador; cierre la participación cuando corresponda.");
}

function publicPrize(doc) {
  const data = doc.data ? doc.data() || {} : doc || {};
  return {
    id: doc.id || data.id || "",
    nombre: sorteoClean(data.nombre, 120),
    descripcion: sorteoClean(data.descripcion, 500),
    tipo: sorteoNorm(data.tipo),
    valor: Number(data.valor) || 0,
    unidad: sorteoClean(data.unidad, 40),
    plataforma: sorteoClean(data.plataforma, 100),
    color: color(data.color)
  };
}

function prizeAvailable(data = {}) {
  if (data.activo === false) return false;
  const mode = sorteoNorm(data.entregaModo);
  if (mode === "codigo") return Array.isArray(data.codigosDisponibles) && data.codigosDisponibles.length > 0;
  if (mode === "manual") return (Number(data.stock) || 0) - (Number(data.reservados) || 0) - (Number(data.entregados) || 0) > 0;
  return true;
}

function adminPrize(doc) {
  const data = doc.data() || {};
  return {
    ...publicPrize(doc),
    entregaModo: sorteoNorm(data.entregaModo),
    instrucciones: sorteoClean(data.instrucciones, 500),
    stock: Number(data.stock) || 0,
    reservados: Number(data.reservados) || 0,
    entregados: Number(data.entregados) || 0,
    codigosDisponibles: Array.isArray(data.codigosDisponibles) ? data.codigosDisponibles.length : 0,
    activo: data.activo !== false,
    ownerVendor: sorteoNorm(data.ownerVendor),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : sorteoClean(data.updatedAt, 50)
  };
}

function drawVisibleToEditor(draw, editor) {
  if (editor.kind === "admin") return true;
  return sorteoNorm(draw.alcance) === "relojes";
}

function prizeVisibleToEditor(prize, editor) {
  if (editor.kind === "admin") return true;
  return sorteoNorm(prize.ownerVendor) === "relojes";
}

async function adminLoad(db, editor) {
  const [drawSnap, prizeSnap, ticketSnap, deliverySnap] = await Promise.all([
    db.collection(SORTEOS_COLLECTION).limit(150).get(),
    db.collection(PREMIOS_COLLECTION).limit(300).get(),
    db.collection(BOLETOS_COLLECTION).orderBy("createdAt", "desc").limit(10000).get(),
    db.collection(ENTREGAS_COLLECTION).limit(1000).get()
  ]);
  const sorteos = drawSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(draw => drawVisibleToEditor(draw, editor));
  const allowed = new Set(sorteos.map(draw => draw.id));
  const drawMap = new Map(sorteos.map(draw => [draw.id, draw]));
  const boletos = ticketSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(ticket => {
      const draw = drawMap.get(String(ticket.sorteoId || ""));
      return Boolean(draw) && ticket.activo !== false && sorteoVendorElegible(ticket.vendedorNorm || ticket.vendedor) && scopeMatches(draw, ticket.vendedorNorm || ticket.vendedor);
    });
  const countByDraw = {};
  boletos.forEach(ticket => { countByDraw[ticket.sorteoId] = (countByDraw[ticket.sorteoId] || 0) + 1; });
  sorteos.forEach(draw => { draw.totalBoletos = countByDraw[draw.id] || 0; });
  sorteos.sort((a, b) => timeMs(b.createdAt || b.fechaInicio) - timeMs(a.createdAt || a.fechaInicio));
  const premios = prizeSnap.docs.filter(doc => prizeVisibleToEditor(doc.data() || {}, editor)).map(adminPrize)
    .sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre, "es"));
  const entregas = deliverySnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(item => allowed.has(String(item.sorteoId || "")))
    .map(item => ({ ...item, codigo: item.codigo ? "••••••••" : "" }));
  const participantes = boletos.slice(0, 500).map(ticket => ({
    id: ticket.id, sorteoId: ticket.sorteoId, codigo: ticket.codigo,
    clientId: ticket.clientId, clienteNombre: ticket.clienteNombre,
    telefono: ticket.telefono, tipo: ticket.tipo, createdAt: ticket.createdAt
  }));
  return { ok: true, sorteos, premios, entregas, participantes, permisos: { alcance: editor.kind === "relojes" ? "relojes" : "todos" } };
}

async function resolvePublicClient(db, token) {
  const safeToken = sorteoClean(token, 90);
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(safeToken)) throw Object.assign(new Error("Enlace inválido."), { status: 400 });
  const pointer = await db.collection("enlaces").doc(safeToken).get();
  if (!pointer.exists || (pointer.data() || {}).activo === false) throw Object.assign(new Error("Este enlace ya no está disponible."), { status: 404 });
  const enlace = pointer.data() || {};
  const clientId = sorteoSafeId(enlace.clienteId);
  const clientSnap = clientId ? await db.collection("clientes").doc(clientId).get() : null;
  if (!clientSnap || !clientSnap.exists) throw Object.assign(new Error("No se encontró el cliente."), { status: 404 });
  return { token: safeToken, clientId, cliente: clientSnap.data() || {}, enlace };
}

function scopeMatches(draw, vendor) {
  const scope = sorteoNorm(draw.alcance);
  const normalized = sorteoVendorGroup(vendor);
  return scope === "ambos" ? ["sublicuentas", "relojes"].includes(normalized) : scope === normalized;
}

function clientVendorGroups(cliente = {}) {
  const servicios = Array.isArray(cliente.servicios) ? cliente.servicios : [];
  const values = servicios.length
    ? servicios.map(servicio => servicio?.vendedor_norm || servicio?.vendedor || cliente.vendedor_norm || cliente.vendedor)
    : [cliente.vendedor_norm || cliente.vendedor];
  return [...new Set(values.map(sorteoVendorGroup).filter(sorteoVendorElegible))];
}

function serviceBeneficiaryKey(service = {}) {
  const saved = sorteoClean(service?.beneficiarioKey || "", 160);
  if (saved) return saved;
  if (sorteoNorm(service?.beneficiarioTipo) !== "tercero") return "titular";
  const nameKey = sorteoNorm(service?.beneficiarioNombre || service?.beneficiario)
    .replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "persona";
  return `tercero-${nameKey}`;
}

function publicPointerServices(cliente = {}, enlace = {}) {
  const services = Array.isArray(cliente.servicios) ? cliente.servicios : [];
  const savedKey = sorteoClean(enlace.beneficiarioKey || "", 160);
  if (enlace.tipo === "beneficiario" || savedKey) {
    const targetKey = savedKey || "titular";
    return services.filter(service => serviceBeneficiaryKey(service) === targetKey);
  }
  const requestedIndex = Number(enlace.servicioIndex);
  let service = Number.isInteger(requestedIndex) && requestedIndex >= 0 ? services[requestedIndex] : null;
  const purchaseId = sorteoClean(enlace.compraId || "", 180);
  if (!service || (purchaseId && sorteoClean(service?.compraId || "", 180) !== purchaseId)) {
    service = purchaseId ? services.find(item => sorteoClean(item?.compraId || "", 180) === purchaseId) : null;
  }
  return service ? [service] : services;
}

function publicRaffleAccess(cliente = {}, enlace = {}) {
  const relevantServices = publicPointerServices(cliente, enlace);
  const savedKey = sorteoClean(enlace.beneficiarioKey || "", 160);
  const thirdParty = enlace.tipo === "beneficiario" || savedKey
    ? (savedKey || "titular") !== "titular"
    : relevantServices.length === 1 && sorteoNorm(relevantServices[0]?.beneficiarioTipo) === "tercero";
  const values = relevantServices.map(service =>
    service?.vendedor_norm || service?.vendedor || cliente.vendedor_norm || cliente.vendedor
  );
  let vendors = [...new Set(values.map(sorteoVendorGroup).filter(sorteoVendorElegible))];
  // Regla de negocio: los titulares conservan Sublicuentas/Relojes; un enlace
  // para tercero participa únicamente cuando ese acceso fue vendido por Relojes.
  if (thirdParty) vendors = vendors.filter(vendor => vendor === "relojes");
  return { vendors, thirdParty };
}

function recordInHistoricalMonth(record = {}, month = CARGA_AGOSTO_2026) {
  return [record.fechaTS, record.createdAt, record.fecha, record.updatedAt, record.timestamp]
    .some(value => historicalMonth(value) === month);
}

function valuesContainHistoricalMonth(values = [], month = CARGA_AGOSTO_2026) {
  return values.some(value => historicalMonth(value) === month);
}

async function collectHistoricalCandidates(db, draw, month = CARGA_AGOSTO_2026) {
  const [clientsSnap, historySnap, auditSnap] = await Promise.all([
    db.collection("clientes").limit(5000).get(),
    db.collection("historial_clientes").limit(20000).get(),
    db.collection("auditoria_eventos").limit(20000).get()
  ]);
  const clients = new Map();
  clientsSnap.docs.forEach(doc => {
    const data = doc.data() || {};
    const vendors = clientVendorGroups(data).filter(vendor => scopeMatches(draw, vendor));
    if (!vendors.length) return;
    clients.set(doc.id, { id: doc.id, data, vendor: vendors[0], vendors });
  });

  const flags = new Map();
  const sources = { historial: 0, auditoria: 0, fichas: 0 };
  const mark = (clientIdValue, type, source) => {
    const clientId = sorteoSafeId(clientIdValue);
    if (!clients.has(clientId) || !["compra", "renovacion"].includes(type)) return;
    const current = flags.get(clientId) || { compra: false, renovacion: false };
    if (!current[type]) sources[source] += 1;
    current[type] = true;
    flags.set(clientId, current);
  };

  historySnap.docs.forEach(doc => {
    const data = doc.data() || {};
    if (!recordInHistoricalMonth(data, month)) return;
    mark(data.clientId, historicalEventType(data), "historial");
  });
  auditSnap.docs.forEach(doc => {
    const data = doc.data() || {};
    if (!recordInHistoricalMonth(data, month)) return;
    mark(data.clienteId || data.clientId, historicalEventType(data), "auditoria");
  });

  clients.forEach(({ id, data }) => {
    const services = Array.isArray(data.servicios) ? data.servicios : [];
    if (services.length && valuesContainHistoricalMonth([
      data.fechaCompra, data.fechaVenta, data.fechaContratacion, data.fechaRegistro,
      data.fechaAlta, data.fechaInicio, data.createdAt, data.created_at
    ], month)) mark(id, "compra", "fichas");
    if (valuesContainHistoricalMonth([
      data.ultimaRenovacionAt, data.renovadoAt, data.fechaUltimaRenovacion
    ], month)) mark(id, "renovacion", "fichas");
    services.forEach(service => {
      const item = service || {};
      if (valuesContainHistoricalMonth([
        item.fechaCompra, item.fechaVenta, item.fechaContratacion, item.fechaInicio,
        item.fecha_inicio, item.createdAt, item.created_at
      ], month)) mark(id, "compra", "fichas");
      if (valuesContainHistoricalMonth([
        item.ultimaRenovacionAt, item.renovadoAt, item.fechaUltimaRenovacion
      ], month)) mark(id, "renovacion", "fichas");
    });
  });

  const tasks = [];
  [...flags.keys()].sort().forEach(clientId => {
    const item = flags.get(clientId) || {};
    if (item.compra) tasks.push({ clientId, tipo: "compra" });
    if (item.renovacion) tasks.push({ clientId, tipo: "renovacion" });
  });
  return { tasks, clients: new Set(tasks.map(item => item.clientId)).size, sources };
}

async function loadHistoricalJob(db, draw, editor, reset = false) {
  const id = sorteoSafeId(`${draw.id}_${CARGA_AGOSTO_2026}`);
  const ref = db.collection(CARGAS_COLLECTION).doc(id);
  const current = await ref.get();
  if (current.exists && !reset) return { ref, job: current.data() || {} };
  const candidates = await collectHistoricalCandidates(db, draw, CARGA_AGOSTO_2026);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const job = {
    sorteoId: draw.id,
    periodo: CARGA_AGOSTO_2026,
    tareas: candidates.tasks,
    clientesDetectados: candidates.clients,
    fuentes: candidates.sources,
    cursor: 0,
    totalCreados: 0,
    totalOmitidos: 0,
    errores: [],
    completado: candidates.tasks.length === 0,
    createdAt: now,
    updatedAt: now,
    updatedBy: editor.actor
  };
  await ref.set(job, { merge: false });
  return { ref, job };
}

async function backfillAugust2026(db, editor, body) {
  const drawId = sorteoSafeId(body.id);
  if (!drawId) throw Object.assign(new Error("Sorteo inválido."), { status: 400 });
  const drawRef = db.collection(SORTEOS_COLLECTION).doc(drawId);
  const drawSnap = await drawRef.get();
  if (!drawSnap.exists) throw Object.assign(new Error("Sorteo no encontrado."), { status: 404 });
  const draw = { id: drawSnap.id, ...(drawSnap.data() || {}) };
  if (!drawVisibleToEditor(draw, editor)) throw Object.assign(new Error("No puede cargar clientes en este sorteo."), { status: 403 });
  if (draw.estado !== "activo") throw new Error("La carga de agosto solo puede hacerse en un sorteo activo.");
  if (sorteoNorm(draw.categoria) !== "general") throw new Error("Use un sorteo de categoría General para incluir compras y renovaciones de agosto.");
  const rules = reglasSorteo(draw.reglas || {});
  if (rules.compra < 1 || rules.renovacion < 1) throw new Error("Configure al menos un boleto para compra y uno para renovación antes de cargar agosto.");
  const now = Date.now(), starts = timeMs(draw.fechaInicio), ends = timeMs(draw.fechaFin);
  if ((starts && starts > now) || (ends && ends < now)) throw new Error("El sorteo debe encontrarse dentro de sus fechas activas para cargar agosto.");

  const { ref: jobRef, job } = await loadHistoricalJob(db, draw, editor, body.reiniciar === true);
  const tasks = Array.isArray(job.tareas) ? job.tareas : [];
  const cursor = Math.max(0, Number(job.cursor) || 0);
  if (job.completado === true || cursor >= tasks.length) {
    return {
      ok: true, completado: true, periodo: CARGA_AGOSTO_2026,
      clientesDetectados: Number(job.clientesDetectados) || 0,
      totalTareas: tasks.length, procesados: cursor,
      boletosCreados: Number(job.totalCreados) || 0,
      omitidos: Number(job.totalOmitidos) || 0,
      errores: Array.isArray(job.errores) ? job.errores.length : 0
    };
  }

  const ticketSnap = await db.collection(BOLETOS_COLLECTION).where("sorteoId", "==", drawId).get();
  const existing = new Set(ticketSnap.docs.map(doc => doc.data() || {}).filter(ticket =>
    ticket.activo !== false && sorteoVendorElegible(ticket.vendedorNorm || ticket.vendedor) && scopeMatches(draw, ticket.vendedorNorm || ticket.vendedor)
  ).map(ticket => `${sorteoSafeId(ticket.clientId)}|${sorteoNorm(ticket.tipo)}`));
  const chunk = tasks.slice(cursor, cursor + CARGA_CHUNK);
  let created = 0, omitted = 0;
  const errors = Array.isArray(job.errores) ? [...job.errores].slice(-40) : [];
  for (const task of chunk) {
    const clientId = sorteoSafeId(task.clientId), type = sorteoNorm(task.tipo);
    const key = `${clientId}|${type}`;
    if (!clientId || !["compra", "renovacion"].includes(type) || existing.has(key)) {
      omitted += 1;
      continue;
    }
    const result = await registrarEventoSorteosSeguro({
      tipo: type,
      clientId,
      eventoId: `retro:${CARGA_AGOSTO_2026}:${type}:${clientId}`,
      sorteoId: drawId,
      omitirFidelidad: true,
      origen: "Carga agosto 2026"
    });
    created += Math.max(0, Number(result.creados) || 0);
    if (result.ok === false) errors.push({ clientId, tipo: type, error: sorteoClean(result.error || result.omitido || "No procesado", 180) });
    else if (!result.creados) omitted += 1;
    existing.add(key);
  }

  const nextCursor = cursor + chunk.length;
  const completed = nextCursor >= tasks.length;
  const totalCreated = Math.max(0, Number(job.totalCreados) || 0) + created;
  const totalOmitted = Math.max(0, Number(job.totalOmitidos) || 0) + omitted;
  await jobRef.set({
    cursor: nextCursor,
    totalCreados: totalCreated,
    totalOmitidos: totalOmitted,
    errores: errors.slice(-40),
    completado: completed,
    completedAt: completed ? admin.firestore.FieldValue.serverTimestamp() : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: editor.actor
  }, { merge: true });
  if (completed) {
    await db.collection("auditoria_eventos").doc().set({
      tipo: "sorteo_carga_agosto_2026",
      sorteoId: drawId,
      clientesDetectados: Number(job.clientesDetectados) || 0,
      boletosCreados: totalCreated,
      tareasProcesadas: nextCursor,
      usuario: editor.actor,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  return {
    ok: true, completado: completed, periodo: CARGA_AGOSTO_2026,
    clientesDetectados: Number(job.clientesDetectados) || 0,
    totalTareas: tasks.length, procesados: nextCursor,
    boletosCreados: totalCreated, creadosEnEstePaso: created,
    omitidos: totalOmitted, errores: errors.length
  };
}

function maskedWinner(winner = {}) {
  if (!winner || !winner.clientId) return null;
  const phone = String(winner.telefono || "").replace(/\D/g, "");
  const first = sorteoClean(winner.clienteNombre, 100).split(" ")[0] || "Cliente";
  return { nombre: first, telefono: phone ? `****${phone.slice(-4)}` : "", codigo: sorteoClean(winner.codigo, 80) };
}

async function publicLoad(db, token) {
  const { clientId, cliente, enlace } = await resolvePublicClient(db, token);
  const { vendors, thirdParty } = publicRaffleAccess(cliente, enlace);
  if (!vendors.length) {
    return { ok: true, habilitado: false, cliente: { clientId, nivel: "regular", ciclos: 0 }, sorteos: [] };
  }
  const [drawSnap, ticketSnap, prizeSnap, deliveriesSnap] = await Promise.all([
    db.collection(SORTEOS_COLLECTION).limit(150).get(),
    db.collection(BOLETOS_COLLECTION).where("clientId", "==", clientId).get(),
    db.collection(PREMIOS_COLLECTION).limit(300).get(),
    db.collection(ENTREGAS_COLLECTION).where("clientId", "==", clientId).get()
  ]);
  const now = Date.now();
  const draws = drawSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(draw => vendors.some(vendor => scopeMatches(draw, vendor)) && draw.estado !== "borrador" && (!draw.fechaInicio || new Date(draw.fechaInicio).getTime() <= now));
  const drawIds = new Set(draws.map(draw => draw.id));
  const tickets = ticketSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(ticket => drawIds.has(String(ticket.sorteoId || "")) && vendors.includes(sorteoVendorGroup(ticket.vendedorNorm || ticket.vendedor)));
  const premiosMap = new Map(prizeSnap.docs.filter(doc => prizeAvailable(doc.data() || {})).map(doc => [doc.id, publicPrize(doc)]));
  const entregas = deliveriesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
  const entregasMap = new Map(entregas.map(item => [String(item.sorteoId || ""), item]));
  const resultado = draws.map(draw => {
    const propios = tickets.filter(ticket => String(ticket.sorteoId || "") === draw.id);
    const winnerVendor = sorteoVendorGroup(draw.ganador?.vendedorNorm || draw.ganador?.vendedor);
    const winnerSelf = String(draw.ganador?.clientId || "") === clientId &&
      (winnerVendor ? vendors.includes(winnerVendor) : !thirdParty);
    const entrega = winnerSelf ? entregasMap.get(draw.id) || null : null;
    return {
      id: draw.id,
      titulo: sorteoClean(draw.titulo, 140), descripcion: sorteoClean(draw.descripcion, 600),
      categoria: sorteoNorm(draw.categoria), estado: sorteoNorm(draw.estado),
      fechaInicio: draw.fechaInicio || "", fechaFin: draw.fechaFin || "",
      color: color(draw.color), totalBoletos: propios.length,
      boletos: propios.sort((a, b) => Number(a.numero) - Number(b.numero)).map(ticket => ({
        codigo: sorteoClean(ticket.codigo, 80), tipo: sorteoNorm(ticket.tipo), origen: sorteoClean(ticket.origen, 80)
      })),
      premios: uniqueIds(draw.premioIds, 5).map(id => premiosMap.get(id)).filter(Boolean),
      ganador: maskedWinner(draw.ganador),
      ganadorActual: winnerSelf,
      eleccion: entrega ? {
        premioId: entrega.premioId || "", premioNombre: entrega.premioNombre || "",
        estado: entrega.estado || "pendiente", codigo: entrega.codigo || "", cupon: entrega.cupon || "",
        instrucciones: entrega.instrucciones || ""
      } : null
    };
  }).sort((a, b) => String(b.fechaInicio).localeCompare(String(a.fechaInicio)));
  const ciclos = Math.max(0, Number(cliente.fidelidadCiclos) || 0);
  const oro = cliente.clienteOro === true || sorteoNorm(cliente.nivelCliente) === "oro" || ciclos >= 6;
  return { ok: true, habilitado: true, cliente: { clientId, nivel: oro ? "oro" : "regular", ciclos }, sorteos: resultado };
}

async function choosePrize(db, body) {
  const { clientId, cliente, enlace } = await resolvePublicClient(db, body.token);
  const { vendors } = publicRaffleAccess(cliente, enlace);
  if (!vendors.length) {
    throw Object.assign(new Error("Sorteos no está disponible para este enlace."), { status: 403 });
  }
  const sorteoId = sorteoSafeId(body.sorteoId);
  const premioId = sorteoSafeId(body.premioId);
  if (!sorteoId || !premioId) throw Object.assign(new Error("Selección inválida."), { status: 400 });
  const drawRef = db.collection(SORTEOS_COLLECTION).doc(sorteoId);
  const prizeRef = db.collection(PREMIOS_COLLECTION).doc(premioId);
  const entregaRef = db.collection(ENTREGAS_COLLECTION).doc(`${sorteoId}_${clientId}`);
  const result = await db.runTransaction(async transaction => {
    const [drawSnap, prizeSnap, deliverySnap] = await Promise.all([
      transaction.get(drawRef), transaction.get(prizeRef), transaction.get(entregaRef)
    ]);
    if (!drawSnap.exists || String((drawSnap.data() || {}).ganador?.clientId || "") !== clientId) throw Object.assign(new Error("Este cliente no es el ganador del sorteo."), { status: 403 });
    const draw = drawSnap.data() || {};
    if (!vendors.some(vendor => scopeMatches(draw, vendor))) throw Object.assign(new Error("Este sorteo no pertenece a este enlace."), { status: 403 });
    const winnerVendor = sorteoVendorGroup(draw.ganador?.vendedorNorm || draw.ganador?.vendedor);
    if (winnerVendor && !vendors.includes(winnerVendor)) throw Object.assign(new Error("Este premio no pertenece a este enlace."), { status: 403 });
    if (!uniqueIds(draw.premioIds, 5).includes(premioId)) throw new Error("El premio no pertenece a este sorteo.");
    if (deliverySnap.exists) {
      const previous = deliverySnap.data() || {};
      if (String(previous.premioId || "") !== premioId) throw new Error("El premio ya fue elegido y no puede cambiarse.");
      return previous;
    }
    if (!prizeSnap.exists || (prizeSnap.data() || {}).activo === false) throw new Error("Este premio ya no está disponible.");
    const prize = prizeSnap.data() || {};
    let codigo = "";
    let cupon = "";
    const codes = Array.isArray(prize.codigosDisponibles) ? [...prize.codigosDisponibles] : [];
    if (prize.entregaModo === "codigo") {
      if (!codes.length) throw new Error("El código digital se agotó. Contacte a soporte.");
      codigo = sorteoClean(codes.shift(), 300);
    } else if (prize.entregaModo === "cupon") {
      cupon = `SUB-${randomBytes(4).toString("hex").toUpperCase()}`;
    } else if ((Number(prize.stock) || 0) - (Number(prize.reservados) || 0) - (Number(prize.entregados) || 0) <= 0) {
      throw new Error("El premio seleccionado se agotó.");
    }
    const estado = codigo || cupon ? "listo" : "pendiente";
    const entrega = {
      sorteoId, clientId, premioId,
      premioNombre: sorteoClean(prize.nombre, 120), tipo: sorteoNorm(prize.tipo),
      valor: Math.max(0, Number(prize.valor) || 0),
      unidad: sorteoClean(prize.unidad, 40),
      plataforma: sorteoClean(prize.plataforma, 100),
      estado, codigo, cupon,
      instrucciones: sorteoClean(prize.instrucciones, 500),
      elegidoAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    transaction.set(entregaRef, entrega);
    transaction.set(prizeRef, {
      codigosDisponibles: codes,
      stock: prize.entregaModo === "codigo" ? codes.length : Number(prize.stock) || 0,
      reservados: estado === "pendiente" ? admin.firestore.FieldValue.increment(1) : Number(prize.reservados) || 0,
      entregados: estado === "listo" ? admin.firestore.FieldValue.increment(1) : Number(prize.entregados) || 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.update(drawRef, {
      "ganador.premioId": premioId,
      "ganador.premioNombre": entrega.premioNombre,
      "ganador.elegidoAt": admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return entrega;
  });
  return { ...result, elegidoAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

async function savePrize(db, editor, body) {
  const id = sorteoSafeId(body.id);
  const ref = id ? db.collection(PREMIOS_COLLECTION).doc(id) : db.collection(PREMIOS_COLLECTION).doc();
  const snap = id ? await ref.get() : null;
  const previous = snap?.exists ? snap.data() || {} : {};
  if (editor.kind === "relojes" && id && sorteoNorm(previous.ownerVendor) !== "relojes") throw Object.assign(new Error("Relojes solo puede editar sus propios premios."), { status: 403 });
  const prize = normalizePrize(body.premio || {}, previous);
  const requestedOwner = sorteoNorm(body.premio?.ownerVendor);
  const ownerVendor = editor.kind === "relojes"
    ? "relojes"
    : (["sublicuentas", "relojes"].includes(requestedOwner) ? requestedOwner : sorteoNorm(previous.ownerVendor || "sublicuentas"));
  if (id && snap?.exists) {
    const referenced = await db.collection(SORTEOS_COLLECTION).where("premioIds", "array-contains", id).limit(50).get();
    const locked = referenced.docs.some(doc => ["activo", "cerrado", "finalizado"].includes(sorteoNorm((doc.data() || {}).estado)));
    if (locked) {
      const protectedFields = ["nombre", "descripcion", "tipo", "valor", "unidad", "plataforma", "entregaModo"];
      const identityChanged = protectedFields.some(field => String(previous[field] ?? "") !== String(prize[field] ?? ""));
      if (identityChanged || ownerVendor !== sorteoNorm(previous.ownerVendor || "sublicuentas") || prize.activo === false) {
        throw new Error("Este premio está comprometido en un sorteo publicado. Puede agregar existencias o instrucciones, pero no cambiarlo ni ocultarlo.");
      }
    }
  }
  const now = admin.firestore.FieldValue.serverTimestamp();
  await ref.set({
    ...prize,
    ownerVendor,
    createdAt: previous.createdAt || now,
    updatedAt: now,
    updatedBy: editor.actor
  }, { merge: false });
  return { ok: true, id: ref.id };
}

async function saveDraw(db, editor, body) {
  const id = sorteoSafeId(body.id);
  const ref = id ? db.collection(SORTEOS_COLLECTION).doc(id) : db.collection(SORTEOS_COLLECTION).doc();
  const snap = id ? await ref.get() : null;
  const previous = snap?.exists ? snap.data() || {} : {};
  if (previous.ganador) throw new Error("Un sorteo con ganador ya no puede editarse.");
  if (editor.kind === "relojes" && id && sorteoNorm(previous.alcance) !== "relojes") throw Object.assign(new Error("Relojes solo puede editar sus propios sorteos."), { status: 403 });
  const draw = normalizeDraw(body.sorteo || {}, previous, editor);
  assertDrawEditAllowed(previous, draw, Boolean(id && snap?.exists));
  const prizeDocs = await Promise.all(draw.premioIds.map(prizeId => db.collection(PREMIOS_COLLECTION).doc(prizeId).get()));
  if (prizeDocs.some(doc => !doc.exists || !prizeAvailable(doc.data() || {}))) throw new Error("Uno de los premios seleccionados no está disponible o se agotó.");
  if (editor.kind === "relojes" && prizeDocs.some(doc => sorteoNorm((doc.data() || {}).ownerVendor) !== "relojes")) throw Object.assign(new Error("Relojes solo puede utilizar sus propios premios."), { status: 403 });
  const now = admin.firestore.FieldValue.serverTimestamp();
  await ref.set({ ...draw, createdAt: previous.createdAt || now, updatedAt: now, updatedBy: editor.actor }, { merge: false });
  return { ok: true, id: ref.id };
}

async function closeDraw(db, editor, id) {
  const ref = db.collection(SORTEOS_COLLECTION).doc(sorteoSafeId(id));
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error("Sorteo no encontrado."), { status: 404 });
  const draw = snap.data() || {};
  if (!drawVisibleToEditor(draw, editor)) throw Object.assign(new Error("No puede cerrar este sorteo."), { status: 403 });
  if (draw.ganador) throw new Error("El sorteo ya tiene ganador.");
  if (draw.estado !== "activo") throw new Error("Solo un sorteo activo puede cerrar su participación.");
  const ticketSnap = await db.collection(BOLETOS_COLLECTION).where("sorteoId", "==", ref.id).get();
  const validTickets = ticketSnap.docs.map(doc => doc.data() || {}).filter(ticket =>
    ticket.activo !== false && sorteoVendorElegible(ticket.vendedorNorm || ticket.vendedor) && scopeMatches(draw, ticket.vendedorNorm || ticket.vendedor)
  );
  if (!validTickets.length) throw new Error("Todavía no hay boletos válidos de Sublicuentas o Relojes para cerrar.");
  await ref.set({ estado: "cerrado", cerradoAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, id: ref.id, estado: "cerrado" };
}

async function spinDraw(db, editor, id) {
  const sorteoId = sorteoSafeId(id);
  const ref = db.collection(SORTEOS_COLLECTION).doc(sorteoId);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error("Sorteo no encontrado."), { status: 404 });
  const draw = snap.data() || {};
  if (!drawVisibleToEditor(draw, editor)) throw Object.assign(new Error("No puede realizar este sorteo."), { status: 403 });
  if (draw.estado !== "cerrado") throw new Error("Cierre la participación antes de girar la ruleta.");
  if (draw.ganador) return { ok: true, id: sorteoId, ganador: draw.ganador, repetido: true };
  const ticketSnap = await db.collection(BOLETOS_COLLECTION).where("sorteoId", "==", sorteoId).get();
  const tickets = ticketSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) })).filter(ticket =>
    ticket.activo !== false && sorteoVendorElegible(ticket.vendedorNorm || ticket.vendedor) && scopeMatches(draw, ticket.vendedorNorm || ticket.vendedor)
  );
  if (!tickets.length) throw new Error("Este sorteo no tiene boletos participantes.");
  const chosen = tickets[randomInt(tickets.length)];
  const ganador = {
    ticketId: chosen.id,
    codigo: chosen.codigo,
    clientId: chosen.clientId,
    clienteNombre: chosen.clienteNombre,
    telefono: chosen.telefono,
    vendedor: chosen.vendedor,
    tipo: chosen.tipo,
    premioId: "",
    premioNombre: ""
  };
  const saved = await db.runTransaction(async transaction => {
    const latest = await transaction.get(ref);
    if (!latest.exists) throw new Error("Sorteo no encontrado.");
    const current = latest.data() || {};
    if (current.ganador) return current.ganador;
    if (current.estado !== "cerrado") throw new Error("El sorteo ya no está cerrado.");
    transaction.set(ref, {
      ganador,
      estado: "finalizado",
      sorteadoAt: admin.firestore.FieldValue.serverTimestamp(),
      sorteadoPor: editor.actor,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.set(db.collection("auditoria_eventos").doc(), {
      tipo: "sorteo_realizado", sorteoId, ganadorTicket: ganador.codigo,
      ganadorClientId: ganador.clientId, usuario: editor.actor,
      totalParticipantes: tickets.length,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return ganador;
  });
  return { ok: true, id: sorteoId, ganador: saved, totalParticipantes: tickets.length };
}

async function markDelivered(db, editor, body) {
  const entregaId = sorteoSafeId(body.id);
  if (!entregaId) throw new Error("Entrega inválida.");
  const ref = db.collection(ENTREGAS_COLLECTION).doc(entregaId);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error("Entrega no encontrada."), { status: 404 });
  const entrega = snap.data() || {};
  const drawSnap = await db.collection(SORTEOS_COLLECTION).doc(sorteoSafeId(entrega.sorteoId)).get();
  if (!drawSnap.exists || !drawVisibleToEditor(drawSnap.data() || {}, editor)) throw Object.assign(new Error("No puede modificar esta entrega."), { status: 403 });
  await db.runTransaction(async transaction => {
    const latest = await transaction.get(ref);
    if (!latest.exists) throw Object.assign(new Error("Entrega no encontrada."), { status: 404 });
    const current = latest.data() || {};
    if (current.estado === "entregado") return;
    const prizeRef = current.estado === "pendiente" && current.premioId
      ? db.collection(PREMIOS_COLLECTION).doc(sorteoSafeId(current.premioId)) : null;
    const prizeSnap = prizeRef ? await transaction.get(prizeRef) : null;
    transaction.set(ref, {
      estado: "entregado",
      instrucciones: sorteoClean(body.instrucciones || current.instrucciones, 500),
      entregadoAt: admin.firestore.FieldValue.serverTimestamp(),
      entregadoPor: editor.actor,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    if (prizeRef && prizeSnap?.exists) {
      const prize = prizeSnap.data() || {};
      transaction.set(prizeRef, {
        reservados: Math.max(0, (Number(prize.reservados) || 0) - 1),
        entregados: Math.max(0, Number(prize.entregados) || 0) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });
  return { ok: true, id: entregaId, estado: "entregado" };
}

export default async function handler(req, res) {
  setHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });
  try {
    const db = getApp().firestore();
    if (req.method === "GET") return res.status(200).json(await publicLoad(db, req.query?.token));
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Método no permitido." });
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const action = sorteoNorm(body.accion || "cargar");
    if (action === "elegir_premio") {
      const result = await choosePrize(db, body);
      return res.status(200).json({ ok: true, eleccion: result });
    }
    const editor = await requireEditor(req, res);
    if (!editor) return;
    if (action === "cargar") return res.status(200).json(await adminLoad(db, editor));
    if (action === "guardar_premio") return res.status(200).json(await savePrize(db, editor, body));
    if (action === "guardar_sorteo") return res.status(200).json(await saveDraw(db, editor, body));
    if (action === "cargar_agosto_2026") return res.status(200).json(await backfillAugust2026(db, editor, body));
    if (action === "cerrar_sorteo") return res.status(200).json(await closeDraw(db, editor, body.id));
    if (action === "girar_ruleta") return res.status(200).json(await spinDraw(db, editor, body.id));
    if (action === "marcar_entregado") return res.status(200).json(await markDelivered(db, editor, body));
    return res.status(400).json({ ok: false, error: "Acción no válida." });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("SORTEOS_ERROR", error);
    return res.status(status).json({ ok: false, error: String(error?.message || error || "Error interno.") });
  }
}
