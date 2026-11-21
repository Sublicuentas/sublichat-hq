// R197b · PDF «Conciliación de ventas, renovaciones y ganancias» (17/11/2026). Historias A–J con datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
import { handlePanel } from '../api/_finanzas-panel.js';
import { movementYmd, movementKind, anuladoOReversa, money } from '../api/_finanzas-libro.js';

const fTS = (f) => { const [y, m, d] = f.split('-'); return { fecha: `${d}/${m}/${y}`, fechaPago: f, mesKey: `${y}-${m}` }; };
let n = 0;
function op(f, { subtipo = 'renovacion', compraId = '', compraIds, clienteId, plataforma, total, recibido = total, asignaciones, extra = {}, banco = 'BAC Credomatic', canal = 'web' }) {
  const id = `oper_op_u_${String(++n).padStart(4, '0')}`;
  const r = { clienteId, compraId, plataforma, ...(compraIds ? { compraIds } : {}), ...(asignaciones ? { asignaciones } : {}), vendedor: 'Vendedor A', registradoPor: 'sublicuentas', origenCanal: canal, ...extra };
  const o = { [`${id}_venta`]: { ...fTS(f), tipo: 'venta', subtipo, monto: total, montoRecibido: recibido, saldoPendiente: total - recibido, estadoPago: recibido >= total ? 'pagado' : recibido > 0 ? 'parcial' : 'pendiente', ...r } };
  if (recibido > 0) o[`${id}_cobro`] = { ...fTS(f), tipo: 'ingreso', subtipo: subtipo === 'compra_nueva' ? 'cobro_compra' : 'cobro_renovacion', monto: recibido, bancoId: 'bac', banco, ...r };
  return o;
}
const sv = (compraId, plataforma, precio, venc, extra = {}) => ({ compraId, plataforma, precio, fechaRenovacion: venc, vendedor: 'Vendedor A', ...extra });
function semilla() {
  n = 0;
  return {
    finanzas_movimientos: {
      ...op('2026-11-04', { subtipo: 'compra_nueva', compraId: 'h1', clienteId: 'a', plataforma: 'hbomax', total: 90, canal: 'apk' }),          // A · alta HBO cobrada
      ...op('2026-11-05', { compraId: 'h2', clienteId: 'b', plataforma: 'hbomax', total: 90, canal: 'telegram' }),                             // B · renovación HBO cobrada
      ...op('2026-10-05', { compraId: 'h2', clienteId: 'b', plataforma: 'hbomax', total: 90 }),                                                  //     su renovación de octubre
      ...op('2026-10-06', { compraId: 'h3', clienteId: 'c', plataforma: 'hbomax', total: 80 }),                                                  // C · pagó en octubre, no en noviembre
      ...op('2026-11-08', { compraIds: ['n1', 'd1'], clienteId: 'd', plataforma: 'netflix + disney', total: 250 }),                              // D · combo 1 transferencia
      ...op('2026-11-09', { compraId: 'h4', clienteId: 'e', plataforma: 'hbomax', total: 70, extra: { montoEsperado: 90, descuento: 20, ajusteCobro: { tipo: 'descuento', motivo: 'Promo' } } }), // E · descuento
      ...op('2026-11-10', { compraId: 'h5', clienteId: 'g', plataforma: 'hbomax', total: 90 }),                                                  // G · plan histórico sin definir
      ...op('2026-11-11', { compraId: 'v1', clienteId: 'v', plataforma: 'vipnetflix', total: 130 }),                                             // VIP sin cuenta madre local
      ...op('2026-11-12', { compraId: 'h6', clienteId: 'p', plataforma: 'hbomax', total: 100, recibido: 40 }),                                   // pago parcial
    },
    clientes: {
      a: { nombre: 'Titular A', servicios: [sv('h1', 'hbomax', 90, '04/12/2026', { planHbo: 'standard', beneficiarioNombre: 'Beneficiario A' })] },
      b: { nombre: 'Titular B', servicios: [sv('h2', 'hbomax', 90, '05/12/2026', { planHbo: 'standard' })] },
      c: { nombre: 'Titular C', servicios: [sv('h3', 'hbomax', 80, '06/12/2026', { planHbo: 'standard' })] },
      d: { nombre: 'Titular D', servicios: [sv('n1', 'netflix', 150, '08/12/2026'), sv('d1', 'disneyp', 100, '08/12/2026')] },
      e: { nombre: 'Titular E', servicios: [sv('h4', 'hbomax', 90, '09/12/2026', { planHbo: 'standard' })] },
      g: { nombre: 'Titular G', servicios: [sv('h5', 'hbomax', 90, '10/12/2026')] },
      v: { nombre: 'Cliente VIP', servicios: [sv('v1', 'vipnetflix', 130, '11/12/2026', { correo: 'extra1@prueba.test' })] },
      p: { nombre: 'Titular P', servicios: [sv('h6', 'hbomax', 100, '12/12/2026', { planHbo: 'standard' })] },
    },
    inventario: {
      'hbo-s': { plataforma: 'hbomax', planHbo: 'standard', correo: 'hbos@prueba.test', capacidad: 4, clientes: ['h1', 'h2', 'h3', 'h4'].map((c, i) => ({ compraId: c, clienteId: 'abce'[i], slot: i + 1, nombre: 'Perfil ' + (i + 1) })) },
      'hbo-x': { plataforma: 'hbomax', correo: 'hbox@prueba.test', capacidad: 5, clientes: [{ compraId: 'h5', clienteId: 'g', slot: 1 }, { compraId: 'h6', clienteId: 'p', slot: 2 }] },
      'nf-1': { plataforma: 'netflix', correo: 'nf@prueba.test', capacidad: 5, clientes: [{ compraId: 'n1', clienteId: 'd', slot: 1 }] },
      'ds-1': { plataforma: 'disneyp', correo: 'ds@prueba.test', capacidad: 4, clientes: [{ compraId: 'd1', clienteId: 'd', slot: 1 }] },
    },
    fin_productos: { HBO: { nombre: 'HBO Standard', modelo: 'cuenta_madre', plataformaKey: 'hbomax', duracionDias: 0 } },
    fin_lotes: { act: { productoId: 'HBO', producto: 'HBO Standard', fecha: '2026-10-02', modelo: 'cuenta_madre', duracionDias: 0, costoTotalHnl: 38.57, costoTotalMoneda: 1.45, moneda: 'USDT', tasa: 26.6, cuentaInventarioId: 'hbo-s' } },
    fin_vip_extras: { 'vipnetflix__extra1@prueba_test': { correo: 'extra1@prueba.test', cmId: '', sinInventario: true, proveedor: 'Trap colombiano', costoMensualUsdt: 2.5, tasa: 26.6, costoMensualHnl: 66.5, estadoSeguimiento: 'activo', creadoAt: '2026-11-01' } },
  };
}
const R = { movementYmd, movementKind, anuladoOReversa, money };
const res = () => { const r = { body: null, status() { return r; }, json(b) { r.body = b; return r; } }; return r; };
const deps = (db) => ({ hoyYmdHN: () => '2026-11-17', R, leerMovimientos: async (desde) => [...db._data.entries()].filter(([k]) => k.startsWith('finanzas_movimientos/')).map(([k, v]) => ({ id: k.split('/')[1], ...v.data })).filter((m) => movementYmd(m) >= desde), auditar: () => {} });
const call = async (db, accion, body = {}) => { const r = res(); await handlePanel(db, accion, body, { usuario: 'sublicuentas', role: 'sublicuentas', admin: true }, {}, r, deps(db)); return r.body; };
const NOV = { desde: '2026-11-01', hasta: '2026-11-30' };

