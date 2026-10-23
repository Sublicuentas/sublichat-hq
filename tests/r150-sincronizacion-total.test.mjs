// R150 · Oct-2026 · Sincronización total Bodega ↔ fichas (brief "Actualización general de Sublichat").
// Corre la lógica REAL de api/inventario.js contra un Firestore en memoria.
import test from 'node:test';
import assert from 'node:assert/strict';
import { reconciliarInventario, auditarInventario } from '../api/inventario.js';
import tvDigital from '../api/_tv-digital.js';
import fs from 'node:fs';

// ---------- Firestore mínimo en memoria ----------
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
const cliente = (nombre, servicios) => ({ nombre, nombrePerfil: nombre, servicios });
const perfil = (id, nombre, correo, extra = {}) => ({ perfilId: id, nombre, correo, clave: 'k1', ...extra });

test('Cuenta compartida con 5 clientes reales muestra 5/5 aunque Bodega tenga contadores viejos', async () => {
  const servicios = (i) => [{ plataforma: 'hbomax', compraId: `c${i}`, correo: 'hbo@x.com', perfiles: [perfil(`p${i}`, `Cliente ${i}`, 'hbo@x.com')] }];
  const db = fakeDb({
    inventario: { acc1: { plataforma: 'hbomax', correo: 'hbo@x.com', capacidad: 5, ocupados: 3, disponibles: 2, clientes: [{ nombre: 'Cliente 1', slot: 1 }] } },
    clientes: Object.fromEntries([1, 2, 3, 4, 5].map((i) => [`cli${i}`, cliente(`Cliente ${i}`, servicios(i))])),
  });
  const [acc] = await reconciliarInventario(db, [{ ...db._data.inventario.get('acc1'), id: 'acc1' }]);
  assert.equal(acc.clientes.length, 5);
  assert.equal(acc.ocupados, 5);
  assert.equal(acc.disponibles, 0);
  assert.equal(db._data.inventario.get('acc1').accountId, 'acc1', 'se marca el accountId inmutable');
});

test('Cambiar el correo de la cuenta: el enlace por accountId mantiene los 5 vínculos (sin cuenta paralela)', async () => {
  const db = fakeDb({
    // La cuenta ya tiene el correo NUEVO; las fichas quedaron con el viejo pero enlazadas por inventarioId.
    inventario: { acc1: { plataforma: 'hbomax', correo: 'nuevo@x.com', capacidad: 5, clientes: [] } },
    clientes: Object.fromEntries([1, 2, 3, 4, 5].map((i) => [`cli${i}`, cliente(`C${i}`, [{ plataforma: 'hbomax', compraId: `c${i}`, perfiles: [perfil(`p${i}`, `C${i}`, 'viejo@x.com', { inventarioId: 'acc1' })] }])])),
  });
  const [acc] = await reconciliarInventario(db, [{ ...db._data.inventario.get('acc1'), id: 'acc1' }]);
  assert.equal(acc.clientes.length, 5, 'los 5 siguen en la misma cuenta');
  const diag = await auditarInventario(db, { aplicar: false });
  assert.equal(diag.perfilesConCorreoViejo, 5);
  const rep = await auditarInventario(db, { aplicar: true });
  assert.equal(rep.fichasCorregidas, 5);
  for (const i of [1, 2, 3, 4, 5]) assert.equal(db._data.clientes.get(`cli${i}`).servicios[0].perfiles[0].correo, 'nuevo@x.com', 'la ficha recibe el correo nuevo');
  assert.equal(db._data.inventario.size, 1, 'no se creó ninguna cuenta paralela');
  const segunda = await auditarInventario(db, { aplicar: true });
  assert.equal(segunda.fichasCorregidas, 0, 'idempotente: el segundo pase no cambia nada');
  assert.equal(segunda.cuentasCorregidas, 0);
});

test('Reparar: enlaza perfiles sin accountId, detecta huérfanos, duplicados y sobreasignación', async () => {
  const db = fakeDb({
    inventario: {
      a: { plataforma: 'netflix', correo: 'n1@x.com', capacidad: 2, clientes: [] },
      b: { plataforma: 'disneyp', correo: 'dup@x.com', capacidad: 6, clientes: [] },
      c: { plataforma: 'disneys', correo: 'DUP@x.com', capacidad: 3, clientes: [] },
    },
    clientes: {
      x1: cliente('Uno', [{ plataforma: 'netflix', compraId: 'k1', perfiles: [perfil('q1', 'Uno', 'n1@x.com')] }]),
      x2: cliente('Dos', [{ plataforma: 'netflix', compraId: 'k2', perfiles: [perfil('q2', 'Dos', 'n1@x.com'), perfil('q3', 'Tres', 'n1@x.com')] }]),
      x3: cliente('Cuatro', [{ plataforma: 'netflix', compraId: 'k3', perfiles: [perfil('q4', 'Cuatro', 'sin-cuenta@x.com')] }]),
    },
  });
  const d = await auditarInventario(db, { aplicar: false });
  assert.equal(d.cuentasDuplicadas.length, 1, 'Disney Premium y sin ESPN con el mismo correo = duplicada');
  assert.equal(d.perfilesAEnlazar, 3);
  assert.equal(d.clientesHuerfanos, 1);
  assert.equal(d.sobreasignadas.length, 1);
  assert.equal(d.sobreasignadas[0].ocupados, 3);
  const r = await auditarInventario(db, { aplicar: true });
  assert.equal(r.fichasCorregidas, 2);
  assert.equal(db._data.clientes.get('x1').servicios[0].perfiles[0].inventarioId, 'a');
  assert.equal(db._data.inventario.get('a').clientes.length, 3, 'la sobreasignación queda visible, no se esconde');
  assert.equal(db._data.inventario.get('a').sobreasignada, true);
  assert.equal(db._data.inventario.get('b').clientes.length, 0, 'las duplicadas no se tocan (revisión manual)');
});

