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
  // R200g (23/11/2026): Disney Premium/Standard y Viki Rakuten también salen en Finanzas › Compras (dis-1 ahora cuenta).
  assert.equal(pend.resumen.pendientes, 8); assert.equal(pend.filas.some((f) => f.cuentaId === 'vip-1'), false); assert.equal(pend.filas.some((f) => f.cuentaId === 'dis-1'), true);
  assert.equal((await panel(db, 'finp_cuentas_lista', { plataforma: 'disneyp' })).ok, true);
  assert.equal((await panel(db, 'finp_cuentas_lista', { plataforma: 'vipnetflix' })).ok, false);
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
  assert.deepEqual(['Netflix', 'vipnetflix', 'Paramount+', 'crunchyroll', 'Prime Video', 'amazon', 'hbomax', 'disneyp', 'disneys', 'Viki Rakuten'].map(fc.plataformaDe), ['netflix', '', 'paramount', 'crunchyroll', 'primevideo', 'primevideo', 'hbomax', 'disneyp', 'disneys', 'viki']); // R200g
  assert.match(fc.limpiarConfig('crunchyroll', { modalidad: 'tarjeta', moneda: 'PHP', frecuencia: 'trimestral' }).error, /Frecuencia/);
  assert.equal(fc.limpiarConfig('crunchyroll', { modalidad: 'paypal', moneda: 'PHP', frecuencia: 'anual' }).config.frecuencia, 'anual');
});

// ================= R200g (23/11/2026) · Disney Premium/Standard y Viki Rakuten en Compras; historial en todas; USD → L con tasa BAC
import { leerTasaBacXml } from '../api/_finanzas-panel.js';
const XML_BAC = '<?xml version="1.0"?><exchangeRates><country><name>Nicaragua</name><buyRateUSD>36.10</buyRateUSD><saleRateUSD>36.90</saleRateUSD></country><country><name>Honduras</name><buyRateUSD>26.1500</buyRateUSD><saleRateUSD>26.4500</saleRateUSD></country></exchangeRates>';

test('R200g · Disney Premium, Disney Standard y Viki: cuentas de Control Maestro con tarjeta, gift card o link/activación', async () => {
  const s = semilla(); s.inventario['dis-s'] = { plataforma: 'disneys', correo: 'disneys@prueba.test', capacidad: 3 }; s.inventario['vk-1'] = { plataforma: 'viki', correo: 'viki@prueba.test', capacidad: 1 };
  const db = fakeFirestore(s);
  for (const [p, id] of [['disneyp', 'dis-1'], ['disneys', 'dis-s'], ['viki', 'vk-1']]) {
    const r = await panel(db, 'finp_cuentas_lista', { plataforma: p });
    assert.equal(r.ok, true, JSON.stringify(r)); assert.deepEqual(r.filas.map((f) => f.cuentaId), [id], p);
    for (const m of ['tarjeta', 'gift_card', 'link']) assert.ok(r.plataformas[p].modalidades.includes(m), `${p} ${m}`);
  }
  assert.equal(fc.PLATAFORMAS.disneyp.defecto.modalidad, 'link', 'Disney generalmente por link');
  for (const p of Object.keys(fc.PLATAFORMAS)) for (const m of ['tarjeta', 'gift_card', 'link']) assert.ok(fc.PLATAFORMAS[p].modalidades.includes(m), `${p} acepta ${m}`);
  const c = await panel(db, 'finp_cuenta_config', { cuentaId: 'dis-1', modalidad: 'link', moneda: 'USDT', frecuencia: 'mensual' });
  assert.equal(c.ok, true, JSON.stringify(c));
});