test('A/B/E · alta y renovación se cuentan por separado, una vez; el descuento muestra lo cobrado y el precio de referencia', async () => {
  const db = fakeFirestore(semilla());
  const g = await call(db, 'finp_ganancias', NOV);
  assert.equal(g.ok, true, JSON.stringify(g).slice(0, 200));
  assert.deepEqual([g.resumen.altas, g.resumen.renovaciones, g.resumen.cobradoHnl, g.resumen.pendienteHnl], [1, 7, 760, 60], '1 alta; 7 renovaciones cobradas (el combo son 2 servicios de un solo recibo); L760 = dinero recibido');
  const ex = (await call(db, 'finp_ganancias_excel', NOV)).filas;
  const a = ex.find((f) => f.Referencia && f.Beneficiario === 'Beneficiario A');
  assert.deepEqual([a.Tipo, a['Ingreso cobrado'], a.Fuente, a.Banco], ['Alta nueva', 90, 'apk', 'BAC Credomatic']);
  assert.equal(ex.filter((f) => f['Titular de ficha'] === 'Titular B' && f.Tipo === 'Renovación cobrada').length, 1);
  const e = (await call(db, 'finp_ganancias_cuenta', { cuentaId: 'hbo-s', ...NOV })).cuenta.perfiles.find((p) => p.compraId === 'h4');
  assert.deepEqual([e.precio, e.cobradoHnl, e.descuentoHnl], [90, 70, 20], 'cobrado L70, precio de referencia L90');
});

