// R196 · FINANZAS: rentabilidad por producto (Pendiente de costo, combos una vez) e importación Excel Netflix VIP.
// Datos ficticios; Firestore en memoria. Nada crea ventas, cuentas ni clientes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
import { rentabilidadMes, variacion, previsualizarVip, fechaExcel, proveedorVip, handlePanel } from '../api/_finanzas-panel.js';
import { MONEDAS, validarProducto, costearCompra } from '../api/_finanzas-empresa.js';

const productos = [{ id: 'NFX-VIP', nombre: 'Netflix VIP', categoria: 'perfiles' }, { id: 'OFFICE365', nombre: 'Office 365', categoria: 'software' }, { id: 'FF', nombre: 'Free Fire', categoria: 'videojuegos' }];
const consumo = (id, mes, lineas) => ({ id, mesKey: mes, estado: 'completo', lineas });

test('rentabilidad: ganancia solo con costo registrado; sin costo = «Pendiente de costo» (nunca 0); margen bajo según umbral', () => {
  const c = [
    consumo('v1', '2026-11', [{ productoId: 'NFX-VIP', servicio: 'Netflix VIP', cantidad: 1, ingresoHnl: 150, costoHnl: 66.25 }]),
    consumo('v2', '2026-11', [{ productoId: 'NFX-VIP', servicio: 'Netflix VIP', cantidad: 1, ingresoHnl: 150, costoHnl: 66.25 }]),
    consumo('v3', '2026-11', [{ productoId: 'OFFICE365', servicio: 'Office', cantidad: 1, ingresoHnl: 300, costoHnl: 0, pendiente: true, faltante: 1 }]),
    consumo('v4', '2026-11', [{ productoId: 'FF', servicio: 'Free Fire', cantidad: 1, ingresoHnl: 100, costoHnl: 80 }]),
    consumo('v5', '2026-10', [{ productoId: 'NFX-VIP', servicio: 'Netflix VIP', cantidad: 1, ingresoHnl: 150, costoHnl: 66.25 }]),
    { ...consumo('v6', '2026-11', [{ productoId: 'NFX-VIP', ingresoHnl: 999, costoHnl: 1 }]), estado: 'revertido' },
  ];
  const r = rentabilidadMes(c, productos, '2026-11', 30);
  assert.deepEqual([r.kpis.ingresosHnl, r.kpis.ingresoCosteadoHnl, r.kpis.costosHnl, r.kpis.gananciaHnl, r.kpis.ingresoSinCostoHnl, r.kpis.ventasSinCosto], [700, 400, 212.5, 187.5, 300, 1]);
  const of = r.productos.find((p) => p.productoId === 'OFFICE365');
  assert.equal(of.estado, 'pendiente_costo'); assert.equal(of.gananciaHnl, null); assert.equal(of.margen, null);
  assert.equal(r.productos.find((p) => p.productoId === 'FF').estado, 'margen_bajo');
  assert.equal(r.top[0].productoId, 'NFX-VIP');
  assert.equal(r.categorias.find((x) => x.categoria === 'software').pendienteHnl, 300);
  const ant = rentabilidadMes(c, productos, '2026-10', 30);
  assert.equal(variacion(r.kpis, ant.kpis).ingresos, 366.7);
});

test('combo: cada línea del combo cuenta una sola vez (el ingreso ya viene repartido por el costeo)', () => {
  const c = [consumo('v1', '2026-11', [{ productoId: 'NFX-VIP', ingresoHnl: 100, costoHnl: 60 }, { productoId: 'OFFICE365', ingresoHnl: 150, costoHnl: 50 }])];
  const r = rentabilidadMes(c, productos, '2026-11');
  assert.equal(r.kpis.ventas, 1); assert.equal(r.kpis.ingresosHnl, 250); assert.equal(r.kpis.costosHnl, 110);
});

