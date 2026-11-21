// R199e · Caso real: HBO con Aaron y Leyda mostraba «Ocupados 5/3» (Aaron ×2, Leyda ×3).
// La Web agregaba una fila nueva cada vez que se guardaba la ficha si la fila existente traía otro perfilId,
// y la reparación de Bodega hacía lo mismo. Un perfil = UNA fila; nunca se quita a otra persona. Datos FICTICIOS.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fakeFirestore } from './helpers/fake-firestore.mjs';
import { reconciliarInventario } from '../api/inventario.js';
const { __r188: R } = await import('../api/renovar.js');
const T = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

function fakeDb(seed = {}) {
  const data = {};
  for (const [col, docs] of Object.entries(seed)) data[col] = new Map(Object.entries(docs).map(([id, d]) => [id, structuredClone(d)]));
  const col = (name) => (data[name] ||= new Map());
  const snapOf = (name, id) => {
    const d = col(name).get(id);
    return { id, exists: !!d, data: () => (d ? structuredClone(d) : undefined), get: (f) => (d ? d[f] : undefined), ref: refOf(name, id) };
  };
  const refOf = (name, id) => ({
    id,
    get: async () => snapOf(name, id),
    set: async (v, o) => { col(name).set(id, o && o.merge ? { ...(col(name).get(id) || {}), ...structuredClone(v) } : structuredClone(v)); },
    update: async (v) => { col(name).set(id, { ...(col(name).get(id) || {}), ...structuredClone(v) }); },
    delete: async () => { col(name).delete(id); },
  });
  const query = (name, filters = [], start = '', lim = 1e9) => ({
    where: (f, op, v) => query(name, [...filters, [f, op, v]], start, lim),
    orderBy: () => query(name, filters, start, lim),
    startAfter: (c) => query(name, filters, String(c), lim),
    limit: (n) => query(name, filters, start, n),
    get: async () => {
      let ids = [...col(name).keys()].sort();
      if (start) ids = ids.filter((i) => i > start);
      ids = ids.filter((i) => filters.every(([f, op, v]) => { const x = col(name).get(i)[f]; return op === '==' ? x === v : op === '>' ? String(x || '') > v : true; }));
      const docs = ids.slice(0, lim).map((i) => snapOf(name, i));
      return { docs, size: docs.length, empty: !docs.length, forEach: (fn) => docs.forEach(fn) };
    },
  });
  let auto = 0;
  return {
    _data: data,
    collection: (name) => ({ ...query(name), doc: (id) => refOf(name, id || `auto${++auto}`), add: async (v) => { const id = `auto${++auto}`; col(name).set(id, structuredClone(v)); return refOf(name, id); } }),
    runTransaction: async (fn) => fn({ get: (ref) => ref.get(), set: (ref, v, o) => ref.set(v, o), update: (ref, v) => ref.update(v), delete: (ref) => ref.delete() }),
  };
}

const CORREO = 'primal@prueba.test';
const cuenta = (clientes) => fakeFirestore({ inventario: { h1: { plataforma: 'hbomax', planHbo: 'standard', correo: CORREO, capacidad: 3, estado: 'activa', clientes } } });
const sv = (compraId, perfiles) => ({ plataforma: 'hbomax', compraId, correo: CORREO, perfiles: perfiles.map((p) => ({ ...p, correo: CORREO })) });

test('1 · copia fiel de la librería del bot (misma regla en ambos sistemas)', () => {
  const web = T('api/_perfiles-inventario.js').split('\n').slice(1).join('\n');
  const botPath = new URL('../../bot-gh/lib_perfiles_inventario.js', import.meta.url);
  if (fs.existsSync(botPath)) assert.equal(web, fs.readFileSync(botPath, 'utf8').split('\n').slice(1).join('\n'));
  assert.match(T('api/_perfiles-inventario.js'), /COPIA FIEL: lib_perfiles_inventario\.js/);
});

