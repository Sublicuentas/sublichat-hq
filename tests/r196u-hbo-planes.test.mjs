// R196u Fase 3 · HBO Max Platinum (5) / Standard (3) por cuenta (PDF 06). Firestore en memoria, datos ficticios.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
const require = createRequire(import.meta.url);
const P = require('../api/_hbo-planes.js');
const R = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const cli = (n) => Array.from({ length: n }, (_, i) => ({ clienteId: 'c' + i, nombre: 'Cliente ' + i, slot: i + 1 }));
const doc = (db, id) => db._data.get(`inventario/${id}`).data;

test('HBO-01 · Platinum = 5 perfiles y Standard = 3; la capacidad de la cuenta queda igual al plan', async () => {
  const db = fakeFirestore({ inventario: { h1: { plataforma: 'hbomax', correo: 'hbo1@ejemplo.com', capacidad: 5, clientes: cli(2), ocupados: 2 }, h2: { plataforma: 'hbomax', correo: 'hbo2@ejemplo.com', capacidad: 5, clientes: cli(1), ocupados: 1 } } });
  assert.equal(P.etiquetaPlan(doc(db, 'h1')), 'HBO · 2/5 · plan sin definir');
  const a = await P.cambiarPlan(db, { inventarioId: 'h1', plan: 'platinum', usuario: 'sublicuentas' });
  const b = await P.cambiarPlan(db, { inventarioId: 'h2', plan: 'standard', usuario: 'sublicuentas' });
  assert.deepEqual([a.etiqueta, a.capacidad, a.libres], ['Platinum · 2/5', 5, 3]);
  assert.deepEqual([b.etiqueta, b.capacidad, b.libres], ['Standard · 1/3', 3, 2]);
  assert.equal(doc(db, 'h2').capacidad, 3); assert.equal(doc(db, 'h2').disponibles, 2);
  const r = await P.resumenHbo(db);
  assert.deepEqual([r.platinum.cuentas, r.standard.cuentas, r.sinPlan], [1, 1, 0]);
  assert.equal(P.planPorCapacidad(5), 'platinum'); assert.equal(P.planPorCapacidad(3), 'standard'); assert.equal(P.planPorCapacidad(4), '');
});

test('HBO-02 · cuenta vieja conserva sus asignaciones; bajar a Standard con 4 ocupados se BLOQUEA sin sacar a nadie', async () => {
  const vieja = { plataforma: 'hbomax', correo: 'vieja@ejemplo.com', capacidad: 5, clientes: cli(4), ocupados: 4 };
  const db = fakeFirestore({ inventario: { h1: vieja } });
  await assert.rejects(P.cambiarPlan(db, { inventarioId: 'h1', plan: 'standard' }), (e) => e.code === 'requiere_excepcion' && e.capacidadSugerida === 4 && /4 perfiles ocupados/.test(e.message)); // R196z3: sin confirmar se bloquea y se ofrece la excepción; nunca se saca a nadie
  assert.deepEqual(doc(db, 'h1'), vieja, 'no se tocó nada');
  await P.cambiarPlan(db, { inventarioId: 'h1', plan: 'platinum', usuario: 'sublicuentas' });
  assert.equal(doc(db, 'h1').clientes.length, 4); assert.equal(doc(db, 'h1').historialPlan[0].de, 'sin_plan');
  await assert.rejects(P.cambiarPlan(db, { inventarioId: 'h1', plan: 'gold' }), /Plan no válido/);
});

test('HBO · solo cuentas HBO; Web/API no permiten editar la capacidad a mano contra el plan; crear con 5/3 asigna plan', () => {
  const s = R('api/inventario.js');
  assert.match(s, /const pl = hboPlanes\.planDeCuenta\(current\); if \(pl && cap !== pl\.capacidad && cap !== hboPlanes\.capacidadEfectiva\(current\)\) return res\.status\(200\)\.json\(\{ error: `Esta cuenta es \$\{pl\.nombre\}/);
  assert.match(s, /if \(nuevaCuenta\.plataforma === hboPlanes\.PLAT_HBO && hboPlanes\.planPorCapacidad\(cap\)\) nuevaCuenta\.planHbo = hboPlanes\.planPorCapacidad\(cap\);/);
  assert.match(s, /const adminHbo = spotifyFam\.esAdministradorMadres\(authUser\) \|\| permisosCtx\.overrides\?\.\["hbo-planes"\] === true;/);
  assert.match(s, /if \(!adminHbo\) return res\.status\(403\)/);
});

test('HBO · Web muestra «Platinum 4/5»; Control Maestro NO se toca (solo consulta)', async () => {
  const app = R('sublichat-app.js');
  assert.match(app, /function invPlanHbo\(c\)\{const p=\{platinum:\["Platinum",5\],standard:\["Standard",3\]\}[^\n]*k!==p\[1\]\?" · Capacidad personalizada"/);
  assert.doesNotMatch(R('control-maestro.js'), /R196u/); // R196v ya autorizó mostrar el plan (solo consulta): ver r196v-hbo-planes-venta
  await assert.rejects(P.cambiarPlan(fakeFirestore({ inventario: { n: { plataforma: 'netflix', capacidad: 5 } } }), { inventarioId: 'n', plan: 'standard' }), /solo aplica a cuentas HBO/);
});
