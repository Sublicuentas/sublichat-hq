// R196v Fase 3 · HBO Standard (3) / Platinum (5) en la VENTA: perfiles y cuenta completa, validados en el SERVIDOR.
// PDF «Netflix Hogar y HBO Standard/Platinum» · 03/04 · pruebas 04–09, 12, 13. Firestore en memoria, datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
const require = createRequire(import.meta.url);
const P = require('../api/_hbo-planes.js');
const { __r188: R } = await import('../api/renovar.js');
const T = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const cli = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ clienteId: 'c' + i, compraId: 'k' + i, nombre: 'Cliente ' + i, slot: i + 1, ...extra }));
const venta = (plat, extra = {}) => R.buildServicio({ plataforma: plat, correo: 'hbo.demo@ejemplo.com', clave: 'x', pinPerfil: '1234', fechaRenovacion: '20/12/2026', compraId: 'nueva', ...extra }, '', {}, 'Cliente Nuevo');
const bodega = (d) => fakeFirestore({ inventario: { h1: { plataforma: 'hbomax', correo: 'hbo.demo@ejemplo.com', estado: 'activa', ...d } } });

test('las opciones de venta se guardan como hbomax + planHbo (sin renombrar la plataforma)', () => {
  const s = venta('hbomax_standard'); assert.deepEqual([s.plataforma, s.planHbo, s.tipoVenta], ['hbomax', 'standard', 'perfil']);
  const c = venta('hbomax_platinum', { tipoVenta: 'cuenta_completa' }); assert.deepEqual([c.plataforma, c.planHbo, c.tipoVenta, c.categoria], ['hbomax', 'platinum', 'cuenta_completa', 'cuentas_completas']);
  assert.deepEqual(P.OPCIONES_VENTA.map((o) => [o.label, o.labelCompleta]), [['HBO Standard', 'HBO Standard · cuenta completa'], ['HBO Platinum', 'HBO Platinum · cuenta completa']]);
});

test('04 · Standard por perfil: 3 asignaciones; la 4.ª se BLOQUEA en el servidor', async () => {
  const db = bodega({ planHbo: 'standard', capacidad: 3, clientes: cli(3) });
  await assert.rejects(R.validarHboServicio(db, venta('hbomax_standard'), null), /Standard ya está llena \(3\/3\)/);
  const db2 = bodega({ planHbo: 'standard', capacidad: 3, clientes: cli(2) });
  await R.validarHboServicio(db2, venta('hbomax_standard'), null);
  assert.equal(P.cuposVendibles(db2._data.get('inventario/h1').data), 1, 'Standard con 2 ocupados: queda 1');
});

test('05 · Platinum por perfil: 5 asignaciones; la 6.ª se BLOQUEA; con 3 ocupados quedan 2', async () => {
  await assert.rejects(R.validarHboServicio(bodega({ planHbo: 'platinum', capacidad: 5, clientes: cli(5) }), venta('hbomax_platinum'), null), /Platinum ya está llena \(5\/5\)/);
  assert.equal(P.cuposVendibles({ plataforma: 'hbomax', planHbo: 'platinum', capacidad: 5, clientes: cli(3) }), 2);
});

test('06/07 · cuenta completa (Standard y Platinum): ocupa la cuenta entera; no se vende ni un perfil más', async () => {
  for (const plan of ['standard', 'platinum']) {
    const cap = plan === 'standard' ? 3 : 5;
    const db = bodega({ planHbo: plan, capacidad: cap, clientes: [] });
    const completa = venta(`hbomax_${plan}`, { tipoVenta: 'cuenta_completa' });
    await R.validarHboServicio(db, completa, null);
    await R.sincronizarInventarioServicio(db, { nuevo: completa, nombreTitular: 'Cliente Nuevo', clienteId: 'cliN' });
    const d = db._data.get('inventario/h1').data;
    assert.equal(d.clientes.length, 1); assert.equal(d.clientes[0].cuentaCompleta, true); assert.equal(d.disponibles, 0, 'completa = 0 para terceros');
    assert.equal(P.etiquetaPlan(d), `${plan === 'standard' ? 'Standard' : 'Platinum'} · cuenta completa`);
    await assert.rejects(R.validarHboServicio(db, venta(`hbomax_${plan}`, { compraId: 'otra' }), null), /ya está vendida como cuenta completa/);
  }
  await assert.rejects(R.validarHboServicio(bodega({ planHbo: 'standard', capacidad: 3, clientes: cli(1) }), venta('hbomax_standard', { tipoVenta: 'cuenta_completa' }), null), /tiene 1 perfil\(es\) de otros clientes/);
});