test('monedas EUR y PHP: la tasa sale del cargo real en HNL y queda guardada; sin cargo se bloquea', () => {
  assert.ok(MONEDAS.includes('EUR') && MONEDAS.includes('PHP'));
  const k = costearCompra({ producto: { modelo: 'unidad' }, cantidad: 2, costoTotal: 10, moneda: 'EUR', pago: { tipo: 'banco', cargoHnl: 290 } });
  assert.deepEqual([k.costoTotalHnl, k.tasa, k.costoUnitarioHnl], [290, 29, 145]);
  assert.throws(() => costearCompra({ producto: { modelo: 'unidad' }, cantidad: 1, costoTotal: 500, moneda: 'PHP', pago: { tipo: 'banco' } }), /cargo real/);
  assert.equal(validarProducto({ nombre: 'Free Fire 100', modelo: 'unidad', categoria: 'videojuegos' }).categoria, 'videojuegos');
  assert.equal(validarProducto({ nombre: 'Kaspersky', modelo: 'unidad', categoria: 'antivirus_pc' }).categoria, 'antivirus_pc', 'categoría nueva sin programar');
});

test('Excel: fechas de serie y texto; proveedor por NOMBRE (nunca por precio)', () => {
  assert.equal(fechaExcel(46363), '2026-12-07');
  assert.equal(fechaExcel('07/12/2026'), '2026-12-07');
  assert.equal(fechaExcel('2026-02-30'), null);
  assert.equal(proveedorVip('Trap colombiano').id, 'trap-colombia');
  assert.equal(proveedorVip('deku PERUANO').id, 'deku-peru');
  assert.equal(proveedorVip('2.5'), null);
});

// ------------------------------------------------------------------------------------------- importación con servidor simulado
const inv = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`vip-${i + 1}`, { plataforma: 'vipnetflix', correo: `extra${i + 1}@ejemplo.com`, cuentaMadre: i < 10 ? 'madreA@ejemplo.com' : 'madreB@ejemplo.com', clientes: [{ nombre: `Cliente ${i + 1}` }], estado: 'ocupado' }]));
function semilla() {
  const inventario = inv(20);
  inventario['vip-dup-a'] = { plataforma: 'vipnetflix', correo: 'repetido@ejemplo.com', cuentaMadre: 'madreA@ejemplo.com' };
  inventario['vip-dup-b'] = { plataforma: 'vipnetflix', correo: 'repetido@ejemplo.com', cuentaMadre: 'madreB@ejemplo.com' };
  inventario['nf-x'] = { plataforma: 'netflix', correo: 'extra1@ejemplo.com' };
  return { inventario, fin_proveedores: { 'trap-colombia': { alias: 'Trap Colombia' }, 'deku-peru': { alias: 'Deku Perú' } }, clientes: { c1: { nombre: 'Cliente 1' } } };
}
const filaExtra = (i, extra = {}) => ({ ID_acceso_Control_Maestro: null, Correo_o_ID_extra: `extra${i}@ejemplo.com`, Cuenta_madre_Netflix: null, Proveedor: 'Trap colombiano', Costo_mensual_USDT: null, Fecha_proximo_cobro_proveedor: 46363, Fecha_ultimo_pago_proveedor: 46333, Estado: 'Activo', ID_lote_compra: 'LOTE-T-01', Tasa_Binance_HNL_USDT: null, Renovar_proximo_mes: 'Sí', Notas: null, _fila: i + 1, ...extra });
const lote = { _fila: 2, ID_lote: 'LOTE-T-01', Proveedor: 'Trap colombiano', Fecha_pago_proveedor: 46333, Cantidad_extras_pagados: 20, Total_pagado_USDT: 50, Tasa_Binance_HNL_por_USDT: 26.5, Comisiones_adicionales_HNL: 0, Comprobante_o_referencia: 'BIN-TEST', Observaciones: null };
const HOJAS = ['LEER_PRIMERO', 'EXTRAS_VIP', 'LOTES_COMPRAS', 'PROVEEDORES', 'EJEMPLOS_NO_IMPORTAR'];
function mkRes() { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; }
const deps = { hoyYmdHN: () => '2026-11-08', loadMethods: async () => [], auditar: (tx, db, identity, ev) => tx.set(db.collection('auditoria_eventos').doc(), { ...ev, actor: identity.usuario }) };
const ident = { usuario: 'sublicuentas', role: 'sublicuentas', admin: true };
async function call(db, accion, body) { const res = mkRes(); await handlePanel(db, accion, body, ident, { uid: 'u1' }, res, deps); return res.body; }
const cuenta = (db, pre) => [...db._data.keys()].filter((k) => k.startsWith(pre)).length;

