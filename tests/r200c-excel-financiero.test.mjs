// (semilla copiada de r197) R197 · Motor único de ganancias (todas las plataformas). Datos 100 % ficticios.
// Verifica: ingresos cobrados vs. pendientes vs. esperados, combos sin duplicar, costos según la forma de compra
// (activación HBO, VIP por acceso, Spotify por familia, Prime trimestral, Crunchyroll anual, IPTV por consumo),
// detalle por cuenta con sus clientes y precios, solo lectura (no crea ni cambia nada) y meses ago–nov 2026.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
import { handlePanel } from '../api/_finanzas-panel.js';
import { movementYmd, movementKind, anuladoOReversa, money } from '../api/_finanzas-libro.js';
import { reglaCosto, familia } from '../api/_finanzas-ganancias.js';

const fTS = (f) => { const [y, m, d] = f.split('-'); return { fecha: `${d}/${m}/${y}`, fechaPago: f, mesKey: `${y}-${m}` }; };
let n = 0;
function venta(f, { compraId, compraIds, clienteId, plataforma, total, recibido = total, asignaciones, anulada = false }) {
  const id = `oper_op_u_${String(++n).padStart(4, '0')}`;
  const r = { clienteId, compraId: compraId || '', plataforma, ...(compraIds ? { compraIds } : {}), ...(asignaciones ? { asignaciones } : {}), vendedor: 'Vendedor Prueba' };
  const out = { [`${id}_venta`]: { ...fTS(f), tipo: 'venta', subtipo: 'renovacion', monto: total, montoRecibido: recibido, saldoPendiente: total - recibido, ...(anulada ? { estadoFinanciero: 'anulado' } : {}), ...r } };
  if (recibido > 0) out[`${id}_cobro`] = { ...fTS(f), tipo: 'ingreso', subtipo: 'cobro_renovacion', monto: recibido, bancoId: 'bac', ...(anulada ? { estadoFinanciero: 'anulado' } : {}), ...r };
  return out;
}
const sv = (compraId, plataforma, precio, fechaRenovacion, extra = {}) => ({ compraId, plataforma, precio, fechaRenovacion, vendedor: 'Vendedor Prueba', ...extra });
function semilla() {
  n = 0;
  const movs = {
    ...venta('2026-11-05', { compraId: 'c1', clienteId: 'k1', plataforma: 'hbomax', total: 90 }), ...venta('2026-11-05', { compraId: 'c2', clienteId: 'k2', plataforma: 'hbomax', total: 90 }),
    ...venta('2026-11-06', { compraId: 'c3', clienteId: 'k3', plataforma: 'hbomax', total: 80 }), ...venta('2026-11-07', { compraId: 'c4', clienteId: 'k4', plataforma: 'hbomax', total: 100 }),
    ...venta('2026-11-08', { compraId: 'v1', clienteId: 'kv', plataforma: 'vipnetflix', total: 130 }),
    ...venta('2026-11-09', { compraId: 's1', clienteId: 'ks1', plataforma: 'spotify', total: 60 }), ...venta('2026-11-09', { compraId: 's2', clienteId: 'ks2', plataforma: 'spotify', total: 60 }),
    ...venta('2026-11-10', { compraId: 'p1', clienteId: 'kp1', plataforma: 'primevideo', total: 120 }), ...venta('2026-11-10', { compraId: 'p2', clienteId: 'kp2', plataforma: 'primevideo', total: 120, recibido: 60 }),
    ...venta('2026-11-12', { compraIds: ['x1', 'x2'], clienteId: 'kx', plataforma: 'crunchyroll + stellatv', total: 250 }),
    ...venta('2026-10-15', { compraId: 'c1', clienteId: 'k1', plataforma: 'hbomax', total: 90 }),
    ...venta('2026-11-13', { compraId: 'c2', clienteId: 'k2', plataforma: 'hbomax', total: 90, anulada: true }),
  };
  return {
    finanzas_movimientos: movs,
    clientes: {
      k1: { nombre: 'Titular Uno', servicios: [sv('c1', 'hbomax', 90, '05/12/2026', { planHbo: 'platinum', beneficiarioNombre: 'Beneficiaria Uno' })] },
      k2: { nombre: 'Titular Dos', servicios: [sv('c2', 'hbomax', 90, '05/12/2026', { planHbo: 'platinum' })] },
      k3: { nombre: 'Titular Tres', servicios: [sv('c3', 'hbomax', 80, '06/12/2026', { planHbo: 'platinum' })] },
      k4: { nombre: 'Titular Cuatro', servicios: [sv('c4', 'hbomax', 100, '07/12/2026', { planHbo: 'platinum' })] },
      kv: { nombre: 'Cliente VIP', servicios: [sv('v1', 'vipnetflix', 130, '08/12/2026')] },
      ks1: { nombre: 'Invitado 1', servicios: [sv('s1', 'spotify', 60, '09/12/2026')] }, ks2: { nombre: 'Invitado 2', servicios: [sv('s2', 'spotify', 60, '09/12/2026')] },
      ks3: { nombre: 'Invitado 3', servicios: [sv('s3', 'spotify', 60, '25/11/2026')] },
      kp1: { nombre: 'Prime Uno', servicios: [sv('p1', 'primevideo', 120, '10/12/2026')] }, kp2: { nombre: 'Prime Dos', servicios: [sv('p2', 'primevideo', 120, '10/12/2026')] },
      kx: { nombre: 'Cliente Combo', servicios: [sv('x1', 'crunchyroll', 100, '12/12/2026'), sv('x2', 'stellatv', 150, '12/12/2026')] },
    },
    inventario: {
      'hbo-1': { plataforma: 'hbomax', planHbo: 'platinum', correo: 'hbo1@prueba.test', capacidad: 5, clientes: [1, 2, 3, 4].map((i) => ({ compraId: 'c' + i, clienteId: 'k' + i, nombre: 'Perfil ' + i, slot: i })) },
      'vip-1': { plataforma: 'vipnetflix', correo: 'vip1@prueba.test', capacidad: 1, clientes: [{ compraId: 'v1', clienteId: 'kv', nombre: 'Cliente VIP' }] },
      'spf-1': { plataforma: 'spotify', correo: 'madre@prueba.test', capacidad: 6, clientes: [1, 2, 3].map((i) => ({ compraId: 's' + i, clienteId: 'ks' + i, nombre: 'Invitado ' + i, slot: i })) },
      'pv-1': { plataforma: 'primevideo', correo: 'prime@prueba.test', capacidad: 5, clientes: [{ compraId: 'p1', clienteId: 'kp1', slot: 1 }, { compraId: 'p2', clienteId: 'kp2', slot: 2 }] },
      'cr-1': { plataforma: 'crunchyroll', correo: 'crunchy@prueba.test', capacidad: 4, clientes: [{ compraId: 'x1', clienteId: 'kx', slot: 1 }] },
    },
    fin_productos: {
      'HBO-PLAT': { nombre: 'HBO Platinum', modelo: 'cuenta_madre', plataformaKey: 'hbomax', duracionDias: 0 },
      PRIME: { nombre: 'Prime Video', modelo: 'gift_card', plataformaKey: 'primevideo', duracionDias: 90 },
      CRUNCHY: { nombre: 'Crunchyroll', modelo: 'cuenta_madre', plataformaKey: 'crunchyroll', duracionDias: 365 },
      STELLA: { nombre: 'Stella TV', modelo: 'creditos', plataformaKey: 'stellatv', duracionDias: 30 },
      SPF: { nombre: 'Spotify Familiar', modelo: 'cuenta_madre', plataformaKey: 'spotify', duracionDias: 30 },
    },
    fin_lotes: {
      act: { productoId: 'HBO-PLAT', producto: 'HBO Platinum', fecha: '2026-11-03', fechaActivacion: '2026-11-05', modelo: 'cuenta_madre', duracionDias: 0, costoTotalHnl: 93.1, costoTotalMoneda: 3.5, moneda: 'USDT', tasa: 26.6, cuentaInventarioId: 'hbo-1' },
      pv: { productoId: 'PRIME', producto: 'Prime Video', fecha: '2026-11-02', modelo: 'gift_card', duracionDias: 90, costoTotalHnl: 341.85, costoTotalMoneda: 12.9, moneda: 'USD', tasa: 26.5, cuentaInventarioId: 'pv-1' },
      cr: { productoId: 'CRUNCHY', producto: 'Crunchyroll', fecha: '2026-11-01', modelo: 'cuenta_madre', duracionDias: 365, costoTotalHnl: 812.4, costoTotalMoneda: 1800, moneda: 'PHP', tasa: 0.4513, cuentaInventarioId: 'cr-1' },
      st: { productoId: 'STELLA', producto: 'Stella TV', fecha: '2026-10-01', modelo: 'creditos', duracionDias: 30, costoTotalHnl: 990, costoTotalMoneda: 37.5, moneda: 'USDT', tasa: 26.4 },
      spf: { productoId: 'SPF', producto: 'Spotify Familiar', fecha: '2026-11-01', modelo: 'cuenta_madre', duracionDias: 30, costoTotalHnl: 120, moneda: 'HNL' },
    },
    fin_consumos: { cons1: { ventaId: 'x', fecha: '2026-11-12', mesKey: '2026-11', estado: 'completo', lineas: [{ productoId: 'STELLA', costoHnl: 66 }, { productoId: 'STELLA', costoHnl: 66 }] } },
    fin_vip_extras: { 'vip-1': { cmId: 'vip-1', correo: 'vip1@prueba.test', proveedor: 'Proveedor Prueba', costoMensualUsdt: 2.5, tasa: 26.6, costoMensualHnl: 66.5, estadoSeguimiento: 'activo', creadoAt: '2026-08-01T00:00:00Z' } },
    fin_spotify_cuentas: { fam1: { madreCorreo: 'madre@prueba.test', costoMensualHnl: 120, creadoAt: '2026-08-01T00:00:00Z' } },
    finanzas_config: { costeo: { desde: '2026-08-01' } },
  };
}
const R = { movementYmd, movementKind, anuladoOReversa, money };
const res = () => { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
const deps = (db) => ({ hoyYmdHN: () => '2026-11-17', R, leerMovimientos: async (desde) => [...db._data.entries()].filter(([k]) => k.startsWith('finanzas_movimientos/')).map(([k, v]) => ({ id: k.split('/')[1], ...v.data })).filter((m) => movementYmd(m) >= desde), auditar: () => {} });
const call = async (db, accion, body = {}) => { const r = res(); await handlePanel(db, accion, body, { usuario: 'sublicuentas', role: 'sublicuentas', admin: true }, {}, r, deps(db)); return r.body; };


// ======== R200c · Excel financiero = mismas fórmulas que la Web ========
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const XL = require('../finanzas-excel.js');
const near = (a, b, msg) => assert.ok(Math.abs(Number(a) - Number(b)) < 0.011, `${msg}: ${a} ≠ ${b}`);

test('R200c 1 · cada mes del libro = Finanzas Web de ese mes (resumen y por plataforma)', async () => {
  const db = fakeFirestore(semilla());
  const x = await call(db, 'finp_excel_financiero', { desde: '2026-10-01', hasta: '2026-11-30' });
  assert.equal(x.ok, true);
  assert.deepEqual(x.meses.map((m) => m.mes), ['2026-10', '2026-11']);
  for (const m of x.meses) {
    const [y, mm] = m.mes.split('-').map(Number); const fin = new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10);
    const w = await call(db, 'finp_ganancias', { desde: `${m.mes}-01`, hasta: fin });
    for (const k of ['cobradoHnl', 'cobradoCubiertoHnl', 'costoHnl', 'desembolsoHnl']) near(m[k], w.resumen[k], `${m.mes} ${k}`);
    for (const p of w.porPlataforma) { const q = m.porPlataforma.find((z) => z.plataforma === p.plataforma); assert.ok(q, p.plataforma); near(q.cobradoHnl, p.cobradoHnl, `${m.mes} ${p.plataforma} cobrado`); near(q.costoHnl, p.costoHnl, `${m.mes} ${p.plataforma} costo`); }
    // detalle suma lo mismo que el resumen
    near(x.ventas.filter((v) => v.mes === m.mes).reduce((s, v) => s + v.cobrado, 0), m.cobradoHnl, 'detalle ventas');
    near(x.costos.filter((v) => v.mes === m.mes).reduce((s, v) => s + v.costoHnl, 0), m.costoHnl, 'detalle costos');
  }
  const nov = x.meses.find((m) => m.mes === '2026-11');
  assert.equal(x.ventas.filter((v) => v.mes === '2026-11' && /crunchy|stella/i.test(v.plataforma)).length, 2, 'combo: un pago repartido una sola vez');
  assert.ok(nov.cobradoHnl > 0);
  assert.doesNotMatch(JSON.stringify(x), /"(pin|pinPerfil|telefono|password|clave)"\s*:/i, 'sin PIN, teléfonos ni claves');
});