test('C · cliente vigente sin pago en noviembre: sigue en cartera «sin movimiento», con su último cobro; no suma a cobrado', async () => {
  const db = fakeFirestore(semilla());
  const p = await call(db, 'finp_ganancias_plataforma', { plataforma: 'hbomax', ...NOV });
  const c = p.cartera.filas.find((f) => f.compraId === 'h3');
  assert.deepEqual([c.estado, c.vigente, c.cobradoHnl, c.ultimoCobro.fecha, c.proximaRenovacion], ['sin_movimiento', true, 0, '2026-10-06', '2026-12-06']);
  const r = p.cartera.resumen;
  assert.equal(r.serviciosVigentes, 6); assert.equal(r.vigentesSinMovimiento, 1); assert.equal(r.pendientesOParciales, 1);
  assert.equal(r.clientesConCobro, 5, 'vigentes (6) ≠ con cobro en el mes (5): la diferencia se explica fila por fila');
});

test('D · combo con una transferencia: un recibo repartido por servicio; total = dinero recibido; cuadre de integridad en 0', async () => {
  const db = fakeFirestore(semilla());
  const ex = (await call(db, 'finp_ganancias_excel', NOV)).filas.filter((f) => f['Titular de ficha'] === 'Titular D');
  assert.deepEqual(ex.map((f) => [f.Plataforma, f['Ingreso cobrado'], f.Combo]), [['Netflix Premium', 150, 'Sí'], ['Disney+', 100, 'Sí']]);
  assert.equal(new Set(ex.map((f) => f.Referencia)).size, 1, 'mismo recibo de origen');
  const g = await call(db, 'finp_ganancias', NOV);
  assert.deepEqual([g.resumen.cuadre.cobrosOriginalesHnl, g.resumen.cuadre.asignadoServiciosHnl, g.resumen.cuadre.diferenciaHnl], [760, 760, 0]);
});

test('F · activación HBO histórica (USDT 1.45): costo en su mes, no se repite ni se multiplica por perfiles', async () => {
  const db = fakeFirestore(semilla());
  const oct = await call(db, 'finp_ganancias', { desde: '2026-10-01', hasta: '2026-10-31' });
  const nov = await call(db, 'finp_ganancias', NOV);
  assert.equal(oct.resumen.costoHnl, 38.57); assert.equal(nov.costos.filter((c) => c.loteId === 'act').length, 0, 'no vuelve a cobrarse en noviembre');
  const tri = await call(db, 'finp_ganancias', { desde: '2026-09-01', hasta: '2026-11-30' });
  assert.equal(tri.costos.filter((c) => c.loteId === 'act').reduce((a, c) => a + c.costoHnl, 0), 38.57, 'en 3 meses: una sola vez');
});

test('G · HBO con plan histórico sin definir: no se reclasifica, aparece «plan sin clasificar»', async () => {
  const db = fakeFirestore(semilla());
  const g = await call(db, 'finp_ganancias', NOV);
  assert.ok(g.porPlataforma.find((p) => p.plataforma === 'hbomax'), 'queda como «HBO Max» (sin plan), no Standard/Platinum');
  assert.ok(g.bandejaConteo.plan_sin_clasificar >= 1);
  const p = await call(db, 'finp_ganancias_plataforma', { plataforma: 'hbomax', ...NOV });
  assert.ok(p.cuentas.find((c) => c.cuentaId === 'hbo-x').planSinClasificar);
});