test('VIP: lote de 20 = UN pago; 20 vínculos por correo exacto; 0 ventas/cuentas/clientes; re-importar es idempotente; deshacer restaura', async () => {
  const db = fakeFirestore(semilla());
  const extras = Array.from({ length: 20 }, (_, i) => filaExtra(i + 1));
  const antesInv = JSON.stringify([...db._data.entries()].filter(([k]) => k.startsWith('inventario/') || k.startsWith('clientes/')));
  const pv = await call(db, 'finp_vip_preview', { hojas: HOJAS, extras, lotes: [lote], archivo: { nombre: 'Sublichat_Netflix_VIP_Importacion.xlsx' } });
  assert.equal(pv.ok, true);
  assert.deepEqual([pv.resumen.nuevos, pv.resumen.pagosUnicos, pv.resumen.ventasNuevas, pv.resumen.cuentasNuevas], [20, 1, 0, 0]);
  assert.equal(pv.extras[0].datos.costoMensualUsdt, 2.5, 'costo del lote: 50 / 20');
  assert.equal(pv.extras[0].datos.costoMensualHnl, 66.25);
  const conf = await call(db, 'finp_vip_confirmar', { hojas: HOJAS, extras, lotes: [lote], hash: pv.hash, confirmo: true });
  assert.equal(conf.ok, true); assert.deepEqual([conf.extras, conf.lotes], [20, 1]);
  assert.equal(cuenta(db, 'fin_vip_lotes/'), 1); assert.equal(cuenta(db, 'fin_vip_extras/'), 20);
  assert.equal(db._data.get('fin_vip_lotes/LOTE-T-01').data.contabilizadoEnCaja, false);
  assert.equal(JSON.stringify([...db._data.entries()].filter(([k]) => k.startsWith('inventario/') || k.startsWith('clientes/'))), antesInv, 'Control Maestro y clientes intactos');
  assert.equal(cuenta(db, 'finanzas_movimientos/'), 0, 'no mueve caja ni crea ventas');
  // re-importar el mismo archivo: sin cambios, nada que confirmar
  const pv2 = await call(db, 'finp_vip_preview', { hojas: HOJAS, extras, lotes: [lote] });
  assert.deepEqual([pv2.resumen.nuevos, pv2.resumen.sinCambios, pv2.resumen.lotesSinCambios, pv2.resumen.pagosUnicos], [0, 20, 1, 0]);
  const c2 = await call(db, 'finp_vip_confirmar', { hojas: HOJAS, extras, lotes: [lote], hash: pv2.hash, confirmo: true });
  assert.equal(c2.ok, false); assert.match(c2.error, /No hay filas nuevas/);
  // deshacer la última
  const jobs = (await call(db, 'finp_importaciones', {})).jobs;
  const d = await call(db, 'finp_vip_deshacer', { jobId: jobs[0].id });
  assert.equal(d.ok, true); assert.equal(cuenta(db, 'fin_vip_extras/'), 0); assert.equal(cuenta(db, 'fin_vip_lotes/'), 0);
  const d2 = await call(db, 'finp_vip_deshacer', { jobId: jobs[0].id });
  assert.equal(d2.ok, false);
});

