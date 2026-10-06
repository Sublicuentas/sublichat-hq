import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepararPago, leerPago, escribirPago, unidadesSocio, pagoSocioVista, pagoSocioDisponible } from '../api/_finanzas-operacion.js';

function fakeDb() {
  const store = new Map();
  const ref = (c, id) => ({ id, _k: `${c}/${id}`, async get() { const d = store.get(`${c}/${id}`); return { exists: !!d, data: () => d }; } });
  let n = 0;
  return { store, collection: (c) => ({ doc: (id) => ref(c, id || `a${++n}`) }),
    async runTransaction(fn) { const buf = []; const tx = { get: (r) => r.get(), set: (r, d, o) => buf.push([r._k, d, o]) }; const out = await fn(tx); for (const [k, d, o] of buf) store.set(k, o?.merge ? { ...(store.get(k) || {}), ...d } : d); return out; } };
}
const user = { uid: 'uSub', role: 'admin', usuario: 'sublicuentas' };
const MOV = 'socio_compra_ped1_cobro';
const movSocio = () => ({ tipo: 'ingreso', subtipo: 'compra_socio', monto: 110, banco: 'BAC Credomatic', bancoId: 'bac', socioNombre: 'Jimena', clienteNombre: 'Jhoseline Navas', pedidoId: 'ped1', plataforma: 'Netflix Vip', fechaPago: '2026-10-05', fichaPendiente: true, productosSocio: [{ servicio: 'Netflix Vip', perfil: 'Jhoseline Navas', cantidad: 1 }] });
const guardar = async (db, pago, rel = { clienteId: 'cli1', clienteNombre: 'Jhoseline Navas', compraId: 'c1', plataforma: 'vipnetflix' }) => {
  const prep = await prepararPago(db, pago, user, 'compra');
  return db.runTransaction(async (tx) => { const l = await leerPago(tx, db, prep); tx.set({ _k: `clientes/${rel.clienteId}` }, { nombre: rel.clienteNombre }); return escribirPago(tx, db, prep, l, rel); });
};
const ingresos = (db) => [...db.store.entries()].filter(([k, v]) => k.startsWith('finanzas_movimientos/') && v.tipo === 'ingreso');

test('R121: "Ya pagó por Socios" guarda la ficha amarrada al pago del socio y NO crea otro ingreso', async () => {
  const db = fakeDb(); db.store.set(`finanzas_movimientos/${MOV}`, movSocio());
  const r = await guardar(db, { pagoSocio: { movimientoId: MOV, productoIdx: 0 }, operationId: 'compra-c1-p1', origen: 'apk' });
  assert.equal(r.pagoSocio, true); assert.equal(r.estado, 'pagado_socio'); assert.equal(r.socio, 'Jimena'); assert.equal(r.recibido, 0);
  assert.equal(ingresos(db).length, 1, 'sigue habiendo UN solo ingreso: el del socio');
  assert.equal([...db.store.keys()].some((k) => k.includes('oper_op_')), false, 'no se crea venta ni cobro nuevos');
  const mov = db.store.get(`finanzas_movimientos/${MOV}`);
  assert.equal(mov.monto, 110); assert.equal(mov.banco, 'BAC Credomatic');
  assert.equal(mov.fichaPendiente, false); assert.equal(mov.fichasVinculadas.length, 1);
  assert.deepEqual([mov.fichasVinculadas[0].clienteId, mov.fichasVinculadas[0].compraId, mov.fichasVinculadas[0].por], ['cli1', 'c1', 'sublicuentas']);
  const aud = [...db.store.entries()].filter(([k]) => k.startsWith('auditoria_eventos/')).map(([, v]) => v);
  assert.equal(aud.length, 1); assert.equal(aud[0].accion, 'ficha_pago_socio'); assert.match(aud[0].detalle, /sin ingreso nuevo/);
  assert.ok(db.store.has('clientes/cli1'), 'la ficha se guarda en la misma transacción');
});

test('R121: mismo operationId no vincula dos veces; otra ficha contra el mismo pago ya no se puede', async () => {
  const db = fakeDb(); db.store.set(`finanzas_movimientos/${MOV}`, movSocio());
  const pago = { pagoSocio: { movimientoId: MOV, productoIdx: 0 }, operationId: 'compra-c1-p1' };
  await guardar(db, pago);
  const r2 = await guardar(db, pago); assert.equal(r2.duplicado, true);
  assert.equal(db.store.get(`finanzas_movimientos/${MOV}`).fichasVinculadas.length, 1);
  await assert.rejects(guardar(db, { ...pago, operationId: 'compra-c2-p1' }, { clienteId: 'cli2', clienteNombre: 'Otro', compraId: 'c2', plataforma: 'netflix' }), /ya tiene su ficha/);
  assert.equal(db.store.has('clientes/cli2'), false, 'si no se puede amarrar, tampoco se guarda la ficha');
});