test('H · octubre, noviembre y últimos 3 meses sin dobles conteos', async () => {
  const db = fakeFirestore(semilla());
  const oct = (await call(db, 'finp_ganancias', { desde: '2026-10-01', hasta: '2026-10-31' })).resumen.cobradoHnl;
  const nov = (await call(db, 'finp_ganancias', NOV)).resumen.cobradoHnl;
  const tri = (await call(db, 'finp_ganancias', { desde: '2026-09-01', hasta: '2026-11-30' })).resumen.cobradoHnl;
  assert.deepEqual([oct, nov, tri], [170, 760, 930]);
});

test('I · «Cuentas» abre en todas las plataformas; Netflix VIP muestra sus accesos aunque no haya cuenta madre local', async () => {
  const db = fakeFirestore(semilla());
  const g = await call(db, 'finp_ganancias', NOV);
  for (const p of g.porPlataforma) { const r = await call(db, 'finp_ganancias_plataforma', { plataforma: p.plataforma, ...NOV }); assert.equal(r.ok, true, p.plataforma); assert.ok(r.cuentas.length + r.cartera.filas.length > 0, p.plataforma); }
  const vip = g.porPlataforma.find((p) => p.plataforma === 'vipnetflix');
  assert.deepEqual([vip.cuentas, vip.costoHnl, vip.coberturaCostos], [1, 66.5, 100], 'acceso individual vinculado por correo con su costo');
  const pv = await call(db, 'finp_ganancias_plataforma', { plataforma: 'vipnetflix', ...NOV });
  assert.equal(pv.cuentas[0].acceso, 'acceso_individual');
});

test('Cobertura de costos: sin costo no hay margen definitivo ni «ganancia» inventada', async () => {
  const db = fakeFirestore(semilla());
  const g = await call(db, 'finp_ganancias', NOV);
  const nf = g.porPlataforma.find((p) => p.plataforma === 'netflix');
  assert.deepEqual([nf.estado, nf.resultadoHnl, nf.margen], ['costo_pendiente', null, null]);
  assert.equal(g.resumen.estado, 'cobertura_parcial'); assert.equal(g.resumen.margenDefinitivo, false);
  assert.ok(g.resumen.cobradoSinCostoHnl > 0);
  const oct = await call(db, 'finp_ganancias', { desde: '2026-10-01', hasta: '2026-10-31' });
  const hboOct = oct.porPlataforma.find((p) => p.plataforma === 'hbomax_standard');
  assert.equal(hboOct.coberturaCostos, 100);
  assert.ok(g.definiciones && g.definiciones.esperado.includes('NO es dinero'));
});

test('J · Excel: totales iguales a Finanzas, beneficiario real, cuenta, pago y fuente; solo lectura', async () => {
  const db = fakeFirestore(semilla()); const antes = JSON.stringify([...db._data.entries()]);
  const g = await call(db, 'finp_ganancias', NOV); const ex = (await call(db, 'finp_ganancias_excel', NOV)).filas;
  const tot = ex.reduce((a, f) => a + (Number(f['Ingreso cobrado']) || 0), 0);
  assert.equal(Math.round(tot * 100) / 100, g.resumen.cobradoHnl);
  for (const k of ['Beneficiario', 'Titular de ficha', 'Cuenta madre', 'Fuente', 'Banco', 'Registrado por', 'Referencia']) assert.ok(k in ex[0], k);
  assert.equal(JSON.stringify([...db._data.entries()]), antes);
  const w = fs.readFileSync(new URL('../finanzas-web.js', import.meta.url), 'utf8');
  assert.match(w, /finp_ganancias_plataforma/); assert.match(w, /abrirPlataforma\(t\.dataset\.fzGanplat\)/, '«Cuentas» abre el detalle (antes solo filtraba)'); assert.match(w, /function repCuentas\(\)/, 'también desde Reportes');
  assert.match(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /finanzas-web\.js\?v=202611(1[7-9]|2[0-9])-r(19(7[b-z]|8[a-z])|2\d\d[a-z]?)/);
});
