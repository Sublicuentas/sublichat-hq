// R198i · Regla del dueño (20/11/2026): «COSTO POR ACTIVACIÓN». Datos FICTICIOS.
// «Si activo la HBO el 7 de octubre y invierto 3.5 USDT, y los perfiles siguen vendiéndose mes a mes, eso es lo que la cuenta
// costó; la ganancia es todo lo que caiga hasta que vuelva a activarla». → el costo se reconoce UNA vez en la fecha de activación,
// la cuenta queda CUBIERTA (L0) los meses siguientes y el resultado del ciclo = cobrado desde la activación − costo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
import { handlePanel } from '../api/_finanzas-panel.js';
import { movementYmd, movementKind, anuladoOReversa, money } from '../api/_finanzas-libro.js';

const fTS = (f) => { const [y, m, d] = f.split('-'); return { fecha: `${d}/${m}/${y}`, fechaPago: f, mesKey: `${y}-${m}` }; };
let n = 0;
function op(f, { subtipo = 'renovacion', compraId, clienteId, total }) {
  const id = `oper_op_i_${String(++n).padStart(4, '0')}`, r = { clienteId, compraId, plataforma: 'hbomax', vendedor: 'Vendedor A', registradoPor: 'sublicuentas', origenCanal: 'web' };
  return { [`${id}_venta`]: { ...fTS(f), tipo: 'venta', subtipo, monto: total, montoRecibido: total, saldoPendiente: 0, estadoPago: 'pagado', ...r }, [`${id}_cobro`]: { ...fTS(f), tipo: 'ingreso', subtipo: subtipo === 'compra_nueva' ? 'cobro_compra' : 'cobro_renovacion', monto: total, bancoId: 'bac', ...r } };
}
const sv = (compraId, venc) => ({ compraId, plataforma: 'hbomax', planHbo: 'standard', precio: 80, fechaRenovacion: venc, vendedor: 'Vendedor A' });
const link = (fecha, cuenta, usdt, extra = {}) => ({ fecha, estado: 'activo', productoId: 'LINK', producto: 'HBO links', modelo: 'link', unidad: 'link', cantidad: 1, duracionDias: 0, moneda: 'USDT', tasa: 28, costoTotalMoneda: usdt, costoTotalHnl: Math.round(usdt * 28 * 100) / 100, pago: 'binance', cuentaPagoNombre: 'Binance', cuentaInventarioId: cuenta, ...extra });
function semilla({ reactivar = false } = {}) {
  n = 0; const movs = {};
  const K = ['k1', 'k2', 'k3', 'k4', 'k5'];
  K.forEach((k, i) => Object.assign(movs, op(`2026-10-0${8 + i > 9 ? 9 : 8 + i}`, { subtipo: 'compra_nueva', compraId: k, clienteId: `c${i + 1}`, total: 80 })));
  K.forEach((k, i) => Object.assign(movs, op(`2026-11-${String(8 + i).padStart(2, '0')}`, { compraId: k, clienteId: `c${i + 1}`, total: 80 })));
  if (reactivar) K.slice(0, 2).forEach((k, i) => Object.assign(movs, op(`2026-12-0${3 + i * 4}`, { compraId: k, clienteId: `c${i + 1}`, total: 80 }))); // 03/12 (antes) y 07/12 (después de reactivar)
  Object.assign(movs, op('2026-09-20', { subtipo: 'compra_nueva', compraId: 'q1', clienteId: 'c9', total: 70 })); // septiembre: antes de la 1.ª activación
  Object.assign(movs, op('2026-11-15', { compraId: 'z1', clienteId: 'c8', total: 75 })); // cuenta sin activación vinculada
  const clientes = { c8: { nombre: 'Cliente Ocho', servicios: [sv('z1', '15/12/2026')] }, c9: { nombre: 'Cliente Nueve', servicios: [{ ...sv('q1', '20/10/2026'), precio: 70 }] } };
  K.forEach((k, i) => { clientes[`c${i + 1}`] = { nombre: `Cliente ${i + 1}`, servicios: [sv(k, '08/12/2026')] }; });
  return {
    finanzas_movimientos: movs, clientes,
    inventario: {
      h119: { plataforma: 'hbomax', planHbo: 'standard', correo: 'cuenta119@prueba.test', capacidad: 5, capacidadPersonalizada: true, clientes: K.map((k, i) => ({ compraId: k, clienteId: `c${i + 1}`, slot: i + 1 })) },
      h120: { plataforma: 'hbomax', planHbo: 'standard', correo: 'cuenta120@prueba.test', capacidad: 5, clientes: [{ compraId: 'z1', clienteId: 'c8', slot: 1 }, { compraId: 'q1', clienteId: 'c9', slot: 2 }, { compraId: 'w3', nombre: 'Perfil sin ficha', slot: 3 }] },
    },
    fin_productos: { LINK: { nombre: 'HBO links', modelo: 'link', plataformaKey: 'hbomax', duracionDias: 0 } },
    fin_lotes: {
      act119: link('2026-10-07', 'h119', 3.5),                       // 3.5 USDT × 28 = L98
      libre: link('2026-10-20', '', 2),                              // activación sin cuenta: no cubre nada
      ...(reactivar ? { react119: link('2026-12-05', 'h119', 3.6) } : {}), // L100.80
    },
  };
}
const R = { movementYmd, movementKind, anuladoOReversa, money };
const res = () => { const r = { body: null, status() { return r; }, json(b) { r.body = b; return r; } }; return r; };
const deps = (db, hoy) => ({ hoyYmdHN: () => hoy, R, leerMovimientos: async (desde) => [...db._data.entries()].filter(([k]) => k.startsWith('finanzas_movimientos/')).map(([k, v]) => ({ id: k.split('/')[1], ...v.data })).filter((m) => movementYmd(m) >= desde), auditar: () => {} });
const call = async (db, accion, body = {}, hoy = '2026-11-19') => { const r = res(); try { await handlePanel(db, accion, body, { usuario: 'sublicuentas', role: 'sublicuentas', admin: true }, {}, r, deps(db, hoy)); } catch (e) { return { ok: false, error: e.message }; } return r.body; };
const SEP = { desde: '2026-09-01', hasta: '2026-09-30' }, OCT = { desde: '2026-10-01', hasta: '2026-10-31' }, NOV = { desde: '2026-11-01', hasta: '2026-11-30' }, DIC = { desde: '2026-12-01', hasta: '2026-12-31' };
const fila = (g, p = 'hbomax_standard') => g.porPlataforma.find((x) => x.plataforma === p);

