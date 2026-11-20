// R198h · PDF «HBO: compras registradas pendientes de vinculación» (19/11/2026). Pruebas A–H con datos FICTICIOS.
// La compra original nunca cambia (monto, fecha, tasa, referencia, cuenta). La conciliación vive aparte (fin_costo_ciclos).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
import { handlePanel } from '../api/_finanzas-panel.js';
import { movementYmd, movementKind, anuladoOReversa, money } from '../api/_finanzas-libro.js';
import { resumenInventario } from '../api/_finanzas-empresa.js';

const fTS = (f) => { const [y, m, d] = f.split('-'); return { fecha: `${d}/${m}/${y}`, fechaPago: f, mesKey: `${y}-${m}` }; };
let n = 0;
function op(f, { subtipo = 'renovacion', compraId, clienteId, total }) {
  const id = `oper_op_h_${String(++n).padStart(4, '0')}`, r = { clienteId, compraId, plataforma: 'hbomax', vendedor: 'Vendedor A', registradoPor: 'sublicuentas', origenCanal: 'web' };
  return { [`${id}_venta`]: { ...fTS(f), tipo: 'venta', subtipo, monto: total, montoRecibido: total, saldoPendiente: 0, estadoPago: 'pagado', ...r }, [`${id}_cobro`]: { ...fTS(f), tipo: 'ingreso', subtipo: subtipo === 'compra_nueva' ? 'cobro_compra' : 'cobro_renovacion', monto: total, bancoId: 'bac', banco: 'BAC Credomatic', ...r } };
}
const sv = (compraId, precio, venc) => ({ compraId, plataforma: 'hbomax', planHbo: 'standard', precio, fechaRenovacion: venc, vendedor: 'Vendedor A' });
const lote = (fecha, extra) => ({ fecha, estado: 'activo', moneda: 'USDT', tasa: 28, pago: 'binance', binanceHistorico: true, cuentaPagoNombre: 'Binance · pago histórico', ...extra });
function semilla() {
  n = 0;
  return {
    finanzas_movimientos: {
      ...op('2026-10-10', { subtipo: 'compra_nueva', compraId: 'k1', clienteId: 'c1', total: 90 }), // F · alta en octubre
      ...op('2026-11-10', { compraId: 'k1', clienteId: 'c1', total: 90 }),                          // F · renovación en noviembre
      ...op('2026-11-05', { compraId: 'k2', clienteId: 'c2', total: 80 }),
      ...op('2026-11-06', { compraId: 'k3', clienteId: 'c3', total: 80 }),
      ...op('2026-11-07', { compraId: 'k4', clienteId: 'c4', total: 120 }),
    },
    clientes: { c1: { nombre: 'Cliente Uno', servicios: [sv('k1', 90, '10/12/2026')] }, c2: { nombre: 'Cliente Dos', servicios: [sv('k2', 80, '05/12/2026')] }, c3: { nombre: 'Cliente Tres', servicios: [sv('k3', 80, '06/12/2026')] }, c4: { nombre: 'Cliente Cuatro', servicios: [{ ...sv('k4', 120, '07/12/2026'), planHbo: 'platinum' }] } },
    inventario: {
      s1: { plataforma: 'hbomax', planHbo: 'standard', correo: 'uno@prueba.test', capacidad: 4, capacidadPersonalizada: true, clientes: [{ compraId: 'k1', clienteId: 'c1', slot: 1 }, { compraId: 'x2', slot: 2 }, { compraId: 'x3', slot: 3 }, { compraId: 'x4', slot: 4 }] }, // G · Standard 4/4
      s2: { plataforma: 'hbomax', planHbo: 'standard', correo: 'dos@prueba.test', capacidad: 3, clientes: [{ compraId: 'k2', clienteId: 'c2', slot: 1 }] },
      s3: { plataforma: 'hbomax', planHbo: 'standard', correo: 'tres@prueba.test', capacidad: 3, clientes: [{ compraId: 'k3', clienteId: 'c3', slot: 1 }] },
      p1: { plataforma: 'hbomax', planHbo: 'platinum', correo: 'plat@prueba.test', capacidad: 5, clientes: [{ compraId: 'k4', clienteId: 'c4', slot: 1 }, { compraId: 'y2', slot: 2 }, { compraId: 'y3', slot: 3 }] }, // G · Platinum 3/5
    },
    fin_productos: { PLAT: { nombre: 'HBO Platinum', modelo: 'cuenta_madre', plataformaKey: 'hbomax', duracionDias: 365, capacidad: 5 }, LINK: { nombre: 'HBO links', modelo: 'link', plataformaKey: 'hbomax', duracionDias: 0 } },
    fin_lotes: {
      // E + B · activación registrada con el botón: producto «HBO Platinum» en cuenta Standard, «60 perfil-mes», sin duración real
      act119: lote('2026-10-07', { productoId: 'PLAT', producto: 'HBO Platinum', modelo: 'cuenta_madre', unidad: 'perfil-mes', cantidad: 60, disponible: 60, duracionDias: 0, vigenciaHasta: '', costoTotalMoneda: 3.5, costoTotalHnl: 98, cuentaInventarioId: 's1' }),
      // A · activación de octubre con cobertura DOCUMENTADA (conciliación) que sigue en noviembre
      actDos: lote('2026-10-15', { productoId: 'LINK', producto: 'HBO links', modelo: 'link', unidad: 'link', cantidad: 1, duracionDias: 0, costoTotalMoneda: 2, costoTotalHnl: 56, cuentaInventarioId: 's2', fechaActivacion: '2026-10-15' }),
      // activación del mes (se reconoce en su fecha)
      actTres: lote('2026-11-06', { productoId: 'LINK', producto: 'HBO links', modelo: 'link', unidad: 'link', cantidad: 1, duracionDias: 0, costoTotalMoneda: 1.45, costoTotalHnl: 40.6, cuentaInventarioId: 's3' }),
      // C · «HBO links» sin cuenta: pendiente de vínculo (una sin evidencia, otra con el correo en la referencia)
      libre1: lote('2026-10-27', { productoId: 'LINK', producto: 'HBO links', modelo: 'link', unidad: 'link', cantidad: 1, duracionDias: 0, costoTotalMoneda: 1.45, costoTotalHnl: 40.6, cuentaInventarioId: '' }),
      libre2: lote('2026-10-25', { productoId: 'LINK', producto: 'HBO links', modelo: 'link', unidad: 'link', cantidad: 1, duracionDias: 0, costoTotalMoneda: 2, costoTotalHnl: 56, cuentaInventarioId: '', referencia: 'Activación tres@prueba.test' }),
      // D · tarjeta: cargo real del banco en HNL, mensual
      tarjeta: { fecha: '2026-11-17', estado: 'activo', productoId: 'PLAT', producto: 'HBO Platinum', modelo: 'cuenta_madre', unidad: 'perfil-mes', cantidad: 5, duracionDias: 30, vigenciaHasta: '2026-12-17', moneda: 'HNL', tasa: 1, costoTotalMoneda: 74, costoTotalHnl: 74, pago: 'banco', cuentaPagoNombre: 'BAC Credomatic', cuentaInventarioId: 'p1' },
    },
    fin_costo_ciclos: { actDos: { loteId: 'actDos', cuentaInventarioId: '', coberturaDesde: '2026-10-15', coberturaHasta: '2026-11-14', evidencia: 'Correo del proveedor: activación de 31 días', estado: 'confirmado' } },
  };
}
const R = { movementYmd, movementKind, anuladoOReversa, money };
const res = () => { const r = { body: null, status() { return r; }, json(b) { r.body = b; return r; } }; return r; };
const deps = (db) => ({ hoyYmdHN: () => '2026-11-19', R, leerMovimientos: async (desde) => [...db._data.entries()].filter(([k]) => k.startsWith('finanzas_movimientos/')).map(([k, v]) => ({ id: k.split('/')[1], ...v.data })).filter((m) => movementYmd(m) >= desde), auditar: () => {} });
const call = async (db, accion, body = {}, role = 'sublicuentas') => { const r = res(); try { await handlePanel(db, accion, body, { usuario: role, role, admin: role === 'sublicuentas' }, {}, r, deps(db)); } catch (e) { return { ok: false, error: e.message }; } return r.body; };
const NOV = { desde: '2026-11-01', hasta: '2026-11-30' }, OCT = { desde: '2026-10-01', hasta: '2026-10-31' };
const plat = (db, p, rango = NOV) => call(db, 'finp_ganancias_plataforma', { plataforma: p, ...rango });
const cta = (x, id) => x.cuentas.find((c) => c.cuentaId === id);
const compra = (x, id) => x.compras.filas.find((c) => c.loteId === id);