test('URLs de TV Digital: proveedor ICOMPLAY, override por cuenta y solo http(s)', () => {
  assert.equal(tvDigital.proveedorTv('icomplay5', ''), 'icomplay');
  assert.equal(tvDigital.proveedorTv('latintv3', 'enlatv'), 'latintv2');
  assert.equal(tvDigital.proveedorTv('stellatv1', ''), '');
  assert.equal(tvDigital.validarUrlTv('http://latinostream.xyz:80'), 'http://latinostream.xyz:80', 'ICOMPLAY usa HTTP y puerto 80');
  assert.equal(tvDigital.validarUrlTv('javascript:alert(1)'), null);
  const urls = { icomplay: { url: 'http://nuevo.example:80' } };
  assert.equal(tvDigital.urlTvServicio({ plataforma: 'icomplay3' }, urls, new Map()), 'http://nuevo.example:80', 'cambiar la URL del proveedor llega a todas las entregas');
  assert.equal(tvDigital.urlTvServicio({ plataforma: 'icomplay3', perfiles: [{ inventarioId: 'z' }] }, urls, new Map([['z', 'http://propia:8080']])), 'http://propia:8080', 'la URL propia de la cuenta manda');
});

test('Renovación por duración: vigente suma desde el vencimiento, vencido desde hoy, base forzable', () => {
  const src = fs.readFileSync(new URL('../api/renovar.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const pick = (n) => { const i = src.indexOf(`\nfunction ${n}(`); return src.slice(i, src.indexOf('\n}\n', i) + 3); };
  const f = new Function(['parseFechaDMY', 'hoyDMYTegucigalpa', 'sumarDias', 'dmyDe', 'sumarMesesDMY', 'calcularRenovacionPorDuracion'].map(pick).join('\n') +
    '\nfunction crmUserError(m){return new Error(m)}\nreturn {calcularRenovacionPorDuracion,sumarMesesDMY,hoyDMYTegucigalpa,sumarDias};')();
  const hoy = f.hoyDMYTegucigalpa();
  const [d, m, y] = hoy.split('/').map(Number);
  const futuro = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y + 1}`;
  assert.equal(f.calcularRenovacionPorDuracion(futuro, { unidad: 'meses', cantidad: 2 }).fechaBase, futuro);
  assert.equal(f.calcularRenovacionPorDuracion('01/01/2020', { unidad: 'dias', cantidad: 15 }).fechaNueva, f.sumarDias(hoy, 15), '15 días desde hoy si ya venció');
  assert.equal(f.calcularRenovacionPorDuracion('01/01/2020', { unidad: 'meses', cantidad: 1, base: 'vencimiento' }).fechaNueva, '01/02/2020');
  assert.equal(f.sumarMesesDMY('31/01/2027', 1), '28/02/2027', 'fin de mes no salta a marzo');
  for (const n of [1, 2, 3, 4, 6, 7, 9, 12]) assert.ok(/^\d{2}\/\d{2}\/\d{4}$/.test(f.calcularRenovacionPorDuracion(futuro, { unidad: 'meses', cantidad: n }).fechaNueva));
  assert.throws(() => f.calcularRenovacionPorDuracion(futuro, { unidad: 'meses', cantidad: 25 }));
});

test('ICOMPLAY MAX: planes 1/3/5/7 pantallas × 1/3/6/12 meses en Web; meses válidos en el servidor', () => {
  const web = fs.readFileSync(new URL('../sublichat-app.js', import.meta.url), 'utf8');
  assert.match(web, /ICOMPLAY_PRECIOS=\{1:\{1:179,3:499,6:949,12:1799\},3:\{1:249,3:699,6:1349,12:2499\},5:\{1:329,3:929,6:1799,12:3399\},7:\{1:399,3:1129,6:2199,12:4199\}\}/);
  const api = fs.readFileSync(new URL('../api/renovar.js', import.meta.url), 'utf8');
  assert.match(api, /icomplay:\[1,3,6,12\]/);
});

test('Nota interna: campo aparte, nunca en el portal del cliente', () => {
  const api = fs.readFileSync(new URL('../api/renovar.js', import.meta.url), 'utf8');
  assert.match(api, /acc === "nota_interna"/);
  const acceso = fs.readFileSync(new URL('../api/acceso.js', import.meta.url), 'utf8');
  assert.doesNotMatch(acceso, /notaInterna/, 'el portal /c/ arma sus campos uno por uno y no incluye la nota');
});