test('1 · Octubre (mes de la activación): costo L98 una sola vez; 5 altas de L80 → resultado L302', async () => {
  const g = await call(fakeFirestore(semilla()), 'finp_ganancias', OCT);
  const p = fila(g);
  assert.equal(p.costoHnl, 98); assert.equal(p.altas, 5); assert.equal(p.cobradoHnl, 400);
  assert.equal(p.resultadoHnl, 302); assert.equal(p.coberturaCostos, 100);
});

test('2 · Noviembre (sin nueva activación): la cuenta sigue CUBIERTA con L0; todo lo cobrado es ganancia; cobertura 100 % de esa cuenta', async () => {
  const g = await call(fakeFirestore(semilla()), 'finp_ganancias', NOV);
  const p = fila(g);
  assert.equal(p.costoHnl, 0, 'no se vuelve a cobrar la activación'); assert.equal(p.cobradoCicloHnl, 400); assert.equal(p.cuentasCiclo, 1);
  assert.equal(p.renovaciones, 6); assert.equal(p.cobradoHnl, 475);
  assert.equal(p.cobradoCubiertoHnl, 400, 'la cuenta 120 (sin activación vinculada) NO queda cubierta');
  assert.equal(p.resultadoHnl, 400); assert.equal(p.estado, 'cobertura_parcial');
  assert.equal(g.resumen.cobradoCicloVigenteHnl, 400);
});

test('3 · Octubre + noviembre: el costo suma exactamente L98 (nunca se duplica ni se inventan meses)', async () => {
  const db = fakeFirestore(semilla());
  const o = fila(await call(db, 'finp_ganancias', OCT)), nv = fila(await call(db, 'finp_ganancias', NOV));
  assert.equal(o.costoHnl + nv.costoHnl, 98);
});

test('4 · Resultado del CICLO por cuenta: activada 07/10 por L98 (3.5 USDT), cobrado L800 hasta hoy → L702, recuperada', async () => {
  const x = await call(fakeFirestore(semilla()), 'finp_ganancias_plataforma', { plataforma: 'hbomax_standard', ...NOV });
  assert.equal(x.ok, true, JSON.stringify(x).slice(0, 300));
  const c = x.cuentas.find((k) => k.cuentaId === 'h119');
  assert.equal(c.estadoCosto, 'ciclo_vigente'); assert.equal(c.costoHnl, 0); assert.equal(c.resultadoHnl, 400);
  assert.deepEqual([c.cicloActual.fechaActivacion, c.cicloActual.costoHnl, c.cicloActual.montoMoneda, c.cicloActual.cobradoHnl, c.cicloActual.resultadoHnl, c.cicloActual.recuperado, c.cicloActual.clientes],
    ['2026-10-07', 98, 3.5, 800, 702, true, 5]);
  assert.equal(x.cuentas.find((k) => k.cuentaId === 'h120').estadoCosto, 'sin_compra', 'sin activación vinculada no se inventa costo');
  const det = (await call(fakeFirestore(semilla()), 'finp_ganancias_cuenta', { cuentaId: 'h119', ...NOV })).cuenta;
  assert.equal(det.cicloActual.resultadoHnl, 702); assert.equal(det.resultadoPeriodoHnl, 400); assert.equal(det.estado, 'ok');
});