test('VIP: hojas EJEMPLOS ignoradas; filas con problema se bloquean SOLAS (ambiguo, sin coincidencia, duplicado, costo, fecha, lote, proveedor)', async () => {
  const db = fakeFirestore(semilla());
  const extras = [
    filaExtra(1), filaExtra(2),
    { ...filaExtra(3), Correo_o_ID_extra: 'repetido@ejemplo.com', _fila: 10 },
    { ...filaExtra(4), Correo_o_ID_extra: 'noexiste@ejemplo.com', _fila: 11 },
    { ...filaExtra(1), _fila: 12 },
    { ...filaExtra(5), Costo_mensual_USDT: 'abc', _fila: 13 },
    { ...filaExtra(6), Fecha_proximo_cobro_proveedor: '31/02/2026', _fila: 14 },
    { ...filaExtra(7), ID_lote_compra: 'LOTE-NO', _fila: 15 },
    { ...filaExtra(8), Proveedor: 'Pedro', _fila: 16 },
    { ...filaExtra(9), ID_acceso_Control_Maestro: 'CM-1001', _fila: 17 },
  ];
  const pv = await call(db, 'finp_vip_preview', { hojas: HOJAS, extras, lotes: [lote] });
  const est = Object.fromEntries(pv.extras.map((x) => [x.fila, x.estado]));
  assert.deepEqual([est[2], est[3], est[10], est[11], est[12]], ['nuevo', 'nuevo', 'ambiguo', 'sin_coincidencia', 'duplicado']);
  assert.equal(pv.resumen.costoInvalido, 1); assert.equal(pv.resumen.fechaInvalida, 1); assert.equal(pv.resumen.loteSinReferencia, 1); assert.equal(pv.resumen.proveedorDesconocido, 1);
  assert.match(pv.extras.find((x) => x.fila === 17).errores.join(), /no existe en Control Maestro/, 'ID dado e inexistente: no cae al correo');
  assert.ok(pv.lotes[0].avisos[0].includes('20'), 'aviso: el lote dice 20 y el archivo vincula 2');
  // resolución manual del ambiguo con cuenta madre
  const pv2 = await call(db, 'finp_vip_preview', { hojas: HOJAS, extras, lotes: [lote], resoluciones: { 10: 'vip-dup-b' } });
  assert.equal(pv2.extras.find((x) => x.fila === 10).estado, 'nuevo');
  const conMadre = await call(db, 'finp_vip_preview', { hojas: HOJAS, extras: [{ ...filaExtra(3), Correo_o_ID_extra: 'repetido@ejemplo.com', Cuenta_madre_Netflix: 'madreA@ejemplo.com' }], lotes: [lote] });
  assert.equal(conMadre.extras[0].cmId, 'vip-dup-a', 'la cuenta madre refuerza la coincidencia');
  // archivo que no es la plantilla
  const mal = await call(db, 'finp_vip_preview', { hojas: ['Hoja1'], extras, lotes: [] });
  assert.equal(mal.ok, false);
  // el hash protege contra cambios entre la vista previa y la confirmación
  const x = await call(db, 'finp_vip_confirmar', { hojas: HOJAS, extras, lotes: [lote], hash: 'otro', confirmo: true });
  assert.match(x.error, /cambió/);
});

test('VIP lista/editar/reemplazar: pestañas por proveedor, historial y el cliente de Control Maestro no cambia', async () => {
  const db = fakeFirestore(semilla());
  const extras = Array.from({ length: 3 }, (_, i) => filaExtra(i + 1));
  const pv = await call(db, 'finp_vip_preview', { hojas: HOJAS, extras, lotes: [lote] });
  await call(db, 'finp_vip_confirmar', { hojas: HOJAS, extras, lotes: [lote], hash: pv.hash, confirmo: true });
  const l = await call(db, 'finp_vip_lista', { tab: 'trap' });
  assert.equal(l.conteo.trap, 3); assert.equal(l.conteo.sin, 19); assert.equal(l.filas.length, 3);
  const id = l.filas[0].cmId;
  const e = await call(db, 'finp_vip_editar', { cmId: id, cambios: { proveedor: 'Deku peruano', costoMensualUsdt: 2.7 } });
  assert.equal(e.ok, true);
  const x = db._data.get(`fin_vip_extras/${id}`).data;
  assert.deepEqual([x.grupo, x.costoMensualUsdt, x.costoMensualHnl], ['deku', 2.7, 71.55]);
  assert.equal(x.historial.at(-1).antes.proveedorId, 'trap-colombia');
  const r = await call(db, 'finp_vip_reemplazar', { de: id, a: 'vip-15', pagado: false });
  assert.equal(r.ok, true);
  assert.equal(db._data.get(`fin_vip_extras/${id}`).data.estadoSeguimiento, 'reemplazado');
  assert.equal(db._data.get('inventario/vip-15').data.clientes[0].nombre, 'Cliente 15', 'Control Maestro intacto');
  const bad = await call(db, 'finp_vip_editar', { cmId: 'nf-x', cambios: { costoMensualUsdt: 2 } });
  assert.equal(bad.ok, false, 'no edita accesos que no son VIP');
  const lp = await call(db, 'finp_vip_lista', { tab: 'sin', pagina: 1 });
  assert.equal(lp.porPagina, 25);
});