test('Prueba imprescindible · 3 cuentas con compra histórica: por ID se separa atribuida, cobertura desconocida y sin compra', async () => {
  const x = await plat(fakeFirestore(semilla()), 'hbomax_standard');
  assert.equal(x.ok, true, JSON.stringify(x).slice(0, 300));
  assert.equal(cta(x, 's1').estadoCosto, 'cobertura_desconocida');
  assert.match(cta(x, 's1').motivoCosto, /Última compra 2026-10-07: L98 \(3\.5 USDT a 28\)\. Su duración no está documentada/);
  assert.equal(cta(x, 's2').estadoCosto, 'atribuido'); assert.equal(cta(x, 's3').estadoCosto, 'atribuido');
  assert.deepEqual(Object.keys(x.estadosCosto), ['atribuido', 'cobertura_desconocida', 'fuera_periodo', 'sin_compra']);
});

test('A · compra de octubre con cobertura DOCUMENTADA que sigue en noviembre: costo atribuible por días, sin duplicar el gasto', async () => {
  const db = fakeFirestore(semilla());
  const nov = await plat(db, 'hbomax_standard'), oct = await plat(db, 'hbomax_standard', OCT);
  const n2 = compra(nov, 'actDos'), o2 = compra(oct, 'actDos');
  assert.equal(n2.relacion, 'imputado'); assert.equal(n2.imputadoHnl, 25.29, '14 de 31 días × L56');
  assert.equal(o2.imputadoHnl, 30.71, '17 de 31 días en octubre');
  assert.equal(Math.round((n2.imputadoHnl + o2.imputadoHnl) * 100) / 100, 56, 'octubre + noviembre = el costo de la compra, ni un lempira más');
  assert.match(cta(nov, 's2').motivoCosto, /14 de 31 días de la cobertura documentada \(2026-10-15 → 2026-11-14\)/);
});

