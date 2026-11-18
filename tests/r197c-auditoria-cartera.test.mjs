// R197c · PDF «Autorización limitada: auditoría real de cartera, cobros y ganancias» (18/11/2026). Datos FICTICIOS (no es verificación de producción).
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
      ...op('2026-11-13', { compraId: 'zz9', clienteId: 'q', plataforma: 'hbomax', total: 50 }),                                                 // cobro cuyo servicio ya no está en ninguna ficha
      socio_compra_P1_cobro: { ...fTS('2026-11-14'), tipo: 'ingreso', subtipo: 'compra_socio', monto: 100, banco: 'Banco Atlántida', pedidoId: 'P1', socioNombre: 'Socio Uno', fichasVinculadas: [{ productoIdx: 0, clienteId: 's', compraId: 's1' }], fichaPendiente: false },
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
      r: { nombre: 'Titular R', telefono: '50499990000', servicios: [sv('r1', 'hbomax', 90, '07/12/2026', { planHbo: 'standard', vendedor: 'Vendedora X', pin: '4321', clave: 'secreta', ultimaRenovacion: { fechaAnterior: '07/11/2026', fechaNueva: '07/12/2026', por: 'vendedorax', at: '2026-11-07T15:00:00.000Z', origen: 'apk' } })] },
      j: { nombre: 'Titular J', servicios: [sv('j1', 'hbomax', 90, '15/12/2026', { planHbo: 'standard', ultimaRenovacion: { fechaAnterior: '15/11/2026', fechaNueva: '15/12/2026', por: 'sublicuentas', at: '2026-11-15T15:00:00.000Z', origen: 'web' }, ultimoAjusteAdministrativo: { motivo: 'Cortesía por caída', fechaAnterior: '15/11/2026', fechaNueva: '15/12/2026', por: 'sublicuentas', at: '2026-11-15T15:00:00.000Z', origen: 'web' } })] },
      s: { nombre: '=Socio Cliente', servicios: [sv('s1', 'hbomax', 100, '20/12/2026', { planHbo: 'standard' })] },
      x: { nombre: 'Titular Sin ID', servicios: [{ plataforma: 'hbomax', precio: 80, fechaRenovacion: '22/12/2026', vendedor: 'Vendedor A' }] },
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
const aud = (db, b = {}) => call(db, 'finp_auditoria_cartera', { ...NOV, porPagina: 500, ...b });
const por = (r, cid) => r.filas.find((f) => f.compraId === cid);

test('Clasificación sin inferir: alta, renovación cobrada, socios, ajuste, renovada sin cobro, sin movimiento, sin ID y cobro sin ficha', async () => {
  const db = fakeFirestore(semilla());
  const r = await aud(db);
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const clase = (cid) => por(r, cid).clase;
  assert.equal(clase('h1'), 'alta_cobrada');
  assert.equal(clase('h2'), 'renovacion_cobrada');
  assert.equal(clase('s1'), 'cobro_socios', 'pago del Panel de Socios enlazado por la ficha que amarró');
  assert.equal(clase('j1'), 'ajuste_sin_pago', 'ajuste de fecha: nunca cobro');
  assert.equal(clase('r1'), 'renovacion_sin_cobro', 'fecha movida por un vendedor sin cobro → por conciliar');
  assert.equal(por(r, 'r1').estadoConciliacion, 'por_conciliar');
  assert.deepEqual([por(r, 'r1').fechaAnterior, por(r, 'r1').fechaNueva, por(r, 'r1').renovadoPor, por(r, 'r1').origenRenovacion, por(r, 'r1').cobradoHnl], ['2026-11-07', '2026-12-07', 'vendedorax', 'apk', 0]);
  assert.equal(clase('h3'), 'sin_movimiento'); assert.equal(por(r, 'h3').ultimoCobro.fecha, '2026-10-06');
  const sinId = r.filas.find((f) => f.titular === 'Titular Sin ID');
  assert.equal(sinId.clase, 'datos_insuficientes'); assert.equal(sinId.compraId, '', 'no se inventa un ID');
  assert.equal(clase('zz9'), 'cobro_sin_servicio');
  assert.equal(por(r, 's1').cobradoHnl, 100); assert.equal(por(r, 'j1').cobradoHnl, 0);
});

