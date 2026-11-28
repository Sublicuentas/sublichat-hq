import test from "node:test";
import assert from "node:assert/strict";
import admin from "firebase-admin";

// ---------- Firestore en memoria (solo lo que usa api/finanzas.js) ----------
function fakeDb() {
  const store = new Map(); // "col/id" -> data
  let auto = 0;
  const cmp = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : v);
  const docRef = (col, id) => ({
    id, _key: `${col}/${id}`,
    async get() { const d = store.get(`${col}/${id}`); return { id, exists: !!d, data: () => (d ? structuredClone(d) : undefined) }; },
    async set(data, opts) { const key = `${col}/${id}`; store.set(key, opts?.merge ? { ...(store.get(key) || {}), ...data } : { ...data }); },
  });
  const query = (col, filters = [], lim = Infinity, order = null) => ({
    where(f, op, v) { return query(col, [...filters, [f, op, v]], lim, order); },
    limit(n) { return query(col, filters, n, order); },
    orderBy(f, dir) { return query(col, filters, lim, [f, dir]); },
    async get() {
      let docs = [...store.entries()].filter(([k]) => k.startsWith(`${col}/`)).map(([k, d]) => ({ id: k.slice(col.length + 1), data: () => structuredClone(d), _d: d }));
      for (const [f, op, v] of filters) docs = docs.filter((x) => (op === ">=" ? cmp(x._d[f]) >= cmp(v) : op === "==" ? x._d[f] === v : true));
      if (order) docs.sort((a, b) => String(a._d[order[0]]).localeCompare(String(b._d[order[0]])) * (order[1] === "desc" ? -1 : 1));
      docs = docs.slice(0, lim);
      return { docs, size: docs.length, forEach: (fn) => docs.forEach(fn) };
    },
  });
  const db = {
    store,
    collection: (col) => ({ ...query(col), doc: (id) => docRef(col, id || `auto${++auto}`), add: async (d) => { const r = docRef(col, `auto${++auto}`); await r.set(d); return r; } }),
    async runTransaction(fn) { return fn({ get: (x) => x.get(), set: (ref, data, opts) => ref.set(data, opts) }); },
  };
  return db;
}

const db = fakeDb();
Object.defineProperty(admin, "apps", { get: () => [1], configurable: true });
Object.defineProperty(admin, "app", { value: () => ({ firestore: () => db }), configurable: true, writable: true });
let currentUser = { uid: "uSub", role: "admin", usuario: "naara" };
Object.defineProperty(admin, "auth", { value: () => ({ verifyIdToken: async () => currentUser }), configurable: true, writable: true });
const { default: handler } = await import("../api/finanzas.js");

async function call(body) {
  let out;
  const res = { setHeader() {}, status() { return this; }, json(x) { out = x; return this; }, end() { return this; } };
  await handler({ method: "POST", headers: { authorization: "Bearer t" }, body }, res);
  return out;
}

await db.collection("portal_cliente").doc("configuracion").set({ metodos: [
  { id: "bac-credomatic", nombre: "BAC Credomatic", logoKey: "bac", cuenta: "1", activo: true },
  { id: "ficohsa", nombre: "Ficohsa", logoKey: "ficohsa", cuenta: "2", activo: true },
  { id: "banco-atlantida", nombre: "Banco Atlántida", logoKey: "atlantida", cuenta: "3", activo: true },
  { id: "tigo-money", nombre: "Tigo Money", logoKey: "tigo", cuenta: "4", activo: true },
] });


// ===================== R211 · Rev02: Geisell 50 %, pago masivo con fecha real, conciliación, idempotencia =====================
const movs = () => [...db.store.entries()].filter(([k]) => k.startsWith("finanzas_movimientos/")).map(([k, d]) => ({ id: k.split("/")[1], ...d }));
const cxc = (id) => db.store.get(`cuentas_por_cobrar/${id}`);
await call({ accion: "registrar_saldo_inicial", bancoId: "bac-credomatic", monto: 1000 });