test('B · compra anterior sin cobertura documentada: costo histórico visible, NO imputado a noviembre, margen no definitivo', async () => {
  const x = await plat(fakeFirestore(semilla()), 'hbomax_standard');
  const c = compra(x, 'act119');
  assert.equal(c.relacion, 'cobertura_desconocida'); assert.equal(c.imputadoHnl, 0); assert.equal(c.costoHnl, 98);
  assert.equal(cta(x, 's1').historicoNoImputadoHnl, 98);
  assert.equal(cta(x, 's1').costoHnl, 0); assert.equal(cta(x, 's1').resultadoHnl, null, 'sin costo atribuido no hay resultado');
  assert.equal(x.plataformaResumen.margenDefinitivo, false);
});

test('C · «HBO links» sin cuenta: queda pendiente de vínculo; no se reparte entre cuentas; propuesta solo con evidencia', async () => {
  const x = await plat(fakeFirestore(semilla()), 'hbomax_standard');
  const l1 = compra(x, 'libre1'), l2 = compra(x, 'libre2');
  assert.equal(l1.vinculo, 'sin_vinculo'); assert.equal(l1.propuesta, null, 'sin evidencia no se propone nada');
  assert.equal(l2.propuesta.cuentaId, 's3'); assert.match(l2.propuesta.evidencia, /correo de la cuenta aparece/);
  assert.ok(x.cuentas.every((c) => !c.motivoCosto.includes('libre')), 'no aparece como costo de ninguna cuenta');
  assert.equal(x.compras.resumen.sinVinculo, 2);
});

test('D · HBO con tarjeta: cargo real en HNL con su fecha y su período (30 días del 17/11)', async () => {
  const x = await plat(fakeFirestore(semilla()), 'hbomax_platinum');
  const t = compra(x, 'tarjeta');
  assert.equal(t.moneda, 'HNL'); assert.equal(t.costoHnl, 74); assert.equal(t.imputadoHnl, 34.53, '14 de 30 días en noviembre');
  assert.equal(cta(x, 'p1').estadoCosto, 'atribuido');
});

test('E · «60 perfil-mes»: se señala su origen; no suma existencia ni costo; el botón «Registrar activación» ya usa el producto de activación', async () => {
  const x = await plat(fakeFirestore(semilla()), 'hbomax_standard');
  const c = compra(x, 'act119');
  assert.equal(c.cantidadNoAcreditada, true); assert.equal(c.productoPlanDistinto, true, 'registrada como Platinum en una cuenta Standard');
  assert.equal(x.compras.resumen.cantidadNoAcreditada, 1);
  const s = semilla(); const lotes = Object.entries(s.fin_lotes).map(([id, v]) => ({ id, ...v })); const prods = Object.entries(s.fin_productos).map(([id, v]) => ({ id, ...v }));
  const inv = resumenInventario(prods, lotes, '2026-11-19').find((r) => r.productoId === 'PLAT');
  assert.equal(inv.disponible, 0, 'los 60 «perfil-mes» no son existencia'); assert.equal(inv.lotesNoAcreditados, 1);
  const web = fs.readFileSync(new URL('../finanzas-web.js', import.meta.url), 'utf8');
  assert.match(web, /var pAct = prodsHbo\.find\(function \(p\) \{ return p\.modelo === 'link'; \}\)/);
});