test('R200g · tasa BAC Honduras: lee el XML, guarda la del día; si BAC falla usa la última guardada; nunca inventa', async () => {
  assert.deepEqual(leerTasaBacXml(XML_BAC), { compra: 26.15, venta: 26.45 });
  assert.equal(leerTasaBacXml('<country><name>Honduras</name><buyRateUSD>0</buyRateUSD><saleRateUSD>0</saleRateUSD></country>'), null, 'tasa absurda = no hay tasa');
  const real = globalThis.fetch;
  try {
    // 1) BAC caído y nada guardado → error claro (escribir el cargo a mano)
    globalThis.fetch = async () => ({ ok: false, status: 503, text: async () => '' });
    const db0 = fakeFirestore(semilla());
    const e = await panel(db0, 'finp_tasa_bac', {});
    assert.equal(e.disponible, false); assert.match(e.error, /Escriba el cargo en Lempiras/);
    // 2) BAC caído con una tasa guardada de otro día → la usa y dice de qué fecha es
    const s = semilla(); s.fin_tasas = { 'bac_2026-11-15': { fuente: 'BAC Credomatic Honduras', fecha: '2026-11-15', compra: 26.1, venta: 26.4 } };
    const v = await panel(fakeFirestore(s), 'finp_tasa_bac', {});
    assert.deepEqual([v.disponible, v.venta, v.deHoy], [true, 26.4, false]); assert.match(v.aviso, /2026-11-15/);
    // 3) BAC responde → tasa del día guardada en fin_tasas/bac_{fecha}
    globalThis.fetch = async (u) => { assert.match(String(u), /sucursalelectronica\.com\/exchangerate/); return { ok: true, status: 200, text: async () => XML_BAC }; };
    const db = fakeFirestore(semilla());
    const t = await panel(db, 'finp_tasa_bac', {});
    assert.deepEqual([t.disponible, t.compra, t.venta, t.deHoy, t.fecha], [true, 26.15, 26.45, true, '2026-11-17']);
    assert.equal(db._data.get('fin_tasas/bac_2026-11-17').data.venta, 26.45);
  } finally { globalThis.fetch = real; }
});

test('R200g · USD a Lempiras automático (13.97 USD × venta BAC) y editable; Historial en todas las plataformas', async () => {
  assert.match(web, /function usarTasaBac\(m, nombres\)/);
  assert.match(web, /Math\.round\(monto \* t\.venta \* 100\) \/ 100/, 'USD × tasa de venta');
  assert.match(web, /cargo\.dataset\.manual !== '1'/, 'si escribió el cargo real, manda el suyo');
  assert.match(web, /if \(pago === 'banco' && mon === 'USD'\) usarTasaBac\(m\)/);
  assert.match(web, /usarTasaBac\(m, \{ monto: 'monto' \}\)/, 'también en el cargo de HBO');
  // historial en cuentas madre (todas), HBO y Spotify
  assert.match(web, /data-fz-hist="cuenta" data-id="' \+ esc\(x\.cuentaId\)/);
  assert.match(web, /data-fz-hist="cuenta" data-id="' \+ esc\(f\.cuentaId\)/);
  assert.match(web, /data-fz-hist="spotify"/);
  assert.match(web, /Se volvió a pagar/); assert.match(web, /Cada cuánto paga/);
  for (const t of ['Disney Premium', 'Disney Standard', 'Viki Rakuten']) assert.match(web, new RegExp(`\\['[a-z]+', '${t}'\\]`), t);
  // historial de Spotify Familiar por cuenta principal
  const s = semilla(); s.spotify_familias = { f1: { codigo: 'SPF01', madreCorreo: 'spf@prueba.test', estado: 'activa' } };
  s.fin_productos['SPOTIFY-FAM'] = { nombre: 'Spotify Familiar', categoria: 'musica', modelo: 'cuenta_madre', plataformaKey: 'spotify', capacidad: 5, duracionDias: 30, activo: true };
  s.fin_lotes = { l1: { productoId: 'SPOTIFY-FAM', fecha: '2026-10-17', referencia: 'Spotify Familiar SPF01 · spf@prueba.test', costoTotalHnl: 320, moneda: 'HNL', costoTotalMoneda: 320 }, l2: { productoId: 'SPOTIFY-FAM', fecha: '2026-11-16', referencia: 'Spotify Familiar SPF01 · spf@prueba.test', costoTotalHnl: 320, moneda: 'HNL', costoTotalMoneda: 320 }, l3: { productoId: 'SPOTIFY-FAM', fecha: '2026-11-16', referencia: 'Spotify Familiar SPF02 · otra@prueba.test', costoTotalHnl: 320 } };
  const h = await panel(fakeFirestore(s), 'finp_cuenta_historial', { spotifyFamiliaId: 'f1' });
  assert.equal(h.ok, true, JSON.stringify(h)); assert.deepEqual(h.compras.map((c) => c.loteId), ['l2', 'l1']);
});

// ================= R200i (23/11/2026) · activación Netflix por USDT ya pagada + gift cards SAR de Prime Video
test('R200i · activación Netflix 10 USDT pagada con L280, válida hasta que venza: se guarda (antes daba error)', async () => {
  const db = fakeFirestore(semilla());
  const base = { productoId: 'NFX-PREM', fecha: '2026-11-17', fechaActivacion: '2026-07-16', cantidad: 1, costoTotal: 10, moneda: 'USDT', cuentaInventarioId: 'nf-gift', referencia: 'SE PAGO EN JULIO SOLO 10 USDT' };
  // Binance ya pagado (histórico) con los Lempiras pagados, sin tasa
  const r = await empresa(db, 'fin_compra_registrar', { operationId: 'act-nf-0001', compra: { ...base, pago: 'binance', binanceHistorico: true, cargoHnl: 280, vigenciaHasta: '2026-12-16', duracionDias: 153 } });
  assert.equal(r.ok, true, JSON.stringify(r));
  const l = lotes(db)[0];
  assert.deepEqual([l.costoTotalHnl, l.tasa, l.vigenciaHasta, l.fechaActivacion, l.moneda], [280, 28, '2026-12-16', '2026-07-16', 'USDT']);
  // «Banco / tarjeta» + USDT también se puede, escribiendo los Lempiras (antes el campo no aparecía y daba error)
  const r2 = await empresa(db, 'fin_compra_registrar', { operationId: 'act-nf-0002', compra: { ...base, cuentaInventarioId: 'nf-tarjeta', pago: 'banco', bancoId: 'bac', cargoHnl: 280 } });
  assert.equal(r2.ok, true, JSON.stringify(r2)); assert.equal(r2.costoTotalHnl, 280);
  assert.match(web, /x\.hidden = !\(pago === 'banco' && mon !== 'HNL'\); \}\); \/\/ R200i/, 'el cargo en Lempiras aparece también con USDT');
  assert.match(web, /name="hnlHist"/); assert.match(web, /name="vigenciaHasta"/);
  assert.match(web, /pago: mon === 'USDT' \|\| mod === 'binance' \|\| mod === 'link' \? 'binance_hist'/, 'cuenta por activación abre Binance ya pagado');
});