test("Geisell: venta L150 con Pago pendiente → deuda L75; abono L50 → L25; pago L25 → L0 (sin dividir otra vez)", async () => {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Tegucigalpa" });
  const r = await call({ accion: "registrar_operacion_pago", tipoOrigen: "renovacion", montoTotal: 150, recibido: 0, responsable: "vendedor", vendedorNombre: "Geisell", vendedorId: "geisell", clienteId: "c1", clienteNombre: "Cliente Prueba", plataforma: "Netflix", operationId: "op-g-150" });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.saldo, 75); assert.equal(r.saldoBruto, 150);
  const c = cxc(r.cuentaId); assert.equal(c.saldoPendiente, 75); assert.equal(c.montoOriginalPendiente, 75); assert.equal(c.reglaVendedor.clave, "geisell"); assert.equal(c.montoBaseVendedor, 150);
  assert.equal(movs().filter((m) => m.tipo === "ingreso" && m.operacionId === r.operacionId).length, 0, "no entra dinero a bancos");
  const a = await call({ accion: "registrar_pago_masivo", cuentas: [r.cuentaId], monto: 50, bancoId: "bac-credomatic", fechaPago: hoy, operationId: "op-g-ab50" });
  assert.equal(a.ok, true, JSON.stringify(a)); assert.equal(cxc(r.cuentaId).saldoPendiente, 25);
  const rep = await call({ accion: "registrar_pago_masivo", cuentas: [r.cuentaId], monto: 50, bancoId: "bac-credomatic", fechaPago: hoy, operationId: "op-g-ab50" });
  assert.equal(rep.duplicado, true, "doble clic / reintento no duplica"); assert.equal(cxc(r.cuentaId).saldoPendiente, 25);
  const b = await call({ accion: "registrar_abono", cuentaId: r.cuentaId, monto: 25, bancoId: "bac-credomatic", operationId: "op-g-ab25" });
  assert.equal(b.ok, true, JSON.stringify(b)); assert.equal(cxc(r.cuentaId).saldoPendiente, 0); assert.equal(cxc(r.cuentaId).estado, "pagado");
  const ing = movs().filter((m) => m.tipo === "ingreso" && (m.conciliaCuentas || [m.cuentaId]).includes(r.cuentaId));
  assert.equal(ing.reduce((x, m) => x + m.monto, 0), 75, "entraron L75 en total, ni un lempira más");
});

test("otro vendedor (Heber) conserva su lógica; pago de octubre registrado después conserva origen y usa la fecha real; vincular no crea ingreso", async () => {
  const r = await call({ accion: "registrar_operacion_pago", tipoOrigen: "compra", montoTotal: 150, recibido: 0, responsable: "vendedor", vendedorNombre: "Heber", clienteId: "c2", clienteNombre: "Cliente Dos", plataforma: "Disney", operationId: "op-h-150" });
  assert.equal(r.saldo, 150); assert.equal(cxc(r.cuentaId).reglaVendedor, undefined);
  // pago ya contabilizado antes (sin vínculo) → se concilia
  await db.collection("finanzas_movimientos").doc("m-heber").set({ movimientoId: "m-heber", tipo: "ingreso", monto: 150, bancoId: "bac-credomatic", banco: "BAC Credomatic", descripcion: "Entrega Heber", fecha: "2026-11-02" });
  const antes = movs().filter((m) => m.tipo === "ingreso").length;
  const fechaReal = new Date(Date.now() - 20 * 864e5).toLocaleDateString("en-CA", { timeZone: "America/Tegucigalpa" });
  const v = await call({ accion: "registrar_pago_masivo", cuentas: [r.cuentaId], monto: 150, vincularMovimientoId: "m-heber", fechaPago: fechaReal, operationId: "op-h-vinc" });
  assert.equal(v.ok, true, JSON.stringify(v)); assert.equal(v.vinculado, true); assert.equal(cxc(r.cuentaId).saldoPendiente, 0);
  assert.equal(movs().filter((m) => m.tipo === "ingreso").length, antes, "no se creó otro ingreso");
  assert.equal(cxc(r.cuentaId).abonos.at(-1).fechaEfectiva, fechaReal);
  const otra = await call({ accion: "registrar_operacion_pago", tipoOrigen: "compra", montoTotal: 90, recibido: 0, responsable: "vendedor", vendedorNombre: "Heber", clienteId: "c3", clienteNombre: "Cliente Tres", plataforma: "Spotify", operationId: "op-heber-90" }); assert.equal(otra.ok, true, JSON.stringify(otra));
  const dup = await call({ accion: "registrar_pago_masivo", cuentas: [otra.cuentaId], monto: 90, vincularMovimientoId: "m-heber", fechaPago: fechaReal, operationId: "op-h-vinc2" });
  assert.equal(dup.ok, false); assert.match(dup.error, /ya está vinculado/);
  const fut = await call({ accion: "registrar_pago_masivo", cuentas: [otra.cuentaId], monto: 90, bancoId: "bac-credomatic", fechaPago: "2099-01-01", operationId: "op-futuro-1" });
  assert.equal(fut.ok, false);
});

test("solo administración registra pagos masivos; la vista previa no escribe", async () => {
  currentUser = { uid: "uGei", role: "vendedor", usuario: "geisell" };
  const r = await call({ accion: "registrar_pago_masivo", cuentas: ["x"], monto: 1, bancoId: "bac-credomatic", fechaPago: "2026-11-01", operationId: "op-noadmin-1" });
  assert.equal(r.ok, false);
  currentUser = { uid: "uSub", role: "admin", usuario: "naara" };
  const n = db.store.size; const p = await call({ accion: "listar_obligaciones_previa" });
  assert.equal(p.ok, true); assert.equal(p.soloLectura, true); assert.equal(db.store.size, n);
  const l = await call({ accion: "listar_pendientes", deudorTipo: "vendedor" });
  assert.equal(l.ok, true); assert.ok(l.cartera); assert.ok(l.cuentas.every((c) => c.deudorTipo === "vendedor"));
});