test('2 · guardar la ficha de Leyda 3 veces, y con perfilId regenerado, deja UNA fila', async () => {
  const db = cuenta([]);
  const s1 = sv('kL', [{ perfilId: 'pL', nombre: 'Leyda Prueba', pinPerfil: '0000' }]);
  await R.sincronizarInventarioServicio(db, { nuevo: s1, nombreTitular: 'Leyda Prueba', clienteId: 'cL' });
  await R.sincronizarInventarioServicio(db, { anterior: s1, nuevo: s1, nombreTitular: 'Leyda Prueba', clienteId: 'cL' });
  const s2 = sv('kL', [{ perfilId: 'pL-nuevo', nombre: 'Leyda Prueba', pinPerfil: '0000' }]);
  await R.sincronizarInventarioServicio(db, { anterior: s1, nuevo: s2, nombreTitular: 'Leyda Prueba', clienteId: 'cL' });
  const d = db._data.get('inventario/h1').data;
  assert.equal(d.clientes.length, 1, 'antes quedaban 2 (la fila vieja tenía otro perfilId)');
  assert.equal(d.clientes[0].perfilId, 'pL-nuevo');
  assert.equal(d.disponibles, 2);
});

test('3 · cuenta con copias de Aaron: al guardar su ficha queda 1; la otra persona sigue', async () => {
  const db = cuenta([
    { nombre: 'Aaron Prueba', pin: '2000', perfilId: 'pA', compraId: 'kA', clienteId: 'cA', slot: 1 },
    { nombre: 'Aaron Prueba', pin: '2000', perfilId: 'pA-viejo', compraId: 'kA', clienteId: 'cA', slot: 2 },
    { nombre: 'Otra Persona', pin: '0000', slot: 3 },
  ]);
  const s = sv('kA', [{ perfilId: 'pA', nombre: 'Aaron Prueba', pinPerfil: '2000' }]);
  await R.sincronizarInventarioServicio(db, { anterior: s, nuevo: s, nombreTitular: 'Aaron Prueba', clienteId: 'cA' });
  const d = db._data.get('inventario/h1').data;
  assert.deepEqual(d.clientes.map((c) => c.nombre), ['Aaron Prueba', 'Otra Persona']);
  assert.equal(d.ocupados, 2); assert.equal(d.disponibles, 1); assert.equal(d.sobreasignada, false);
});

test('4 · compra de 2 perfiles con el mismo nombre y PIN → 2 filas (no se pisa al perfil hermano)', async () => {
  const db = cuenta([]);
  const s = sv('kA', [{ perfilId: 'p1', nombre: 'Aaron Prueba', pinPerfil: '2000' }, { perfilId: 'p2', nombre: 'Aaron Prueba', pinPerfil: '2000' }]);
  await R.sincronizarInventarioServicio(db, { nuevo: s, nombreTitular: 'Aaron Prueba', clienteId: 'cA' });
  await R.sincronizarInventarioServicio(db, { anterior: s, nuevo: s, nombreTitular: 'Aaron Prueba', clienteId: 'cA' });
  assert.deepEqual(db._data.get('inventario/h1').data.clientes.map((c) => c.perfilId), ['p1', 'p2']);
});

test('5 · reparación de Bodega (Sincronizar): adopta la fila con perfilId viejo y quita copias; no agrega otra', async () => {
  const db = fakeDb({
    inventario: { acc1: { plataforma: 'hbomax', correo: CORREO, capacidad: 3, clientes: [
      { nombre: 'Leyda Prueba', pin: '0000', perfilId: 'pL-viejo', compraId: 'kL', clienteId: 'cL', slot: 1 },
      { nombre: 'Leyda Prueba', pin: '0000', perfilId: 'pL-viejo', compraId: 'kL', clienteId: 'cL', slot: 2 },
      { nombre: 'Otra Persona', pin: '0000', slot: 3 }] } },
    clientes: { cL: { nombre: 'Leyda Prueba', nombrePerfil: 'Leyda Prueba', servicios: [sv('kL', [{ perfilId: 'pL', nombre: 'Leyda Prueba', pinPerfil: '0000' }])] } },
  });
  const [acc] = await reconciliarInventario(db, [{ ...db._data.inventario.get('acc1'), id: 'acc1' }]);
  const nombres = acc.clientes.map((c) => c.nombre).sort();
  assert.deepEqual(nombres, ['Leyda Prueba', 'Otra Persona']);
  assert.equal(acc.clientes.find((c) => c.nombre === 'Leyda Prueba').perfilId, 'pL');
});