test('08 · Standard y Platinum no se mezclan; cuenta sin plan no recibe ventas con plan', async () => {
  await assert.rejects(R.validarHboServicio(bodega({ planHbo: 'platinum', capacidad: 5, clientes: [] }), venta('hbomax_standard'), null), /Esa cuenta es HBO Max Platinum y la venta es HBO Max Standard: no se mezclan/);
  await assert.rejects(R.validarHboServicio(bodega({ capacidad: 5, clientes: [] }), venta('hbomax_platinum'), null), /no tiene plan definido/);
  const k = P.contadoresHbo([{ plataforma: 'hbomax', planHbo: 'standard', capacidad: 3, clientes: cli(2) }, { plataforma: 'hbomax', planHbo: 'platinum', capacidad: 5, clientes: cli(1, { cuentaCompleta: true }) }, { plataforma: 'hbomax', planHbo: 'platinum', capacidad: 5, clientes: [] }, { plataforma: 'hbomax', capacidad: 5 }]);
  assert.deepEqual(k.standard, { cuentas: 1, compartidas: 1, libres: 1, completas: 0, completasLibres: 0 });
  assert.deepEqual(k.platinum, { cuentas: 2, compartidas: 1, libres: 5, completas: 1, completasLibres: 1 }); assert.equal(k.sinPlan, 1);
});

test('12/13 · venta «HBO Max» antigua: se respeta; editar precio/fecha no se bloquea; toma plan solo si la cuenta lo tiene', async () => {
  const vieja = { plataforma: 'hbomax', correo: 'hbo.demo@ejemplo.com', clave: 'x', perfiles: [{ nombre: 'Cliente 0', correo: 'hbo.demo@ejemplo.com', clave: 'x', pinPerfil: '1' }], compraId: 'k0', precio: 80, fechaRenovacion: '01/12/2026', tipoVenta: 'perfil' };
  const editada = R.buildServicio({ precio: 85, fechaRenovacion: '01/01/2027' }, '', vieja, 'Cliente 0');
  assert.equal(editada.planHbo, undefined, 'sin plan: no se inventa');
  const llena = bodega({ planHbo: 'standard', capacidad: 3, clientes: cli(3) });
  await R.validarHboServicio(llena, editada, vieja); // ya estaba: editar no se bloquea aunque la cuenta esté llena
  assert.equal(editada.precio, 85); assert.equal(editada.fechaRenovacion, '01/01/2027');
  const nuevaSinPlan = venta('hbomax', { compraId: 'z9' });
  await R.validarHboServicio(bodega({ planHbo: 'platinum', capacidad: 5, clientes: cli(1) }), nuevaSinPlan, null);
  assert.equal(nuevaSinPlan.planHbo, 'platinum', 'plan verificable por la cuenta de Bodega');
  const sinNada = venta('hbomax', { compraId: 'z8' }); await R.validarHboServicio(bodega({ capacidad: 5, clientes: [] }), sinNada, null);
  assert.equal(sinNada.planHbo, undefined, 'cuenta sin plan → la venta queda sin plan (lista para asignación humana)');
});