test('R200c 2 · el libro tiene 9 hojas + datos del tablero, tablas, 4 selectores, 6 gráficos nativos y al recalcular en LibreOffice da lo mismo que la Web', async (t) => {
  const db = fakeFirestore(semilla());
  const x = await call(db, 'finp_excel_financiero', { desde: '2026-10-01', hasta: '2026-11-30' });
  let ExcelJS, JSZip;
  try { ExcelJS = require('exceljs'); JSZip = require('jszip'); } catch { try { ExcelJS = require('/tmp/claude-0/hqh/libs/node_modules/exceljs'); JSZip = require('/tmp/claude-0/hqh/libs/node_modules/jszip'); } catch { t.skip('exceljs/jszip no instalados'); return; } }
  const buf = await XL.generar(x, { ExcelJS, JSZip }, { mes: '2026-11' });
  const zip = await JSZip.loadAsync(buf);
  for (let n = 901; n <= 906; n++) assert.ok(zip.file(`xl/charts/chart${n}.xml`), 'gráfico ' + n); assert.ok(zip.file('xl/drawings/drawing901.xml'), 'gráficos nativos');
  const tiposG = await Promise.all([901, 902, 903, 904, 905, 906].map((n) => zip.file(`xl/charts/chart${n}.xml`).async('string')));
  assert.ok(tiposG.some((x) => /<c:doughnutChart>/.test(x)) && tiposG.some((x) => /<c:lineChart>/.test(x)) && tiposG.some((x) => /<c:barDir val="col"\/>/.test(x)), 'dona, línea y columnas');
  assert.ok(tiposG.every((x) => /(&apos;|')10 Datos del tablero(&apos;|')!/.test(x)), 'los gráficos leen la hoja de datos que depende de los selectores');
  const ct = await zip.file('[Content_Types].xml').async('string'); assert.match(ct, /chart901\.xml/);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
  assert.deepEqual(wb.worksheets.map((w) => w.name), XL.HOJAS);
  const p = wb.getWorksheet('01 Panel ejecutivo');
  for (const c of ['B4', 'B5', 'B6', 'B7']) assert.equal(p.getCell(c).dataValidation.type, 'list', c);
  assert.equal(wb.getWorksheet('10 Datos del tablero').state, 'hidden');
  assert.ok((p.conditionalFormattings || []).length >= 3, 'semáforo con formato condicional');
  assert.match(String(p.getCell('B9').value.formula), /^SUMIFS\(/);
  const tablas = [...(await Promise.all(Object.keys(zip.files).filter((f) => /^xl\/tables\/table\d+\.xml$/.test(f)).map((f) => zip.file(f).async('string'))))].map((s) => /name="([^"]+)"/.exec(s)[1]);
  for (const n of ['tVentas', 'tCompras', 'tCostos', 'tCuentas', 'tPlataformas', 'tRanking', 'tEvolucion', 'tPendientes']) assert.ok(tablas.includes(n), n);
  // recálculo real (LibreOffice) y lectura de los KPI del Panel
  let lo = ''; try { lo = execFileSync('which', ['soffice']).toString().trim(); } catch {}
  if (!lo) { t.diagnostic('sin LibreOffice: no se recalcula'); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r200c-'));
  // perfil temporal de LibreOffice con «recalcular siempre al abrir» (si no, solo copia los valores guardados)
  const perfil = path.join(dir, 'perfil', 'user'); fs.mkdirSync(perfil, { recursive: true });
  fs.writeFileSync(path.join(perfil, 'registrymodifications.xcu'), '<?xml version="1.0" encoding="UTF-8"?><oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item></oor:items>');
  const envLo = '-env:UserInstallation=file://' + path.join(dir, 'perfil'); fs.writeFileSync(path.join(dir, 'libro.xlsx'), Buffer.from(buf)); if (process.env.R200C_OUT) fs.writeFileSync(process.env.R200C_OUT, Buffer.from(buf));
  execFileSync(lo, [envLo, '--headless', '--calc', '--convert-to', 'xlsx:Calc MS Excel 2007 XML', '--outdir', path.join(dir, 'out'), path.join(dir, 'libro.xlsx')], { stdio: 'ignore', timeout: 120000 });
  const wb2 = new ExcelJS.Workbook(); await wb2.xlsx.readFile(path.join(dir, 'out', 'libro.xlsx'));
  const v = (ws, c) => { const z = wb2.getWorksheet(ws).getCell(c).value; return z && typeof z === 'object' && 'result' in z ? z.result : z; };
  const nov = x.meses.find((m) => m.mes === '2026-11');
  t.diagnostic(`Panel nov recalculado: cobrado ${v('01 Panel ejecutivo', 'B9')} costo ${v('01 Panel ejecutivo', 'B11')}`);
  near(v('01 Panel ejecutivo', 'B9'), nov.cobradoHnl, 'Panel cobrado nov');
  near(v('01 Panel ejecutivo', 'B10'), nov.cobradoCubiertoHnl, 'Panel cobrado con costo nov');
  near(v('01 Panel ejecutivo', 'B11'), nov.costoHnl, 'Panel costo nov');
  near(v('01 Panel ejecutivo', 'B16'), nov.desembolsoHnl, 'Panel compras pagadas nov');
  const ev = wb2.getWorksheet('07 Evolucion anual');
  for (let r = 4; r <= 5; r++) { const mes = ev.getCell('A' + r).value; const m = x.meses.find((z) => z.mes === mes); const g = (c) => { const z = ev.getCell(c + r).value; return z && typeof z === 'object' ? z.result : z; };
    near(g('C'), m.cobradoHnl, mes + ' evol cobrado'); near(g('E'), m.costoHnl, mes + ' evol costo'); near(g('I'), m.desembolsoHnl, mes + ' evol compras'); }
  // selector de plataforma: el valor guardado es de «Todas»; si Excel/LibreOffice no recalculara, esto fallaría
  const pp = nov.porPlataforma.filter((z) => z.cobradoHnl > 0).sort((a, b) => b.cobradoHnl - a.cobradoHnl)[0];
  const wb3 = new ExcelJS.Workbook(); await wb3.xlsx.load(buf); wb3.getWorksheet('01 Panel ejecutivo').getCell('B5').value = pp.nombre;
  fs.writeFileSync(path.join(dir, 'plat.xlsx'), Buffer.from(await wb3.xlsx.writeBuffer()));
  execFileSync(lo, [envLo, '--headless', '--calc', '--convert-to', 'xlsx:Calc MS Excel 2007 XML', '--outdir', path.join(dir, 'out'), path.join(dir, 'plat.xlsx')], { stdio: 'ignore', timeout: 120000 });
  const wb4 = new ExcelJS.Workbook(); await wb4.xlsx.readFile(path.join(dir, 'out', 'plat.xlsx'));
  const v4 = (c) => { const z = wb4.getWorksheet('01 Panel ejecutivo').getCell(c).value; return z && typeof z === 'object' && 'result' in z ? z.result : z; };
  t.diagnostic(`Panel nov · ${pp.nombre}: cobrado ${v4('B9')} costo ${v4('B11')}`);
  near(v4('B9'), pp.cobradoHnl, `Panel ${pp.nombre} cobrado`); near(v4('B11'), pp.costoHnl, `Panel ${pp.nombre} costo`);
  assert.ok(Math.abs(v4('B9') - nov.cobradoHnl) > 0.01, 'el selector cambió la cifra');
  // selector de VENDEDOR: ingresos del vendedor; el costo dice «No aplica» (no se reparte por vendedor)
  const vend = x.ventas.filter((z) => z.mes === '2026-11')[0].vendedor;
  const cobV = x.ventas.filter((z) => z.mes === '2026-11' && z.vendedor === vend).reduce((a, z) => a + z.cobrado, 0);
  const wb5 = new ExcelJS.Workbook(); await wb5.xlsx.load(buf); wb5.getWorksheet('01 Panel ejecutivo').getCell('B6').value = vend;
  fs.writeFileSync(path.join(dir, 'vend.xlsx'), Buffer.from(await wb5.xlsx.writeBuffer()));
  execFileSync(lo, [envLo, '--headless', '--calc', '--convert-to', 'xlsx:Calc MS Excel 2007 XML', '--outdir', path.join(dir, 'out'), path.join(dir, 'vend.xlsx')], { stdio: 'ignore', timeout: 120000 });
  const wb6 = new ExcelJS.Workbook(); await wb6.xlsx.readFile(path.join(dir, 'out', 'vend.xlsx'));
  const v6 = (h, c) => { const z = wb6.getWorksheet(h).getCell(c).value; return z && typeof z === 'object' && 'result' in z ? z.result : z; };
  near(v6('01 Panel ejecutivo', 'B9'), cobV, 'Panel cobrado del vendedor'); assert.match(String(v6('01 Panel ejecutivo', 'B11')), /No aplica/);
  t.diagnostic(`Panel nov · vendedor ${vend}: cobrado ${v6('01 Panel ejecutivo', 'B9')}`);
  // la hoja de datos de los gráficos también cambió: suma por plataforma = cobrado del vendedor
  const dsh = wb6.getWorksheet('10 Datos del tablero'); let sp = 0; for (let r = 5; r <= 40; r++) { const z = dsh.getCell('E' + r).value; const n = z && typeof z === 'object' ? z.result : z; if (typeof n === 'number') sp += n; }
  near(sp, cobV, 'gráfico por plataforma con el filtro de vendedor');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('R200c 3 · la Web usa el libro nuevo; nombres personales y datos sensibles fuera', () => {
  const w = fs.readFileSync(new URL('../finanzas-web.js', import.meta.url), 'utf8');
  assert.match(w, /SublichatExcelFinanciero/); assert.match(w, /finp_excel_financiero/);
  const h = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(h, /jszip\/3\.10\.1\/jszip\.min\.js/); assert.match(h, /finanzas-excel\.js/);
  const s = fs.readFileSync(new URL('../finanzas-excel.js', import.meta.url), 'utf8');
  assert.doesNotMatch(s, /telefono|password|contrase(ñ|n)a\s*:/i);
  assert.match(s, /naara\/ig, 'Sublicuentas'/);
});

test('R200b · gráficos del Resumen salen del MISMO cálculo que las tarjetas (suman igual)', async () => {
  const db = fakeFirestore(semilla());
  const w = await call(db, 'finp_ganancias', { desde: '2026-11-01', hasta: '2026-11-30' });
  const g = w.graficos, r = w.resumen;
  near(Object.values(g.composicion).reduce((s, c) => s + c.cobradoHnl, 0), r.cobradoHnl, 'composición = cobrado');
  near(g.cobertura.cubiertoHnl + g.cobertura.sinCostoHnl, r.cobradoHnl, 'cobertura = cobrado');
  near(g.porDia.reduce((s, d) => s + d.cobradoHnl, 0), r.cobradoHnl, 'serie diaria = cobrado');
  for (const k of ['inversionProveedor', 'inversionPago', 'inversionMoneda']) near(g[k].reduce((s, x) => s + x.costoHnl, 0), r.desembolsoHnl, k + ' = compras pagadas');
  near(w.porPlataforma.reduce((s, p) => s + p.cobradoHnl, 0), r.cobradoHnl, 'barras por plataforma = cobrado');
  assert.equal(g.transaccionesTotal, g.transacciones.length);
  assert.ok(g.transacciones.every((t) => !t.cuenta || /•••@/.test(t.cuenta)), 'correo de la cuenta enmascarado');
  const web = fs.readFileSync(new URL('../finanzas-web.js', import.meta.url), 'utf8');
  assert.doesNotMatch(web.slice(web.indexOf('function vResumen'), web.indexOf('function vResumen') + 3000), /chartHtml\(/, 'Resumen ya no usa el gráfico de fin_consumos');
});