test('R121: cuentas completas x3 → tres fichas contra el mismo pago; la cuarta se rechaza', async () => {
  const db = fakeDb(); db.store.set(`finanzas_movimientos/${MOV}`, { ...movSocio(), productosSocio: [{ servicio: 'Viki', cantidad: 3 }, { servicio: 'Netflix', perfil: 'Ana', cantidad: 1 }] });
  assert.deepEqual(unidadesSocio(db.store.get(`finanzas_movimientos/${MOV}`)).map((u) => u.restantes), [3, 1]);
  for (let i = 1; i <= 3; i++) { const r = await guardar(db, { pagoSocio: { movimientoId: MOV, productoIdx: 0 }, operationId: `compra-viki-000${i}` }, { clienteId: `v${i}`, clienteNombre: `V${i}`, compraId: `k${i}`, plataforma: 'viki' }); assert.equal(r.fichasPendientes, 4 - i); }
  assert.equal(db.store.get(`finanzas_movimientos/${MOV}`).fichaPendiente, true, 'falta la de Netflix');
  await assert.rejects(guardar(db, { pagoSocio: { movimientoId: MOV, productoIdx: 0 }, operationId: 'compra-viki-0004' }), /ya tiene su ficha/);
  const vista = pagoSocioVista({ ...db.store.get(`finanzas_movimientos/${MOV}`), id: MOV });
  assert.deepEqual(vista.productos.map((p) => [p.idx, p.servicio, p.restantes]), [[1, 'Netflix', 1]]);
});

test('R121: solo contra un pago de socio real y vigente; solo Sublicuentas/Relojes; solo compras', async () => {
  const db = fakeDb(); db.store.set(`finanzas_movimientos/${MOV}`, { ...movSocio(), estadoFinanciero: 'anulado' });
  db.store.set('finanzas_movimientos/socio_compra_x_cobro', { tipo: 'ingreso', subtipo: 'renovacion_socio', monto: 50 });
  const p = (movimientoId, operationId = 'compra-zz-0001') => ({ pagoSocio: { movimientoId, productoIdx: 0 }, operationId });
  await assert.rejects(guardar(db, p(MOV)), /anulado o corregido/);
  await assert.rejects(guardar(db, p('socio_compra_x_cobro')), /no es una compra de socio/);
  await assert.rejects(guardar(db, p('socio_compra_noexiste_cobro')), /ya no existe/);
  await assert.rejects(prepararPago(db, p('oper_op_u_abc_cobro'), user, 'compra'), /Elija la compra de socio/);
  await assert.rejects(prepararPago(db, p(MOV), { uid: 'v', role: 'vendedor', usuario: 'heber' }, 'compra'), /solo lo registran/);
  await assert.rejects(prepararPago(db, p(MOV), user, 'renovacion'), /solo aplica al armar la ficha de una compra/);
  await assert.rejects(prepararPago(db, p(MOV, 'x'), user, 'compra'), /operationId/);
  assert.equal(db.store.has('clientes/cli1'), false);
  assert.equal(pagoSocioDisponible(movSocio()), true);
  assert.equal(pagoSocioDisponible({ ...movSocio(), estadoFinanciero: 'anulado' }), false);
  assert.equal(pagoSocioDisponible({ ...movSocio(), fichaPendiente: false }), false);
  assert.equal(pagoSocioDisponible({ ...movSocio(), tipo: 'venta' }), false);
});

test('R121: /api/finanzas lista las compras de socios sin ficha y permite quitar las que ya la tienen', () => {
  const src = fs.readFileSync(new URL('../api/finanzas.js', import.meta.url), 'utf8');
  assert.match(src, /accion === "listar_pagos_socios_sin_ficha"/);
  assert.match(src, /where\("fichaPendiente", "==", true\)/);
  assert.match(src, /accion === "socio_ficha_lista"/);
  assert.match(src, /"registrar_operacion_pago", "listar_pagos_socios_sin_ficha", "socio_ficha_lista", "listar_pendientes"/);
  const centro = src.slice(src.indexOf('async function handleCentro'));
  assert.match(centro.slice(0, 400), /canUseLibro\(identity\)/, 'solo Sublicuentas y Relojes');
});

test('R121 web: opción "Ya pagó por Socios", cuadro de pago por encima de la ficha, URL directo al cliente y número del vendedor', () => {
  const app = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(app, /🤝 Ya pagó por Socios/);
  assert.match(app, /if\(pago\.modo==="socio"\)return \{pagoSocio:\{movimientoId:pago\.movimientoId,productoIdx:pago\.productoIdx\},operationId,origen:"web"\}/);
  assert.match(app, /permitirSocio:true\}\);/);
  const z = Number(/z-index:(\d+);background:rgba\(15,23,42,\.45\)/.exec(app)[1]), zFicha = Number(/\.ficha-overlay\{[^}]*z-index:(\d+)/.exec(app)[1]);
  assert.ok(z > zFicha, 'el cuadro de pago queda encima de la ficha (antes quedaba escondido detrás)');
  assert.match(app, /const appLink=num\?`whatsapp:\/\/send\?phone=\$\{num\}&text=\$\{enc\}`/);
  assert.equal((app.match(/fichaOpenWhatsAppCliente\(mensaje\)/g) || []).length, 3, 'las dos entregas por URL abren el chat del cliente');
  assert.match(app, /fichaOpenWhatsApp\(texto\);/, 'la ficha tradicional sigue yendo al grupo, sin número');
  assert.match(app, /if\(vtel\)\{ telEl\.value=vtel; return; \}/);
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /sublichat-app\.js\?v=20261005-r121-socios/);
});
