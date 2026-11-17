// R196z · PDF «Finanzas: reparar registro de compras y cargar cuentas automáticamente» (16/11/2026).
// Fase 1: Guardar compra visible y funcional (causa: el modal vivía fuera de #rbac-finanzas y su botón rojo quedaba sin color).
// Fase 2: cuentas madre leídas de Control Maestro (Netflix Premium, Paramount+, Crunchyroll, Prime Video, HBO). Datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
import { handlePanel, ACCIONES_PANEL } from '../api/_finanzas-panel.js';
import { handleEmpresa } from '../api/_finanzas-empresa.js';
import { bankBalances } from '../api/_finanzas-libro.js';
const require = createRequire(import.meta.url);
const fc = require('../api/_finanzas-cuentas.js');

const methods = [{ id: 'bac', nombre: 'BAC Credomatic', logoKey: 'bac', activo: true }];
const ident = { usuario: 'sublicuentas', role: 'sublicuentas', admin: true };
const semilla = () => ({
  inventario: {
    'nf-tarjeta': { plataforma: 'netflix', correo: 'Madre1@Prueba.test', capacidad: 5, clientes: [{ nombre: 'A' }, { nombre: 'B' }], plan: 'Premium' },
    'nf-gift': { plataforma: 'Netflix', correo: 'madre2@prueba.test', capacidad: 5, clientes: [] },
    'nf-borrada': { plataforma: 'netflix', correo: 'borrada@prueba.test', estado: 'eliminada' },
    'vip-1': { plataforma: 'vipnetflix', correo: 'extra@prueba.test', capacidad: 1 },
    'pm-1': { plataforma: 'paramount', correo: 'para1@prueba.test', capacidad: 4 }, 'pm-2': { plataforma: 'paramount', correo: 'para2@prueba.test', capacidad: 4 },
    'cr-1': { plataforma: 'crunchyroll', correo: 'crunchy@prueba.test', capacidad: 4 },
    'pv-1': { plataforma: 'primevideo', correo: 'prime@prueba.test', capacidad: 5 },
    'hbo-1': { plataforma: 'hbomax', correo: 'hbo@prueba.test', capacidad: 3, planHbo: 'standard', clientes: [{ nombre: 'C' }] },
    'dis-1': { plataforma: 'disneyp', correo: 'disney@prueba.test' },
  },
  fin_productos: {
    'NFX-PREM': { nombre: 'Netflix Premium propio', categoria: 'perfiles', modelo: 'cuenta_madre', unidad: 'cuenta', plataformaKey: 'netflix', capacidad: 7, duracionDias: 30, activo: true },
    PARAMOUNT: { nombre: 'Paramount+', categoria: 'perfiles', modelo: 'cuenta_madre', unidad: 'cuenta', plataformaKey: 'paramount', capacidad: 4, duracionDias: 30, activo: true },
    CRUNCHY: { nombre: 'Crunchyroll', categoria: 'perfiles', modelo: 'cuenta_madre', unidad: 'cuenta', plataformaKey: 'crunchyroll', capacidad: 4, duracionDias: 365, activo: true },
    PRIME: { nombre: 'Prime Video', categoria: 'perfiles', modelo: 'gift_card', unidad: 'cuenta', plataformaKey: 'primevideo', capacidad: 5, duracionDias: 90, activo: true },
    'HBO-PLAT': { nombre: 'HBO Platinum', categoria: 'perfiles', modelo: 'cuenta_madre', unidad: 'cuenta', plataformaKey: 'hbomax', capacidad: 5, duracionDias: 365, activo: true },
  },
});
const res = () => { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
const deps = (db) => ({ hoyYmdHN: () => '2026-11-17', canUseLibro: () => true, loadMethods: async () => methods, libroOpDocId: (p, b, uid) => (b.operationId ? `${p}_op_${uid}_${b.operationId}` : ''),
  auditar: (tx, _db, i, ev) => tx.set(db.collection('auditoria_eventos').doc(), { actor: i.usuario, ...ev }),
  estadoLibro: async () => ({ saldos: bankBalances([...db._data.entries()].filter(([k]) => k.startsWith('finanzas_movimientos/')).map(([k, v]) => ({ id: k, ...v.data })), { bases: { bac: { saldo: 50000, desde: '2026-10-01' } } }, methods) }),
  baseMov: (i) => ({ registradoPor: i.usuario, origenCanal: 'web', createdAt: '2026-11-17T15:00:00Z' }),
  canonicalFinanceDate: (f) => { const [y, m, d] = f.split('-'); return { fecha: `${d}/${m}/${y}`, fechaPago: f, mesKey: `${y}-${m}` }; } });
const panel = async (db, accion, body) => { const r = res(); await handlePanel(db, accion, body, ident, { uid: 'u1' }, r, deps(db)); return r.body; };
const empresa = async (db, accion, body) => { const r = res(); await handleEmpresa(db, accion, body, ident, { uid: 'u1' }, r, deps(db)); return r.body; };
const lotes = (db) => [...db._data.entries()].filter(([k]) => k.startsWith('fin_lotes/')).map(([k, v]) => ({ id: k.split('/')[1], ...v.data }));
const intocable = (db) => JSON.stringify([...db._data.entries()].filter(([k]) => /^(inventario|clientes|ventas)\//.test(k)));
const web = fs.readFileSync(new URL('../finanzas-web.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../finanzas-web.css', import.meta.url), 'utf8');

test('Fase 0/1 · causa: el modal vive en <body>; ahora define sus colores y el pie Cancelar + «Guardar compra» queda fijo', () => {
  assert.match(css, /#rbac-finanzas,\.fz-modal\{--r:#E2231A;/, 'el modal hereda el rojo del botón principal');
  assert.match(css, /\.fz-modal-pie\{flex:none;background:#fff/); assert.match(css, /\.fz-modal-b\{[^}]*overflow:auto/);
  assert.match(css, /@media \(max-width:640px\)\{\.fz-modal\{/, 'responsive en celular');
  assert.match(web, /data-x>Cancelar<\/button><button type="button" class="fz-btn" data-ok>/, 'Cancelar y luego el botón principal');
  assert.match(web, /'Guardar compra', \{ validar: validar/); assert.match(web, /Guardando…/); assert.match(web, /if \(enviando\) return;/, 'sin doble envío');
  assert.match(web, /catch \(e\) \{ enviando = false; er\.textContent/, 'en error el modal y sus datos se quedan');
  assert.match(web, /folio ' \+ folio\(r\.loteId\)/, 'confirma con folio');
  assert.doesNotMatch(web, /25 extras/); assert.doesNotMatch(web, /sus 4 perfiles/);
  assert.match(web, /data-si="divisa"/, 'el cargo en Lempiras solo aparece con divisa');
});

test('Fase 1 · activación HBO ligada a la cuenta, en USDT; se guarda una sola vez y queda en su historial', async () => {
  const db = fakeFirestore(semilla()); const antes = intocable(db);
  const compra = { productoId: 'HBO-PLAT', fecha: '2026-11-17', cantidad: 1, costoTotal: 3.5, moneda: 'USDT', pago: 'binance', duracionDias: 0, cuentaInventarioId: 'hbo-1' };
  await empresa(db, 'fin_binance_recargar', { bancoId: 'bac', hnl: 2650, usdt: 100, fecha: '2026-11-10', operationId: 'recarga-0001' });
  const c = await empresa(db, 'fin_compra_registrar', { operationId: 'act-0001', compra });
  assert.equal(c.ok, true, JSON.stringify(c));
  const dos = await empresa(db, 'fin_compra_registrar', { operationId: 'act-0001', compra }); // doble clic
  assert.equal(dos.duplicado, true); assert.equal(lotes(db).length, 1);
  const g = await panel(db, 'finp_hbo_guardar', { cuentaId: 'hbo-1', cargo: { fecha: '2026-11-17', moneda: 'USDT', monto: 3.5, cargoHnl: c.costoTotalHnl, loteId: c.loteId, operationId: c.loteId, activacion: true } });
  assert.equal(g.ok, true, JSON.stringify(g));
  const l = await panel(db, 'finp_hbo_lista', {});
  const f = l.filas.find((x) => x.cuentaId === 'hbo-1');
  assert.deepEqual([f.plan, f.capacidad, f.ocupados, f.modalidad, f.cargos[0].moneda, f.cargos[0].tipo, f.cargos[0].loteId], ['standard', 3, 1, 'activacion', 'USDT', 'activacion', c.loteId]);
  assert.equal(lotes(db)[0].cuentaInventarioId, 'hbo-1');
  // USDT sin compra real (sin loteId) no se anota
  const sinLote = await panel(db, 'finp_hbo_guardar', { cuentaId: 'hbo-1', cargo: { fecha: '2026-11-17', moneda: 'USDT', monto: 3.5, cargoHnl: 90 } });
  assert.equal(sinLote.ok, false);
  assert.equal(intocable(db), antes, 'Control Maestro intacto');
});

test('Fase 2 · listas automáticas: cuentas madre de Control Maestro, sin VIP, sin borradas, costo pendiente ≠ L0', async () => {
  const db = fakeFirestore(semilla()); const antes = intocable(db);
  assert.ok(['finp_cuentas_lista', 'finp_cuenta_config', 'finp_cuenta_historial'].every((a) => ACCIONES_PANEL.includes(a)));
  const nf = await panel(db, 'finp_cuentas_lista', { plataforma: 'netflix' });
  assert.equal(nf.ok, true, JSON.stringify(nf));
  assert.deepEqual(nf.filas.map((f) => f.cuentaId).sort(), ['nf-gift', 'nf-tarjeta'], 'Netflix Premium: madres reales, sin VIP ni eliminadas');
  const t = nf.filas.find((f) => f.cuentaId === 'nf-tarjeta');
  assert.deepEqual([t.correo, t.ocupados, t.capacidad, t.plan, t.estadoCosto, t.costo], ['madre1@prueba.test', 2, 5, 'Premium', 'pendiente', null]);
  for (const [p, n] of [['paramount', 2], ['crunchyroll', 1], ['primevideo', 1]]) assert.equal((await panel(db, 'finp_cuentas_lista', { plataforma: p })).filas.length, n, p);
  const pend = await panel(db, 'finp_cuentas_lista', { plataforma: 'pendientes' });
  assert.equal(pend.resumen.pendientes, 7); assert.equal(pend.filas.some((f) => f.cuentaId === 'dis-1' || f.cuentaId === 'vip-1'), false);
  assert.equal((await panel(db, 'finp_cuentas_lista', { plataforma: 'disneyp' })).ok, false);
  assert.equal(lotes(db).length, 0, 'sincronizar no crea compras'); assert.equal(intocable(db), antes);
});

test('Fase 2 · «Cómo se paga» por cuenta: Prime en USD (no USDT), tarjeta mínima, sin tocar Control Maestro', async () => {
  const db = fakeFirestore(semilla()); const antes = intocable(db);
  assert.match((await panel(db, 'finp_cuenta_config', { cuentaId: 'pv-1', modalidad: 'tarjeta', moneda: 'USDT', frecuencia: 'trimestral' })).error, /USD \(no USDT\)/);
  assert.match((await panel(db, 'finp_cuenta_config', { cuentaId: 'pm-1', modalidad: 'tarjeta', moneda: 'HNL', frecuencia: 'mensual', tarjetaNueva: { banco: 'BAC', titular: 'Titular Prueba', ultimos4: '4111111111111111' } })).error, /SOLO los últimos 4/);
  const ok = await panel(db, 'finp_cuenta_config', { cuentaId: 'pm-1', modalidad: 'tarjeta', moneda: 'HNL', frecuencia: 'mensual', proximoPago: '2026-12-05', tarjetaNueva: { banco: 'BAC', titular: 'Titular Prueba', ultimos4: '1234' } });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  const cr = await panel(db, 'finp_cuenta_config', { cuentaId: 'cr-1', modalidad: 'paypal', moneda: 'PHP', frecuencia: 'anual' });
  assert.equal(cr.ok, true, JSON.stringify(cr));
  const gift = await panel(db, 'finp_cuenta_config', { cuentaId: 'nf-gift', modalidad: 'gift_card', moneda: 'USDT', frecuencia: 'puntual' });
  assert.equal(gift.ok, true, 'Netflix por gift card sin forzar tarjeta');
  assert.equal((await panel(db, 'finp_cuenta_config', { cuentaId: 'vip-1', modalidad: 'tarjeta', moneda: 'USD', frecuencia: 'mensual' })).ok, false, 'VIP no es cuenta madre');
  const pm = (await panel(db, 'finp_cuentas_lista', { plataforma: 'paramount' })).filas.find((f) => f.cuentaId === 'pm-1');
  assert.deepEqual([pm.configurada, pm.modalidad, pm.moneda, pm.tarjeta.ultimos4, pm.proximoPago, pm.estadoCosto], [true, 'tarjeta', 'HNL', '1234', '2026-12-05', 'pendiente'], 'configurar no es costo');
  assert.equal(JSON.stringify([...db._data.values()]).includes('4111111111111111'), false);
  assert.equal(intocable(db), antes); assert.equal(lotes(db).length, 0);
});

test('Fase 2/3 · pago real por cuenta: HNL sin conversión, PHP anual con cargo HNL, Prime USD 3 meses; tasa histórica fija; historial', async () => {
  const db = fakeFirestore(semilla()); const antes = intocable(db);
  const p1 = await empresa(db, 'fin_compra_registrar', { operationId: 'pm-pago-01', compra: { productoId: 'PARAMOUNT', fecha: '2026-11-05', cantidad: 1, costoTotal: 150, moneda: 'HNL', pago: 'banco', bancoId: 'bac', duracionDias: 30, cuentaInventarioId: 'pm-1' } });
  assert.equal(p1.ok, true, JSON.stringify(p1)); assert.equal(p1.costoTotalHnl, 150);
  const p2 = await empresa(db, 'fin_compra_registrar', { operationId: 'cr-pago-01', compra: { productoId: 'CRUNCHY', fecha: '2026-11-01', cantidad: 1, costoTotal: 1800, moneda: 'PHP', cargoHnl: 812.4, pago: 'banco', bancoId: 'bac', duracionDias: 365, cuentaInventarioId: 'cr-1' } });
  assert.equal(p2.ok, true, JSON.stringify(p2)); assert.equal(p2.costoTotalHnl, 812.4);
  const p3 = await empresa(db, 'fin_compra_registrar', { operationId: 'pv-pago-01', compra: { productoId: 'PRIME', fecha: '2026-11-02', cantidad: 1, costoTotal: 12.9, moneda: 'USD', cargoHnl: 341.85, pago: 'banco', bancoId: 'bac', duracionDias: 90, cuentaInventarioId: 'pv-1' } });
  assert.equal(p3.ok, true, JSON.stringify(p3));
  const L = lotes(db); assert.equal(L.length, 3, 'un pago = una compra (sin 12 egresos ni cobros mensuales ficticios)');
  const pv = (await panel(db, 'finp_cuentas_lista', { plataforma: 'primevideo' })).filas[0];
  assert.deepEqual([pv.estadoCosto, pv.costo.moneda, pv.costo.costoHnl, pv.costo.duracionDias, pv.ultimaCompra, pv.proximoPago], ['con_costo', 'USD', 341.85, 90, '2026-11-02', '2027-01-31']);
  const cr = (await panel(db, 'finp_cuentas_lista', { plataforma: 'crunchyroll' })).filas[0];
  assert.deepEqual([cr.costo.moneda, cr.costo.montoMoneda, cr.costo.costoHnl, cr.proximoPago], ['PHP', 1800, 812.4, '2027-11-01']);
  const tasa = L.find((l) => l.cuentaInventarioId === 'cr-1').tasa;
  const h = await panel(db, 'finp_cuenta_historial', { cuentaId: 'cr-1' });
  assert.deepEqual([h.compras.length, h.compras[0].tasa, h.compras[0].duracionDias], [1, tasa, 365]);
  const pend = await panel(db, 'finp_cuentas_lista', { plataforma: 'pendientes' });
  assert.equal(pend.filas.some((f) => ['pm-1', 'cr-1', 'pv-1'].includes(f.cuentaId)), false, 'con pago real ya no está pendiente');
  assert.equal(intocable(db), antes, 'sin tocar fichas, capacidad ni asignaciones');
});

test('Helpers · plataforma por cuenta y validación de configuración', () => {
  assert.deepEqual(['Netflix', 'vipnetflix', 'Paramount+', 'crunchyroll', 'Prime Video', 'amazon', 'hbomax', 'disneyp'].map(fc.plataformaDe), ['netflix', '', 'paramount', 'crunchyroll', 'primevideo', 'primevideo', 'hbomax', '']);
  assert.match(fc.limpiarConfig('crunchyroll', { modalidad: 'tarjeta', moneda: 'PHP', frecuencia: 'trimestral' }).error, /Frecuencia/);
  assert.equal(fc.limpiarConfig('crunchyroll', { modalidad: 'paypal', moneda: 'PHP', frecuencia: 'anual' }).config.frecuencia, 'anual');
});