test('Web: pestaña Finanzas con 5 pestañas, Productos en contexto y permiso propio (solo Sublicuentas por defecto)', async () => {
  const web = fs.readFileSync(new URL('../finanzas-web.js', import.meta.url), 'utf8');
  assert.match(web, /\['resumen', 'Resumen'[\s\S]*\['proveedores'[\s\S]*\['compras'[\s\S]*\['ganancias'[\s\S]*\['reportes'/);
  assert.doesNotMatch(web, /\['productos', 'Productos'/, 'Productos no es pestaña');
  assert.match(web, /Pendiente de costo/);
  const { createRequire } = await import('node:module');
  const P = createRequire(import.meta.url)('../api/_permisos.js');
  assert.equal(P.porDefecto({ usuario: 'libni', role: 'finanzas' })['finanzas-panel'], false);
  assert.ok(P.pantallasVisibles({ usuario: 'sublicuentas' }, {}).includes('finanzas'));
  assert.ok(!P.pantallasVisibles({ usuario: 'libni' }, {}).includes('finanzas'));
  assert.ok(P.pantallasVisibles({ usuario: 'libni' }, { usuarios: { libni: { modulos: { 'finanzas-panel': true } } } }).includes('finanzas'));
  const ui = fs.readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
  assert.match(ui, /\{ s: 'sala-juntas' \}, \{ s: 'finanzas' \}/);
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /finanzas-web\.js\?v=20261108-r196/);
});

test('R196f · Spotify Familiar en Finanzas: lista sola desde las cuentas; solo se anota pago mensual y renovación; Bodega lo refleja', async () => {
  const { createRequire } = await import('node:module');
  const S = createRequire(import.meta.url)('../api/_spotify-familias.js');
  const db = fakeFirestore({ clientes: {} });
  const f = await S.crearFamilia(db, { madreCorreo: 'principal@ejemplo.com' });
  const g = await S.crearFamilia(db, { madreCorreo: 'borrada@ejemplo.com' }); await S.eliminarCuenta(db, { familiaId: g.id, confirmo: true });
  let l = await call(db, 'finp_spf_lista', {});
  assert.deepEqual(l.filas.map((x) => [x.codigo, x.madreCorreo, x.costoMensualHnl]), [['SP-001', 'principal@ejemplo.com', null]], 'eliminadas no salen; sin dato = pendiente');
  assert.equal(l.sinDatos, 1);
  const bad = await call(db, 'finp_spf_guardar', { familiaId: f.id, costoMensualHnl: -5 });
  assert.equal(bad.ok, false);
  const r = await call(db, 'finp_spf_guardar', { familiaId: f.id, costoMensualHnl: 320, proximaRenovacion: '2026-11-12', ultimoPago: '2026-10-12' });
  assert.equal(r.ok, true);
  l = await call(db, 'finp_spf_lista', {});
  assert.deepEqual([l.filas[0].costoMensualHnl, l.filas[0].proximaRenovacion, l.filas[0].pronto, l.totalMensualHnl, l.pronto], [320, '2026-11-12', true, 320, 1]);
  const inv = db._data.get(`inventario/${S.idBodega(f.id)}`).data;
  assert.deepEqual([inv.costoMensualHnl, inv.proximaRenovacion, inv.ultimoPago], [320, '2026-11-12', '2026-10-12'], 'Bodega muestra pago y renovación');
  assert.equal([...db._data.keys()].filter((k) => k.startsWith('finanzas_movimientos/')).length, 0, 'editar datos no mueve caja');
});