test('F · cliente con alta en octubre y renovación en noviembre: cada cobro una vez, en su mes', async () => {
  const db = fakeFirestore(semilla());
  const oct = await call(db, 'finp_ganancias', OCT), nov = await call(db, 'finp_ganancias', NOV);
  assert.deepEqual([oct.resumen.altas, oct.resumen.renovaciones, oct.resumen.cobradoHnl], [1, 0, 90]);
  assert.deepEqual([nov.resumen.altas, nov.resumen.renovaciones], [0, 4]);
  const det = (await call(db, 'finp_ganancias_cuenta', { cuentaId: 's1', ...NOV })).cuenta;
  assert.equal(det.perfiles.find((p) => p.compraId === 'k1').recibos.length, 1, 'solo el cobro de noviembre en noviembre');
  assert.equal(det.estadoCosto, 'cobertura_desconocida');
});

test('G + H · consultar y conciliar NO cambia Control Maestro, planes, ventas ni compras (monto, fecha, tasa); solo fin_costo_ciclos', async () => {
  const db = fakeFirestore(semilla());
  const antes = new Map([...db._data.entries()].map(([k, v]) => [k, JSON.stringify(v.data)]));
  await plat(db, 'hbomax_standard'); await call(db, 'finp_ganancias', NOV); await call(db, 'finp_ganancias_cuenta', { cuentaId: 's1', ...NOV });
  for (const [k, v] of antes) assert.equal(JSON.stringify(db._data.get(k).data), v, `la consulta cambió ${k}`);
  const r = await call(db, 'finp_costo_conciliar', { loteId: 'libre2', cuentaInventarioId: 's3', evidencia: 'La referencia de la compra trae el correo tres@prueba.test' });
  assert.equal(r.ok, true, JSON.stringify(r));
  for (const [k, v] of antes) if (!k.startsWith('fin_costo_ciclos/')) assert.equal(JSON.stringify(db._data.get(k).data), v, `conciliar cambió ${k}`);
  assert.equal(db._data.get('fin_lotes/libre2').data.cuentaInventarioId, '', 'la compra original sigue sin cuenta: el vínculo vive aparte');
  const x = await plat(db, 'hbomax_standard');
  assert.equal(compra(x, 'libre2').vinculo, 'conciliado'); assert.equal(compra(x, 'libre2').correo, 'tres@prueba.test');
  assert.equal(x.compras.filas.length, 5, 'ninguna compra nueva: las mismas 5 compras HBO Standard');
  const inv = db._data.get('inventario/s1').data; assert.equal(inv.capacidad, 4); assert.equal(inv.clientes.length, 4, 'Standard personalizado 4/4 intacto');
});

test('Conciliar: solo Sublicuentas, con evidencia, sin cambiar el vínculo original ni inventar coberturas; se puede quitar con historial', async () => {
  const db = fakeFirestore(semilla());
  assert.match((await call(db, 'finp_costo_conciliar', { loteId: 'libre1', cuentaInventarioId: 's2', evidencia: 'prueba' }, 'relojes')).error, /Solo Sublicuentas/);
  assert.match((await call(db, 'finp_costo_conciliar', { loteId: 'libre1', cuentaInventarioId: 's2', evidencia: '' })).error, /evidencia/);
  assert.match((await call(db, 'finp_costo_conciliar', { loteId: 'act119', cuentaInventarioId: 's2', evidencia: 'otra cuenta' })).error, /No se cambia el vínculo original/);
  assert.match((await call(db, 'finp_costo_conciliar', { loteId: 'act119', coberturaDesde: '2026-10-01', coberturaHasta: '2026-10-31', evidencia: 'antes de la compra' })).error, /no puede empezar antes/);
  assert.match((await call(db, 'finp_costo_conciliar', { loteId: 'act119', coberturaDesde: '2026-10-07', evidencia: 'falta hasta' })).error, /las dos fechas/);
  assert.equal((await call(db, 'finp_costo_conciliar_quitar', { loteId: 'actDos', motivo: 'Revisión' })).ok, true);
  const c = db._data.get('fin_costo_ciclos/actDos').data; assert.equal(c.estado, 'anulado'); assert.equal(c.historial.at(-1).accion, 'quitar');
  const x = await plat(db, 'hbomax_standard'); assert.equal(compra(x, 'actDos').relacion, 'cobertura_desconocida', 'sin la cobertura documentada vuelve a «desconocida»');
});