test('Conteos: vigentes = con cobro + solo vigentes; las clases suman las filas (un servicio, una clase); cuadre del libro en L0', async () => {
  const db = fakeFirestore(semilla());
  const r = await aud(db, { plataforma: 'hbomax' });
  const rs = r.resumen;
  assert.equal(Object.values(rs.porClase).reduce((a, b) => a + b, 0), r.total);
  assert.equal(rs.vigentesConCobro + rs.vigentesSoloVigentes, rs.serviciosVigentes);
  assert.equal(rs.serviciosVigentes, 10, '10 HBO vigentes: h1..h6, r1, j1, s1 y el servicio sin ID');
  assert.equal(rs.vigentesConCobro, 6, 'h1, h2, h4, h5, h6 (parcial) y s1 por socios');
  const h = r.porPlataforma.reduce((a, p) => a + p.renovacion_sin_cobro, 0); assert.equal(h, 1);
  const todo = await aud(db); assert.equal(todo.resumen.cuadre.diferenciaHnl, 0);
});

test('Solo lectura: no cambia CRM, Control Maestro ni el libro; solo deja el registro del acceso', async () => {
  const db = fakeFirestore(semilla());
  const antes = new Map([...db._data.entries()].map(([k, v]) => [k, JSON.stringify(v.data)]));
  await aud(db); await aud(db, { formato: 'csv' });
  const nuevos = [...db._data.keys()].filter((k) => !antes.has(k));
  assert.equal(nuevos.length, 2); assert.ok(nuevos.every((k) => k.startsWith('auditoria_eventos/')));
  assert.equal(db._data.get(nuevos[0]).data.tipo, 'finanzas_auditoria_consulta');
  for (const [k, v] of antes) assert.equal(JSON.stringify(db._data.get(k).data), v, `cambió ${k}`);
});

test('Privacidad: sin teléfonos, PIN ni claves; correos enmascarados; CSV con IDs abreviados y sin inyección de fórmulas', async () => {
  const db = fakeFirestore(semilla());
  const j = JSON.stringify(await aud(db));
  for (const x of ['50499990000', '4321', 'secreta', 'hbos@prueba.test']) assert.ok(!j.includes(x), `se filtró ${x}`);
  assert.ok(j.includes('hb***@prueba.test'));
  const c = await aud(db, { formato: 'csv' });
  assert.ok(!c.csv.includes('4321') && !c.csv.includes('50499990000') && !c.csv.includes('hbos@prueba.test'));
  assert.ok(c.csv.includes("'=Socio Cliente"), 'fórmula neutralizada');
  assert.ok(!/oper_op_u_0001_venta/.test(c.csv), 'IDs largos abreviados en la descarga');
});

test('Filtros y paginación', async () => {
  const db = fakeFirestore(semilla());
  const a = await aud(db, { clase: 'renovacion_sin_cobro' }); assert.deepEqual(a.filas.map((f) => f.compraId), ['r1']);
  const v = await aud(db, { vendedor: 'Vendedora X' }); assert.deepEqual(v.filas.map((f) => f.compraId), ['r1']);
  const p = await call(db, 'finp_auditoria_cartera', { ...NOV, porPagina: 20, pagina: 1 }); assert.ok(p.filas.length <= 20 && p.total >= p.filas.length);
});

test('Permiso aparte: la API exige «finanzas-auditoria» (solo Sublicuentas por defecto) además de Finanzas', () => {
  const src = fs.readFileSync(new URL('../api/finanzas.js', import.meta.url), 'utf8');
  assert.match(src, /accion === "finp_auditoria_cartera" && !\(await PERMISOS\.decidir\(db, authUser, "finanzas-auditoria", identity\.role === "sublicuentas"\)\)/);
  const web = fs.readFileSync(new URL('../finanzas-web.js', import.meta.url), 'utf8');
  assert.match(web, /data-fz="ganaud"/); assert.match(web, /CSV enmascarado/);
});