test('09 · Web: opciones «HBO Standard / HBO Platinum» (sin número de perfiles, pedido del dueño) y «· cuenta completa»; editar conserva el plan; selector filtra por plan', () => {
  const app = T('sublichat-app.js');
  assert.match(app, /\["hbomax_standard","HBO Standard"\],\["hbomax_platinum","HBO Platinum"\],\["hbomax","HBO Max \(venta anterior, sin plan\)"\]/);
  assert.match(app, /o\.textContent=cat==="cuentas_completas"\?`HBO \$\{ph==="platinum"\?"Platinum":"Standard"\} · cuenta completa`:`HBO \$\{ph==="platinum"\?"Platinum":"Standard"\}`/);
  assert.doesNotMatch(app, /[35] perfiles/, 'sin «3/5 perfiles» en las opciones');
  assert.match(app, /\.\.\.\(fichaPlanHboDe\(plat\)\?\{planHbo:fichaPlanHboDe\(plat\)\}:\{\}\), \/\/ R196v/);
  assert.match(app, /selectorPlataforma\.value=`hbomax_\$\{s\.planHbo\}`/);
  assert.match(app, /if\(planVenta&&String\(c\.planHbo\|\|""\)!==planVenta\)return false;/);
  assert.equal((T('api/renovar.js').match(/await validarHboServicio\(db, nuevo, /g) || []).length, 3, 'crear, agregar y editar validan en el servidor');
  const cm = T('control-maestro.js'); // 11 · Control Maestro solo MUESTRA plan; la cuenta completa ya la reconoce por la venta (R196q)
  assert.match(cm, /planHbo:\/hbo\/i\.test\(String\(g\.family\|\|''\)\)/);
  assert.match(cm, /\{standard:'HBO Standard',platinum:'HBO Platinum',sin_plan:'HBO · plan sin definir'\}\[a\.planHbo\]/);
  assert.ok(cm.split('\n').filter((l) => /R196v/.test(l)).every((l) => !/<button|<form|<input|addEventListener|fetch\(/.test(l)), 'sin flujos nuevos');
});

test('12 · Diagnóstico HBO (solo lectura): cuentas sin plan, fuera de plan y ventas sin plan — separa lo verificable de lo que decide una persona', async () => {
  const db = fakeFirestore({
    inventario: {
      s1: { plataforma: 'hbomax', planHbo: 'standard', correo: 'std@ejemplo.com', capacidad: 3, clientes: cli(4) },
      n1: { plataforma: 'hbomax', correo: 'vieja5@ejemplo.com', capacidad: 5, clientes: cli(2) },
      n2: { plataforma: 'hbomax', correo: 'rara4@ejemplo.com', capacidad: 4, clientes: [] },
    },
    clientes: {
      a: { nombrePerfil: 'Cliente A', servicios: [{ plataforma: 'hbomax', correo: 'std@ejemplo.com', compraId: 'x1' }, { plataforma: 'netflix', correo: 'n@ejemplo.com' }] },
      b: { nombrePerfil: 'Cliente B', servicios: [{ plataforma: 'hbomax', correo: 'vieja5@ejemplo.com', compraId: 'x2', tipoVenta: 'cuenta_completa' }, { plataforma: 'hbomax', planHbo: 'platinum', correo: 'p@ejemplo.com' }] },
    },
  });
  const antes = JSON.stringify([...db._data.entries()]);
  const r = await P.diagnosticoHbo(db);
  assert.deepEqual(r.sinPlan.map((c) => c.correo).sort(), ['rara4@ejemplo.com', 'vieja5@ejemplo.com']);
  assert.match(r.sinPlan.find((c) => c.correo === 'rara4@ejemplo.com').sugerencia, /decide una persona/);
  assert.deepEqual(r.fueraDePlan.map((c) => [c.correo, c.ocupados, c.capacidad]), [['std@ejemplo.com', 4, 3]]);
  assert.equal(r.ventasSinPlan.length, 2); assert.equal(r.ventasRequierenPersona, 1);
  assert.equal(r.ventasSinPlan.find((v) => v.compraId === 'x1').planVerificable, 'standard');
  assert.equal(JSON.stringify([...db._data.entries()]), antes, 'no escribe nada');
  assert.match(T('api/inventario.js'), /if \(accion === "hboDiagnostico"\) \{ if \(!adminHbo\) return res\.status\(403\)/);
});
