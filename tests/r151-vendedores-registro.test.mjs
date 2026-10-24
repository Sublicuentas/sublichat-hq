// R151 · Oct-2026 · Registro único de vendedores/socios (api/_vendedores.js) + moneda L300 + renovar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V = require('../api/_vendedores.js');

function fakeDb(seed = {}) {
  const data = Object.fromEntries(Object.entries(seed).map(([c, docs]) => [c, new Map(Object.entries(docs))]));
  const col = (n) => (data[n] ||= new Map());
  const ref = (n, id) => ({ id, get: async () => ({ id, exists: col(n).has(id), data: () => ({ ...col(n).get(id) }) }), set: async (v, o) => col(n).set(id, o && o.merge ? { ...(col(n).get(id) || {}), ...v } : { ...v }) });
  return {
    _data: data,
    collection: (n) => ({
      doc: (id) => ref(n, id),
      add: async (v) => col(n).set(String(col(n).size + 1), v),
      get: async () => { const docs = [...col(n).keys()].map((id) => ({ id, data: () => ({ ...col(n).get(id) }) })); return { docs, forEach: (fn) => docs.forEach(fn) }; },
    }),
    runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, v, o) => r.set(v, o) }),
  };
}

test('lo guardado manda sobre la lista fija: Relojes cambia de número y sale el nuevo en todos lados', async () => {
  const db = fakeDb();
  V.limpiarCache();
  let reg = await V.leerRegistro(db, { fresco: true });
  assert.equal(reg.telefonos.relojes, '32126332', 'respaldo de arranque');
  await V.guardarVendedor(db, { nombre: 'Relojes', telefono: '9999-1111', usuario: 'sublicuentas' });
  reg = await V.leerRegistro(db, { fresco: true });
  assert.equal(reg.telefonos.relojes, '99991111');
  // Ficha vieja con el número viejo → número nuevo. Número de soporte escrito a mano → se respeta.
  assert.equal(V.telefonoVigente(reg, 'Relojes', '+504 3212-6332'), '99991111');
  assert.equal(V.telefonoVigente(reg, 'Relojes', ''), '99991111');
  assert.equal(V.telefonoVigente(reg, 'Relojes', '8800-1234'), '8800-1234');
  assert.equal(V.telefonoVigente(reg, 'libni', '32126332'), '99991111', 'alias');
});

test('añadir "Sublicuentas 1" 22554675, editar, renombrar y eliminar', async () => {
  const db = fakeDb();
  V.limpiarCache();
  await V.guardarVendedor(db, { nombre: 'Sublicuentas 1', telefono: '22554675' });
  let reg = await V.leerRegistro(db, { fresco: true });
  assert.ok(reg.nombres.includes('Sublicuentas 1'));
  assert.equal(reg.telefonos['sublicuentas 1'], '22554675');
  await V.guardarVendedor(db, { nombre: 'Sublicuentas Uno', telefono: '22554675', nombreAnterior: 'Sublicuentas 1' });
  reg = await V.leerRegistro(db, { fresco: true });
  assert.ok(reg.nombres.includes('Sublicuentas Uno'));
  assert.ok(!reg.nombres.includes('Sublicuentas 1'), 'el nombre viejo ya no sale en listas');
  assert.equal(V.nombreVigente(reg, 'Sublicuentas 1'), 'Sublicuentas Uno', 'fichas viejas lo siguen encontrando');
  await V.eliminarVendedor(db, { nombre: 'Yami' });
  reg = await V.leerRegistro(db, { fresco: true });
  assert.ok(!reg.nombres.includes('Yami'), 'un eliminado no vuelve aunque esté en la lista fija');
  await assert.rejects(V.guardarVendedor(db, { nombre: 'X', telefono: '123' }), /Número inválido/);
});

test('números internacionales y socios del Panel', async () => {
  const db = fakeDb({ revendedores: { 'socio mx': { nombre: 'Socio MX', nombre_norm: 'socio mx', telefono: '525512345678', activo: true }, viejo: { nombre: 'Viejo', activo: false } } });
  V.limpiarCache();
  const reg = await V.leerRegistro(db, { fresco: true });
  assert.equal(reg.telefonos['socio mx'], '525512345678');
  assert.ok(!reg.nombres.includes('Viejo'), 'socio desactivado no sale');
  assert.equal(V.telValido('+1 305 555 1234'), '13055551234');
  assert.equal(V.telValido('+504 2255-4675'), '22554675');
  const pub = V.registroPublico(reg);
  assert.ok(pub.sellers.length && pub.sellerPhones && Array.isArray(pub.sellerPhonesKnown));
  assert.doesNotMatch(JSON.stringify(pub), /token|secret|password|private_key/i);
});

test('el bot usa el mismo archivo del registro', () => {
  const bot = path.resolve(root, '..', 'bot', 'lib_vendedores.js');
  if (!fs.existsSync(bot)) return; // solo cuando se prueban los dos repos juntos
  const sinCab = (t) => t.split('\n').slice(1).join('\n');
  assert.equal(sinCab(fs.readFileSync(bot, 'utf8')), sinCab(fs.readFileSync(path.join(root, 'api/_vendedores.js'), 'utf8')));
});

test('Web: renovar solo con +31 días, 1, 2, 3, 6, 12 meses y Personalizado', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const bloque = html.slice(html.indexOf('id="cobroDuraciones"'), html.indexOf('id="cobroRenovarHint"'));
  const labels = [...bloque.matchAll(/>(\+\d+ (?:días|mes|meses)|📅 Personalizado)</g)].map((m) => m[1]);
  assert.deepEqual(labels, ['+31 días', '+1 mes', '+2 meses', '+3 meses', '+6 meses', '+12 meses', '📅 Personalizado']);
  assert.doesNotMatch(bloque, /cobroBaseRenov|\+15 días|\+4 meses|\+7 meses|\+9 meses/);
});

test('Moneda: L pegado al número (L300), sin "Lps"', () => {
  const app = fs.readFileSync(path.join(root, 'sublichat-app.js'), 'utf8');
  assert.match(app, /const fmt = n => "L" \+ Number/);
  assert.doesNotMatch(app.replace(/base64,[A-Za-z0-9+/=]+/g, ''), /Lps\.? ?\$\{|"Lps "/);
});