test('R200i · Prime Video gift card SAR: saldo, renovación mensual/anual, vencimiento de la gift card y su compra', async () => {
  const db = fakeFirestore(semilla());
  const c = await empresa(db, 'fin_compra_registrar', { operationId: 'gc-0001', compra: { productoId: 'PRIME', fecha: '2026-11-15', cantidad: 1, costoTotal: 13.97, moneda: 'USD', cargoHnl: 369.5, pago: 'banco', bancoId: 'bac', cuentaInventarioId: 'pv-1', duracionDias: 30, referencia: 'Gift card 50 SAR · Eneba' } });
  assert.equal(c.ok, true, JSON.stringify(c));
  const g = await panel(db, 'finp_giftcard_guardar', { cuentaId: 'pv-1', operationId: 'gc-0001', giftcard: { fechaCompra: '2026-11-15', montoSar: 50, costoUsd: 13.97, cargoHnl: 369.5, tienda: 'Eneba', vence: '2027-11-15', loteId: c.loteId } });
  assert.equal(g.ok, true, JSON.stringify(g)); assert.equal(g.saldoSar, 50);
  assert.equal((await panel(db, 'finp_giftcard_guardar', { cuentaId: 'pv-1', operationId: 'gc-0001', giftcard: { fechaCompra: '2026-11-15', montoSar: 50, costoUsd: 13.97, vence: '2027-11-15', loteId: c.loteId } })).duplicado, true, 'doble clic no suma dos veces');
  assert.match((await panel(db, 'finp_giftcard_guardar', { cuentaId: 'pv-1', giftcard: { fechaCompra: '2026-11-15', montoSar: 0, costoUsd: 5 } })).error, /SAR/);
  assert.match((await panel(db, 'finp_giftcard_guardar', { cuentaId: 'nf-gift', giftcard: { fechaCompra: '2026-11-15', montoSar: 50, costoUsd: 13 } })).error, /Prime Video/);
  const cfg = await panel(db, 'finp_cuenta_config', { cuentaId: 'pv-1', modalidad: 'gift_card', moneda: 'USD', frecuencia: 'mensual', proximoPago: '2026-12-15', saldoSar: 34.5, planRenovacion: 'mensual' });
  assert.equal(cfg.ok, true, JSON.stringify(cfg));
  const f = (await panel(db, 'finp_cuentas_lista', { plataforma: 'primevideo' })).filas.find((x) => x.cuentaId === 'pv-1');
  assert.deepEqual([f.saldoSar, f.planRenovacion, f.proximoPago, f.giftcardVence, f.giftcards.length, f.giftcards[0].montoSar, f.giftcards[0].costoUsd], [34.5, 'mensual', '2026-12-15', '2027-11-15', 1, 50, 13.97]);
  assert.equal(f.estadoCosto, 'con_costo');
  assert.match(web, /<th>Saldo gift card<\/th><th>Renovación<\/th><th>Vence gift card<\/th>/); assert.match(web, /data-fz-gc=/); assert.match(web, /usarTasaBac\(mm, \{ monto: 'costoUsd' \}\)/);
});
