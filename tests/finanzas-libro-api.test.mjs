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

test("saldo inicial: un banco ya activado no se vuelve a registrar (ni con otra fecha)", async () => {
  const fut = await call({ accion: "registrar_saldo_inicial", bancoId: "bac-credomatic", monto: 1, desde: "2999-01-01" });
  assert.equal(fut.ok, false);
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

test("saldo inicial con fecha pasada: el ciclo y el banco cuentan desde ese día", async () => {
  // libro limpio para esta prueba
  for (const k of [...db.store.keys()]) if (k.startsWith("finanzas_") || k.startsWith("planilla_")) db.store.delete(k);
  const hoy = (await call({ accion: "finanzas_resumen" })).hoy;
  const ayer = new Date(Date.parse(hoy + "T12:00:00Z") - 86400000).toISOString().slice(0, 10);
  await db.collection("finanzas_movimientos").doc("viejo").set({ tipo: "ingreso", monto: 300, bancoId: "ficohsa", fechaPago: ayer, fechaTS: admin.firestore.Timestamp.fromDate(new Date(ayer + "T12:00:00Z")) });
  const r = await call({ accion: "registrar_saldo_inicial", bancoId: "ficohsa", monto: 1000, desde: ayer });
  assert.equal(r.ok, true, r.error); assert.equal(r.desde, ayer);
  const s = await call({ accion: "finanzas_resumen" });
  assert.equal(s.ciclo.inicio, ayer);
  assert.equal(s.totales.ingresos, 300);
  assert.equal(s.bancos.find((b) => b.id === "ficohsa").saldo, 1300);
});

test("R106 centro financiero: compra/renovación parcial y pendiente, abonos, transferencia, anular y corregir con reversa", async () => {
  for (const k of [...db.store.keys()]) if (/^(finanzas_|planilla_|cuentas_por_cobrar|auditoria_)/.test(k)) db.store.delete(k);
  const res = async () => call({ accion: "finanzas_resumen" });
  const hoy = (await res()).hoy;
  for (const [bancoId, monto] of [["bac-credomatic", 4000], ["ficohsa", 1000], ["banco-atlantida", 600], ["tigo-money", 400]]) await call({ accion: "registrar_saldo_inicial", bancoId, monto, desde: hoy });
  const banco = async (id) => (await res()).bancos.find((b) => b.id === id).saldo;

  // Compra nueva Ana: total 300, recibe 100 en Ficohsa → ingreso 100, cartera cliente 200, ventas 300
  const ana = await call({ accion: "registrar_operacion_pago", tipoOrigen: "compra", montoTotal: 300, recibido: 100, bancoId: "ficohsa", clienteId: "ana", clienteNombre: "Ana", plataforma: "Disney", compraId: "k-ana", operationId: "op-ana-compra" });
  assert.equal(ana.ok, true, ana.error); assert.equal(ana.estado, "parcial"); assert.equal(ana.saldo, 200);
  assert.equal((await call({ accion: "registrar_operacion_pago", tipoOrigen: "compra", montoTotal: 300, recibido: 100, bancoId: "ficohsa", operationId: "op-ana-compra" })).duplicado, true);
  // Renovación Juan totalmente pendiente: bancos sin cambio, cartera +220
  const juan = await call({ accion: "registrar_operacion_pago", tipoOrigen: "renovacion", montoTotal: 220, recibido: 0, clienteId: "juan", clienteNombre: "Juan", plataforma: "Netflix", operationId: "op-juan-ren" });
  assert.equal(juan.estado, "pendiente");
  // Vendedor retiene 500
  const ven = await call({ accion: "registrar_operacion_pago", tipoOrigen: "renovacion", montoTotal: 500, recibido: 0, responsable: "vendedor", vendedorNombre: "Heber", clienteNombre: "Carlos", operationId: "op-heber" });
  assert.equal(ven.ok, true, ven.error);
  let r = await res();
  assert.equal(r.totales.ventasGeneradas, 1020); assert.equal(r.totales.ingresos, 100);
  assert.equal(r.cartera.pendienteClientes, 420); assert.equal(r.cartera.pendienteVendedores, 500);
  assert.equal(await banco("ficohsa"), 1100); assert.equal(await banco("bac-credomatic"), 4000);
  assert.equal(r.totalBancos, 6100, "los pendientes NO suman a bancos");

  // Abono Ana 120 en BAC → BAC +120, cartera Ana 80; repetir no duplica; abono mayor al saldo se rechaza
  const ab = await call({ accion: "registrar_abono", cuentaId: ana.cuentaId, monto: 120, bancoId: "bac-credomatic", operationId: "op-abono-ana" });
  assert.equal(ab.ok, true, ab.error); assert.equal(ab.saldoPendiente, 80);
  assert.equal((await call({ accion: "registrar_abono", cuentaId: ana.cuentaId, monto: 120, bancoId: "bac-credomatic", operationId: "op-abono-ana" })).duplicado, true);
  assert.match((await call({ accion: "registrar_abono", cuentaId: ana.cuentaId, monto: 500, bancoId: "bac-credomatic", operationId: "op-abono-mucho" })).error, /mayor que el saldo/);
  assert.equal(await banco("bac-credomatic"), 4120);
  // Corregir el banco del abono (BAC → Tigo): BAC vuelve, Tigo +120, cartera intacta en 80
  const corrAb = await call({ accion: "corregir_movimiento", movimientoId: ab.movimientoId, bancoId: "tigo-money", motivo: "banco equivocado", operationId: "op-corr-abono" });
  assert.equal(corrAb.ok, true, corrAb.error);
  assert.equal(await banco("bac-credomatic"), 4000); assert.equal(await banco("tigo-money"), 520);
  let pend = await call({ accion: "listar_pendientes", deudorTipo: "cliente" });
  assert.equal(pend.cuentas.find((c) => c.id === ana.cuentaId).saldoPendiente, 80);

  // Transferencia BAC → Ficohsa 1000: total igual
  const antes = (await res()).totalBancos;
  assert.equal((await call({ accion: "registrar_transferencia", origenId: "bac-credomatic", destinoId: "ficohsa", monto: 1000, operationId: "op-transf-1" })).ok, true);
  r = await res(); assert.equal(r.totalBancos, antes); assert.equal(await banco("bac-credomatic"), 3000); assert.equal(r.totales.ingresos, 220);

  // Planilla Naara 200 desde BAC → corregir a Ficohsa (motivo obligatorio); BAC restaurado, Ficohsa −200
  const pago = await call({ accion: "confirmar_pago_planilla", beneficiario: "Naara", concepto: "pago_planilla", montoTotal: 200, asignaciones: [{ bancoId: "bac-credomatic", monto: 200 }], operationId: "op-naara" });
  assert.equal(pago.ok, true, pago.error);
  const fic0 = await banco("ficohsa");
  assert.match((await call({ accion: "corregir_pago_planilla", planillaPagoId: pago.pago.id, asignaciones: [{ bancoId: "ficohsa", monto: 200 }], operationId: "op-corr-naara" })).error, /motivo/);
  const corr = await call({ accion: "corregir_pago_planilla", planillaPagoId: pago.pago.id, asignaciones: [{ bancoId: "ficohsa", monto: 200 }], motivo: "banco equivocado", operationId: "op-corr-naara" });
  assert.equal(corr.ok, true, corr.error);
  assert.equal((await call({ accion: "corregir_pago_planilla", planillaPagoId: pago.pago.id, asignaciones: [{ bancoId: "ficohsa", monto: 200 }], motivo: "banco equivocado", operationId: "op-corr-naara" })).duplicado, true);
  assert.equal(await banco("bac-credomatic"), 3000); assert.equal(await banco("ficohsa"), fic0 - 200);
  r = await res(); assert.equal(r.totales.planilla, 200, "el pago sigue siendo 200, sin duplicar");
  // Corregir monto 200 → 180 y luego anular: todo vuelve exacto
  const c2 = await call({ accion: "corregir_pago_planilla", planillaPagoId: corr.sustitutoId, montoTotal: 180, asignaciones: [{ bancoId: "ficohsa", monto: 180 }], motivo: "monto real 180", operationId: "op-corr-naara-2" });
  assert.equal(c2.ok, true, c2.error); assert.equal((await res()).totales.planilla, 180); assert.equal(await banco("ficohsa"), fic0 - 180);
  const an = await call({ accion: "anular_pago_planilla", planillaPagoId: c2.sustitutoId, motivo: "pago duplicado", operationId: "op-anular-naara" });
  assert.equal(an.ok, true, an.error); assert.equal((await res()).totales.planilla, 0); assert.equal(await banco("ficohsa"), fic0);
  assert.equal(db.store.get(`planilla_pagos/${pago.pago.id}`).estado, "corregido", "el original queda visible, no se borra");

  // Anular el abono (ya corregido → anular el sustituto): cartera de Ana vuelve a 200
  const sus = [...db.store.keys()].find((k) => k.startsWith(`finanzas_movimientos/${ab.movimientoId}_c`)).split("/")[1];
  assert.equal((await call({ accion: "anular_movimiento", movimientoId: sus, motivo: "no pagó realmente", operationId: "op-anular-abono" })).ok, true);
  pend = await call({ accion: "listar_pendientes" });
  assert.equal(pend.cuentas.find((c) => c.id === ana.cuentaId).saldoPendiente, 200);
  assert.equal(await banco("tigo-money"), 400);
  // Auditoría: cada operación deja evento con antes/después
  const ev = [...db.store.entries()].filter(([k]) => k.startsWith("auditoria_eventos/")).map(([, v]) => v);
  for (const a of ["compra_pago", "renovacion_pago", "abono", "corregir_movimiento", "transferencia", "corregir_pago_planilla", "anular_pago_planilla", "anular_movimiento"]) assert.ok(ev.some((e) => e.accion === a), a);
  assert.ok(ev.find((e) => e.accion === "corregir_pago_planilla").before.asignaciones.length);
});
