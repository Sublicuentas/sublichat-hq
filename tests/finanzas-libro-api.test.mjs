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

test("solo Sublicuentas y Relojes usan el libro; un vendedor recibe 403", async () => {
  currentUser = { uid: "uVend", role: "vendedor", usuario: "heber" };
  const r = await call({ accion: "finanzas_resumen" });
  assert.equal(r.ok, false); assert.match(r.error, /exclusivo de Sublicuentas y Relojes/);
  currentUser = { uid: "uRel", role: "relojes", usuario: "libni" };
  assert.equal((await call({ accion: "finanzas_resumen" })).ok, true);
  currentUser = { uid: "uSub", role: "admin", usuario: "naara" };
});

test("saldo inicial único por banco; corregir exige ajuste", async () => {
  for (const [bancoId, monto] of [["bac-credomatic", 4000], ["ficohsa", 1000], ["banco-atlantida", 600], ["tigo-money", 400]]) {
    assert.equal((await call({ accion: "registrar_saldo_inicial", bancoId, monto })).ok, true);
  }
  const again = await call({ accion: "registrar_saldo_inicial", bancoId: "ficohsa", monto: 5 });
  assert.equal(again.ok, false); assert.match(again.error, /Ajuste de saldo/);
  const r = await call({ accion: "finanzas_resumen" });
  assert.equal(r.totalBancos, 6000);
  assert.equal(r.metodos[0].cuenta, undefined, "no expone cuentas");
});

test("Caso A + doble toque: renovación L220 en BAC con el mismo operationId crea UN ingreso", async () => {
  const body = { accion: "registrar_cobro_renovacion", monto: 220, bancoId: "bac-credomatic", clienteNombre: "Juan", plataforma: "Netflix", clienteId: "c1", compraId: "k1", operationId: "op-juan-0001" };
  const a = await call(body), b = await call(body);
  assert.equal(a.ok, true); assert.equal(b.duplicado, true);
  const r = await call({ accion: "finanzas_resumen" });
  assert.equal(r.totales.ingresos, 220);
  assert.equal(r.bancos.find((x) => x.id === "bac-credomatic").saldo, 4220);
  const sinMonto = await call({ ...body, monto: 0, operationId: "op-juan-0002" });
  assert.equal(sinMonto.ok, false); assert.match(sinMonto.error, /cuánto pagó/);
});

test("Caso B/D/E + idempotencia: planilla multi-banco", async () => {
  // E: faltan 300 → no escribe nada
  const inc = await call({ accion: "confirmar_pago_planilla", beneficiario: "Naara", concepto: "pago_planilla", montoTotal: 2000, asignaciones: [{ bancoId: "bac-credomatic", monto: 1700 }], operationId: "op-planilla-incompleta" });
  assert.equal(inc.ok, false); assert.match(inc.error, /Faltan Lps\. 300/);
  // D: banco insuficiente
  const ins = await call({ accion: "confirmar_pago_planilla", beneficiario: "Naara", concepto: "pago_planilla", montoTotal: 1200, asignaciones: [{ bancoId: "ficohsa", monto: 1200 }], operationId: "op-planilla-insuf" });
  assert.equal(ins.ok, false); assert.match(ins.error, /Saldo insuficiente en Ficohsa/);
  // B: BAC 1000 + Ficohsa 1000 (ingreso de 220 disponible + saldo bancario)
  const ok1 = await call({ accion: "confirmar_pago_planilla", beneficiario: "Naara", concepto: "pago_planilla", montoTotal: 200, asignaciones: [{ bancoId: "bac-credomatic", monto: 100 }, { bancoId: "ficohsa", monto: 100 }], operationId: "op-planilla-naara" });
  assert.equal(ok1.ok, true, ok1.error);
  const dup = await call({ accion: "confirmar_pago_planilla", beneficiario: "Naara", concepto: "pago_planilla", montoTotal: 200, asignaciones: [{ bancoId: "bac-credomatic", monto: 100 }, { bancoId: "ficohsa", monto: 100 }], operationId: "op-planilla-naara" });
  assert.equal(dup.duplicado, true);
  const hijos = [...db.store.keys()].filter((k) => k.startsWith("finanzas_movimientos/planilla_"));
  assert.equal(hijos.length, 2, "un movimiento por banco, sin duplicar");
  const r = await call({ accion: "finanzas_resumen" });
  assert.equal(r.bancos.find((x) => x.id === "bac-credomatic").saldo, 4120);
  assert.equal(r.bancos.find((x) => x.id === "ficohsa").saldo, 900);
  assert.equal(r.totales.planilla, 200);
  assert.equal(r.planillaPagos.length, 1);
  // no se puede pagar más que el disponible del ciclo (220 − 200 = 20)
  const exceso = await call({ accion: "confirmar_pago_planilla", beneficiario: "Manuel", concepto: "comision_vendedor", montoTotal: 500, asignaciones: [{ bancoId: "bac-credomatic", monto: 500 }], operationId: "op-planilla-exceso" });
  assert.equal(exceso.ok, false); assert.match(exceso.error, /disponible del ciclo/);
});

test("“Otro” exige descripción; ajuste exige motivo", async () => {
  const otro = await call({ accion: "confirmar_pago_planilla", beneficiario: "X", concepto: "otro_planilla", montoTotal: 10, asignaciones: [{ bancoId: "bac-credomatic", monto: 10 }], operationId: "op-otro-0001" });
  assert.match(otro.error, /necesita una descripción/);
  assert.match((await call({ accion: "registrar_ajuste_saldo", bancoId: "tigo-money", monto: -50 })).error, /motivo/);
  assert.equal((await call({ accion: "registrar_ajuste_saldo", bancoId: "tigo-money", monto: -50, motivo: "Comisión Tigo" })).ok, true);
  assert.equal((await call({ accion: "finanzas_resumen" })).bancos.find((x) => x.id === "tigo-money").saldo, 350);
});

test("cierre del ciclo: congela totales, conserva saldos y abre el siguiente; repetir no duplica", async () => {
  const before = await call({ accion: "finanzas_resumen" });
  const c = await call({ accion: "guardar_cierre_ciclo", fechaFin: before.hoy, nota: "prueba" });
  assert.equal(c.ok, true, c.error);
  assert.equal(c.cierre.resultado, 20);
  assert.equal(c.cierre.saldoRetenido, before.totalBancos);
  const after = await call({ accion: "finanzas_resumen" });
  assert.equal(after.totalBancos, before.totalBancos, "el cierre no pone bancos en cero");
  assert.equal(after.totales.ingresos, 0, "ciclo nuevo arranca vacío");
  assert.notEqual(after.ciclo.id, before.ciclo.id);
});