test('5 · Reactivación el 05/12: diciembre lleva el nuevo costo; el ciclo de octubre queda CERRADO; noviembre no cambia', async () => {
  const db = fakeFirestore(semilla({ reactivar: true }));
  const d = fila(await call(db, 'finp_ganancias', DIC, '2026-12-20'));
  assert.equal(d.costoHnl, 100.8); assert.equal(d.cobradoHnl, 160);
  assert.equal(fila(await call(db, 'finp_ganancias', NOV, '2026-12-20')).costoHnl, 0);
  const x = await call(db, 'finp_ganancias_plataforma', { plataforma: 'hbomax_standard', ...DIC }, '2026-12-20');
  assert.equal(x.compras.filas.find((f) => f.loteId === 'act119').relacion, 'ciclo_cerrado');
  assert.equal(x.compras.filas.find((f) => f.loteId === 'react119').relacion, 'imputado');
  const c = x.cuentas.find((k) => k.cuentaId === 'h119').cicloActual;
  assert.deepEqual([c.fechaActivacion, c.costoHnl, c.cobradoHnl, c.resultadoHnl, c.recuperado], ['2026-12-05', 100.8, 80, -20.8, false], 'el ciclo nuevo cuenta solo lo cobrado desde el 05/12');
});

test('6 · Antes de la primera activación (septiembre) no hay cobertura: «costo pendiente», nunca L0 inventado', async () => {
  // R200k · el control exacto empieza el 01/10/2026: pedir septiembre ya no lee meses pasados (se calcula desde octubre)
  const g = await call(fakeFirestore(semilla()), 'finp_ganancias', SEP, '2026-11-19');
  assert.equal(g.ok, true); assert.ok(!(g.meses || []).some((m) => m.mes < '2026-10'), 'nada antes de octubre');
});

test('7 · Activación SIN cuenta: no cubre a ninguna cuenta en meses siguientes (no se reparte por suposición)', async () => {
  const x = await call(fakeFirestore(semilla()), 'finp_ganancias_plataforma', { plataforma: 'hbomax_standard', ...NOV });
  assert.equal(x.compras.filas.find((f) => f.loteId === 'libre').vinculo, 'sin_vinculo');
  assert.notEqual(x.compras.filas.find((f) => f.loteId === 'libre').relacion, 'ciclo_vigente');
});

test('8 · Cartera de Control Maestro separada de «pagaron en el período»: 2 cuentas, 8 perfiles, 8 clientes; pagaron 6', async () => {
  const p = fila(await call(fakeFirestore(semilla()), 'finp_ganancias', NOV));
  assert.deepEqual([p.carteraCuentas, p.carteraPerfiles, p.carteraClientes, p.clientes], [2, 8, 8, 6]);
  const o = fila(await call(fakeFirestore(semilla()), 'finp_ganancias', OCT));
  assert.equal(o.carteraCuentas, 2, 'la cartera es la de hoy; octubre muestra además quién pagó en octubre'); assert.equal(o.clientes, 5);
});

test('9 · Consultar no escribe nada (Control Maestro, ventas y compras intactos) y la web muestra L0 + ciclo', async () => {
  const db = fakeFirestore(semilla());
  const antes = new Map([...db._data.entries()].map(([k, v]) => [k, JSON.stringify(v.data)]));
  await call(db, 'finp_ganancias', NOV); await call(db, 'finp_ganancias_plataforma', { plataforma: 'hbomax_standard', ...NOV }); await call(db, 'finp_ganancias_cuenta', { cuentaId: 'h119', ...NOV });
  assert.equal(db._data.size, antes.size); for (const [k, v] of antes) assert.equal(JSON.stringify(db._data.get(k).data), v, k);
  const web = fs.readFileSync(new URL('../finanzas-web.js', import.meta.url), 'utf8');
  assert.match(web, /Ciclo de activación actual/); assert.match(web, /Control Maestro/); assert.match(web, /ciclo_vigente: 'ok'/);
});
